(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

  async function api(path, opts={}) { return window.HIOSAuth.api(path, opts); }

  async function refreshDashboard(){
    try{
      const [d,health]=await Promise.all([
        api('/api/admin/dashboard'),
        fetch('/api/bootstrap-status',{credentials:'same-origin'}).then(r=>r.json()).catch(()=>({}))
      ]);
      if ($('#pageTitle')?.textContent !== 'Command Center') return;
      const gmailReady=Boolean(health.gmailConfigured);
      const aiReady=Boolean(health.aiConfigured);
      const dbReady=Boolean(health.database);
      $('#content').innerHTML = `
        <section class="command-hero">
          <div class="command-hero-copy">
            <p class="eyebrow">HI MARKETING • OPERATING SYSTEM</p>
            <h2>Tout HI MARKETING.<br><span>Une seule commande.</span></h2>
            <p>Prospection, création, ventes, projets, candidatures clients, automatisations et contrôle qualité coordonnés par HI Orchestrator.</p>
            <div class="command-hero-actions">
              <button data-command="Trouve les priorités commerciales de la journée et lance les actions A0–A2 autorisées.">Lancer les priorités ↗</button>
              <button class="ghost" data-page-target="designer">Ouvrir Master Designer</button>
            </div>
          </div>
          <div class="command-hero-status">
            <div class="brand-seal"><span>HI</span><small>OS</small></div>
            <div class="system-state"><i></i><div><strong>Système opérationnel</strong><span>v${esc(health.version||'0.5')} • sécurité stricte</span></div></div>
          </div>
        </section>

        <section class="system-ribbon" aria-label="État de l'infrastructure">
          ${healthChip('Database',dbReady,dbReady?'PostgreSQL connecté':'Connexion requise')}
          ${healthChip('Gmail OAuth',gmailReady,gmailReady?'API configurée':'Configuration requise')}
          ${healthChip('AI Engine',aiReady,aiReady?'OpenAI opérationnel':'Clé API requise')}
          ${healthChip('Isolation',health.tenantIsolation===true,health.tenantIsolation===true?'Tenant strict':'À vérifier')}
        </section>

        <div class="grid kpis premium-kpis">
          ${kpi('Clients actifs',d.clients,'Base sécurisée')}
          ${kpi('Missions actives',d.missions,'Cellules autonomes')}
          ${kpi('Candidatures',d.applications,'Suivi en temps réel')}
          ${kpi('Entretiens',d.interviews,'Escalade CEO')}
        </div>

        <div class="grid dashboard-grid">
          <section class="card operations-card"><div class="section-head"><div><p class="eyebrow">LIVE OPERATIONS</p><h3>Centre des opérations</h3></div><span class="live-chip">● EN LIGNE</span></div><div class="activity">
            ${row('◈','HI Orchestrator','Routage sécurisé et coordination multi-agents','A0 → A3')}
            ${row('◫','Job Search Factory',`${d.missions} mission(s) active(s)`,'Superviseurs dédiés')}
            ${row('⚙','Agent Engine',`${d.agentRuns} exécution(s) sur 24 h`,'Journalisé')}
            ${row('◇','Security Layer','Isolation client, chiffrement et audit','Mode strict')}
          </div></section>
          <section class="card ceo-card"><p class="eyebrow">CEO CONTROL</p><h3>Ce qui nécessite ton attention</h3><div class="ceo-number">${esc(d.interviews)}</div><p class="ceo-label">entretien(s) ou événement(s) prioritaire(s)</p><div class="list"><div>Entretiens et tests importants</div><div>Actions A3 / engagements sensibles</div><div>Incidents sécurité ou intégration</div><div>Décisions commerciales hors règles</div></div></section>
        </div>

        <section class="service-strip">
          ${service('◎','Contract Hunter','Prospection & acquisition','hunter')}
          ${service('✦','Master Designer','Création & réseaux','designer')}
          ${service('▦','CRM & Sales','Pipeline & closing','crm')}
          ${service('◫','Job Search','Missions clients','jobfactory')}
        </section>`;
      bindHeroActions();
    }catch(e){ console.warn('dashboard unavailable',e.message); }
  }

  function healthChip(label,ok,detail){return `<article class="health-chip ${ok?'ok':'warn'}"><span class="health-dot"></span><div><strong>${esc(label)}</strong><small>${esc(detail)}</small></div></article>`}
  function bindHeroActions(){
    document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>{const input=$('#chatInput');if(input){input.value=b.dataset.command;input.focus();}});
    document.querySelectorAll('[data-page-target]').forEach(b=>b.onclick=()=>document.querySelector(`.nav button[data-page="${b.dataset.pageTarget}"]`)?.click());
    document.querySelectorAll('[data-service-page]').forEach(b=>b.onclick=()=>document.querySelector(`.nav button[data-page="${b.dataset.servicePage}"]`)?.click());
  }
  function service(icon,title,sub,page){return `<button class="service-tile" data-service-page="${esc(page)}"><span class="service-icon">${icon}</span><span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span><b>↗</b></button>`}
  function kpi(label,val,small){return `<article class="card kpi"><span>${esc(label)}</span><strong>${esc(val)}</strong><small>${esc(small)}</small></article>`}
  function row(icon,name,text,status){return `<div class="activity-row"><div class="icon">${icon}</div><div><p><strong>${esc(name)}</strong> — ${esc(text)}</p><span>${esc(status)}</span></div></div>`}

  async function loadApprovals(){
    const list=$('#approvalList'), badge=$('#approvalCount');
    try{
      const data=await api('/api/admin/approvals'); const items=data.items||[]; badge.textContent=items.length;
      list.innerHTML=items.length?items.map(x=>`<article data-approval="${esc(x.id)}"><div><strong>${esc(x.action_type)}</strong><span>${new Date(x.requested_at).toLocaleString('fr-FR')}</span></div><p>${esc(JSON.stringify(x.payload))}</p><div><button class="ghost" data-decision="reject">Refuser</button><button data-decision="approve">Valider</button></div></article>`).join(''):'<p style="color:#8e98a5">Aucune validation A3 en attente.</p>';
      list.querySelectorAll('[data-decision]').forEach(btn=>btn.onclick=async()=>{const card=btn.closest('[data-approval]');await api(`/api/admin/approvals/${card.dataset.approval}/${btn.dataset.decision}`,{method:'POST',body:'{}'});await loadApprovals();});
    }catch{ list.innerHTML='<p style="color:#8e98a5">Validations indisponibles.</p>'; }
  }

  function wireCommand(){
    const form=$('#chatForm'), input=$('#chatInput'), messages=$('#messages'); if(!form||form.dataset.live==='1')return; form.dataset.live='1';
    form.addEventListener('submit', async e=>{
      e.preventDefault(); e.stopImmediatePropagation(); const text=input.value.trim(); if(!text)return;
      add('user',esc(text)); input.value=''; add('agent','Exécution en cours…');
      const pending=messages.lastElementChild;
      try{const out=await api('/api/orchestrate',{method:'POST',body:JSON.stringify({command:text})}); pending.innerHTML=`Mission routée vers :<div class="route">${(out.route||[]).map(r=>`<span>${esc(r)}</span>`).join('')}</div><br>Les actions A0–A2 sont exécutables dans leur périmètre. Les actions A3 restent bloquées jusqu’à validation.`;}
      catch(err){pending.textContent=`Mission non exécutée : ${err.message}`;}
    }, true);
    function add(type,html){const d=document.createElement('div');d.className=`msg ${type}`;d.innerHTML=html;messages.appendChild(d);messages.scrollTop=messages.scrollHeight;}
  }

  document.addEventListener('hios:authenticated',()=>{wireCommand();refreshDashboard();loadApprovals();});
  const open=$('#openApprovals'); if(open) open.addEventListener('click',loadApprovals,true);
  document.querySelectorAll('.nav button[data-page="command"]').forEach(b=>b.addEventListener('click',()=>setTimeout(refreshDashboard,0)));
})();
