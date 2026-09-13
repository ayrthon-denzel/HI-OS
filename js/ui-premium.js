(() => {
  const $=s=>document.querySelector(s);
  const copilot=$('#copilot'),toggle=$('#toggleCopilot'),close=$('#closeCopilot'),minimize=$('#minimizeCopilot'),backdrop=$('#copilotBackdrop');
  if(!copilot||!toggle||!backdrop)return;

  const setOpen=open=>{
    copilot.classList.remove('minimized');
    copilot.classList.toggle('open',open);
    backdrop.classList.toggle('open',open);
    toggle.setAttribute('aria-expanded',String(open));
    copilot.setAttribute('aria-hidden',String(!open));
    document.body.classList.toggle('copilot-open',open);
    if(open)setTimeout(()=>$('#chatInput')?.focus(),80);
  };
  const setMinimized=value=>{
    if(!copilot.classList.contains('open'))return;
    copilot.classList.toggle('minimized',value);
    backdrop.classList.toggle('open',!value);
    minimize.textContent=value?'□':'−';
    minimize.setAttribute('aria-label',value?'Agrandir l’assistant':'Réduire l’assistant');
    minimize.title=value?'Agrandir':'Réduire';
    document.body.classList.toggle('copilot-open',!value);
  };

  toggle.addEventListener('click',e=>{e.preventDefault();setOpen(!copilot.classList.contains('open'));});
  close?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setOpen(false);});
  minimize?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setMinimized(!copilot.classList.contains('minimized'));});
  backdrop.addEventListener('click',()=>setOpen(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&copilot.classList.contains('open'))setOpen(false);});
  copilot.addEventListener('click',e=>{if(copilot.classList.contains('minimized')&&!e.target.closest('button'))setMinimized(false);});
  document.querySelectorAll('[data-cmd]').forEach(btn=>btn.addEventListener('click',()=>{const input=$('#chatInput');if(input)input.value=btn.dataset.cmd||'';setOpen(true);setTimeout(()=>$('#chatForm')?.requestSubmit(),100);}));
  document.addEventListener('hios:authenticated',()=>setOpen(false));
  setOpen(false);
})();
