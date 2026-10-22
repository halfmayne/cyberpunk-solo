import {MASTER_PROMPT} from './prompt.mjs';
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const result=(status,body)=>new Response(JSON.stringify(body),{status,headers});
export default async (request)=>{
 if(request.method!=='POST')return result(405,{error:'Dozwolony wyłącznie POST'});
 const origin=request.headers.get('origin');const site=process.env.URL;if(origin&&site&&new URL(origin).origin!==new URL(site).origin)return result(403,{error:'Niedozwolone pochodzenie'});
 const pass=process.env.SOLO_ACCESS_SECRET;if(!pass)return result(503,{error:'Administrator musi ustawić SOLO_ACCESS_SECRET'});
 if(request.headers.get('x-solo-secret')!==pass)return result(401,{error:'Nieprawidłowe hasło narratora'});
 const key=process.env.OPENAI_API_KEY;if(!key)return result(503,{error:'Brak OPENAI_API_KEY w Netlify'});
 if(Number(request.headers.get('content-length')||0)>14000)return result(413,{error:'Zbyt duże żądanie'});
 let data;try{data=await request.json();}catch{return result(400,{error:'Nieprawidłowy JSON'});}
 const input=JSON.stringify(data);if(input.length>12000||!data||typeof data!=='object'||!data.event||!data.character||!data.scene)return result(400,{error:'Nieprawidłowy format zdarzenia'});
 try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);let response;try{response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5.5',instructions:MASTER_PROMPT,input:[{role:'user',content:`Oto zdarzenie zatwierdzone przez silnik. Opisz wyłącznie fikcję, bez zmian mechaniki:\n${input}`}],max_output_tokens:360,store:false}),signal:controller.signal});}finally{clearTimeout(timeout);}
 const payload=await response.json().catch(()=>({}));if(!response.ok)return result(502,{error:`LLM API HTTP ${response.status}`});const text=(payload.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n').trim();if(!text)return result(502,{error:'Model nie zwrócił tekstu'});return result(200,{text:text.slice(0,2400)});
 }catch(e){return result(502,{error:e.name==='AbortError'?'Przekroczono czas odpowiedzi narratora':'Usługa narracji chwilowo niedostępna'});}
};
