const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const id='11111111-1111-4111-8111-111111111111';
const source='---\ntitle: 后台文章\ndate: 2026-10-13\ncategory: blog\n---\n\n原有正文';
const row={id,title:'后台文章',folder:'_posts',date:'2026-10-13',tags:[],visibility:'public',url:'/document/#'+id,revision:'v1',document:{title:'后台文章',folder:'_posts',filename:'2026-10-13-test.md',text:source}};
test('后台独立文章编辑、密钥切换、图片和新建入口',async({page})=>{
 const {writing}=await import('../../_community/admin/hub.mjs');let saved={...row},writes=[];
 await page.route('https://fexas25.github.io/**',r=>r.fulfill({path:path.join(root,new URL(r.request().url()).pathname)}));
 await page.route('**/articles/edit*',r=>r.fulfill({contentType:'text/html',body:writing('test',true)}));
 await page.route('**/admin-write*',r=>r.fulfill({contentType:'text/html',body:writing('test',true)}));
 await page.route('**/api/documents',r=>{const d=r.request().postDataJSON();if(d.action==='read')return r.fulfill({json:saved});writes.push(d);saved={...saved,...d,revision:'v'+(writes.length+1)};return r.fulfill({json:saved});});
 await page.goto('/admin-write?id='+id);await expect(page.locator('#markdown-input')).toHaveValue(/原有正文/);
 await page.locator('#post-visibility').selectOption('private');await page.locator('#markdown-input').fill('只有密钥才能看');await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('已保存到网站');expect(writes[0].key).toHaveLength(43);expect(writes[0].visibility).toBe('private');await expect(page.locator('#share-key')).toHaveValue('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.locator('#post-visibility').selectOption('public');await page.locator('#publish').click();await expect.poll(()=>writes.length).toBe(2);expect(writes[1].document.text).not.toContain('private: true');
 await page.reload();await expect(page.locator('#markdown-input')).toHaveValue(/只有密钥才能看/);
 await page.locator('#image-file').setInputFiles({name:'photo.webp',mimeType:'image/webp',buffer:fs.readFileSync(path.join(root,'assets/optimized/portrait-orange.webp'))});await expect(page.locator('#status')).toContainText('已插入图片');await expect(page.locator('#markdown-input')).toHaveValue(/data:image\/webp;base64,/);
 await page.goto('/admin-write');await expect(page.locator('#post-title')).toHaveValue('');await expect(page.locator('#markdown-input')).toHaveValue('');await expect(page.locator('#post-category option[value=projects]')).toHaveCount(0);expect(await page.evaluate(()=>window.MXDrafts.state().items.length)).toBeGreaterThan(0);
});

test('后端阅读、密钥错误、解锁与锁定；搜索能找到加密标题',async({page})=>{
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};let visibility='private';const secret='A'.repeat(43);
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:"https://content.test"}'}));
 await page.route('https://content.test/**',r=>{if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});if(r.request().method()==='GET')return r.fulfill({headers,json:{documents:[{...row,visibility}]}});const d=r.request().postDataJSON();const unlocked=visibility==='public'||d.key===secret;return r.fulfill({headers,status:unlocked?200:403,json:unlocked?{...row,visibility,document:{...row.document,text:source+'\n\n## 一\n\n## 二\n\n## 三\n\n```js\nsecret_code\n```'}}:{locked:true,title:row.title}});});
 await page.goto('/search/');await page.locator('[name=q]').fill(row.title);await expect(page.locator('[data-search-results]')).toContainText('需要密钥');await page.locator('[data-search-results] .entry-link').filter({hasText:row.title}).click();await expect(page.locator('[data-document-unlock] [role=status]')).toContainText('需要密钥');await expect(page.locator('[data-document-body]')).toBeEmpty();
 await page.locator('[name=key]').fill('B'.repeat(43));await page.locator('[data-document-unlock] button[type=submit]').click();await expect(page.locator('[data-document-unlock] [role=status]')).toContainText('不正确');
 await page.locator('[name=key]').fill(secret);await page.locator('[data-document-unlock] button[type=submit]').click();await expect(page.locator('[data-document-body]')).toContainText('secret_code');await expect(page.locator('.code-copy')).toBeVisible();
 expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).not.toContain('secret_code');
 await page.getByRole('button',{name:'收起来',exact:true}).click();await expect(page.locator('[data-document-body]')).toBeEmpty();await expect(page.locator('[name=key]')).toHaveValue('');
 visibility='public';await page.reload();await expect(page.locator('[data-document-body]')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});


test('独立已发布列表的回收站、恢复和冲突版本',async({page})=>{
 const {management}=await import('../../_community/admin/hub.mjs');let saved={...row,updated:1700000000,deletedAt:0};const actions=[];
 await page.route('**/admin-docs*',r=>r.fulfill({contentType:'text/html',body:management('test')}));
 await page.route('**/api/documents',r=>{const d=r.request().postDataJSON();if(d.action==='list')return r.fulfill({json:{documents:Boolean(saved.deletedAt)===Boolean(d.trash)?[saved]:[]}});actions.push(d);saved={...saved,deletedAt:d.action==='trash'?123:0,revision:'v'+(actions.length+1)};return r.fulfill({json:saved});});
 await page.goto('/admin-docs');await expect(page.locator('.hub-card')).toHaveCount(1);await expect(page.locator('#writing-form')).toHaveCount(0);
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'移入回收站',exact:true}).click();expect(actions).toHaveLength(0);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'移入回收站',exact:true}).click();await expect(page.locator('.hub-card')).toHaveCount(0);await page.locator('#trash').click();await page.getByRole('button',{name:'恢复',exact:true}).click();await expect(page.locator('.hub-card')).toHaveCount(0);await page.locator('#trash').click();await expect(page.locator('.hub-card')).toHaveCount(1);expect(actions.map(d=>d.action)).toEqual(['trash','restore']);expect(actions[1].revision).toBe('v2');
});

test('已回收内容不会由旧搜索索引重新显示，旧链接不可读',async({page})=>{
 await page.route('**/search-index.json*',r=>r.fulfill({json:[{...row,backendId:id,content:'旧索引正文',category:'moments'}]}));
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:location.origin}'}));
 await page.route('**/documents',r=>r.fulfill({json:{documents:[]}}));
 await page.route('**/documents/read',r=>r.fulfill({status:404,json:{error:'not found'}}));
 await page.goto('/search/');await expect(page.locator('.site-search-form')).toBeVisible();await expect(page.locator('[data-search-results]')).toBeEmpty();
 await page.goto('/document/?id='+id);await expect(page.locator('[data-document-unlock] [role=status]')).toContainText('已移除');await expect(page.locator('[data-document-body]')).toBeEmpty();
});
