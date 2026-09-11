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
    .auth-lock{position:fixed;inset:0;z-index:9999;background:radial-gradient(circle at 60% 0,rgba(213,167,66,.12),transparent 34%),#06080b;display:grid;place-items:center;padding:22px}
    .auth-lock.hidden{display:none}.auth-box{width:min(440px,100%);background:linear-gradient(180deg,#10161e,#090d12);border:1px solid rgba(255,255,255,.1);border-radius:26px;padding:26px;box-shadow:0 32px 100px rgba(0,0,0,.6)}
    .auth-brand{display:flex;gap:14px;align-items:center;margin-bottom:24px}.auth-brand img{width:58px;height:58px;border-radius:14px;object-fit:cover}.auth-brand strong{display:block;font-size:22px;letter-spacing:.1em}.auth-brand span{display:block;color:#d5a742;font-size:10px;letter-spacing:.12em;text-transform:uppercase;margin-top:4px}
    .auth-box h2{margin:0 0 7px}.auth-box p{color:#8e98a5;font-size:13px;line-height:1.5}.auth-form{display:grid;gap:11px;margin-top:18px}.auth-form input{width:100%;border:1px solid rgba(255,255,255,.1);background:#0b1118;color:#f5f3ee;padding:13px 14px;border-radius:12px;outline:none}.auth-form input:focus{border-color:rgba(213,167,66,.6)}.auth-form button{margin-top:4px;padding:12px}.auth-error{min-height:18px;color:#ff8a8a;font-size:11px}.auth-meta{margin-top:15px;padding-top:15px;border-top:1px solid rgba(255,255,255,.08);font-size:10px;color:#66717d}.auth-user-pill{position:fixed;right:405px;top:28px;z-index:20;background:#0d1219;border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:8px 11px;color:#c9d0d7;font-size:10px;display:none;gap:8px;align-items:center}.auth-user-pill.show{display:flex}.auth-user-pill button{padding:4px 8px;font-size:9px;background:transparent;color:#d5a742}
    @media(max-width:1280px){.auth-user-pill{right:24px;top:82px}}`});
  document.head.append(style);

  const email = el('input',{type:'email',autocomplete:'username',placeholder:'Adresse e-mail'});
  const password = el('input',{type:'password',autocomplete:'current-password',placeholder:'Mot de passe'});
  const otp = el('input',{type:'text',inputmode:'numeric',autocomplete:'one-time-code',placeholder:'Code MFA (si activé)'});
  const error = el('div',{class:'auth-error'});
  const form = el('form',{class:'auth-form'},[email,password,otp,error,el('button',{type:'submit',text:'Accéder à HI OS ↗'})]);
  const box = el('div',{class:'auth-box'},[
    el('div',{class:'auth-brand'},[el('img',{src:'/assets/hi-logo-crop.png',alt:'HI'}),el('div',{},[el('strong',{text:'HI OS'}),el('span',{text:'Digital • Software • Growth'})])]),
    el('h2',{text:'Accès sécurisé'}),el('p',{text:'Console privée HI MARKETING. Les sessions sont chiffrées, limitées et journalisées.'}),form,
    el('div',{class:'auth-meta',text:'Sécurité : session HttpOnly • SameSite strict • RBAC • MFA • journal d’audit'})
  ]);
  const lock = el('div',{class:'auth-lock'},box); document.body.append(lock);
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
