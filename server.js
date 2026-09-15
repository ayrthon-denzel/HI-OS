const express=require('express');
const helmet=require('helmet');
const rateLimit=require('express-rate-limit');
const cookieParser=require('cookie-parser');
const bcrypt=require('bcryptjs');
const {authenticator}=require('otplib');
const {Pool}=require('pg');
const crypto=require('crypto');
const path=require('path');
const fs=require('fs');
const multer=require('multer');
const pdfParse=require('pdf-parse');
const mammoth=require('mammoth');
const AI=require('./server/ai');
const {startJobWorker}=require('./server/job-worker');
const {MODULES,normalizeModules,modulesForTenant}=require('./server/module-policy');

const app=express();
const PORT=process.env.PORT||3000;
const DATABASE_URL=process.env.DATABASE_URL||'';
const STRICT=process.env.HI_OS_SECURITY_MODE==='strict';
const ADMIN_KEY=process.env.HI_OS_ADMIN_KEY||'';
const SESSION_SECRET=process.env.HI_OS_SESSION_SECRET||'';
const TOKEN_KEY=process.env.HI_OS_TOKEN_ENCRYPTION_KEY||'';
const BOOTSTRAP_EMAIL=(process.env.HI_OS_BOOTSTRAP_EMAIL||'').trim().toLowerCase();
const BOOTSTRAP_PASSWORD=process.env.HI_OS_BOOTSTRAP_PASSWORD||'';
const COOKIE='hi_os_session';
const VERSION='0.5.0';
const startedAt=new Date().toISOString();

app.set('trust proxy',1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy:{directives:{
    defaultSrc:["'self'"],
    scriptSrc:["'self'"],
    styleSrc:["'self'","'unsafe-inline'"],
    imgSrc:["'self'",'data:'],
    connectSrc:["'self'",'https://accounts.google.com','https://oauth2.googleapis.com'],
    objectSrc:["'none'"],
    frameAncestors:["'none'"],
    baseUri:["'self'"],
    formAction:["'self'",'https://accounts.google.com']
  }},
  crossOriginEmbedderPolicy:false,
  hsts:{maxAge:31536000,includeSubDomains:true,preload:true}
}));
app.use(express.json({limit:'256kb',type:'application/json'}));
app.use(cookieParser());
app.use(rateLimit({windowMs:60_000,limit:120,standardHeaders:true,legacyHeaders:false}));
const authLimiter=rateLimit({windowMs:15*60_000,limit:12,standardHeaders:true,legacyHeaders:false});
const upload=multer({
  storage:multer.memoryStorage(),
  limits:{fileSize:6*1024*1024,files:1},
  fileFilter:(_r,f,cb)=>{
    const ok=f.mimetype==='application/pdf'||f.mimetype==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'||/\.(pdf|docx)$/i.test(f.originalname||'');
    cb(ok?null:new Error('unsupported_file_type'),ok);
  }
});

const pool=DATABASE_URL?new Pool({connectionString:DATABASE_URL,ssl:{rejectUnauthorized:false},max:5,idleTimeoutMillis:30_000,connectionTimeoutMillis:8_000}):null;
const sha256=v=>crypto.createHash('sha256').update(v).digest('hex');
const clean=(v,n=255)=>String(v??'').trim().slice(0,n);
const emailOk=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').toLowerCase());
const safeArray=(v,n=20)=>Array.isArray(v)?v.map(x=>clean(x,160)).filter(Boolean).slice(0,n):[];
const hashIp=ip=>sha256(`${ip||''}:${SESSION_SECRET||'hi-os'}`).slice(0,24);
const uaHash=ua=>sha256(String(ua||'')).slice(0,24);
const randomToken=(n=32)=>crypto.randomBytes(n).toString('base64url');

