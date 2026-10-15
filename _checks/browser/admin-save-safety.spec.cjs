const {reveal}=require('../key-view.cjs');
const {test,expect}=require('@playwright/test');
const admin='http://127.0.0.1:4175';
const overflow=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
async function noStoredKey(page,key){expect(await page.evaluate(()=>JSON.stringify({...localStorage})+JSON.stringify({...sessionStorage}))).not.toContain(key);}

test('手写新文章首次暂存绑定地址，刷新继续同一草稿且保留其他草稿',async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('已有草稿');await page.locator('#markdown-input').fill('不同内容要保留');
 await page.goto(admin+'/write');await page.locator('#post-title').fill('新文章');await page.locator('#markdown-input').fill('刷新继续写');await expect(page).toHaveURL(/\/write\?draft=/);const url=page.url();
 await page.reload();await expect(page.locator('#markdown-input')).toHaveValue('刷新继续写');await expect(page).toHaveURL(url);expect(await page.evaluate(()=>MXDrafts.state().items.map(d=>d.body).sort())).toEqual(['不同内容要保留','刷新继续写'].sort());await overflow(page);
});

test('文章密钥连续保存保持可复制，不进入存储，导入后清除',async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('密钥回归');await page.locator('#markdown-input').fill('私密正文');await page.locator('#post-visibility').selectOption('private');await page.locator('#publish').click();await reveal(page);const key=await reveal(page);
 await page.locator('#post-title').fill('修改标题');await page.locator('#publish').click();await expect(page.locator('#publish')).toBeEnabled();expect(await reveal(page)).toBe(key);await noStoredKey(page,key);
 await page.locator('#rotate').check();page.once('dialog',d=>d.accept());await page.locator('#publish').click();await expect(page.locator('#publish')).toBeEnabled();expect(await reveal(page)).not.toBe(key);const next=await reveal(page);await noStoredKey(page,next);
 await page.locator('#markdown-file').setInputFiles({name:'another.md',mimeType:'text/markdown',buffer:Buffer.from('# 另一篇\n\n新内容')});await expect(page.locator('#share-key')).toHaveValue('');await expect(page.locator('#key-label')).toBeHidden();await overflow(page);
});

test('项目保存响应丢失后可重试，密钥连续保存保留且刷新不回显',async({page})=>{
 await page.goto(admin+'/projects/new');await page.locator('#title').fill('项目重试');await page.locator('#slug').fill('retry-'+test.info().project.name+'-'+Date.now());await page.locator('#kind').selectOption('link');await page.locator('#external-url').fill('https://example.com');await page.locator('#visibility').selectOption('private');
 let lost=false;await page.route('**/api/projects',async r=>{if(r.request().postDataJSON().action==='save'&&!lost){lost=true;await r.fetch();return r.abort('failed');}await r.continue();});
 await page.locator('#save-project').click();await expect(page.locator('#status')).toContainText('保存结果尚未确认');await expect(page.locator('#status')).not.toContainText('原线上版本保留');await page.locator('#save-project').click();await expect(page.locator('#status')).toContainText('已保存到项目草稿');const key=await reveal(page);expect(key.length).toBe(43);
 await page.locator('#title').fill('继续修改');await page.locator('#save-project').click();await expect(page.locator('#save-project')).toBeEnabled();expect(await reveal(page)).toBe(key);await page.locator('#publish-project').click();await expect(page.locator('#status')).toContainText('已发布');expect(await reveal(page)).toBe(key);await noStoredKey(page,key);
 await page.reload();await expect(page.locator('#title')).toHaveValue('继续修改');await expect(page.locator('#share-key')).toHaveValue('');await overflow(page);
});

