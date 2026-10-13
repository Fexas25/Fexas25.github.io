const {test,expect}=require('@playwright/test');
const chinese=/[\u3400-\u9fff]/;
async function noChinese(locator){await expect.poll(()=>locator.evaluate(el=>el.textContent),{timeout:7000}).not.toMatch(chinese);}
test('英文抽签和留言固定界面无需在线翻译，输入隐私及手机换行',async({page})=>{
 const sent=[];await page.addInitScript(()=>{sessionStorage.setItem('mx-language','en');sessionStorage.setItem('mx-studio-intro-seen-v2','1');});
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:"https://english.test",siteKey:"test"};'}));
 await page.route('https://english.test/**',r=>{if(r.request().method()==='POST')sent.push(r.request().postData());return r.fulfill({status:r.request().method()==='GET'?200:503,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type'},json:{documents:[]}});});
 await page.route('https://challenges.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:'window.turnstile={render:(s,o)=>{window.testChallenge=o;return 1},remove:()=>{}};window.mxQuickGuestbookChallenge();'}));
 await page.goto('/');await page.locator('[data-draw]').first().click();const fortune=page.locator('#fortune-dialog');await noChinese(fortune);await expect(fortune.locator('.dialog-close')).toHaveAttribute('aria-label',"Close today's fortune");expect(await fortune.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);await fortune.locator('.dialog-close').click();
 await page.locator('.meow-mail-entry').click();const dialog=page.locator('#quick-guestbook');await noChinese(dialog.locator('.mail-choices'));await dialog.locator('[data-mail-write]').click();await noChinese(dialog);
 await expect(dialog.locator('textarea')).toHaveAttribute('placeholder','Taking a little break today?');await expect(dialog.locator('[data-mail-close]')).toHaveAttribute('aria-label','Close message box');
 await dialog.locator('[name=name]').fill('私密昵称');await dialog.locator('textarea').fill('不能发给翻译服务的输入');
 await page.evaluate(()=>window.testChallenge['error-callback']());await expect(dialog.locator('[role=status]')).toHaveText('Verification is unavailable. Please retry.');
 expect(await dialog.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);expect(sent.join('')).not.toMatch(/不能发给|私密昵称/);
 await dialog.locator('[data-mail-close]').click();await page.locator('.header-tools [data-language=zh]').click();await page.locator('.meow-mail-entry').click();await dialog.locator('[data-mail-write]').click();await expect(dialog.locator('textarea')).toHaveValue('不能发给翻译服务的输入');await expect(dialog.locator('textarea')).toHaveAttribute('placeholder','今天也来摸鱼啦？');
});
test('英文每日签到结果、历史与按钮不溢出',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('mx-language','en'));await page.goto('/daily-checkin/');await page.locator('#checkin-btn').click();await noChinese(page.locator('.checkin-result'));await noChinese(page.locator('#history-list'));await noChinese(page.locator('#draw-label'));expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('英文内页导航和控件适应窄屏',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('mx-language','en'));
 for(const route of ['/about/','/blog/','/competitive-programming/','/projects/','/guestbook/','/search/']){
  await page.goto(route);await expect(page.locator('html')).toHaveAttribute('lang','en');await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.header-tools [data-language=zh]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),route).toBeLessThanOrEqual(1);
  const clipped=await page.locator('button:visible, .primary-link:visible, .header-inner nav a:visible').evaluateAll(nodes=>nodes.filter(el=>el.scrollWidth>el.clientWidth+2&&getComputedStyle(el).overflowX!=='visible').map(el=>el.id||el.textContent));expect(clipped,route).toEqual([]);
 }
});
