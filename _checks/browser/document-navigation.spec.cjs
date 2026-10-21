const {test,expect}=require('@playwright/test');
const id='11111111-1111-4111-8111-111111111111',older='22222222-2222-4222-8222-222222222222',newer='33333333-3333-4333-8333-333333333333';
const entry=(id,title,date)=>({id,title,date,tags:['同标签'],folder:'_posts',visibility:'public',url:'/document/?id='+id,topic:'notes',type:'creative',content:'正文'});
const documents=[entry(id,'正在阅读','2026-10-12'),entry(older,'更早的文章','2026-10-11'),entry(newer,'新发布且已改名','2026-10-13')];
async function config(page){await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:location.origin}'}));}
test('列表失败可原地重试，不重复卡片；手机无横向溢出',async({page})=>{
 await config(page);let calls=0;await page.route('**/documents',r=>{calls++;return calls===1?r.fulfill({status:503,json:{error:'offline'}}):r.fulfill({json:{documents}});});
 await page.goto('/blog/');await expect(page.locator('.catalog-retry')).toContainText('暂时未加载');await page.locator('.catalog-retry button').click();await expect(page.locator('[data-backend-entry]')).toHaveCount(3);await expect(page.locator('.catalog-retry')).toHaveCount(0);expect(calls).toBe(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
test('文章读取失败不误显示密钥框；重试和最新相邻文章可用',async({page})=>{
 await page.addInitScript(()=>{window.copied='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copied=text}}});});
 await config(page);let calls=0;await page.route('**/documents',r=>r.fulfill({json:{documents}}));await page.route('**/documents/read',r=>{calls++;return calls===1?r.fulfill({status:503,json:{error:'offline'}}):r.fulfill({json:{...documents[0],readingUrl:'https://mx-community.liuwanting830.workers.dev/read/'+id,document:{folder:'_posts',filename:'test.md',text:'---\ntitle: 正在阅读\n---\n\n读取成功'}}});});
 await page.goto('/document/?id='+id);await expect(page.locator('[data-document-retry]')).toBeVisible();await expect(page.locator('[name=key]')).toBeHidden();await page.locator('[data-document-retry]').click();await expect(page.locator('[data-document-body]')).toContainText('读取成功');await expect(page.locator('[data-document-unlock]')).toBeHidden();
 await page.locator('[data-document-share]').click();expect(await page.evaluate(()=>window.copied)).toBe('https://mx-community.liuwanting830.workers.dev/read/'+id);
 await expect(page.locator('[data-document-neighbors] a')).toHaveCount(2);await expect(page.locator('[data-document-neighbors] a').first()).toHaveAttribute('href',new RegExp(older));await expect(page.locator('[data-document-neighbors] a').last()).toContainText('新发布且已改名');await expect(page.locator('.related-posts li')).toHaveCount(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('分享页原始 HTML 已有正文和预览，手机可读并保留语言选择',async({page})=>{
 const fs=require('node:fs'),path=require('node:path');
 const {HTMLRewriter}=await import('../../_community/node_modules/@worker-tools/html-rewriter/esm/base64.js');globalThis.HTMLRewriter=HTMLRewriter;
 const {publicPage}=await import('../../_community/public-pages.mjs');
 const row={id,title:'分享预览',metadata:JSON.stringify({folder:'_posts',date:'2026-10-12',tags:[]}),visibility:'public',public_url:'/blog/test/',updated:1791849600,document:JSON.stringify({folder:'_posts',filename:'test.md',text:'# 正文标题\n\n公开文章的完整内容。'})};
 const original=globalThis.fetch;let html;
 try{globalThis.fetch=async()=>new Response(fs.readFileSync(path.resolve(__dirname,'../../_site/document/index.html'),'utf8'),{headers:{'Content-Type':'text/html'}});html=await (await publicPage(new Request('https://content.test/read/'+id),{SITE_ORIGIN:'https://fexas25.github.io',DB:{prepare:()=>({bind:()=>({first:async()=>row})})}})).text();}finally{globalThis.fetch=original;}
 expect(html).toContain('<h1>正文标题</h1>');expect(html).toContain('"@type":"BlogPosting"');
 await page.route('https://fexas25.github.io/**',r=>r.fulfill({path:path.resolve(__dirname,'../../_site',new URL(r.request().url()).pathname.slice(1)),headers:{'Access-Control-Allow-Origin':'*'}}));
 await page.route('https://content.test/read/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.route('**/community-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_COMMUNITY={origin:"https://content.test",siteKey:"mock"}'}));
 await page.route('https://challenges.cloudflare.com/**',r=>r.fulfill({contentType:'text/javascript',body:'window.turnstile={render:(s,o)=>{window.challenge=o;return 0},remove:()=>{}};window.mxQuickGuestbookChallenge();'}));
 let payload;
 await page.route('https://content.test/messages',r=>{payload=r.request().postDataJSON();return r.fulfill({status:201,json:{pending:true}});});
 const headers={'Access-Control-Allow-Origin':'*'};
 await page.route('https://content.test/documents',r=>r.fulfill({headers,json:{documents:[]}}));
 // The server-rendered article remains readable if its enhancement request fails.
 await page.route('https://content.test/documents/read',r=>r.fulfill({status:503,headers,json:{error:'offline'}}));
 await page.route('https://content.test/translate',r=>r.fulfill({status:503,headers,json:{error:'offline'}}));
 await page.goto('https://content.test/read/'+id+'?lang=en');
 await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('[data-document-body]')).toContainText('公开文章的完整内容');await expect(page.locator('[data-document-retry]')).toHaveText('Retry');await expect(page.locator('[name=key]')).toBeHidden();
 await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href','https://content.test/read/'+id);
 const entry=page.locator('.reading-end [data-mail-open]');
 await entry.click();await expect(page.locator('#quick-guestbook')).toBeVisible();
 await page.locator('#quick-guestbook [name=name]').fill('Visitor');
 await page.locator('#quick-guestbook [name=message]').fill('A note');
 await page.locator('[data-mail-close]').click();await expect(entry).toBeFocused();await expect(entry).toBeInViewport();
 await entry.click();await expect(page.locator('#quick-guestbook [name=message]')).toHaveValue('A note');
 await page.evaluate(()=>window.challenge.callback('mock-token'));
 await page.locator('#quick-guestbook [type=submit]').click();
 await expect(page.locator('#quick-guestbook [name=message]')).toHaveValue('');
 expect(payload.message).toContain('https://content.test/read/'+id+'\n\nA note');
 expect(payload.message).not.toContain('?lang=');
 await page.locator('[data-mail-close]').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('游戏开发栏目包含后台游戏及旧记录，保留原链接和私密边界',async({page})=>{
 await config(page);
 const items=[
 {...entry(id,'原有游戏记录','2026-10-12'),folder:'_gamejam'},
 {...entry(older,'BinaryLiftVR 游戏项目','2026-10-21'),folder:'_projects',type:'game',slug:'binarylift-vr',url:'https://mx-projects.liuwanting830.workers.dev/p/binarylift-vr/'},
 {...entry(newer,'需要密钥的游戏项目','2026-10-20'),folder:'_projects',type:'game',visibility:'private',slug:'private-game',url:'https://mx-projects.liuwanting830.workers.dev/p/private-game/',content:'不应展示的私密介绍'},
 {...entry('44444444-4444-4444-8444-444444444444','其他 AI 项目','2026-10-19'),folder:'_projects',type:'ai'},
 {...entry('55555555-5555-4555-8555-555555555555','其他创意项目','2026-10-18'),folder:'_projects',type:'creative'}];
 let fail=true;await page.route('**/documents',r=>r.fulfill({status:fail?503:200,json:{documents:items}}));
 await page.goto('/game-jam/');await expect(page.locator('.catalog-retry')).toBeVisible();fail=false;await page.locator('.catalog-retry button').click();
 await expect(page.locator('[data-backend-entry]')).toHaveCount(3);await expect(page.locator('.small-count')).toHaveText('3 篇');
 await expect(page.locator('[data-project-slug=binarylift-vr] .entry-link')).toHaveAttribute('href',items[1].url);
 await expect(page.locator('[data-project-slug=private-game]')).toContainText('需要密钥');await expect(page.locator('[data-browser]')).not.toContainText('不应展示的私密介绍');await expect(page.locator('[data-browser]')).not.toContainText('其他 AI 项目');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.reload();await expect(page.locator('[data-backend-entry]')).toHaveCount(3);
 await page.goto('/projects/');await expect(page.locator('[data-backend-entry]')).toHaveCount(5);
});
