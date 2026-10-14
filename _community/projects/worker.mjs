import {hash,filePath,mimeFor} from '../projects.mjs';
import {verifyKey} from '../private.mjs';
const common={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Robots-Tag':'noindex, nofollow','X-Frame-Options':'DENY'};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function screen(title,body,status=200,headers={}){return new Response(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · MX</title><style>body{margin:0;background:#fffaf6;color:#394654;font:16px/1.7 system-ui}main{max-width:28rem;margin:12vh auto;padding:24px}h1{font-size:1.6rem;overflow-wrap:anywhere}input,button,a{box-sizing:border-box;font:inherit}input{width:100%;padding:14px;border:1px solid #dedddc;border-radius:16px}button,.button{display:inline-block;background:#ffd4d0;padding:12px 22px;border:0;border-radius:22px;margin-top:16px;color:inherit;text-decoration:none;cursor:pointer}a{color:inherit}p{overflow-wrap:anywhere}</style><main><h1>${escape(title)}</h1>${body}<p><a href="https://fexas25.github.io/projects/">← MX 的作品</a></p></main></html>`,{status,headers:{...common,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",...headers}});}
const gate=(row,error='',status=200)=>screen(row.title,`<p>输入密钥，打开这份作品。</p><form method="post" action="/p/${row.slug}/_unlock"><label for="key">访问密钥</label><input id="key" name="key" type="password" autocomplete="off" required maxlength="100"><button>解锁作品 →</button></form>${error?'<p role="alert">'+escape(error)+'</p>':''}`,status);
export default {async fetch(request,env){
 try{
  const url=new URL(request.url),parts=url.pathname.match(/^\/p\/([a-z0-9][a-z0-9-]{0,59})(\/.*)?$/);
  if(!parts||!env.DB||!env.PROJECT_FILES)return screen('找不到这个项目','<p>请检查链接。</p>',404);
  const slug=parts[1],row=await env.DB.prepare("SELECT * FROM projects WHERE slug=? AND deleted_at=0").bind(slug).first();
  if(!row)return screen('找不到这个项目','<p>项目可能尚未发布或已移入回收站。</p>',404);
  const base='/p/'+slug+'/',cookieName='mx_project_'+row.id.replaceAll('-',''),now=Math.floor(Date.now()/1000);
  let path;try{path=decodeURIComponent((parts[2]||'/').slice(1));}catch{return screen('链接无效','',400);}
  if(path==='_preview'&&request.method==='GET'){
   const token=url.searchParams.get('token')||'';
   const session=token.length<150?await env.DB.prepare('SELECT project_id,key_hash,expires FROM project_sessions WHERE token_hash=?').bind(await hash(token)).first():null;
   if(!session||session.project_id!==row.id||session.key_hash!=='preview:'+row.revision||session.expires<=now)return screen('预览已过期','<p>请从后台重新打开预览。</p>',403);
   return new Response(null,{status:303,headers:{...common,Location:base,'Set-Cookie':`${cookieName}=${token}; Path=${base}; HttpOnly; Secure; SameSite=Strict; Max-Age=600`}});
  }
  const cookieToken=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  const currentSession=cookieToken&&cookieToken.length<150?await env.DB.prepare('SELECT project_id,key_hash,expires FROM project_sessions WHERE token_hash=?').bind(await hash(cookieToken)).first():null;
  const preview=currentSession?.project_id===row.id&&currentSession.key_hash==='preview:'+row.revision&&currentSession.expires>now;
  if(row.state!=='published'&&!preview)return screen('找不到这个项目','',404);
  if(path==='_unlock'&&request.method==='POST'){
   if(request.headers.get('Origin')!==url.origin)return screen('请求无效','',403);
   if(!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))return screen('请求无效','',400);
   const reader=request.body?.getReader();if(!reader)return gate(row,'请输入密钥。',400);let raw='',length=0;const decoder=new TextDecoder();
   while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2048){await reader.cancel();return gate(row,'输入过长。',400);}raw+=decoder.decode(value,{stream:true});}
   raw+=decoder.decode();const key=new URLSearchParams(raw).get('key')||'';
   const ip=request.headers.get('CF-Connecting-IP');if(!ip)return gate(row,'暂时无法验证，请重试。',503);
   const bucket='project:'+row.id+':'+Math.floor(now/60)+':'+await hash(ip);
   const rate=await env.DB.prepare('INSERT INTO private_attempts(bucket,used,expires) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET used=used+1 WHERE used<20').bind(bucket,now+120).run();
   if(!rate.meta.changes)return gate(row,'尝试较多，请一分钟后重试。',429);
   if(!await verifyKey(row.id,key,row.key_hash))return gate(row,'密钥不正确，请再试一次。',403);
   const token=crypto.randomUUID()+crypto.randomUUID();
   await env.DB.prepare('INSERT INTO project_sessions(token_hash,project_id,key_hash,expires) VALUES(?,?,?,?)').bind(await hash(token),row.id,row.key_hash,now+7200).run();
   await env.DB.prepare('DELETE FROM project_sessions WHERE expires<?').bind(now).run();
   await env.DB.prepare('DELETE FROM private_attempts WHERE expires<?').bind(now).run();
   return new Response(null,{status:303,headers:{...common,Location:base,'Set-Cookie':`${cookieName}=${token}; Path=${base}; HttpOnly; Secure; SameSite=Strict; Max-Age=7200`}});
  }
  if(!['GET','HEAD'].includes(request.method))return screen('请求无效','',405);
  if(row.visibility==='private'&&!preview){
   const token=(request.headers.get('Cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
   const session=token&&token.length<150?await env.DB.prepare('SELECT project_id,key_hash,expires FROM project_sessions WHERE token_hash=?').bind(await hash(token)).first():null;
   if(!session||session.project_id!==row.id||session.key_hash!==row.key_hash||session.expires<=now){
    if(path&&path!==row.entry)return new Response(null,{status:403,headers:common});
    return gate(row);
   }
  }
  if(!parts[2])return new Response(null,{status:302,headers:{...common,Location:base}});
  if(row.kind==='link')return screen(row.title,`<p>${escape(row.description)}</p><a class="button" href="${escape(row.external_url)}" rel="noopener noreferrer">打开项目 ↗</a>`);
  if(!path&&row.entry.includes('/'))return new Response(null,{status:302,headers:{...common,Location:base+row.entry.split('/').map(encodeURIComponent).join('/')}});
  path=path||row.entry;if(path.endsWith('/'))path+='index.html';if(!filePath(path))return screen('找不到这个文件','',404);
  const file=await env.DB.prepare('SELECT size,mime FROM project_files WHERE upload_id=? AND path=?').bind(row.version,path).first();
  if(!file)return screen('找不到这个文件','',404);
  let value=await env.PROJECT_FILES.get(row.version+'/'+path,'arrayBuffer');
  if(value===null)return screen('文件正在同步','<p>稍后刷新即可，项目内容已保存。</p>',503,{'Retry-After':'10'});
  // Our shared translator must never automatically send unlocked private text outside the project.
  if(row.visibility==='private'&&mimeFor(path).startsWith('text/html')){const html=new TextDecoder().decode(value).replace(/<script\b[^>]*src=["']https:\/\/fexas25\.github\.io\/site-translate\.js[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,'');value=new TextEncoder().encode(html).buffer;}
  const headers={...common,'Content-Type':mimeFor(path),'Accept-Ranges':'bytes','Content-Length':String(value.byteLength),'Content-Security-Policy':"sandbox allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-pointer-lock; frame-ancestors 'none'; object-src 'none'; worker-src 'none'; base-uri 'self'"};
  const range=request.headers.get('Range');if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);let start=m&&m[1]?Number(m[1]):m?Math.max(0,value.byteLength-Number(m[2])):-1;let end=m&&m[1]&&m[2]?Number(m[2]):value.byteLength-1;end=Math.min(end,value.byteLength-1);if(start<0||start>end||start>=value.byteLength)return new Response(null,{status:416,headers:{...common,'Content-Range':'bytes */'+value.byteLength}});const part=value.slice(start,end+1);return new Response(request.method==='HEAD'?null:part,{status:206,headers:{...headers,'Content-Range':`bytes ${start}-${end}/${value.byteLength}`,'Content-Length':String(part.byteLength)}});}
  return new Response(request.method==='HEAD'?null:value,{headers});
 }catch{return screen('暂时无法打开','<p>请稍后刷新重试。</p>',503,{'Retry-After':'10'});}
}};
