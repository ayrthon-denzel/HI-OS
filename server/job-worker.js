const { findJobs, tailorApplication } = require('./ai');
const { listRecentMessages } = require('./google');

const INTERVIEW_RE=/entretien|interview|visioconf|visio|rendez[- ]?vous|meet(?:ing)?|teams|zoom|convocation/i;
const TEST_RE=/test technique|assessment|étude de cas|case study|test de recrutement|technical test/i;
const OFFER_RE=/offre d['’]embauche|job offer|proposition d['’]embauche|offer letter/i;
const REJECT_RE=/candidature.*(?:pas|non).*retenue|malheureusement|unfortunately|not selected|regret to inform/i;

function startJobWorker({pool,decryptSecret,encryptSecret,audit}){
  if(!pool) return { stop(){} };
  let stopped=false,busy=false;

  async function tick(){
    if(stopped||busy)return;
    busy=true;
    try{
      await reconcileReadyMissions();
      await seedRuns();
      for(let i=0;i<4;i++){
        const run=await claimRun();
        if(!run)break;
        await execute(run);
      }
    }catch(e){console.error('job_worker_tick',e.message);}
    finally{busy=false;}
  }

  async function reconcileReadyMissions(){
    const q=await pool.query(`UPDATE missions m SET status='active',updated_at=now()
      WHERE m.service_type='job_search' AND m.status='onboarding'
      AND EXISTS(SELECT 1 FROM mission_documents d WHERE d.mission_id=m.id AND d.tenant_id=m.tenant_id AND d.document_type='cv_master')
      AND EXISTS(SELECT 1 FROM integrations i WHERE i.mission_id=m.id AND i.tenant_id=m.tenant_id AND i.provider='google_gmail' AND i.status='active')
      RETURNING m.id,m.tenant_id`);
    for(const m of q.rows){
      await audit({tenantId:m.tenant_id,actorType:'agent',actorId:'Mission Supervisor',action:'job_mission.auto_activated',resourceType:'mission',resourceId:m.id,metadata:{reason:'cv_and_gmail_ready',aiConfigured:Boolean(process.env.OPENAI_API_KEY)}});
      console.log('job_mission_auto_activated',m.id);
    }
    return q.rowCount;
  }

  async function seedRuns(){
    if(process.env.OPENAI_API_KEY){
      await pool.query(`INSERT INTO agent_runs(tenant_id,mission_id,agent_name,action,permission_level,status,input)
        SELECT m.tenant_id,m.id,'Mission Supervisor','job_search_cycle','A2','queued','{}'::jsonb FROM missions m
        WHERE m.service_type='job_search' AND m.status='active'
        AND NOT EXISTS(SELECT 1 FROM agent_runs r WHERE r.mission_id=m.id AND r.action='job_search_cycle' AND r.created_at>now()-interval '2 hours' AND r.status IN ('queued','running','success'))`);
    }

    await pool.query(`INSERT INTO agent_runs(tenant_id,mission_id,agent_name,action,permission_level,status,input)
      SELECT m.tenant_id,m.id,'Inbox Watcher','inbox_watch_cycle','A2','queued','{}'::jsonb FROM missions m
      WHERE m.service_type='job_search' AND m.status IN ('active','interview')
      AND EXISTS(SELECT 1 FROM integrations i WHERE i.mission_id=m.id AND i.provider='google_gmail' AND i.status='active')
      AND NOT EXISTS(SELECT 1 FROM agent_runs r WHERE r.mission_id=m.id AND r.action='inbox_watch_cycle' AND r.created_at>now()-interval '20 minutes' AND r.status IN ('queued','running','success'))`);
  }

  async function queueStartupDiagnostics(){
    const q=await pool.query(`INSERT INTO agent_runs(tenant_id,mission_id,agent_name,action,permission_level,status,input)
      SELECT m.tenant_id,m.id,'Inbox Watcher','inbox_watch_cycle','A2','queued','{"diagnostic":true,"source":"startup_health_check"}'::jsonb
      FROM missions m
      WHERE m.service_type='job_search'
      AND EXISTS(SELECT 1 FROM integrations i WHERE i.mission_id=m.id AND i.provider='google_gmail' AND i.status='active')
      AND NOT EXISTS(
        SELECT 1 FROM agent_runs r
        WHERE r.mission_id=m.id AND r.action='inbox_watch_cycle'
        AND r.input->>'diagnostic'='true'
        AND r.created_at>now()-interval '30 minutes'
        AND r.status IN ('queued','running','success')
      )
      RETURNING mission_id`);
    console.log('gmail_startup_diagnostics_queued',q.rowCount);
    return q.rowCount;
  }

  async function claimRun(){
    const c=await pool.connect();
    try{
      await c.query('BEGIN');
      const q=await c.query(`SELECT * FROM agent_runs WHERE status='queued' AND action IN ('initialize_job_cell','job_search_cycle','inbox_watch_cycle') ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1`);
      if(!q.rowCount){await c.query('COMMIT');return null;}
      const run=q.rows[0];
      await c.query(`UPDATE agent_runs SET status='running' WHERE id=$1`,[run.id]);
      await c.query('COMMIT');
      return run;
    }catch(e){await c.query('ROLLBACK');throw e;}
    finally{c.release();}
  }

  async function execute(run){
    try{
      let output={};
      if(run.action==='initialize_job_cell') output=await initialize(run);
      else if(run.action==='job_search_cycle') output=await searchCycle(run);
      else if(run.action==='inbox_watch_cycle') output=await inboxCycle(run);
      await pool.query(`UPDATE agent_runs SET status='success',output=$2::jsonb,finished_at=now() WHERE id=$1`,[run.id,JSON.stringify(output)]);
      if(run.action==='inbox_watch_cycle') console.log('inbox_watcher_success',run.mission_id,JSON.stringify({diagnostic:Boolean(run.input?.diagnostic),connected:Boolean(output.connected),messages:output.messages??0,critical:output.critical??0,rejections:output.rejections??0}));
      if(run.action==='job_search_cycle') console.log('job_search_cycle_success',run.mission_id,JSON.stringify(output));
    }catch(e){
      console.error('job_worker_run',run.id,run.action,e.message);
      if(run.action==='inbox_watch_cycle' && /^gmail_|^google_/.test(e.message||'')){
        await pool.query(`UPDATE integrations SET status='error',updated_at=now() WHERE mission_id=$1 AND tenant_id=$2 AND provider='google_gmail' AND status='active'`,[run.mission_id,run.tenant_id]).catch(()=>{});
        await audit({tenantId:run.tenant_id,actorType:'agent',actorId:'Inbox Watcher',action:'gmail.connection_error',resourceType:'mission',resourceId:run.mission_id,metadata:{error:e.message}});
      }
      await pool.query(`UPDATE agent_runs SET status=$2,output=$3::jsonb,finished_at=now() WHERE id=$1`,[run.id,['ai_not_configured','token_encryption_not_configured'].includes(e.message)?'blocked':'failed',JSON.stringify({error:e.message})]);
    }
  }

  async function initialize(run){
    await pool.query(`UPDATE missions SET updated_at=now() WHERE id=$1 AND tenant_id=$2`,[run.mission_id,run.tenant_id]);
    return {agents:['Job Scout','CV Tailor','Application Agent','Inbox Watcher','Interview Agent'],ready:true};
  }

  async function searchCycle(run){
    if(!process.env.OPENAI_API_KEY) throw new Error('ai_not_configured');
    const p=await pool.query(`SELECT j.*,m.status FROM job_profiles j JOIN missions m ON m.id=j.mission_id WHERE j.mission_id=$1 AND j.tenant_id=$2 LIMIT 1`,[run.mission_id,run.tenant_id]);
    if(!p.rowCount)throw new Error('job_profile_missing');
    const jobs=await findJobs(p.rows[0]);let inserted=0,prepared=0;
    for(const j of jobs){
      let posted=null;if(j.posted_at){const d=new Date(j.posted_at);if(!isNaN(d))posted=d.toISOString();}
      const q=await pool.query(`INSERT INTO opportunities(tenant_id,mission_id,source,external_id,company,role_title,location,url,posted_at,score,status,raw_data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'qualified',$11::jsonb) ON CONFLICT(mission_id,source,external_id) DO UPDATE SET score=GREATEST(opportunities.score,EXCLUDED.score),raw_data=EXCLUDED.raw_data RETURNING id`,[run.tenant_id,run.mission_id,j.source,j.external_id,j.company,j.role_title,j.location,j.url,posted,j.score,JSON.stringify({rationale:j.rationale})]);
      inserted++;
      if(j.score>=72){const a=await prepareApplication(run,p.rows[0],q.rows[0].id,j);if(a)prepared++;}
    }
    await audit({tenantId:run.tenant_id,actorType:'agent',actorId:'Job Scout',action:'jobs.scouted',resourceType:'mission',resourceId:run.mission_id,metadata:{found:jobs.length,inserted,prepared}});
    return {found:jobs.length,inserted,prepared};
  }

  async function prepareApplication(run,profile,opportunityId,job){
    const exists=await pool.query(`SELECT 1 FROM applications WHERE opportunity_id=$1 LIMIT 1`,[opportunityId]);if(exists.rowCount)return false;
    const doc=await pool.query(`SELECT storage_ref FROM mission_documents WHERE mission_id=$1 AND tenant_id=$2 AND document_type='cv_master' ORDER BY created_at DESC LIMIT 1`,[run.mission_id,run.tenant_id]);if(!doc.rowCount)return false;
    const cvText=decryptSecret(doc.rows[0].storage_ref)?.text||'';if(!cvText)return false;
    const tailored=await tailorApplication({cvText,opportunity:job,profile});
    await pool.query(`INSERT INTO applications(tenant_id,mission_id,opportunity_id,cv_version,cover_letter,channel,status,evidence) VALUES($1,$2,$3,$4,$5,'pending_channel','prepared',$6::jsonb)`,[run.tenant_id,run.mission_id,opportunityId,encryptSecret({text:tailored.tailored_cv_text}),tailored.cover_letter,JSON.stringify({email_subject:tailored.email_subject,email_body:tailored.email_body,fit_score:tailored.fit_score,warnings:tailored.warnings})]);
    return true;
  }

  async function inboxCycle(run){
    const i=await pool.query(`SELECT * FROM integrations WHERE mission_id=$1 AND tenant_id=$2 AND provider='google_gmail' AND status='active' ORDER BY created_at DESC LIMIT 1`,[run.mission_id,run.tenant_id]);
    if(!i.rowCount)return {connected:false,messages:0,critical:0,rejections:0};
    const originalTokens=decryptSecret(i.rows[0].token_ref);
    let tokens=originalTokens;
    const result=await listRecentMessages(tokens,'newer_than:2d');
    tokens=result.tokens;
    if(JSON.stringify(tokens)!==JSON.stringify(originalTokens)){
      await pool.query(`UPDATE integrations SET token_ref=$1,updated_at=now() WHERE id=$2`,[encryptSecret(tokens),i.rows[0].id]);
    }else{
      await pool.query(`UPDATE integrations SET updated_at=now() WHERE id=$1`,[i.rows[0].id]);
    }

    if(run.input?.diagnostic){
      await audit({tenantId:run.tenant_id,actorType:'agent',actorId:'Inbox Watcher',action:'gmail.health_check',resourceType:'mission',resourceId:run.mission_id,metadata:{messages:result.messages.length}});
      return {connected:true,diagnostic:true,messages:result.messages.length,critical:0,rejections:0,checkedAt:new Date().toISOString()};
    }

    let critical=0,rejections=0;
    for(const m of result.messages){
      const text=`${m.subject} ${m.snippet} ${m.body}`.slice(0,10000);
      let type=null,severity='info';
      if(INTERVIEW_RE.test(text)){type='interview_detected';severity='critical';}
      else if(TEST_RE.test(text)){type='test_detected';severity='critical';}
      else if(OFFER_RE.test(text)){type='offer_detected';severity='critical';}
      else if(REJECT_RE.test(text)){type='rejection_detected';severity='info';rejections++;}
      if(!type)continue;
      const fingerprint=`gmail:${m.id}:${type}`;
      const dup=await pool.query(`SELECT 1 FROM client_events WHERE mission_id=$1 AND payload->>'fingerprint'=$2 LIMIT 1`,[run.mission_id,fingerprint]);
      if(dup.rowCount)continue;
      await pool.query(`INSERT INTO client_events(tenant_id,mission_id,event_type,severity,payload) VALUES($1,$2,$3,$4,$5::jsonb)`,[run.tenant_id,run.mission_id,type,severity,JSON.stringify({fingerprint,subject:m.subject,from:m.from,messageId:m.id})]);
      if(severity==='critical'){
        critical++;
        await pool.query(`UPDATE missions SET status='interview',updated_at=now() WHERE id=$1 AND tenant_id=$2`,[run.mission_id,run.tenant_id]);
        const pending=await pool.query(`SELECT 1 FROM approvals WHERE mission_id=$1 AND action_type=$2 AND payload->>'messageId'=$3 AND status='pending' LIMIT 1`,[run.mission_id,type,m.id]);
        if(!pending.rowCount){
          await pool.query(`INSERT INTO approvals(tenant_id,mission_id,action_type,payload,status) VALUES($1,$2,$3,$4::jsonb,'pending')`,[run.tenant_id,run.mission_id,type,JSON.stringify({subject:m.subject,from:m.from,messageId:m.id})]);
        }
      }
    }
    await audit({tenantId:run.tenant_id,actorType:'agent',actorId:'Inbox Watcher',action:'gmail.checked',resourceType:'mission',resourceId:run.mission_id,metadata:{messages:result.messages.length,critical,rejections}});
    return {connected:true,messages:result.messages.length,critical,rejections,checkedAt:new Date().toISOString()};
  }

  const timer=setInterval(tick,60_000);
  setTimeout(async()=>{
    try{await reconcileReadyMissions();await queueStartupDiagnostics();}catch(e){console.error('job_startup_reconcile_failed',e.message);}
    tick();
  },2500);
  return {stop(){stopped=true;clearInterval(timer);}};
}

module.exports={startJobWorker};
