import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {createHandler} from './handler.mjs';
import {readFileSync} from 'node:fs';

const envBase={ADMIN_ORIGIN:'https://admin.example',ACCESS_ISSUER:'https://mx-test.cloudflareaccess.com',ACCESS_AUD:'test-audience',ADMIN_EMAIL:'owner@example.com'};
function database(){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
 for(let i=1;i<=35;i++)db.prepare('INSERT INTO messages(name,message,created,visitor) VALUES(?,?,?,?)').run('name '+i,'message '+i,1000+i,'private-hash');
 return {db,binding:{prepare(sql){const stmt=db.prepare(sql);let args=[];const wrapped={bind(...values){args=values;return wrapped;},all:async()=>({results:stmt.all(...args)}),run:async()=>({meta:{changes:stmt.run(...args).changes}})};return wrapped;},batch:async statements=>Promise.all(statements.map(s=>s.all()))}};
}
const req=(path,options={})=>new Request(envBase.ADMIN_ORIGIN+path,options);
const post=(data,headers={})=>req('/api/moderate',{method:'POST',headers:{Origin:envBase.ADMIN_ORIGIN,'Content-Type':'application/json','X-MX-Admin':'1',...headers},body:JSON.stringify(data)});

test('signed Access token, issuer, audience, expiry and owner are all enforced',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk=await exportJWK(publicKey);jwk.kid='test';jwk.alg='RS256';
 const previous=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(String(url),envBase.ACCESS_ISSUER+'/cdn-cgi/access/certs');return new Response(JSON.stringify({keys:[jwk]}),{headers:{'Content-Type':'application/json'}});};
 try{
  const {binding,db}=database(),env={...envBase,DB:binding},handle=createHandler();
  assert.equal((await handle(req('/api/messages'),env)).status,401);
  assert.equal((await handle(req('/api/messages',{headers:{'Cf-Access-Authenticated-User-Email':env.ADMIN_EMAIL}}),env)).status,401);
  const token=async(overrides={})=>new SignJWT({email:env.ADMIN_EMAIL,sub:'owner',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300,iss:env.ACCESS_ISSUER,aud:env.ACCESS_AUD,...overrides}).setProtectedHeader({alg:'RS256',kid:'test'}).sign(privateKey);
  for(const values of [{email:'stranger@example.com'},{iss:'https://other.cloudflareaccess.com'},{aud:'other'},{exp:1}]){
   assert.equal((await handle(req('/api/messages',{headers:{'Cf-Access-Jwt-Assertion':await token(values)}}),env)).status,401);
  }
  const good=await token();assert.equal((await handle(req('/api/messages',{headers:{'Cf-Access-Jwt-Assertion':good}}),env)).status,200);
  assert.equal((await handle(req('/api/messages',{headers:{'Cf-Access-Jwt-Assertion':good.slice(0,-8)+'tampered'}}),env)).status,401);
  db.close();
 }finally{globalThis.fetch=previous;}
});

test('moderation is paginated, parameterized, reversible and protected from stale updates / CSRF',async()=>{
 const {db,binding}=database(),env={...envBase,DB:binding},handle=createHandler(async()=>({email:env.ADMIN_EMAIL}));
 const list=await (await handle(req('/api/messages'),env)).json();assert.equal(list.messages.length,30);assert.equal(list.next,'6');assert.equal(list.counts.pending,35);assert.equal(JSON.stringify(list).includes('private-hash'),false);
 const older=await (await handle(req('/api/messages?before=6'),env)).json();assert.equal(older.messages.length,5);
 assert.equal((await handle(post({ids:[1],action:'publish',from:'pending'},{Origin:'https://evil.example'}),env)).status,403);
 assert.equal((await handle(post({ids:['1 OR 1=1'],action:'publish',from:'pending'}),env)).status,400);
 assert.equal((await handle(post({ids:[1],action:'publish',from:'pending'},{'X-MX-Admin':''}),env)).status,403);
 const action=async(action,from,ids)=>{const r=await handle(post({action,from,ids}),env);assert.equal(r.status,200);return r.json();};
 assert.equal((await action('publish','pending',[1,2])).changed,2);
 assert.equal((await action('trash','pending',[1])).changed,0,'stale tab must not delete published entry');
 assert.equal((await action('hide','published',[1])).changed,1);
 assert.equal((await action('trash','pending',[1])).changed,1);
 assert.equal(db.prepare('SELECT approved FROM messages WHERE id=1').get().approved,-1);
 assert.equal((await action('restore','trash',[1])).changed,1);
 assert.equal(db.prepare('SELECT approved FROM messages WHERE id=1').get().approved,0);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM messages').get().n,35,'soft delete preserves all data');
 const html=await handle(req('/'),env);assert.match(html.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);assert.equal(html.headers.get('Cache-Control'),'no-store');
 assert.equal((await handle(req('/api/messages?state=__proto__'),env)).status,400);
 db.close();
});
