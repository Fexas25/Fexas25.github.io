const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('mx-studio-intro-seen-v2', '1'));
});

test('小伙伴触摸回应、纸飞机轮流接住', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const scene = page.locator('[data-buddy-scene]');
  const buddies = scene.locator('[data-buddy]');
  await scene.scrollIntoViewIfNeeded();
  await buddies.first().tap();
  await expect(scene.locator('[role=status]')).toContainText('：');
  if (await buddies.count() > 1) {
    for (let i = 1; i < await buddies.count(); i++) await buddies.nth(i).tap();
    await expect(scene.locator('[role=status]')).toContainText('全员集合');
  }
  const send = scene.locator('.buddy-send');
  await send.tap();
  await expect(send).toHaveAttribute('aria-disabled', 'true');
  await send.tap({ force: true }); // Bypass the test driver's aria-disabled wait to actually tap during flight.
  await expect(scene.locator('[role=status]')).toContainText('接住了纸飞机');
  const first = await scene.locator('[role=status]').textContent();
  await send.tap();
  await expect(scene.locator('[role=status]')).toContainText('下一站');
  expect(await scene.locator('[role=status]').textContent()).not.toEqual(first);
  expect(errors).toEqual([]);
  await scene.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.screenshot({ path: test.info().outputPath('buddies-mobile.png') });
});

test('小伙伴拖动不越界、拖完仍可点击、键盘可操作', async ({ page }) => {
  await page.goto('/projects/');
  const buddy = page.locator('[data-buddy]').first();
  await buddy.scrollIntoViewIfNeeded();
  const box = await buddy.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(-100, box.y + 20, { steps: 10 });
  await page.mouse.up();
  await expect(buddy).not.toHaveClass(/is-picked/);
  await expect(page.locator('.buddy-message')).toContainText(/位置|贴贴/);
  const bounds = await buddy.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  await buddy.press('Enter');
  await expect(page.locator('.buddy-message')).toContainText('：');
  await buddy.press('ArrowRight');
  await buddy.press('Home');
  await expect(buddy).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('减少动态效果保留互动反馈、桌面角色不遮挡正文', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const scene = page.locator('[data-buddy-scene]');
  await expect(scene.locator('img').first()).toHaveCSS('animation-name', 'none');
  await scene.locator('.buddy-send').click();
  await expect(scene.locator('[role=status]')).toContainText('接住了纸飞机');
  const geometry = await page.evaluate(() => ({
    scene: document.querySelector('[data-buddy-scene]').getBoundingClientRect().bottom,
    content: document.querySelector('.content-wrap').getBoundingClientRect().top
  }));
  expect(geometry.scene).toBeLessThanOrEqual(geometry.content);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({ path: test.info().outputPath('buddies-desktop.png'), fullPage: true });
});

test('真正的触屏拖动能移动角色并释放指针', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Chromium CDP 提供真实触摸事件；WebKit 使用触摸点击与统一指针检查');
  await page.goto('/');
  const buddy = page.locator('[data-buddy]').first();
  await buddy.scrollIntoViewIfNeeded();
  const box = await buddy.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 45, y: start.y - 15 }] });
  await expect(buddy).toHaveClass(/is-picked/);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(buddy).not.toHaveClass(/is-picked/);
  await expect(page.locator('.buddy-message')).toContainText(/位置|贴贴/);
  await buddy.tap();
  await expect(page.locator('.buddy-message')).toContainText('：');
});
