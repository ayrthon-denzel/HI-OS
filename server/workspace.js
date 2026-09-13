const express=require('express');

module.exports=function workspaceRoutes({pool,tenantFor,audit,clean}){
  const r=express.Router();
  const bodyText=(v,n=4000)=>clean(v,n);
  const allowed=(v,list,def)=>list.includes(v)?v:def;

  r.get('/summary',async(req,res)=>{
    try{
      const t=await tenantFor(req);
      const [clients,deals,projects,tasks,content,calendar,docs]=await Promise.all([
        pool.query(`SELECT count(*)::int n FROM clients WHERE tenant_id=$1 AND status='active'`,[t]),
        pool.query(`SELECT count(*)::int n FROM crm_deals WHERE tenant_id=$1 AND status NOT IN('won','lost')`,[t]),
        pool.query(`SELECT count(*)::int n FROM workspace_projects WHERE tenant_id=$1 AND status IN('planned','active','review')`,[t]),
        pool.query(`SELECT count(*)::int n FROM workspace_tasks WHERE tenant_id=$1 AND status NOT IN('done','cancelled')`,[t]),
        pool.query(`SELECT count(*)::int n FROM content_items WHERE tenant_id=$1 AND status NOT IN('published','archived')`,[t]),
        pool.query(`SELECT count(*)::int n FROM calendar_items WHERE tenant_id=$1 AND starts_at>=now() AND starts_at<now()+interval '7 days'`,[t]),
        pool.query(`SELECT count(*)::int n FROM business_documents WHERE tenant_id=$1 AND status NOT IN('archived')`,[t])
      ]);
      res.json({clients:clients.rows[0].n,deals:deals.rows[0].n,projects:projects.rows[0].n,tasks:tasks.rows[0].n,content:content.rows[0].n,calendar:calendar.rows[0].n,documents:docs.rows[0].n});
    }catch(e){console.error('workspace_summary',e);res.status(500).json({error:'workspace_summary_failed'});}
  });

  r.get('/clients',async(req,res)=>{
    try{const t=await tenantFor(req),q=await pool.query(`SELECT id,name,email,phone,service_type,status,metadata,created_at FROM clients WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 250`,[t]);res.json({items:q.rows});}
    catch(e){res.status(500).json({error:'clients_failed'});}
  });
  r.post('/clients',async(req,res)=>{
    const name=bodyText(req.body?.name,160);if(!name)return res.status(400).json({error:'name_required'});
    try{const t=await tenantFor(req),q=await pool.query(`INSERT INTO clients(tenant_id,name,email,phone,service_type,status,metadata) VALUES($1,$2,$3,$4,$5,'active',$6::jsonb) RETURNING *`,[t,name,bodyText(req.body?.email,255)||null,bodyText(req.body?.phone,80)||null,bodyText(req.body?.serviceType,120)||'general',JSON.stringify(req.body?.metadata||{})]);await audit({tenantId:t,actorType:'user',actorId:req.auth.user_id||'key',action:'workspace.client.created',resourceType:'client',resourceId:q.rows[0].id,ip:req.ip});res.status(201).json({item:q.rows[0]});}
    catch(e){console.error('client_create',e);res.status(500).json({error:'client_create_failed'});}
  });

  r.get('/deals',async(req,res)=>{try{const t=await tenantFor(req),q=await pool.query(`SELECT d.*,c.name client_name FROM crm_deals d LEFT JOIN clients c ON c.id=d.client_id WHERE d.tenant_id=$1 ORDER BY d.updated_at DESC LIMIT 250`,[t]);res.json({items:q.rows});}catch(e){res.status(500).json({error:'deals_failed'});}});
  r.post('/deals',async(req,res)=>{
    const title=bodyText(req.body?.title,180);if(!title)return res.status(400).json({error:'title_required'});
    const stage=allowed(req.body?.stage,['new','qualified','contacted','replied','meeting','proposal','won','lost'],'new');
    try{const t=await tenantFor(req),q=await pool.query(`INSERT INTO crm_deals(tenant_id,client_id,title,stage,value_fcfa,next_action,next_action_at,source,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[t,req.body?.clientId||null,title,stage,Number(req.body?.valueFcfa)||null,bodyText(req.body?.nextAction,500)||null,req.body?.nextActionAt||null,bodyText(req.body?.source,120)||null,bodyText(req.body?.notes,4000)||null]);await audit({tenantId:t,actorType:'user',actorId:req.auth.user_id||'key',action:'workspace.deal.created',resourceType:'deal',resourceId:q.rows[0].id,ip:req.ip});res.status(201).json({item:q.rows[0]});}catch(e){console.error('deal_create',e);res.status(500).json({error:'deal_create_failed'});}
  });
  r.patch('/deals/:id',async(req,res)=>{
    const stage=allowed(req.body?.stage,['new','qualified','contacted','replied','meeting','proposal','won','lost'],null);if(!stage)return res.status(400).json({error:'invalid_stage'});
    try{const t=await tenantFor(req),q=await pool.query(`UPDATE crm_deals SET stage=$1,updated_at=now() WHERE id=$2 AND tenant_id=$3 RETURNING *`,[stage,req.params.id,t]);if(!q.rowCount)return res.status(404).json({error:'not_found'});res.json({item:q.rows[0]});}catch(e){res.status(500).json({error:'deal_update_failed'});}
  });

  r.get('/projects',async(req,res)=>{try{const t=await tenantFor(req),q=await pool.query(`SELECT p.*,c.name client_name,(SELECT count(*)::int FROM workspace_tasks wt WHERE wt.project_id=p.id AND wt.status NOT IN('done','cancelled')) open_tasks FROM workspace_projects p LEFT JOIN clients c ON c.id=p.client_id WHERE p.tenant_id=$1 ORDER BY p.updated_at DESC LIMIT 250`,[t]);res.json({items:q.rows});}catch(e){res.status(500).json({error:'projects_failed'});}});
  r.post('/projects',async(req,res)=>{
    const name=bodyText(req.body?.name,180);if(!name)return res.status(400).json({error:'name_required'});
    try{const t=await tenantFor(req),q=await pool.query(`INSERT INTO workspace_projects(tenant_id,client_id,name,category,status,deadline,description) VALUES($1,$2,$3,$4,'planned',$5,$6) RETURNING *`,[t,req.body?.clientId||null,name,bodyText(req.body?.category,100)||'general',req.body?.deadline||null,bodyText(req.body?.description,4000)||null]);res.status(201).json({item:q.rows[0]});}catch(e){res.status(500).json({error:'project_create_failed'});}
  });
  r.patch('/projects/:id',async(req,res)=>{const status=allowed(req.body?.status,['planned','active','review','done','paused','cancelled'],null);if(!status)return res.status(400).json({error:'invalid_status'});try{const t=await tenantFor(req),q=await pool.query(`UPDATE workspace_projects SET status=$1,updated_at=now() WHERE id=$2 AND tenant_id=$3 RETURNING *`,[status,req.params.id,t]);if(!q.rowCount)return res.status(404).json({error:'not_found'});res.json({item:q.rows[0]});}catch(e){res.status(500).json({error:'project_update_failed'});}});

  r.get('/tasks',async(req,res)=>{try{const t=await tenantFor(req),q=await pool.query(`SELECT wt.*,p.name project_name FROM workspace_tasks wt LEFT JOIN workspace_projects p ON p.id=wt.project_id WHERE wt.tenant_id=$1 ORDER BY wt.due_at NULLS LAST,wt.created_at DESC LIMIT 300`,[t]);res.json({items:q.rows});}catch(e){res.status(500).json({error:'tasks_failed'});}});
  r.post('/tasks',async(req,res)=>{const title=bodyText(req.body?.title,180);if(!title)return res.status(400).json({error:'title_required'});try{const t=await tenantFor(req),q=await pool.query(`INSERT INTO workspace_tasks(tenant_id,project_id,title,assignee,status,priority,due_at,notes) VALUES($1,$2,$3,$4,'todo',$5,$6,$7) RETURNING *`,[t,req.body?.projectId||null,title,bodyText(req.body?.assignee,120)||null,allowed(req.body?.priority,['low','normal','high','urgent'],'normal'),req.body?.dueAt||null,bodyText(req.body?.notes,4000)||null]);res.status(201).json({item:q.rows[0]});}catch(e){res.status(500).json({error:'task_create_failed'});}});
  r.patch('/tasks/:id',async(req,res)=>{const status=allowed(req.body?.status,['todo','doing','blocked','done','cancelled'],null);if(!status)return res.status(400).json({error:'invalid_status'});try{const t=await tenantFor(req),q=await pool.query(`UPDATE workspace_tasks SET status=$1,updated_at=now() WHERE id=$2 AND tenant_id=$3 RETURNING *`,[status,req.params.id,t]);if(!q.rowCount)return res.status(404).json({error:'not_found'});res.json({item:q.rows[0]});}catch(e){res.status(500).json({error:'task_update_failed'});}});

  r.get('/content',async(req,res)=>{try{const t=await tenantFor(req),q=await pool.query(`SELECT * FROM content_items WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 250`,[t]);res.json({items:q.rows});}catch(e){res.status(500).json({error:'content_failed'});}});
  r.post('/content',async(req,res)=>{const title=bodyText(req.body?.title,180);if(!title)return res.status(400).json({error:'title_required'});try{const t=await tenantFor(req),q=await pool.query(`INSERT INTO content_items(tenant_id,title,channel,format,status,publish_at,brief) VALUES($1,$2,$3,$4,'idea',$5,$6) RETURNING *`,[t,title,bodyText(req.body?.channel,80)||'multi',bodyText(req.body?.format,80)||'post',req.body?.publishAt||null,bodyText(req.body?.brief,4000)||null]);res.status(201).json({item:q.rows[0]});}catch(e){res.status(500).json({error:'content_create_failed'});}});
  r.patch('/content/:id',async(req,res)=>{const status=allowed(req.body?.status,['idea','brief','creating','review','scheduled','published','archived'],null);if(!status)return res.status(400).json({error:'invalid_status'});try{const t=await tenantFor(req),q=await pool.query(`UPDATE content_items SET status=$1,updated_at=now() WHERE id=$2 AND tenant_id=$3 RETURNING *`,[status,req.params.id,t]);if(!q.rowCount)return res.status(404).json({error:'not_found'});res.json({item:q.rows[0]});}catch(e){res.status(500).json({error:'content_update_failed'});}});

  r.get('/calendar',async(req,res)=>{try{const t=await tenantFor(req),q=await pool.query(`SELECT * FROM calendar_items WHERE tenant_id=$1 AND starts_at>=now()-interval '30 days' ORDER BY starts_at ASC LIMIT 300`,[t]);res.json({items:q.rows});}catch(e){res.status(500).json({error:'calendar_failed'});}});
  r.post('/calendar',async(req,res)=>{const title=bodyText(req.body?.title,180);if(!title||!req.body?.startsAt)return res.status(400).json({error:'title_and_start_required'});try{const t=await tenantFor(req),q=await pool.query(`INSERT INTO calendar_items(tenant_id,title,item_type,starts_at,ends_at,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[t,title,bodyText(req.body?.itemType,80)||'task',req.body.startsAt,req.body?.endsAt||null,bodyText(req.body?.notes,4000)||null]);res.status(201).json({item:q.rows[0]});}catch(e){res.status(500).json({error:'calendar_create_failed'});}});

  r.get('/documents',async(req,res)=>{try{const t=await tenantFor(req),q=await pool.query(`SELECT * FROM business_documents WHERE tenant_id=$1 ORDER BY updated_at DESC LIMIT 250`,[t]);res.json({items:q.rows});}catch(e){res.status(500).json({error:'documents_failed'});}});
  r.post('/documents',async(req,res)=>{const title=bodyText(req.body?.title,180);if(!title)return res.status(400).json({error:'title_required'});try{const t=await tenantFor(req),q=await pool.query(`INSERT INTO business_documents(tenant_id,title,document_type,status,client_id,storage_ref,metadata) VALUES($1,$2,$3,'draft',$4,$5,$6::jsonb) RETURNING *`,[t,title,bodyText(req.body?.documentType,80)||'other',req.body?.clientId||null,bodyText(req.body?.storageRef,500)||null,JSON.stringify(req.body?.metadata||{})]);res.status(201).json({item:q.rows[0]});}catch(e){res.status(500).json({error:'document_create_failed'});}});

  return r;
};
