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
export async function privateRequest(request,env,{body,reply,path,now}){
 if(path!=='/private/read'||request.method!=='POST')return reply({error:'not found'},404);
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
