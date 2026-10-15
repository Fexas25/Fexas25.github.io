const {test,expect}=require('@playwright/test');
test('failed public message keeps its original while later messages translate and retry recovers',async({page})=>{
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:location.origin}'}));
 await page.route('**/documents',r=>r.fulfill({json:{documents:[]}}));
 const source='太强了👍🏻👍🏻\n投喂小鱼干🐟🐟（？）';const translated='Amazing!👍🏻👍🏻\nSome fish treats🐟🐟（？）';let fail=true;
 await page.route('**/messages?*',r=>r.fulfill({json:{messages:[source,'后面的留言一','后面的留言二','后面的留言三','后面的留言四'].map(message=>({name:'Visitor',message,created:1792022400})),next:''}}));
 const calls=[];await page.route('**/translate',async r=>{const {text}=r.request().postDataJSON();calls.push(text);await r.fulfill({status:text===source&&fail?502:200,json:{text:text===source?translated:'Translated message'}});});
 await page.goto('/guestbook/?lang=en');await expect(page.locator('.translation-retry')).toBeVisible();
 await expect(page.locator('[data-public-message]').first()).toHaveText(source);await expect(page.locator('[data-public-message]').last()).toHaveText('Translated message');
 fail=false;await page.locator('.translation-retry').click();await expect(page.locator('[data-public-message]').first()).toHaveText(translated);await expect(page.locator('.translation-retry')).toBeHidden();
 await page.locator('.header-tools [data-language=zh]').click();await expect(page.locator('[data-public-message]').first()).toHaveText(source);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);expect(calls.filter(x=>x==='后面的留言四')).toHaveLength(1);
});
