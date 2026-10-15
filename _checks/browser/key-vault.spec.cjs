const {test,expect}=require('@playwright/test');
const {reveal}=require('../key-view.cjs');
const admin='http://127.0.0.1:4175';
for(const work of [false,true])test((work?'项目':'文章')+' 密钥持久保存、密码查看、自动隐藏及轮换确认',async({page,context})=>{
 await page.clock.install();await page.goto(admin+(work?'/projects/new':'/write'));if(work){await page.locator('#title').fill('密钥保管');await page.locator('#slug').fill('vault-'+test.info().project.name+'-'+Date.now());await page.locator('#kind').selectOption('link');await page.locator('#external-url').fill('https://example.com');}else{await page.locator('#post-title').fill('密钥保管');await page.locator('#markdown-input').fill('私密正文');}
 await page.locator(work?'#visibility':'#post-visibility').selectOption('private');const save=work?'#publish-project':'#publish';await page.locator(save).click();await expect(page.locator('#status')).toContainText(work?'已发布':'已保存到网站');await expect(page.locator('#share-key')).toHaveValue('');await expect(page.locator('#key-label')).toBeHidden();
 await page.locator('#view-key').click();await page.locator('#key-password').fill('wrong');await page.locator('#key-submit').click();await expect(page.locator('#key-view-status')).toContainText('密码不正确');await expect(page.locator('#share-key')).toHaveValue('');await expect(page.locator('#session-help')).toBeHidden();
 const key=await reveal(page),url=page.url();expect(key).toHaveLength(43);expect(await page.evaluate(()=>JSON.stringify({...localStorage})+JSON.stringify({...sessionStorage}))).not.toContain(key);
 await page.clock.fastForward(31000);await expect(page.locator('#share-key')).toHaveValue('');await expect(page.locator('#key-label')).toBeHidden();
 await page.reload();await expect(page.locator('#share-key')).toHaveValue('');expect(await reveal(page)).toBe(key);
 const other=await context.newPage();await other.goto(url);expect(await reveal(other)).toBe(key);await other.close();
 await page.locator('#rotate').check();page.once('dialog',async d=>{expect(d.message()).toContain('旧密钥会对所有人失效');await d.dismiss();});await page.locator(save).click();expect(await reveal(page)).toBe(key);
 page.once('dialog',d=>d.accept());await page.locator(save).click();await expect(page.locator(save)).toBeEnabled();const next=await reveal(page);expect(next).not.toBe(key);await page.reload();expect(await reveal(page)).toBe(next);
 // Switching to public ignores a hidden rotation checkbox and preserves the stored key.
 await page.locator('#rotate').check();await page.locator(work?'#visibility':'#post-visibility').selectOption('public');
 const unexpected=[];const rejectDialog=async d=>{unexpected.push(d.message());await d.dismiss();};page.on('dialog',rejectDialog);
 await page.locator(save).click();await expect(page.locator('#key-vault')).toBeHidden();expect(unexpected).toEqual([]);page.off('dialog',rejectDialog);
 const currentUrl=page.url();const publicRow=await page.evaluate(async work=>{const id=new URL(location.href).searchParams.get('id');return window.MXAdminApi(work?'projects':'documents',{action:'read',id});},work);expect(publicRow.visibility).toBe('public');
 await page.locator(work?'#visibility':'#post-visibility').selectOption('private');
 page.once('dialog',async d=>{expect(d.message()).toContain('旧密钥会失效');await d.dismiss();});await page.locator(save).click();expect(page.url()).toBe(currentUrl);
 expect((await page.evaluate(async work=>window.MXAdminApi(work?'projects':'documents',{action:'read',id:new URL(location.href).searchParams.get('id')}),work)).visibility).toBe('public');
 page.once('dialog',d=>d.accept());await page.locator(save).click();await expect(page.locator('#view-key')).toBeVisible();const switched=await reveal(page);expect(switched).not.toBe(next);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}}));await page.clock.fastForward(20000);await page.locator('#copy-key').click();await expect(page.locator('#key-view-status')).toHaveText('已复制，密钥将自动隐藏。');await page.clock.fastForward(11000);await expect(page.locator('#key-label')).toBeHidden();
 let release;await page.route('**/api/keys',async r=>{const response=await r.fetch();await new Promise(resolve=>release=resolve);await r.fulfill({response});});await page.locator('#view-key').click();await page.locator('#key-password').fill('test-confirm');await page.locator('#key-submit').click();await expect.poll(()=>typeof release).toBe('function');await page.locator(work?'#title':'#post-title').fill('继续写');release();await expect(page.locator('#key-label')).toBeHidden();await expect(page.locator('#share-key')).toHaveValue('');expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
