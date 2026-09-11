const agents = [
  {section:'Pilotage', key:'command', icon:'◈', name:'Command Center'},
  {section:'Commercial', key:'hunter', icon:'◎', name:'Contract Hunter'},
  {section:'Commercial', key:'crm', icon:'▦', name:'CRM & Sales'},
  {section:'Création', key:'designer', icon:'✦', name:'Master Designer'},
  {section:'Création', key:'social', icon:'◌', name:'Social Media'},
  {section:'Production', key:'web', icon:'⌘', name:'Web & Software'},
  {section:'Opérations', key:'inbox', icon:'✉', name:'Inbox Agent'},
  {section:'Opérations', key:'proposal', icon:'▤', name:'Proposals & Devis'},
  {section:'Système', key:'automation', icon:'⚙', name:'Automation Center'},
  {section:'Système', key:'analytics', icon:'⌁', name:'Analytics'},
  {section:'Système', key:'knowledge', icon:'◇', name:'Knowledge Base'}
];

const agentCopy = {
  hunter:{title:'Contract Hunter',sub:'Trouve, qualifie et active les meilleures opportunités commerciales pour HI MARKETING.',perm:'A2',tools:['Web & veille','CRM','Gmail','Scoring','Prospection'],stats:[['27','Prospects qualifiés'],['8','À contacter'],['4','Réponses'],['1','Devis']]},
  crm:{title:'CRM & Sales',sub:'Centralise prospects, clients, opportunités, relances et prochaines actions.',perm:'A2',tools:['CRM','Gmail','Calendar','Pipeline','Scoring'],stats:[['12','Opportunités'],['1.45M','Pipeline FCFA'],['5','Relances'],['3','RDV']]},
  social:{title:'Social Media Manager',sub:'Planifie, programme et mesure les contenus selon le niveau d’autonomie de chaque marque.',perm:'A2',tools:['Metricool','Meta','LinkedIn','TikTok','Analytics'],stats:[['9','Posts planifiés'],['4','Marques'],['3','À valider'],['+18%','Portée']]},
  web:{title:'Web & Software Agent',sub:'Développe, teste et maintient les sites, apps, CRM et automatisations de HI MARKETING.',perm:'A2',tools:['GitHub','Render','Tests','Logs','DB'],stats:[['5','Projets actifs'],['12','Tickets'],['3','Staging'],['99.9%','Uptime']]},
  inbox:{title:'Inbox Agent',sub:'Trie les messages, détecte les opportunités et exécute les réponses commerciales ordinaires.',perm:'A2',tools:['Gmail','CRM','Rules','Knowledge'],stats:[['23','Nouveaux'],['5','Commerciaux'],['2','Prioritaires'],['1','Validation']]},
  proposal:{title:'Proposals & Devis',sub:'Génère des propositions, devis et plaquettes cohérents avec les offres et la charte HI.',perm:'A1',tools:['Templates','Tarifs','CRM','PDF','Portfolio'],stats:[['4','Devis ouverts'],['2','À envoyer'],['650K','Valeur'],['15 j','Validité']]},
  automation:{title:'Automation Center',sub:'Supervise les workflows, déclencheurs, webhooks, files de tâches et journaux d’exécution.',perm:'A2',tools:['n8n','Webhooks','Cron','Queue','Audit'],stats:[['14','Workflows'],['11','Actifs'],['126','Runs/j'],['98.7%','Succès']]},
  analytics:{title:'Analytics Agent',sub:'Mesure acquisition, ventes, social, production et rentabilité pour guider les décisions.',perm:'A0',tools:['CRM','Social','Web','Finance','Reports'],stats:[['1.45M','Pipeline'],['19%','Conversion'],['+24%','Trafic'],['7.2x','ROI']]},
  knowledge:{title:'Knowledge Base',sub:'Mémoire officielle de HI MARKETING : offres, tarifs, charte, procédures, références et règles.',perm:'A1',tools:['Docs','Drive','Vector DB','Brand kit','Policies'],stats:[['126','Documents'],['18','Règles'],['7','Marques'],['100%','Indexé']]}
};

const nav = document.querySelector('#nav'); let lastSection='';
agents.forEach(a=>{if(a.section!==lastSection){const label=document.createElement('div');label.className='section-label';label.textContent=a.section;nav.appendChild(label);lastSection=a.section}const b=document.createElement('button');b.dataset.page=a.key;b.innerHTML=`<span>${a.icon}</span>${a.name}`;b.onclick=()=>render(a.key);nav.appendChild(b)});

