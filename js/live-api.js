(() => {
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(path,opts={}){return window.HIOSAuth.api(path,opts);}

  async function refreshDashboard(){
    try{
      const [d,health]=await Promise.all([api('/api/admin/dashboard'),fetch('/api/bootstrap-status',{credentials:'same-origin'}).then(r=>r.json()).catch(()=>({}))]);
      if($('#pageTitle')?.textContent!=='Command Center')return;
      const db=Boolean(health.database),gmail=Boolean(health.gmailConfigured),ai=Boolean(health.aiConfigured),iso=health.tenantIsolation===true;
      $('#content').innerHTML=`
      <section class="command-hero">
        <div class="command-hero-copy"><p class="eyebrow">HI MARKETING • OPERATING SYSTEM</p><h2>Ton agence.<br><span>Sous contrôle.</span></h2><p>Un cockpit unique pour piloter acquisition, création, opérations, production et services clients. Les agents exécutent en A0–A2 ; HI OS ne te remonte que les décisions qui comptent.</p><div class="command-hero-actions"><button data-command="Analyse toutes les opérations HI MARKETING et exécute les priorités A0–A2 du jour.">Lancer la journée ↗</button><button class="ghost" data-page-target="jobfactory">Ouvrir Job Search Factory</button></div></div>
        <div class="command-hero-status"><div class="brand-seal"><span>HI</span><small>OS</small></div><div class="system-state"><i></i><div><strong>${db&&gmail&&ai&&iso?'Stack opérationnelle':'Stack à vérifier'}</strong><span>v${esc(health.version||'0.5')} • sécurité stricte</span></div></div></div>
      </section>
      <section class="system-ribbon" aria-label="État de l'infrastructure">${chip('Database',db,db?'PostgreSQL connecté':'Connexion requise')}${chip('Gmail OAuth',gmail,gmail?'OAuth disponible':'Configuration requise')}${chip('AI Engine',ai,ai?'OpenAI opérationnel':'Clé API requise')}${chip('Isolation',iso,iso?'Tenant strict':'À vérifier')}</section>
      <div class="grid kpis premium-kpis">${kpi('Clients actifs',d.clients,'Données réelles')}${kpi('Missions actives',d.missions,'Cellules en production')}${kpi('Candidatures',d.applications,'Pipeline réel')}${kpi('Entretiens',d.interviews,'Escalade CEO')}</div>
      <div class="grid dashboard-grid"><section class="card operations-card"><div class="section-head"><div><p class="eyebrow">LIVE OPERATIONS</p><h3>État du système</h3></div><span class="live-chip">● LIVE</span></div><div class="activity">${row('◈','HI Orchestrator',ai?'IA connectée et routage multi-agents':'Routage de secours actif',ai?'AI MODE':'POLICY MODE')}${row('◫','Job Search Factory',`${d.missions} mission(s) active(s)`,'Supervision mission')}${row('⚙','Agent Engine',`${d.agentRuns} exécution(s) sur 24 h`,'Audit trail')}${row('◇','Security Layer','Isolation, chiffrement et contrôle A3','STRICT')}</div></section><section class="card ceo-card"><p class="eyebrow">CEO CONTROL</p><h3>Attention requise</h3><div class="ceo-number">${esc(d.interviews)}</div><p class="ceo-label">événement(s) entretien / priorité</p><div class="list"><div>A3 : toujours bloqué avant validation</div><div>Gmail : surveillance mission-scoped</div><div>CV : stockage chiffré</div><div>Actions : journalisées</div></div></section></div>
      <section class="service-strip">${service('◎','Contract Hunter','Prospection & acquisition','hunter')}${service('✦','Master Designer','Création & marque','designer')}${service('▦','CRM & Sales','Pipeline & closing','crm')}${service('◫','Job Search','Missions clients','jobfactory')}</section>`;
      bindHero();
    }catch(e){console.warn('dashboard unavailable',e.message);}
  }
  function chip(label,ok,detail){return `<article class="health-chip ${ok?'ok':'warn'}"><span class="health-dot"></span><div><strong>${esc(label)}</strong><small>${esc(detail)}</small></div></article>`}
  function service(icon,title,sub,page){return `<button class="service-tile" data-service-page="${esc(page)}"><span class="service-icon">${icon}</span><span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span><b>↗</b></button>`}
  function kpi(label,val,small){return `<article class="card kpi"><span>${esc(label)}</span><strong>${esc(val)}</strong><small>${esc(small)}</small></article>`}
  function row(icon,name,text,status){return `<div class="activity-row"><div class="icon">${icon}</div><div><p><strong>${esc(name)}</strong> — ${esc(text)}</p><span>${esc(status)}</span></div></div>`}
  function bindHero(){
    document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>{const i=$('#chatInput');if(i){i.value=b.dataset.command;$('#toggleCopilot')?.click();i.focus();}});
    document.querySelectorAll('[data-page-target],[data-service-page]').forEach(b=>b.onclick=()=>document.querySelector(`.nav button[data-page="${b.dataset.pageTarget||b.dataset.servicePage}"]`)?.click());
  }

  async function loadApprovals(){const list=$('#approvalList'),badge=$('#approvalCount');try{const data=await api('/api/admin/approvals'),items=data.items||[];badge.textContent=items.length;list.innerHTML=items.length?items.map(x=>`<article data-approval="${esc(x.id)}"><div><strong>${esc(x.action_type)}</strong><span>${new Date(x.requested_at).toLocaleString('fr-FR')}</span></div><p>${esc(JSON.stringify(x.payload))}</p><div><button class="ghost" data-decision="reject">Refuser</button><button data-decision="approve">Valider</button></div></article>`).join(''):'<p style="color:#8e98a5">Aucune validation A3 en attente.</p>';list.querySelectorAll('[data-decision]').forEach(btn=>btn.onclick=async()=>{const card=btn.closest('[data-approval]');await api(`/api/admin/approvals/${card.dataset.approval}/${btn.dataset.decision}`,{method:'POST',body:'{}'});await loadApprovals();refreshDashboard();});}catch{list.innerHTML='<p style="color:#8e98a5">Validations indisponibles.</p>';}}

  function wireCommand(){const form=$('#chatForm'),input=$('#chatInput'),messages=$('#messages');if(!form||form.dataset.live==='1')return;form.dataset.live='1';form.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();const text=input.value.trim();if(!text)return;add('user',esc(text));input.value='';add('agent','Analyse et routage en cours…');const pending=messages.lastElementChild;try{const out=await api('/api/orchestrate',{method:'POST',body:JSON.stringify({command:text})});const routes=(out.route||[]).map(r=>`<span>${esc(r)}</span>`).join('');const actions=(out.actions||[]).slice(0,5).map(a=>`<li>${esc(typeof a==='string'?a:(a.action||a.name||JSON.stringify(a)))}</li>`).join('');pending.innerHTML=`<strong>${esc(out.summary||'Mission prise en charge.')}</strong>${routes?`<div class="route">${routes}</div>`:''}${actions?`<ul class="orchestrator-actions">${actions}</ul>`:''}<small class="orchestrator-mode">${esc(out.mode==='ai-orchestrated'?'AI ORCHESTRATED':'POLICY ROUTED')} • A3 sous validation</small>`;}catch(err){pending.textContent=`Mission non exécutée : ${err.message}`;}},true);function add(type,html){const d=document.createElement('div');d.className=`msg ${type}`;d.innerHTML=html;messages.appendChild(d);messages.scrollTop=messages.scrollHeight;}}

  document.addEventListener('hios:authenticated',()=>{wireCommand();refreshDashboard();loadApprovals();});
  document.addEventListener('hios:command-view',refreshDashboard);
  $('#openApprovals')?.addEventListener('click',loadApprovals,true);
})();
