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

test('小鱼文字接力清理且不干扰翻译',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('mx-studio-intro-seen-v2','1'));await page.goto('/');
 if(await page.locator('#studio-intro').isVisible())await page.locator('#intro-enter').click();
 const title=page.locator('.meow-welcome>span').last();await title.tap();await expect(title.locator('.meow-letter')).not.toHaveCount(0);
 await page.locator('.header-tools [data-language=en]').click();await expect(page.locator('.meow-letter')).toHaveCount(0);
 await page.locator('.header-tools [data-language=zh]').click();await expect(title).toContainText('快来一起摸鱼吧！');
 await page.emulateMedia({reducedMotion:'reduce'});await title.tap();await expect(page.locator('.meow-letter')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
