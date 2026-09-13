const express=require('express');
const crypto=require('crypto');
const {Pool}=require('pg');
const workspaceRoutes=require('./workspace');

const DATABASE_URL=process.env.DATABASE_URL||'';
const pool=DATABASE_URL?new Pool({connectionString:DATABASE_URL,ssl:{rejectUnauthorized:false},max:3,idleTimeoutMillis:30000,connectionTimeoutMillis:8000}):null;
const sha256=v=>crypto.createHash('sha256').update(String(v||'')).digest('hex');
const clean=(v,n=255)=>String(v??'').trim().slice(0,n);
let installed=false;
let ready=Promise.resolve();

if(pool){
  const schema=`
    CREATE TABLE IF NOT EXISTS crm_deals(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,client_id UUID REFERENCES clients(id) ON DELETE SET NULL,title TEXT NOT NULL,stage TEXT NOT NULL DEFAULT 'new' CHECK(stage IN('new','qualified','contacted','replied','meeting','proposal','won','lost')),value_fcfa NUMERIC,next_action TEXT,next_action_at TIMESTAMPTZ,source TEXT,notes TEXT,status TEXT NOT NULL DEFAULT 'active',created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS workspace_projects(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,client_id UUID REFERENCES clients(id) ON DELETE SET NULL,name TEXT NOT NULL,category TEXT,status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN('planned','active','review','done','paused','cancelled')),deadline TIMESTAMPTZ,description TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS workspace_tasks(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,project_id UUID REFERENCES workspace_projects(id) ON DELETE CASCADE,title TEXT NOT NULL,assignee TEXT,status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN('todo','doing','blocked','done','cancelled')),priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN('low','normal','high','urgent')),due_at TIMESTAMPTZ,notes TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS content_items(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,title TEXT NOT NULL,channel TEXT,format TEXT,status TEXT NOT NULL DEFAULT 'idea' CHECK(status IN('idea','brief','creating','review','scheduled','published','archived')),publish_at TIMESTAMPTZ,brief TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS calendar_items(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,title TEXT NOT NULL,item_type TEXT NOT NULL DEFAULT 'task',starts_at TIMESTAMPTZ NOT NULL,ends_at TIMESTAMPTZ,notes TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS business_documents(
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,client_id UUID REFERENCES clients(id) ON DELETE SET NULL,title TEXT NOT NULL,document_type TEXT NOT NULL DEFAULT 'other',status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','review','approved','sent','signed','archived')),storage_ref TEXT,metadata JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS idx_crm_deals_tenant_stage ON crm_deals(tenant_id,stage,updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_projects_tenant_status ON workspace_projects(tenant_id,status,updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status ON workspace_tasks(tenant_id,status,due_at);
    CREATE INDEX IF NOT EXISTS idx_content_tenant_status ON content_items(tenant_id,status,updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_calendar_tenant_start ON calendar_items(tenant_id,starts_at);
    CREATE INDEX IF NOT EXISTS idx_business_docs_tenant ON business_documents(tenant_id,status,updated_at DESC);`;
  ready=pool.query(schema).then(()=>console.log('HI OS workspace schema ready')).catch(e=>{console.error('workspace_schema',e.message);throw e;});
}

async function auth(req,res,next){
  if(!pool)return res.status(503).json({error:'workspace_unavailable'});
  try{
    await ready;
    const raw=req.cookies?.hi_os_session;
    if(!raw)return res.status(401).json({error:'unauthorized'});
    const q=await pool.query(`SELECT s.tenant_id,s.user_id,u.role,u.email,u.status FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() LIMIT 1`,[sha256(raw)]);
    if(!q.rowCount||q.rows[0].status!=='active'||!['ceo','admin_ops'].includes(q.rows[0].role))return res.status(401).json({error:'unauthorized'});
    req.auth=q.rows[0];next();
  }catch(e){console.error('workspace_auth',e.message);res.status(503).json({error:'workspace_unavailable'});}
}
const tenantFor=async req=>req.auth?.tenant_id||null;
const audit=async({tenantId,actorType='user',actorId=null,action,resourceType=null,resourceId=null,metadata={}})=>{try{await pool.query(`INSERT INTO audit_log(tenant_id,actor_type,actor_id,action,resource_type,resource_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[tenantId,actorType,String(actorId||''),action,resourceType,resourceId,JSON.stringify(metadata)]);}catch{}};

const originalUse=express.application.use;
express.application.use=function(...args){
  const containsStatic=args.some(x=>typeof x==='function'&&x.name==='serveStatic');
  if(containsStatic&&!installed&&pool){
    installed=true;
    originalUse.call(this,'/api/workspace',auth,workspaceRoutes({pool,tenantFor,audit,clean}));
    console.log('HI OS workspace routes mounted before static');
  }
  return originalUse.apply(this,args);
};