function secretKey(){
  if(!TOKEN_KEY)throw new Error('token_encryption_not_configured');
  return crypto.createHash('sha256').update(TOKEN_KEY).digest();
}
function encryptSecret(obj){
  const key=secretKey(),iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(obj),'utf8'),cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${data.toString('base64url')}`;
}
function decryptSecret(blob){
  if(!blob)return null;
  const [v,ivb,tagb,datab]=String(blob).split('.');
  if(v!=='v1'||!ivb||!tagb||!datab)throw new Error('invalid_encrypted_secret');
  const d=crypto.createDecipheriv('aes-256-gcm',secretKey(),Buffer.from(ivb,'base64url'));
  d.setAuthTag(Buffer.from(tagb,'base64url'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(datab,'base64url')),d.final()]).toString('utf8'));
}

async function audit({tenantId=null,actorType='system',actorId=null,action,resourceType=null,resourceId=null,ip='',metadata={}}){
  if(!pool)return;
  try{
    await pool.query(`INSERT INTO audit_log(tenant_id,actor_type,actor_id,action,resource_type,resource_id,ip_hash,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,[tenantId,actorType,actorId,action,resourceType,resourceId,hashIp(ip),JSON.stringify(metadata)]);
  }catch(e){console.error('audit_error',e.message);}
}
async function ensureSchema(){
  if(!pool)return{ok:false,reason:'DATABASE_URL missing'};
  await pool.query(fs.readFileSync(path.join(__dirname,'db','schema.sql'),'utf8'));
  const t=await pool.query(`INSERT INTO tenants(name,slug,space_type,enabled_modules) VALUES('HI MARKETING','hi-marketing','hi_marketing',$1) ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name,space_type='hi_marketing',enabled_modules=EXCLUDED.enabled_modules RETURNING id`,[MODULES]);
  const tenantId=t.rows[0].id;
  if(BOOTSTRAP_EMAIL&&BOOTSTRAP_PASSWORD.length>=14){
    const q=await pool.query(`SELECT id FROM users WHERE tenant_id=$1 AND role='ceo' LIMIT 1`,[tenantId]);
    if(!q.rowCount){
      await pool.query(`INSERT INTO users(tenant_id,email,full_name,role,status,password_hash,must_change_password) VALUES($1,$2,'A-D PANIKA','ceo','active',$3,true)`,[tenantId,BOOTSTRAP_EMAIL,await bcrypt.hash(BOOTSTRAP_PASSWORD,12)]);
      console.log('HI OS CEO bootstrap account created');
    }
  }
  return{ok:true,tenantId};
}
async function tenantFor(req){
  if(req.auth?.tenant_id)return req.auth.tenant_id;
  const q=await pool.query(`SELECT id FROM tenants WHERE slug='hi-marketing' LIMIT 1`);
  return q.rows[0]?.id||null;
}
async function session(req){
  if(!pool)return null;
  const raw=req.cookies?.[COOKIE];
  if(!raw)return null;
  try{
    const q=await pool.query(`SELECT s.id,s.tenant_id,s.user_id,u.email,u.full_name,u.role,u.status,u.mfa_enabled,u.must_change_password,t.name tenant_name,t.slug tenant_slug,t.space_type,t.enabled_modules FROM auth_sessions s JOIN users u ON u.id=s.user_id JOIN tenants t ON t.id=s.tenant_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() LIMIT 1`,[sha256(raw)]);
    return q.rowCount&&q.rows[0].status==='active'?q.rows[0]:null;
  }catch{return null;}
}
async function requireAuth(req,res,next){const s=await session(req);if(!s)return res.status(401).json({error:'unauthorized'});req.auth=s;next();}
function roles(...allowed){return(req,res,next)=>allowed.includes(req.auth?.role)?next():res.status(403).json({error:'forbidden'});}
function userPayload(u){return{email:u.email,fullName:u.full_name,role:u.role,mfaEnabled:u.mfa_enabled,mustChangePassword:u.must_change_password,company:{id:u.tenant_id,name:u.tenant_name,slug:u.tenant_slug},space:u.space_type==='hi_marketing'?'hi_marketing':'client',enabledModules:modulesForTenant(u)};}
async function requireAdmin(req,res,next){
  const s=await session(req);
  if(s&&['ceo','admin_ops'].includes(s.role)){req.auth=s;return next();}
  if(ADMIN_KEY){
    const h=req.get('authorization')||'',k=h.startsWith('Bearer ')?h.slice(7):req.get('x-hi-os-key');
    if(k&&k.length===ADMIN_KEY.length&&crypto.timingSafeEqual(Buffer.from(k),Buffer.from(ADMIN_KEY))){req.auth={role:'ceo',tenant_id:null,user_id:null,email:'emergency-key'};return next();}
  }
  res.status(401).json({error:'unauthorized'});
}

async function googleProfile(accessToken){
  if(!accessToken)return null;
  try{
    const r=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile',{headers:{authorization:`Bearer ${accessToken}`}});
    if(!r.ok)return null;
    const p=await r.json();
    return p?.emailAddress||null;
  }catch{return null;}
}

app.get('/health',async(_req,res)=>{
  let db='disconnected';
  if(pool){try{await pool.query('SELECT 1');db='connected';}catch{db='error';}}
  res.json({status:'ok',app:'HI OS',version:VERSION,startedAt,db,security:STRICT?'strict':'standard'});
});
app.get('/api/bootstrap-status',async(_req,res)=>{
  let db=false,users=0;
  if(pool){try{await pool.query('SELECT 1');db=true;const q=await pool.query(`SELECT count(*)::int n FROM users`);users=q.rows[0].n;}catch{}}
  res.json({database:db,adminConfigured:users>0,tenantIsolation:process.env.HI_OS_TENANT_ISOLATION==='required',gmailConfigured:Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET&&TOKEN_KEY),aiConfigured:Boolean(process.env.OPENAI_API_KEY),cvEncryptionConfigured:Boolean(TOKEN_KEY),version:VERSION});
});

