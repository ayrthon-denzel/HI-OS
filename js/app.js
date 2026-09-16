const modules = [
  { section: "Principal", key: "command", icon: "home", name: "Accueil" },
  {
    section: "Votre activité",
    key: "crm",
    icon: "users",
    name: "Clients",
    perm: "A2",
    desc: "Retrouve tes clients, missions, relances et prochaines actions.",
  },
  {
    section: "Votre activité",
    key: "hunter",
    icon: "target",
    name: "Prospection",
    perm: "A2",
    desc: "Trouve, qualifie et suis les entreprises à contacter.",
  },
  {
    section: "Votre activité",
    key: "web",
    icon: "briefcase",
    name: "Projets",
    perm: "A2",
    desc: "Suis les sites, applications, automatisations et livrables.",
  },
  {
    section: "Votre activité",
    key: "designer",
    icon: "sparkles",
    name: "Contenus",
    perm: "A2",
    desc: "Crée et organise les visuels, vidéos, publications et campagnes.",
  },
  {
    section: "Votre activité",
    key: "automation",
    icon: "sparkles",
    name: "Assistants",
    perm: "A2",
    desc: "Accède à vos assistants spécialisés.",
  },
  {
    section: "Votre activité",
    key: "analytics",
    icon: "calendar",
    name: "Calendrier",
    perm: "A0",
    desc: "Lis les échéances, rendez-vous et relances.",
  },
  {
    section: "Votre activité",
    key: "proposal",
    icon: "file",
    name: "Documents",
    perm: "A1",
    desc: "Prépare les devis, propositions, plaquettes et rapports.",
  },
  {
    section: "Système",
    key: "knowledge",
    icon: "settings",
    name: "Paramètres",
    perm: "A1",
    desc: "Contrôle la configuration, la sécurité et les règles de votre espace.",
  },
];
const { icon } = window.HIOSIcons;
const nav = document.querySelector("#nav");
function buildNavigation(user = window.HIOSAuth?.user) {
 nav.innerHTML = "";
 const extra = document.createElement("details");
 extra.className = "nav-more";
 extra.innerHTML = '<summary>Autres outils</summary><div id="secondaryNav"></div>';
 const enabled = new Set(user?.enabledModules || []);
 document.querySelector("#toggleCopilot").hidden = user?.space === "client" && !enabled.has("automation");
 modules.filter((m) => m.key === "command" || user?.space === "hi_marketing" || enabled.has(m.key)).forEach((m) => {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.page = m.key;
  b.dataset.label = m.name;
  b.setAttribute("aria-label", m.name);
  b.innerHTML = `${icon(m.icon)}<span class="nav-name">${m.name}</span>`;
  b.onclick = () => render(m.key);
  if (["analytics", "knowledge"].includes(m.key)) {
    extra.querySelector("div").append(b);
  } else nav.append(b);
 });
 if (extra.querySelector("button")) nav.append(extra);
}
buildNavigation();
function setActive(key) {
  document.querySelectorAll(".nav button").forEach((b) => {
    b.classList.toggle("active", b.dataset.page === key);
    if (b.dataset.page === key) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  window.HIOSUI?.closeMenu();
}
function commandPlaceholder() {
  return `<section class="workspace-empty"><div><strong>Préparation de votre espace…</strong><p>Synchronisation des données en cours.</p></div></section>`;
}
async function render(key = "command") {
  const user = window.HIOSAuth?.user;
  if (key !== "command" && user?.space === "client" && !(user.enabledModules || []).includes(key)) key = "command";
  window.scrollTo(0, 0);
  setActive(key);
  const m = modules.find((x) => x.key === key) || modules[0];
  document.querySelector("#pageTitle").textContent = m.name;
  const c = document.querySelector("#content");
  c.dataset.view = key;
  if (key === "command") {
    c.innerHTML = commandPlaceholder();
    document.dispatchEvent(new CustomEvent("hios:command-view"));
    return;
  }
  if (window.HIOSWorkspace?.render) {
    await window.HIOSWorkspace.render(key, m);
    return;
  }
  c.innerHTML = `<section class="workspace-empty"><div><strong>${m.name}</strong><p>${m.desc}</p></div></section>`;
}
const dlg = document.querySelector("#approvalDialog");
document.querySelector("#openApprovals").onclick = () => dlg.showModal();
document.querySelector("#closeApprovals").onclick = () => dlg.close();
render("command");
window.HIOSNavigate = render;
document.addEventListener("hios:authenticated", (e) => {
  buildNavigation(e.detail);
  render("command");
});
