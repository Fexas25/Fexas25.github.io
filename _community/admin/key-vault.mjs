import {verifyKey} from '../private.mjs';
const enc=new TextEncoder();
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const bytes=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
const table=kind=>kind==='documents'?'documents':kind==='projects'?'projects':null;
async function aes(env){if(!/^[A-Za-z0-9+/]{43}=$/.test(env.KEY_VAULT_SECRET||''))throw Error('vault unavailable');return crypto.subtle.importKey('raw',bytes(env.KEY_VAULT_SECRET),'AES-GCM',false,['encrypt','decrypt']);}
const aad=(kind,id,hash)=>enc.encode(JSON.stringify([kind,id,hash]));
async function digest(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function prepareKey(kind,data,env){
 if(data?.action!=='save'||!data.key||! /^[A-Za-z0-9_-]{43}$/.test(data.key))return null;
 const key=await aes(env),hash=await digest(data.id+':'+data.key),iv=crypto.getRandomValues(new Uint8Array(12));
 const value=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(kind,data.id,hash)},key,enc.encode(data.key));
 return {hash,cipher:JSON.stringify({v:1,iv:b64(iv),data:b64(value)})};
}
function vaultStatement(kind,id,prepared,db){
 return db.prepare(`INSERT INTO admin_key_vault(kind,id,key_hash,ciphertext) SELECT ?,id,key_hash,? FROM ${table(kind)} WHERE id=? AND key_hash=? ON CONFLICT(kind,id) DO UPDATE SET key_hash=excluded.key_hash,ciphertext=excluded.ciphertext`).bind(kind,prepared.cipher,id,prepared.hash);
}
export async function retainKey(kind,id,prepared,env){if(prepared)await vaultStatement(kind,id,prepared,env.DB).run();}
export function keyCommit(kind,id,prepared,env){
 let committed=false;
 return {run:async statement=>{if(!prepared)return statement.run();const results=await env.DB.batch([statement,vaultStatement(kind,id,prepared,env.DB)]);committed=true;return results[0];},retained:()=>committed};
}
export async function revealKey(data,env,reply){
 const name=table(data?.kind);if(!name||typeof data.id!=='string'||! /^[a-f0-9-]{36}$/.test(data.id)||typeof data.password!=='string'||data.password.length>128)return reply({error:'参数无效。'},400);
 if(!env.KEY_VIEW_PIN||!env.KEY_VAULT_SECRET)return reply({error:'密钥查看暂不可用。'},503);
 const now=Math.floor(Date.now()/1000),bucket='admin-key-view:'+Math.floor(now/300);
 const limit=await env.DB.prepare('INSERT INTO private_attempts(bucket,used,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET used=used+1 WHERE used<10').bind(bucket,now+600).run();
 if(!limit.meta.changes)return reply({error:'尝试较多，请五分钟后再试。'},429);
 await env.DB.prepare('DELETE FROM private_attempts WHERE expires<?').bind(now).run();
 const hmac=await crypto.subtle.importKey('raw',enc.encode(env.KEY_VIEW_PIN),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
 const signature=await crypto.subtle.sign('HMAC',hmac,enc.encode(env.KEY_VIEW_PIN));
 if(!await crypto.subtle.verify('HMAC',hmac,signature,enc.encode(data.password)))return reply({error:'确认密码不正确。'},422);
 await env.DB.prepare('DELETE FROM private_attempts WHERE bucket=?').bind(bucket).run();
 const row=await env.DB.prepare(`SELECT r.id,r.key_hash,v.ciphertext FROM ${name} r LEFT JOIN admin_key_vault v ON v.kind=? AND v.id=r.id AND v.key_hash=r.key_hash WHERE r.id=? AND r.visibility='private' AND r.deleted_at=0`).bind(data.kind,data.id).first();
 if(!row)return reply({error:'内容不可用，请刷新后重试。'},404);
 if(!row.ciphertext)return reply({error:'旧密钥尚无可查看的保存副本，原密钥仍有效；不会自动重置。'},404);
 try{const v=JSON.parse(row.ciphertext);if(v.v!==1)throw Error();const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(v.iv),additionalData:aad(data.kind,data.id,row.key_hash)},await aes(env),bytes(v.data));const key=new TextDecoder().decode(clear);if(!await verifyKey(row.id,key,row.key_hash))throw Error();return reply({key});}catch{return reply({error:'暂时无法读取密钥，原密钥没有更改。'},503);}
}
