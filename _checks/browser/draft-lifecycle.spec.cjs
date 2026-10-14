const {test,expect}=require('@playwright/test');
const admin='http://127.0.0.1:4175';
const drafts=page=>page.evaluate(()=>window.MXDrafts.state().items);
const overflow=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);

test('发布清理对应草稿，保存期间输入保留；失败不清理，无改动不产生草稿',async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('生命周期 '+test.info().project.name);await page.locator('#markdown-input').fill('第一版');expect(await drafts(page)).toHaveLength(1);
 let release,intercepted=false;await page.route('**/api/documents',async r=>{if(r.request().postDataJSON().action==='save'&&!intercepted){intercepted=true;const response=await r.fetch();await new Promise(resolve=>release=resolve);await r.fulfill({response});}else await r.continue();});
 await page.locator('#publish').click();await expect.poll(()=>typeof release).toBe('function');await page.locator('#markdown-input').fill('第一版之后继续输入');release();await expect(page.locator('#status')).toContainText('已保存到网站');expect((await drafts(page))[0].body).toBe('第一版之后继续输入');
 await page.locator('#publish').click();await expect(page.locator('#draft-status')).toContainText('没有待保存');expect(await drafts(page)).toHaveLength(0);const published=page.url();await page.reload();await expect(page.locator('#markdown-input')).toHaveValue('第一版之后继续输入');expect(await drafts(page)).toHaveLength(0);
 await page.locator('#markdown-input').fill('保存失败时保留');await page.route('**/api/documents',r=>r.fulfill({status:503,json:{error:'测试连接失败'}}));await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('测试连接失败');expect((await drafts(page))[0].body).toBe('保存失败时保留');await page.unroute('**/api/documents');await page.locator('#publish').click();await expect(page.locator('#draft-status')).toContainText('没有待保存');expect(await drafts(page)).toHaveLength(0);await overflow(page);
});

test('只清理与线上完全一致的旧草稿，差异及无法确认的草稿保留；不跳前台',async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('清理核对');await page.locator('#markdown-input').fill('线上正文');await page.locator('#publish').click();await expect(page.locator('#draft-status')).toContainText('没有待保存');
 await page.evaluate(async()=>{const id=new URLSearchParams(location.search).get('id'),row=await MXAdminApi('documents',{action:'read',id}),r=MXContent.parse(row.document.text,row.document.folder+'/'+row.document.filename,row.revision);r.documentId=id;r.visibility=row.visibility;const meta=Object.fromEntries(MXWriting.fields.map(k=>[k,document.getElementById(k).value]));meta.__record=r;meta.__imported=r.metadata;meta.__publishId=id;MXDrafts.save({id:'equal',meta,body:r.body});MXDrafts.save({id:'different',meta:{...meta,'post-title':'保留的不同草稿'},body:'有价值的新内容'});MXDrafts.save({id:'unknown',meta:{...meta,__record:{...r,documentId:crypto.randomUUID()},__publishId:crypto.randomUUID()},body:r.body});});
 await page.goto(admin+'/drafts');await page.locator('#filter').selectOption('articles');await expect.poll(async()=>(await drafts(page)).map(d=>d.id).sort()).toEqual(['different','unknown']);await expect(page.locator('a[href*="editor.html"]')).toHaveCount(0);await expect(page.locator('.hub-card')).toHaveCount(2);await overflow(page);
});

