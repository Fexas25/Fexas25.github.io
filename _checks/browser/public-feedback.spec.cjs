const {test,expect}=require('@playwright/test');
async function setup(page){await page.addInitScript(()=>sessionStorage.setItem('mx-language','en'));await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:location.origin,siteKey:"test"}'}));}
test('catalog errors stay English without translation service or cache',async({page})=>{
 await setup(page);await page.route('**/translation-cache.json',r=>r.abort());await page.route('**/translate',r=>r.abort());
 let fail=true;await page.route('**/documents',r=>r.fulfill({status:fail?503:200,json:{documents:[]}}));
 await page.goto('/blog/?lang=en');await expect(page.locator('.catalog-retry')).toContainText('The content service is temporarily unavailable.');await expect(page.locator('.catalog-retry button')).toHaveText('Retry');
 fail=false;await page.locator('.catalog-retry button').click();await expect(page.locator('.catalog-retry')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
test('filtering during search retry cannot issue overlapping requests',async({page})=>{
 await setup(page);await page.route('**/translate',r=>r.abort());let fail=true;await page.route('**/documents',r=>r.fulfill({status:fail?503:200,json:{documents:[]}}));
 let count=0,release;await page.route('**/search-index.json*',async r=>{count++;if(count===1)await r.continue();else{release=()=>r.continue();}});
 await page.goto('/search/?lang=en');await expect(page.locator('.search-retry')).toBeVisible();await page.locator('.search-retry').click();await expect.poll(()=>count).toBe(2);
 await page.locator('input[name=q]').fill('test');await expect(page.locator('.search-retry')).toBeHidden();await expect(page.locator('.search-retry')).toBeDisabled();
 fail=false;await release();await expect(page.locator('.search-retry')).toBeEnabled();await expect(page.locator('.search-retry')).toBeHidden();expect(count).toBe(2);
});
test('only published message bodies and replies translate, restore and retry',async({page})=>{
 await setup(page);let fail=true;const sent=[];await page.route('**/translate',r=>{const text=r.request().postDataJSON().text;sent.push(text);return r.fulfill({status:fail?503:200,json:{text:'Translated public text'}});});
 await page.route('**/documents',r=>r.fulfill({json:{documents:[]}}));let next=false;
 await page.route('**/messages?*',r=>r.fulfill({json:{messages:[{name:'昵称不翻译',message:next?'第二条公开留言':'第一条公开留言',reply:'公开回复',created:1792022400}],next:next?'':'next'}}));
 await page.goto('/guestbook/?lang=en');await expect(page.locator('.guestbook-message>p')).toHaveText('第一条公开留言');
 await expect(page.locator('.translation-retry')).toBeVisible();fail=false;await page.locator('.translation-retry').click();await expect(page.locator('.guestbook-message>p')).toHaveText('Translated public text');await expect(page.locator('.guestbook-reply p')).toHaveText('Translated public text');
 await expect(page.locator('.guestbook-message-meta strong')).toHaveText('昵称不翻译');
 await page.locator('[data-guestbook-write]').click();await page.locator('#quick-guestbook [name=message]').fill('未提交内容');await page.locator('[data-mail-close]').click();
 next=true;await page.locator('#guestbook-more').click();await expect(page.locator('.guestbook-message>p').last()).toHaveText('Translated public text');
 await page.locator('.header-tools [data-language=zh]').click();await expect(page.locator('.guestbook-message>p').first()).toHaveText('第一条公开留言');await expect(page.locator('.guestbook-reply p').first()).toHaveText('公开回复');
 expect(sent.join('')).not.toMatch(/昵称不翻译|未提交内容/);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
test('standalone project gate keeps English and fits mobile',async({page})=>{
 const runtime=(await import('../../_community/projects/worker.mjs')).default;
 const row={id:'11111111-1111-4111-8111-111111111111',slug:'test',title:'Project',visibility:'private',state:'published',entry:'index.html'};
 const env={DB:{prepare:()=>({bind:()=>({first:async()=>row})})},PROJECT_FILES:{}};
 await page.route('https://project.test/**',async r=>{const req=r.request();const response=await runtime.fetch(new Request(req.url(),{method:req.method(),headers:{Origin:'https://project.test','Content-Type':'application/x-www-form-urlencoded'},...(req.method()==='POST'?{body:req.postData()}:{} )}),env);await r.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});});
 await page.goto('https://project.test/p/test/?lang=en');await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('button')).toHaveText('Unlock project →');
 await page.locator('#key').fill('test-value');await page.locator('button').click();await expect(page.locator('[role=alert]')).toHaveText('Verification unavailable. Please retry.');await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('a')).toHaveAttribute('href','https://fexas25.github.io/projects/?lang=en');expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
