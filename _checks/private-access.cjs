const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');
(async()=>{
 const worker=(await import('../_community/worker.mjs')).default;
 const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(require('node:path').join(__dirname,'../_community/schema.sql'),'utf8'));
 const env={SITE_ORIGIN:'https://fexas25.github.io',RATE_SECRET:'test',DB:{prepare(sql){const s=db.prepare(sql);const wrap=(args=[])=>({first:async()=>s.get(...args)||null,all:async()=>({results:s.all(...args)}),run:async()=>({meta:s.run(...args)}),bind:(...args)=>wrap(args)});return wrap();}}};
 const old=global.fetch;let user='Fexas25',push=true;
 global.fetch=async url=>{assert(url.startsWith('https://api.github.com/'));return Response.json(url.endsWith('/user')?{login:user}:{permissions:{push}});};
 const id=crypto.randomUUID(),key=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
 const doc={title:'private test',folder:'_projects',filename:'test.md',text:'---\ntitle: private test\nprivate: true\n---\n\nConfidential body'};
 const request=(path,data,token='owner',origin=env.SITE_ORIGIN)=>worker.fetch(new Request('https://worker.invalid/private/'+path,{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...(origin?{Origin:origin}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}),env);
 try{
  assert.equal((await request('manage',{action:'list'},'')).status,401);
  assert.equal((await request('manage',{action:'list'},'owner','https://evil.invalid')).status,403);
  assert.equal((await request('read',{id,key},'',null)).status,403);
  user='other';assert.equal((await request('manage',{action:'save',id,key,document:doc})).status,401);user='Fexas25';
  push=false;assert.equal((await request('manage',{action:'list'})).status,401);push=true;
  let response=await request('manage',{action:'save',id,key,document:doc});assert.equal(response.status,201);const saved=await response.json();
  const stored=db.prepare('SELECT * FROM private_documents').get();assert(!JSON.stringify(stored).includes(key));
  response=await request('read',{id,key},'');assert.equal(response.status,200);assert.equal((await response.json()).document.text,doc.text);assert.equal(response.headers.get('Cache-Control'),'no-store');
  const wrong='X'.repeat(43);response=await request('read',{id,key:wrong},'');assert.equal(response.status,403);assert(!JSON.stringify(await response.json()).includes('private test'));
  response=await request('read',{id:crypto.randomUUID(),key},'');assert.equal(response.status,403);
  response=await request('manage',{action:'save',id,key,document:doc});assert.equal((await response.json()).revision,saved.revision);
  response=await request('manage',{action:'save',id,revision:'old',document:{...doc,text:'changed'}});assert.equal(response.status,409);
  response=await request('manage',{action:'save',id,revision:saved.revision,document:{...doc,text:doc.text+' new'}});assert.equal(response.status,200);let revision=(await response.json()).revision;
  const key2=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');response=await request('manage',{action:'rotate',id,revision,key:key2});assert.equal(response.status,200);
  assert.equal((await request('read',{id,key},'')).status,403);assert.equal((await request('read',{id,key:key2},'')).status,200);
  assert.equal((await request('manage',{action:'save',id:crypto.randomUUID(),key,document:{...doc,text:'x'.repeat(1800001)}})).status,400);
  for(let i=0;i<21;i++)response=await request('read',{id,key:wrong},'');assert.equal(response.status,429);
  const list=await (await request('manage',{action:'list'})).json();assert.equal(list.documents.length,1);assert(!JSON.stringify(list).includes('Confidential body'));
  console.log('PASS: private owner authorization, key checks, rotation, no-store, limits, idempotency and revision conflicts.');
 }finally{global.fetch=old;db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
