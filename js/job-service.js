(() => {
  const nav = document.querySelector('#nav');
  const label = document.createElement('div');
  label.className = 'section-label';
  label.textContent = 'Services clients';
  nav.appendChild(label);

  const button = document.createElement('button');
  button.dataset.page = 'jobfactory';
  button.innerHTML = '<span>◫</span>Job Search Factory';
  button.addEventListener('click', () => renderJobFactory());
  nav.appendChild(button);

  function renderJobFactory() {
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.page === 'jobfactory'));
    document.querySelector('#pageTitle').textContent = 'Job Search Factory';
    document.querySelector('#content').innerHTML = `
      <section class="agent-hero">
        <div class="card agent-title">
          <p class="eyebrow">SERVICE CLIENT • CELLULE MULTI-AGENTS</p>
          <h2>Job Search Factory</h2>
          <p>Une cellule dédiée est créée pour chaque nouveau client. Le superviseur coordonne recherche d'offres, adaptation du CV, candidatures autorisées, suivi de la boîte mail et escalade uniquement lorsqu'un entretien ou une décision client est nécessaire.</p>
          <div class="agent-badges"><span class="pill">Client Supervisor</span><span class="pill">Job Scout</span><span class="pill">CV Tailor</span><span class="pill">Application Agent</span><span class="pill">Inbox Watcher</span><span class="pill">Interview Agent</span></div>
        </div>
        <div class="card agent-stat">
          <div class="mini"><strong>50K</strong><span>FCFA / mission type</span></div>
          <div class="mini"><strong>1</strong><span>Cellule isolée / client</span></div>
          <div class="mini"><strong>OAuth</strong><span>Accès e-mail sécurisé</span></div>
          <div class="mini"><strong>Entretien</strong><span>Seuil de remontée</span></div>
        </div>
      </section>

      <div class="grid agent-grid">
        <article class="card agent-card"><h3>1. Mission Supervisor <span class="perm">A2</span></h3><p>Propriétaire opérationnel de la mission. Il crée la cellule client, distribue le travail, contrôle les doublons et la conformité, puis maintient l'état global.</p><div class="list"><div>1 superviseur par client</div><div>Contexte et données isolés</div><div>Escalade entretien / choix sensible</div></div></article>
        <article class="card agent-card"><h3>2. Job Scout <span class="perm">A1</span></h3><p>Recherche en continu les offres correspondant au profil, à la zone, au contrat et aux contraintes validées.</p><div class="list"><div>Vérifie fraîcheur et disponibilité</div><div>Score chaque offre</div><div>Élimine doublons et mauvais fits</div></div></article>
        <article class="card agent-card"><h3>3. CV Tailor <span class="perm">A1</span></h3><p>Adapte le CV à chaque offre sans inventer de compétences, génère les variantes ATS et prépare la lettre si nécessaire.</p><div class="list"><div>CV spécifique par offre</div><div>PDF + DOCX</div><div>Traçabilité des modifications</div></div></article>
        <article class="card agent-card"><h3>4. Application Agent <span class="perm">A2</span></h3><p>Soumet les candidatures sur les canaux autorisés ou prépare le dossier lorsqu'une validation est imposée par le canal.</p><div class="list"><div>Email de candidature</div><div>Portails/API autorisés</div><div>Journal candidature + preuve</div></div></article>
        <article class="card agent-card"><h3>5. Inbox Watcher <span class="perm">A2</span></h3><p>Surveille uniquement la boîte ou le périmètre e-mail consenti du client, détecte refus, tests, questions et invitations.</p><div class="list"><div>OAuth — jamais de mot de passe stocké</div><div>Filtrage lié à la mission</div><div>Réponses ordinaires selon règles</div></div></article>
        <article class="card agent-card"><h3>6. Interview Agent <span class="perm">A3</span></h3><p>Dès qu'un entretien, test important ou décision nécessitant le candidat arrive, la cellule arrête le silence et remonte l'information.</p><div class="list"><div>Préparation entretien</div><div>Brief entreprise et poste</div><div>Notification immédiate au client / HI</div></div></article>
      </div>

      <section class="card" style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap"><div><p class="eyebrow">ONBOARDING</p><h3 style="margin:0">Créer une nouvelle cellule client</h3><p style="color:var(--muted);max-width:760px">Nom, CV, cible, zone, type de contrat, date de démarrage et connexion e-mail OAuth. La cellule est ensuite autonome dans le périmètre validé.</p></div><button data-inject="Crée une nouvelle mission Job Search Factory et demande-moi uniquement les informations d'onboarding indispensables.">Nouveau client ↗</button></div>
      </section>`;

    document.querySelectorAll('[data-inject]').forEach(el => el.onclick = () => {
      document.querySelector('#chatInput').value = el.dataset.inject;
      document.querySelector('#chatInput').focus();
    });
  }
})();
