import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHandler} from './handler.mjs';
import {prepareKey,retainKey} from './key-vault.mjs';
import {verifyKey} from '../private.mjs';
import publicWorker from '../worker.mjs';
function setup(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));const DB={async batch(statements){db.exec('BEGIN');try{const result=[];for(const statement of statements)result.push(statement.runSync());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}},prepare(sql){const s=db.prepare(sql);const wrap=(a=[])=>({bind:(...v)=>wrap(v),first:async()=>s.get(...a)||null,all:async()=>({results:s.all(...a)}),run:async()=>({meta:s.run(...a)}),runSync:()=>({meta:s.run(...a)})});return wrap();}};const env={DB,KEY_VAULT_SECRET:Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64'),KEY_VIEW_PIN:'test-confirm',ADMIN_ORIGIN:'https://admin.example',ADMIN_EMAIL:'owner',ACCESS_ISSUER:'fixture',ACCESS_AUD:'fixture'};const handler=createHandler(async()=>({email:'owner'}));const req=(path,data,origin=env.ADMIN_ORIGIN)=>new Request(env.ADMIN_ORIGIN+'/api/'+path,{method:'POST',headers:{Origin:origin,'X-MX-Admin':'1','Content-Type':'application/json'},body:JSON.stringify(data)});return {db,env,handler,req,call:(p,d,o)=>handler(req(p,d,o),env)};}
for(const kind of ['documents','projects'])test(kind+' encrypted persistent key is admin-only and PIN-gated, rotations replace only its own key',async()=>{
 const {db,env,call,req}=setup(),id=crypto.randomUUID(),key='A'.repeat(43),next='B'.repeat(43);
 const data=kind==='documents'?{action:'save',id,key,visibility:'private',document:{title:'Vault article',folder:'_posts',filename:'vault.md',text:'private body'},metadata:{date:'2026-10-14',tags:[]}}:{action:'save',id,key,title:'Vault project',slug:'vault-project',category:'creative',kind:'link',externalUrl:'https://example.com',visibility:'private',state:'published'};
 let r=await call(kind,data);assert(r.ok);data.revision=(await r.json()).revision;
 const view={kind,id,password:env.KEY_VIEW_PIN};
 assert.equal((await createHandler(async()=>{throw Error();})(req('keys',view),env)).status,401);
 assert.equal((await call('keys',view,'https://fexas25.github.io')).status,403);
 assert.equal((await call('keys',{...view,password:'wrong'})).status,422);
 r=await call('keys',view);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.deepEqual(await r.json(),{key});
 for(const action of ['read','list']){const text=await(await call(kind,{action,id})).text();assert(!text.includes(key));assert(!text.includes('ciphertext'));}
 const stored=db.prepare('SELECT * FROM admin_key_vault').get();assert(!stored.ciphertext.includes(key));assert.equal(db.prepare('SELECT count(*) AS n FROM admin_key_vault').get().n,1);
 const old=await prepareKey(kind,data,env);data.key=next;r=await call(kind,data);assert(r.ok);data.revision=(await r.json()).revision;
 await retainKey(kind,id,old,env);assert.equal((await(await call('keys',view)).json()).key,next);assert.equal(db.prepare('SELECT count(*) AS n FROM admin_key_vault').get().n,1);
 const row=db.prepare('SELECT key_hash FROM '+kind+' WHERE id=?').get(id);assert.equal(await verifyKey(id,key,row.key_hash),false);assert.equal(await verifyKey(id,next,row.key_hash),true);
 delete data.key;r=await call(kind,data);assert(r.ok);assert.equal((await(await call('keys',view)).json()).key,next);
 db.prepare('DELETE FROM admin_key_vault').run();r=await call('keys',view);assert.equal(r.status,404);assert((await r.json()).error.includes('旧密钥'));assert.equal(db.prepare('SELECT key_hash FROM '+kind).get().key_hash,row.key_hash);
 // An existing key supplied by a verified retry can be retained without rotating it.
 assert.equal((await(await call(kind,{action:'check-key',id,key:next})).json()).matches,true);assert.equal((await(await call('keys',view)).json()).key,next);
 // Missing encryption configuration fails before any key rotation is committed.
 delete env.KEY_VAULT_SECRET;r=await call(kind,{...data,key});assert.equal(r.status,503);assert.equal(db.prepare('SELECT key_hash FROM '+kind).get().key_hash,row.key_hash);db.close();
});
test('PIN throttling, damaged ciphertext, and public worker isolation',async()=>{
 const {db,env,call}=setup(),id=crypto.randomUUID(),data={action:'save',id,key:'C'.repeat(43),visibility:'private',document:{title:'secret',folder:'_posts',filename:'s.md',text:'body'},metadata:{date:'2026-10-14',tags:[]}};assert((await call('documents',data)).ok);const view={kind:'documents',id,password:env.KEY_VIEW_PIN};
 db.prepare("UPDATE admin_key_vault SET ciphertext='broken'").run();assert.equal((await call('keys',view)).status,503);
 for(let i=0;i<10;i++)assert.equal((await call('keys',{...view,password:'bad'})).status,422);assert.equal((await call('keys',view)).status,429);
 const response=await publicWorker.fetch(new Request('https://community.example/api/keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(view)}),env);assert(!response.ok);assert(!(await response.text()).includes(data.key));db.close();
});

test('vault write failure rolls back content and rotation; retry does not duplicate',async()=>{
 const {db,env,call}=setup(),id=crypto.randomUUID(),data={action:'save',id,key:'D'.repeat(43),visibility:'private',document:{title:'retry',folder:'_posts',filename:'retry.md',text:'body'},metadata:{date:'2026-10-14',tags:[]}};
 const block=()=>db.exec("CREATE TRIGGER fail_vault BEFORE INSERT ON admin_key_vault BEGIN SELECT RAISE(ABORT,'simulated failure'); END;");
 block();assert.equal((await call('documents',data)).status,503);assert.equal(db.prepare('SELECT count(*) AS n FROM documents').get().n,0);db.exec('DROP TRIGGER fail_vault');const saved=await(await call('documents',data)).json();assert.equal(db.prepare('SELECT count(*) AS n FROM documents').get().n,1);
 block();assert.equal((await call('documents',{...data,revision:saved.revision,key:'E'.repeat(43)})).status,503);db.exec('DROP TRIGGER fail_vault');assert.equal((await(await call('keys',{kind:'documents',id,password:env.KEY_VIEW_PIN})).json()).key,data.key);assert.equal(await verifyKey(id,data.key,db.prepare('SELECT key_hash FROM documents').get().key_hash),true);db.close();
});
