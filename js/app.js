const ICONS={
  home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8v9.7a.5.5 0 0 1-.5.5H15v-6H9v6H3.5a.5.5 0 0 1-.5-.5z"/><path d="M9 21v-6h6v6"/></svg>',
  users:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2"/><path d="M16 3.5a4 4 0 0 1 0 7.5M18 13a6 6 0 0 1 4 5.6V21"/></svg>',
  target:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>',
  briefcase:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>',
  sparkles:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.6 4.2L18 9l-4.4 1.8L12 15l-1.6-4.2L6 9l4.4-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8zM5 3l.8 2.2L8 6l-2.2.8L5 9l-.8-2.2L2 6l2.2-.8z"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2"/></svg>',
  file:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
  settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3.1 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3.1V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>'
};
const icon=n=>`<span class="nav-svg">${ICONS[n]||ICONS.sparkles}</span>`;
const modules=[
{section:'Principal',key:'command',icon:'home',name:'Accueil'},
{section:'Business',key:'crm',icon:'users',name:'Clients',perm:'A2',desc:'Retrouve tes clients, missions, relances et prochaines actions.'},
{section:'Business',key:'hunter',icon:'target',name:'Prospection',perm:'A2',desc:'Trouve, qualifie et suis les entreprises à contacter.'},
{section:'Travail',key:'web',icon:'briefcase',name:'Projets',perm:'A2',desc:'Suis les sites, applications, automatisations et livrables.'},
{section:'Travail',key:'designer',icon:'sparkles',name:'Contenus',perm:'A2',desc:'Crée et organise les visuels, vidéos, publications et campagnes.'},
{section:'Outils',key:'automation',icon:'sparkles',name:'IA & Assistants',perm:'A2',desc:'Accède aux agents spécialisés de HI OS.'},
{section:'Outils',key:'analytics',icon:'calendar',name:'Calendrier',perm:'A0',desc:'Lis les échéances, rendez-vous et relances.'},
{section:'Outils',key:'proposal',icon:'file',name:'Documents',perm:'A1',desc:'Prépare les devis, propositions, plaquettes et rapports.'},
{section:'Système',key:'knowledge',icon:'settings',name:'Paramètres',perm:'A1',desc:'Contrôle la configuration, la sécurité et les règles de HI OS.'}
];
const nav=document.querySelector('#nav');let last='';
modules.forEach(m=>{if(m.section!==last){const l=document.createElement('div');l.className='section-label';l.textContent=m.section;nav.appendChild(l);last=m.section;}const b=document.createElement('button');b.dataset.page=m.key;b.dataset.label=m.name;b.setAttribute('aria-label',m.name);b.innerHTML=`${icon(m.icon)}<span class="nav-name">${m.name}</span>`;b.onclick=()=>render(m.key);nav.appendChild(b);});
function setActive(key){document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===key));}
function commandPlaceholder(){return `<section class="workspace-empty"><div><strong>Préparation de ton espace…</strong><p>HI OS synchronise les données réelles.</p></div></section>`;}
async function render(key='command'){
  setActive(key);const m=modules.find(x=>x.key===key)||modules[0];document.querySelector('#pageTitle').textContent=m.name;const c=document.querySelector('#content');
  if(key==='command'){c.innerHTML=commandPlaceholder();document.dispatchEvent(new CustomEvent('hios:command-view'));return;}
  if(window.HIOSWorkspace?.render){await window.HIOSWorkspace.render(key,m);return;}
  c.innerHTML=`<section class="workspace-empty"><div><strong>${m.name}</strong><p>${m.desc}</p></div></section>`;
}
const dlg=document.querySelector('#approvalDialog');document.querySelector('#openApprovals').onclick=()=>dlg.showModal();document.querySelector('#closeApprovals').onclick=()=>dlg.close();render('command');
window.HIOSIcons={ICONS,icon};window.HIOSNavigate=render;
