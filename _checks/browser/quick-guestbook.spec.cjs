const {test,expect}=require('@playwright/test');

test('睡猫留言按需验证、保留输入、恢复焦点和小屏提交',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('mx-studio-intro-seen-v2','1'));
 let loads=0, posts=0, fail=true, payload;
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:"https://community.test",siteKey:"test"}'}));
 await page.route('https://challenges.cloudflare.com/**',r=>{
  loads++;
  return r.fulfill({contentType:'text/javascript',body:'window.turnstile={render:(s,o)=>{window.challenge=o;return 0},remove:()=>{}};window.mxQuickGuestbookChallenge();'});
 });
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'};
 await page.route('https://community.test/**',async r=>{
  if(r.request().method()==='OPTIONS')return r.fulfill({status:204,headers});
  posts++;payload=r.request().postDataJSON();
  await new Promise(resolve=>setTimeout(resolve,300));
  return r.fulfill({headers,status:fail?503:201,json:fail?{error:'unavailable'}:{pending:true}});
 });
 await page.goto('/');
 if(await page.locator('#studio-intro').isVisible())await page.locator('#intro-enter').click();
 await expect(page.locator('#studio-intro')).not.toBeVisible();
 expect(loads).toBe(0);
 const entry=page.locator('.meow-mail-entry'), dialog=page.locator('#quick-guestbook');
 await entry.click();await expect(dialog).toBeVisible();await expect(dialog.locator('form')).toBeHidden();expect(loads).toBe(0);await dialog.locator('[data-mail-write]').click();
 const name=dialog.locator('[name=name]'), message=dialog.locator('[name=message]'), submit=dialog.locator('[type=submit]');
 await expect(submit).toBeDisabled();
 await name.fill('MX');await message.fill('今天也开心！');
 await dialog.locator('[data-mail-close]').click();
 await expect(entry).toBeFocused();
 await entry.click();await dialog.locator('[data-mail-write]').click();await expect(message).toHaveValue('今天也开心！');
 expect(loads).toBe(1);
 await page.setViewportSize({width:page.viewportSize().width,height:500});
 await message.focus();
 const rect=await dialog.boundingBox();expect(rect.height).toBeLessThanOrEqual(476);
 expect(await dialog.evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
 await page.evaluate(()=>window.challenge.callback('verified'));
 await submit.click();
 await expect(submit).toBeDisabled();
 await expect(dialog.locator('[role=status]')).toContainText('内容已保留');
 await expect(message).toHaveValue('今天也开心！');expect(posts).toBe(1);
 fail=false;await page.evaluate(()=>window.challenge.callback('verified-again'));
 await submit.click();
 await expect(dialog.locator('[role=status]')).toHaveText('收到啦，审核后会出现喵！');
 expect(posts).toBe(2);expect(payload.message).toBe('今天也开心！');
 await expect(message).toHaveValue('');
 await dialog.locator('[data-mail-close]').click();
 await expect.poll(()=>page.evaluate(()=>document.body.style.overflow)).toBe('');
});

test('文章留言保留阅读位置并注明文章',async({page})=>{
 await page.goto('/blog/');
 const href=await page.locator('a[href^="/blog/"]').evaluateAll(links=>links.map(a=>a.getAttribute('href')).find(h=>h!='/blog/'));
 expect(href).toBeTruthy();await page.goto(href);
 const link=page.locator('.reading-end [data-mail-open]');
 await link.scrollIntoViewIfNeeded();await link.click();
 await expect(page.locator('#quick-guestbook-context')).toContainText(await page.locator('#article-top h1').innerText());
 await expect(page.locator('#quick-guestbook [type=submit]')).toBeDisabled();
 await page.locator('#quick-guestbook [name=message]').fill('读到这里想说一句');
 await page.locator('[data-mail-close]').click();
 await expect(link).toBeFocused();await expect(link).toBeInViewport();
 await link.click();
 await expect(page.locator('#quick-guestbook [name=message]')).toHaveValue('读到这里想说一句');
});


test('睡猫可选择查看留言，列表底部快捷返回输入区',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('mx-studio-intro-seen-v2','1'));
 await page.goto('/');if(await page.locator('#studio-intro').isVisible())await page.locator('#intro-enter').click();
 await page.locator('.meow-mail-entry').click();
 await expect(page.locator('#quick-guestbook form')).toBeHidden();
 await page.locator('.mail-choices a').click();
 await expect(page).toHaveURL(/guestbook\/#guestbook-messages$/);
 await expect(page.locator('#guestbook-messages')).toBeInViewport();
 await page.locator('[data-guestbook-write]').click();
 await expect(page.locator('#guestbook-form [name=message]')).toBeFocused();
 await expect(page.locator('#guestbook-form')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
