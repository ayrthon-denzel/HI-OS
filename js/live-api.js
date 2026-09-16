(() => {
  const $ = (s) => document.querySelector(s),
    icon = (n) => window.HIOSIcons.icon(n);
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
  const api = (path, opts = {}) => window.HIOSAuth.api(path, opts);
  const go = (key) =>
    document.querySelector(`.nav button[data-page="${key}"]`)?.click();
  const openCommand = (t) => window.HIOSAssistant.prepare(t);
  let generation = 0;
  async function refreshDashboard() {
    const gen = ++generation;
    try {
      const paths = [
        "summary",
        "tasks",
        "deals",
        "projects",
        "content",
        "documents",
        "clients",
      ];
      const result = await Promise.allSettled(
        paths.map((p) => api("/api/workspace/" + p)),
      );
      if (gen !== generation || $("#content").dataset.view !== "command")
        return;
      const data = Object.fromEntries(
        paths.map((p, i) => [
          p,
          result[i].status === "fulfilled" ? result[i].value : null,
        ]),
      );
      const failed = result.some((r) => r.status === "rejected");
      const tasks = data.tasks?.items || [],
        deals = data.deals?.items || [],
        projects = data.projects?.items || [],
        content = data.content?.items || [];
      const today = new Date(),
        end = new Date(today);
      end.setHours(23, 59, 59, 999);
      const openTasks = tasks.filter(
        (t) => !["done", "cancelled"].includes(t.status),
      );
      const priorities = openTasks
        .filter(
          (t) =>
            ["urgent", "high"].includes(t.priority) ||
            (t.due_at && new Date(t.due_at) <= end),
        )
        .sort(
          (a, b) =>
            (a.priority === "urgent" ? -1 : 1) -
              (b.priority === "urgent" ? -1 : 1) ||
            new Date(a.due_at || "9999") - new Date(b.due_at || "9999"),
        );
      const followups = deals.filter(
        (d) =>
          !["won", "lost"].includes(d.stage) &&
          d.next_action_at &&
          new Date(d.next_action_at) <= end,
      );
      const review =
        content.filter((c) => c.status === "review").length +
        projects.filter((p) => p.status === "review").length;
      const recent = [
        ...projects.map((x) => ({
          ...x,
          title: x.name,
          kind: "Projet",
          page: "web",
        })),
        ...deals.map((x) => ({ ...x, kind: "Prospect", page: "hunter" })),
        ...content.map((x) => ({ ...x, kind: "Contenu", page: "designer" })),
        ...(data.documents?.items || []).map((x) => ({
          ...x,
          kind: "Document",
          page: "proposal",
        })),
        ...(data.clients?.items || []).map((x) => ({
          ...x,
          title: x.name,
          kind: "Client",
          page: "crm",
        })),
      ]
        .filter((x) => x.updated_at || x.created_at)
        .sort(
          (a, b) =>
            new Date(b.updated_at || b.created_at) -
            new Date(a.updated_at || a.created_at),
        )
        .slice(0, 5);
      const number = (v) => (v == null ? "—" : esc(v)),
        s = data.summary;
      const count = priorities.length + followups.length;
      const priorityRow = (title, desc, page, urgent = false) =>
        `<button class="priority-item ${urgent ? "urgent" : ""}" data-page-link="${page}">${icon(urgent ? "clock" : "check")}<span class="priority-copy"><strong>${esc(title)}</strong><small>${esc(desc)}</small></span>${icon("arrow")}</button>`;
      $("#content").innerHTML = `<div class="home-layout">
        <section class="today-hero executive-hero">
          <div class="executive-copy"><p class="eyebrow">CENTRE DE COMMANDE</p><h2>Tout est sous contrôle.</h2><p>${failed ? "Certaines informations sont indisponibles. Actualisez pour réessayer." : count ? `Vous avez ${count} priorité${count > 1 ? "s" : ""}. Concentrez-vous sur l’essentiel.` : "Aucune urgence détectée. Vous pouvez préparer la prochaine étape avec sérénité."}</p><div class="today-date"><span class="live-dot"></span>${esc(today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</div><button data-command="Organise ma journée à partir des tâches, relances et validations en attente.">${icon("sparkles")}<span>Organiser ma journée</span></button></div>
          <div class="executive-overview" aria-label="Aperçu de votre activité"><div class="overview-heading"><span>Vue d’ensemble</span><small>Mise à jour en direct</small></div><div class="overview-grid"><div><strong>${number(s?.clients)}</strong><span>Clients</span></div><div><strong>${data.deals ? number(deals.filter((d) => !["won", "lost"].includes(d.stage)).length) : "—"}</strong><span>Prospects</span></div><div><strong>${number(s?.projects)}</strong><span>Projets</span></div><div><strong>${number(s?.tasks)}</strong><span>Tâches</span></div></div><div class="overview-focus"><span>Priorité du jour</span><strong>${count ? `${count} action${count > 1 ? "s" : ""} à traiter` : "Activité à jour"}</strong></div></div>
        </section>
        ${failed ? '<div class="workspace-note" role="status">Les chiffres manquants ne sont pas remplacés par zéro. <button id="retryDashboard">Actualiser</button></div>' : ""}
        <section class="home-bottom-grid"><article class="home-panel"><div class="home-section-head"><div><p class="eyebrow">À TRAITER</p><h3>Vos priorités</h3></div><button class="text-button" data-page-link="web">Toutes les tâches</button></div><div class="priority-list">
        ${priorities
          .slice(0, 3)
          .map((t) =>
            priorityRow(
              t.title,
              t.due_at
                ? `À terminer le ${new Date(t.due_at).toLocaleDateString("fr-FR")} · ${t.project_name || "Tâche"}`
                : t.project_name || "Tâche prioritaire",
              "web",
              t.priority === "urgent" || new Date(t.due_at) < today,
            ),
          )
          .join("")}
        ${followups
          .slice(0, 2)
          .map((d) =>
            priorityRow(
              d.title,
              d.next_action || "Relancer ce prospect",
              "hunter",
            ),
          )
          .join("")}
        ${!count ? '<div class="workspace-empty"><div><strong>Aucune urgence dans les données chargées</strong><p>Ajoutez une tâche ou une date de relance pour retrouver vos prochaines actions ici.</p><button data-page-link="web">Gérer mes tâches</button></div></div>' : ""}
        <button class="priority-item" id="homeApprovals">${icon("check")}<span class="priority-copy"><strong>Décisions à valider</strong><small>Consulter les actions qui attendent votre accord</small></span><span class="badge" id="homeApprovalCount">${esc($("#approvalCount").textContent)}</span></button>
        ${review ? priorityRow(`${review} projet(s) ou contenu(s) à vérifier`, "Ouvrir les éléments en attente de validation", content.some((c) => c.status === "review") ? "designer" : "web") : ""}</div></article>
        <article class="home-panel"><div class="home-section-head"><div><p class="eyebrow">DERNIERS MOUVEMENTS</p><h3>Activité récente</h3></div>${icon("clock")}</div><div class="activity-list">${recent.length ? recent.map((x) => `<div class="activity-item"><div><strong>${esc(x.title)}</strong><small>${esc(x.kind)} · ${esc(new Date(x.updated_at || x.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }))}</small></div></div>`).join("") : '<div class="workspace-empty"><div><strong>Votre activité commence ici</strong><p>Les nouveaux clients, projets et contenus apparaîtront dans cette liste.</p><button data-page-link="crm">Ajouter un client</button></div></div>'}</div></article></section>
        <form class="home-search" id="homeSearch">${icon("sparkles")}<label class="field" for="homeSearchInput"><span>Demandez une action à HI Assistant</span><input id="homeSearchInput" placeholder="Ex. Prépare une proposition pour mon client" required></label><button type="submit">Préparer ma demande</button></form>
        <section><div class="home-section-head"><h3>Que souhaitez-vous faire ?</h3></div><div class="action-grid">${[
          ["target", "Suivre un prospect", "Contacts et relances", "hunter"],
          ["users", "Gérer mes clients", "Fiches et coordonnées", "crm"],
          ["briefcase", "Avancer sur un projet", "Missions et tâches", "web"],
          ["file", "Créer un document", "Devis et propositions", "proposal"],
        ]
          .map(
            ([i, t, d, k]) =>
              `<button class="action-card" data-page-link="${k}">${icon(i)}<span><strong>${t}</strong><small>${d}</small></span></button>`,
          )
          .join("")}</div></section>
        <p class="home-caption">Digital • Software • Growth</p>
      </div>`;
      document
        .querySelectorAll("[data-page-link]")
        .forEach((b) => (b.onclick = () => go(b.dataset.pageLink)));
      document
        .querySelectorAll("[data-command]")
        .forEach((b) => (b.onclick = () => openCommand(b.dataset.command)));
      $("#homeApprovals").onclick = () => $("#openApprovals").click();
      $("#retryDashboard")?.addEventListener("click", refreshDashboard);
      $("#homeSearch").onsubmit = (e) => {
        e.preventDefault();
        if ($("#homeSearchInput").value.trim())
          openCommand($("#homeSearchInput").value.trim());
      };
    } catch (e) {
      if ($("#content").dataset.view === "command")
        $("#content").innerHTML =
          '<div class="workspace-note" role="alert">Impossible de charger votre journée. Revenez à l’accueil pour réessayer.</div>';
    }
  }
  async function loadApprovals() {
    const list = $("#approvalList"),
      badge = $("#approvalCount");
    try {
      const data = await api("/api/admin/approvals"),
        items = data.items || [];
      badge.textContent = items.length;
      if ($("#homeApprovalCount"))
        $("#homeApprovalCount").textContent = items.length;
      list.innerHTML = items.length
        ? items
            .map(
              (x) =>
                `<article data-approval="${esc(x.id)}"><div><strong>${esc(x.action_type.replace(/[_.]/g, " "))}</strong><span>${new Date(x.requested_at).toLocaleString("fr-FR")}</span></div><p>${esc(x.payload?.summary || x.payload?.description || x.payload?.command || x.payload?.title || "Consultez le détail avant de décider.")}<details><summary>Détail de la demande</summary><p>${esc(JSON.stringify(x.payload))}</p></details></p><div><button class="ghost" data-decision="reject">Refuser</button><button data-decision="approve">Valider</button></div></article>`,
            )
            .join("")
        : '<p class="muted">Aucune décision en attente. Vous êtes à jour.</p>';
      list.querySelectorAll("[data-decision]").forEach(
        (btn) =>
          (btn.onclick = async () => {
            const card = btn.closest("[data-approval]");
            btn.disabled = true;
            try {
              await api(
                `/api/admin/approvals/${card.dataset.approval}/${btn.dataset.decision}`,
                { method: "POST", body: "{}" },
              );
              await loadApprovals();
              refreshDashboard();
              window.HIOSUI.notify("Décision enregistrée.");
            } catch (e) {
              window.HIOSUI.notify(window.HIOSUI.message(e), true);
              btn.disabled = false;
            }
          }),
      );
    } catch {
      list.innerHTML = '<p class="muted">Validations indisponibles.</p>';
    }
  }
  function wireCommand() {
    const form = $("#chatForm"),
      input = $("#chatInput"),
      messages = $("#messages");
    if (!form || form.dataset.live === "1") return;
    form.dataset.live = "1";
    form.addEventListener(
      "submit",
      async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const text = input.value.trim();
        if (!text || form.dataset.busy) return;
        form.dataset.busy = "1";
        form.querySelector("button").disabled = true;
        add("user", esc(text));
        input.value = "";
        add("agent", "Je m’en occupe…");
        const pending = messages.lastElementChild;
        try {
          const out = await api("/api/orchestrate", {
            method: "POST",
            body: JSON.stringify({ command: text }),
          });
          const actions = (out.actions || [])
            .slice(0, 5)
            .map(
              (a) =>
                `<li>${esc(typeof a === "string" ? a : a.action || a.name || JSON.stringify(a))}</li>`,
            )
            .join("");
          pending.innerHTML = `<strong>${esc(out.summary || "Mission prise en charge.")}</strong>${actions ? `<ul class="orchestrator-actions">${actions}</ul>` : ""}<small class="orchestrator-mode">${esc(out.mode === "ai-orchestrated" ? "IA" : "Routage sécurisé")} • validation requise pour les actions sensibles</small>`;
        } catch (err) {
          pending.textContent = `Je ne peux pas exécuter cette demande maintenant : ${window.HIOSUI.message(err)}`;
          input.value = text;
        } finally {
          delete form.dataset.busy;
          form.querySelector("button").disabled = false;
        }
      },
      true,
    );
    function add(type, html) {
      const d = document.createElement("div");
      d.className = `msg ${type}`;
      d.innerHTML = html;
      messages.appendChild(d);
      messages.scrollTop = messages.scrollHeight;
    }
  }
  document.addEventListener("hios:authenticated", () => {
    wireCommand();
    refreshDashboard();
    loadApprovals();
  });
  document.addEventListener("hios:command-view", refreshDashboard);
  $("#openApprovals")?.addEventListener("click", loadApprovals, true);
})();
