const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const picture=fs.readFileSync(path.join(__dirname,'../../assets/optimized/portrait-orange.webp'));
const digest=crypto.createHash('sha256').update(picture).digest('hex');
const gitSha=crypto.createHash('sha1').update(`blob ${picture.length}\0`).update(picture).digest('hex');
const imagePath=`/picture/uploads/${digest}.webp`;

test('手机选图、断线重试复用、光标插入与草稿恢复',async({page,context})=>{
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type,Accept,X-GitHub-Api-Version','Access-Control-Allow-Methods':'GET,PUT,OPTIONS'};
  let uploaded=false,writes=0;
  await context.route('https://publishing.test/**',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/health') return route.fulfill({headers,json:{configured:true}});
    return route.fulfill({contentType:'text/html',body:`<script>opener.postMessage(${JSON.stringify({type:'mx-github-auth',channel:url.searchParams.get('channel'),token:'image-test-token'})},'http://127.0.0.1:4173')</script>`});
  });
  await page.route('**/editor-config.js*',r=>r.fulfill({contentType:'text/javascript',body:'window.MX_PUBLISH={authOrigin:"https://publishing.test"}'}));
  await page.route('https://raw.githubusercontent.com/**',r=>r.fulfill({contentType:'image/webp',body:picture}));
  await page.route('https://api.github.com/**',route=>{
    const req=route.request(),url=new URL(req.url());
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(url.pathname.endsWith('/git/trees/main'))return route.fulfill({headers,json:{tree:[]}});
    if(url.pathname.includes('/contents/picture/uploads/')){
      expect(url.pathname).toContain(imagePath);
      if(req.method()==='PUT'){
        expect(req.headers().authorization).toBe('Bearer image-test-token');
        const data=req.postDataJSON();expect(data.branch).toBe('main');expect(data.sha).toBeUndefined();
        expect(Buffer.from(data.content,'base64')).toEqual(picture);
        uploaded=true;writes++;return route.abort('failed'); // GitHub saved it but the response was lost.
      }
      return uploaded?route.fulfill({headers,json:{type:'file',sha:gitSha}}):route.fulfill({headers,status:404,json:{}});
    }
    return route.fulfill({headers,json:{permissions:{push:true}}});
  });
  await page.goto('/editor.html');
  await page.locator('#post-title').fill('图片草稿');
  const input=page.locator('#markdown-input');await input.fill('前文后文');
  await page.locator('#image-upload').click();
  await expect(page.locator('#github-status')).toContainText('已登录 Fexas25');
  await input.evaluate(el=>el.setSelectionRange(2,2));
  async function choose(file){
    const chooser=page.waitForEvent('filechooser');await page.locator('#image-upload').click();
    await (await chooser).setFiles(file);
  }
  await choose({name:'相册照片.webp',mimeType:'image/webp',buffer:picture});
  await expect(page.locator('#image-upload-status')).toContainText('重新选择原图重试');
  await expect(input).toHaveValue('前文后文');
  await choose({name:'相册照片.webp',mimeType:'image/webp',buffer:picture});
  await expect(page.locator('#image-upload-status')).toContainText('图片已插入正文');
  const body=`前文\n\n![图片](${imagePath})\n\n后文`;
  await expect(input).toHaveValue(body);expect(writes).toBe(1);
  await expect.poll(()=>page.locator('#preview-content img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  await choose({name:'fake.png',mimeType:'image/png',buffer:Buffer.from('<svg onload="alert(1)"></svg>')});
  await expect(page.locator('#image-upload-status')).toContainText('支持 JPG');
  await choose({name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1)});
  await expect(page.locator('#image-upload-status')).toContainText('不超过 5 MB');
  await expect(input).toHaveValue(body);expect(writes).toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.reload();await expect(input).toHaveValue(body);
  await expect.poll(()=>page.locator('#preview-content img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  expect(errors).toEqual([]);
});