app.post('/api/auth/login',authLimiter,async(req,res)=>{
  if(!pool)return res.status(503).json({error:'database_unavailable'});
  const email=clean(req.body?.email,255).toLowerCase(),password=String(req.body?.password||''),otp=clean(req.body?.otp,12);
  if(!emailOk(email)||password.length<8)return res.status(400).json({error:'invalid_credentials'});
  try{
    const q=await pool.query(`SELECT u.*,t.name tenant_name,t.slug tenant_slug,t.space_type,t.enabled_modules FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE lower(u.email)=$1 AND u.status='active'`,[email]);
    let u=null;
    for(const candidate of q.rows){if(candidate.password_hash&&await bcrypt.compare(password,candidate.password_hash)){u=candidate;break;}}
    if(!u){
      await audit({actorType:'auth',actorId:email,action:'login.failed',ip:req.ip});
      return res.status(401).json({error:'invalid_credentials'});
    }
    if(u.mfa_enabled&&(!otp||!authenticator.check(otp,u.mfa_secret||'')))return res.status(401).json({error:'mfa_required'});
    const raw=randomToken(36),expires=new Date(Date.now()+12*3600_000);
    await pool.query(`INSERT INTO auth_sessions(user_id,tenant_id,token_hash,ip_hash,user_agent_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6)`,[u.id,u.tenant_id,sha256(raw),hashIp(req.ip),uaHash(req.get('user-agent')),expires]);
    await pool.query(`UPDATE users SET last_login_at=now() WHERE id=$1`,[u.id]);
    res.cookie(COOKIE,raw,{httpOnly:true,secure:true,sameSite:'strict',path:'/',expires});
    await audit({tenantId:u.tenant_id,actorType:'user',actorId:u.id,action:'login.success',ip:req.ip});
    res.json({ok:true,user:userPayload(u)});
  }catch(e){console.error('login',e);res.status(500).json({error:'login_failed'});}
});
app.get('/api/auth/me',requireAuth,(req,res)=>res.json({authenticated:true,user:userPayload(req.auth)}));

