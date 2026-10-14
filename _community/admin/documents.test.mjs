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

 // Recycle private works without losing their key, URL or body.
 r=await admin({...data,revision:exact.revision,visibility:'private',key});saved=await r.json();
 const oldRevision=saved.revision;
 assert.equal((await admin({action:'trash',id,revision:'stale'})).status,409);
 r=await admin({action:'trash',id,revision:oldRevision});assert.equal(r.status,200);const trashed=await r.json();
 assert.equal((await read(key)).status,404);
 assert.equal((await (await worker.fetch(new Request('https://worker.example/documents'),env)).json()).documents.length,0);
 assert.equal((await (await admin({action:'list'})).json()).documents.length,0);
 const bin=await (await admin({action:'list',trash:true})).json();assert.equal(bin.documents.length,1);assert(bin.documents[0].deletedAt>0);assert(!JSON.stringify(bin).includes('secret body'));
 assert.equal((await admin({...data,revision:oldRevision})).status,409);
 assert.equal((await admin({action:'restore',id,revision:oldRevision})).status,409);
 r=await admin({action:'restore',id,revision:trashed.revision});assert.equal(r.status,200);const restored=await r.json();assert.equal(restored.url,saved.url);
 assert.equal((await read()).status,403);assert.equal((await (await read(key)).json()).document.text,'secret body');
 assert.equal((await (await admin({action:'list',trash:true})).json()).documents.length,0);
 assert.equal((await admin({...data,revision:oldRevision})).status,409);
 // Public articles follow the same lifecycle.
 r=await admin({...data,revision:restored.revision});saved=await r.json();
 r=await admin({action:'trash',id,revision:saved.revision});saved=await r.json();assert.equal((await read()).status,404);
 await admin({action:'restore',id,revision:saved.revision});assert.equal((await read()).status,200);
 const bad={...data,id:crypto.randomUUID(),metadata:{date:'bad',tags:[]}};assert.equal((await admin(bad)).status,400);
 // Legacy association must resolve exactly one active document, never guess by title.
 assert.equal((await admin({action:'resolve',path:'../a.md'})).status,400);
 assert.equal((await admin({action:'resolve',path:'_projects/missing.md'})).status,404);
 assert.equal((await (await admin({action:'resolve',path:'_projects/a.md'})).json()).id,id);
 const duplicateId=crypto.randomUUID();await admin({...data,id:duplicateId});
 assert.equal((await admin({action:'resolve',path:'_projects/a.md'})).status,404);
 const duplicate=await (await admin({action:'read',id:duplicateId})).json();
 await admin({action:'trash',id:duplicateId,revision:duplicate.revision});
 assert.equal((await (await admin({action:'resolve',path:'_projects/a.md'})).json()).id,id);
 db.close();
});
