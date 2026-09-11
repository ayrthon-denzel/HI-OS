const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const { Pool } = require('pg');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const STRICT = process.env.HI_OS_SECURITY_MODE === 'strict';
const DATABASE_URL = process.env.DATABASE_URL || '';
const ADMIN_KEY = process.env.HI_OS_ADMIN_KEY || '';
const SESSION_SECRET = process.env.HI_OS_SESSION_SECRET || '';
const BOOTSTRAP_EMAIL = (process.env.HI_OS_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
const BOOTSTRAP_PASSWORD = process.env.HI_OS_BOOTSTRAP_PASSWORD || '';
const TOKEN_KEY = process.env.HI_OS_TOKEN_ENCRYPTION_KEY || '';
const COOKIE_NAME = 'hi_os_session';
const SESSION_HOURS = 12;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'], connectSrc: ["'self'", 'https://accounts.google.com', 'https://oauth2.googleapis.com'],
      objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'", 'https://accounts.google.com']
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));
app.use(express.json({ limit: '256kb', type: 'application/json' }));
app.use(cookieParser());
app.use(rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false }));
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 8000 }) : null;
const startedAt = new Date().toISOString();

const sha256 = (value='') => crypto.createHash('sha256').update(String(value)).digest('hex');
function hashIp(ip='') { return sha256(`${ip}:${SESSION_SECRET || 'hi-os'}`).slice(0, 24); }
function uaHash(ua='') { return sha256(ua).slice(0, 24); }
function cleanText(v,max=255){ return String(v ?? '').trim().slice(0,max); }
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').toLowerCase()); }
function safeArray(v,max=20){ return Array.isArray(v) ? v.map(x=>cleanText(x,160)).filter(Boolean).slice(0,max) : []; }
function randomToken(bytes=32){ return crypto.randomBytes(bytes).toString('base64url'); }

function encryptSecret(obj){
  if (!TOKEN_KEY) throw new Error('token_encryption_not_configured');
  const key = crypto.createHash('sha256').update(TOKEN_KEY).digest();
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(obj),'utf8'),cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
}

