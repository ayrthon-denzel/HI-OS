function b64url(input){ return Buffer.from(input).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }

async function refreshGoogleTokens(tokens){
  if(!tokens?.refresh_token) return tokens;
  const res=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',refresh_token:tokens.refresh_token,grant_type:'refresh_token'})});
  const data=await res.json(); if(!res.ok) throw new Error('google_refresh_failed');
  return {...tokens,...data,refresh_token:tokens.refresh_token,refreshed_at:new Date().toISOString()};
}

async function gmailRequest(tokens,path,options={}){
  let t=tokens; if(!t?.access_token) t=await refreshGoogleTokens(t);
  let res=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`,{...options,headers:{authorization:`Bearer ${t.access_token}`,'content-type':'application/json',...(options.headers||{})}});
  if(res.status===401 && t.refresh_token){ t=await refreshGoogleTokens(t); res=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`,{...options,headers:{authorization:`Bearer ${t.access_token}`,'content-type':'application/json',...(options.headers||{})}}); }
  const data=await res.json(); if(!res.ok) throw new Error(`gmail_http_${res.status}`); return {data,tokens:t};
}

function decodePart(payload){
  const out=[]; const walk=p=>{ if(p?.body?.data && /^text\/(plain|html)/.test(p.mimeType||'')){ try{out.push(Buffer.from(p.body.data.replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8'));}catch{} } for(const c of p?.parts||[])walk(c); }; walk(payload); return out.join('\n').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}

async function listRecentMessages(tokens,query='newer_than:2d'){
  const {data,tokens:next}=await gmailRequest(tokens,`/messages?maxResults=50&q=${encodeURIComponent(query)}`); const items=[];
  for(const m of data.messages||[]){ const r=await gmailRequest(next,`/messages/${m.id}?format=full`); const headers=Object.fromEntries((r.data.payload?.headers||[]).map(h=>[String(h.name).toLowerCase(),h.value])); items.push({id:m.id,threadId:m.threadId,subject:headers.subject||'',from:headers.from||'',to:headers.to||'',date:headers.date||'',snippet:r.data.snippet||'',body:decodePart(r.data.payload)}); }
  return {messages:items,tokens:next};
}

async function sendEmail(tokens,{to,subject,body}){
  const raw=[`To: ${to}`,`Subject: ${subject}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','',body].join('\r\n');
  return gmailRequest(tokens,'/messages/send',{method:'POST',body:JSON.stringify({raw:b64url(raw)})});
}

module.exports={refreshGoogleTokens,listRecentMessages,sendEmail};
