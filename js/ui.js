(() => {
  const $ = (s) => document.querySelector(s);
  const labels = {
    clientId: "Client",
    projectId: "Projet associé",
    priority: "Priorité",
    deadline: "Échéance",
    dueAt: "À terminer avant",
    publishAt: "Date de publication",
    startsAt: "Début",
    endsAt: "Fin",
    itemType: "Type d’événement",
    documentType: "Type de document",
    cv: "CV du client",
  };
  const states = {
    active: "En cours",
    planned: "Planifié",
    review: "À valider",
    done: "Terminé",
    paused: "En pause",
    cancelled: "Annulé",
    todo: "À faire",
    doing: "En cours",
    blocked: "Bloqué",
    urgent: "Urgente",
    high: "Haute",
    normal: "Normale",
    low: "Basse",
    idea: "Idée",
    brief: "Consignes",
    creating: "Création",
    scheduled: "Programmé",
    published: "Publié",
    archived: "Archivé",
    draft: "Brouillon",
    sent: "Envoyé",
    signed: "Signé",
    task: "Tâche",
    meeting: "Rendez-vous",
    follow_up: "Relance",
    deadline: "Échéance",
    proposal: "Proposition",
    quote: "Devis",
    report: "Rapport",
    contract: "Contrat",
    brochure: "Plaquette",
    other: "Autre",
  };
  function message(e) {
    const code = e?.body?.error || e?.message || String(e);
    if (e?.status === 403) return "Votre compte n’a pas accès à cette action.";
    if (e?.status === 429)
      return "Trop de demandes. Patientez un instant avant de réessayer.";
    if (code === "unauthorized")
      return "Votre session a expiré. Connectez-vous à nouveau.";
    if (/required/.test(code))
      return "Complétez les champs obligatoires pour continuer.";
    if (/failed|unavailable|fetch|network|request|JSON/i.test(code))
      return "La demande n’a pas pu aboutir. Vérifiez votre connexion, puis réessayez.";
    return /[_{}]/.test(code)
      ? "Cette action est indisponible pour le moment. Réessayez dans un instant."
      : code;
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  document.body.append(toast);
  let timer;
  function notify(text, isError = false) {
    toast.textContent = text;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove("show"), 6000);
  }
  function enhance(root = document) {
    root.querySelectorAll("[data-icon]").forEach((n) => {
      n.innerHTML = window.HIOSIcons.icon(n.dataset.icon);
      n.removeAttribute("data-icon");
    });
    root.querySelectorAll("input,select,textarea").forEach((n) => {
      if (n.type === "hidden" || n.labels?.length || n.closest("label")) return;
      const text =
        n.getAttribute("aria-label") ||
        labels[n.name] ||
        n.placeholder ||
        {
          "deal-stage": "Étape du prospect",
          "content-stage": "État du contenu",
          "project-stage": "État du projet",
          "task-stage": "État de la tâche",
        }[n.className] ||
        "Rechercher";
      const l = document.createElement("label");
      l.className = "field" + (n.classList.contains("full") ? " full" : "");
      const t = document.createElement("span");
      t.textContent = text + (n.required ? " *" : "");
      l.append(t);
      n.before(l);
      l.append(n);
    });
    root.querySelectorAll(".tag,.status,.agent-tile>span").forEach((n) => {
      if (states[n.textContent]) n.textContent = states[n.textContent];
    });
    root.querySelectorAll("button").forEach((b) => {
      if (b.textContent.trim() === "×") {
        b.innerHTML = window.HIOSIcons.icon("close");
        b.setAttribute("aria-label", "Fermer");
        b.classList.add("icon-button");
      }
    });
    root.querySelectorAll("dialog").forEach((d) => {
      if (!d.hasAttribute("aria-label") && !d.hasAttribute("aria-labelledby"))
        d.setAttribute(
          "aria-label",
          d.querySelector("h2")?.textContent || "Formulaire",
        );
    });
    root.querySelectorAll(".workspace-form").forEach((f) => {
      if (f.dataset.enhanced || !f.onsubmit) return;
      f.dataset.enhanced = "1";
      const submit = f.onsubmit;
      f.onsubmit = async (e) => {
        e.preventDefault();
        if (f.dataset.busy) return;
        f.dataset.busy = "1";
        const btn = f.querySelector('button[type="submit"],button:not([type])');
        if (btn) btn.disabled = true;
        f.setAttribute("aria-busy", "true");
        let status = f.querySelector(".form-status");
        if (!status) {
          status = document.createElement("p");
          status.className = "form-status full";
          status.setAttribute("role", "status");
          f.append(status);
        }
        status.textContent = "Enregistrement…";
        try {
          await submit(e);
          if (!f.isConnected) notify("Enregistrement effectué.");
          else status.textContent = "";
        } catch (err) {
          status.textContent = message(err);
          status.classList.add("error");
        } finally {
          delete f.dataset.busy;
          f.removeAttribute("aria-busy");
          if (btn) btn.disabled = false;
        }
      };
    });
    root.querySelectorAll(".deal-stage,.content-stage").forEach((s) => {
      if (s.dataset.enhanced || !s.onchange) return;
      s.dataset.enhanced = "1";
      let previous = s.value;
      const change = s.onchange;
      s.onchange = async (e) => {
        s.disabled = true;
        try {
          await change(e);
          previous = s.value;
          notify("Modification enregistrée.");
        } catch (err) {
          s.value = previous;
          notify(message(err), true);
        } finally {
          s.disabled = false;
        }
      };
    });
  }
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {
      observer.disconnect();
      enhance();
      observe();
      queued = false;
    });
  });
  const observe = () =>
    observer.observe(document.body, { childList: true, subtree: true });
  observe();
  function closeMenu() {
    document.body.classList.remove("menu-open");
    $("#menuToggle")?.setAttribute("aria-expanded", "false");
    $("#navBackdrop").hidden = true;
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("#menuToggle")) {
      const open = !document.body.classList.contains("menu-open");
      document.body.classList.toggle("menu-open", open);
      $("#menuToggle").setAttribute("aria-expanded", String(open));
      $("#navBackdrop").hidden = !open;
      if (open) $("#nav button")?.focus();
    }
    if (e.target.closest("#navBackdrop")) {
      closeMenu();
      $("#menuToggle").focus();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("menu-open")) {
      closeMenu();
      $("#menuToggle").focus();
    }
    if (e.key === "Tab" && document.body.classList.contains("menu-open")) {
      const els = [
        ...$("#sidebar").querySelectorAll("a,button,summary"),
      ].filter((x) => x.getClientRects().length);
      if (e.shiftKey && document.activeElement === els[0]) {
        e.preventDefault();
        els.at(-1).focus();
      } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
        e.preventDefault();
        els[0].focus();
      }
    }
  });
  window.HIOSUI = {
    enhance,
    message,
    notify,
    closeMenu,
    label: (v) => states[v] || v,
  };
  enhance();
})();