async function audit({ tenantId=null, actorType='system', actorId=null, action, resourceType=null, resourceId=null, ip='', metadata={} }) {
  if (!pool) return;
  try {
    await pool.query(`INSERT INTO audit_log (tenant_id,actor_type,actor_id,action,resource_type,resource_id,ip_hash,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [tenantId,actorType,actorId,action,resourceType,resourceId,hashIp(ip),JSON.stringify(metadata)]);
  } catch (e) { console.error('audit_error', e.message); }
}

async function ensureSchema() {
  if (!pool) return { ok:false, reason:'DATABASE_URL missing' };
  const sql = fs.readFileSync(path.join(__dirname,'db','schema.sql'),'utf8');
  await pool.query(sql);
  const tenant = await pool.query(`INSERT INTO tenants(name,slug) VALUES('HI MARKETING','hi-marketing') ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`);
  const tenantId = tenant.rows[0].id;
  if (BOOTSTRAP_EMAIL && BOOTSTRAP_PASSWORD && BOOTSTRAP_PASSWORD.length >= 12) {
    const exists = await pool.query(`SELECT id FROM users WHERE tenant_id=$1 AND role='ceo' LIMIT 1`,[tenantId]);
    if (!exists.rowCount) {
      const passwordHash = await bcrypt.hash(BOOTSTRAP_PASSWORD, 12);
      await pool.query(`INSERT INTO users(tenant_id,email,full_name,role,status,password_hash,must_change_password) VALUES($1,$2,'A-D PANIKA','ceo','active',$3,true)`,[tenantId,BOOTSTRAP_EMAIL,passwordHash]);
      console.log('HI OS CEO bootstrap account created');
    }
  }
  return { ok:true, tenantId };
}

async function getSession(req){
  if (!pool) return null;
  const raw = req.cookies?.[COOKIE_NAME]; if (!raw) return null;
  try {
    const q = await pool.query(`SELECT s.id,s.tenant_id,s.user_id,u.email,u.full_name,u.role,u.status,u.mfa_enabled,u.must_change_password FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() LIMIT 1`,[sha256(raw)]);
    if (!q.rowCount || q.rows[0].status !== 'active') return null;
    return q.rows[0];
  } catch { return null; }
}

async function requireAuth(req,res,next){ const s = await getSession(req); if(!s) return res.status(401).json({error:'unauthorized'}); req.auth=s; next(); }
function allowRoles(...roles){ return (req,res,next)=> roles.includes(req.auth?.role) ? next() : res.status(403).json({error:'forbidden'}); }
async function requireAdminOrKey(req,res,next){
  const s=await getSession(req); if(s && ['ceo','admin_ops'].includes(s.role)){req.auth=s; return next();}
  if(ADMIN_KEY){ const auth=req.get('authorization')||''; const key=auth.startsWith('Bearer ')?auth.slice(7):req.get('x-hi-os-key'); if(key && key.length===ADMIN_KEY.length && crypto.timingSafeEqual(Buffer.from(key),Buffer.from(ADMIN_KEY))){req.auth={role:'ceo',email:'emergency-key',tenant_id:null,user_id:null};return next();}}
  return res.status(401).json({error:'unauthorized'});
}

app.get('/health', async (_req,res)=>{
  let db='disconnected'; if(pool){try{await pool.query('SELECT 1');db='connected';}catch(e){db='error';}}
  res.json({status:'ok',app:'HI OS',version:'0.3.0',startedAt,db,security:STRICT?'strict':'standard'});
});
app.get('/api/bootstrap-status', async (_req,res)=>{
  let db=false, users=0; if(pool){try{await pool.query('SELECT 1');db=true;const q=await pool.query('SELECT count(*)::int n FROM users');users=q.rows[0].n;}catch{}}
  res.json({database:db,adminConfigured:users>0,tenantIsolation:process.env.HI_OS_TENANT_ISOLATION==='required',gmailConfigured:Boolean(process.env.GOOGLE_CLIENT_ID&&process.env.GOOGLE_CLIENT_SECRET),aiConfigured:Boolean(process.env.OPENAI_API_KEY)});
});

app.post('/api/auth/login',authLimiter,async(req,res)=>{
  if(!pool) return res.status(503).json({error:'database_unavailable'});
  const email=cleanText(req.body?.email,255).toLowerCase(), password=String(req.body?.password||''), otp=cleanText(req.body?.otp,12);
  if(!validEmail(email)||password.length<8) return res.status(400).json({error:'invalid_credentials'});
  try{
    const q=await pool.query(`SELECT * FROM users WHERE lower(email)=$1 AND status='active' LIMIT 1`,[email]);
    const user=q.rows[0]; const ok=user?.password_hash ? await bcrypt.compare(password,user.password_hash) : false;
    if(!ok){await audit({actorType:'auth',actorId:email,action:'login.failed',ip:req.ip});return res.status(401).json({error:'invalid_credentials'});}
    if(user.mfa_enabled && (!otp || !authenticator.check(otp,user.mfa_secret||''))) return res.status(401).json({error:'mfa_required'});
    const raw=randomToken(36), expires=new Date(Date.now()+SESSION_HOURS*3600000);
    await pool.query(`INSERT INTO auth_sessions(user_id,tenant_id,token_hash,ip_hash,user_agent_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6)`,[user.id,user.tenant_id,sha256(raw),hashIp(req.ip),uaHash(req.get('user-agent')||''),expires]);
    await pool.query(`UPDATE users SET last_login_at=now() WHERE id=$1`,[user.id]);
    res.cookie(COOKIE_NAME,raw,{httpOnly:true,secure:true,sameSite:'strict',path:'/',expires});
    await audit({tenantId:user.tenant_id,actorType:'user',actorId:user.id,action:'login.success',ip:req.ip});
    res.json({ok:true,user:{email:user.email,fullName:user.full_name,role:user.role,mfaEnabled:user.mfa_enabled,mustChangePassword:user.must_change_password}});
  }catch(e){console.error(e);res.status(500).json({error:'login_failed'});}
});

app.get('/api/auth/me',requireAuth,(req,res)=>res.json({authenticated:true,user:{email:req.auth.email,fullName:req.auth.full_name,role:req.auth.role,mfaEnabled:req.auth.mfa_enabled,mustChangePassword:req.auth.must_change_password}}));
app.post('/api/auth/logout',requireAuth,async(req,res)=>{const raw=req.cookies?.[COOKIE_NAME];if(raw)await pool.query(`UPDATE auth_sessions SET revoked_at=now() WHERE token_hash=$1`,[sha256(raw)]);res.clearCookie(COOKIE_NAME,{path:'/'});res.json({ok:true});});
app.post('/api/auth/change-password',requireAuth,authLimiter,async(req,res)=>{
  const current=String(req.body?.currentPassword||''), next=String(req.body?.newPassword||''); if(next.length<14) return res.status(400).json({error:'password_too_short'});
  const q=await pool.query(`SELECT password_hash FROM users WHERE id=$1`,[req.auth.user_id]); if(!q.rowCount||!await bcrypt.compare(current,q.rows[0].password_hash||''))return res.status(401).json({error:'invalid_current_password'});
  await pool.query(`UPDATE users SET password_hash=$1,must_change_password=false WHERE id=$2`,[await bcrypt.hash(next,12),req.auth.user_id]);
  await pool.query(`UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2`,[req.auth.user_id,req.auth.id]);
  await audit({tenantId:req.auth.tenant_id,actorType:'user',actorId:req.auth.user_id,action:'password.changed',ip:req.ip}); res.json({ok:true});
});
app.post('/api/auth/mfa/setup',requireAuth,allowRoles('ceo','admin_ops'),async(req,res)=>{const secret=authenticator.generateSecret();await pool.query(`UPDATE users SET mfa_secret=$1,mfa_enabled=false WHERE id=$2`,[secret,req.auth.user_id]);const uri=authenticator.keyuri(req.auth.email,'HI OS',secret);res.json({secret,otpauth:uri});});
app.post('/api/auth/mfa/confirm',requireAuth,allowRoles('ceo','admin_ops'),async(req,res)=>{const token=cleanText(req.body?.otp,12);const q=await pool.query(`SELECT mfa_secret FROM users WHERE id=$1`,[req.auth.user_id]);if(!q.rowCount||!authenticator.check(token,q.rows[0].mfa_secret||''))return res.status(400).json({error:'invalid_otp'});await pool.query(`UPDATE users SET mfa_enabled=true WHERE id=$1`,[req.auth.user_id]);await audit({tenantId:req.auth.tenant_id,actorType:'user',actorId:req.auth.user_id,action:'mfa.enabled',ip:req.ip});res.json({ok:true});});

app.get('/api/admin/dashboard',requireAdminOrKey,async(req,res)=>{
  if(!pool)return res.status(503).json({error:'database_unavailable'});try{const tenantId=req.auth.tenant_id||(await pool.query(`SELECT id FROM tenants WHERE slug='hi-marketing' LIMIT 1`)).rows[0]?.id;if(!tenantId)return res.json({clients:0,missions:0,interviews:0,applications:0,agentRuns:0});const [clients,missions,interviews,applications,runs]=await Promise.all([pool.query('SELECT count(*)::int n FROM clients WHERE tenant_id=$1',[tenantId]),pool.query("SELECT count(*)::int n FROM missions WHERE tenant_id=$1 AND status IN ('onboarding','active','interview')",[tenantId]),pool.query("SELECT count(*)::int n FROM missions WHERE tenant_id=$1 AND status='interview'",[tenantId]),pool.query("SELECT count(*)::int n FROM applications WHERE tenant_id=$1 AND status IN ('submitted','acknowledged','test','interview','offer')",[tenantId]),pool.query("SELECT count(*)::int n FROM agent_runs WHERE tenant_id=$1 AND created_at>now()-interval '24 hours'",[tenantId])]);res.json({clients:clients.rows[0].n,missions:missions.rows[0].n,interviews:interviews.rows[0].n,applications:applications.rows[0].n,agentRuns:runs.rows[0].n});}catch(e){console.error(e);res.status(500).json({error:'dashboard_failed'});}
});

app.post('/api/admin/job-missions',requireAdminOrKey,async(req,res)=>{
  if(!pool)return res.status(503).json({error:'database_unavailable'});const {clientName,clientEmail,targetRoles=[],locations=[],contractTypes=[],constraints={}}=req.body||{};if(!cleanText(clientName,160)||!validEmail(clientEmail))return res.status(400).json({error:'invalid_payload'});const db=await pool.connect();try{await db.query('BEGIN');let tenantId=req.auth.tenant_id;if(!tenantId){const t=await db.query(`SELECT id FROM tenants WHERE slug='hi-marketing' LIMIT 1`);tenantId=t.rows[0]?.id;}if(!tenantId)throw new Error('tenant_missing');const c=await db.query(`INSERT INTO clients(tenant_id,name,email,service_type,metadata) VALUES($1,$2,$3,'job_search',$4::jsonb) RETURNING id`,[tenantId,cleanText(clientName,160),cleanText(clientEmail,255).toLowerCase(),JSON.stringify({source:'HI OS'})]);const m=await db.query(`INSERT INTO missions(tenant_id,client_id,service_type,title,status,autonomy_level,supervisor_agent,config) VALUES($1,$2,'job_search',$3,'onboarding','A2','Mission Supervisor',$4::jsonb) RETURNING id`,[tenantId,c.rows[0].id,`Recherche d'emploi — ${cleanText(clientName,100)}`,JSON.stringify({escalation:'interview_or_human_choice',silentUntil:'interview'})]);await db.query(`INSERT INTO job_profiles(tenant_id,mission_id,target_roles,locations,contract_types,constraints) VALUES($1,$2,$3,$4,$5,$6::jsonb)`,[tenantId,m.rows[0].id,safeArray(targetRoles),safeArray(locations),safeArray(contractTypes),JSON.stringify(constraints||{})]);await db.query(`INSERT INTO agent_runs(tenant_id,mission_id,agent_name,action,permission_level,status,input) VALUES($1,$2,'Mission Supervisor','initialize_job_cell','A2','queued',$3::jsonb)`,[tenantId,m.rows[0].id,JSON.stringify({agents:['Job Scout','CV Tailor','Application Agent','Inbox Watcher','Interview Agent']})]);await db.query('COMMIT');await audit({tenantId,actorType:'user',actorId:req.auth.user_id||'emergency-key',action:'job_mission.created',resourceType:'mission',resourceId:m.rows[0].id,ip:req.ip});res.status(201).json({ok:true,missionId:m.rows[0].id,clientId:c.rows[0].id,status:'onboarding'});}catch(e){await db.query('ROLLBACK');console.error(e);res.status(500).json({error:'mission_create_failed'});}finally{db.release();}
});

app.get('/api/admin/job-missions',requireAdminOrKey,async(req,res)=>{if(!pool)return res.status(503).json({error:'database_unavailable'});try{const tenantId=req.auth.tenant_id||(await pool.query(`SELECT id FROM tenants WHERE slug='hi-marketing' LIMIT 1`)).rows[0]?.id;const q=await pool.query(`SELECT m.id,m.title,m.status,m.created_at,c.name client_name,c.email client_email,coalesce((SELECT count(*) FROM applications a WHERE a.mission_id=m.id),0)::int applications,coalesce((SELECT count(*) FROM opportunities o WHERE o.mission_id=m.id AND o.status IN ('qualified','applied','interview')),0)::int opportunities FROM missions m JOIN clients c ON c.id=m.client_id WHERE m.tenant_id=$1 AND m.service_type='job_search' ORDER BY m.created_at DESC LIMIT 100`,[tenantId]);res.json({items:q.rows});}catch(e){console.error(e);res.status(500).json({error:'mission_list_failed'});}});

app.get('/api/admin/job-missions/:id',requireAdminOrKey,async(req,res)=>{if(!pool)return res.status(503).json({error:'database_unavailable'});const tenantId=req.auth.tenant_id||(await pool.query(`SELECT id FROM tenants WHERE slug='hi-marketing' LIMIT 1`)).rows[0]?.id;const q=await pool.query(`SELECT m.*,c.name client_name,c.email client_email,j.target_roles,j.locations,j.contract_types,j.constraints FROM missions m JOIN clients c ON c.id=m.client_id LEFT JOIN job_profiles j ON j.mission_id=m.id WHERE m.id=$1 AND m.tenant_id=$2 LIMIT 1`,[req.params.id,tenantId]);if(!q.rowCount)return res.status(404).json({error:'not_found'});const [ops,apps,runs,events]=await Promise.all([pool.query(`SELECT * FROM opportunities WHERE mission_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 100`,[req.params.id,tenantId]),pool.query(`SELECT * FROM applications WHERE mission_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 100`,[req.params.id,tenantId]),pool.query(`SELECT id,agent_name,action,permission_level,status,created_at,finished_at FROM agent_runs WHERE mission_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 100`,[req.params.id,tenantId]),pool.query(`SELECT * FROM client_events WHERE mission_id=$1 AND tenant_id=$2 ORDER BY created_at DESC LIMIT 100`,[req.params.id,tenantId])]);res.json({mission:q.rows[0],opportunities:ops.rows,applications:apps.rows,agentRuns:runs.rows,events:events.rows});});

app.post('/api/admin/job-missions/:id/activate',requireAdminOrKey,async(req,res)=>{const tenantId=req.auth.tenant_id||(await pool.query(`SELECT id FROM tenants WHERE slug='hi-marketing' LIMIT 1`)).rows[0]?.id;const q=await pool.query(`UPDATE missions SET status='active',updated_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING id`,[req.params.id,tenantId]);if(!q.rowCount)return res.status(404).json({error:'not_found'});await pool.query(`INSERT INTO agent_runs(tenant_id,mission_id,agent_name,action,permission_level,status,input) VALUES($1,$2,'Mission Supervisor','job_search_cycle','A2','queued','{}')`,[tenantId,req.params.id]);res.json({ok:true,status:'active'});});

app.get('/api/admin/approvals',requireAdminOrKey,async(req,res)=>{const tenantId=req.auth.tenant_id||(await pool.query(`SELECT id FROM tenants WHERE slug='hi-marketing' LIMIT 1`)).rows[0]?.id;const q=await pool.query(`SELECT id,mission_id,action_type,payload,status,requested_at FROM approvals WHERE tenant_id=$1 AND status='pending' ORDER BY requested_at DESC LIMIT 100`,[tenantId]);res.json({items:q.rows});});
app.post('/api/admin/approvals/:id/:decision',requireAdminOrKey,async(req,res)=>{const decision=req.params.decision;if(!['approve','reject'].includes(decision))return res.status(400).json({error:'invalid_decision'});const tenantId=req.auth.tenant_id||(await pool.query(`SELECT id FROM tenants WHERE slug='hi-marketing' LIMIT 1`)).rows[0]?.id;const status=decision==='approve'?'approved':'rejected';const q=await pool.query(`UPDATE approvals SET status=$1,resolved_at=now(),resolved_by=$2 WHERE id=$3 AND tenant_id=$4 AND status='pending' RETURNING *`,[status,req.auth.user_id||null,req.params.id,tenantId]);if(!q.rowCount)return res.status(404).json({error:'not_found'});res.json({ok:true,status});});

app.post('/api/orchestrate',requireAuth,async(req,res)=>{const command=cleanText(req.body?.command,4000);if(!command)return res.status(400).json({error:'command_required'});const lower=command.toLowerCase(),route=['HI Orchestrator'];if(/emploi|cv|candidature|alternance|offre/.test(lower))route.push('Mission Supervisor','Job Scout','CV Tailor','Application Agent','Inbox Watcher');if(/prospect|contrat|entreprise/.test(lower))route.push('Contract Hunter','CRM Agent','Sales Agent');if(/design|visuel|post|contenu/.test(lower))route.push('Master Designer','Social Media Manager');if(/mail|email|inbox/.test(lower))route.push('Inbox Agent');if(/site|app|code|logiciel/.test(lower))route.push('Web Agent','Software Agent','QA Agent');const unique=[...new Set(route)];await pool.query(`INSERT INTO agent_runs(tenant_id,agent_name,action,permission_level,status,input,output,finished_at) VALUES($1,'HI Orchestrator','route_command','A1','success',$2::jsonb,$3::jsonb,now())`,[req.auth.tenant_id,JSON.stringify({command}),JSON.stringify({route:unique})]);res.json({ok:true,route:unique,mode:'policy-routed'});});

app.get('/api/admin/integrations/google/start',requireAdminOrKey,async(req,res)=>{const missionId=cleanText(req.query.missionId,80);if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET)return res.status(503).json({error:'google_oauth_not_configured'});if(!TOKEN_KEY)return res.status(503).json({error:'token_encryption_not_configured'});const state=randomToken(24);const redirect=`${req.protocol}://${req.get('host')}/api/oauth/google/callback`;res.cookie('hi_os_oauth_state',state,{httpOnly:true,secure:true,sameSite:'lax',maxAge:10*60*1000,path:'/api/oauth/google'});res.cookie('hi_os_oauth_mission',missionId,{httpOnly:true,secure:true,sameSite:'lax',maxAge:10*60*1000,path:'/api/oauth/google'});const params=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID,redirect_uri:redirect,response_type:'code',access_type:'offline',prompt:'consent',state,scope:['openid','email','https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.send'].join(' ')});res.json({url:`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`});});
app.get('/api/oauth/google/callback',async(req,res)=>{const {code,state}=req.query;if(!code||!state||state!==req.cookies?.hi_os_oauth_state)return res.status(400).send('OAuth state invalide.');if(!pool||!TOKEN_KEY)return res.status(503).send('Intégration indisponible.');try{const redirect=`${req.protocol}://${req.get('host')}/api/oauth/google/callback`;const tokenResp=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:String(code),client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:redirect,grant_type:'authorization_code'})});const tokens=await tokenResp.json();if(!tokenResp.ok)throw new Error('oauth_exchange_failed');const missionId=req.cookies?.hi_os_oauth_mission;const m=await pool.query(`SELECT tenant_id FROM missions WHERE id=$1 LIMIT 1`,[missionId]);if(!m.rowCount)throw new Error('mission_missing');await pool.query(`INSERT INTO integrations(tenant_id,mission_id,provider,external_account,scopes,token_ref,status) VALUES($1,$2,'google_gmail',NULL,$3,$4,'active')`,[m.rows[0].tenant_id,missionId,['gmail.readonly','gmail.send'],encryptSecret(tokens)]);res.clearCookie('hi_os_oauth_state',{path:'/api/oauth/google'});res.clearCookie('hi_os_oauth_mission',{path:'/api/oauth/google'});res.redirect('/?oauth=connected');}catch(e){console.error(e);res.status(500).send('Connexion Google impossible.');}});

app.use(express.static(__dirname,{extensions:['html'],maxAge:'5m',index:'index.html'}));
app.use((_req,res)=>res.sendFile(path.join(__dirname,'index.html')));

app.listen(PORT,async()=>{console.log(`HI OS listening on ${PORT}`);if(pool){try{await ensureSchema();console.log('HI OS database schema ready');}catch(e){console.error('DB bootstrap deferred:',e.message);}}});
