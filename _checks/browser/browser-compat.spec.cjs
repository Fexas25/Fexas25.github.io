const {test,expect}=require('@playwright/test');
const id='11111111-1111-4111-8111-111111111111';
const entry={id,title:'兼容性文章',date:'2026-10-15',tags:[],folder:'_posts',visibility:'private',url:'/document/?id='+id,topic:'notes',type:'creative'};
test.beforeEach(async({page})=>{
 await page.addInitScript(()=>{for(const name of ['timeout','any'])Object.defineProperty(AbortSignal,name,{configurable:true,writable:true,value:undefined});});
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:location.origin}'}));
 await page.route('**/documents',r=>r.fulfill({json:{documents:[entry]}}));
});
test('旧 iOS 请求兼容：列表可打开，私密正文仍需正确密钥',async({page})=>{
 let reads=0;
 await page.route('**/documents/read',r=>{reads++;return r.request().postDataJSON().key==='test-only-key'?r.fulfill({json:{...entry,document:{folder:'_posts',filename:'test.md',text:'---\ntitle: 兼容性文章\n---\n\n解锁后才可见'}}}):r.fulfill({status:403,json:{title:entry.title}});});
 await page.goto('/blog/');await expect(page.locator('[data-backend-entry]')).toHaveCount(1);
 await page.getByRole('link',{name:entry.title,exact:true}).click();await expect(page.locator('[name=key]')).toBeVisible();await expect(page.locator('[data-document-body]')).toBeHidden();
 await page.locator('[name=key]').fill('wrong');await page.locator('[data-document-unlock] button[type=submit]').click();await expect(page.locator('[data-document-unlock]')).toContainText('密钥不正确');
 await page.locator('[name=key]').fill('test-only-key');await page.locator('[data-document-unlock] button[type=submit]').click();await expect(page.locator('[data-document-body]')).toContainText('解锁后才可见');expect(reads).toBe(3);
 expect(await page.evaluate(()=>JSON.stringify({...localStorage})+JSON.stringify({...sessionStorage}))).not.toContain('test-only-key');
 await page.getByRole('button',{name:'收起来',exact:true}).click();await expect(page.locator('[data-document-body]')).toBeEmpty();
});
test('旧 iOS 超时能停止等待，重试不重复卡片，取消保持生效',async({page})=>{
 await page.clock.install();let calls=0;
 await page.route('**/documents',r=>{calls++;return calls===1?new Promise(()=>{}):r.fulfill({json:{documents:[entry]}});});
 await page.goto('/blog/');await page.clock.runFor(10050);await expect(page.locator('.catalog-retry')).toContainText('连接超时');
 await page.locator('.catalog-retry button').click();await expect(page.locator('[data-backend-entry]')).toHaveCount(1);expect(calls).toBe(2);
 const cancelled=await page.evaluate(()=>{const a=new AbortController(),b=new AbortController(),signal=AbortSignal.any([a.signal,b.signal]);a.abort();const early=AbortSignal.any([a.signal]);return signal.aborted&&early.aborted;});expect(cancelled).toBe(true);
});
test('内容服务连接失败可重试，不把网络故障当密钥错误',async({page})=>{
 let calls=0;await page.route('**/documents/read',r=>++calls===1?r.abort('failed'):r.fulfill({status:403,json:{title:entry.title}}));
 await page.goto('/document/?id='+id);await expect(page.locator('[data-document-unlock]')).toContainText('无法连接内容服务');await expect(page.locator('[name=key]')).toBeHidden();
 await page.locator('[data-document-retry]').click();await expect(page.locator('[name=key]')).toBeVisible();expect(calls).toBe(2);
});
test('小屏后台导航可展开，编辑区不被挤下首屏，外链另开',async({page})=>{
 await page.setViewportSize({width:320,height:568});await page.goto('http://127.0.0.1:4175/projects/new');
 const menu=page.locator('.hub-navigation');await expect(menu).not.toHaveAttribute('open');
 expect((await page.locator('#title').boundingBox()).y).toBeLessThan(350);
 await menu.locator('summary').click();await expect(page.locator('.hub-nav')).toBeVisible();await expect(page.getByRole('link',{name:'查看线上效果 ↗',exact:true})).toHaveAttribute('target','_blank');
 await page.locator('.hub-nav a[href="/drafts"]').click();await expect(page).toHaveURL('http://127.0.0.1:4175/drafts');
 await page.setViewportSize({width:568,height:320});expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
test('窄屏和横屏的首页标题、点击区域与音乐控件保持可用',async({page})=>{
 await page.addInitScript(()=>sessionStorage.setItem('mx-studio-intro-seen-v2','1'));
 await page.setViewportSize({width:320,height:568});await page.goto('/');
 await page.evaluate(()=>document.fonts.ready);
 expect((await page.locator('.header-inner .brand').boundingBox()).height).toBeGreaterThanOrEqual(44);
 for(const link of await page.locator('.header-inner nav a').all())expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.screenshot({path:test.info().outputPath('home-320.png'),fullPage:true});
 await page.setViewportSize({width:568,height:320});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.locator('.header-tools [data-language]').click({trial:true});
 await page.locator('.music-toggle').click();await expect(page.locator('.music-panel')).toBeVisible();
 const panel=await page.locator('.music-panel').boundingBox();expect(panel.x).toBeGreaterThanOrEqual(0);expect(panel.x+panel.width).toBeLessThanOrEqual(568);expect(panel.y+panel.height).toBeLessThanOrEqual(320);
 await page.locator('[data-music-play]').click({trial:true});
});
