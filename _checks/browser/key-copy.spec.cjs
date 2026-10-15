const {test,expect}=require('@playwright/test');
const {reveal}=require('../key-view.cjs');
for(const work of [false,true])test(`复制迟到反馈不会覆盖密钥状态 ${work?'项目':'文章'}`,async({page})=>{
 await page.clock.install();await page.goto('http://127.0.0.1:4175'+(work?'/projects/new':'/write'));
 await page.locator(work?'#title':'#post-title').fill('复制反馈');
 if(work){await page.locator('#slug').fill('copy-'+test.info().project.name+'-'+Date.now());await page.locator('#kind').selectOption('link');await page.locator('#external-url').fill('https://example.com');}else await page.locator('#markdown-input').fill('保留正文');
 await page.locator(work?'#visibility':'#post-visibility').selectOption('private');await page.locator(work?'#publish-project':'#publish').click();await expect(page.locator('#status')).toContainText(work?'已发布':'已保存到网站');const key=await reveal(page);
 for(const failure of [false,true])for(const action of ['hide','timeout','reopen']){
  expect(await reveal(page)).toBe(key);
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise((resolve,reject)=>{window.finishCopy=fail=>fail?reject(Error('denied')):resolve();})}}));
  await page.locator('#copy-key').click();
  if(action==='hide')await page.locator('#hide-key').click();else if(action==='timeout')await page.clock.fastForward(31000);else await page.locator('#view-key').click();
  await page.evaluate(fail=>window.finishCopy(fail),failure);
  await expect(page.locator('#key-view-status')).toHaveText('');await expect(page.locator('#share-key')).toHaveValue('');await expect(page.locator('#key-label')).toBeHidden();
  if(action==='reopen')await expect(page.locator('#key-password')).toBeFocused();
 }
 expect(await reveal(page)).toBe(key);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}}));await page.locator('#copy-key').click();await expect(page.locator('#key-view-status')).toHaveText('请长按复制。');await expect(page.locator('#share-key')).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
