(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function api(path, opts={}) { return window.HIOSAuth.api(path, opts); }

  async function refreshDashboard(){
    try{
      const d=await api('/api/admin/dashboard');
      if ($('#pageTitle')?.textContent !== 'Command Center') return;
      $('#content').innerHTML = `
        <div class="grid kpis">
          ${kpi('Clients actifs',d.clients,'Base HI OS')}
          ${kpi('Missions actives',d.missions,'Toutes cellules')}
          ${kpi('Candidatures',d.applications,'En cours / envoyées')}
          ${kpi('Entretiens',d.interviews,'Escalade prioritaire')}
        </div>
        <div class="grid dashboard-grid">
          <section class="card"><p class="eyebrow">SYSTÈME</p><h3>HI OS opérationnel</h3><div class="activity">
            ${row('◈','HI Orchestrator','Routage sécurisé A0–A3','En ligne')}
            ${row('◫','Job Search Factory',`${d.missions} mission(s) active(s)`,'Multi-agents')}
            ${row('⚙','Agent Engine',`${d.agentRuns} exécution(s) sur 24 h`,'Journalisé')}
            ${row('◇','Security Layer','Isolation client + audit + sessions','Strict')}
          </div></section>
          <section class="card"><p class="eyebrow">PRIORITÉS</p><h3>Ce qui remonte au CEO</h3><div class="list"><div>Entretiens et tests importants</div><div>Actions A3 / engagements sensibles</div><div>Incidents sécurité ou intégration</div><div>Décisions commerciales hors règles</div></div></section>
        </div>`;
    }catch(e){ console.warn('dashboard unavailable',e.message); }
  }
  function kpi(label,val,small){return `<article class="card kpi"><span>${esc(label)}</span><strong>${esc(val)}</strong><small>${esc(small)}</small></article>`}
  function row(icon,name,text,status){return `<div class="activity-row"><div class="icon">${icon}</div><div><p><strong>${esc(name)}</strong> — ${esc(text)}</p><span>${esc(status)}</span></div></div>`}

  async function loadApprovals(){
    const list=$('#approvalList'), badge=$('#approvalCount');
    try{
      const data=await api('/api/admin/approvals'); const items=data.items||[]; badge.textContent=items.length;
      list.innerHTML=items.length?items.map(x=>`<article data-approval="${esc(x.id)}"><div><strong>${esc(x.action_type)}</strong><span>${new Date(x.requested_at).toLocaleString('fr-FR')}</span></div><p>${esc(JSON.stringify(x.payload))}</p><div><button class="ghost" data-decision="reject">Refuser</button><button data-decision="approve">Valider</button></div></article>`).join(''):'<p style="color:#8e98a5">Aucune validation A3 en attente.</p>';
      list.querySelectorAll('[data-decision]').forEach(btn=>btn.onclick=async()=>{const card=btn.closest('[data-approval]');await api(`/api/admin/approvals/${card.dataset.approval}/${btn.dataset.decision}`,{method:'POST',body:'{}'});await loadApprovals();});
    }catch{ list.innerHTML='<p style="color:#8e98a5">Validations indisponibles.</p>'; }
  }

  function wireCommand(){
    const form=$('#chatForm'), input=$('#chatInput'), messages=$('#messages'); if(!form||form.dataset.live==='1')return; form.dataset.live='1';
    form.addEventListener('submit', async e=>{
      e.preventDefault(); e.stopImmediatePropagation(); const text=input.value.trim(); if(!text)return;
      add('user',esc(text)); input.value=''; add('agent','Exécution en cours…');
      const pending=messages.lastElementChild;
      try{const out=await api('/api/orchestrate',{method:'POST',body:JSON.stringify({command:text})}); pending.innerHTML=`Mission routée vers :<div class="route">${(out.route||[]).map(r=>`<span>${esc(r)}</span>`).join('')}</div><br>Les actions A0–A2 sont exécutables dans leur périmètre. Les actions A3 restent bloquées jusqu’à validation.`;}
      catch(err){pending.textContent=`Mission non exécutée : ${err.message}`;}
    }, true);
    function add(type,html){const d=document.createElement('div');d.className=`msg ${type}`;d.innerHTML=html;messages.appendChild(d);messages.scrollTop=messages.scrollHeight;}
  }

  document.addEventListener('hios:authenticated',()=>{wireCommand();refreshDashboard();loadApprovals();});
  const open=$('#openApprovals'); if(open) open.addEventListener('click',loadApprovals,true);
  document.querySelectorAll('.nav button[data-page="command"]').forEach(b=>b.addEventListener('click',()=>setTimeout(refreshDashboard,0)));
})();
