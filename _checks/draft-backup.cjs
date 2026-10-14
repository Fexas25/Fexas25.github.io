const fs=require('fs'),assert=require('assert/strict');
const {JSDOM}=require('jsdom');
const root=require('path').resolve(__dirname,'..') + '/' ;
const key='mx-writing-drafts-v1';
function page(saved={}){
 const dom=new JSDOM(fs.readFileSync(root+'_checks/fixtures/legacy-editor.html','utf8'),{url:'https://test.local/editor.html',runScripts:'outside-only'}),w=dom.window;
 for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v);
 w.confirm=()=>true;
 for(const f of ['vendor-js/marked.js','vendor-js/purify.js','vendor-js/js-yaml.js','editor-content.js','editor-drafts.js','editor.js'])w.eval(fs.readFileSync(root+f,'utf8'));
 const $=id=>w.document.getElementById(id),input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input'))};
 async function upload(text,name='test.md'){Object.defineProperty($('markdown-file'),'files',{configurable:true,value:[{name,size:text.length,text:async()=>text}]});$('markdown-file').dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,5));}
 return {w,$,input,upload,close:()=>w.close(),saved:()=>Object.fromEntries(Object.entries(w.localStorage))};
}

async function restore(p,data){const input=p.$('draft-backup-file'),text=typeof data==='string'?data:JSON.stringify(data);Object.defineProperty(input,'files',{configurable:true,value:[{name:'backup.json',size:text.length,text:async()=>text}]});input.dispatchEvent(new p.w.Event('change'));await new Promise(r=>setTimeout(r,5));}
(async()=>{
const a=page();a.input('post-title','第一篇');a.input('markdown-input','正文 A');a.$('draft-new').click();a.input('post-title','作品笔记');a.input('post-category','projects');a.input('work-type','ai');a.input('work-url','https://example.com/ai');a.input('markdown-input','正文 B');
const original=JSON.parse(a.w.MXDrafts.backup());assert.equal(original.items.length,2);
const b=page();await restore(b,original);assert.equal(b.w.MXDrafts.state().items.length,2);assert.equal(b.$('post-title').value,'作品笔记');assert.equal(b.$('work-url').value,'https://example.com/ai');
await restore(b,original);assert.equal(b.w.MXDrafts.state().items.length,2);assert.match(b.$('draft-backup-status').textContent,/跳过 2 篇/);
b.input('markdown-input','新设备上编辑后的正文');const active=b.w.MXDrafts.state().active;await restore(b,original);assert.equal(b.w.MXDrafts.state().items.length,3);assert.equal(b.$('markdown-input').value,'新设备上编辑后的正文');assert.equal(b.w.MXDrafts.state().active,active);assert.match(b.$('draft-backup-status').textContent,/1 篇另存/);
await restore(b,original);assert.equal(b.w.MXDrafts.state().items.length,3);
const saved=b.w.localStorage.getItem(key);for(const data of ['{broken',{format:'other',version:1,items:[]},{...original,items:[original.items[0],original.items[0]]},{...original,items:[{...original.items[0],meta:{'post-title':[]}}]},{...original,items:[{...original.items[0],meta:{__record:{path:'../bad.md',sha:'x',category:'projects',metadata:{}}}}]}]){await restore(b,data);assert.equal(b.w.localStorage.getItem(key),saved);assert.equal(b.$('markdown-input').value,'新设备上编辑后的正文');}
const extra=JSON.parse(JSON.stringify(original));extra.items[0].id='new';extra.items[0].body='其他设备的一篇新文章';b.w.Storage.prototype.setItem=()=>{throw Error('quota')};await restore(b,extra);assert.equal(b.w.localStorage.getItem(key),saved);assert.equal(b.w.MXDrafts.state().items.length,3);
b.input('markdown-input','存储失败但仍需备份的内容');let download;b.w.Blob=Blob;b.w.URL.createObjectURL=blob=>{download=blob;return 'blob:test'};b.w.URL.revokeObjectURL=()=>{};b.w.HTMLAnchorElement.prototype.click=()=>{};b.$('draft-backup-export').click();const exported=JSON.parse(await download.text());assert(exported.items.some(x=>x.body==='存储失败但仍需备份的内容'));assert(exported.items.some(x=>x.body==='新设备上编辑后的正文'));a.w.MXDrafts.validateBackup(exported);
const c=page();await restore(c,exported);assert.equal(c.w.MXDrafts.state().items.length,exported.items.length);const reloaded=page(c.saved());assert.equal(reloaded.w.MXDrafts.state().items.length,exported.items.length);
for(const p of [a,b,c,reloaded])p.close();
console.log('PASS: cross-device roundtrip, active draft, work metadata, idempotent restore, conflict copies, malformed input unchanged, quota failure atomicity, unsaved-content backup and reload.');
})().catch(error => { console.error(error); process.exit(1); });
