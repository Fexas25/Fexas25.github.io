const fs=require('fs'),assert=require('assert/strict');
const {JSDOM}=require('jsdom');
const root=require('path').resolve(__dirname,'..') + '/' ;
const key='mx-writing-drafts-v1';
function page(saved={}){
 const dom=new JSDOM(fs.readFileSync(root+'editor.html','utf8'),{url:'https://test.local/editor.html',runScripts:'outside-only'}),w=dom.window;
 for(const [k,v] of Object.entries(saved))w.localStorage.setItem(k,v);
 w.confirm=()=>true;
 for(const f of ['vendor-js/marked.js','vendor-js/purify.js','vendor-js/js-yaml.js','editor-content.js','editor-drafts.js','editor.js'])w.eval(fs.readFileSync(root+f,'utf8'));
 const $=id=>w.document.getElementById(id),input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input'))};
 async function upload(text,name='test.md'){Object.defineProperty($('markdown-file'),'files',{configurable:true,value:[{name,size:text.length,text:async()=>text}]});$('markdown-file').dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,5));}
 return {w,$,input,upload,close:()=>w.close(),saved:()=>Object.fromEntries(Object.entries(w.localStorage))};
}
(async()=>{
 const p=page({'markdown-draft':'旧草稿 **保留**','mx-writing-meta':JSON.stringify({'post-title':'旧标题','post-category':'blog','post-date':'2026-02-01'})});
 assert.equal(p.$('markdown-input').value,'旧草稿 **保留**');
 p.$('draft-new').click();assert.equal(p.$('draft-select').options.length,2);p.input('post-title','第二篇');p.input('markdown-input','第二篇正文');
 const second=p.w.MXDrafts.state().active;p.$('draft-select').value='legacy';p.$('draft-open').click();assert.equal(p.$('post-title').value,'旧标题');
 p.input('markdown-input','旧草稿修改');p.$('draft-select').value=second;p.$('draft-open').click();assert.equal(p.$('markdown-input').value,'第二篇正文');
 await p.upload('\uFEFF---\r\ntitle: "AI 作品"\r\ndate: 2026-02-02T12:00:00+08:00\r\ncategory: projects\r\ntype: ai\r\nexternal_url: https://example.com/ai\r\ntags: [AI, 测试]\r\nseo_description: 自定义摘要\r\n---\r\n\r\n# 使用说明\r\n正文');
 assert.equal(p.$('post-title').value,'AI 作品');assert.equal(p.$('work-type').value,'ai');assert.equal(p.w.MXEditor.record(),null);
 const doc=p.w.MXEditor.exportDocument();assert.match(doc.text,/seo_description: 自定义摘要/);assert.match(doc.text,/2026-02-02T12:00:00\+08:00/);assert.match(doc.text,/tags:/);assert.equal(doc.folder,'_projects');
 assert.equal(p.$('post-tags').value,'AI, 测试');
 p.input('post-tags','算法，C++，算法');assert.deepEqual(Array.from(p.w.jsyaml.load(p.w.MXEditor.exportDocument().text.split('---')[1]).tags),['算法','C++']);
 const tagged=page(p.saved());assert.equal(tagged.$('post-tags').value,'算法，C++，算法');tagged.close();
 p.input('post-tags','');assert.match(p.w.MXEditor.exportDocument().text,/tags: \[\]/);
 const library=p.w.localStorage.getItem(key),body=p.$('markdown-input').value;
 await p.upload('---\ntitle: 不合法的标签\ntags: [123]\n---\n正文');assert.equal(p.w.localStorage.getItem(key),library);
 await p.upload('---\ntitle: [broken\n---\nbody');assert.equal(p.$('markdown-input').value,body);assert.equal(p.w.localStorage.getItem(key),library);
 await p.upload('---\ndate: 2026-02-30\n---\nbody');assert.equal(p.w.localStorage.getItem(key),library);
 await p.upload('# 普通文章\n\n正文<img src=x onerror="alert(1)"><script>alert(1)</script>');assert.equal(p.$('post-title').value,'普通文章');assert.equal(p.$('preview-content').querySelector('script'),null);assert.equal(p.$('preview-content').querySelector('img').hasAttribute('onerror'),false);
 const q=page(p.saved());assert.equal(q.$('post-title').value,'普通文章');assert.equal(q.$('draft-select').options.length,4);q.$('clear-editor').click();assert.equal(q.$('draft-select').options.length,3);assert.equal(q.$('markdown-input').value,'');q.close();
 const legacyTags=page({[key]:JSON.stringify({version:1,active:'old',items:[{id:'old',body:'旧正文',updatedAt:new Date().toISOString(),meta:{'post-title':'旧标签草稿','post-category':'blog','post-date':'2026-02-01',__imported:{tags:['旧标签','AI']}}}]})});
 assert.equal(legacyTags.$('post-tags').value,'旧标签, AI');assert.deepEqual(Array.from(legacyTags.w.jsyaml.load(legacyTags.w.MXEditor.exportDocument().text.split('---')[1]).tags),['旧标签','AI']);legacyTags.close();
 const before=p.w.localStorage.getItem(key);p.w.Storage.prototype.setItem=()=>{throw Error('quota')};p.input('markdown-input','未能保存的正文');p.$('draft-new').click();assert.equal(p.$('markdown-input').value,'未能保存的正文');assert.equal(p.w.localStorage.getItem(key),before);assert.match(p.$('draft-status').textContent,/无法保存/);p.close();
 const broken=page({[key]:'broken','markdown-draft':'原备份'});broken.input('markdown-input','临时内容');broken.$('draft-new').click();assert.equal(broken.w.localStorage.getItem(key),'broken');assert.equal(broken.$('markdown-input').value,'临时内容');broken.close();
 const conflict=page();conflict.input('post-title','原内容');const other=JSON.stringify({version:1,active:null,items:[]});conflict.w.localStorage.setItem(key,other);conflict.input('markdown-input','另一个标签页冲突');assert.equal(conflict.w.localStorage.getItem(key),other);assert.match(conflict.$('draft-status').textContent,/另一标签页/);conflict.close();
 const topics=page();await topics.upload('---\ntitle: 游戏开发笔记\ncategory: competitive-programming\ntopic: game-dev\ndate: 2026-02-01\n---\n正文');
 assert.equal(topics.$('post-topic').value,'game-dev');assert.equal(topics.$('blog-topic-field').hidden,false);assert.match(topics.w.MXEditor.exportDocument().text,/topic: game-dev/);
 topics.input('post-topic','ai');const topicReload=page(topics.saved());assert.equal(topicReload.$('post-topic').value,'ai');assert.match(topicReload.w.MXEditor.exportDocument().text,/topic: ai/);topicReload.close();
 topics.$('draft-new').click();assert.equal(topics.$('post-topic').value,'notes');
 assert.equal(topics.w.MXContent.topic({title:'不是一道刷题笔记'}),'notes');assert.equal(topics.w.MXContent.topic({tags:['LeetCode']}),'leetcode');
 topics.close();
 console.log('PASS: legacy migration, multi-draft switching/reload/delete isolation, YAML/BOM/CRLF/plain Markdown import, metadata roundtrip, malformed import preservation, preview XSS protection, quota/corrupt storage/conflict protection.');
})().catch(error => { console.error(error); process.exit(1); });
