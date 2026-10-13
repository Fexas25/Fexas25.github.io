import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHandler} from './handler.mjs';
import worker from '../worker.mjs';
test('documents share one Access-protected source; private bodies never enter public catalog',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){const s=db.prepare(sql);const wrap=(a=[])=>({bind:(...v)=>wrap(v),first:async()=>s.get(...a)||null,all:async()=>({results:s.all(...a)}),run:async()=>({meta:s.run(...a)})});return wrap();}};
 const env={DB,ADMIN_ORIGIN:'https://admin.example',ADMIN_EMAIL:'owner',ACCESS_ISSUER:'https://access.example',ACCESS_AUD:'aud',SITE_ORIGIN:'https://fexas25.github.io',RATE_SECRET:'test'};
 const handle=createHandler(async()=>({email:'owner'})),id=crypto.randomUUID(),key=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
 const data={action:'save',id,visibility:'public',document:{title:'A title',folder:'_projects',filename:'a.md',text:'secret body'},metadata:{date:'2026-10-13',tags:['test'],type:'ai'}};
 const admin=(body,headers={})=>handle(new Request(env.ADMIN_ORIGIN+'/api/documents',{method:'POST',headers:{Origin:env.ADMIN_ORIGIN,'X-MX-Admin':'1','Content-Type':'application/json',...headers},body:JSON.stringify(body)}),env);
 const read=key=>worker.fetch(new Request('https://worker.example/documents/read',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({id,key})}),env);
 assert.equal((await admin(data,{Origin:'https://evil.example'})).status,403);
 assert.equal((await createHandler(async()=>{throw Error();})(new Request(env.ADMIN_ORIGIN+'/api/documents',{method:'POST'}),env)).status,401);
 let r=await admin(data);assert.equal(r.status,201);let saved=await r.json();assert.equal((await read()).status,200);
 r=await admin({...data,revision:saved.revision,visibility:'private',key});assert.equal(r.status,200);saved=await r.json();
 for(const keyValue of [undefined,'wrong','x'.repeat(43)]){r=await read(keyValue);assert.equal(r.status,403);assert(!(await r.text()).includes('secret body'));}
 r=await read(key);assert.equal((await r.json()).document.text,'secret body');assert.equal(r.headers.get('Cache-Control'),'no-store');
 const list=await (await worker.fetch(new Request('https://worker.example/documents'),env)).json();assert.equal(list.documents[0].title,'A title');assert.equal(list.documents[0].visibility,'private');assert(!JSON.stringify(list).includes('secret body'));assert(!JSON.stringify(list).includes(key));
 assert.equal((await admin({...data,revision:'old'})).status,409);
 r=await admin({...data,revision:saved.revision});assert.equal(r.status,200);assert.equal((await read()).status,200);
 const exact=await r.json();r=await admin({...data,revision:'old'});assert.equal((await r.json()).revision,exact.revision);
 const bad={...data,id:crypto.randomUUID(),metadata:{date:'bad',tags:[]}};assert.equal((await admin(bad)).status,400);
 db.close();
});