function setActive(key){document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===key));}
function dashboard(){return `
  <div class="grid kpis">
    ${kpi('Pipeline commercial','1 450 000 FCFA','+18 % ce mois')}${kpi('Prospects qualifiés','27','8 prioritaires')}${kpi('Actions IA aujourd’hui','46','11 agents actifs')}${kpi('Validations requises','3','A3 seulement')}
  </div>
  <div class="grid dashboard-grid">
    <section class="card"><h3>Activité des agents</h3><div class="activity">
      ${activity('◎','Contract Hunter','8 nouveaux prospects qualifiés à Dakar','il y a 12 min')}
      ${activity('✦','Master Designer','3 contenus préparés pour la semaine HI MARKETING','il y a 28 min')}
      ${activity('✉','Inbox Agent','Réponse positive détectée — demande de devis','il y a 41 min','Priorité')}
      ${activity('⌘','Web Agent','Build staging terminé — prêt pour QA','il y a 1 h')}
      ${activity('⚙','Automation Center','Relance commerciale programmée pour 16:00','il y a 2 h')}
    </div></section>
    <section class="card"><h3>Pipeline HI MARKETING</h3><div class="pipeline">
      ${pipe('Identifiés',48,100)}${pipe('Qualifiés',27,72)}${pipe('Contactés',19,54)}${pipe('Réponses',7,32)}${pipe('Propositions',3,18)}${pipe('Closing',1,9)}
      <div class="metric-row" style="margin-top:14px"><span>Valeur potentielle</span><strong>1,45 M FCFA</strong></div>
    </div></section>
  </div>`}
function kpi(label,val,small){return `<article class="card kpi"><span>${label}</span><strong>${val}</strong><small>${small}</small></article>`}
function activity(icon,name,text,time,priority=''){return `<div class="activity-row"><div class="icon">${icon}</div><div><p><strong>${name}</strong> — ${text}</p><span class="${priority?'priority':''}">${priority||'Exécution autonome'}</span></div><time>${time}</time></div>`}
function pipe(name,val,w){return `<div><div class="metric-row"><span>${name}</span><strong>${val}</strong></div><div class="bar"><i style="width:${w}%"></i></div></div>`}

function masterDesigner(){return `
  <section class="card designer-hero"><p class="eyebrow">AGENT CRÉATIF • A2</p><h2>Master Designer</h2><p>Direction artistique, production visuelle, calendrier éditorial et déclinaisons multiformats — en respectant le logo et la charte HI MARKETING.</p><div class="hero-actions"><button data-inject="Master Designer, prépare la semaine complète de contenu HI MARKETING.">Créer la semaine</button><button class="ghost" data-inject="Master Designer, analyse la cohérence de la charte sur les contenus en attente.">Contrôler la charte</button></div></section>
  <div class="grid kpis">${kpi('Contenus à produire','6','2 urgents')}${kpi('Programmés','9','7 prochains jours')}${kpi('Validations','3','Publication sensible')}${kpi('Marques actives','4','Kits chargés')}</div>
  <div class="grid content-grid">
    <article class="card post-preview"><small>HI CLEAN GROWTH</small><h3>Plus de marchés. Plus de contrats.</h3><p>Déclinaison LinkedIn • 1080×1350</p></article>
    <article class="card"><p class="eyebrow">BRAND KIT</p><h3>HI MARKETING</h3><div class="list"><div>Logo principal — Or / Blanc</div><div>Fond — Noir / Bleu nuit</div><div>Signature — Digital • Software • Growth</div><div>Style — Premium, tech, corporate</div></div></article>
    <article class="card"><p class="eyebrow">AUTONOMIE</p><h3>Niveau 2</h3><p style="color:var(--muted);line-height:1.55">Création et programmation automatiques dans la charte. Validation uniquement pour changement de direction artistique ou contenu réputationnel sensible.</p><button data-inject="Master Designer, montre-moi les 3 publications qui nécessitent une validation.">Voir les validations</button></article>
  </div>`}

function hunter(){return `
  ${agentHero(agentCopy.hunter)}
  <section class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="margin:0">Prospects prioritaires</h3><button data-inject="Contract Hunter, qualifie les 5 meilleurs prospects et prépare les messages d'approche.">Activer le top 5</button></div>
  <table class="table"><thead><tr><th>Entreprise</th><th>Signal</th><th>Service</th><th>Score</th><th>Statut</th></tr></thead><tbody>
  <tr><td>Entreprise Alpha</td><td>Site obsolète + recrutement digital</td><td>Refonte + Growth</td><td class="score">94</td><td><span class="status">Qualifié</span></td></tr>
  <tr><td>Groupe Horizon</td><td>Expansion / nouveau point de vente</td><td>CRM + Acquisition</td><td class="score">89</td><td><span class="status">À contacter</span></td></tr>
  <tr><td>CleanPro Dakar</td><td>Faible prospection digitale</td><td>HI Clean Growth</td><td class="score">87</td><td><span class="status">Qualifié</span></td></tr>
  <tr><td>Studio Nova</td><td>Lancement nouvelle offre</td><td>Social + Site</td><td class="score">82</td><td><span class="status">Veille</span></td></tr>
  </tbody></table></section>`}

