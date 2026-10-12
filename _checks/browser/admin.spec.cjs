const {test,expect}=require('@playwright/test');

test('留言审核窄屏、批量操作、回收站与安全显示',async({page})=>{
 const {page:html}=await import('../../_community/admin/ui.mjs');
 const rows=[{id:1,name:'<img src=x onerror=alert(1)>',message:'测试留言 '+ '长内容'.repeat(60),created:1700000000,approved:0},{id:2,name:'MX',message:'另一条留言',created:1700000001,approved:0}];
 await page.route('**/admin-test',r=>r.fulfill({contentType:'text/html',body:html('browser-test')}));
 await page.route('**/api/messages?*',r=>{const state=new URL(r.request().url()).searchParams.get('state');const value={pending:0,published:1,trash:-1}[state];return r.fulfill({json:{messages:rows.filter(x=>x.approved===value),next:'',counts:{pending:rows.filter(x=>x.approved===0).length,published:rows.filter(x=>x.approved===1).length,trash:rows.filter(x=>x.approved===-1).length}}});});
 await page.route('**/api/moderate',r=>{const data=r.request().postDataJSON();let changed=0;for(const row of rows)if(data.ids.includes(row.id)&&row.approved==={pending:0,published:1,trash:-1}[data.from]){row.approved={publish:1,hide:0,trash:-1,restore:0}[data.action];changed++;}return r.fulfill({json:{changed,requested:data.ids.length}});});
 await page.goto('/admin-test');await expect(page.locator('.card')).toHaveCount(2);await expect(page.locator('.card img')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.getByLabel('全选已加载').check();await page.getByRole('button',{name:'通过选中',exact:true}).click();await expect(page.locator('.card')).toHaveCount(0);
 await page.getByRole('button',{name:'已公开 2',exact:true}).click();await expect(page.locator('.card')).toHaveCount(2);
 await page.locator('.card').first().getByRole('button',{name:'隐藏',exact:true}).click();await expect(page.locator('.card')).toHaveCount(1);
 await page.getByRole('button',{name:'待审核 1',exact:true}).click();page.once('dialog',d=>d.accept());await page.locator('.card').getByRole('button',{name:'移入回收站',exact:true}).click();await expect(page.locator('.card')).toHaveCount(0);
 await page.getByRole('button',{name:'回收站 1',exact:true}).click();await page.getByRole('button',{name:'恢复待审核',exact:true}).click();await expect(page.locator('.card')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'待审核 1',exact:true})).toBeVisible();
});