test('读取项目包时锁定操作，坏包不会丢掉此前选择的完整包',async({page})=>{
 await page.addInitScript(()=>{const read=Blob.prototype.arrayBuffer;let once=true;Blob.prototype.arrayBuffer=async function(){if(once){once=false;await new Promise(resolve=>window.releasePackage=resolve);}return read.call(this);};});
 await page.goto(admin+'/projects/new');await page.locator('#title').fill('读取保护');await page.locator('#slug').fill('read-'+test.info().project.name+'-'+Date.now());await page.locator('#files').setInputFiles({name:'index.html',mimeType:'text/html',buffer:Buffer.from('<h1>原项目</h1>')});
 await expect(page.locator('#status')).toContainText('正在读取');for(const id of ['save-project','publish-project','preview-project'])await expect(page.locator('#'+id)).toBeDisabled();await page.evaluate(()=>releasePackage());await expect(page.locator('#status')).toContainText('已选择 1 个文件');
 await page.locator('#files').setInputFiles({name:'bad.zip',mimeType:'application/zip',buffer:Buffer.from('broken zip')});await expect(page.locator('#status')).toContainText('之前选择的文件保留');await expect(page.locator('#entry')).toHaveValue('index.html');await page.locator('#publish-project').click();await expect(page.locator('#status')).toContainText('已发布');await overflow(page);
});


test('发布中离开有保护，后续改动还原后地址转回文章',async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('地址同步');await page.locator('#markdown-input').fill('提交正文');
 let release;await page.route('**/api/documents',async r=>{if(r.request().postDataJSON().action==='save'){const response=await r.fetch();await new Promise(resolve=>release=resolve);await r.fulfill({response});}else await r.continue();});
 await page.locator('#publish').click();await expect.poll(()=>typeof release).toBe('function');await expect(page.locator('#post-category')).toBeDisabled();
 expect(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});dispatchEvent(event);return event.defaultPrevented;})).toBe(true);
 await page.locator('#markdown-input').fill('后续改动');release();await expect(page.locator('#status')).toContainText('已保存到网站');await expect(page).toHaveURL(/draft=/);
 await page.locator('#markdown-input').fill('提交正文');await expect(page).toHaveURL(/articles\/edit\?id=/);expect(await page.evaluate(()=>MXDrafts.state().items)).toHaveLength(0);
 await page.reload();await expect(page.locator('#markdown-input')).toHaveValue('提交正文');await overflow(page);
});

test('回收站文章的差异草稿保留可编辑，不能误关联或发布',async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('回收站关联');await page.locator('#markdown-input').fill('线上正文');await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('已保存到网站');const articleId=new URL(page.url()).searchParams.get('id');
 await page.locator('#markdown-input').fill('差异草稿');const draftId=await page.evaluate(()=>MXDrafts.state().items[0].id);
 await page.evaluate(async id=>{const row=await MXAdminApi('documents',{action:'read',id});await MXAdminApi('documents',{action:'trash',id,revision:row.revision});},articleId);
 await page.goto(admin+'/write?draft='+draftId);await expect(page.locator('#status')).toContainText('原文章已在回收站');await expect(page.locator('#link-panel')).toBeHidden();await expect(page.locator('#publish')).toBeDisabled();await page.locator('#markdown-input').fill('继续保留的差异');expect((await page.evaluate(()=>MXDrafts.state().items))[0].body).toBe('继续保留的差异');await expect(page.locator('#publish')).toBeDisabled();await overflow(page);
});

test('项目真实冲突保留本页，取消核对不覆盖，确认后显式保存',async({page})=>{
 await page.goto(admin+'/projects/new');await page.locator('#title').fill('最初版本');await page.locator('#slug').fill('conflict-'+test.info().project.name+'-'+Date.now());await page.locator('#kind').selectOption('link');await page.locator('#external-url').fill('https://example.com');await page.locator('#publish-project').click();await expect(page.locator('#status')).toContainText('已发布');const id=new URL(page.url()).searchParams.get('id');
 await page.evaluate(async id=>{const r=await MXAdminApi('projects',{action:'read',id});await MXAdminApi('projects',{...r,action:'save',title:'另一页更新'});},id);
 await page.locator('#title').fill('本页修改');await page.locator('#publish-project').click();await expect(page.getByRole('button',{name:'核对线上版本'})).toBeVisible();await expect(page.locator('#title')).toHaveValue('本页修改');
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'核对线上版本'}).click();await expect(page.getByRole('button',{name:'核对线上版本'})).toBeVisible();
 expect(await page.evaluate(async id=>(await MXAdminApi('projects',{action:'read',id})).title,id)).toBe('另一页更新');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'核对线上版本'}).click();await expect(page.locator('#status')).toContainText('已核对');expect(await page.evaluate(async id=>(await MXAdminApi('projects',{action:'read',id})).title,id)).toBe('另一页更新');
 await page.locator('#publish-project').click();await expect(page.locator('#status')).toContainText('已保存');expect(await page.evaluate(async id=>(await MXAdminApi('projects',{action:'read',id})).title,id)).toBe('本页修改');await overflow(page);
});


