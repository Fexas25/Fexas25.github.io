const {test,expect}=require('@playwright/test');

test('手机写作页读取旧文、弹窗登录、直接保存和退出',async({page,context})=>{
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type,Accept,X-GitHub-Api-Version','Access-Control-Allow-Methods':'GET,PUT,OPTIONS'};
 const source='---\ntitle: 已有文章\ndate: 2026-10-12\ncategory: blog\ntags: [日常]\ncustom: keep-me\n---\n\n原有正文';
 let saved=null;
 await context.route('https://publishing.test/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/health')return route.fulfill({headers,json:{configured:true}});
  return route.fulfill({contentType:'text/html',body:`<script>window.opener.postMessage(${JSON.stringify({type:'mx-github-auth',channel:url.searchParams.get('channel'),token:'test-token'})},'http://127.0.0.1:4173');</script>`});
 });
 await page.route('**/editor-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_PUBLISH={authOrigin:"https://publishing.test"};'}));
 await page.route('https://api.github.com/**',route=>{
  const req=route.request(),url=new URL(req.url());if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
  if(url.pathname.endsWith('/git/trees/main'))return route.fulfill({headers,json:{tree:[{type:'blob',path:'_posts/2026-10-12-old.md'}]}});
  if(url.pathname.includes('/contents/')){
   if(req.method()==='PUT'){saved=req.postDataJSON();return route.fulfill({headers,json:{content:{sha:'saved-sha'}}});}
   return route.fulfill({headers,json:{type:'file',encoding:'base64',sha:'old-sha',content:Buffer.from(source).toString('base64')}});
  }
  return route.fulfill({headers,json:{permissions:{push:true}}});
 });
 await page.goto('/editor.html');await page.locator('#published-content summary').click();
 await expect(page.locator('#github-article option[value="_posts/2026-10-12-old.md"]')).toHaveCount(1);
 await page.locator('#github-article').selectOption('_posts/2026-10-12-old.md');await page.locator('#github-load').click();
 await expect(page.locator('#post-title')).toHaveValue('已有文章');await page.locator('#markdown-input').fill('更新后的正文');
 await page.locator('#github-publish').click();await expect(page.locator('#github-status')).toContainText('已登录 Fexas25');
 await expect(page.locator('#github-publish')).toHaveText('保存修改');await page.locator('#github-publish').click();
 await expect(page.locator('#github-result')).toContainText('已提交到 GitHub');expect(saved.sha).toBe('old-sha');
 expect(Buffer.from(saved.content,'base64').toString()).toContain('custom: keep-me');expect(Buffer.from(saved.content,'base64').toString()).toContain('更新后的正文');
 await page.locator('#github-logout').click();await expect(page.locator('#github-publish')).toHaveText('登录后发布');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 expect(await page.evaluate(()=>JSON.stringify(localStorage))).not.toContain('test-token');
});
