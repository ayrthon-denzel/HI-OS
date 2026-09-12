const API_URL=process.env.OPENAI_API_URL||'https://api.openai.com/v1/responses';
const MODEL=process.env.OPENAI_MODEL||'gpt-5.6-luna';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function extractText(response){const parts=[];for(const item of response?.output||[])for(const content of item?.content||[])if(content?.type==='output_text'&&content?.text)parts.push(content.text);return parts.join('\n').trim();}
function parseJson(text){if(!text)throw new Error('empty_ai_output');const stripped=text.replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();try{return JSON.parse(stripped);}catch{}const first=stripped.indexOf('{'),last=stripped.lastIndexOf('}'),a1=stripped.indexOf('['),a2=stripped.lastIndexOf(']');if(a1>=0&&a2>a1){try{return JSON.parse(stripped.slice(a1,a2+1));}catch{}}if(first>=0&&last>first)return JSON.parse(stripped.slice(first,last+1));throw new Error('invalid_ai_json');}

async function responses({input,instructions,webSearch=false}){
  if(!process.env.OPENAI_API_KEY)throw new Error('ai_not_configured');
  const body={model:MODEL,input,instructions,store:false};if(webSearch)body.tools=[{type:'web_search'}];
  for(let attempt=0;attempt<3;attempt++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
    try{
      const res=await fetch(API_URL,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${process.env.OPENAI_API_KEY}`},body:JSON.stringify(body),signal:controller.signal});
      let data={};try{data=await res.json();}catch{}
      if(res.ok)return{raw:data,text:extractText(data)};
      const code=String(data?.error?.code||data?.error?.type||'').toLowerCase();
      if(res.status===429){
        if(code.includes('insufficient_quota')||code.includes('billing'))throw new Error('ai_insufficient_quota');
        if(attempt<2){const retryAfter=Math.min(12,Math.max(1,Number(res.headers.get('retry-after'))||2**attempt));await wait(retryAfter*1000);continue;}
        throw new Error(code?`ai_rate_limited_${code}`:'ai_rate_limited');
      }
      if(res.status>=500&&attempt<2){await wait((2**attempt)*1000);continue;}
      if(res.status===401)throw new Error('ai_key_invalid');
      if(res.status===403)throw new Error('ai_access_forbidden');
      if(res.status===400&&code)throw new Error(`ai_bad_request_${code.slice(0,80)}`);
      throw new Error(`ai_http_${res.status}`);
    }finally{clearTimeout(timer);}
  }
  throw new Error('ai_request_failed');
}

async function findJobs(profile){
  const prompt=`Tu es Job Scout de HI OS. Recherche des offres réellement disponibles et récentes correspondant au profil suivant.\nPostes: ${(profile.target_roles||[]).join(', ')}\nZones: ${(profile.locations||[]).join(', ')}\nContrats: ${(profile.contract_types||[]).join(', ')}\nContraintes: ${JSON.stringify(profile.constraints||{})}\n\nRetourne UNIQUEMENT un tableau JSON de maximum 20 objets avec les clés: source, external_id, company, role_title, location, url, posted_at, score, rationale. score doit être 0-100. N'invente pas d'offre ni d'URL.`;
  const out=await responses({input:prompt,webSearch:true,instructions:'Utilise la recherche web. Privilégie les offres fraîches et vérifiables. Évite les doublons. N’invente aucune compétence ni offre.'});
  const parsed=parseJson(out.text),items=Array.isArray(parsed)?parsed:(parsed.items||[]);
  return items.slice(0,20).filter(x=>x&&x.company&&x.role_title&&x.url).map((x,i)=>({source:String(x.source||'web').slice(0,80),external_id:String(x.external_id||x.url||`web-${Date.now()}-${i}`).slice(0,300),company:String(x.company).slice(0,180),role_title:String(x.role_title).slice(0,180),location:String(x.location||'').slice(0,180),url:String(x.url).slice(0,1500),posted_at:x.posted_at||null,score:Math.max(0,Math.min(100,Number(x.score)||0)),rationale:String(x.rationale||'').slice(0,1000)}));
}

async function tailorApplication({cvText,opportunity,profile}){
  const prompt=`Tu es CV Tailor + Application Agent de HI OS. Adapte le dossier sans jamais inventer d'expérience, diplôme, compétence, résultat ou langue.\n\nCV source:\n${String(cvText||'').slice(0,22000)}\n\nOffre:\n${JSON.stringify(opportunity)}\n\nProfil cible:\n${JSON.stringify(profile||{})}\n\nRetourne UNIQUEMENT un objet JSON avec: tailored_cv_text, cover_letter, email_subject, email_body, fit_score, warnings. Le CV doit rester fidèle au CV source. warnings est un tableau des éventuels écarts.`;
  const out=await responses({input:prompt,instructions:'Priorité absolue à la vérité factuelle du CV source. Aucune invention. Style professionnel, ATS-friendly et concis.'});const p=parseJson(out.text);
  return{tailored_cv_text:String(p.tailored_cv_text||'').slice(0,30000),cover_letter:String(p.cover_letter||'').slice(0,10000),email_subject:String(p.email_subject||'').slice(0,300),email_body:String(p.email_body||'').slice(0,10000),fit_score:Math.max(0,Math.min(100,Number(p.fit_score)||0)),warnings:Array.isArray(p.warnings)?p.warnings.map(String).slice(0,20):[]};
}

async function orchestrate(command){const prompt=`Commande CEO: ${String(command||'').slice(0,4000)}\nRetourne UNIQUEMENT un objet JSON avec: summary, route (tableau d'agents), actions (tableau d'objets {agent,action,permission}), requires_human (booléen). Les permissions possibles sont A0,A1,A2,A3. Toute dépense, contrat, suppression irréversible, changement de droits admin ou publication sensible doit être A3.`;const out=await responses({input:prompt,instructions:'Tu es HI Orchestrator. Respecte le principe du moindre privilège et la politique A0-A3.'});return parseJson(out.text);}
module.exports={responses,findJobs,tailorApplication,orchestrate};
