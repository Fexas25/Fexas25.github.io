import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createHandler} from './handler.mjs';
import runtime from '../projects/worker.mjs';
import {projectCatalog} from '../projects.mjs';
function setup(){const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));const DB={prepare(sql){const s=db.prepare(sql);const wrap=(a=[])=>({bind:(...v)=>wrap(v),first:async()=>s.get(...a)||null,all:async()=>({results:s.all(...a)}),run:async()=>({meta:s.run(...a)})});return wrap();}};const files=new Map();const env={DB,PROJECT_FILES:{put:async(k,v)=>files.set(k,Uint8Array.from(v).buffer),get:async k=>files.get(k)||null},ADMIN_ORIGIN:'https://admin.example',ADMIN_EMAIL:'owner',ACCESS_ISSUER:'https://access.example',ACCESS_AUD:'aud'};const handler=createHandler(async()=>({email:'owner'}));const admin=(data,origin=env.ADMIN_ORIGIN)=>handler(new Request(env.ADMIN_ORIGIN+(data.action==='upload-file'?'/api/project-file?'+new URLSearchParams({id:data.id,upload:data.upload,path:data.path}):'/api/projects'),{method:'POST',headers:{Origin:origin,'Content-Type':data.action==='upload-file'?'application/octet-stream':'application/json','X-MX-Admin':'1'},body:data.action==='upload-file'?Buffer.from(data.base64,'base64'):JSON.stringify(data)}),env);return {db,env,handler,admin};}
test('project packages enforce all file paths, keys, sessions, preview and reversible publication',async()=>{
 const {db,env,admin}=setup(),id=crypto.randomUUID(),key='a'.repeat(43),key2='b'.repeat(43);
 let data={action:'save',id,title:'A project',slug:'demo',description:'private description',category:'game',kind:'static',visibility:'private',state:'draft',key};
 const read=(path='',cookie='',options={})=>runtime.fetch(new Request('https://runtime.example/p/demo/'+path,{...options,headers:{Cookie:cookie,...options.headers}}),env);
 assert.equal((await admin(data,'https://evil.example')).status,403);
 let r=await admin({action:'upload-start',id});const upload=(await r.json()).upload;data.version=upload;
 for(const path of ['../secret','/secret','a\\b','a/%2e%2e/z','.env'])assert.equal((await admin({action:'upload-file',id,upload,path,base64:'eA=='})).status,400);
 for(const [path,body] of [['index.html','<h1>PRIVATE CONTENT</h1>'],['secret.js','PRIVATE SCRIPT'],['image.png','PRIVATE IMAGE']])assert.equal((await admin({action:'upload-file',id,upload,path,base64:Buffer.from(body).toString('base64')})).status,200);
 r=await admin(data);assert.equal(r.status,201);data.revision=(await r.json()).revision;
 assert.equal((await read()).status,404);assert.equal((await projectCatalog(env.DB)).length,0);
 const preview=await (await admin({action:'preview',id})).json();r=await read('_preview?'+new URL(preview.url).searchParams);assert.equal(r.status,303);const previewCookie=r.headers.get('Set-Cookie').split(';')[0];assert((await (await read('',previewCookie)).text()).includes('PRIVATE CONTENT'));
 data.state='published';r=await admin(data);data.revision=(await r.json()).revision;
 assert(!(await (await read('',previewCookie)).text()).includes('PRIVATE CONTENT'));
 assert.equal((await admin({action:'upload-file',id,upload,path:'new.js',base64:'eA=='})).status,409);
 const catalog=await projectCatalog(env.DB);assert.equal(catalog.length,1);assert(!JSON.stringify(catalog).includes('private description'));assert(!JSON.stringify(catalog).includes(key));
 for(const path of ['', 'index.html','secret.js','image.png','%2e%2e%2fsecret.js'])for(const method of ['GET','HEAD']){r=await read(path,'',{method,headers:{Range:'bytes=0-4'}});assert(!(await r.text()).includes('PRIVATE'));}
 const unlock=k=>read('_unlock','',{method:'POST',headers:{Origin:'https://runtime.example','Content-Type':'application/x-www-form-urlencoded','CF-Connecting-IP':'192.0.2.1'},body:new URLSearchParams({key:k}).toString()});
 assert.equal((await unlock('wrong')).status,403);r=await unlock(key);assert.equal(r.status,303);const cookie=r.headers.get('Set-Cookie').split(';')[0];assert.equal(r.headers.get('Referrer-Policy'),'same-origin');assert(r.headers.get('Set-Cookie').includes('HttpOnly'));assert(r.headers.get('Set-Cookie').includes('Secure'));
 r=await read('secret.js',cookie);assert.equal(await r.text(),'PRIVATE SCRIPT');assert.match(r.headers.get('Cache-Control'),/no-store/);
 r=await read('image.png',cookie,{headers:{Range:'bytes=0-3'}});assert.equal(r.status,206);assert.equal(await r.text(),'PRIV');
 data.key=key2;r=await admin(data);data.revision=(await r.json()).revision;assert.equal((await read('secret.js',cookie)).status,403);
 r=await unlock(key2);const cookie2=r.headers.get('Set-Cookie').split(';')[0];assert.equal((await read('secret.js',cookie2)).status,200);
 assert.equal((await admin({...data,revision:'stale'})).status,409);
 r=await admin({action:'trash',id,revision:data.revision});const deleted=await r.json();assert.equal((await read('secret.js',cookie2)).status,404);assert.equal((await projectCatalog(env.DB)).length,0);
 r=await admin({action:'restore',id,revision:deleted.revision});data.revision=(await r.json()).revision;assert.equal((await read('secret.js',cookie2)).status,200);
 data.visibility='public';r=await admin(data);assert.equal(r.status,200);assert.equal((await read('secret.js')).status,200);
 db.close();
});
test('six admin destinations have separate responsibilities and protected APIs',async()=>{const {db,env,handler}=setup();for(const path of ['/','/write','/drafts','/articles','/projects','/projects/new','/articles/edit','/projects/edit']){const r=await handler(new Request(env.ADMIN_ORIGIN+path),env);assert.equal(r.status,200);const html=await r.text();assert(!html.includes('id="published-content"'));if(path==='/write'){assert(html.includes('id="writing-form"'));assert(!html.includes('id="items"'));assert(!html.includes('<option value="projects">'));}if(['/articles','/projects','/drafts'].includes(path)){assert(html.includes('id="items"'));assert(!html.includes('id="writing-form"'));}}const denied=createHandler(async()=>{throw Error();});assert.equal((await denied(new Request(env.ADMIN_ORIGIN+'/api/projects',{method:'POST'}),env)).status,401);db.close();});