test('旧关联草稿在后台核对后保存，相对链接预览另开且私密图片不请求外站',async({page})=>{
 await page.goto(admin+'/write');await page.locator('#post-title').fill('旧关联测试');await page.locator('#markdown-input').fill('线上原文');await page.locator('#publish').click();await expect(page.locator('#draft-status')).toContainText('没有待保存');
 await page.evaluate(async()=>{const id=new URLSearchParams(location.search).get('id'),row=await MXAdminApi('documents',{action:'read',id}),r=MXContent.parse(row.document.text,row.document.folder+'/'+row.document.filename,'old-github-sha');const meta=Object.fromEntries(MXWriting.fields.map(k=>[k,document.getElementById(k).value]));MXDrafts.save({id:'legacy-edit',meta:{...meta,__record:r,__imported:r.metadata},body:'草稿的新正文'});});
 await page.goto(admin+'/write?draft=legacy-edit');await expect(page.locator('#link-latest')).toHaveValue('线上原文');await expect(page.locator('#publish')).toBeDisabled();await expect(page.locator('#markdown-input')).toHaveValue('草稿的新正文');page.once('dialog',d=>d.accept());await page.locator('#link-confirm').click();await page.locator('#publish').click();await expect(page.locator('#draft-status')).toContainText('没有待保存');expect(await drafts(page)).toHaveLength(0);
 await page.locator('#markdown-input').fill('[站内](/blog/)\n\n[外链](https://example.com)');await expect(page.locator('#preview-content a').first()).toHaveAttribute('href',admin+'/blog/');await expect(page.locator('#preview-content a').first()).toHaveAttribute('target','_blank');await page.locator('#post-visibility').selectOption('private');await page.locator('#markdown-input').fill('![敏感图](https://tracking.invalid/private.png)');await expect(page.locator('#preview-content img')).toHaveCount(0);await expect(page.locator('#preview-content')).toContainText('外部素材已隐藏');await overflow(page);
});

test('旧内容加载失败保持表单禁用，文章和项目都能原地重试',async({page})=>{
 for(const [route,api,field,button] of [['articles/edit','documents','#post-title','#publish'],['projects/edit','projects','#title','#publish-project']]){
  let fail=true;await page.route('**/api/'+api,r=>fail?r.fulfill({status:503,json:{error:'暂时失败'}}):r.fulfill({json:api==='documents'?{id:'11111111-1111-4111-8111-111111111111',revision:'v1',visibility:'public',url:'/blog/example/',document:{folder:'_posts',filename:'example.md',title:'恢复的内容',text:'---\ntitle: 恢复的内容\ndate: 2026-10-14\n---\n\n正文'}}:{id:'11111111-1111-4111-8111-111111111111',title:'恢复的内容',slug:'example',description:'',category:'game',kind:'link',visibility:'public',state:'published',entry:'index.html',externalUrl:'https://example.com'}}));
  await page.goto(admin+'/'+route+'?id=11111111-1111-4111-8111-111111111111');await expect(page.locator('#load-retry')).toBeVisible();await expect(page.locator(field)).toBeDisabled();await expect(page.locator(button)).toBeDisabled();fail=false;await page.locator('#load-retry').click();await expect(page.locator(field)).toHaveValue('恢复的内容');await expect(page.locator(button)).toBeEnabled();await page.unroute('**/api/'+api);
 }
});

test('首页私密卡片布局与工作区锚点',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('mx-studio-intro-seen-v2','1'));
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:location.origin}'}));
 await page.route('**/documents',r=>r.fulfill({json:{documents:[{id:'private-work',slug:'dad-birthday',title:'爸爸，生日快乐',folder:'_projects',type:'creative',tags:[],date:'2026-10-14',visibility:'private',url:'https://mx-projects.liuwanting830.workers.dev/p/dad-birthday/',content:'不得展示的正文'}]}}));
 await page.goto('/');const card=page.locator('.works-grid [data-project-slug="dad-birthday"]');await expect(card.locator('.work-cover')).toBeVisible();expect((await card.locator('.work-cover').boundingBox()).height).toBeGreaterThan(100);await expect(card).not.toContainText('不得展示');await expect(card.locator('.work-lock')).toHaveText('需要密钥');await expect(card.locator('.work-info h3')).toHaveText('爸爸，生日快乐');await expect(page.locator('.desk-computer')).toHaveAttribute('href','#workspace');await page.locator('.desk-computer').click();await expect(page).toHaveURL(/#workspace$/);await overflow(page);await card.screenshot({path:test.info().outputPath('private-card.png')});
});
