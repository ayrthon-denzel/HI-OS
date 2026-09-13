(() => {
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(path,opts={}){return window.HIOSAuth.api(path,opts);}
  const icons={
    search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    arrow:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    users:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2M16 4a4 4 0 0 1 0 8M18 13a6 6 0 0 1 4 5.5V21"/></svg>',
    monitor:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    pen:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="m14 7 3 3"/></svg>',
    chart:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    mail:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
    spark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.6 4.2L18 9l-4.4 1.8L12 15l-1.6-4.2L6 9l4.4-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>',
    bot:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="12" rx="5"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6"/></svg>',
    check:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>',
    target:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M16 8 21 3M17 3h4v4"/></svg>',
    shield:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-5"/></svg>',
    database:'<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
    gmail:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>'
  };

  async function refreshDashboard(){
    try{
      const [d,health]=await Promise.all([api('/api/admin/dashboard'),fetch('/api/bootstrap-status',{credentials:'same-origin'}).then(r=>r.json()).catch(()=>({}))]);
      if($('#pageTitle')?.textContent!=='Accueil')return;
      const db=Boolean(health.database),gmail=Boolean(health.gmailConfigured),ai=Boolean(health.aiConfigured),iso=health.tenantIsolation===true;
      $('#content').innerHTML=`
      <section class="home-layout">
        <div class="home-main">
          <form class="home-search" id="homeSearch"><span class="search-icon">${icons.search}</span><input id="homeSearchInput" aria-label="Demande rapide" placeholder="Que veux-tu faire aujourd’hui ?" /><button type="submit">Demander</button></form>

          <section class="welcome-hero branded-hero">
            <div class="hero-image" aria-hidden="true"></div>
            <div class="hero-overlay" aria-hidden="true"></div>
            <div class="welcome-copy"><p class="eyebrow">HI OS • PAR HI MARKETING</p><h2>Tout ton business<br><span>au même endroit.</span></h2><p>Clients, prospection, contenus, projets et automatisations. Tu choisis l’objectif, HI OS te montre le chemin.</p><div class="hero-actions"><button data-open-assistant>${icons.spark}<span>Démarrer une tâche</span></button><button class="ghost" data-service-page="crm">Voir mes clients</button></div></div>
            <div class="hero-brand-card"><img src="./assets/hi-marketing-official.jpg?v=1.1.0" alt="HI MARKETING" /><div><strong>HI MARKETING</strong><span>Digital • Software • Growth</span></div></div>
          </section>

          <section class="quick-section"><div class="home-section-head"><div><h3>Actions rapides</h3><p>Les raccourcis les plus utiles pour faire avancer HI MARKETING.</p></div></div><div class="action-grid">
            ${action('clients',icons.users,'Trouver des clients','Prospection & leads','hunter')}
            ${action('website',icons.monitor,'Créer un site web','Vitrine ou e-commerce','web')}
            ${action('content',icons.pen,'Créer un contenu','Affiches, vidéos, visuels','designer')}
            ${action('projects',icons.chart,'Gérer mes projets','Suivi et tâches','web')}
            ${action('job',icons.mail,'Rechercher un emploi','Candidatures optimisées','jobfactory')}
            ${action('ai',icons.spark,'Utiliser l’IA','Assistants spécialisés','automation')}
          </div></section>

          <section class="home-bottom-grid">
            <article class="home-panel"><div class="home-section-head"><div><h3>Mon activité</h3><p>Les données réelles du système.</p></div></div><div class="activity-summary">${metric('Clients actifs',d.clients)}${metric('Missions actives',d.missions)}${metric('Candidatures',d.applications)}${metric('Entretiens',d.interviews)}</div></article>
            <article class="home-panel"><div class="home-section-head"><div><h3>État du système</h3><p>Tout ce qui tourne derrière HI OS.</p></div></div><div class="health-list">${healthRow(icons.database,'Base de données',db,db?'Connectée':'À vérifier')}${healthRow(icons.gmail,'Gmail',gmail,gmail?'Connecté':'À configurer')}${healthRow(icons.spark,'IA',ai,ai?'Clé configurée':'Paiement API en attente')}${healthRow(icons.shield,'Sécurité',iso,iso?'Isolation active':'À vérifier')}</div></article>
          </section>
        </div>

        <aside class="home-assistant">
          <div class="assistant-card"><div class="assistant-title"><div class="assistant-face">${icons.bot}</div><div><h3>HI Assistant</h3><span>● En ligne</span></div></div><p><strong>Bonjour A-D.</strong><br>Je peux t’emmener directement vers la bonne action sans fouiller les menus.</p><div class="assistant-list"><button data-command="Trouve de nouveaux clients qualifiés pour HI MARKETING.">${icons.check}<span>Trouver des clients</span></button><button data-command="Prépare le contenu de la semaine pour HI MARKETING.">${icons.check}<span>Créer du contenu</span></button><button data-command="Rédige les emails prioritaires du jour.">${icons.check}<span>Rédiger des emails</span></button><button data-command="Analyse les opportunités et dis-moi lesquelles prioriser.">${icons.check}<span>Analyser les opportunités</span></button><button data-command="Organise les tâches prioritaires du jour.">${icons.check}<span>Organiser ma journée</span></button></div><button class="assistant-primary" data-open-assistant>${icons.spark}<span>Demander maintenant</span></button></div>
          <div class="assistant-mini"><span class="mini-icon">${icons.target}</span><div><strong>${d.interviews}</strong><small>attention(s) importante(s)</small></div></div>
          <button class="assistant-validation" id="homeApprovals">Validations en attente <b>${esc($('#approvalCount')?.textContent||'0')}</b></button>
        </aside>
      </section>`;
      bindHome();
    }catch(e){console.warn('dashboard unavailable',e.message);}
  }

  function action(cls,icon,title,sub,page){return `<button class="action-card ${cls}" data-service-page="${esc(page)}"><span class="action-icon">${icon}</span><span class="action-copy"><strong>${esc(title)}</strong><small>${esc(sub)}</small></span><b class="action-arrow">${icons.arrow}</b></button>`;}
  function metric(label,val){return `<div class="metric-tile"><strong>${esc(val)}</strong><span>${esc(label)}</span></div>`;}
  function healthRow(icon,label,ok,text){return `<div class="health-line"><span class="health-icon">${icon}</span><span><strong>${esc(label)}</strong><small>${esc(text)}</small></span><i class="${ok?'ok':'warn'}"></i></div>`;}

  function bindHome(){
    document.querySelectorAll('[data-service-page]').forEach(b=>b.onclick=()=>document.querySelector(`.nav button[data-page="${b.dataset.servicePage}"]`)?.click());
    document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>openCommand(b.dataset.command));
    document.querySelectorAll('[data-open-assistant]').forEach(b=>b.addEventListener('click',()=>$('#toggleCopilot')?.click()));
    $('#homeApprovals')?.addEventListener('click',()=>$('#openApprovals')?.click());
    $('#homeSearch')?.addEventListener('submit',e=>{e.preventDefault();const v=$('#homeSearchInput')?.value.trim();if(v)openCommand(v);});
  }
  function openCommand(text){const i=$('#chatInput');if(!i)return;i.value=text;$('#toggleCopilot')?.click();setTimeout(()=>i.focus(),50);}

  async function loadApprovals(){const list=$('#approvalList'),badge=$('#approvalCount');try{const data=await api('/api/admin/approvals'),items=data.items||[];badge.textContent=items.length;list.innerHTML=items.length?items.map(x=>`<article data-approval="${esc(x.id)}"><div><strong>${esc(x.action_type)}</strong><span>${new Date(x.requested_at).toLocaleString('fr-FR')}</span></div><p>${esc(JSON.stringify(x.payload))}</p><div><button class="ghost" data-decision="reject">Refuser</button><button data-decision="approve">Valider</button></div></article>`).join(''):'<p style="color:#8e98a5">Aucune validation A3 en attente.</p>';list.querySelectorAll('[data-decision]').forEach(btn=>btn.onclick=async()=>{const card=btn.closest('[data-approval]');await api(`/api/admin/approvals/${card.dataset.approval}/${btn.dataset.decision}`,{method:'POST',body:'{}'});await loadApprovals();refreshDashboard();});}catch{list.innerHTML='<p style="color:#8e98a5">Validations indisponibles.</p>';}}

  function wireCommand(){const form=$('#chatForm'),input=$('#chatInput'),messages=$('#messages');if(!form||form.dataset.live==='1')return;form.dataset.live='1';form.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();const text=input.value.trim();if(!text)return;add('user',esc(text));input.value='';add('agent','Je m’en occupe…');const pending=messages.lastElementChild;try{const out=await api('/api/orchestrate',{method:'POST',body:JSON.stringify({command:text})});const actions=(out.actions||[]).slice(0,5).map(a=>`<li>${esc(typeof a==='string'?a:(a.action||a.name||JSON.stringify(a)))}</li>`).join('');pending.innerHTML=`<strong>${esc(out.summary||'Mission prise en charge.')}</strong>${actions?`<ul class="orchestrator-actions">${actions}</ul>`:''}<small class="orchestrator-mode">${esc(out.mode==='ai-orchestrated'?'IA':'Routage sécurisé')} • validation requise pour les actions sensibles</small>`;}catch(err){pending.textContent=`Je ne peux pas exécuter cette demande maintenant : ${err.message}`;}},true);function add(type,html){const d=document.createElement('div');d.className=`msg ${type}`;d.innerHTML=html;messages.appendChild(d);messages.scrollTop=messages.scrollHeight;}}

  document.addEventListener('hios:authenticated',()=>{wireCommand();refreshDashboard();loadApprovals();});
  document.addEventListener('hios:command-view',refreshDashboard);
  $('#openApprovals')?.addEventListener('click',loadApprovals,true);
})();