test('旧项目草稿核对后跟随发布状态，旧密钥不回显也不自动轮换',async({page})=>{
 await page.goto(admin+'/projects/new');await page.locator('#title').fill('状态同步');await page.locator('#slug').fill('state-'+test.info().project.name+'-'+Date.now());await page.locator('#kind').selectOption('link');await page.locator('#external-url').fill('https://example.com');await page.locator('#visibility').selectOption('private');await page.locator('#save-project').click();await expect(page.locator('#status')).toContainText('已保存到项目草稿');const id=new URL(page.url()).searchParams.get('id'),oldKey=await reveal(page);
 await page.evaluate(async id=>{const r=await MXAdminApi('projects',{action:'read',id});await MXAdminApi('projects',{...r,action:'save',state:'published',key:'B'.repeat(43)});},id);
 await page.locator('#title').fill('本页新标题');await page.locator('#save-project').click();await expect(page.getByRole('button',{name:'核对线上版本'})).toBeVisible();await expect(page.locator('#share-key')).toHaveValue('');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'核对线上版本'}).click();await expect(page.locator('#save-project')).toBeHidden();await expect(page.locator('#publish-project')).toHaveText('保存修改');await expect(page).toHaveURL(/projects\/edit/);
 let sent;await page.route('**/api/projects',async r=>{if(r.request().postDataJSON().action==='save')sent=r.request().postDataJSON();await r.continue();});
 await page.locator('#publish-project').click();await expect(page.locator('#status')).toContainText('已保存');expect(sent.state).toBe('published');expect(sent.key).toBeUndefined();await expect(page.locator('#share-key')).toHaveValue('');await noStoredKey(page,oldKey);await overflow(page);
});

test('文章冲突原地核对且保留草稿，取消不覆盖，旧密钥清除',async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('文章冲突');await page.locator('#markdown-input').fill('第一版');await page.locator('#post-visibility').selectOption('private');await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('已保存到网站');const id=new URL(page.url()).searchParams.get('id');const oldKey=await reveal(page);
 await page.evaluate(async id=>{const r=await MXAdminApi('documents',{action:'read',id});await MXAdminApi('documents',{action:'save',id,revision:r.revision,visibility:r.visibility,key:'C'.repeat(43),document:{...r.document,text:r.document.text.replace('第一版','另一页正文')},metadata:{date:r.date,tags:r.tags,topic:r.topic,type:r.type}});},id);
 await page.locator('#markdown-input').fill('本页差异正文');await page.locator('#publish').click();await expect(page.locator('#link-latest')).toHaveValue('另一页正文');await expect(page.locator('#publish')).toBeDisabled();await expect(page.locator('#link-choice')).toBeDisabled();await expect(page.locator('#share-key')).toHaveValue('');expect((await page.evaluate(()=>MXDrafts.state().items))[0].body).toBe('本页差异正文');
 page.once('dialog',d=>d.dismiss());await page.locator('#link-confirm').click();await expect(page.locator('#publish')).toBeDisabled();
 page.once('dialog',d=>d.accept());await page.locator('#link-confirm').click();await expect(page.locator('#markdown-input')).toHaveValue('本页差异正文');expect((await page.evaluate(()=>MXDrafts.state().items))[0].body).toBe('本页差异正文');
 expect(await page.evaluate(async id=>(await MXAdminApi('documents',{action:'read',id})).document.text,id)).toContain('另一页正文');
 let sent;await page.route('**/api/documents',async r=>{if(r.request().postDataJSON().action==='save')sent=r.request().postDataJSON();await r.continue();});await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('已保存到网站');expect(sent.key).toBeUndefined();await expect(page.locator('#share-key')).toHaveValue('');await noStoredKey(page,oldKey);await overflow(page);
});