function genericAgent(key){const a=agentCopy[key];return `${agentHero(a)}<div class="grid agent-grid">
  <article class="card agent-card"><h3>Mission <span class="perm">${a.perm}</span></h3><p>${a.sub}</p><div class="list"><div>Exécution autonome dans les règles validées</div><div>Journalisation de chaque action</div><div>Escalade uniquement si seuil A3</div></div></article>
  <article class="card agent-card"><h3>Outils</h3><div class="list">${a.tools.map(t=>`<div>${t}</div>`).join('')}</div></article>
  <article class="card agent-card"><h3>Actions rapides</h3><div class="list"><div data-inject="${a.title}, exécute les tâches prioritaires du jour.">Exécuter les priorités</div><div data-inject="${a.title}, fais un audit rapide et signale seulement les blocages.">Audit rapide</div><div data-inject="${a.title}, prépare le rapport de performance.">Rapport</div></div></article>
  </div>`}
function agentHero(a){return `<section class="agent-hero"><div class="card agent-title"><p class="eyebrow">AGENT ${a.perm}</p><h2>${a.title}</h2><p>${a.sub}</p><div class="agent-badges">${a.tools.map(t=>`<span class="pill">${t}</span>`).join('')}</div></div><div class="card agent-stat">${a.stats.map(([v,l])=>`<div class="mini"><strong>${v}</strong><span>${l}</span></div>`).join('')}</div></section>`}

function render(key='command'){
  setActive(key); const a=agents.find(x=>x.key===key); document.querySelector('#pageTitle').textContent=a?.name||'Command Center';
  const c=document.querySelector('#content'); if(key==='command')c.innerHTML=dashboard(); else if(key==='designer')c.innerHTML=masterDesigner(); else if(key==='hunter')c.innerHTML=hunter(); else c.innerHTML=genericAgent(key);
  bindInject();
}
function bindInject(){document.querySelectorAll('[data-inject]').forEach(el=>{el.style.cursor='pointer';el.onclick=()=>{document.querySelector('#chatInput').value=el.dataset.inject;document.querySelector('#chatInput').focus();}})}

const messages=document.querySelector('#messages'); const form=document.querySelector('#chatForm'); const input=document.querySelector('#chatInput');
function routeCommand(text){const t=text.toLowerCase();let route=['HI Orchestrator'];if(t.includes('designer')||t.includes('post')||t.includes('contenu')||t.includes('visuel')) route.push('Master Designer','Social Media');if(t.includes('prospect')||t.includes('entreprise')||t.includes('contrat')) route.push('Contract Hunter','CRM & Sales');if(t.includes('mail')||t.includes('réponse')||t.includes('inbox')) route.push('Inbox Agent','CRM & Sales');if(t.includes('devis')||t.includes('proposition')) route.push('Proposal Agent');if(t.includes('site')||t.includes('app')||t.includes('crm')||t.includes('code')) route.push('Web & Software');if(route.length===1)route.push('Knowledge Agent');return [...new Set(route)]}
function addMessage(type,html){const d=document.createElement('div');d.className=`msg ${type}`;d.innerHTML=html;messages.appendChild(d);messages.scrollTop=messages.scrollHeight;}
form.addEventListener('submit',e=>{e.preventDefault();const text=input.value.trim();if(!text)return;addMessage('user',text);input.value='';const route=routeCommand(text);setTimeout(()=>{addMessage('agent',`Mission comprise. Je la route vers :<div class="route">${route.map(r=>`<span>${r}</span>`).join('')}</div><br>Le système exécutera les étapes autorisées en A0–A2 et te demandera une validation seulement si une action A3 est requise.`)},350)});
document.querySelectorAll('[data-cmd]').forEach(b=>b.onclick=()=>{input.value=b.dataset.cmd;form.requestSubmit()});
const dlg=document.querySelector('#approvalDialog');document.querySelector('#openApprovals').onclick=()=>dlg.showModal();document.querySelector('#closeApprovals').onclick=()=>dlg.close();
render('command');