test('nested entry pages retain their relative asset base',async()=>{
 const {db,env,admin}=setup(),id=crypto.randomUUID();const upload=(await (await admin({action:'upload-start',id})).json()).upload;
 for(const [path,text] of [['demo/index.html','<script src="app.js"></script>'],['demo/app.js','nested asset']])assert.equal((await admin({action:'upload-file',id,upload,path,base64:Buffer.from(text).toString('base64')})).status,200);
 const saved=await admin({action:'save',id,title:'Nested',slug:'nested',category:'game',kind:'static',visibility:'public',state:'published',version:upload,entry:'demo/index.html'});assert.equal(saved.status,201);
 const read=path=>runtime.fetch(new Request('https://runtime.example/p/nested/'+path),env);
 const entry=await read('');assert.equal(entry.status,302);assert.equal(entry.headers.get('Location'),'/p/nested/demo/index.html');assert.equal(await (await read('demo/app.js')).text(),'nested asset');assert.equal((await read('demo/')).status,200);db.close();
});

test('trashed project drafts can be restored without publishing',async()=>{
 const {db,env,admin}=setup(),id=crypto.randomUUID();
 let r=await admin({action:'save',id,title:'Draft',slug:'draft-recovery',description:'',category:'game',kind:'link',externalUrl:'https://example.com/game',visibility:'public',state:'draft'});assert.equal(r.status,201);let data=await r.json();
 data=await(await admin({action:'trash',id,revision:data.revision})).json();
 const trash=await(await admin({action:'list',trash:true})).json();assert.equal(trash.projects[0].id,id);assert.equal(trash.projects[0].state,'draft');
 assert.equal((await admin({action:'restore',id,revision:data.revision})).status,200);
 assert.equal((await(await admin({action:'list',state:'draft'})).json()).projects.length,1);assert.equal((await projectCatalog(env.DB)).length,0);db.close();
});
