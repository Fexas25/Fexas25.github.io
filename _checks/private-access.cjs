const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const fs=require('node:fs');
(async()=>{
 const worker=(await import('../_community/worker.mjs')).default;
 const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(require('node:path').join(__dirname,'../_community/schema.sql'),'utf8'));
 const env={SITE_ORIGIN:'https://fexas25.github.io',RATE_SECRET:'test',DB:{prepare(sql){const s=db.prepare(sql);const wrap=(args=[])=>({first:async()=>s.get(...args)||null,all:async()=>({results:s.all(...args)}),run:async()=>({meta:s.run(...args)}),bind:(...args)=>wrap(args)});return wrap();}}};
 const old=global.fetch;global.fetch=async()=>{throw Error('Legacy management must not contact GitHub');};
 const id=crypto.randomUUID(),key=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
 const doc={title:'private test',folder:'_projects',filename:'test.md',text:'---\ntitle: private test\nprivate: true\n---\n\nConfidential body'};
 const request=(path,data,token='owner',origin=env.SITE_ORIGIN)=>worker.fetch(new Request('https://worker.invalid/private/'+path,{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...(origin?{Origin:origin}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)}),env);
 try{
  const storedHash=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id+':'+key))).toString('hex');
  db.prepare('INSERT INTO private_documents(id,title,document,key_hash,revision,updated) VALUES(?,?,?,?,?,?)').run(id,doc.title,JSON.stringify(doc),storedHash,crypto.randomUUID(),1);
  const before=db.prepare('SELECT * FROM private_documents').all();
  for(const action of ['list','read','save','rotate'])for(const token of ['','owner']){
   const response=await request('manage',{action,id,key:'X'.repeat(43),document:{...doc,text:'changed'}},token);
   assert.equal(response.status,410);assert(!(await response.text()).includes(doc.text));
  }
  assert.deepEqual(db.prepare('SELECT * FROM private_documents').all(),before);
  assert.equal((await request('manage',{action:'list'},'owner','https://evil.invalid')).status,403);
  assert.equal((await request('read',{id,key},'',null)).status,403);
  let response=await request('read',{id,key},'');assert.equal(response.status,200);assert.equal((await response.json()).document.text,doc.text);assert.equal(response.headers.get('Cache-Control'),'no-store');
  const wrong='X'.repeat(43);response=await request('read',{id,key:wrong},'');assert.equal(response.status,403);assert(!JSON.stringify(await response.json()).includes('private test'));
  assert.equal((await request('read',{id:crypto.randomUUID(),key},'')).status,403);
  for(let i=0;i<21;i++)response=await request('read',{id,key:wrong},'');assert.equal(response.status,429);
  assert.deepEqual(db.prepare('SELECT * FROM private_documents').all(),before);
  console.log('PASS: retired frontend management cannot read or write; historical content, keys and protected reading are preserved.');
 }finally{global.fetch=old;db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
