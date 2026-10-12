import {authenticate} from './auth.mjs';
import {page} from './ui.mjs';

const common = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
const json = (data, status=200) => new Response(JSON.stringify(data), {status,headers:{...common,'Content-Type':'application/json; charset=utf-8'}});
const states = {pending:0, published:1, trash:-1};
async function readBody(request) {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) throw Error('input');
  const reader=request.body?.getReader(); if(!reader) throw Error('input');
  let size=0, text=''; const decoder=new TextDecoder();
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();throw Error('input');}text+=decoder.decode(value,{stream:true});}
  return JSON.parse(text+decoder.decode());
}

// Dependency injection is used by isolated tests; production always verifies signed Access tokens.
export function createHandler(verify=authenticate) {
  return async function handle(request, env) {
    if (!env.DB || !env.ADMIN_EMAIL || !env.ACCESS_ISSUER || !env.ACCESS_AUD || !env.ADMIN_ORIGIN) return json({error:'not configured'},503);
    const url=new URL(request.url);
    if(url.origin!==env.ADMIN_ORIGIN) return json({error:'host'},403);
    try {await verify(request,env);} catch {return json({error:'请重新登录。'},401);}
    if(request.method==='GET' && url.pathname==='/') {
      const nonce=crypto.randomUUID();
      return new Response(page(nonce),{headers:{...common,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`}});
    }
    try {
      if(url.pathname==='/api/messages' && request.method==='GET') {
        const state=url.searchParams.get('state')||'pending', before=url.searchParams.get('before');
        if(!Object.hasOwn(states,state) || (before && (!/^\d+$/.test(before)||!Number.isSafeInteger(Number(before)))))return json({error:'参数无效。'},400);
        const results=await env.DB.batch([
          env.DB.prepare('SELECT id,name,message,created,approved FROM messages WHERE approved=? AND id<? ORDER BY id DESC LIMIT 31').bind(states[state],before?Number(before):Number.MAX_SAFE_INTEGER),
          env.DB.prepare('SELECT approved,COUNT(*) AS count FROM messages GROUP BY approved')
        ]);
        const rows=results[0].results,counts={pending:0,published:0,trash:0};
        for(const [name,value] of Object.entries(states))counts[name]=results[1].results.find(r=>r.approved===value)?.count||0;
        return json({messages:rows.slice(0,30),next:rows.length>30?String(rows[29].id):'',counts});
      }
      if(url.pathname==='/api/moderate' && request.method==='POST') {
        if(request.headers.get('Origin')!==env.ADMIN_ORIGIN || request.headers.get('X-MX-Admin')!=='1')return json({error:'请求来源无效。'},403);
        const data=await readBody(request);
        if(!data || !Object.hasOwn(states,data.from) || !['publish','hide','trash','restore'].includes(data.action) || !Array.isArray(data.ids) || !data.ids.length || data.ids.length>30 || data.ids.some(id=>!Number.isSafeInteger(id)||id<1))return json({error:'参数无效。'},400);
        const target={publish:1,hide:0,trash:-1,restore:0}[data.action];
        if((data.from==='trash' && data.action!=='restore') || (data.from!=='trash' && data.action==='restore') || target===states[data.from])return json({error:'操作不适用。'},400);
        const ids=[...new Set(data.ids)],marks=ids.map(()=>'?').join(',');
        // Compare the original state so a stale tab cannot overwrite a newer moderation decision.
        const result=await env.DB.prepare(`UPDATE messages SET approved=? WHERE approved=? AND id IN (${marks})`).bind(target,states[data.from],...ids).run();
        return json({changed:result.meta.changes,requested:ids.length});
      }
      return json({error:'not found'},404);
    } catch(error) {
      if(error instanceof SyntaxError || error.message==='input')return json({error:'请求格式无效。'},400);
      return json({error:'暂时无法操作，请稍后重试。'},503);
    }
  };
}
