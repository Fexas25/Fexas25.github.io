const {test,expect}=require('@playwright/test');
test('开屏语言选择，正文可翻译并恢复，动态小鱼清理',async({page})=>{
 await page.route('**/translation-cache.json',route=>route.fulfill({json:{'快来一起摸鱼吧！':'Come relax with Meow!'}}));
 await page.goto('/');
 const english=page.locator('.intro-languages [data-language=en]');
 await expect(english).toBeVisible();
 const box=await english.boundingBox();expect(box.y+box.height).toBeLessThanOrEqual(780);
 await english.click();
 await expect(english).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('#intro-title')).toHaveText('Time to Meow');
 await expect(page.locator('#intro-enter')).toHaveAttribute('aria-label',"Let's meow");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await expect(page.locator('#studio-intro')).toBeVisible();
 await page.locator('.intro-languages [data-language=zh]').click();
 await expect(page.locator('#intro-title')).toHaveText('现在是摸鱼时间');
 await expect(page.locator('#studio-intro')).toBeVisible();
 await english.click();
 await page.locator('#intro-enter').click();
 await expect(page.locator('#studio-intro')).not.toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.getByText('Come relax with Meow!',{exact:true})).toBeVisible();
 await page.locator('.header-tools [data-language=zh]').click();
 await expect(page.getByText('快来一起摸鱼吧！',{exact:true})).toBeVisible();
 await page.locator('#fish-play').click();
 await expect(page.locator('.play-fish')).toHaveCount(1);
 await expect(page.locator('.play-fish')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
test('留言未配置不可提交，配置后验证、保留失败内容和审核提示',async({page})=>{
 await page.goto('/guestbook/');await page.locator('[data-guestbook-write]').click();
 await expect(page.locator('[type=submit]')).toBeDisabled();
 await expect(page.locator('#quick-guestbook-status')).toHaveText('留言暂未开放，可以稍后再来。');
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:"https://community.test",siteKey:"test"}'}));
 await page.route('https://challenges.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:'window.turnstile={render:(s,o)=>{if(!window.challenge)o.callback("verified");window.challenge=o;return 1},reset:()=>{},remove:()=>{}};window.mxQuickGuestbookChallenge();'}));
 let fail=true;
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
 await page.route('https://community.test/**',r=>r.request().method()==='OPTIONS'?r.fulfill({status:204,headers}):r.request().method()==='GET'?r.fulfill({headers,json:{messages:[{name:'<img src=x>',message:'<script>alert(1)</script>',reply:'MX 回复 <img src=x> '+ '长回复'.repeat(60),created:100}],next:''}}):r.fulfill({headers,status:fail?503:201,json:fail?{error:'unavailable'}:{pending:true}}));
 await page.reload();await page.locator('[data-guestbook-write]').click();
 await expect(page.locator('[type=submit]')).toBeEnabled();
 await expect(page.locator('.guestbook-message img')).toHaveCount(0);await expect(page.locator('.guestbook-reply')).toContainText('MX 回复 <img src=x>');
 await page.locator('[name=name]').fill('MX');await page.locator('[name=message]').fill('一条留言');
 await page.locator('[type=submit]').click();
 await expect(page.locator('#quick-guestbook-status')).toContainText('内容已保留');
 await expect(page.locator('[name=message]')).toHaveValue('一条留言');
 fail=false;await page.evaluate(()=>window.challenge.callback('verified-again'));
 await page.locator('[type=submit]').click();
 await expect(page.locator('#quick-guestbook-status')).toHaveText('收到啦，审核后会出现喵！');
 await expect(page.locator('[name=message]')).toHaveValue('');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});


test('睡猫邀请纸条在手机上可打开留言选择',async({page})=>{
 await page.goto('/about/');const entry=page.locator('.meow-invitation');await entry.scrollIntoViewIfNeeded();await expect(entry).toContainText('陪我聊聊？');await entry.click();await expect(page.locator('#quick-guestbook')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
