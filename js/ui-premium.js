(() => {
  const $=s=>document.querySelector(s);
  const copilot=$('#copilot'),toggle=$('#toggleCopilot'),close=$('#closeCopilot'),backdrop=$('#copilotBackdrop');
  if(!copilot||!toggle||!backdrop)return;
  const setOpen=open=>{copilot.classList.toggle('open',open);backdrop.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));copilot.setAttribute('aria-hidden',String(!open));document.body.classList.toggle('copilot-open',open);if(open)setTimeout(()=>$('#chatInput')?.focus(),80);};
  toggle.addEventListener('click',()=>setOpen(!copilot.classList.contains('open')));close?.addEventListener('click',()=>setOpen(false));backdrop.addEventListener('click',()=>setOpen(false));document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false);});
  document.querySelectorAll('[data-cmd]').forEach(btn=>btn.addEventListener('click',()=>{const input=$('#chatInput');if(input)input.value=btn.dataset.cmd||'';setOpen(true);setTimeout(()=>$('#chatForm')?.requestSubmit(),100);}));
  document.addEventListener('hios:authenticated',()=>setOpen(false));
})();