test('草稿删除区分本机与回收站，项目请求中防止重复删除',async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('本机保留');await page.locator('#markdown-input').fill('不要误删');await page.goto(admin+'/projects/new');await page.locator('#title').fill('可恢复草稿');await page.locator('#slug').fill('delete-'+test.info().project.name+'-'+Date.now());await page.locator('#kind').selectOption('link');await page.locator('#external-url').fill('https://example.com');await page.locator('#save-project').click();await expect(page.locator('#status')).toContainText('已保存到项目草稿');
 await page.goto(admin+'/drafts');const article=page.locator('.hub-card').filter({hasText:'本机保留'}),project=page.locator('.hub-card').filter({hasText:'可恢复草稿'});await expect(project).toBeVisible();
 page.once('dialog',async d=>{expect(d.message()).toContain('无法从回收站恢复');await d.dismiss();});await article.getByRole('button',{name:'删除草稿'}).click();await expect(article).toBeVisible();
 let release,count=0;await page.route('**/api/projects',async r=>{if(r.request().postDataJSON().action==='trash'){count++;const response=await r.fetch();await new Promise(resolve=>release=resolve);await r.fulfill({response});}else await r.continue();});
 page.once('dialog',async d=>{expect(d.message()).toContain('可在已发布项目的回收站恢复');await d.accept();});await project.getByRole('button',{name:'移入回收站'}).click();await expect.poll(()=>typeof release).toBe('function');await expect(project.getByRole('button')).toBeDisabled();await expect(page.locator('#refresh')).toBeDisabled();await page.locator('#search').fill('可恢复');await expect(project.getByRole('button')).toBeDisabled();release();await expect(project).toHaveCount(0);expect(count).toBe(1);await page.locator('#search').fill('');await expect(article).toBeVisible();await overflow(page);
});


for(const type of ['article','project'])for(const committed of [false,true])test(type+' 保存失败后取消换密钥，核实 '+committed,async({page})=>{
 const isArticle=type==='article',api=isArticle?'documents':'projects',save=isArticle?'#publish':'#publish-project';
 await page.goto(admin+(isArticle?'/write':'/projects/new'));
 if(isArticle){await page.locator('#post-title').fill('取消换密钥');await page.locator('#markdown-input').fill('保留正文');await page.locator('#post-visibility').selectOption('private');}
 else{await page.locator('#title').fill('取消换密钥');await page.locator('#slug').fill('cancel-'+test.info().project.name+'-'+Date.now());await page.locator('#kind').selectOption('link');await page.locator('#external-url').fill('https://example.com');await page.locator('#visibility').selectOption('private');}
 await page.locator(save).click();await reveal(page);const old=await reveal(page);const id=new URL(page.url()).searchParams.get('id');let pending,once=false,sent=[];
 await page.route('**/api/'+api,async r=>{const d=r.request().postDataJSON();if(d.action==='save'){sent.push(d);if(!once){once=true;pending=d.key;if(committed)await r.fetch();return r.abort('failed');}}await r.continue();});
 await page.locator('#rotate').check();page.once('dialog',d=>d.accept());await page.locator(save).click();await expect(page.locator(save)).toBeEnabled();expect(pending).toHaveLength(43);await page.locator('#rotate').uncheck();await page.locator(save).click();await expect(page.locator('#status')).toContainText(isArticle?'已保存到网站':'已保存');expect(sent.at(-1).key).toBeUndefined();
 expect(await page.evaluate(async({api,id,key})=>(await MXAdminApi(api,{action:'check-key',id,key})).matches,{api,id,key:committed?pending:old})).toBe(true);
 expect(await page.evaluate(async({api,id,key})=>(await MXAdminApi(api,{action:'check-key',id,key})).matches,{api,id,key:committed?old:pending})).toBe(false);
 if(committed)expect(await reveal(page)).toBe(pending);else expect(await reveal(page)).not.toBe(pending);
 await noStoredKey(page,pending);await overflow(page);
});

