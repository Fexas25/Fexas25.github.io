const {test,expect}=require('@playwright/test');
const {reveal}=require('../key-view.cjs');
for(const project of [false,true])for(const initialPrivate of [false,true])test(`核对同步密钥入口且不保存 ${project?'项目':'文章'} ${initialPrivate?'转公开':'转私密'}`,async({page})=>{
 await page.goto('http://127.0.0.1:4175'+(project?'/projects/new':'/write'));
 const title=project?'#title':'#post-title',visibility=project?'#visibility':'#post-visibility',save=project?'#publish-project':'#publish';
 await page.locator(title).fill('线上原标题');
 if(project){await page.locator('#slug').fill('sync-'+test.info().project.name+'-'+Date.now());await page.locator('#kind').selectOption('link');await page.locator('#external-url').fill('https://example.com');}else await page.locator('#markdown-input').fill('线上正文');
 if(initialPrivate)await page.locator(visibility).selectOption('private');
 await page.locator(save).click();await expect(page.locator('#status')).toContainText(project?'已发布':'已保存到网站');
 const id=new URL(page.url()).searchParams.get('id'),originalKey=initialPrivate?await reveal(page):'A'.repeat(43);
 const latest=await page.evaluate(async({id,project,initialPrivate})=>{const kind=project?'projects':'documents',r=await MXAdminApi(kind,{action:'read',id});await MXAdminApi(kind,project?{...r,action:'save',visibility:initialPrivate?'public':'private',...(!initialPrivate?{key:'A'.repeat(43)}:{})}:{action:'save',id,revision:r.revision,visibility:initialPrivate?'public':'private',...(!initialPrivate?{key:'A'.repeat(43)}:{}),document:r.document,metadata:{date:r.date,tags:r.tags,topic:r.topic,type:r.type}});return MXAdminApi(kind,{action:'read',id});},{id,project,initialPrivate});
 await page.locator(title).fill('本页未保存标题');await page.locator(save).click();
 const review=project?page.getByRole('button',{name:'核对线上版本'}):page.locator('#link-confirm');await expect(review).toBeEnabled();
 // Opening/cancelling review does not save. Confirming only updates the saved-record context.
 page.once('dialog',d=>d.dismiss());await review.click();if(project)await expect(page.locator('#status')).toContainText('已取消核对');await expect(page.locator(title)).toHaveValue('本页未保存标题');
 let writes=0;await page.route('**/api/'+(project?'projects':'documents'),async r=>{if(r.request().postDataJSON().action==='save')writes++;await r.continue();});
 page.once('dialog',d=>d.accept());await review.click();await expect(page.locator('#status')).toContainText(project?'已核对':'已关联');
 await expect(page.locator(title)).toHaveValue('本页未保存标题');await expect(page.locator(visibility)).toHaveValue(initialPrivate?'private':'public');await expect(page.locator('#share-key')).toHaveValue('');await expect(page.locator('#key-label')).toBeHidden();
 if(initialPrivate)await expect(page.locator('#key-vault')).toBeHidden();else{await expect(page.locator('#view-key')).toBeVisible();expect(await reveal(page)).toBe(originalKey);}
 const current=await page.evaluate(async({id,project})=>MXAdminApi(project?'projects':'documents',{action:'read',id}),{id,project});expect(current).toEqual(latest);expect(writes).toBe(0);
 expect(await page.evaluate(async({id,project,key})=>(await MXAdminApi(project?'projects':'documents',{action:'check-key',id,key})).matches,{id,project,key:originalKey})).toBe(true);
 if(!project)expect((await page.evaluate(()=>MXDrafts.state().items)).some(d=>d.meta['post-title']==='本页未保存标题')).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
