const {test,expect}=require('@playwright/test');
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};

test('留言加载与验证可重试，提交中不丢失编辑内容',async({page})=>{
 let scriptFails=true,listFails=true,postFails=true,posts=0;
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:"https://community.test",siteKey:"test"}'}));
 await page.route('https://challenges.cloudflare.com/**',r=>scriptFails?r.abort():r.fulfill({contentType:'text/javascript',body:'window.turnstile={render:(s,o)=>{if(!window.challenge)o.callback("verified");window.challenge=o;return 1},reset:()=>{},remove:()=>{}};window.mxQuickGuestbookChallenge();'}));
 await page.route('https://community.test/**',async r=>{
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
  if(r.request().method()==='GET')return r.fulfill({headers,status:listFails?503:200,json:listFails?{}:{messages:[{id:1,name:'MX',message:'留言已恢复',created:100}],next:''}});
  posts++;await new Promise(resolve=>setTimeout(resolve,700));
  return postFails?r.abort():r.fulfill({headers,status:201,json:{pending:true}});
 });
 await page.goto('/guestbook/');await page.locator('[data-guestbook-write]').click();await expect(page.locator('.mail-retry')).toBeVisible();await expect(page.locator('#guestbook-more')).toHaveText('重新加载留言');
 await page.locator('[data-mail-close]').click();listFails=false;await page.locator('#guestbook-more').click();await expect(page.locator('[data-guestbook-list]')).toContainText('留言已恢复');await expect(page.locator('#guestbook-more')).toBeHidden();
 scriptFails=false;await page.locator('[data-guestbook-write]').click();await expect(page.locator('[type=submit]')).toBeEnabled();
 await page.locator('[name=name]').fill('访客');await page.locator('[name=message]').fill('网络断开也不要丢掉这条留言');await page.locator('[type=submit]').click();
 await expect(page.locator('[name=message]')).toHaveAttribute('readonly','');await page.evaluate(()=>window.challenge.callback('late-verification'));await expect(page.locator('[type=submit]')).toBeDisabled();
 await expect(page.locator('#quick-guestbook-status')).toContainText('尚不能确认');await expect(page.locator('[name=message]')).toHaveValue('网络断开也不要丢掉这条留言');await expect(page.locator('[name=message]')).not.toHaveAttribute('readonly');await expect(page.locator('[type=submit]')).toBeDisabled();
 postFails=false;await page.evaluate(()=>window.challenge.callback('verified-again'));await page.locator('[type=submit]').click();await expect(page.locator('#quick-guestbook-status')).toHaveText('收到啦，审核后会出现喵！');expect(posts).toBe(2);await expect(page.locator('[name=message]')).toHaveValue('');
});

test('留言弹窗适应键盘可视区域，关闭恢复焦点和滚动',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('mx-studio-intro-seen-v2','1'));await page.goto('/');if(await page.locator('#studio-intro').isVisible())await page.locator('#intro-enter').click();
 await page.locator('.meow-mail-entry').click();const dialog=page.locator('#quick-guestbook');await dialog.locator('[data-mail-write]').click();await dialog.locator('[name=message]').fill('键盘弹出时继续写');
 await page.evaluate(()=>{Object.defineProperty(visualViewport,'height',{configurable:true,value:330});Object.defineProperty(visualViewport,'offsetTop',{configurable:true,value:0});visualViewport.dispatchEvent(new Event('resize'));});
 await expect(dialog).toHaveClass(/mail-keyboard/);const rect=await dialog.boundingBox();expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.y+rect.height).toBeLessThanOrEqual(330);
 await dialog.locator('[data-mail-close]').click();await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).toBe('');await expect(page.locator('.meow-mail-entry')).toBeFocused();
 await page.evaluate(()=>{delete visualViewport.height;delete visualViewport.offsetTop;visualViewport.dispatchEvent(new Event('resize'));});
 await page.locator('.meow-mail-entry').click();await dialog.locator('[data-mail-write]').click();await expect(dialog).not.toHaveClass(/mail-keyboard/);await expect(dialog.locator('[name=message]')).toHaveValue('键盘弹出时继续写');await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
});