test('文章核对旧请求不能覆盖新选择或导入内容',async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('旧请求');await page.locator('#markdown-input').fill('原正文');await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('已保存到网站');
 await page.evaluate(async()=>{const id=new URL(location.href).searchParams.get('id'),row=await MXAdminApi('documents',{action:'read',id}),r=MXContent.parse(row.document.text,row.document.folder+'/'+row.document.filename,'old-revision');r.documentId=id;r.visibility=row.visibility;const meta=Object.fromEntries(MXWriting.fields.map(k=>[k,document.getElementById(k).value]));MXDrafts.save({id:'stale',body:'保留差异',meta:{...meta,__record:r,__imported:r.metadata}});});
 await page.goto(admin+'/write?draft=stale');await expect(page.locator('#link-confirm')).toBeEnabled();let release;
 await page.route('**/api/documents',async r=>{if(r.request().postDataJSON().action==='read'){const response=await r.fetch();await new Promise(resolve=>release=resolve);await r.fulfill({response});}else await r.continue();});
 await page.locator('#link-load').click();await expect.poll(()=>typeof release).toBe('function');await page.locator('#link-choice').dispatchEvent('change');let response=page.waitForResponse('**/api/documents');release();await (await response).finished();await page.evaluate(()=>new Promise(requestAnimationFrame));await expect(page.locator('#link-confirm')).toBeDisabled();
 release=null;await page.locator('#link-load').click();await expect.poll(()=>typeof release).toBe('function');await page.locator('#markdown-file').setInputFiles({name:'new.md',mimeType:'text/markdown',buffer:Buffer.from('# 新文档\n\n新正文')});await expect(page).toHaveURL(/write\?draft=/);response=page.waitForResponse('**/api/documents');release();await (await response).finished();await page.evaluate(()=>new Promise(requestAnimationFrame));await expect(page.locator('#link-panel')).toBeHidden();await expect(page.locator('#markdown-input')).toHaveValue(/新正文/);await expect(page.locator('#link-confirm')).toBeDisabled();expect((await page.evaluate(()=>MXDrafts.state().items)).some(d=>d.body==='保留差异')).toBe(true);await overflow(page);
});

test('项目草稿加载期间不能打断列表，加载后删除本机草稿保留项目',async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('待删除本机');await page.locator('#markdown-input').fill('本机正文');
 let release;await page.route('**/api/projects',async r=>{await new Promise(resolve=>release=resolve);await r.fulfill({json:{projects:[{id:'11111111-1111-4111-8111-111111111111',title:'等待加载的项目',updated:100,revision:'v1'}]}});});
 await page.goto(admin+'/drafts');await expect.poll(()=>typeof release).toBe('function');const button=page.getByRole('button',{name:'删除草稿'});await expect(button).toBeDisabled();release();await expect(page.getByRole('heading',{name:'等待加载的项目'})).toBeVisible();await expect(button).toBeEnabled();page.once('dialog',d=>d.accept());await button.click();await expect(page.getByRole('heading',{name:'待删除本机'})).toHaveCount(0);await expect(page.getByRole('heading',{name:'等待加载的项目'})).toBeVisible();await overflow(page);
});


