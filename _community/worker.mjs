import {publicPage} from './public-pages.mjs';
import {publicDocuments} from './documents.mjs';
import {privateRequest} from './private.mjs';
const encoder=new TextEncoder();
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function body(request,limit=8192){
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new Error('type');
  const reader=request.body?.getReader();if(!reader)throw Error('body');let size=0,chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('size');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export default {async fetch(request,env){
  const requestUrl=new URL(request.url),path=requestUrl.pathname;
  if(path.startsWith('/read/')||['/sitemap.xml','/robots.txt'].includes(path)){try{return await publicPage(request,env);}catch{return new Response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>暂时无法读取</title><style>body{margin:0;background:#fffaf6;color:#384358;font:16px system-ui}main{max-width:26rem;margin:20vh auto;padding:1.5rem;text-align:center}button,a{display:inline-block;margin:.5rem;padding:.75rem 1.3rem;border:0;border-radius:2rem;background:#ff9690;color:inherit;font:inherit;text-decoration:none;cursor:pointer}</style><main><p>暂时无法读取，请稍后重试。</p><button onclick="location.reload()">重试</button><a href="https://fexas25.github.io/">回到首页</a></main></html>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex','Retry-After':'30'}});}}
  const origin=env.SITE_ORIGIN||'https://fexas25.github.io';
  const headers={'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':origin,'Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
  const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers});
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==origin&&!(request.headers.get('Origin')===requestUrl.origin&&['/documents','/documents/read','/translate'].includes(path)))return reply({error:'origin'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'}});
  if(!env.DB)return reply({error:'not configured'},503);
  const now=Math.floor(Date.now()/1000);
  try{
    if(path==='/documents'||path==='/documents/read')return await publicDocuments(request,env,{body,reply,path,now});
    if(['/private/manage','/private/read'].includes(path)){
      if(request.headers.get('Origin')!==origin)return reply({error:'origin required'},403);
      return await privateRequest(request,env,{body,reply,path,now});
    }
    if(path==='/messages'&&request.method==='GET'){
      const raw=new URL(request.url).searchParams.get('before');const before=raw&&/^\d+$/.test(raw)?Number(raw):Number.MAX_SAFE_INTEGER;
      const {results}=await env.DB.prepare("SELECT m.id,m.name,m.message,m.created,COALESCE(r.body,'') AS reply,r.updated AS reply_updated FROM messages m LEFT JOIN message_replies r ON r.message_id=m.id WHERE m.approved=1 AND m.id<? ORDER BY m.id DESC LIMIT 31").bind(before).all();
      return reply({messages:results.slice(0,30),next:results.length>30?String(results[29].id):''});
    }
    if(request.method!=='POST'||!['/messages','/translate'].includes(path))return reply({error:'not found'},404);
    if(request.headers.get('Origin')!==origin&&!(path==='/translate'&&request.headers.get('Origin')===requestUrl.origin))return reply({error:'origin required'},403);
    if(!env.RATE_SECRET)return reply({error:'not configured'},503);
    const data=await body(request);if(!data||typeof data!=='object'||Array.isArray(data))return reply({error:'invalid'},400);const day=new Date().toISOString().slice(0,10);
    const ip=request.headers.get('CF-Connecting-IP');if(!ip)return reply({error:'client'},400);
    const visitor=await digest(env.RATE_SECRET+':'+day+':'+ip);
    if(path==='/messages'){
      if(!env.TURNSTILE_SECRET)return reply({error:'not configured'},503);
      if(typeof data.name!=='string'||typeof data.message!=='string'||!data.name.trim()||!data.message.trim()||data.name.length>32||data.message.length>1000||data.website||typeof data.token!=='string'||data.token.length>2048)return reply({error:'invalid'},400);
      const check=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',signal:AbortSignal.timeout(10000),body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:data.token,remoteip:ip})}).then(r=>r.json());
      if(!check.success||check.hostname!==new URL(origin).hostname||check.action!=='guestbook')return reply({error:'verification'},403);
      const result=await env.DB.prepare('INSERT INTO messages(name,message,created,visitor) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM messages WHERE visitor=? AND created>?) AND (SELECT COUNT(*) FROM messages WHERE visitor=?)<5').bind(data.name.trim(),data.message.trim(),now,visitor,visitor,now-60,visitor).run();
      return result.meta.changes?reply({pending:true},201):reply({error:'rate limit'},429);
    }
    if(typeof data.text!=='string'||!data.text.trim()||data.text.length>400)return reply({error:'invalid'},400);
    const hash=await digest('zh-en-v1:'+data.text),cached=await env.DB.prepare('SELECT text FROM translations WHERE hash=?').bind(hash).first();
    if(cached)return reply({text:cached.text});
    if(!env.AI)return reply({error:'not configured'},503);
    const cap=Math.max(1,Math.min(1000,Number(env.DAILY_TRANSLATIONS)||200));
    for(const [bucket,limit] of [[day+':'+visitor,80],[day+':all',cap]]){
      const quota=await env.DB.prepare('INSERT INTO quotas(bucket,used) VALUES (?,1) ON CONFLICT(bucket) DO UPDATE SET used=used+1 WHERE used<?').bind(bucket,limit).run();
      if(!quota.meta.changes)return reply({error:'daily limit'},429);
    }
    const translated=await env.AI.run('@cf/meta/m2m100-1.2b',{text:data.text,source_lang:'zh',target_lang:'en'});
    if(typeof translated.translated_text!=='string'||!translated.translated_text.trim())return reply({error:'translation failed'},502);
    await env.DB.prepare('INSERT OR REPLACE INTO translations(hash,text,created) VALUES (?,?,?)').bind(hash,translated.translated_text,now).run();
    return reply({text:translated.translated_text});
  }catch(error){return reply({error:['type','body','size'].includes(error.message)||error instanceof SyntaxError?'invalid request':'service unavailable'},['type','body','size'].includes(error.message)||error instanceof SyntaxError?400:503);}
}};
