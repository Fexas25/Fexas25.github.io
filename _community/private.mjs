// Secret documents never enter the public Git repository or translation cache.
const enc=new TextEncoder();
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const keyPattern=/^[A-Za-z0-9_-]{43}$/;
async function hash(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value)));}
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export async function verifyKey(id,key,stored){
 if(!keyPattern.test(key||'')||!stored)return false;
 const actual=await hash(id+':'+key),expected=Uint8Array.from(stored.match(/../g),b=>parseInt(b,16));
 // Verify via HMAC to avoid comparing secret-derived strings directly.
 const hmac=await crypto.subtle.importKey('raw',expected,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 return crypto.subtle.verify('HMAC',hmac,await crypto.subtle.sign('HMAC',hmac,actual),expected);
}
async function owner(request){
 const authorization=request.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9_]+$/.test(authorization))return false;
 const headers={Authorization:authorization,Accept:'application/vnd.github+json','User-Agent':'MX-private-writing','X-GitHub-Api-Version':'2022-11-28'};
 const user=await fetch('https://api.github.com/user',{headers,signal:AbortSignal.timeout(10000)});
 if(!user.ok||(await user.json()).login?.toLowerCase()!=='fexas25')return false;
 const repo=await fetch('https://api.github.com/repos/Fexas25/Fexas25.github.io',{headers,signal:AbortSignal.timeout(10000)});
 return repo.ok&&(await repo.json()).permissions?.push===true;
}
export async function privateRequest(request,env,{body,reply,path,now}){
 if(request.method!=='POST')return reply({error:'not found'},404);
 if(path==='/private/manage'){
  if(!await owner(request))return reply({error:'unauthorized'},401);
  const data=await body(request,2100000);
  if(!data||typeof data!=='object')return reply({error:'invalid'},400);
  if(data.action==='list'){
   const {results}=await env.DB.prepare('SELECT id,title,updated,revision FROM private_documents ORDER BY updated DESC LIMIT 500').all();
   return reply({documents:results});
  }
  if(!uuid.test(data.id||''))return reply({error:'invalid'},400);
  const row=await env.DB.prepare('SELECT * FROM private_documents WHERE id=?').bind(data.id).first();
  if(data.action==='read')return row?reply({id:row.id,revision:row.revision,document:JSON.parse(row.document)}):reply({error:'not found'},404);
  if(data.action==='save'){
   const doc=data.document;
   if(!doc||typeof doc.title!=='string'||!doc.title.trim()||doc.title.length>200||typeof doc.text!=='string'||enc.encode(doc.text).length>1800000||!['_posts','_cp','_projects','_gamejam','_art'].includes(doc.folder)||typeof doc.filename!=='string'||!/^[-\p{L}\p{N}_.]+\.md$/u.test(doc.filename))return reply({error:'invalid'},400);
   if(!row&&!keyPattern.test(data.key||''))return reply({error:'invalid key'},400);
   // Idempotent retries after a lost response; never replace another revision.
   const document=JSON.stringify({title:doc.title,folder:doc.folder,filename:doc.filename,text:doc.text});
   if(row&&row.document===document)return reply({id:row.id,revision:row.revision});
   if(row&&data.revision!==row.revision)return reply({error:'conflict'},409);
   const revision=crypto.randomUUID();let result;
   if(row)result=await env.DB.prepare('UPDATE private_documents SET title=?,document=?,revision=?,updated=? WHERE id=? AND revision=?').bind(doc.title,document,revision,now,data.id,data.revision).run();
   else result=await env.DB.prepare('INSERT OR IGNORE INTO private_documents(id,title,document,key_hash,revision,updated) VALUES (?,?,?,?,?,?)').bind(data.id,doc.title,document,hex(await hash(data.id+':'+data.key)),revision,now).run();
   return result.meta.changes?reply({id:data.id,revision},row?200:201):reply({error:'conflict'},409);
  }
  if(data.action==='rotate'){
   if(!row)return reply({error:'not found'},404);
   if(!keyPattern.test(data.key||''))return reply({error:'invalid key'},400);
   const revision=crypto.randomUUID();
   const result=await env.DB.prepare('UPDATE private_documents SET key_hash=?,revision=?,updated=? WHERE id=? AND revision=?').bind(hex(await hash(data.id+':'+data.key)),revision,now,data.id,data.revision).run();
   return result.meta.changes?reply({id:data.id,revision}):reply({error:'conflict'},409);
  }
  return reply({error:'invalid'},400);
 }
 const data=await body(request);
 if(!data||!uuid.test(data.id||'')||!keyPattern.test(data.key||''))return reply({error:'unavailable'},403);
 const ip=request.headers.get('CF-Connecting-IP');if(!ip||!env.RATE_SECRET)return reply({error:'unavailable'},503);
 const bucket='private:'+Math.floor(now/60)+':'+hex(await hash(env.RATE_SECRET+':'+ip));
 const rate=await env.DB.prepare('INSERT INTO private_attempts(bucket,used,expires) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET used=used+1 WHERE used<20').bind(bucket,now+120).run();
 if(!rate.meta.changes)return reply({error:'rate limit'},429);
 await env.DB.prepare('DELETE FROM private_attempts WHERE expires<?').bind(now).run();
 const row=await env.DB.prepare('SELECT document,key_hash FROM private_documents WHERE id=?').bind(data.id).first();
 if(!row||!await verifyKey(data.id,data.key,row.key_hash))return reply({error:'unavailable'},403);
 return reply({document:JSON.parse(row.document)});
}