async function downloadText(download){const stream=await download.createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);return Buffer.concat(chunks).toString('utf8');}
for(const work of [false,true])test((work?'作品介绍':'文章')+' Markdown 导出导入保留隐私，转公开不残留私密标记',async({page})=>{
 await page.goto(admin+(work?'/projects/article':'/write'));await page.locator('#post-title').fill('隐私往返');await page.locator('#markdown-input').fill('原有正文');await page.locator('#post-visibility').selectOption('private');await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('已保存到网站');const key=await reveal(page);expect(key).toHaveLength(43);
 let event=page.waitForEvent('download');await page.locator('#export').click();const text=await downloadText(await event);expect(text).toContain('private: true');expect(text).not.toContain(key);
 await page.locator('#markdown-file').setInputFiles({name:'private.md',mimeType:'text/markdown',buffer:Buffer.from(text)});await expect(page.locator('#post-visibility')).toHaveValue('private');await expect(page.locator('#markdown-input')).toHaveValue('原有正文');await expect(page.locator('#share-key')).toHaveValue('');
 await page.locator('#post-visibility').selectOption('public');event=page.waitForEvent('download');await page.locator('#export').click();const publicText=await downloadText(await event);expect(publicText).not.toContain('private: true');await page.locator('#markdown-file').setInputFiles({name:'public.md',mimeType:'text/markdown',buffer:Buffer.from(publicText)});await expect(page.locator('#post-visibility')).toHaveValue('public');await expect(page.locator('#markdown-input')).toHaveValue('原有正文');
 await page.locator('#markdown-file').setInputFiles({name:'invalid.md',mimeType:'text/markdown',buffer:Buffer.from('---\ntitle: 错误标记\nprivate: "true"\n---\n\n不可误导入')});await expect(page.locator('#status')).toContainText('private 必须');await expect(page.locator('#markdown-input')).toHaveValue('原有正文');await overflow(page);
});

test('草稿备份读取另一页最新内容，读取异常不下载旧备份且不改本页快照',async({page,context})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('原有草稿');await page.locator('#markdown-input').fill('旧正文');const draft=new URL(page.url()).searchParams.get('draft');await page.goto(admin+'/drafts');await expect(page.getByRole('heading',{name:'原有草稿'})).toBeVisible();
 const other=await context.newPage();await other.goto(admin+'/write?draft='+draft);await other.locator('#markdown-input').fill('另一页最新正文');await other.goto(admin+'/write');await other.locator('#post-title').fill('另一页新增');await other.locator('#markdown-input').fill('差异内容');
 await page.getByText('备份与恢复文章草稿',{exact:true}).click();const event=page.waitForEvent('download');await page.locator('#backup').click();const exported=JSON.parse(await downloadText(await event));expect(exported.items.map(d=>d.body).sort()).toEqual(['另一页最新正文','差异内容'].sort());expect((await page.evaluate(()=>MXDrafts.state().items))[0].body).toBe('旧正文');
 let downloads=0;page.on('download',()=>downloads++);await page.evaluate(()=>localStorage.setItem('mx-writing-drafts-v1','{broken'));await page.locator('#backup').click();await expect(page.locator('#status')).toContainText('无法读取草稿库');expect(downloads).toBe(0);expect((await page.evaluate(()=>MXDrafts.state().items))[0].body).toBe('旧正文');await other.close();await overflow(page);
});

for(const category of ['competitive-programming','art'])test(category+' 导出覆盖旧栏目，重新导入保持栏目和正文',async({page})=>{
 const work=category==='art';await page.goto(admin+(work?'/projects/article':'/write'));
 await page.locator('#markdown-file').setInputFiles({name:'old.md',mimeType:'text/markdown',buffer:Buffer.from('---\ncategory: '+(work?'projects':'blog')+'\ntitle: 原有文章\nprivate: true\n---\n\n原有正文')});
 await page.locator('#post-category').selectOption(category);const event=page.waitForEvent('download');await page.locator('#export').click();const text=await downloadText(await event);
 await page.goto(admin+(work?'/projects/article':'/write'));await page.locator('#markdown-file').setInputFiles({name:'again.md',mimeType:'text/markdown',buffer:Buffer.from(text)});
 await expect(page.locator('#post-category')).toHaveValue(category);await expect(page.locator('#markdown-input')).toHaveValue('原有正文');await expect(page.locator('#post-visibility')).toHaveValue('private');await overflow(page);
});

test('首次发布失败后栏目恢复可选，原草稿保留',async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('失败保留');await page.locator('#markdown-input').fill('原正文');await page.locator('#post-category').selectOption('competitive-programming');
 await page.route('**/api/documents',r=>r.abort());await page.locator('#publish').click();await expect(page.locator('#publish')).toBeEnabled();await expect(page.locator('#post-category')).toBeEnabled();await expect(page.locator('#post-category')).toHaveValue('competitive-programming');expect((await page.evaluate(()=>MXDrafts.state().items))[0].body).toBe('原正文');await overflow(page);
});

