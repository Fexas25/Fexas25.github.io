const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path');
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const id='11111111-1111-4111-8111-111111111111',key='A'.repeat(43);

test('私密正文需密钥，切换英文不外传，锁定清空内容',async({page})=>{
 const sent=[];let reads=0;
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:"https://community.test"}'}));
 await page.route('https://community.test/**',r=>{
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
  const data=r.request().postDataJSON();if(r.request().url().endsWith('/translate')){sent.push(data.text);return r.fulfill({headers,json:{text:'Translated UI'}});}
  reads++;return r.fulfill({headers,status:data.key===key?200:403,json:data.key===key?{document:{title:'私密正文标题',folder:'_projects',filename:'private.md',text:'---\ntitle: 私密正文标题\nexternal_url: https://example.com/game\n---\n\n私密正文测试\n\n<img src="https://tracking.invalid/image" onerror="alert(1)"><video src="https://tracking.invalid/video"></video>'}}:{error:'unavailable'}});
 });
 await page.goto('/private/#'+id);expect(reads).toBe(0);
 await page.locator('#access-key').fill('B'.repeat(43));await page.locator('#private-unlock button').click();await expect(page.locator('#private-status')).toContainText('不正确');
 await expect(page.locator('#private-document')).toBeHidden();await page.locator('#access-key').fill(key);await page.locator('#private-unlock button').click();
 await expect(page.locator('#private-body')).toContainText('私密正文测试');await expect(page.locator('#private-body img,#private-body video')).toHaveCount(0);
 await page.locator('[data-language=en]').click();await expect(page.locator('html')).toHaveAttribute('lang','en');await page.waitForTimeout(450);
 expect(sent.join('')).not.toContain('私密正文');expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).not.toContain('私密正文');
 await expect(page.locator('#private-project')).toHaveAttribute('href','https://example.com/game');
 await page.locator('#private-lock').click();await expect(page.locator('#private-body')).toBeEmpty();await expect(page.locator('#access-key')).toHaveValue('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('私密草稿图片不上传公开仓库，备份与重载保留模式',async({page})=>{
 let writes=0;await page.route('https://api.github.com/**',r=>{if(r.request().method()==='PUT')writes++;return r.fulfill({json:{tree:[]},headers});});
 await page.goto('/editor.html');await page.locator('#post-visibility').selectOption('private');await page.locator('#post-title').fill('私密草稿');await page.locator('#markdown-input').fill('未公开内容');
 const choose=page.waitForEvent('filechooser');await page.locator('#image-upload').click();await (await choose).setFiles({name:'private.webp',mimeType:'image/webp',buffer:fs.readFileSync(path.join(__dirname,'../../assets/optimized/portrait-orange.webp'))});
 await expect(page.locator('#image-upload-status')).toContainText('不会上传公开仓库');await expect(page.locator('#markdown-input')).toHaveValue(/data:image\/webp;base64,/);expect(writes).toBe(0);
 await page.reload();await expect(page.locator('#post-visibility')).toHaveValue('private');await expect(page.locator('#markdown-input')).toHaveValue(/data:image\/webp;base64,/);
 expect(await page.evaluate(()=>window.MXEditor.exportDocument().text)).toContain('private: true');
 expect(await page.evaluate(()=>JSON.parse(window.MXDrafts.backup()).items.some(x=>x.meta['post-visibility']==='private'))).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('小鱼文字接力清理且不干扰翻译',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('mx-studio-intro-seen-v2','1'));await page.goto('/');
 if(await page.locator('#studio-intro').isVisible())await page.locator('#intro-enter').click();
 const title=page.locator('.meow-welcome>span').last();await title.tap();await expect(title.locator('.meow-letter')).not.toHaveCount(0);
 await page.locator('.header-tools [data-language=en]').click();await expect(page.locator('.meow-letter')).toHaveCount(0);
 await page.locator('.header-tools [data-language=zh]').click();await expect(title).toContainText('快来一起摸鱼吧！');
 await page.emulateMedia({reducedMotion:'reduce'});await title.tap();await expect(page.locator('.meow-letter')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('密钥发布、重新载入、更新和换密钥不写公开仓库',async({page,context})=>{
 let doc=null,revision='v1',publicWrites=0;
 await context.route('https://publishing.test/**',r=>{
  const url=new URL(r.request().url());if(url.pathname==='/health')return r.fulfill({headers,json:{configured:true}});
  return r.fulfill({contentType:'text/html',body:`<script>opener.postMessage(${JSON.stringify({type:'mx-github-auth',channel:url.searchParams.get('channel'),token:'private_test_token'})},'http://127.0.0.1:4173')</script>`});
 });
 await page.route('**/editor-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_PUBLISH={authOrigin:"https://publishing.test"}'}));
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:"https://community.test"}'}));
 const ghHeaders={...headers,'Access-Control-Allow-Headers':'Authorization,Content-Type,Accept,X-GitHub-Api-Version','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS'};
 await page.route('https://api.github.com/**',r=>{if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers:ghHeaders});if(r.request().method()==='PUT')publicWrites++;return r.fulfill({headers:ghHeaders,json:r.request().url().includes('/git/trees/')?{tree:[]}:{permissions:{push:true}}});});
 await page.route('https://community.test/private/manage',r=>{
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});const data=r.request().postDataJSON();expect(r.request().headers().authorization).toBe('Bearer private_test_token');
  if(data.action==='list')return r.fulfill({headers,json:{documents:doc?[{id,title:doc.title}]:[]}});
  if(data.action==='read')return r.fulfill({headers,json:{id,revision,document:doc}});
  if(data.action==='save'){if(!doc)expect(data.key).toMatch(/^[A-Za-z0-9_-]{43}$/);else expect(data.revision).toBe(revision);doc=data.document;revision+='x';return r.fulfill({headers,json:{id,revision}});}
  if(data.action==='rotate'){expect(data.revision).toBe(revision);revision+='r';return r.fulfill({headers,json:{id,revision}});}
 });
 await page.goto('/editor.html');await page.locator('#post-visibility').selectOption('private');await page.locator('#post-title').fill('密钥作品');await page.locator('#post-category').selectOption('projects');await page.locator('#work-url').fill('https://example.com/private-game');await page.locator('#markdown-input').fill('初稿');
 await page.locator('#github-publish').click();await expect(page.locator('#github-status')).toContainText('已登录 Fexas25');await page.locator('#github-publish').click();
 await expect(page.locator('#private-share')).toBeVisible();const first=await page.locator('#private-key').inputValue();expect(first).toHaveLength(43);expect(await page.evaluate(()=>JSON.stringify({...localStorage}))).not.toContain(first);
 await page.locator('#markdown-input').fill('修改后的正文');await page.locator('#github-publish').click();await expect(page.locator('#github-result')).toContainText('私密内容已保存');expect(doc.text).toContain('修改后的正文');
 await page.locator('#private-rotate').click();await expect(page.locator('#private-key')).not.toHaveValue(first);await expect(page.locator('#private-key')).toHaveValue(/^[A-Za-z0-9_-]{43}$/);
 await page.locator('#github-article').selectOption('private:'+id);await page.locator('#github-load').click();await expect(page.locator('#markdown-input')).toHaveValue(/修改后的正文/);await expect(page.locator('#post-visibility')).toBeDisabled();expect(publicWrites).toBe(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
