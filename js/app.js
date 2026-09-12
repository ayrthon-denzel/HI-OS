const modules=[
{key:'command',icon:'⌂',name:'Accueil'},
{key:'crm',icon:'♙',name:'Clients',perm:'A2',desc:'Tes clients, tes opportunités et les prochaines actions au même endroit.',tools:['Clients','Pipeline','Relances','Gmail']},
{key:'hunter',icon:'⌘',name:'Prospection',perm:'A2',desc:'Trouver de nouveaux clients, qualifier les opportunités et préparer les prises de contact.',tools:['Recherche','Scoring','CRM','Gmail']},
{key:'web',icon:'▣',name:'Projets',perm:'A2',desc:'Piloter les sites, applications, automatisations et livraisons en cours.',tools:['GitHub','Render','QA','Database']},
{key:'designer',icon:'✦',name:'Contenus',perm:'A2',desc:'Créer les visuels, campagnes, contenus et déclinaisons de marque.',tools:['Brand','Social','Création','QA']},
{key:'automation',icon:'✺',name:'IA Assistants',perm:'A2',desc:'Lancer les assistants spécialisés et automatiser les tâches répétitives.',tools:['Agents','Workflows','Rules','Audit']},
{key:'jobfactory',icon:'◫',name:'Recherche emploi',perm:'A2',desc:'Gérer les missions de recherche d’emploi, candidatures et réponses.',tools:['Job Scout','CV Tailor','Gmail','Inbox Watcher']},
{key:'analytics',icon:'◷',name:'Calendrier',perm:'A0',desc:'Lire les échéances, activités et événements importants.',tools:['Agenda','Échéances','Activités','Suivi']},
{key:'proposal',icon:'▤',name:'Documents',perm:'A1',desc:'Préparer propositions, devis, plaquettes et documents commerciaux.',tools:['Templates','Tarifs','PDF','Portfolio']},
{key:'knowledge',icon:'⚙',name:'Paramètres',perm:'A1',desc:'Règles, connaissances, offres et paramètres de fonctionnement de HI OS.',tools:['Policies','Brand','Knowledge','Sécurité']}
];

const nav=document.querySelector('#nav');
modules.forEach(m=>{const b=document.createElement('button');b.dataset.page=m.key;b.dataset.label=m.name;b.setAttribute('aria-label',m.name);b.innerHTML=`<span>${m.icon}</span><strong>${m.name}</strong>`;b.onclick=()=>render(m.key);nav.appendChild(b);});

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function setActive(key){document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===key));}
function prompt(text){const input=document.querySelector('#chatInput');if(!input)return;input.value=text;input.focus();document.querySelector('#toggleCopilot')?.click();}
function commandPlaceholder(){return `<section class="workspace-empty"><div class="workspace-loader"></div><p>Chargement de ton espace…</p></section>`;}
function modulePage(m){return `<section class="simple-module-head"><div><p class="eyebrow">HI OS</p><h2>${esc(m.name)}</h2><p>${esc(m.desc)}</p></div><div class="simple-module-badge">${esc(m.perm||'')}</div></section><section class="simple-module-grid"><article class="simple-panel"><h3>Que veux-tu faire ?</h3><div class="simple-actions"><button data-prompt="${esc(m.name)}, exécute les tâches prioritaires du jour et ne me remonte que les blocages."><span>Commencer maintenant</span><small>HI OS s’occupe du reste</small><b>→</b></button><button data-prompt="${esc(m.name)}, fais un audit complet de ton périmètre et propose les prochaines actions."><span>Voir ce qui doit être fait</span><small>Priorités, risques et opportunités</small><b>→</b></button><button data-prompt="${esc(m.name)}, prépare un rapport exécutif bref avec résultats, anomalies et prochaines actions."><span>Faire un point rapide</span><small>Résumé clair et prochaines étapes</small><b>→</b></button></div></article><article class="simple-panel"><h3>Outils disponibles</h3><div class="tool-list">${m.tools.map(t=>`<span>${esc(t)}</span>`).join('')}</div><div class="simple-note">HI OS exécute automatiquement les actions autorisées. Les décisions sensibles restent toujours sous ta validation.</div></article></section>`;}
function render(key='command'){setActive(key);const m=modules.find(x=>x.key===key)||modules[0];document.querySelector('#pageTitle').textContent=m.name;const c=document.querySelector('#content');c.innerHTML=key==='command'?commandPlaceholder():modulePage(m);document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>prompt(b.dataset.prompt));if(key==='command')document.dispatchEvent(new CustomEvent('hios:command-view'));}
const dlg=document.querySelector('#approvalDialog');document.querySelector('#openApprovals').onclick=()=>dlg.showModal();document.querySelector('#closeApprovals').onclick=()=>dlg.close();render('command');
