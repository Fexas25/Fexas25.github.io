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
 await page.goto(admin+'/write');await page.locator('#post-title').fill('密钥回归');await page.locator('#markdown-input').fill('私密正文');await page.locator('#post-visibility').selectOption('private');await page.locator('#publish').click();await expect(page.locator('#share-key')).not.toHaveValue('');const key=await page.locator('#share-key').inputValue();
 await page.locator('#post-title').fill('修改标题');await page.locator('#publish').click();await expect(page.locator('#publish')).toBeEnabled();await expect(page.locator('#share-key')).toHaveValue(key);await noStoredKey(page,key);
 await page.locator('#rotate').check();await page.locator('#publish').click();await expect(page.locator('#publish')).toBeEnabled();await expect(page.locator('#share-key')).not.toHaveValue(key);const next=await page.locator('#share-key').inputValue();await noStoredKey(page,next);
 await page.locator('#markdown-file').setInputFiles({name:'another.md',mimeType:'text/markdown',buffer:Buffer.from('# 另一篇\n\n新内容')});await expect(page.locator('#share-key')).toHaveValue('');await expect(page.locator('#key-label')).toBeHidden();await overflow(page);
});

test('项目保存响应丢失后可重试，密钥连续保存保留且刷新不回显',async({page})=>{
 await page.goto(admin+'/projects/new');await page.locator('#title').fill('项目重试');await page.locator('#slug').fill('retry-'+test.info().project.name+'-'+Date.now());await page.locator('#kind').selectOption('link');await page.locator('#external-url').fill('https://example.com');await page.locator('#visibility').selectOption('private');
 let lost=false;await page.route('**/api/projects',async r=>{if(r.request().postDataJSON().action==='save'&&!lost){lost=true;await r.fetch();return r.abort('failed');}await r.continue();});
 await page.locator('#save-project').click();await expect(page.locator('#status')).toContainText('重试');await page.locator('#save-project').click();await expect(page.locator('#status')).toContainText('已保存到项目草稿');const key=await page.locator('#share-key').inputValue();expect(key.length).toBe(43);
 await page.locator('#title').fill('继续修改');await page.locator('#save-project').click();await expect(page.locator('#save-project')).toBeEnabled();await expect(page.locator('#share-key')).toHaveValue(key);await page.locator('#publish-project').click();await expect(page.locator('#status')).toContainText('已发布');await expect(page.locator('#share-key')).toHaveValue(key);await noStoredKey(page,key);
 await page.reload();await expect(page.locator('#title')).toHaveValue('继续修改');await expect(page.locator('#share-key')).toHaveValue('');await overflow(page);
});

test('读取项目包时锁定操作，坏包不会丢掉此前选择的完整包',async({page})=>{
 await page.addInitScript(()=>{const read=Blob.prototype.arrayBuffer;let once=true;Blob.prototype.arrayBuffer=async function(){if(once){once=false;await new Promise(resolve=>window.releasePackage=resolve);}return read.call(this);};});
 await page.goto(admin+'/projects/new');await page.locator('#title').fill('读取保护');await page.locator('#slug').fill('read-'+test.info().project.name+'-'+Date.now());await page.locator('#files').setInputFiles({name:'index.html',mimeType:'text/html',buffer:Buffer.from('<h1>原项目</h1>')});
 await expect(page.locator('#status')).toContainText('正在读取');for(const id of ['save-project','publish-project','preview-project'])await expect(page.locator('#'+id)).toBeDisabled();await page.evaluate(()=>releasePackage());await expect(page.locator('#status')).toContainText('已选择 1 个文件');
 await page.locator('#files').setInputFiles({name:'bad.zip',mimeType:'application/zip',buffer:Buffer.from('broken zip')});await expect(page.locator('#status')).toContainText('之前选择的文件保留');await expect(page.locator('#entry')).toHaveValue('index.html');await page.locator('#publish-project').click();await expect(page.locator('#status')).toContainText('已发布');await overflow(page);
});