test('慢网核对并行且不锁删除，删除后迟到结果不改列表，差异草稿保留',async({page})=>{
 await page.goto(admin+'/write');await page.evaluate(()=>{for(let i=0;i<4;i++)MXDrafts.save({id:'slow-'+i,meta:{'post-title':'慢网草稿'+i,'post-category':'blog',__publishId:'doc-'+i},body:'差异正文'+i});});
 const pending=[];await page.route('**/api/documents',async r=>{await new Promise(resolve=>pending.push(resolve));await r.fulfill({status:503,json:{error:'暂时不可用'}});});
 await page.goto(admin+'/drafts');await expect.poll(()=>pending.length).toBe(3);await expect(page.locator('#status')).toContainText('正在核对');const first=page.locator('article').filter({has:page.getByRole('heading',{name:'慢网草稿0',exact:true})});await expect(first.getByRole('button',{name:'删除草稿'})).toBeEnabled();page.once('dialog',d=>d.accept());await first.getByRole('button',{name:'删除草稿'}).click();
 for(const done of pending)done();await expect(page.locator('#status')).toContainText('已删除本机草稿');await expect(page.getByRole('heading',{name:'慢网草稿0',exact:true})).toHaveCount(0);expect((await page.evaluate(()=>MXDrafts.state().items)).map(d=>d.body).sort()).toEqual(['差异正文1','差异正文2','差异正文3']);await overflow(page);
});

for(const fail of [false,true])test('Markdown 慢读取锁定发布和重复导入，保留旧草稿 '+fail,async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('旧文章');await page.locator('#markdown-input').fill('原有差异正文');
 await page.evaluate(()=>{const read=Blob.prototype.text;window.fileReads=0;Blob.prototype.text=async function(){window.fileReads++;await new Promise(resolve=>window.finishImport=resolve);return read.call(this);};});
 let saves=0;page.on('request',r=>{if(r.url().endsWith('/api/documents')&&r.postDataJSON()?.action==='save')saves++;});
 await page.locator('#markdown-file').setInputFiles({name:'new.md',mimeType:'text/markdown',buffer:Buffer.from(fail?'---\ntitle: [broken\n---\nbody':'# 导入的新文章\n\n新文章正文')});
 await expect(page.locator('#status')).toContainText('正在读取');for(const id of ['publish','markdown-import','markdown-input','post-category'])await expect(page.locator('#'+id)).toBeDisabled();
 await page.evaluate(async()=>{await document.getElementById('publish').onclick();await document.getElementById('markdown-file').onchange();});expect(saves).toBe(0);expect(await page.evaluate(()=>fileReads)).toBe(1);
 await page.evaluate(()=>finishImport());await expect(page.locator('#publish')).toBeEnabled();await expect(page.locator('#markdown-input')).toHaveValue(fail?'原有差异正文':/新文章正文/);
 const ds=await page.evaluate(()=>MXDrafts.state().items);expect(ds.some(d=>d.body==='原有差异正文')).toBe(true);if(!fail){expect(ds.find(d=>d.body.includes('新文章正文')).meta.__record).toBeNull();await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('已保存到网站');expect((await page.evaluate(()=>MXDrafts.state().items)).some(d=>d.body==='原有差异正文')).toBe(true);}await overflow(page);
});

