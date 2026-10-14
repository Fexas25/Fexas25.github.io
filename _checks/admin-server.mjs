// HTTP loopback fixture strips Secure only for local cookie transport; production Secure is asserted in unit and live tests.
// Isolated browser fixture. No Cloudflare bindings, credentials or production writes.
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHandler} from '../_community/admin/handler.mjs';
import runtime from '../_community/projects/worker.mjs';
const origin='http://127.0.0.1:4175',db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../_community/schema.sql',import.meta.url),'utf8'));
const DB={prepare(sql){const s=db.prepare(sql);const wrap=(a=[])=>({bind:(...v)=>wrap(v),first:async()=>s.get(...a)||null,all:async()=>({results:s.all(...a)}),run:async()=>({meta:s.run(...a)})});return wrap();}};const files=new Map();
const env={DB,PROJECT_FILES:{put:async(k,v)=>files.set(k,Uint8Array.from(v).buffer),get:async k=>files.get(k)||null},ADMIN_ORIGIN:origin,ADMIN_EMAIL:'fixture',ACCESS_ISSUER:'fixture',ACCESS_AUD:'fixture'};
const handler=createHandler(async()=>({email:'fixture'}));
http.createServer(async(req,res)=>{try{const path=new URL(req.url,origin).pathname;if(path==='/health'){res.end('ok');return;}if(['/shared/editor-content.js','/shared/editor-drafts.js','/vendor-js/marked.js','/vendor-js/purify.js','/vendor-js/js-yaml.js'].includes(path)){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(new URL('..'+path,import.meta.url)));return;}
 const chunks=[];for await(const c of req)chunks.push(c);const headers=new Headers(req.headers);headers.set('CF-Connecting-IP','192.0.2.1');const request=new Request(origin+req.url,{method:req.method,headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});const r=await (path.startsWith('/p/')?runtime.fetch(request,env):handler(request,env));res.statusCode=r.status;for(const [k,v] of r.headers)res.setHeader(k,k==='set-cookie'?v.replace('; Secure',''):k==='content-security-policy'?v.replaceAll('https://fexas25.github.io',origin):v);if(r.headers.get('Content-Type')?.startsWith('text/html'))res.end((await r.text()).replaceAll('https://fexas25.github.io',origin));else res.end(Buffer.from(await r.arrayBuffer()));}catch(e){res.statusCode=500;res.end(String(e));}}).listen(4175,'127.0.0.1');
