const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const id='11111111-1111-4111-8111-111111111111';
const source='---\ntitle: 后台文章\ndate: 2026-10-13\ncategory: blog\n---\n\n原有正文';
const row={id,title:'后台文章',folder:'_posts',date:'2026-10-13',tags:[],visibility:'public',url:'/document/#'+id,revision:'v1',document:{title:'后台文章',folder:'_posts',filename:'2026-10-13-test.md',text:source}};
test('后台邮箱登录后直接编辑、切换密钥和恢复公开，手机不溢出',async({page})=>{
 const {writing}=await import('../../_community/admin/hub.mjs');let saved={...row},writes=[];
 await page.route('https://fexas25.github.io/**',r=>{const file=path.join(root,new URL(r.request().url()).pathname);return r.fulfill({path:file});});
 await page.route('**/admin-write',r=>r.fulfill({contentType:'text/html',body:writing('test',true)}));
 await page.route('**/api/documents',async r=>{const d=r.request().postDataJSON();if(d.action==='list')return r.fulfill({json:{documents:[saved]}});if(d.action==='read')return r.fulfill({json:saved});writes.push(d);saved={...saved,...d,revision:'v'+(writes.length+1)};return r.fulfill({json:saved});});
 await page.goto('/admin-write');await expect(page.locator('#github-article option')).toHaveCount(2);await page.locator('#github-article').selectOption(id);await page.locator('#github-load').click();await expect(page.locator('#markdown-input')).toHaveValue(/原有正文/);
 await page.locator('#post-visibility').selectOption('private');await page.locator('#markdown-input').fill('只有密钥才能看');await page.locator('#github-publish').click();await expect(page.locator('#github-result')).toContainText('正文需要密钥');expect(writes[0].key).toHaveLength(43);expect(writes[0].visibility).toBe('private');await expect(page.locator('#private-key')).toHaveValue(writes[0].key);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.locator('#post-visibility').selectOption('public');await page.locator('#github-publish').click();await expect(page.locator('#github-result')).toContainText('已发布');expect(writes[1].document.text).not.toContain('private: true');
 await page.reload();await expect(page.locator('#markdown-input')).toHaveValue(/只有密钥才能看/);
 const choose=page.waitForEvent('filechooser');await page.locator('#image-upload').click();await (await choose).setFiles({name:'photo.webp',mimeType:'image/webp',buffer:fs.readFileSync(path.join(root,'assets/optimized/portrait-orange.webp'))});await expect(page.locator('#image-upload-status')).toContainText('已插入草稿');await expect(page.locator('#markdown-input')).toHaveValue(/data:image\/webp;base64,/);
});
test('后端阅读、密钥错误、解锁与锁定；搜索能找到加密标题',async({page})=>{
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};let visibility='private';const secret='A'.repeat(43);
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:"https://content.test"}'}));
 await page.route('https://content.test/**',r=>{if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});if(r.request().method()==='GET')return r.fulfill({headers,json:{documents:[{...row,visibility}]}});const d=r.request().postDataJSON();const unlocked=visibility==='public'||d.key===secret;return r.fulfill({headers,status:unlocked?200:403,json:unlocked?{...row,visibility,document:{...row.document,text:source+'\n\n## 一\n\n## 二\n\n## 三\n\n```js\nsecret_code\n```'}}:{locked:true,title:row.title}});});
 await page.goto('/search/');await page.locator('[name=q]').fill(row.title);await expect(page.locator('[data-search-results]')).toContainText('需要密钥');await page.locator('[data-search-results] .entry-link').filter({hasText:row.title}).click();await expect(page.locator('[data-document-unlock] [role=status]')).toContainText('需要密钥');await expect(page.locator('[data-document-body]')).toBeEmpty();
 await page.locator('[name=key]').fill('B'.repeat(43));await page.locator('[data-document-unlock] button').click();await expect(page.locator('[data-document-unlock] [role=status]')).toContainText('不正确');
 await page.locator('[name=key]').fill(secret);await page.locator('[data-document-unlock] button').click();await expect(page.locator('[data-document-body]')).toContainText('secret_code');await expect(page.locator('.code-copy')).toBeVisible();
 expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).not.toContain('secret_code');
 await page.getByRole('button',{name:'收起来',exact:true}).click();await expect(page.locator('[data-document-body]')).toBeEmpty();await expect(page.locator('[name=key]')).toHaveValue('');
 visibility='public';await page.reload();await expect(page.locator('[data-document-body]')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
