const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const STRICT = process.env.HI_OS_SECURITY_MODE === 'strict';
const ADMIN_KEY = process.env.HI_OS_ADMIN_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5 }) : null;
const startedAt = new Date().toISOString();

function hashIp(ip='') {
  return crypto.createHash('sha256').update(`${ip}:${process.env.HI_OS_SESSION_SECRET || 'hi-os'}`).digest('hex').slice(0, 24);
}

function requireAdmin(req, res, next) {
  if (!ADMIN_KEY) return res.status(503).json({ error: 'admin_auth_not_configured' });
  const auth = req.get('authorization') || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7) : req.get('x-hi-os-key');
  if (!key || key.length !== ADMIN_KEY.length || !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(ADMIN_KEY))) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

async function audit({ tenantId=null, actorType='system', actorId=null, action, resourceType=null, resourceId=null, ip='', metadata={} }) {
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO audit_log (tenant_id,actor_type,actor_id,action,resource_type,resource_id,ip_hash,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [tenantId,actorType,actorId,action,resourceType,resourceId,hashIp(ip),JSON.stringify(metadata)]
    );
  } catch (e) {
    console.error('audit_error', e.message);
  }
}

async function ensureSchema() {
  if (!pool) return { ok: false, reason: 'DATABASE_URL missing' };
  const schemaPath = path.join(__dirname, 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  const tenant = await pool.query(
    `INSERT INTO tenants(name,slug) VALUES('HI MARKETING','hi-marketing')
     ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`
  );
  return { ok: true, tenantId: tenant.rows[0].id };
}

app.get('/health', async (_req,res) => {
  let db = 'disconnected';
  if (pool) {
    try { await pool.query('SELECT 1'); db = 'connected'; } catch { db = 'error'; }
  }
  res.json({ status:'ok', app:'HI OS', version:'0.2.0', startedAt, db, security: STRICT ? 'strict' : 'standard' });
});

app.get('/api/bootstrap-status', async (_req,res) => {
  let db = false;
  if (pool) { try { await pool.query('SELECT 1'); db = true; } catch {} }
  res.json({ database: db, adminAuth: Boolean(ADMIN_KEY), tenantIsolation: process.env.HI_OS_TENANT_ISOLATION === 'required' });
});

app.post('/api/admin/bootstrap', requireAdmin, async (req,res) => {
  try {
    const result = await ensureSchema();
    if (!result.ok) return res.status(503).json(result);
    await audit({ tenantId: result.tenantId, actorType:'admin', actorId:'bootstrap', action:'system.bootstrap', ip:req.ip });
    res.json({ ok:true, tenantId: result.tenantId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:'bootstrap_failed' });
  }
});

app.get('/api/admin/dashboard', requireAdmin, async (req,res) => {
  if (!pool) return res.status(503).json({ error:'database_unavailable' });
  try {
    const tenant = await pool.query(`SELECT id FROM tenants WHERE slug='hi-marketing' LIMIT 1`);
    if (!tenant.rowCount) return res.json({ clients:0, missions:0, interviews:0, applications:0, agentRuns:0 });
    const id = tenant.rows[0].id;
    const [clients, missions, interviews, applications, runs] = await Promise.all([
      pool.query('SELECT count(*)::int n FROM clients WHERE tenant_id=$1',[id]),
      pool.query("SELECT count(*)::int n FROM missions WHERE tenant_id=$1 AND status IN ('onboarding','active','interview')",[id]),
      pool.query("SELECT count(*)::int n FROM missions WHERE tenant_id=$1 AND status='interview'",[id]),
      pool.query("SELECT count(*)::int n FROM applications WHERE tenant_id=$1 AND status='submitted'",[id]),
      pool.query("SELECT count(*)::int n FROM agent_runs WHERE tenant_id=$1 AND created_at > now()-interval '24 hours'",[id])
    ]);
    res.json({ clients:clients.rows[0].n, missions:missions.rows[0].n, interviews:interviews.rows[0].n, applications:applications.rows[0].n, agentRuns:runs.rows[0].n });
  } catch (e) { res.status(500).json({ error:'dashboard_failed' }); }
});

app.post('/api/admin/job-missions', requireAdmin, async (req,res) => {
  if (!pool) return res.status(503).json({ error:'database_unavailable' });
  const { clientName, clientEmail, targetRoles=[], locations=[], contractTypes=[], constraints={} } = req.body || {};
  if (!clientName || !clientEmail || !Array.isArray(targetRoles) || !Array.isArray(locations)) return res.status(400).json({ error:'invalid_payload' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tenant = await client.query(`SELECT id FROM tenants WHERE slug='hi-marketing' LIMIT 1`);
    if (!tenant.rowCount) throw new Error('tenant_missing');
    const tenantId = tenant.rows[0].id;
    const c = await client.query(
      `INSERT INTO clients(tenant_id,name,email,service_type,metadata) VALUES($1,$2,$3,'job_search',$4::jsonb) RETURNING id`,
      [tenantId,String(clientName).slice(0,160),String(clientEmail).toLowerCase().slice(0,255),JSON.stringify({ source:'HI OS' })]
    );
    const m = await client.query(
      `INSERT INTO missions(tenant_id,client_id,service_type,title,status,autonomy_level,supervisor_agent,config)
       VALUES($1,$2,'job_search',$3,'onboarding','A2','Mission Supervisor',$4::jsonb) RETURNING id`,
      [tenantId,c.rows[0].id,`Recherche d'emploi — ${String(clientName).slice(0,100)}`,JSON.stringify({ escalation:'interview_or_human_choice' })]
    );
    await client.query(
      `INSERT INTO job_profiles(tenant_id,mission_id,target_roles,locations,contract_types,constraints)
       VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
      [tenantId,m.rows[0].id,targetRoles.slice(0,20),locations.slice(0,20),contractTypes.slice(0,20),JSON.stringify(constraints)]
    );
    await client.query(
      `INSERT INTO agent_runs(tenant_id,mission_id,agent_name,action,permission_level,status,input)
       VALUES($1,$2,'Mission Supervisor','initialize_job_cell','A2','queued',$3::jsonb)`,
      [tenantId,m.rows[0].id,JSON.stringify({ agents:['Job Scout','CV Tailor','Application Agent','Inbox Watcher','Interview Agent'] })]
    );
    await client.query('COMMIT');
    await audit({ tenantId, actorType:'admin', actorId:'ceo', action:'job_mission.created', resourceType:'mission', resourceId:m.rows[0].id, ip:req.ip });
    res.status(201).json({ ok:true, missionId:m.rows[0].id, clientId:c.rows[0].id, status:'onboarding' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error:'mission_create_failed' });
  } finally { client.release(); }
});

app.get('/api/admin/job-missions', requireAdmin, async (_req,res) => {
  if (!pool) return res.status(503).json({ error:'database_unavailable' });
  try {
    const q = await pool.query(`
      SELECT m.id,m.title,m.status,m.created_at,c.name client_name,c.email client_email,
             coalesce((SELECT count(*) FROM applications a WHERE a.mission_id=m.id),0)::int applications,
             coalesce((SELECT count(*) FROM opportunities o WHERE o.mission_id=m.id AND o.status IN ('qualified','applied','interview')),0)::int opportunities
      FROM missions m JOIN clients c ON c.id=m.client_id
      WHERE m.service_type='job_search' ORDER BY m.created_at DESC LIMIT 100`);
    res.json({ items:q.rows });
  } catch { res.status(500).json({ error:'mission_list_failed' }); }
});

app.post('/api/admin/orchestrate', requireAdmin, async (req,res) => {
  const command = String(req.body?.command || '').trim().slice(0,4000);
  if (!command) return res.status(400).json({ error:'command_required' });
  const lower = command.toLowerCase();
  const route = ['HI Orchestrator'];
  if (/emploi|cv|candidature|alternance|offre/.test(lower)) route.push('Mission Supervisor','Job Scout','CV Tailor','Application Agent','Inbox Watcher');
  if (/prospect|contrat|entreprise/.test(lower)) route.push('Contract Hunter','CRM Agent','Sales Agent');
  if (/design|visuel|post|contenu/.test(lower)) route.push('Master Designer','Social Media Manager');
  if (/mail|email|inbox/.test(lower)) route.push('Inbox Agent');
  if (/site|app|code|logiciel/.test(lower)) route.push('Web Agent','Software Agent','QA Agent');
  const unique = [...new Set(route)];
  if (pool) {
    try {
      const t = await pool.query(`SELECT id FROM tenants WHERE slug='hi-marketing' LIMIT 1`);
      if (t.rowCount) await pool.query(`INSERT INTO agent_runs(tenant_id,agent_name,action,permission_level,status,input) VALUES($1,'HI Orchestrator','route_command','A1','success',$2::jsonb)`,[t.rows[0].id,JSON.stringify({ command, route:unique })]);
    } catch {}
  }
  res.json({ ok:true, route:unique, mode:'policy-routed', note:'External execution connectors are activated per integration and policy.' });
});

app.use(express.static(__dirname, { extensions:['html'], maxAge:'5m', index:'index.html' }));
app.use((_req,res) => res.sendFile(path.join(__dirname,'index.html')));

app.listen(PORT, async () => {
  console.log(`HI OS listening on ${PORT}`);
  if (pool) {
    try { await ensureSchema(); console.log('HI OS database schema ready'); }
    catch (e) { console.error('DB bootstrap deferred:', e.message); }
  }
});
