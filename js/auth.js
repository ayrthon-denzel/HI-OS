(() => {
  const state = { user: null, ready: false };
  window.HIOSAuth = {
    get user(){ return state.user; },
    async api(url, options={}){
      const res = await fetch(url, { credentials:'same-origin', headers:{'content-type':'application/json', ...(options.headers||{})}, ...options });
      if (res.status === 401) { showLogin(); throw new Error('unauthorized'); }
      const ct = res.headers.get('content-type') || '';
      const body = ct.includes('application/json') ? await res.json() : await res.text();
      if (!res.ok) throw Object.assign(new Error(body?.error || 'request_failed'), { status:res.status, body });
      return body;
    },
    async logout(){ try{ await this.api('/api/auth/logout',{method:'POST',body:'{}'}); }catch{} state.user=null; showLogin(); }
  };

  function el(tag, attrs={}, children=[]){ const n=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>{ if(k==='class') n.className=v; else if(k==='text') n.textContent=v; else n.setAttribute(k,v); }); (Array.isArray(children)?children:[children]).filter(Boolean).forEach(c=>n.append(c)); return n; }

  const style = el('style',{text:`
    .auth-lock{position:fixed;inset:0;z-index:9999;background:#05070a;display:grid;place-items:center;padding:24px;overflow:auto}
    .auth-lock:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,5,8,.98),rgba(3,5,8,.78),rgba(3,5,8,.38)),url('/assets/brand-banner.jpg') center/cover;filter:saturate(.92);opacity:.88}
    .auth-lock:after{content:"";position:absolute;inset:0;background:radial-gradient(circle at 72% 8%,rgba(217,170,66,.18),transparent 30%),linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px);background-size:auto,44px 44px,44px 44px;pointer-events:none}
    .auth-lock.hidden{display:none}.auth-wrap{position:relative;z-index:2;width:min(1120px,100%);display:grid;grid-template-columns:minmax(0,1fr) 430px;align-items:center;gap:70px}.auth-intro{padding:20px}.auth-intro .kicker{color:#d9aa42;font-size:10px;font-weight:900;letter-spacing:.2em;text-transform:uppercase}.auth-intro h1{margin:12px 0 18px;font-size:clamp(52px,7vw,92px);line-height:.92;letter-spacing:-.065em;max-width:720px}.auth-intro h1 span{background:linear-gradient(90deg,#fff5d8,#d9aa42);-webkit-background-clip:text;background-clip:text;color:transparent}.auth-intro p{max-width:590px;color:#c7ccd1;line-height:1.65;font-size:13px}.auth-points{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}.auth-points span{font-size:9px;color:#f2cf78;padding:7px 10px;border:1px solid rgba(217,170,66,.2);background:rgba(217,170,66,.06);border-radius:999px}
    .auth-box{width:100%;background:linear-gradient(180deg,rgba(16,22,30,.96),rgba(8,12,17,.98));border:1px solid rgba(217,170,66,.24);border-radius:28px;padding:28px;box-shadow:0 34px 120px rgba(0,0,0,.66);backdrop-filter:blur(22px);position:relative;overflow:hidden}.auth-box:before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,rgba(242,207,120,.65),transparent)}.auth-box:after{content:"";position:absolute;width:180px;height:180px;border-radius:50%;right:-85px;top:-100px;background:radial-gradient(circle,rgba(217,170,66,.16),transparent 65%);pointer-events:none}
    .auth-brand{position:relative;display:flex;gap:14px;align-items:center;margin-bottom:26px}.auth-brand img{width:62px;height:62px;border-radius:17px;object-fit:cover;border:1px solid rgba(217,170,66,.25);box-shadow:0 12px 28px rgba(0,0,0,.35)}.auth-brand strong{display:block;font-size:23px;letter-spacing:.13em}.auth-brand span{display:block;color:#d9aa42;font-size:9px;letter-spacing:.16em;text-transform:uppercase;margin-top:4px}
    .auth-box h2{margin:0 0 7px;font-size:25px;letter-spacing:-.03em}.auth-box p{color:#8e98a5;font-size:12px;line-height:1.6}.auth-form{display:grid;gap:11px;margin-top:20px}.auth-form input{width:100%;border:1px solid rgba(255,255,255,.09);background:#0a1017;color:#f7f4ec;padding:14px;border-radius:13px;outline:none;transition:.18s}.auth-form input:focus{border-color:rgba(217,170,66,.5);box-shadow:0 0 0 3px rgba(217,170,66,.06)}.auth-form button{margin-top:3px;padding:13px;background:linear-gradient(135deg,#f2cf78,#d9aa42);border:0;border-radius:13px;color:#171109;font-weight:900;cursor:pointer;box-shadow:0 12px 28px rgba(217,170,66,.15)}.auth-error{min-height:18px;color:#ff8989;font-size:10px}.auth-meta{margin-top:17px;padding-top:15px;border-top:1px solid rgba(255,255,255,.07);font-size:9px;color:#66717d;line-height:1.5}.auth-user-pill{position:fixed;right:405px;top:28px;z-index:60;background:rgba(8,12,17,.94);border:1px solid rgba(217,170,66,.16);border-radius:999px;padding:8px 11px;color:#c9d0d7;font-size:9px;display:none;gap:8px;align-items:center;backdrop-filter:blur(12px)}.auth-user-pill.show{display:flex}.auth-user-pill button{padding:4px 8px;font-size:8px;background:transparent;color:#d9aa42;border:0;box-shadow:none}
    @media(max-width:1180px){.auth-wrap{grid-template-columns:1fr 400px;gap:35px}.auth-user-pill{right:24px;top:82px}}
    @media(max-width:820px){.auth-lock{padding:14px}.auth-wrap{grid-template-columns:1fr;gap:18px;width:min(560px,100%)}.auth-intro{padding:12px 6px}.auth-intro h1{font-size:52px;margin:8px 0 10px}.auth-intro p{font-size:12px}.auth-points{margin-top:14px}.auth-box{padding:22px;border-radius:23px}.auth-user-pill{right:14px;top:68px}}
    @media(max-width:520px){.auth-intro h1{font-size:43px}.auth-intro p{display:none}.auth-points{display:none}.auth-brand img{width:52px;height:52px}.auth-brand strong{font-size:20px}.auth-box{padding:19px}.auth-lock:before{background:linear-gradient(180deg,rgba(3,5,8,.58),rgba(3,5,8,.96)),url('/assets/brand-banner.jpg') center/cover}}
  `});
  document.head.append(style);

  const email = el('input',{type:'email',autocomplete:'username',placeholder:'Adresse e-mail'});
  const password = el('input',{type:'password',autocomplete:'current-password',placeholder:'Mot de passe'});
  const otp = el('input',{type:'text',inputmode:'numeric',autocomplete:'one-time-code',placeholder:'Code MFA (si activé)'});
  const error = el('div',{class:'auth-error'});
  const form = el('form',{class:'auth-form'},[email,password,otp,error,el('button',{type:'submit',text:'Entrer dans HI OS ↗'})]);
  const box = el('div',{class:'auth-box'},[
    el('div',{class:'auth-brand'},[el('img',{src:'/assets/hi-logo-crop.png',alt:'HI'}),el('div',{},[el('strong',{text:'HI OS'}),el('span',{text:'Digital • Software • Growth'})])]),
    el('h2',{text:'Accès sécurisé'}),el('p',{text:'Console privée HI MARKETING. Tes opérations, clients et agents sont isolés et journalisés.'}),form,
    el('div',{class:'auth-meta',text:'SESSION HTTPONLY • MFA • RBAC • CHIFFREMENT • AUDIT • ISOLATION CLIENT'})
  ]);
  const intro = el('div',{class:'auth-intro'},[
    el('div',{class:'kicker',text:'HI MARKETING OPERATING SYSTEM'}),
    el('h1',{},[document.createTextNode('Pilote ton agence.'),el('br'),el('span',{text:'L’IA exécute.'})]),
    el('p',{text:'Un centre de commande unique pour piloter acquisition, création, clients, production, automatisations et services gérés par agents.'}),
    el('div',{class:'auth-points'},[el('span',{text:'MULTI-AGENTS'}),el('span',{text:'SECURITY FIRST'}),el('span',{text:'HUMAN A3 CONTROL'}),el('span',{text:'24/7 OPERATIONS'})])
  ]);
  const wrap = el('div',{class:'auth-wrap'},[intro,box]);
  const lock = el('div',{class:'auth-lock'},wrap); document.body.append(lock);
  const pill = el('div',{class:'auth-user-pill'},[el('span',{text:'HI OS'}),el('button',{type:'button',text:'Déconnexion'})]); document.body.append(pill);
  pill.querySelector('button').onclick = ()=>window.HIOSAuth.logout();

  function showLogin(message=''){ lock.classList.remove('hidden'); pill.classList.remove('show'); error.textContent=message; }
  function showApp(){ lock.classList.add('hidden'); pill.classList.add('show'); pill.querySelector('span').textContent = `${state.user?.fullName || state.user?.email || 'HI OS'} • ${state.user?.role || ''}`; document.dispatchEvent(new CustomEvent('hios:authenticated',{detail:state.user})); }

  form.addEventListener('submit', async e=>{
    e.preventDefault(); error.textContent='Connexion…';
    try{
      const res=await fetch('/api/auth/login',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({email:email.value,password:password.value,otp:otp.value})});
      const body=await res.json();
      if(!res.ok){ if(body.error==='mfa_required') throw new Error('Code MFA requis ou invalide.'); if(body.error==='database_unavailable') throw new Error('Base HI OS indisponible.'); throw new Error('Identifiants incorrects.'); }
      state.user=body.user; error.textContent=''; showApp();
      if(body.user?.mustChangePassword) document.dispatchEvent(new CustomEvent('hios:password-change-required'));
    }catch(err){ error.textContent=err.message || 'Connexion impossible.'; }
  });

  (async()=>{
    try{ const res=await fetch('/api/auth/me',{credentials:'same-origin'}); if(res.ok){ const b=await res.json();state.user=b.user;showApp(); } else showLogin(); }
    catch{ showLogin('HI OS est temporairement indisponible.'); }
    state.ready=true;
  })();
})();
