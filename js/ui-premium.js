(() => {
  const $=s=>document.querySelector(s);
  const copilot=$('#copilot');
  const toggle=$('#toggleCopilot');
  const close=$('#closeCopilot');
  const backdrop=$('#copilotBackdrop');
  if(!copilot||!toggle||!backdrop)return;

  const setOpen=open=>{
    copilot.classList.toggle('open',open);
    backdrop.classList.toggle('open',open);
    toggle.setAttribute('aria-expanded',String(open));
    copilot.setAttribute('aria-hidden',String(!open));
    if(open)setTimeout(()=>$('#chatInput')?.focus(),80);
  };

  toggle.addEventListener('click',()=>setOpen(!copilot.classList.contains('open')));
  close?.addEventListener('click',()=>setOpen(false));
  backdrop.addEventListener('click',()=>setOpen(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
  document.querySelectorAll('[data-cmd]').forEach(btn=>btn.addEventListener('click',()=>setOpen(true)));
  document.addEventListener('hios:authenticated',()=>setOpen(false));
})();