function requireHiMarketing(req,res,next){
  if(req.auth?.space_type==='hi_marketing'&&['ceo','admin_ops'].includes(req.auth.role))return next();
  return res.status(403).json({error:'hi_marketing_space_required'});
}
app.get('/api/admin/companies',requireAuth,requireHiMarketing,async(_req,res)=>{
  const q=await pool.query(`SELECT id,name,slug,space_type,enabled_modules,created_at FROM tenants ORDER BY space_type DESC,name ASC`);
  res.json({items:q.rows.map(x=>({...x,enabled_modules:modulesForTenant(x)})),availableModules:MODULES});
});
app.post('/api/admin/companies',requireAuth,requireHiMarketing,async(req,res)=>{
  const name=clean(req.body?.name,160),slug=clean(req.body?.slug,120).toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'');
  if(!name||!slug)return res.status(400).json({error:'name_and_slug_required'});
  try{
    const enabled=normalizeModules(req.body?.enabledModules);
    const q=await pool.query(`INSERT INTO tenants(name,slug,space_type,enabled_modules) VALUES($1,$2,'client',$3) RETURNING id,name,slug,space_type,enabled_modules,created_at`,[name,slug,enabled]);
    await audit({tenantId:req.auth.tenant_id,actorType:'user',actorId:req.auth.user_id,action:'company.created',resourceType:'tenant',resourceId:q.rows[0].id,ip:req.ip});
    res.status(201).json({item:q.rows[0]});
  }catch(e){res.status(e.code==='23505'?409:500).json({error:e.code==='23505'?'slug_exists':'company_create_failed'});}
});
app.patch('/api/admin/companies/:id/modules',requireAuth,requireHiMarketing,async(req,res)=>{
  const enabled=normalizeModules(req.body?.enabledModules,[]);
  const q=await pool.query(`UPDATE tenants SET enabled_modules=$1 WHERE id=$2 AND space_type='client' RETURNING id,name,slug,space_type,enabled_modules`,[enabled,req.params.id]);
  if(!q.rowCount)return res.status(404).json({error:'company_not_found'});
  await audit({tenantId:req.auth.tenant_id,actorType:'user',actorId:req.auth.user_id,action:'company.modules.updated',resourceType:'tenant',resourceId:req.params.id,ip:req.ip,metadata:{enabledModules:enabled}});
  res.json({item:q.rows[0]});
});
app.get('/api/admin/companies/:id/users',requireAuth,requireHiMarketing,async(req,res)=>{
  const company=await pool.query(`SELECT id FROM tenants WHERE id=$1 AND space_type='client'`,[req.params.id]);
  if(!company.rowCount)return res.status(404).json({error:'company_not_found'});
  const q=await pool.query(`SELECT id,email,full_name,role,status,must_change_password,last_login_at,created_at FROM users WHERE tenant_id=$1 ORDER BY created_at DESC`,[req.params.id]);
  res.json({items:q.rows});
});
app.post('/api/admin/companies/:id/users',requireAuth,requireHiMarketing,async(req,res)=>{
  const email=clean(req.body?.email,255).toLowerCase(),fullName=clean(req.body?.fullName,160);
  if(!emailOk(email)||!fullName)return res.status(400).json({error:'name_and_email_required'});
  const company=await pool.query(`SELECT id FROM tenants WHERE id=$1 AND space_type='client'`,[req.params.id]);
  if(!company.rowCount)return res.status(404).json({error:'company_not_found'});
  const temporaryPassword=`Hi!${randomToken(12)}`;
  try{
    const q=await pool.query(`INSERT INTO users(tenant_id,email,full_name,role,status,password_hash,must_change_password) VALUES($1,$2,$3,'client_viewer','active',$4,true) RETURNING id,email,full_name,role,status,must_change_password,created_at`,[req.params.id,email,fullName,await bcrypt.hash(temporaryPassword,12)]);
    await audit({tenantId:req.auth.tenant_id,actorType:'user',actorId:req.auth.user_id,action:'company.user.created',resourceType:'user',resourceId:q.rows[0].id,ip:req.ip,metadata:{companyId:req.params.id}});
    res.status(201).json({item:q.rows[0],temporaryPassword});
  }catch(e){res.status(e.code==='23505'?409:500).json({error:e.code==='23505'?'user_exists':'company_user_create_failed'});}
});
app.patch('/api/admin/companies/:companyId/users/:userId/status',requireAuth,requireHiMarketing,async(req,res)=>{
  const status=req.body?.status;
  if(!['active','suspended'].includes(status))return res.status(400).json({error:'invalid_status'});
  const q=await pool.query(`UPDATE users SET status=$1 WHERE id=$2 AND tenant_id=$3 AND role='client_viewer' RETURNING id,email,full_name,role,status`,[status,req.params.userId,req.params.companyId]);
  if(!q.rowCount)return res.status(404).json({error:'user_not_found'});
  if(status==='suspended')await pool.query(`UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL`,[req.params.userId]);
  await audit({tenantId:req.auth.tenant_id,actorType:'user',actorId:req.auth.user_id,action:`company.user.${status}`,resourceType:'user',resourceId:req.params.userId,ip:req.ip,metadata:{companyId:req.params.companyId}});
  res.json({item:q.rows[0]});
});
app.post('/api/auth/logout',requireAuth,async(req,res)=>{const raw=req.cookies?.[COOKIE];if(raw)await pool.query(`UPDATE auth_sessions SET revoked_at=now() WHERE token_hash=$1`,[sha256(raw)]);res.clearCookie(COOKIE,{path:'/'});res.json({ok:true});});
app.post('/api/auth/change-password',requireAuth,authLimiter,async(req,res)=>{
  const current=String(req.body?.currentPassword||''),next=String(req.body?.newPassword||'');
  if(next.length<14)return res.status(400).json({error:'password_too_short'});
  const q=await pool.query(`SELECT password_hash FROM users WHERE id=$1`,[req.auth.user_id]);
  if(!q.rowCount||!await bcrypt.compare(current,q.rows[0].password_hash||''))return res.status(401).json({error:'invalid_current_password'});
  await pool.query(`UPDATE users SET password_hash=$1,must_change_password=false WHERE id=$2`,[await bcrypt.hash(next,12),req.auth.user_id]);
  await pool.query(`UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2`,[req.auth.user_id,req.auth.id]);
  await audit({tenantId:req.auth.tenant_id,actorType:'user',actorId:req.auth.user_id,action:'password.changed',ip:req.ip});
  res.json({ok:true});
});
app.post('/api/auth/mfa/setup',requireAuth,roles('ceo','admin_ops'),async(req,res)=>{const s=authenticator.generateSecret();await pool.query(`UPDATE users SET mfa_secret=$1,mfa_enabled=false WHERE id=$2`,[s,req.auth.user_id]);res.json({secret:s,otpauth:authenticator.keyuri(req.auth.email,'HI OS',s)});});
app.post('/api/auth/mfa/confirm',requireAuth,roles('ceo','admin_ops'),async(req,res)=>{const otp=clean(req.body?.otp,12),q=await pool.query(`SELECT mfa_secret FROM users WHERE id=$1`,[req.auth.user_id]);if(!q.rowCount||!authenticator.check(otp,q.rows[0].mfa_secret||''))return res.status(400).json({error:'invalid_otp'});await pool.query(`UPDATE users SET mfa_enabled=true WHERE id=$1`,[req.auth.user_id]);await audit({tenantId:req.auth.tenant_id,actorType:'user',actorId:req.auth.user_id,action:'mfa.enabled',ip:req.ip});res.json({ok:true});});

