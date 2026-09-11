(() => {
  const nav = document.querySelector('#nav');
  const label = document.createElement('div'); label.className='section-label'; label.textContent='Services clients'; nav.appendChild(label);
  const button = document.createElement('button'); button.dataset.page='jobfactory'; button.innerHTML='<span>◫</span>Job Search Factory'; button.addEventListener('click', renderJobFactory); nav.appendChild(button);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const csv=s=>String(s||'').split(',').map(x=>x.trim()).filter(Boolean);

  async function renderJobFactory(){
    document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='jobfactory'));
    document.querySelector('#pageTitle').textContent='Job Search Factory';
    document.querySelector('#content').innerHTML=`
      <section class="agent-hero"><div class="card agent-title"><p class="eyebrow">SERVICE CLIENT • CELLULE MULTI-AGENTS</p><h2>Job Search Factory</h2><p>Chaque client reçoit une cellule isolée. Mission Supervisor pilote Job Scout, CV Tailor, Application Agent, Inbox Watcher et Interview Agent. Le système travaille en silence et remonte surtout lorsqu’un entretien, un test ou une décision humaine est détecté.</p><div class="agent-badges"><span class="pill">Mission Supervisor</span><span class="pill">Job Scout</span><span class="pill">CV Tailor</span><span class="pill">Application Agent</span><span class="pill">Inbox Watcher</span><span class="pill">Interview Agent</span></div></div><div class="card agent-stat"><div class="mini"><strong>50K</strong><span>FCFA / offre type</span></div><div class="mini"><strong>A2</strong><span>Autonomie opérationnelle</span></div><div class="mini"><strong>OAuth</strong><span>E-mail sans mot de passe</span></div><div class="mini"><strong>A3</strong><span>Entretien / décision sensible</span></div></div></section>
      <div class="grid dashboard-grid">
        <section class="card"><p class="eyebrow">NOUVEAU CLIENT</p><h3>Créer une cellule Job Search</h3>
          <form id="jobOnboarding" class="job-form">
            <input name="clientName" required maxlength="160" placeholder="Nom du client" />
            <input name="clientEmail" required type="email" maxlength="255" placeholder="Adresse e-mail du client" />
            <input name="targetRoles" required placeholder="Postes ciblés, séparés par des virgules" />
            <input name="locations" required placeholder="Zones ciblées : Paris, Île-de-France…" />
            <input name="contractTypes" placeholder="Alternance, CDI, CDD…" />
            <textarea name="constraints" rows="3" placeholder="Contraintes ou consignes particulières"></textarea>
            <div class="job-form-actions"><span id="jobFormStatus">La connexion e-mail OAuth se fait après création.</span><button type="submit">Créer la cellule ↗</button></div>
          </form>
        </section>
        <section class="card"><p class="eyebrow">RÈGLE D’EXPLOITATION</p><h3>Une équipe par client</h3><div class="list"><div>Isolation stricte tenant + mission</div><div>Aucun mot de passe e-mail stocké</div><div>CV adaptés sans inventer d’expérience</div><div>Candidatures journalisées avec preuve</div><div>Remontée entretien / test / offre</div></div></section>
      </div>
      <section class="card" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><p class="eyebrow">MISSIONS</p><h3 style="margin:0">Cellules clients</h3></div><button class="ghost" id="refreshJobs">Actualiser</button></div><div id="jobMissions" style="margin-top:14px"><p style="color:var(--muted)">Chargement…</p></div></section>
      <div class="grid agent-grid" style="margin-top:16px">
        ${agent('1. Mission Supervisor','A2','Coordonne toute la mission, surveille les blocages et décide quel agent travaille ensuite.')}
        ${agent('2. Job Scout','A1','Recherche et score les offres récentes correspondant aux critères du client.')}
        ${agent('3. CV Tailor','A1','Produit une version ATS adaptée à chaque offre, sans inventer de compétences.')}
        ${agent('4. Application Agent','A2','Soumet ou prépare la candidature sur les canaux autorisés et conserve la preuve.')}
        ${agent('5. Inbox Watcher','A2','Surveille uniquement le périmètre e-mail consenti et classe réponses, refus, tests et entretiens.')}
        ${agent('6. Interview Agent','A3','Prépare le candidat et déclenche la remontée humaine lorsqu’un entretien ou une décision importante arrive.')}
      </div>`;
    wireForm(); loadMissions();
  }
  function agent(title,perm,text){return `<article class="card agent-card"><h3>${title}<span class="perm">${perm}</span></h3><p>${text}</p></article>`}
  function wireForm(){
    const form=document.querySelector('#jobOnboarding'); const status=document.querySelector('#jobFormStatus');
    form.addEventListener('submit',async e=>{e.preventDefault();status.textContent='Création de la cellule…';const fd=new FormData(form);const payload={clientName:fd.get('clientName'),clientEmail:fd.get('clientEmail'),targetRoles:csv(fd.get('targetRoles')),locations:csv(fd.get('locations')),contractTypes:csv(fd.get('contractTypes')),constraints:{notes:String(fd.get('constraints')||'').slice(0,2000)}};try{const out=await window.HIOSAuth.api('/api/admin/job-missions',{method:'POST',body:JSON.stringify(payload)});status.textContent=`Cellule créée : ${out.missionId}`;form.reset();await loadMissions();}catch(err){status.textContent=`Erreur : ${err.message}`;}});
    document.querySelector('#refreshJobs').onclick=loadMissions;
  }
  async function loadMissions(){
    const box=document.querySelector('#jobMissions'); if(!box)return;
    try{const data=await window.HIOSAuth.api('/api/admin/job-missions');const items=data.items||[];box.innerHTML=items.length?`<table class="table"><thead><tr><th>Client</th><th>Mission</th><th>Statut</th><th>Opportunités</th><th>Candidatures</th><th>Action</th></tr></thead><tbody>${items.map(m=>`<tr><td><strong>${esc(m.client_name)}</strong><br><small>${esc(m.client_email)}</small></td><td>${esc(m.title)}</td><td><span class="status">${esc(m.status)}</span></td><td>${esc(m.opportunities)}</td><td>${esc(m.applications)}</td><td>${m.status==='onboarding'?`<button class="job-activate" data-id="${esc(m.id)}">Activer</button>`:`<button class="ghost job-open" data-id="${esc(m.id)}">Voir</button>`}</td></tr>`).join('')}</tbody></table>`:'<p style="color:var(--muted)">Aucune cellule créée pour le moment.</p>';
      box.querySelectorAll('.job-activate').forEach(b=>b.onclick=async()=>{b.disabled=true;try{await window.HIOSAuth.api(`/api/admin/job-missions/${b.dataset.id}/activate`,{method:'POST',body:'{}'});await loadMissions();}catch(e){b.disabled=false;alert(e.message);}});
      box.querySelectorAll('.job-open').forEach(b=>b.onclick=()=>openMission(b.dataset.id));
    }catch(err){box.innerHTML=`<p style="color:#ff8a8a">Impossible de charger les missions : ${esc(err.message)}</p>`;}
  }
  async function openMission(id){
    try{const data=await window.HIOSAuth.api(`/api/admin/job-missions/${encodeURIComponent(id)}`);const m=data.mission;const box=document.querySelector('#jobMissions');box.innerHTML=`<div class="list"><div><strong>${esc(m.client_name)}</strong> — ${esc(m.client_email)}</div><div>Cibles : ${esc((m.target_roles||[]).join(', '))}</div><div>Zones : ${esc((m.locations||[]).join(', '))}</div><div>Statut : ${esc(m.status)}</div><div>Opportunités : ${data.opportunities.length} • Candidatures : ${data.applications.length} • Exécutions agents : ${data.agentRuns.length}</div></div><div style="margin-top:12px"><button id="backJobs" class="ghost">← Retour</button> <button id="connectGmail">Connecter Gmail OAuth</button></div>`;document.querySelector('#backJobs').onclick=loadMissions;document.querySelector('#connectGmail').onclick=()=>connectGmail(id);}catch(e){alert(e.message);}
  }
  async function connectGmail(id){try{const out=await window.HIOSAuth.api(`/api/admin/integrations/google/start?missionId=${encodeURIComponent(id)}`,{headers:{}});location.href=out.url;}catch(e){alert(e.message==='google_oauth_not_configured'?'Google OAuth doit encore être configuré côté serveur.':e.message);}}
})();
