const { test, expect } = require('@playwright/test');
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('mx-studio-intro-seen-v2', '1'));
});
test('人物圆圈直达栏目，原生返回保留首页', async ({ page }) => {
  const entries = [['.character-moments','/blog/'],['.character-blog','/competitive-programming/'],['.character-works','/projects/']];
  for (const [selector, path] of entries) {
    await page.goto('/');
    const circle = page.locator(selector);
    await circle.evaluate(el => el.scrollIntoView({block:'center',behavior:'instant'}));
    // Floating portraits intentionally never become position-stable.
    const point = await circle.evaluate(el => {
      const r = el.getBoundingClientRect(), x = r.x+r.width/2, y = r.y+r.height/2;
      return {x,y,hittable:el.contains(document.elementFromPoint(x,y))};
    });
    expect(point.hittable).toBe(true);
    await page.touchscreen.tap(point.x,point.y);
    await expect(page).toHaveURL(new RegExp(path + '$'));
    await expect(page.locator('.shelf-intro')).toBeVisible();
    await page.goBack();
    await expect(page.locator(selector)).toBeVisible();
  }
});
test('内页点击小图案会清理，输入区不触发，减少动态效果有效', async ({ page }) => {
  await page.goto('/about/');
  const ornaments = page.locator('.studio-ornaments');
  await expect(ornaments.locator('svg')).toHaveCount(3);
  await ornaments.scrollIntoViewIfNeeded();
  const box = await ornaments.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.studio-click-spark')).toHaveCount(1);
  await expect(page.locator('.studio-click-spark')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.studio-click-spark')).toHaveCount(0);
  await expect(page.locator('.is-drifting')).toHaveCount(0);
  await page.goto('/editor.html');
  await page.emulateMedia({ reducedMotion:'no-preference' });
  await page.locator('textarea').first().click();
  await expect(page.locator('.is-drifting')).toHaveCount(0);
  await expect(page.locator('.studio-click-spark')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
