import test from 'node:test';
import assert from 'node:assert/strict';
import {translateText} from './translation.mjs';
import worker from './worker.mjs';

test('emoji, skin tone, joined emoji, flags and newlines are preserved',async()=>{
 const calls=[];const text='太强了👍🏻👍🏻\n投喂小鱼干🐟🐟（？）';
 const out=await translateText(text,async text=>{calls.push(text);return {'太强了':'Amazing!','投喂小鱼干':'Some fish treats'}[text]});
 assert.equal(out,'Amazing!👍🏻👍🏻\nSome fish treats🐟🐟（？）');assert.deepEqual(calls,['太强了','投喂小鱼干']);
 assert.equal(await translateText('Hello 👩🏽‍💻🇨🇳1️⃣\r\n',()=>assert.fail('no translation needed')),'Hello 👩🏽‍💻🇨🇳1️⃣\r\n');
});
test('failed partial translation is never cached; retry completes and cache avoids model calls',async()=>{
 const cache=new Map();let fail=true,calls=0,quota=0;
 const env={SITE_ORIGIN:'https://site.test',RATE_SECRET:'test',AI:{run:async(model,{text})=>{calls++;return {translated_text:fail&&text==='投喂小鱼干'?'':text==='太强了'?'Amazing!':'Some fish treats'};}},DB:{prepare:sql=>({bind:(...args)=>({first:async()=>cache.has(args[0])?{text:cache.get(args[0])}:null,run:async()=>{if(sql.includes('quotas'))quota++;else cache.set(args[0],args[1]);return {meta:{changes:1}};}})})}};
 const request=()=>worker.fetch(new Request('https://service.test/translate',{method:'POST',headers:{Origin:env.SITE_ORIGIN,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({text:'太强了👍🏻👍🏻\n投喂小鱼干🐟🐟（？）'})}),env);
 let response=await request();assert.equal(response.status,502);assert.equal(cache.size,0);
 fail=false;response=await request();assert.equal(response.status,200);assert.equal((await response.json()).text,'Amazing!👍🏻👍🏻\nSome fish treats🐟🐟（？）');assert.equal(cache.size,1);
 const previous=calls;await request();assert.equal(calls,previous);assert.equal(quota,calls*2);
});
test('model exceptions and daily limits preserve failure without caching',async()=>{
 await assert.rejects(translateText('测试',async()=>{throw Error('offline')}),/offline/);
 await assert.rejects(translateText('测试',async()=>''),e=>e.status===502);
});
