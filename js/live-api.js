(() => {
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(path,opts={}){return window.HIOSAuth.api(path,opts);}

  async function refreshDashboard(){
    try{
      const [d,health]=await Promise.all([api('/api/admin/dashboard'),fetch('/api/bootstrap-status',{credentials:'same-origin'}).then(r=>r.json()).catch(()=>({}))]);
      if($('#pageTitle')?.textContent!=='Accueil')return;
      const db=Boolean(health.database),gmail=Boolean(health.gmailConfigured),ai=Boolean(health.aiConfigured),iso=health.tenantIsolation===true;
      $('#content').innerHTML=`
      <section class="home-layout">
        <div class="home-main">
          <form class="home-search" id="homeSearch"><span>⌕</span><input id="homeSearchInput" aria-label="Demande rapide" placeholder="Que veux-tu faire aujourd’hui ?" /><button type="submit">Demander</button></form>
          <section class="welcome-hero">
            <div class="welcome-copy"><p class="eyebrow">BIENVENUE SUR HI OS</p><h2>Tout ton business<br><span>au même endroit.</span></h2><p>Simple. Puissant. Efficace. Tu dis ce que tu veux faire, HI OS t’emmène au bon endroit.</p></div>
            <div class="welcome-brand"><img src="./assets/brand-banner.jpg?v=1.1.0" alt="HI MARKETING" /><div><strong>HI MARKETING</strong><small>Digital • Software • Growth</small></div></div>
          </section>

          <section class="quick-section"><div class="home-section-head"><div><h3>Que veux-tu faire aujourd’hui ?</h3><p>Une action = un clic.</p></div></div><div class="action-grid">
            ${action('clients','♙','Trouver des clients','Prospection & leads','hunter')}
            ${action('website','▣','Créer un site web','Vitrine ou e-commerce','web')}
            ${action('content','✎','Créer un contenu','Affiches, vidéos, visuels','designer')}
            ${action('projects','▥','Gérer mes projets','Suivi et tâches','web')}
            ${action('job','✉','Rechercher un emploi','Candidatures optimisées','jobfactory')}
            ${action('ai','✦','Utiliser l’IA','Assistants spécialisés','automation')}
          </div></section>

          <section class="home-bottom-grid">
            <article class="home-panel"><div class="home-section-head"><div><h3>Mon activité</h3><p>Données réelles de HI OS</p></div></div><div class="activity-summary">${metric('Clients actifs',d.clients)}${metric('Missions actives',d.missions)}${metric('Candidatures',d.applications)}${metric('Entretiens',d.interviews)}</div></article>
            <article class="home-panel"><div class="home-section-head"><div><h3>État du système</h3><p>Ce qui fonctionne maintenant</p></div></div><div class="health-list">${healthRow('Base de données',db,db?'Connectée':'À vérifier')}${healthRow('Gmail',gmail,gmail?'Connecté':'À configurer')}${healthRow('IA',ai,ai?'Clé configurée':'Paiement API en attente')}${healthRow('Sécurité',iso,iso?'Isolation active':'À vérifier')}</div></article>
          </section>
        </div>

        <aside class="home-assistant">
          <div class="assistant-card"><div class="assistant-title"><div class="assistant-face">✦</div><div><h3>HI Assistant</h3><span>● En ligne</span></div></div><p><strong>Bonjour A-D.</strong><br>Dis-moi simplement ce que tu veux obtenir.</p><div class="assistant-list"><button data-command="Trouve de nouveaux clients qualifiés pour HI MARKETING.">✓ Trouver des clients</button><button data-command="Prépare le contenu de la semaine pour HI MARKETING.">✓ Créer du contenu</button><button data-command="Rédige les emails prioritaires du jour.">✓ Rédiger des emails</button><button data-command="Analyse les opportunités et dis-moi lesquelles prioriser.">✓ Analyser les opportunités</button><button data-command="Organise les tâches prioritaires du jour.">✓ Organiser ma journée</button></div><button class="assistant-primary" data-open-assistant>Demander maintenant</button></div>
          <div class="assistant-mini"><span>◉</span><div><strong>${d.interviews}</strong><small>attention(s) importante(s)</small></div></div>
          <button class="assistant-validation" id="homeApprovals">Validations en attente <b>${esc($('#approvalCount')?.textContent||'0')}</b></button>
        </aside>
      </section>`;
      bindHome();
    }catch(e){console.warn('dashboard unavailable',e.message);}
  }

  function action(cls,icon,title,sub,page){return `<button class="action-card ${cls}" data-service-page="${esc(page)}"><span class="action-icon">${icon}</span><span><strong>${esc(title)}</strong><small>${esc(sub)}</small></span><b>→</b></button>`;}
  function metric(label,val){return `<div><strong>${esc(val)}</strong><span>${esc(label)}</span></div>`;}
  function healthRow(label,ok,text){return `<div class="health-line"><i class="${ok?'ok':'warn'}"></i><span><strong>${esc(label)}</strong><small>${esc(text)}</small></span></div>`;}

  function bindHome(){
    document.querySelectorAll('[data-service-page]').forEach(b=>b.onclick=()=>document.querySelector(`.nav button[data-page="${b.dataset.servicePage}"]`)?.click());
    document.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>openCommand(b.dataset.command));
    $('[data-open-assistant]')?.addEventListener('click',()=>$('#toggleCopilot')?.click());
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
