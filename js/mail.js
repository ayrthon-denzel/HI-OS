(() => {
  const api = (path, options = {}) => window.HIOSAuth.api(path, options);
  const icon = (name) => window.HIOSIcons.icon(name);
  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
    );
  const statusLabels = { inbox: "À trier", action: "À traiter", waiting: "En attente", done: "Terminé", archived: "Archivé" };
  let messages = [], selected = new Set(), activeId = null, mode = "list";

  async function connect() {
    const data = await api("/api/mail/google/start");
    location.href = data.url;
  }

  function sender(value = "") {
    return value.replace(/<[^>]+>/g, "").replace(/^"|"$/g, "").trim() || "Expéditeur";
  }

  function messageCard(item, compact = false) {
    const checked = selected.has(item.id) ? "checked" : "";
    return `<article class="mail-card ${item.id === activeId ? "active" : ""} priority-${esc(item.priority)}" draggable="${compact}" data-mail-id="${esc(item.id)}">
      <label class="mail-select" aria-label="Sélectionner"><input type="checkbox" data-select-mail="${esc(item.id)}" ${checked}></label>
      <button class="mail-open" data-open-mail="${esc(item.id)}"><span class="mail-avatar">${esc(sender(item.from).slice(0, 1).toUpperCase())}</span><span class="mail-card-copy"><span class="mail-card-meta"><strong>${esc(sender(item.from))}</strong><time>${esc(new Date(item.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }))}</time></span><b>${esc(item.subject || "Sans objet")}</b><small>${esc(item.snippet || "Aperçu indisponible")}</small><span class="mail-tags"><i class="mail-tag category-${esc(item.category)}">${esc(item.category)}</i><i>${esc(statusLabels[item.workflowStatus] || item.workflowStatus)}</i></span></span></button>
    </article>`;
  }

  function filtered() {
    const q = document.querySelector("#mailSearch")?.value.toLowerCase().trim() || "";
    const category = document.querySelector("#mailCategory")?.value || "all";
    return messages.filter((m) => (!q || `${m.subject} ${m.from} ${m.snippet}`.toLowerCase().includes(q)) && (category === "all" || m.category === category));
  }

  function renderMessages() {
    const host = document.querySelector("#mailMessages");
    if (!host) return;
    const items = filtered();
    if (mode === "kanban") {
      host.className = "mail-kanban";
      host.innerHTML = ["inbox", "action", "waiting", "done"].map(status => `<section class="mail-lane" data-drop-status="${status}"><header><span>${statusLabels[status]}</span><b>${items.filter(m => m.workflowStatus === status).length}</b></header><div>${items.filter(m => m.workflowStatus === status).map(m => messageCard(m, true)).join("") || '<p class="mail-lane-empty">Déposez un e-mail ici</p>'}</div></section>`).join("");
    } else {
      host.className = "mail-list";
      host.innerHTML = items.map(m => messageCard(m)).join("") || '<div class="mail-empty">Aucun e-mail ne correspond à ce filtre.</div>';
    }
    bindCards();
  }

  function bindCards() {
    document.querySelectorAll("[data-open-mail]").forEach(button => button.onclick = () => openMessage(button.dataset.openMail));
    document.querySelectorAll("[data-select-mail]").forEach(box => box.onchange = () => {
      box.checked ? selected.add(box.dataset.selectMail) : selected.delete(box.dataset.selectMail);
      updateSelection();
    });
    document.querySelectorAll("[draggable=true]").forEach(card => card.ondragstart = event => event.dataTransfer.setData("text/plain", card.dataset.mailId));
    document.querySelectorAll("[data-drop-status]").forEach(lane => {
      lane.ondragover = event => event.preventDefault();
      lane.ondrop = async event => {
        event.preventDefault();
        const id = event.dataTransfer.getData("text/plain");
        await updateMessage(id, lane.dataset.dropStatus);
      };
    });
  }

  function updateSelection() {
    const count = document.querySelector("#mailSelectedCount");
    if (count) count.textContent = `${selected.size} sélectionné${selected.size > 1 ? "s" : ""}`;
    document.querySelectorAll("[data-bulk-status]").forEach(button => button.disabled = !selected.size);
  }

  function openMessage(id) {
    activeId = id;
    const item = messages.find(m => m.id === id);
    if (!item) return;
    renderMessages();
    const panel = document.querySelector("#mailAssistantPanel");
    panel.innerHTML = `<div class="mail-ai-orb">${icon("sparkles")}</div><p class="eyebrow">ASSISTANT</p><h3>${esc(item.subject || "Sans objet")}</h3><p class="mail-ai-summary">${esc(item.aiSummary || item.snippet || "Aucun résumé disponible.")}</p><div class="mail-ai-facts"><span><small>Expéditeur</small><strong>${esc(sender(item.from))}</strong></span><span><small>Catégorie</small><strong>${esc(item.category)}</strong></span><span><small>Priorité</small><strong>${esc(item.priority)}</strong></span></div><div class="mail-ai-actions"><button data-command-mail="Résume cet e-mail et indique-moi la réponse ou l’action nécessaire : ${esc(item.subject)} — ${esc(item.snippet)}">Préparer une réponse</button><button class="ghost" data-set-status="action">Ajouter aux actions</button><button class="ghost" data-set-status="done">Marquer terminé</button></div><p class="mail-human-note">L’assistant prépare. Vous validez toujours avant un envoi.</p>`;
    panel.querySelector("[data-command-mail]").onclick = () => window.HIOSAssistant.prepare(panel.querySelector("[data-command-mail]").dataset.commandMail);
    panel.querySelectorAll("[data-set-status]").forEach(button => button.onclick = () => updateMessage(id, button.dataset.setStatus));
  }

  async function updateMessage(id, workflowStatus) {
    const item = messages.find(m => m.id === id);
    if (!item) return;
    await api(`/api/mail/messages/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ threadId: item.threadId, category: item.category, priority: item.priority, workflowStatus, aiSummary: item.aiSummary }) });
    item.workflowStatus = workflowStatus;
    renderMessages();
    if (activeId === id) openMessage(id);
  }

  async function bulk(workflowStatus) {
    await api("/api/mail/bulk", { method: "POST", body: JSON.stringify({ ids: [...selected], workflowStatus }) });
    messages.forEach(m => { if (selected.has(m.id)) m.workflowStatus = workflowStatus; });
    selected.clear();
    renderMessages();
    updateSelection();
    window.HIOSUI.notify("E-mails mis à jour.");
  }

  async function render(container) {
    container.innerHTML = '<section class="mail-loading"><div class="mail-ai-orb">'+icon("sparkles")+'</div><strong>Préparation de votre messagerie…</strong></section>';
    try {
      const status = await api("/api/mail/status");
      if (!status.connected) {
        container.innerHTML = `<section class="mail-connect"><div class="mail-connect-copy"><p class="eyebrow">MESSAGERIE IA</p><h2>Votre boîte mail,<br><em>enfin sous contrôle.</em></h2><p>Connectez Gmail pour classer vos e-mails, repérer les urgences et préparer les prochaines actions depuis un seul espace.</p><button id="connectWorkspaceMail">${icon("mail")} Connecter Gmail</button><small>Connexion Google sécurisée. Aucun mot de passe n’est stocké.</small></div><div class="mail-connect-preview"><div class="preview-glow"></div><span>56 non lus</span><strong>Traiter tous mes e-mails</strong><p>Clients, factures, opportunités et demandes importantes sont organisés automatiquement.</p></div></section>`;
        document.querySelector("#connectWorkspaceMail").onclick = connect;
        return;
      }
      const data = await api("/api/mail/messages");
      messages = data.items || [];
      selected.clear(); activeId = messages[0]?.id || null;
      const urgent = messages.filter(m => m.priority === "urgent" || m.priority === "high").length;
      container.innerHTML = `<section class="mail-os"><header class="mail-head"><div><p class="eyebrow">MESSAGERIE IA</p><h2>Boîte de réception</h2><p>${esc(data.account || "Gmail connecté")} · ${messages.length} e-mails analysés</p></div><div class="mail-head-stats"><span><b>${messages.length}</b>récents</span><span><b>${urgent}</b>prioritaires</span><button id="mailTreatAll">${icon("sparkles")} Traiter mes e-mails</button></div></header><div class="mail-toolbar"><div class="mail-search">${icon("search")}<input id="mailSearch" placeholder="Rechercher dans les e-mails"></div><select id="mailCategory"><option value="all">Toutes les catégories</option>${[...new Set(messages.map(m => m.category))].map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}</select><div class="mail-view-toggle"><button class="active" data-mail-view="list">Liste</button><button data-mail-view="kanban">Kanban</button></div></div><div class="mail-workspace"><main><div class="mail-bulk"><span id="mailSelectedCount">0 sélectionné</span><button data-bulk-status="action" disabled>À traiter</button><button data-bulk-status="waiting" disabled>En attente</button><button data-bulk-status="done" disabled>Terminé</button></div><div id="mailMessages"></div></main><aside id="mailAssistantPanel" class="mail-assistant"></aside></div></section>`;
      document.querySelector("#mailSearch").oninput = renderMessages;
      document.querySelector("#mailCategory").onchange = renderMessages;
      document.querySelectorAll("[data-mail-view]").forEach(button => button.onclick = () => { mode = button.dataset.mailView; document.querySelectorAll("[data-mail-view]").forEach(x => x.classList.toggle("active", x === button)); renderMessages(); });
      document.querySelectorAll("[data-bulk-status]").forEach(button => button.onclick = () => bulk(button.dataset.bulkStatus));
      document.querySelector("#mailTreatAll").onclick = () => window.HIOSAssistant.prepare(`Analyse mes ${messages.length} e-mails récents : ${urgent} sont prioritaires. Aide-moi à organiser les réponses et actions, sans rien envoyer sans ma validation.`);
      renderMessages(); updateSelection();
      if (activeId) openMessage(activeId); else document.querySelector("#mailAssistantPanel").innerHTML = '<div class="mail-empty">Votre assistant affichera ici le résumé et les actions utiles.</div>';
    } catch (error) {
      container.innerHTML = `<section class="workspace-note">${esc(window.HIOSUI.message(error))} <button id="retryMail">Réessayer</button></section>`;
      document.querySelector("#retryMail").onclick = () => render(container);
    }
  }

  document.addEventListener("hios:authenticated", () => {
    const params = new URLSearchParams(location.search);
    if (params.get("oauth") === "mail-connected") {
      history.replaceState({}, "", location.pathname);
      setTimeout(() => window.HIOSNavigate?.("mail"), 50);
    }
  });
  window.HIOSMail = { render };
})();
