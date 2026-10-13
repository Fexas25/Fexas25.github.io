import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';

test('guestbook verifies the submitting site, action and token before writing', async t => {
  const site='https://fexas25.github.io', share='https://content.test';
  let writes=0, verification={success:true,hostname:'fexas25.github.io',action:'guestbook'}, status=200;
  const env={SITE_ORIGIN:site,RATE_SECRET:'test',TURNSTILE_SECRET:'test',DB:{prepare(sql){
    assert.match(sql,/INSERT INTO messages/);
    assert(!sql.includes('approved'),'new messages must remain pending');
    return {bind:()=>({run:async()=>{writes++;return {meta:{changes:1}};}})};
  }}};
  t.mock.method(globalThis,'fetch',async()=>Response.json(verification,{status}));
  const send=origin=>worker.fetch(new Request(share+'/messages',{method:'POST',headers:{...(origin?{Origin:origin}:{}),'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({name:'test',message:'test',token:'mock-token'})}),env);
  assert.equal((await send(site)).status,201);
  verification.hostname='content.test';assert.equal((await send(share)).status,201);
  assert.equal(writes,2);
  for(const origin of ['https://untrusted.test',null,site])assert.equal((await send(origin)).status,403);
  verification.action='other';assert.equal((await send(share)).status,403);
  verification.action='guestbook';verification.success=false;assert.equal((await send(share)).status,403);
  verification.success=true;status=503;assert.notEqual((await send(share)).status,201);
  assert.equal(writes,2,'failed or mismatched verification must not write');
});
