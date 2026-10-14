const {reveal}=require('../key-view.cjs');
const {test,expect}=require('@playwright/test');
const admin='http://127.0.0.1:4175';
const overflow=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
async function publish(page){await page.goto(admin+'/write');await page.locator('#post-title').fill('操作回归 '+test.info().project.name);await page.locator('#markdown-input').fill('线上正文');await page.locator('#publish').click();await expect(page.locator('#status')).toContainText('已保存到网站');return page.url();}

test('再次编辑可继续已有草稿或保留草稿编辑线上版本',async({page})=>{
 const url=await publish(page);await page.locator('#markdown-input').fill('尚未发布的正文');
 page.once('dialog',d=>d.accept());await page.goto(url);await expect(page).toHaveURL(/draft=/);await expect(page.locator('#markdown-input')).toHaveValue('尚未发布的正文');
 page.once('dialog',d=>d.dismiss());await page.goto(url);await expect(page.locator('#markdown-input')).toHaveValue('线上正文');
 expect(await page.evaluate(()=>MXDrafts.state().items.map(x=>x.body))).toEqual(['尚未发布的正文']);await overflow(page);
});

test('导入切换至独立草稿地址，刷新保留正文并清除旧分享信息',async({page})=>{
 const original=await publish(page);await page.locator('#markdown-input').fill('原文章的待保存改动');
 await page.locator('#markdown-file').setInputFiles({name:'import.md',mimeType:'text/markdown',buffer:Buffer.from('# 新导入\n\n独立正文')});
 await expect(page).toHaveURL(/\/write\?draft=/);await expect(page.locator('#share')).toBeHidden();await expect(page.locator('#share-link')).toHaveValue('');await expect(page.locator('#share-key')).toHaveValue('');
 const body=await page.locator('#markdown-input').inputValue();await page.reload();await expect(page.locator('#markdown-input')).toHaveValue(body);expect(await page.evaluate(()=>MXDrafts.state().items.length)).toBe(2);
 page.once('dialog',d=>d.dismiss());await page.goto(original);await expect(page.locator('#markdown-input')).toHaveValue('线上正文');await overflow(page);
});

test('项目草稿隐藏正式链接，发布后才显示，密钥保持可保存',async({page})=>{
 await page.goto(admin+'/projects/new');await page.locator('#title').fill('链接草稿');await page.locator('#slug').fill('flow-'+test.info().project.name+'-'+Date.now());await page.locator('#kind').selectOption('link');await page.locator('#external-url').fill('https://example.com');await page.locator('#visibility').selectOption('private');
 await page.locator('#save-project').click();await expect(page.locator('#status')).toContainText('已保存到项目草稿');await expect(page.locator('#share-link')).toBeHidden();await expect(page.locator('#copy-link')).toBeHidden();await reveal(page);await expect(page.locator('#preview-project')).toBeEnabled();
 await page.locator('#publish-project').click();await expect(page.locator('#share-link')).toBeVisible();await expect(page.locator('#copy-link')).toBeVisible();await expect(page.locator('#share-link')).not.toHaveValue('');await overflow(page);
});

test('切换回收站只展示最后结果，失败无残留操作，恢复草稿指明去向',async({page})=>{
 const item={id:'fixture',title:'待恢复项目草稿',state:'draft',kind:'link',visibility:'public',updated:1,revision:'v1',url:'https://example.com'};let resolveOld,delayed=false,fail=false,restored=false;
 await page.route('**/api/documents',r=>r.fulfill({json:{documents:[]}}));
 await page.route('**/api/projects',async r=>{const d=r.request().postDataJSON();if(d.action==='restore'){restored=true;return r.fulfill({json:{}});}if(fail)return r.fulfill({status:503,json:{error:'测试断网'}});if(d.trash&&!delayed){delayed=true;await new Promise(resolve=>resolveOld=resolve);}return r.fulfill({json:{projects:d.trash&&!restored?[item]:[]}});});
 await page.goto(admin+'/projects');await expect(page.locator('#status')).toContainText('共 0');await page.locator('#trash').click();await expect.poll(()=>typeof resolveOld).toBe('function');await expect(page.locator('#items button')).toHaveCount(0);await page.locator('#trash').click();await expect(page.locator('#status')).toContainText('共 0');resolveOld();await expect(page.locator('.hub-card')).toHaveCount(0);
 fail=true;await page.locator('#trash').click();await expect(page.locator('#status')).toContainText('请点击刷新重试');await expect(page.locator('#items button')).toHaveCount(0);fail=false;await page.locator('#refresh').click();await expect(page.locator('.hub-card')).toHaveCount(1);await page.getByRole('button',{name:'恢复',exact:true}).click();await expect(page.locator('#status')).toContainText('已恢复到草稿管理，尚未发布');await overflow(page);
});

test('草稿列表刷新读取其他标签页的新草稿，不覆盖已有内容',async({page,context})=>{
 await page.goto(admin+'/drafts');await page.locator('#filter').selectOption('articles');await expect(page.locator('#status')).not.toContainText('正在加载');
 const other=await context.newPage();await other.goto(admin+'/write');await other.locator('#post-title').fill('另一个标签页');await other.locator('#markdown-input').fill('保留另一页正文');
 await page.locator('#refresh').click();await expect(page.locator('.hub-card').filter({hasText:'另一个标签页'})).toHaveCount(1);expect(await page.evaluate(()=>MXDrafts.state().items[0].body)).toBe('保留另一页正文');await overflow(page);
});
