(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const api = (p, o = {}) => window.HIOSAuth.api(p, o);
  const ask = (t) => window.HIOSAssistant.prepare(t);
  const fmt = (v) =>
    v
      ? new Date(v).toLocaleString("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "—";
  const actions = {
    Clients: ["clientForm", "Ajouter un client"],
    Prospection: ["newDealBtn", "Ajouter un prospect"],
    Projets: ["newProjectBtn", "Créer un projet"],
    Contenus: ["newContentBtn", "Créer un contenu"],
    Calendrier: ["newCalendarBtn", "Ajouter un événement"],
    Documents: ["newDocBtn", "Ajouter un document"],
  };
  const head = (title, desc, primary, secondary = "") =>
    `<section class="workspace-head"><div><p class="eyebrow">HI OS • HI MARKETING</p><h2>${esc(title)}</h2><p>${esc(desc)}</p></div><div class="workspace-head-actions">${secondary ? `<button data-workspace-command="${esc(secondary)}">Assistant</button>` : ""}${actions[title] ? `<button class="primary" data-primary-target="${actions[title][0]}">${actions[title][1]}</button>` : primary ? `<button class="primary" data-workspace-command="${esc(primary)}">Demander à HI Assistant</button>` : ""}</div></section>`;
  const kpis = (items) =>
    `<section class="workspace-kpis">${items.map(([v, l]) => `<div class="workspace-kpi"><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`).join("")}</section>`;
  const empty = (title, text, cmd) =>
    `<div class="workspace-empty"><div><strong>${esc(title)}</strong><p>${esc(text)}</p>${cmd ? `<button data-workspace-command="${esc(cmd)}">Demander à HI Assistant</button>` : ""}</div></div>`;
  const err = (e) =>
    `<div class="workspace-note">${esc(window.HIOSUI.message(e))}</div>`;
  const bindCommands = () => {
    document.querySelectorAll("[data-primary-target]").forEach(
      (b) =>
        (b.onclick = () => {
          const t = document.getElementById(b.dataset.primaryTarget);
          if (t?.tagName === "FORM") {
            t.scrollIntoView({ block: "center" });
            t.querySelector("input").focus();
          } else t?.click();
        }),
    );
    document
      .querySelectorAll("[data-workspace-command]")
      .forEach((b) => (b.onclick = () => ask(b.dataset.workspaceCommand)));
  };
  async function loadAll(paths) {
    const out = {};
    await Promise.all(
      paths.map(async (p) => {
        try {
          out[p] = await api(`/api/workspace/${p}`);
        } catch (e) {
          out[p] = { items: [], error: e.message };
        }
      }),
    );
    return out;
  }
  async function summary() {
    try {
      return await api("/api/workspace/summary");
    } catch {
      return {
        clients: "—",
        deals: "—",
        projects: "—",
        tasks: "—",
        content: "—",
        calendar: "—",
        documents: "—",
      };
    }
  }

  async function render(key, m) {
    const c = $("#content");
    c.innerHTML =
      '<section class="workspace-empty"><div><strong>Chargement…</strong><p>HI OS prépare les données utiles.</p></div></section>';
    try {
      if (key === "crm") return await renderClients(c);
      if (key === "hunter") return await renderDeals(c);
      if (key === "web") return await renderProjects(c);
      if (key === "designer") return await renderContent(c);
      if (key === "automation") return await renderAgents(c);
      if (key === "analytics") return await renderCalendar(c);
      if (key === "proposal") return await renderDocuments(c);
      if (key === "knowledge") return await renderSettings(c);
      c.innerHTML = `<section class="workspace-shell">${head(m.name, m.desc, `${m.name}, aide-moi à démarrer.`)}${empty("Module prêt", "La structure est en place.", `${m.name}, lance la première opération utile.`)}</section>`;
      bindCommands();
    } catch (e) {
      if (c.dataset.view !== key) return;
      c.innerHTML = `<section class="workspace-shell">${head(m.name, m.desc, "Aide-moi à configurer ce module.")}${err(e)}</section>`;
      bindCommands();
    }
  }

  async function renderClients(c) {
    const [s, data] = await Promise.all([
      summary(),
      api("/api/workspace/clients"),
    ]);
    const items = data.items || [];
    if (c.dataset.view !== "crm") return;
    c.innerHTML = `<section class="workspace-shell">${head("Clients", "Retrouvez vos clients, leurs coordonnées et leurs besoins.", "Ajoute un nouveau client à HI OS et prépare sa fiche.", "Montre-moi les clients qui demandent une action aujourd’hui.")}${kpis(
      [
        [s.clients, "Clients actifs"],
        [s.deals, "Opportunités"],
        [s.projects, "Projets"],
        [s.documents, "Documents"],
      ],
    )}<div class="workspace-grid"><article class="workspace-card"><div class="workspace-toolbar"><div><h3>Répertoire clients</h3><p class="sub">${items.length} fiche(s) enregistrée(s).</p></div><input id="clientSearch" placeholder="Rechercher un client…"></div><div class="workspace-list" id="clientList">${items.length ? items.map(clientRow).join("") : empty("Aucun client", "Crée la première fiche client pour démarrer le CRM.", "Crée un nouveau client pour HI MARKETING.")}</div></article><aside class="workspace-card"><h3>Ajouter un client</h3><p class="sub">Une fiche simple, complétable ensuite.</p><form class="workspace-form" id="clientForm"><input name="name" required placeholder="Nom / entreprise"><input name="email" type="email" placeholder="E-mail"><input name="phone" placeholder="Téléphone"><input name="serviceType" placeholder="Service / besoin"><textarea class="full" name="notes" placeholder="Notes"></textarea><button class="full" type="submit">Créer la fiche client</button></form><div id="clientFormStatus"></div></aside></div></section>`;
    bindCommands();
    $("#clientSearch").oninput = (e) => {
      const q = e.target.value.toLowerCase();
      $("#clientList").innerHTML =
        items
          .filter((x) =>
            `${x.name} ${x.email || ""} ${x.phone || ""}`
              .toLowerCase()
              .includes(q),
          )
          .map(clientRow)
          .join("") ||
        empty(
          "Aucun résultat",
          "Aucun client ne correspond à cette recherche.",
          "",
        );
    };
    $("#clientForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget),
        box = $("#clientFormStatus");
      box.innerHTML = "Création…";
      try {
        await api("/api/workspace/clients", {
          method: "POST",
          body: JSON.stringify({
            name: f.get("name"),
            email: f.get("email"),
            phone: f.get("phone"),
            serviceType: f.get("serviceType"),
            metadata: { notes: f.get("notes") },
          }),
        });
        await renderClients(c);
      } catch (x) {
        box.innerHTML = err(x);
      }
    };
  }
  const clientRow = (x) =>
    `<div class="workspace-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.email || "Sans e-mail")}${x.phone ? ` • ${esc(x.phone)}` : ""}${x.service_type ? ` • ${esc(x.service_type)}` : ""}</small></div><span class="tag">${esc(x.status || "active")}</span></div>`;

  async function renderDeals(c) {
    const [s, data, clients] = await Promise.all([
      summary(),
      api("/api/workspace/deals"),
      api("/api/workspace/clients"),
    ]);
    const items = data.items || [],
      cs = clients.items || [],
      stages = [
        ["new", "Nouveaux"],
        ["qualified", "Qualifiés"],
        ["contacted", "Contactés"],
        ["replied", "Réponses"],
        ["meeting", "RDV"],
        ["proposal", "Propositions"],
        ["won", "Gagnés"],
        ["lost", "Perdus"],
      ];
    if (c.dataset.view !== "hunter") return;
    c.innerHTML = `<section class="workspace-shell">${head("Prospection", "Retrouvez vos prospects, leurs réponses et les prochaines relances.", "Trouve 10 prospects qualifiés pour HI MARKETING et prépare les approches.", "Analyse ma prospection et dis-moi quoi prioriser.")}${kpis(
      [
        [
          items.filter((x) => !["won", "lost"].includes(x.stage)).length,
          "Prospects ouverts · vue chargée",
        ],
        [items.filter((x) => x.stage === "meeting").length, "RDV"],
        [items.filter((x) => x.stage === "proposal").length, "Propositions"],
        [items.filter((x) => x.stage === "won").length, "Gagnés"],
      ],
    )}<article class="workspace-card"><div class="workspace-toolbar"><div><h3>Pipeline commercial</h3><p class="sub">Suivez chaque prospect et changez son étape depuis sa fiche.</p></div><button id="newDealBtn">+ Opportunité</button></div><div class="pipeline pipeline-deals">${stages
      .map(
        ([k, l]) =>
          `<div class="pipeline-col"><h4>${l} <span class="pipeline-count">${items.filter((x) => x.stage === k).length}</span></h4>${items
            .filter((x) => x.stage === k)
            .map(
              (x) =>
                `<div class="workspace-row"><div><strong>${esc(x.title)}</strong><small>${esc(x.client_name || x.source || "Prospect")} ${x.next_action ? `• ${esc(x.next_action)}` : ""}</small></div><select class="deal-stage" data-id="${esc(x.id)}" aria-label="Changer l'étape">${stages.map(([v, n]) => `<option value="${v}" ${v === x.stage ? "selected" : ""}>${n}</option>`).join("")}</select></div>`,
            )
            .join("")}</div>`,
      )
      .join(
        "",
      )}</div></article><dialog id="dealDialog"><div class="dialog-head"><div><p class="eyebrow">CRM</p><h2>Nouvelle opportunité</h2></div><button id="closeDeal" aria-label="Fermer" class="icon-button">${window.HIOSIcons.icon("close")}</button></div><form class="workspace-form" id="dealForm"><input class="full" name="title" required placeholder="Ex. Refonte site — Entreprise X"><select name="clientId"><option value="">Prospect sans fiche client</option>${cs.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select><input name="source" placeholder="Source : LinkedIn, recommandation…"><input name="valueFcfa" type="number" min="0" placeholder="Valeur estimée FCFA"><input name="nextAction" placeholder="Prochaine action"><textarea class="full" name="notes" placeholder="Notes"></textarea><button class="full" type="submit">Créer l’opportunité</button></form></dialog></section>`;
    bindCommands();
    const dlg = $("#dealDialog");
    $("#newDealBtn").onclick = () => dlg.showModal();
    $("#closeDeal").onclick = () => dlg.close();
    $("#dealForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      await api("/api/workspace/deals", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(f.entries())),
      });
      dlg.close();
      await renderDeals(c);
    };
    document.querySelectorAll(".deal-stage").forEach(
      (s) =>
        (s.onchange = async () => {
          await api(`/api/workspace/deals/${s.dataset.id}`, {
            method: "PATCH",
            body: JSON.stringify({ stage: s.value }),
          });
          await renderDeals(c);
        }),
    );
  }

  async function renderProjects(c) {
    const [s, projects, tasks, clients] = await Promise.all([
      summary(),
      api("/api/workspace/projects"),
      api("/api/workspace/tasks"),
      api("/api/workspace/clients"),
    ]);
    const ps = projects.items || [],
      ts = tasks.items || [],
      cs = clients.items || [];
    if (c.dataset.view !== "web") return;
    c.innerHTML = `<section class="workspace-shell">${head("Projets", "Sites, applications, automatisations et missions suivis avec tâches et échéances.", "Crée un nouveau projet HI MARKETING et définis les premières tâches.", "Fais le point sur tous mes projets en cours.")}${kpis(
      [
        [s.projects, "Projets ouverts"],
        [s.tasks, "Tâches ouvertes"],
        [
          ts.filter((x) => x.priority === "urgent" && x.status !== "done")
            .length,
          "Urgentes",
        ],
        [ps.filter((x) => x.status === "review").length, "À valider"],
      ],
    )}<div class="workspace-grid"><article class="workspace-card"><div class="workspace-toolbar"><div><h3>Projets</h3><p class="sub">${ps.length} projet(s) structuré(s).</p></div><button id="newProjectBtn">+ Projet</button></div><div class="workspace-list">${ps.length ? ps.map((x) => `<div class="workspace-row"><div><strong>${esc(x.name)}</strong><small>${esc(x.category || "Projet")} • ${esc(x.client_name || "Interne")} • ${x.open_tasks || 0} tâche(s) ouverte(s)${x.deadline ? ` • échéance ${fmt(x.deadline)}` : ""}</small></div><select class="project-stage" data-id="${esc(x.id)}" aria-label="État du projet">${["planned", "active", "review", "done", "paused", "cancelled"].map((v) => `<option value="${v}" ${v === x.status ? "selected" : ""}>${window.HIOSUI.label(v)}</option>`).join("")}</select></div>`).join("") : empty("Aucun projet", "Crée ton premier projet pour activer tâches et échéances.", "Crée un projet HI MARKETING avec objectifs et livrables.")}</div></article><aside class="workspace-card"><div class="workspace-toolbar"><div><h3>Tâches</h3><p class="sub">Priorités opérationnelles.</p></div><button id="newTaskBtn">+ Tâche</button></div><div class="workspace-list">${ts.length ? ts.map((x) => `<div class="workspace-row"><div><strong>${esc(x.title)}</strong><small>${esc(x.project_name || "Sans projet")} • ${esc(window.HIOSUI.label(x.priority))}${x.due_at ? ` • ${fmt(x.due_at)}` : ""}</small></div><select class="task-stage" data-id="${esc(x.id)}" aria-label="État de la tâche">${["todo", "doing", "blocked", "done", "cancelled"].map((v) => `<option value="${v}" ${v === x.status ? "selected" : ""}>${window.HIOSUI.label(v)}</option>`).join("")}</select></div>`).join("") : empty("Aucune tâche", "Les tâches créées apparaîtront ici.", "Organise mes tâches prioritaires de la semaine.")}</div></aside></div><dialog id="projectDialog"><div class="dialog-head"><div><p class="eyebrow">PROJET</p><h2>Nouveau projet</h2></div><button id="closeProject" aria-label="Fermer" class="icon-button">${window.HIOSIcons.icon("close")}</button></div><form class="workspace-form" id="projectForm"><input class="full" name="name" required placeholder="Nom du projet"><select name="clientId"><option value="">Projet interne</option>${cs.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select><input name="category" placeholder="Site, app, marketing…"><input name="deadline" type="datetime-local"><textarea class="full" name="description" placeholder="Objectif et livrables"></textarea><button class="full">Créer le projet</button></form></dialog><dialog id="taskDialog"><div class="dialog-head"><div><p class="eyebrow">TÂCHE</p><h2>Nouvelle tâche</h2></div><button id="closeTask" aria-label="Fermer" class="icon-button">${window.HIOSIcons.icon("close")}</button></div><form class="workspace-form" id="taskForm"><input class="full" name="title" required placeholder="Tâche à réaliser"><select name="projectId"><option value="">Sans projet</option>${ps.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select><select name="priority"><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option><option value="low">Basse</option></select><input name="assignee" placeholder="Responsable"><input name="dueAt" type="datetime-local"><textarea class="full" name="notes" placeholder="Consignes"></textarea><button class="full">Créer la tâche</button></form></dialog></section>`;
    bindCommands();
    document.querySelectorAll(".project-stage,.task-stage").forEach((x) => {
      let old = x.value;
      x.onchange = async () => {
        x.disabled = true;
        try {
          await api(
            "/api/workspace/" +
              (x.classList.contains("project-stage") ? "projects" : "tasks") +
              "/" +
              x.dataset.id,
            { method: "PATCH", body: JSON.stringify({ status: x.value }) },
          );
          await renderProjects(c);
          window.HIOSUI.notify("État mis à jour.");
        } catch (e) {
          x.value = old;
          window.HIOSUI.notify(window.HIOSUI.message(e), true);
        } finally {
          x.disabled = false;
        }
      };
    });
    const pd = $("#projectDialog"),
      td = $("#taskDialog");
    $("#newProjectBtn").onclick = () => pd.showModal();
    $("#closeProject").onclick = () => pd.close();
    $("#newTaskBtn").onclick = () => td.showModal();
    $("#closeTask").onclick = () => td.close();
    $("#projectForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      await api("/api/workspace/projects", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(f.entries())),
      });
      pd.close();
      await renderProjects(c);
    };
    $("#taskForm").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      await api("/api/workspace/tasks", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(f.entries())),
      });
      td.close();
      await renderProjects(c);
    };
  }

  async function renderContent(c) {
    const [s, data] = await Promise.all([
      summary(),
      api("/api/workspace/content"),
    ]);
    const items = data.items || [],
      states = [
        "idea",
        "brief",
        "creating",
        "review",
        "scheduled",
        "published",
      ];
    if (c.dataset.view !== "designer") return;
    c.innerHTML = `<section class="workspace-shell">${head("Contenus", "Studio central pour les affiches, vidéos, publications et campagnes de HI MARKETING.", "Prépare 3 contenus pour HI MARKETING avec angle, format et texte.", "Fais un audit du contenu à produire cette semaine.")}${kpis(
      [
        [s.content, "En production"],
        [items.filter((x) => x.status === "review").length, "À valider"],
        [items.filter((x) => x.status === "scheduled").length, "Programmés"],
        [items.filter((x) => x.status === "published").length, "Publiés"],
      ],
    )}<article class="workspace-card"><div class="workspace-toolbar"><div><h3>Pipeline contenu</h3><p class="sub">Idée → Brief → Création → Validation → Programmation → Publication.</p></div><button id="newContentBtn">+ Contenu</button></div><div class="pipeline pipeline-content">${states
      .map(
        (st) =>
          `<div class="pipeline-col"><h4>${window.HIOSUI.label(st)} <span class="pipeline-count">${items.filter((x) => x.status === st).length}</span></h4>${items
            .filter((x) => x.status === st)
            .map(
              (x) =>
                `<div class="workspace-row"><div><strong>${esc(x.title)}</strong><small>${esc(x.channel || "multi")} • ${esc(x.format || "post")}${x.publish_at ? ` • ${fmt(x.publish_at)}` : ""}</small></div><select class="content-stage" data-id="${x.id}">${states.map((v) => `<option value="${v}" ${v === x.status ? "selected" : ""}>${window.HIOSUI.label(v)}</option>`).join("")}<option value="archived">Archivé</option></select></div>`,
            )
            .join("")}</div>`,
      )
      .join(
        "",
      )}</div></article><dialog id="contentDialog"><div class="dialog-head"><div><p class="eyebrow">STUDIO</p><h2>Nouveau contenu</h2></div><button id="closeContent" aria-label="Fermer" class="icon-button">${window.HIOSIcons.icon("close")}</button></div><form class="workspace-form" id="contentForm"><input class="full" name="title" required placeholder="Titre / sujet"><input name="channel" placeholder="LinkedIn, Instagram…"><input name="format" placeholder="Affiche, vidéo, carrousel…"><input name="publishAt" type="datetime-local"><textarea class="full" name="brief" placeholder="Brief créatif"></textarea><button class="full">Créer le contenu</button></form></dialog></section>`;
    bindCommands();
    const dlg = $("#contentDialog");
    $("#newContentBtn").onclick = () => dlg.showModal();
    $("#closeContent").onclick = () => dlg.close();
    $("#contentForm").onsubmit = async (e) => {
      e.preventDefault();
      await api("/api/workspace/content", {
        method: "POST",
        body: JSON.stringify(
          Object.fromEntries(new FormData(e.currentTarget).entries()),
        ),
      });
      dlg.close();
      await renderContent(c);
    };
    document.querySelectorAll(".content-stage").forEach(
      (x) =>
        (x.onchange = async () => {
          await api(`/api/workspace/content/${x.dataset.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: x.value }),
          });
          await renderContent(c);
        }),
    );
  }

  async function renderCalendar(c) {
    const [s, data] = await Promise.all([
      summary(),
      api("/api/workspace/calendar"),
    ]);
    const items = data.items || [];
    if (c.dataset.view !== "analytics") return;
    c.innerHTML = `<section class="workspace-shell">${head("Calendrier", "Échéances, rendez-vous, suivis et relances réunis dans une vue simple.", "Organise ma semaine HI MARKETING à partir des priorités actuelles.", "Quelles échéances dois-je surveiller ?")}${kpis(
      [
        [s.calendar, "7 prochains jours"],
        [items.filter((x) => x.item_type === "meeting").length, "RDV"],
        [items.filter((x) => x.item_type === "follow_up").length, "Relances"],
        [items.length, "Éléments suivis"],
      ],
    )}<div class="workspace-grid"><article class="workspace-card"><div class="workspace-toolbar"><div><h3>Agenda</h3><p class="sub">Éléments réels enregistrés dans HI OS.</p></div><button id="newCalendarBtn">+ Ajouter</button></div><div class="workspace-list">${items.length ? items.map((x) => `<div class="workspace-row"><div><strong>${esc(x.title)}</strong><small>${fmt(x.starts_at)}${x.ends_at ? ` → ${fmt(x.ends_at)}` : ""}</small></div><span class="tag">${esc(x.item_type)}</span></div>`).join("") : empty("Agenda vide", "Ajoute un rendez-vous, une relance ou une échéance.", "Organise ma semaine et propose les échéances importantes.")}</div></article><aside class="workspace-card"><h3>Principe</h3><p class="sub">HI OS ne remplit pas ton agenda avec du bruit.</p><div class="workspace-note">Seuls les rendez-vous, deadlines, relances et événements réellement utiles doivent apparaître ici.</div></aside></div><dialog id="calendarDialog"><div class="dialog-head"><div><p class="eyebrow">AGENDA</p><h2>Nouvel élément</h2></div><button id="closeCalendar" aria-label="Fermer" class="icon-button">${window.HIOSIcons.icon("close")}</button></div><form class="workspace-form" id="calendarForm"><input class="full" name="title" required placeholder="Titre"><select name="itemType"><option value="task">Tâche</option><option value="meeting">Rendez-vous</option><option value="follow_up">Relance</option><option value="deadline">Échéance</option></select><input name="startsAt" required type="datetime-local"><input name="endsAt" type="datetime-local"><textarea class="full" name="notes" placeholder="Notes"></textarea><button class="full">Ajouter au calendrier</button></form></dialog></section>`;
    bindCommands();
    const dlg = $("#calendarDialog");
    $("#newCalendarBtn").onclick = () => dlg.showModal();
    $("#closeCalendar").onclick = () => dlg.close();
    $("#calendarForm").onsubmit = async (e) => {
      e.preventDefault();
      await api("/api/workspace/calendar", {
        method: "POST",
        body: JSON.stringify(
          Object.fromEntries(new FormData(e.currentTarget).entries()),
        ),
      });
      dlg.close();
      await renderCalendar(c);
    };
  }

  async function renderDocuments(c) {
    const [s, data, clients] = await Promise.all([
      summary(),
      api("/api/workspace/documents"),
      api("/api/workspace/clients"),
    ]);
    const items = data.items || [],
      cs = clients.items || [];
    if (c.dataset.view !== "proposal") return;
    c.innerHTML = `<section class="workspace-shell">${head("Documents", "Devis, propositions, plaquettes, contrats et rapports structurés au même endroit.", "Prépare un nouveau document commercial HI MARKETING.", "Montre-moi les documents à mettre à jour.")}${kpis(
      [
        [s.documents, "Documents actifs"],
        [items.filter((x) => x.status === "draft").length, "Brouillons"],
        [items.filter((x) => x.status === "sent").length, "Envoyés"],
        [items.filter((x) => x.status === "signed").length, "Signés"],
      ],
    )}<div class="workspace-grid"><article class="workspace-card"><div class="workspace-toolbar"><div><h3>Bibliothèque</h3><p class="sub">Retrouvez les références de vos devis, propositions et rapports.</p></div><button id="newDocBtn">+ Document</button></div><div class="workspace-list">${items.length ? items.map((x) => `<div class="workspace-row"><div><strong>${esc(x.title)}</strong><small>${esc(window.HIOSUI.label(x.document_type))} • créé ${fmt(x.created_at)}</small></div><span class="tag">${esc(x.status)}</span></div>`).join("") : empty("Aucun document suivi", "Ajoute une proposition, un devis ou une plaquette à la bibliothèque.", "Prépare une proposition commerciale HI MARKETING professionnelle.")}</div></article><aside class="workspace-card"><h3>Création rapide</h3><div class="doc-grid"><div class="doc-card"><strong>Proposition</strong><button data-workspace-command="Prépare une proposition commerciale HI MARKETING professionnelle.">Préparer</button></div><div class="doc-card"><strong>Devis</strong><button data-workspace-command="Prépare un devis HI MARKETING professionnel.">Préparer</button></div><div class="doc-card"><strong>Plaquette</strong><button data-workspace-command="Prépare une plaquette commerciale HI MARKETING premium.">Préparer</button></div><div class="doc-card"><strong>Rapport</strong><button data-workspace-command="Prépare un rapport exécutif HI MARKETING.">Préparer</button></div></div></aside></div><dialog id="docDialog"><div class="dialog-head"><div><p class="eyebrow">DOCUMENT</p><h2>Ajouter au suivi</h2></div><button id="closeDoc" aria-label="Fermer" class="icon-button">${window.HIOSIcons.icon("close")}</button></div><form class="workspace-form" id="docForm"><input class="full" name="title" required placeholder="Titre"><select name="documentType"><option value="proposal">Proposition</option><option value="quote">Devis</option><option value="brochure">Plaquette</option><option value="contract">Contrat</option><option value="report">Rapport</option><option value="other">Autre</option></select><select name="clientId"><option value="">Interne / aucun client</option>${cs.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select><input class="full" name="storageRef" placeholder="Référence Drive / URL / emplacement (optionnel)"><button class="full">Ajouter au suivi</button></form></dialog></section>`;
    bindCommands();
    const dlg = $("#docDialog");
    $("#newDocBtn").onclick = () => dlg.showModal();
    $("#closeDoc").onclick = () => dlg.close();
    $("#docForm").onsubmit = async (e) => {
      e.preventDefault();
      await api("/api/workspace/documents", {
        method: "POST",
        body: JSON.stringify(
          Object.fromEntries(new FormData(e.currentTarget).entries()),
        ),
      });
      dlg.close();
      await renderDocuments(c);
    };
  }

  async function renderAgents(c) {
    const [dash, health] = await Promise.all([
      api("/api/admin/dashboard").catch(() => ({ agentRuns: 0 })),
      fetch("/api/bootstrap-status", { credentials: "same-origin" })
        .then((r) => r.json())
        .catch(() => ({})),
    ]);
    const list = [
      ["HI Orchestrator", "Route les missions vers les bons agents.", "A1"],
      ["Contract Hunter", "Recherche et qualifie des prospects.", "A2"],
      ["CRM Agent", "Structure les relations commerciales.", "A2"],
      ["Master Designer", "Crée directions visuelles et contenus.", "A2"],
      ["Web Agent", "Construit et maintient les produits web.", "A2"],
      ["QA Agent", "Vérifie la qualité avant livraison.", "A2"],
      ["Inbox Agent", "Trie les messages et priorités.", "A2"],
      ["Job Search Factory", "Pilote les recherches d’emploi clients.", "A2"],
    ];
    if (c.dataset.view !== "automation") return;
    c.innerHTML = `<section class="workspace-shell">${head("IA & Assistants", "Tous les agents spécialisés de HI OS, avec leurs rôles et niveaux d’autonomie.", "Montre-moi les tâches que les agents peuvent exécuter aujourd’hui.", "Fais un diagnostic de tous les agents HI OS.")}${kpis(
      [
        [dash.agentRuns || 0, "Exécutions / 24h"],
        [health.aiConfigured ? "Prête" : "Limitée", "IA"],
        [health.gmailConfigured ? "Prêt" : "À configurer", "Gmail OAuth"],
        [health.tenantIsolation ? "Strict" : "À vérifier", "Isolation"],
      ],
    )}<article class="workspace-card"><div class="agent-catalog">${list.map(([n, p, a]) => `<div class="agent-tile"><strong>${esc(n)}</strong><p>${esc(p)}</p><span>${a === "A1" ? "Prépare et conseille" : "Accompagne vos actions"}</span><button data-workspace-command="${esc(n + ", aide-moi à démarrer une mission.")}">Utiliser cet assistant</button></div>`).join("")}</div></article></section>`;
    bindCommands();
  }

  async function renderSettings(c) {
    const isPlatform = window.HIOSAuth.user?.space === "hi_marketing";
    const [dash, h, companies] = await Promise.all([
      api("/api/admin/dashboard").catch(() => ({ agentRuns: 0 })),
      fetch("/api/bootstrap-status", { credentials: "same-origin" })
        .then((r) => r.json())
        .catch(() => ({})),
      isPlatform
        ? api("/api/admin/companies").catch(() => ({ items: [], availableModules: [] }))
        : Promise.resolve({ items: [], availableModules: [] }),
    ]);
    const stat = (ok, label, value) =>
      `<div class="status-line"><i class="status-dot-small ${ok ? "" : "warn"}"></i><strong>${esc(label)}</strong><small>${esc(value)}</small></div>`;
    if (c.dataset.view !== "knowledge") return;
    const moduleLabels = {crm:"Clients",hunter:"Prospection",web:"Projets",designer:"Contenus",automation:"Assistants",analytics:"Calendrier",proposal:"Documents",knowledge:"Paramètres"};
    const companyPanel = isPlatform ? `<article class="workspace-card"><div class="workspace-toolbar"><div><h3>Entreprises clientes</h3><p class="sub">Gérez les modules et les accès de chaque entreprise.</p></div></div><div class="workspace-list">${companies.items.filter(x=>x.space_type==='client').map(company=>`<section class="company-space" data-company-id="${esc(company.id)}"><form class="company-modules workspace-row" data-company-id="${esc(company.id)}"><div><strong>${esc(company.name)}</strong><small>${esc(company.slug)}</small><div class="module-checks">${companies.availableModules.map(key=>`<label><input type="checkbox" name="modules" value="${esc(key)}" ${(company.enabled_modules||[]).includes(key)?'checked':''}> ${esc(moduleLabels[key]||key)}</label>`).join("")}</div></div><button type="submit">Enregistrer</button></form><div class="company-users" data-users-for="${esc(company.id)}"><button type="button" class="load-company-users" data-company-id="${esc(company.id)}">Gérer les utilisateurs</button></div></section>`).join("") || empty("Aucune entreprise cliente", "Les environnements clients créés apparaîtront ici.", "")}</div><form class="workspace-form" id="companyForm"><input name="name" required placeholder="Nom de l’entreprise"><input name="slug" required pattern="[a-z0-9-]+" placeholder="identifiant-entreprise"><button type="submit">Créer l’environnement</button></form><div id="companyStatus"></div></article>` : "";
    c.innerHTML = `<section class="workspace-shell">${head("Paramètres", isPlatform ? "Administrez HI MARKETING et les environnements de vos entreprises clientes." : `Paramètres de l’espace ${window.HIOSAuth.user?.company?.name || "client"}.`, "Fais un diagnostic complet de la configuration HI OS.", "Explique-moi les paramètres qui nécessitent mon attention.")}${kpis(
      [
        [h.version || "—", "Version"],
        [dash.agentRuns || 0, "Runs / 24h"],
        [h.adminConfigured ? "Oui" : "Non", "Admin"],
        [h.tenantIsolation ? "Strict" : "À vérifier", "Isolation"],
      ],
    )}<div class="settings-grid"><div class="settings-panel"><h4>Infrastructure</h4>${stat(h.database, "Base de données", h.database ? "Connectée" : "Indisponible")}${stat(h.gmailConfigured, "Google / Gmail", h.gmailConfigured ? "Configuré" : "À configurer")}${stat(h.aiConfigured, "Moteur IA", h.aiConfigured ? "Clé configurée" : "Crédit API à régler")}${stat(h.cvEncryptionConfigured, "Chiffrement", h.cvEncryptionConfigured ? "Actif" : "À vérifier")}</div><div class="settings-panel"><h4>Sécurité</h4><p>Les données sont séparées par entreprise. Chaque espace client accède uniquement aux modules qui lui sont attribués.</p><div class="workspace-note">HI OS continue de fonctionner structurellement même lorsqu’un fournisseur IA externe est indisponible.</div></div></div>${companyPanel}</section>`;
    bindCommands();
    if (isPlatform) {
      document.querySelectorAll(".company-modules").forEach(form => form.onsubmit = async (event) => {
        event.preventDefault();
        const enabledModules = [...new FormData(form).getAll("modules")];
        const button = form.querySelector("button");
        button.disabled = true;
        try {
          await api(`/api/admin/companies/${form.dataset.companyId}/modules`, {method:"PATCH",body:JSON.stringify({enabledModules})});
          window.HIOSUI.notify("Modules enregistrés.");
        } catch (error) { window.HIOSUI.notify(window.HIOSUI.message(error), true); }
        finally { button.disabled = false; }
      });
      document.querySelectorAll(".load-company-users").forEach(button => button.onclick = async () => {
        const companyId = button.dataset.companyId, box = document.querySelector(`[data-users-for="${companyId}"]`);
        box.innerHTML = "Chargement…";
        try {
          const users = await api(`/api/admin/companies/${companyId}/users`);
          box.innerHTML = `<div class="workspace-list">${users.items.map(user=>`<div class="workspace-row"><div><strong>${esc(user.full_name)}</strong><small>${esc(user.email)} • ${user.status==='active'?'Actif':'Suspendu'}</small></div><button type="button" class="user-status" data-user-id="${esc(user.id)}" data-company-id="${esc(companyId)}" data-next-status="${user.status==='active'?'suspended':'active'}">${user.status==='active'?'Suspendre':'Réactiver'}</button></div>`).join("") || `<p class="sub">Aucun utilisateur pour cette entreprise.</p>`}</div><form class="workspace-form company-user-form" data-company-id="${esc(companyId)}"><input name="fullName" required placeholder="Nom complet"><input name="email" type="email" required placeholder="utilisateur@entreprise.com"><button type="submit">Créer l’accès</button></form><div class="company-user-status"></div>`;
          box.querySelectorAll(".user-status").forEach(action => action.onclick = async () => {
            await api(`/api/admin/companies/${action.dataset.companyId}/users/${action.dataset.userId}/status`, {method:"PATCH",body:JSON.stringify({status:action.dataset.nextStatus})});
            button.click();
          });
          box.querySelector(".company-user-form").onsubmit = async event => {
            event.preventDefault();
            const form=event.currentTarget,data=new FormData(form),status=box.querySelector(".company-user-status");
            status.textContent="Création…";
            try {
              const created=await api(`/api/admin/companies/${form.dataset.companyId}/users`, {method:"POST",body:JSON.stringify({fullName:data.get("fullName"),email:data.get("email")})});
              status.innerHTML=`<div class="workspace-note"><strong>Accès créé.</strong><br>Mot de passe temporaire : <code>${esc(created.temporaryPassword)}</code><br>À transmettre une seule fois à l’utilisateur.</div>`;
              form.reset();
            } catch (error) { status.innerHTML=err(error); }
          };
        } catch (error) { box.innerHTML=err(error); }
      });
      $("#companyForm").onsubmit = async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget), status = $("#companyStatus");
        status.textContent = "Création…";
        try {
          await api("/api/admin/companies", {method:"POST",body:JSON.stringify({name:data.get("name"),slug:data.get("slug")})});
          await renderSettings(c);
        } catch (error) { status.innerHTML = err(error); }
      };
    }
  }

  window.HIOSWorkspace = { render };
})();