app.get('/api/admin/dashboard',requireAdmin,async(req,res)=>{
  try{
    const t=await tenantFor(req);
    if(!t)return res.json({clients:0,missions:0,interviews:0,applications:0,agentRuns:0});
    const [a,b,c,d,e]=await Promise.all([
      pool.query(`SELECT count(*)::int n FROM clients WHERE tenant_id=$1 AND status='active'`,[t]),
      pool.query(`SELECT count(*)::int n FROM missions WHERE tenant_id=$1 AND status IN('active','interview')`,[t]),
      pool.query(`SELECT count(*)::int n FROM missions WHERE tenant_id=$1 AND status='interview'`,[t]),
      pool.query(`SELECT count(*)::int n FROM applications WHERE tenant_id=$1 AND status IN('prepared','submitted','acknowledged','test','interview','offer')`,[t]),
      pool.query(`SELECT count(*)::int n FROM agent_runs WHERE tenant_id=$1 AND created_at>now()-interval '24 hours'`,[t])
    ]);
    res.json({clients:a.rows[0].n,missions:b.rows[0].n,interviews:c.rows[0].n,applications:d.rows[0].n,agentRuns:e.rows[0].n});
  }catch(e){console.error('dashboard',e);res.status(500).json({error:'dashboard_failed'});}
});