test('项目提示区分发布、保存和生成密钥，普通保存不误报换密钥',async({page})=>{
 await page.goto(admin+'/projects/new');await page.locator('#title').fill('提示检查');await page.locator('#slug').fill('message-'+test.info().project.name+'-'+Date.now());await page.locator('#kind').selectOption('link');await page.locator('#external-url').fill('https://example.com');
 await page.locator('#publish-project').click();await expect(page.locator('#status')).toHaveText('已发布。');await page.locator('#title').fill('普通修改');await page.locator('#publish-project').click();await expect(page.locator('#status')).toHaveText('已保存。');
 await page.locator('#visibility').selectOption('private');page.once('dialog',d=>d.accept());await page.locator('#publish-project').click();await expect(page.locator('#status')).toContainText('新密钥已保存');const key=await reveal(page);await noStoredKey(page,key);
 await page.locator('#title').fill('密钥不变');await page.locator('#publish-project').click();await expect(page.locator('#status')).toHaveText('已保存。');expect(await reveal(page)).toBe(key);
 await page.locator('#rotate').check();page.once('dialog',d=>d.accept());await page.locator('#publish-project').click();await expect(page.locator('#status')).toContainText('新密钥已保存');expect(await reveal(page)).not.toBe(key);await overflow(page);
});

for(const privacy of ['public','private','rotated'])test('首次发布丢响应后修改，按原编号核对且不重复 '+privacy,async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('其他草稿');await page.locator('#markdown-input').fill('其他差异保留');await page.goto(admin+'/write');const title='lost-first-'+test.info().project.name+'-'+privacy+'-'+Date.now();await page.locator('#post-title').fill(title);await page.locator('#markdown-input').fill('首次提交正文');if(privacy!=='public')await page.locator('#post-visibility').selectOption('private');
 let first,readFailed=false;const saves=[];
 await page.route('**/api/documents',async r=>{const d=r.request().postDataJSON();if(d.action==='save'){saves.push(d);if(!first){first=d;await r.fetch();return r.abort('failed');}}if(d.action==='read'&&!readFailed){readFailed=true;return r.abort('failed');}await r.continue();});
 await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('连接中断');if(privacy!=='public')await noStoredKey(page,first.key);
 if(privacy==='rotated')await page.evaluate(async d=>{const row=await MXAdminApi('documents',{action:'list'});const current=row.documents.find(x=>x.id===d.id);await MXAdminApi('documents',{...d,revision:current.revision,key:'R'.repeat(43)});},first);
 await page.locator('#markdown-input').fill('响应丢失后的新正文');await page.locator('#publish').click();await expect(page.locator('#link-panel')).toBeVisible();await expect(page.locator('#status')).toContainText('点击查看线上版本重试');await expect(page.locator('#publish')).toBeDisabled();await expect(page.locator('#markdown-input')).toHaveValue('响应丢失后的新正文');
 await page.locator('#link-load').click();await expect(page.locator('#link-latest')).toHaveValue('首次提交正文');await expect(page.locator('#link-choice')).toBeDisabled();await expect(page.locator('#link-choice')).toHaveValue(first.id);
 page.once('dialog',d=>d.dismiss());await page.locator('#link-confirm').click();await expect(page.locator('#publish')).toBeDisabled();
 page.once('dialog',d=>d.accept());await page.locator('#link-confirm').click();await expect(page.locator('#publish')).toBeEnabled();expect(await page.evaluate(async id=>(await MXAdminApi('documents',{action:'read',id})).document.text,first.id)).toContain('首次提交正文');
 await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('已保存到网站');expect(saves.every(d=>d.id===first.id)).toBe(true);expect(saves.at(-1).key).toBeUndefined();
 const online=await page.evaluate(async id=>({row:await MXAdminApi('documents',{action:'read',id}),list:await MXAdminApi('documents',{action:'list'})}),first.id);expect(online.row.document.text).toContain('响应丢失后的新正文');expect(online.list.documents.filter(d=>d.title===title)).toHaveLength(1);expect((await page.evaluate(()=>MXDrafts.state().items)).map(d=>d.body)).toEqual(['其他差异保留']);
 if(privacy==='private'){expect(await reveal(page)).toBe(first.key);expect(await page.evaluate(async d=>(await MXAdminApi('documents',{action:'check-key',id:d.id,key:d.key})).matches,first)).toBe(true);await noStoredKey(page,first.key);}else await expect(page.locator('#share-key')).toHaveValue('');
 if(privacy==='rotated')expect(await page.evaluate(async id=>(await MXAdminApi('documents',{action:'check-key',id,key:'R'.repeat(43)})).matches,first.id)).toBe(true);await overflow(page);
});
