const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const code=fs.readFileSync(require('node:path').join(__dirname,'../site-translate.js'),'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const dom=new JSDOM('<button data-language="en">English</button><main><p id="article">新文章正文</p><pre>代码中文</pre><div class="writing-form">私人草稿</div><textarea>私人输入</textarea></main>',{url:'https://fexas25.github.io/',runScripts:'outside-only'});
 const w=dom.window;const sent=[];let resolveOld;
 w.MX_COMMUNITY={origin:'https://example.invalid'};
 w.fetch=async(url,opts)=>{if(!opts)return {ok:true,json:async()=>({})};sent.push(JSON.parse(opts.body).text);return {ok:true,json:async()=>({text:'New article body'})};};
 w.eval(code);w.document.querySelector('button').click();await wait(50);
 assert.equal(w.document.querySelector('#article').textContent,'New article body');
 assert.deepEqual(sent,['新文章正文']);
 w.document.querySelector('button').click();assert.equal(w.document.querySelector('#article').textContent,'新文章正文');
 w.document.querySelector('#article').textContent='另一篇文章';
 w.fetch=async()=>new Promise(r=>resolveOld=r);
 w.document.querySelector('button').click();await wait(10);w.document.querySelector('button').click();
 resolveOld({ok:true,json:async()=>({text:'Stale result'})});await wait(20);
 assert.equal(w.document.querySelector('#article').textContent,'另一篇文章');
 assert.equal(w.document.documentElement.lang,'zh-CN');
 w.MX_COMMUNITY.origin='';w.document.querySelector('button').click();await wait(20);
 assert.match(w.document.querySelector('[data-translation-status]').textContent,/unavailable/);
 let mutations=0;const observer=new w.MutationObserver(()=>mutations++);observer.observe(w.document.body,{subtree:true,childList:true,characterData:true});
 await wait(800);assert.equal(mutations,0,'status must not create an observer loop');
 observer.disconnect();w.close();
 const worker=(await import('../_community/worker.mjs')).default;
 const env={SITE_ORIGIN:'https://fexas25.github.io',DB:{},RATE_SECRET:'test'};
 const req=(body,origin=env.SITE_ORIGIN)=>new Request('https://worker.invalid/translate',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body});
 assert.equal((await worker.fetch(req('{}','https://other.invalid'),env)).status,403);
 assert.equal((await worker.fetch(req('null'),env)).status,400);
 assert.equal((await worker.fetch(req(JSON.stringify({text:'x'.repeat(401)})),env)).status,400);
 assert.equal((await worker.fetch(req(JSON.stringify({text:'x'.repeat(9000)})),env)).status,400);
 let cached=null,modelCalls=0,limited=false;
 env.DB = {
   prepare(sql) {
     return {
       bind(...args) {
         return {
           first: async () => cached,
           run: async () => {
             if(sql.startsWith('INSERT OR REPLACE')) cached={text:args[1]};
             return {meta:{changes:limited?0:1}};
           }
         };
       }
     };
   }
 };
 env.AI={run:async(model,input)=>{modelCalls++;assert.equal(input.source_lang,'zh');return {translated_text:'A translated article'};}};
 let response=await worker.fetch(req(JSON.stringify({text:'一篇文章'})),env);
 assert.equal(response.status,200);assert.equal((await response.json()).text,'A translated article');
 response=await worker.fetch(req(JSON.stringify({text:'一篇文章'})),env);
 assert.equal(response.status,200);assert.equal(modelCalls,1,'cached text must not consume another AI call');
 cached=null;limited=true;
 assert.equal((await worker.fetch(req(JSON.stringify({text:'新文章'})),env)).status,429);
 assert.equal(modelCalls,1);
 console.log('Translation privacy, restore, cancellation, observer and service validation passed.');
})().catch(error=>{console.error(error);process.exitCode=1;});
