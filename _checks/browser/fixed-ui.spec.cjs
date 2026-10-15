const {test,expect}=require('@playwright/test');
const id='11111111-1111-4111-8111-111111111111';
async function setup(page){
 await page.addInitScript(()=>sessionStorage.setItem('mx-language','en'));
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:location.origin}'}));
 await page.route('**/translate',r=>r.fulfill({status:503,json:{error:'offline'}}));
}
test('private reading UI switches locally without translating protected text',async({page})=>{
 await setup(page);const sent=[];page.on('request',r=>{if(r.url().endsWith('/translate'))sent.push(r.postData());});
 await page.route('**/documents',r=>r.fulfill({json:{documents:[]}}));
 await page.route('**/documents/read',r=>r.fulfill({json:{id,title:'标题',date:'2026-10-12',visibility:'private',url:'/document/?id='+id,document:{folder:'_posts',filename:'sample.md',text:'---\ntitle: 标题\n---\n\n保密正文不外传\n\n```js\nsecretCode()\n```\n\n![图片](https://external.test/image.png)'}}}));
 await page.goto('/document/?id='+id+'&lang=en');
 await expect(page.locator('[data-document-body]>button')).toHaveText('Lock again');
 await expect(page.locator('.code-copy')).toHaveText('Copy code');
 await expect(page.locator('[data-document-body]')).toContainText('[External image not loaded automatically]');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('denied')}}}));
 await page.locator('.code-copy').click();await expect(page.locator('.code-actions [role=status]')).toHaveText('Copy the selected code manually');
 await page.locator('.header-tools [data-language=zh]').click();await expect(page.locator('.code-copy')).toHaveText('复制代码');
 await expect(page.locator('[data-document-body]')).toContainText('保密正文不外传');
 expect(sent.join('')).not.toMatch(/保密正文|secretCode/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
test('search retry and English incomplete-catalog hint survive filters',async({page})=>{
 await setup(page);let failing=true;
 await page.route('**/documents',r=>r.fulfill({status:failing?503:200,json:{documents:[]}}));
 await page.goto('/search/?lang=en');
 await expect(page.locator('[data-search-status]')).toContainText('Latest content unavailable');
 await page.locator('input[name=q]').fill('no-match-test');
 await expect(page.locator('[data-search-status]')).toContainText('No matches.');
 await expect(page.locator('[data-search-status]')).toContainText('Latest content unavailable');
 await expect(page.locator('.search-retry')).toHaveText('Reload search');
 failing=false;await page.locator('.search-retry').click();await expect(page.locator('.search-retry')).toBeHidden();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
test('legacy unlock errors remain English without network translation',async({page})=>{
 await setup(page);await page.goto('/private/?lang=en#invalid');await page.locator('#access-key').fill('invalid');await page.locator('#private-unlock button').click();
 await expect(page.locator('#private-status')).toHaveText('Check the shared link and the complete access key.');
});
test('English image controls and invalid backup feedback fit phones',async({page})=>{
 await setup(page);await page.goto('/about/?lang=en');
 await page.evaluate(()=>{
  const article=document.createElement('article');article.dataset.readingContent='';article.dataset.privateContent='';article.setAttribute('translate','no');
  article.innerHTML='<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=" alt="原有私密图片说明">';
  document.querySelector('main').prepend(article);window.dispatchEvent(new Event('mx-content-ready'));
 });
 await page.locator('.article-image-open').click();
 await expect(page.locator('.viewer-toolbar')).toContainText('Close image ×');
 await expect(page.locator('.viewer-toolbar')).toContainText('View original size');
 await expect(page.locator('.viewer-caption')).toHaveText('原有私密图片说明');
 expect(await page.locator('.reading-viewer').evaluate(el=>getComputedStyle(el).outlineStyle)).toBe('none');
 expect(await page.locator('.reading-viewer').evaluate(el=>el.scrollWidth-el.clientWidth)).toBeLessThanOrEqual(1);
 await page.locator('.viewer-toolbar button').last().click();
 await page.goto('/daily-checkin/?lang=en');await page.locator('.checkin-backup summary').click();
 await page.locator('#backup-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
 await expect(page.locator('#backup-status')).toHaveText('This is not a supported MX check-in backup.');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
