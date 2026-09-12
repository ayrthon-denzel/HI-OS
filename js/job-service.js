(() => {
  const nav=document.querySelector('#nav');
  const label=document.createElement('div');label.className='section-label';label.textContent='Services clients';nav.appendChild(label);
  const button=document.createElement('button');button.dataset.page='jobfactory';button.innerHTML='<span>◫</span>Job Search Factory';button.addEventListener('click',renderJobFactory);nav.appendChild(button);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const csv=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean);
  const oauthMissionKey='hios:oauth:mission';

  function consumeOAuthReturn(){
    const p=new URLSearchParams(location.search);
    if(p.get('oauth')==='connected'){
      sessionStorage.removeItem(oauthMissionKey);
      history.replaceState({},'',location.pathname+location.hash);
    }
  }
  consumeOAuthReturn();

  async function renderJobFactory(){
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='jobfactory'));
    document.querySelector('#pageTitle').textContent='Job Search Factory';
    document.querySelector('#content').innerHTML=`
      <section class="agent-hero">
        <div class="card agent-title"><p class="eyebrow">SERVICE CLIENT • CELLULE MULTI-AGENTS</p><h2>Job Search Factory</h2><p>Chaque client reçoit une cellule isolée. Mission Supervisor pilote Job Scout, CV Tailor, Application Agent, Inbox Watcher et Interview Agent.</p><div class="agent-badges"><span class="pill">Mission Supervisor</span><span class="pill">Job Scout</span><span class="pill">CV Tailor</span><span class="pill">Application Agent</span><span class="pill">Inbox Watcher</span><span class="pill">Interview Agent</span></div></div>
        <div class="card agent-stat"><div class="mini"><strong>50K</strong><span>FCFA / mission type</span></div><div class="mini"><strong>A2</strong><span>Autonomie opérationnelle</span></div><div class="mini"><strong>OAuth</strong><span>E-mail sans mot de passe</span></div><div class="mini"><strong>A3</strong><span>Entretien / décision sensible</span></div></div>
      </section>
      <div class="grid dashboard-grid">
        <section class="card"><p class="eyebrow">NOUVEAU CLIENT</p><h3>Créer une cellule Job Search</h3><form id="jobOnboarding" class="job-form"><input name="clientName" required maxlength="160" placeholder="Nom du client"/><input name="clientEmail" required type="email" maxlength="255" placeholder="Adresse e-mail du client"/><input name="targetRoles" required placeholder="Postes ciblés, séparés par des virgules"/><input name="locations" required placeholder="Zones ciblées : Paris, Île-de-France…"/><input name="contractTypes" placeholder="Alternance, CDI, CDD…"/><textarea name="constraints" rows="3" placeholder="Contraintes ou consignes particulières"></textarea><div class="job-form-actions"><span id="jobFormStatus">Étape 1 : créer la cellule. Ensuite ajouter le CV et connecter Gmail.</span><button type="submit">Créer la cellule ↗</button></div></form></section>
        <section class="card"><p class="eyebrow">RÈGLE D’EXPLOITATION</p><h3>Une équipe par client</h3><div class="list"><div>Isolation stricte tenant + mission</div><div>CV chiffré au repos</div><div>Aucun mot de passe e-mail stocké</div><div>Candidatures journalisées avec preuve</div><div>Remontée entretien / test / offre</div></div></section>
      </div>
      <section class="card" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><p class="eyebrow">MISSIONS</p><h3 style="margin:0">Cellules clients</h3></div><button class="ghost" id="refreshJobs">Actualiser</button></div><div id="jobMissions" style="margin-top:14px"><p style="color:var(--muted)">Chargement…</p></div></section>
      <div class="grid agent-grid" style="margin-top:16px">${agent('1. Mission Supervisor','A2','Coordonne la mission et distribue le travail.')}${agent('2. Job Scout','A1','Recherche et score les offres récentes.')}${agent('3. CV Tailor','A1','Adapte le CV sans inventer d’expérience.')}${agent('4. Application Agent','A2','Prépare et soumet les candidatures autorisées.')}${agent('5. Inbox Watcher','A2','Surveille les réponses liées à la mission.')}${agent('6. Interview Agent','A3','Remonte entretien, test ou offre au CEO/client.')}</div>`;
    wireForm();
    loadMissions();
  }

  function agent(t,p,x){return `<article class="card agent-card"><h3>${t}<span class="perm">${p}</span></h3><p>${x}</p></article>`}
  function fmtDate(v){if(!v)return '—';try{return new Date(v).toLocaleString()}catch{return '—'}}

  function wireForm(){
    const form=document.querySelector('#jobOnboarding'),status=document.querySelector('#jobFormStatus');
    form.addEventListener('submit',async e=>{
      e.preventDefault();status.textContent='Création de la cellule…';
      const fd=new FormData(form),payload={clientName:fd.get('clientName'),clientEmail:fd.get('clientEmail'),targetRoles:csv(fd.get('targetRoles')),locations:csv(fd.get('locations')),contractTypes:csv(fd.get('contractTypes')),constraints:{notes:String(fd.get('constraints')||'').slice(0,2000)}};
      try{const out=await window.HIOSAuth.api('/api/admin/job-missions',{method:'POST',body:JSON.stringify(payload)});status.textContent=`Cellule créée. Ouvre ${out.missionId} pour ajouter le CV.`;form.reset();await loadMissions();}
      catch(err){status.textContent=`Erreur : ${err.message}`;}
    });
    document.querySelector('#refreshJobs').onclick=loadMissions;
  }

  async function loadMissions(){
    const box=document.querySelector('#jobMissions');if(!box)return;
    try{
      const data=await window.HIOSAuth.api('/api/admin/job-missions'),items=data.items||[];
      box.innerHTML=items.length?`<table class="table"><thead><tr><th>Client</th><th>Mission</th><th>Statut</th><th>Opportunités</th><th>Candidatures</th><th></th></tr></thead><tbody>${items.map(m=>`<tr><td><strong>${esc(m.client_name)}</strong><br><small>${esc(m.client_email)}</small></td><td>${esc(m.title)}</td><td><span class="status">${esc(m.status)}</span></td><td>${esc(m.opportunities)}</td><td>${esc(m.applications)}</td><td><button class="ghost job-open" data-id="${esc(m.id)}">Ouvrir</button></td></tr>`).join('')}</tbody></table>`:'<p style="color:var(--muted)">Aucune cellule créée pour le moment.</p>';
      box.querySelectorAll('.job-open').forEach(b=>b.onclick=()=>openMission(b.dataset.id));
    }catch(err){box.innerHTML=`<p style="color:#ff8a8a">Impossible de charger les missions : ${esc(err.message)}</p>`;}
  }

  async function openMission(id){
    try{
      const data=await window.HIOSAuth.api(`/api/admin/job-missions/${encodeURIComponent(id)}`),m=data.mission,hasCv=(data.documents||[]).some(d=>d.document_type==='cv_master');
      const gmail=data.gmail||{connected:false,status:'not_connected',inboxWatcher:{state:'idle'}};
      const gmailOk=Boolean(gmail.connected);
      const missionActive=['active','interview'].includes(m.status);
      const inbox=gmail.inboxWatcher||{};
      const watcherActive=gmailOk&&missionActive&&['success','running','queued'].includes(inbox.state);
      const aiReady=Boolean(data.aiConfigured);
      const gmailLabel=gmailOk?`✓ Connecté${gmail.account?` — ${esc(gmail.account)}`:''}`:`○ ${gmail.status==='error'?'Erreur Gmail':'À connecter'}`;
      const watcherLabel=watcherActive?`● ${inbox.state==='success'?'Actif':esc(inbox.state)}`:(gmailOk?'○ Prêt':'○ En attente');
      const prereq=`<div class="card" style="margin-top:12px;padding:14px"><p class="eyebrow">PRÉREQUIS MISSION</p><div class="list"><div><strong>CV maître</strong> ${hasCv?'✓ Chargé':'○ À charger'}</div><div><strong>Gmail OAuth</strong> ${gmailLabel}</div><div><strong>Mission</strong> ${missionActive?'✓ '+esc(m.status):'○ '+esc(m.status)}</div><div><strong>Inbox Watcher</strong> ${watcherLabel}</div><div><strong>Job Scout IA</strong> ${aiReady?'✓ Prêt':'○ Clé OpenAI requise'}</div></div>${gmailOk?`<p style="margin:10px 0 0;color:var(--muted)">Scopes : ${esc((gmail.scopes||[]).join(' • '))} • Dernière vérification : ${esc(fmtDate(inbox.lastCheckedAt))}. Les jetons OAuth restent chiffrés côté serveur.</p>`:''}</div>`;
      const latest=inbox.output||{};
      const health=gmailOk?`<div class="card" style="margin-top:12px;padding:14px"><p class="eyebrow">GMAIL / INBOX WATCHER</p><div class="list"><div>Compte : <strong>${esc(gmail.account||m.client_email||'Google connecté')}</strong></div><div>État intégration : <strong>${esc(gmail.status)}</strong></div><div>Dernier contrôle : <strong>${esc(fmtDate(inbox.lastCheckedAt))}</strong></div><div>Messages lus : <strong>${esc(latest.messages??'—')}</strong> • Critiques : <strong>${esc(latest.critical??'—')}</strong> • Rejets : <strong>${esc(latest.rejections??'—')}</strong></div><div>Validations A3 en attente : <strong>${esc(data.pendingApprovals??0)}</strong></div></div></div>`:'';
      const box=document.querySelector('#jobMissions');
      box.innerHTML=`<div class="list"><div><strong>${esc(m.client_name)}</strong> — ${esc(m.client_email)}</div><div>Cibles : ${esc((m.target_roles||[]).join(', '))}</div><div>Zones : ${esc((m.locations||[]).join(', '))}</div><div>Statut : ${esc(m.status)}</div><div>CV maître : ${hasCv?'✓ chargé':'non chargé'}</div><div>Opportunités : ${data.opportunities.length} • Candidatures : ${data.applications.length} • Runs agents : ${data.agentRuns.length}</div></div>${prereq}${health}<div class="card" style="margin-top:12px;padding:14px"><p class="eyebrow">CV MAÎTRE</p><form id="cvUpload" class="job-form"><input type="file" name="cv" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required/><div class="job-form-actions"><span id="cvStatus">PDF ou DOCX, 6 Mo max. Le texte extrait est chiffré.</span><button type="submit">Charger le CV</button></div></form></div><div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap"><button id="backJobs" class="ghost">← Retour</button><button id="connectGmail">${gmailOk?'Reconnecter Gmail OAuth':'Connecter Gmail OAuth'}</button>${gmailOk?'<button id="testInbox" class="ghost">Tester Inbox Watcher maintenant</button>':''}${m.status==='onboarding'?`<button id="activateMission" ${(!hasCv||!gmailOk)?'disabled title="CV et Gmail requis"':''}>Activer la mission</button>`:''}</div>`;
      document.querySelector('#backJobs').onclick=loadMissions;
      document.querySelector('#connectGmail').onclick=()=>connectGmail(id);
      const upload=document.querySelector('#cvUpload');upload.onsubmit=e=>uploadCv(e,id);
      const test=document.querySelector('#testInbox');if(test)test.onclick=()=>testInbox(id);
      const activate=document.querySelector('#activateMission');
      if(activate)activate.onclick=async()=>{
        if(!hasCv||!gmailOk)return alert('Charge le CV et connecte Gmail avant activation.');
        try{await window.HIOSAuth.api(`/api/admin/job-missions/${id}/activate`,{method:'POST',body:'{}'});await openMission(id);}
        catch(e){alert(e.message==='cv_required'?'Charge d’abord le CV maître.':e.message==='gmail_required'?'Connecte Gmail avant activation.':e.message);}
      };
    }catch(e){alert(e.message);}
  }

  async function uploadCv(e,id){
    e.preventDefault();const form=e.currentTarget,fd=new FormData(form),status=document.querySelector('#cvStatus');status.textContent='Analyse et chiffrement du CV…';
    try{const res=await fetch(`/api/admin/job-missions/${encodeURIComponent(id)}/cv`,{method:'POST',body:fd,credentials:'same-origin'});const out=await res.json();if(!res.ok)throw new Error(out.error||'upload_failed');status.textContent=`CV sécurisé : ${out.chars} caractères extraits.`;await openMission(id);}
    catch(err){status.textContent=`Erreur : ${err.message}`;}
  }

  async function connectGmail(id){
    try{sessionStorage.setItem(oauthMissionKey,id);const out=await window.HIOSAuth.api(`/api/admin/integrations/google/start?missionId=${encodeURIComponent(id)}`,{headers:{}});location.href=out.url;}
    catch(e){sessionStorage.removeItem(oauthMissionKey);alert(e.message==='google_oauth_not_configured'?'Google OAuth doit encore être configuré côté serveur.':e.message);}
  }

  async function testInbox(id){
    const btn=document.querySelector('#testInbox');if(btn){btn.disabled=true;btn.textContent='Test en file…';}
    try{
      await window.HIOSAuth.api(`/api/admin/job-missions/${encodeURIComponent(id)}/inbox-test`,{method:'POST',body:'{}'});
      let attempts=0;
      const poll=async()=>{
        attempts++;
        const data=await window.HIOSAuth.api(`/api/admin/job-missions/${encodeURIComponent(id)}`);
        const state=data.gmail?.inboxWatcher?.state;
        if(['success','failed','blocked'].includes(state)||attempts>=8){await openMission(id);return;}
        setTimeout(poll,5000);
      };
      setTimeout(poll,3000);
    }catch(e){if(btn){btn.disabled=false;btn.textContent='Tester Inbox Watcher maintenant';}alert(e.message==='gmail_required'?'Gmail doit être connecté.':e.message);}
  }
})();