app.post('/api/admin/job-missions',requireAdmin,async(req,res)=>{
  const {clientName,clientEmail,targetRoles=[],locations=[],contractTypes=[],constraints={}}=req.body||{};
  if(!clean(clientName,160)||!emailOk(clientEmail))return res.status(400).json({error:'invalid_payload'});
  const db=await pool.connect();
  try{
    await db.query('BEGIN');
    const t=await tenantFor(req);
    const c=await db.query(`INSERT INTO clients(tenant_id,name,email,service_type,metadata) VALUES($1,$2,$3,'job_search',$4::jsonb) RETURNING id`,[t,clean(clientName,160),clean(clientEmail,255).toLowerCase(),JSON.stringify({source:'HI OS'})]);
    const m=await db.query(`INSERT INTO missions(tenant_id,client_id,service_type,title,status,autonomy_level,supervisor_agent,config) VALUES($1,$2,'job_search',$3,'onboarding','A2','Mission Supervisor',$4::jsonb) RETURNING id`,[t,c.rows[0].id,`Recherche d'emploi — ${clean(clientName,100)}`,JSON.stringify({escalation:'interview_or_human_choice',silentUntil:'interview'})]);
    await db.query(`INSERT INTO job_profiles(tenant_id,mission_id,target_roles,locations,contract_types,constraints) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[t,m.rows[0].id,safeArray(targetRoles),safeArray(locations),safeArray(contractTypes),JSON.stringify(constraints||{})]);
    await db.query(`INSERT INTO agent_runs(tenant_id,mission_id,agent_name,action,permission_level,status,input) VALUES($1,$2,'Mission Supervisor','initialize_job_cell','A2','queued',$3::jsonb)`,[t,m.rows[0].id,JSON.stringify({agents:['Job Scout','CV Tailor','Application Agent','Inbox Watcher','Interview Agent']})]);
    await db.query('COMMIT');
    await audit({tenantId:t,actorType:'user',actorId:req.auth.user_id||'key',action:'job_mission.created',resourceType:'mission',resourceId:m.rows[0].id,ip:req.ip});
    res.status(201).json({ok:true,missionId:m.rows[0].id,clientId:c.rows[0].id,status:'onboarding'});
  }catch(e){await db.query('ROLLBACK');console.error('mission_create',e);res.status(500).json({error:'mission_create_failed'});}
  finally{db.release();}
});
app.get('/api/admin/job-missions',requireAdmin,async(req,res)=>{
  try{
    const t=await tenantFor(req);
    const q=await pool.query(`SELECT m.id,m.title,m.status,m.created_at,c.name client_name,c.email client_email,coalesce((SELECT count(*) FROM applications a WHERE a.mission_id=m.id),0)::int applications,coalesce((SELECT count(*) FROM opportunities o WHERE o.mission_id=m.id AND o.status IN('qualified','applied','interview')),0)::int opportunities FROM missions m JOIN clients c ON c.id=m.client_id WHERE m.tenant_id=$1 AND m.service_type='job_search' ORDER BY m.created_at DESC LIMIT 100`,[t]);
    res.json({items:q.rows});
  }catch(e){console.error('mission_list',e);res.status(500).json({error:'mission_list_failed'});}
});
app.get('/api/admin/job-missions/:id',requireAdmin,async(req,res)=>{
  try{
    const t=await tenantFor(req);
    const q=await pool.query(`SELECT m.*,c.name client_name,c.email client_email,j.target_roles,j.locations,j.contract_types,j.constraints FROM missions m JOIN clients c ON c.id=m.client_id LEFT JOIN job_profiles j ON j.mission_id=m.id WHERE m.id=$1 AND m.tenant_id=$2 LIMIT 1`,[req.params.id,t]);
    if(!q.rowCount)return res.status(404).json({error:'not_found'});
    const [ops,apps,runs,events,docs,integration,lastInbox,pendingApprovals]=await Promise.all([
      pool.query(`SELECT id,company,role_title,location,url,score,status,created_at FROM opportunities WHERE mission_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 100`,[req.params.id,t]),
      pool.query(`SELECT id,opportunity_id,channel,status,submitted_at,created_at,evidence FROM applications WHERE mission_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 100`,[req.params.id,t]),
      pool.query(`SELECT id,agent_name,action,permission_level,status,output,created_at,finished_at FROM agent_runs WHERE mission_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 100`,[req.params.id,t]),
      pool.query(`SELECT id,event_type,severity,payload,created_at FROM client_events WHERE mission_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 100`,[req.params.id,t]),
      pool.query(`SELECT id,document_type,metadata,created_at FROM mission_documents WHERE mission_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`,[req.params.id,t]),
      pool.query(`SELECT id,external_account,scopes,status,created_at,updated_at FROM integrations WHERE mission_id=$1 AND tenant_id=$2 AND provider='google_gmail' ORDER BY created_at DESC LIMIT 1`,[req.params.id,t]),
      pool.query(`SELECT id,status,output,created_at,finished_at FROM agent_runs WHERE mission_id=$1 AND tenant_id=$2 AND action='inbox_watch_cycle' ORDER BY created_at DESC LIMIT 1`,[req.params.id,t]),
      pool.query(`SELECT count(*)::int n FROM approvals WHERE mission_id=$1 AND tenant_id=$2 AND status='pending'`,[req.params.id,t])
    ]);
    const i=integration.rows[0]||null,l=lastInbox.rows[0]||null;
    const gmail=i?{
      connected:i.status==='active',
      account:i.external_account||q.rows[0].client_email||null,
      scopes:i.scopes||[],
      status:i.status,
      connectedAt:i.created_at,
      updatedAt:i.updated_at,
      inboxWatcher:l?{state:l.status,lastCheckedAt:l.finished_at||l.created_at,output:l.output||{}}:{state:'idle',lastCheckedAt:null,output:{}}
    }:{connected:false,account:null,scopes:[],status:'not_connected',connectedAt:null,updatedAt:null,inboxWatcher:{state:'idle',lastCheckedAt:null,output:{}}};
    res.json({mission:q.rows[0],opportunities:ops.rows,applications:apps.rows,agentRuns:runs.rows,events:events.rows,documents:docs.rows,gmail,pendingApprovals:pendingApprovals.rows[0].n,aiConfigured:Boolean(process.env.OPENAI_API_KEY)});
  }catch(e){console.error('mission_detail',e);res.status(500).json({error:'mission_detail_failed'});}
});
app.post('/api/admin/job-missions/:id/activate',requireAdmin,async(req,res)=>{
  const t=await tenantFor(req);
  const [cv,gmail]=await Promise.all([
    pool.query(`SELECT 1 FROM mission_documents WHERE mission_id=$1 AND tenant_id=$2 AND document_type='cv_master' LIMIT 1`,[req.params.id,t]),
    pool.query(`SELECT 1 FROM integrations WHERE mission_id=$1 AND tenant_id=$2 AND provider='google_gmail' AND status='active' LIMIT 1`,[req.params.id,t])
  ]);
  if(!cv.rowCount)return res.status(409).json({error:'cv_required'});
  if(!gmail.rowCount)return res.status(409).json({error:'gmail_required'});
  const q=await pool.query(`UPDATE missions SET status='active',updated_at=now() WHERE id=$1 AND tenant_id=$2 AND status='onboarding' RETURNING id`,[req.params.id,t]);
  if(!q.rowCount)return res.status(409).json({error:'mission_not_onboarding'});
  if(process.env.OPENAI_API_KEY){
    await pool.query(`INSERT INTO agent_runs(tenant_id,mission_id,agent_name,action,permission_level,status,input) VALUES($1,$2,'Mission Supervisor','job_search_cycle','A2','queued','{}')`,[t,req.params.id]);
  }
  await pool.query(`INSERT INTO agent_runs(tenant_id,mission_id,agent_name,action,permission_level,status,input) VALUES($1,$2,'Inbox Watcher','inbox_watch_cycle','A2','queued','{}')`,[t,req.params.id]);
  await audit({tenantId:t,actorType:'user',actorId:req.auth.user_id||'key',action:'job_mission.activated',resourceType:'mission',resourceId:req.params.id,ip:req.ip,metadata:{aiConfigured:Boolean(process.env.OPENAI_API_KEY)}});
  res.json({ok:true,status:'active',aiConfigured:Boolean(process.env.OPENAI_API_KEY)});
});
app.post('/api/admin/job-missions/:id/inbox-test',requireAdmin,async(req,res)=>{
  const t=await tenantFor(req);
  const m=await pool.query(`SELECT id,status FROM missions WHERE id=$1 AND tenant_id=$2 LIMIT 1`,[req.params.id,t]);
  if(!m.rowCount)return res.status(404).json({error:'not_found'});
  const gmail=await pool.query(`SELECT 1 FROM integrations WHERE mission_id=$1 AND tenant_id=$2 AND provider='google_gmail' AND status='active' LIMIT 1`,[req.params.id,t]);
  if(!gmail.rowCount)return res.status(409).json({error:'gmail_required'});
  const run=await pool.query(`INSERT INTO agent_runs(tenant_id,mission_id,agent_name,action,permission_level,status,input) VALUES($1,$2,'Inbox Watcher','inbox_watch_cycle','A2','queued',$3::jsonb) RETURNING id,created_at`,[t,req.params.id,JSON.stringify({source:'manual_health_test'})]);
  await audit({tenantId:t,actorType:'user',actorId:req.auth.user_id||'key',action:'inbox_test.queued',resourceType:'mission',resourceId:req.params.id,ip:req.ip});
  res.status(202).json({ok:true,runId:run.rows[0].id,status:'queued'});
});
app.post('/api/admin/job-missions/:id/cv',requireAdmin,(req,res)=>upload.single('cv')(req,res,async err=>{
  if(err)return res.status(400).json({error:err.message||'upload_failed'});
  if(!req.file)return res.status(400).json({error:'cv_required'});
  if(!TOKEN_KEY)return res.status(503).json({error:'token_encryption_not_configured'});
  try{
    const t=await tenantFor(req),m=await pool.query(`SELECT id FROM missions WHERE id=$1 AND tenant_id=$2 LIMIT 1`,[req.params.id,t]);
    if(!m.rowCount)return res.status(404).json({error:'not_found'});
    let text='';
    if(req.file.mimetype==='application/pdf'||/\.pdf$/i.test(req.file.originalname))text=(await pdfParse(req.file.buffer)).text||'';
    else text=(await mammoth.extractRawText({buffer:req.file.buffer})).value||'';
    text=text.replace(/\u0000/g,'').trim().slice(0,120000);
    if(text.length<80)return res.status(422).json({error:'cv_text_unreadable'});
    await pool.query(`INSERT INTO mission_documents(tenant_id,mission_id,document_type,storage_provider,storage_ref,sha256,metadata) VALUES($1,$2,'cv_master','encrypted_db',$3,$4,$5::jsonb)`,[t,req.params.id,encryptSecret({text}),sha256(req.file.buffer),JSON.stringify({filename:clean(req.file.originalname,255),mime:req.file.mimetype,chars:text.length})]);
    await audit({tenantId:t,actorType:'user',actorId:req.auth.user_id||'key',action:'cv.uploaded',resourceType:'mission',resourceId:req.params.id,ip:req.ip,metadata:{chars:text.length}});
    res.json({ok:true,chars:text.length});
  }catch(e){console.error('cv_processing',e);res.status(500).json({error:'cv_processing_failed'});}
}));

app.get('/api/admin/approvals',requireAdmin,async(req,res)=>{const t=await tenantFor(req),q=await pool.query(`SELECT id,mission_id,action_type,payload,status,requested_at FROM approvals WHERE tenant_id=$1 AND status='pending' ORDER BY requested_at DESC LIMIT 100`,[t]);res.json({items:q.rows});});
app.post('/api/admin/approvals/:id/:decision',requireAdmin,async(req,res)=>{if(!['approve','reject'].includes(req.params.decision))return res.status(400).json({error:'invalid_decision'});const t=await tenantFor(req),status=req.params.decision==='approve'?'approved':'rejected',q=await pool.query(`UPDATE approvals SET status=$1,resolved_at=now(),resolved_by=$2 WHERE id=$3 AND tenant_id=$4 AND status='pending' RETURNING id`,[status,req.auth.user_id||null,req.params.id,t]);if(!q.rowCount)return res.status(404).json({error:'not_found'});res.json({ok:true,status});});

app.post('/api/orchestrate',requireAuth,async(req,res)=>{
  const command=clean(req.body?.command,4000);
  if(!command)return res.status(400).json({error:'command_required'});
  let output;
  try{output=process.env.OPENAI_API_KEY?await AI.orchestrate(command):null;}catch(e){console.error('orchestrator_ai',e.message);}
  if(!output){
    const l=command.toLowerCase(),route=['HI Orchestrator'];
    if(/emploi|cv|candidature|alternance|offre/.test(l))route.push('Mission Supervisor','Job Scout','CV Tailor','Application Agent','Inbox Watcher');
    if(/prospect|contrat|entreprise/.test(l))route.push('Contract Hunter','CRM Agent','Sales Agent');
    if(/design|visuel|post|contenu/.test(l))route.push('Master Designer','Social Media Manager');
    if(/mail|email|inbox/.test(l))route.push('Inbox Agent');
    if(/site|app|code|logiciel/.test(l))route.push('Web Agent','Software Agent','QA Agent');
    output={summary:'Commande routée selon la politique HI OS.',route:[...new Set(route)],actions:[],requires_human:false};
  }
  await pool.query(`INSERT INTO agent_runs(tenant_id,agent_name,action,permission_level,status,input,output,finished_at) VALUES($1,'HI Orchestrator','route_command','A1','success',$2::jsonb,$3::jsonb,now())`,[req.auth.tenant_id,JSON.stringify({command}),JSON.stringify(output)]);
  res.json({ok:true,...output,mode:process.env.OPENAI_API_KEY?'ai-orchestrated':'policy-routed'});
});

app.get('/api/admin/integrations/google/start',requireAdmin,async(req,res)=>{
  const missionId=clean(req.query.missionId,80);
  if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)return res.status(503).json({error:'google_oauth_not_configured'});
  if(!TOKEN_KEY)return res.status(503).json({error:'token_encryption_not_configured'});
  const t=await tenantFor(req),m=await pool.query(`SELECT id FROM missions WHERE id=$1 AND tenant_id=$2 LIMIT 1`,[missionId,t]);
  if(!m.rowCount)return res.status(404).json({error:'not_found'});
  const state=randomToken(24),redirect=`${req.protocol}://${req.get('host')}/api/oauth/google/callback`;
  res.cookie('hi_os_oauth_state',state,{httpOnly:true,secure:true,sameSite:'lax',maxAge:600000,path:'/api/oauth/google'});
  res.cookie('hi_os_oauth_mission',missionId,{httpOnly:true,secure:true,sameSite:'lax',maxAge:600000,path:'/api/oauth/google'});
  const p=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:redirect,response_type:'code',access_type:'offline',prompt:'consent',state,scope:['openid','email','https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.send'].join(' ')});
  res.json({url:`https://accounts.google.com/o/oauth2/v2/auth?${p}`});
});
app.get('/api/oauth/google/callback',async(req,res)=>{
  const missionId=req.cookies?.hi_os_oauth_mission;
  if(!req.query.code||!req.query.state||req.query.state!==req.cookies?.hi_os_oauth_state){
    console.warn('google_oauth_callback_invalid_state');
    return res.status(400).send('OAuth state invalide.');
  }
  try{
    const redirect=`${req.protocol}://${req.get('host')}/api/oauth/google/callback`;
    const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:String(req.query.code),client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',redirect_uri:redirect,grant_type:'authorization_code'})});
    const tokens=await r.json();
    if(!r.ok)throw new Error('oauth_exchange_failed');
    const m=await pool.query(`SELECT tenant_id FROM missions WHERE id=$1 LIMIT 1`,[missionId]);
    if(!m.rowCount)throw new Error('mission_missing');
    const account=await googleProfile(tokens.access_token);
    await pool.query(`UPDATE integrations SET status='revoked',updated_at=now() WHERE mission_id=$1 AND tenant_id=$2 AND provider='google_gmail' AND status='active'`,[missionId,m.rows[0].tenant_id]);
    await pool.query(`INSERT INTO integrations(tenant_id,mission_id,provider,external_account,scopes,token_ref,status) VALUES($1,$2,'google_gmail',$3,$4,$5,'active')`,[m.rows[0].tenant_id,missionId,account,['gmail.readonly','gmail.send'],encryptSecret(tokens)]);
    await audit({tenantId:m.rows[0].tenant_id,actorType:'integration',actorId:account||'google_gmail',action:'gmail.oauth_connected',resourceType:'mission',resourceId:missionId,ip:req.ip,metadata:{account,scopes:['gmail.readonly','gmail.send']}});
    console.log('google_oauth_connected',missionId,account||'account_unknown');
    res.clearCookie('hi_os_oauth_state',{path:'/api/oauth/google'});
    res.clearCookie('hi_os_oauth_mission',{path:'/api/oauth/google'});
    res.redirect(`/?oauth=connected&mission=${encodeURIComponent(missionId)}`);
  }catch(e){
    console.error('google_oauth_callback_failed',missionId||'unknown',e.message);
    if(missionId){
      try{
        const m=await pool.query(`SELECT tenant_id FROM missions WHERE id=$1 LIMIT 1`,[missionId]);
        if(m.rowCount)await audit({tenantId:m.rows[0].tenant_id,actorType:'integration',actorId:'google_gmail',action:'gmail.oauth_failed',resourceType:'mission',resourceId:missionId,ip:req.ip,metadata:{error:e.message}});
      }catch{}
    }
    res.status(500).send('Connexion Google impossible.');
  }
});

app.use(express.static(__dirname,{extensions:['html'],maxAge:'5m',index:'index.html'}));
app.use((_req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.listen(PORT,async()=>{
  console.log(`HI OS ${VERSION} listening on ${PORT}`);
  if(pool){
    try{
      await ensureSchema();
      console.log('HI OS database schema ready');
      startJobWorker({pool,decryptSecret,encryptSecret,audit});
      console.log('HI OS Job Search worker ready');
    }catch(e){console.error('DB bootstrap deferred:',e.message);}
  }
});
