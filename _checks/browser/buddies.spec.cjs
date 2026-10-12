const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('mx-studio-intro-seen-v2', '1'));
  page.__buddyErrors = [];
  page.on('pageerror', error => page.__buddyErrors.push(error.message));
});
test.afterEach(async ({ page }) => expect(page.__buddyErrors).toEqual([]));

async function tapBuddy(page, buddy) {
  await buddy.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await expect(page.locator('[data-buddy-scene]')).not.toHaveClass(/is-scrolling/);
  await expect(buddy).toBeVisible();
  // Locator.tap may scroll again in WebKit, hiding companions while scrolling.
  // Check the real hit target, then use a touch without another automatic scroll.
  let point;
  await expect.poll(async () => {
    point = await buddy.evaluate(el => {
      const box = el.getBoundingClientRect();
      const x = box.left + box.width / 2, y = box.top + box.height / 2;
      return { x, y, hittable: el.contains(document.elementFromPoint(x, y)) };
    });
    return point.hittable;
  }).toBe(true);
  await page.touchscreen.tap(point.x, point.y);
}

async function unobstructed(page) {
  const conflicts = await page.evaluate(() => {
    const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const actors = [...document.querySelectorAll('[data-buddy]')].filter(el => !el.hidden && getComputedStyle(el).visibility !== 'hidden');
    const protectedRects = [];
    for (const el of document.querySelectorAll('a,button,input,textarea,select,summary,.shelf-character')) {
      if (el.matches('[data-buddy]') || getComputedStyle(el).visibility === 'hidden') continue;
      for (const box of el.getClientRects()) if (box.width && box.height) protectedRects.push({ box, label: el.id || el.tagName });
    }
    const walker = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent.trim() || walker.currentNode.parentElement.closest('script,style,[data-buddy-scene]')) continue;
      range.selectNodeContents(walker.currentNode);
      for (const box of range.getClientRects()) if (box.width && box.height) protectedRects.push({ box, label: '正文文字' });
    }
    return actors.flatMap(actor => {
      const box = actor.getBoundingClientRect();
      return protectedRects.filter(other => overlaps(box, other.box)).map(other => `${actor.dataset.buddy}: ${other.label}`);
    });
  });
  expect(conflicts, '小人不能盖住原有角色、正文或按钮').toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

test('原有小圆圈保留，小伙伴额外分布在页面中', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.character-stage .character')).toHaveCount(3);
  await expect(page.locator('[data-buddy]')).toHaveCount(3);
  await expect(page.locator('.buddy-floor')).toHaveCount(0);
  await page.waitForTimeout(450);
  await unobstructed(page);
  await page.goto('/projects/');
  await expect(page.locator('.shelf-character .portrait')).toBeVisible();
  await page.waitForTimeout(450);
  await unobstructed(page);
});

test('小伙伴触摸回应、集合与纸飞机轮流接住', async ({ page }) => {
  await page.goto('/');
  const buddies = page.locator('[data-buddy]');
  for (let i = 0; i < 3; i++) {
    await tapBuddy(page, buddies.nth(i));
    await expect(page.locator('.buddy-message')).toContainText(['花花：', '桃桃：', '全员集合'][i]);
    await expect(page.locator('.buddy-message')).toContainText(['花里实乃理', '桃井爱莉', '芙宁娜'][i]);
  }
  await expect(page.locator('.buddy-message')).toContainText('全员集合');
  const send = page.locator('.buddy-send');
  await send.tap();
  await expect(send).toHaveAttribute('aria-disabled', 'true');
  await send.tap({ force: true });
  await expect(page.locator('.buddy-message')).toContainText('花花接住了纸飞机');
  await send.tap();
  await expect(page.locator('.buddy-message')).toContainText('桃桃接住了纸飞机');
  await unobstructed(page);
});

test('自由拖动支持横向和纵向，落在按钮上会让开', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const buddy = page.locator('[data-buddy]').first();
  await expect(buddy).toBeVisible();
  // Fonts/images can trigger the companion's delayed layout refresh in WebKit.
  // Start the drag only after its actual position has settled.
  await page.evaluate(() => document.fonts.ready);
  let lastBox = '', stableSince = 0;
  await expect.poll(async () => {
    const box = await buddy.boundingBox();
    const signature = JSON.stringify(box);
    if (!box || signature !== lastBox) { lastBox = signature; stableSince = Date.now(); }
    return !!box && Date.now() - stableSince >= 400;
  }).toBe(true);
  const from = await buddy.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 - 100, from.y + from.height / 2 + 90, { steps: 8 });
  await expect(buddy).toHaveClass(/is-picked/);
  const during = await buddy.boundingBox();
  expect(during.x).toBeCloseTo(from.x - 100, 0);
  expect(during.y).toBeCloseTo(from.y + 90, 0);
  const target = await page.locator('.draw-box').boundingBox();
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(buddy).not.toHaveClass(/is-picked/);
  await unobstructed(page);
  await page.locator('.draw-box').click();
  await expect(page.locator('#fortune-dialog')).toBeVisible();
  await expect(buddy).not.toBeVisible();
});

test('自动散步、减少动态效果与休息开关', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const buddy = page.locator('[data-buddy]').first();
  await expect(buddy).toHaveClass(/is-walking/, { timeout: 12000 });
  const start = await buddy.boundingBox();
  await expect.poll(async () => {
    const box = await buddy.boundingBox();
    return Math.hypot(box.x - start.x, box.y - start.y);
  }).toBeGreaterThan(3);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(200);
  const still = await buddy.boundingBox();
  await page.waitForTimeout(1100);
  expect(await buddy.boundingBox()).toEqual(still);
  await expect(buddy.locator('img')).toHaveCSS('animation-name', 'none');
  await page.locator('.buddy-toggle').click();
  await expect(buddy).not.toBeVisible();
  await page.reload();
  await expect(page.locator('.buddy-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(buddy).not.toBeVisible();
  await page.locator('.buddy-toggle').click();
  await expect(buddy).toBeVisible();
});

test('键盘自由移动、编辑时让开、窗口改变后不遮挡', async ({ page }) => {
  await page.goto('/projects/');
  const buddy = page.locator('[data-buddy]');
  await buddy.press('Enter');
  await expect(page.locator('.buddy-message')).toContainText('芙芙：');
  for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home']) await buddy.press(key);
  await expect(buddy).toBeFocused();
  await page.setViewportSize({ width: 320, height: 780 });
  await page.waitForTimeout(350);
  await unobstructed(page);
  await page.goto('/editor.html');
  await page.locator('#markdown-input').focus();
  await expect(page.locator('[data-buddy]')).not.toBeVisible();
  await expect(page.locator('.shelf-character .portrait')).toBeVisible();
});

test('拖到伙伴旁边会贴贴，放手后不互相遮挡', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const buddies = page.locator('[data-buddy]');
  const from = await buddies.nth(0).boundingBox();
  const to = await buddies.nth(1).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('.buddy-message')).toContainText('花花和桃桃：贴贴');
  const a = await buddies.nth(0).boundingBox(), b = await buddies.nth(1).boundingBox();
  expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
  await unobstructed(page);
  await page.screenshot({ path: test.info().outputPath('buddies-roaming-desktop.png'), fullPage: true });
});

test('真实触屏二维拖动、取消与跨屏滚动', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP 原生触摸手势只在 Chromium 提供；WebKit 另有触摸点击与指针测试');
  await page.goto('/');
  const buddy = page.locator('[data-buddy]').first();
  await buddy.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(250);
  const box = await buddy.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - 30, y: start.y + 40 }] });
  await expect(buddy).toHaveClass(/is-picked/);
  const moved = await buddy.boundingBox();
  expect(moved.y - box.y).toBeCloseTo(40, 0);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(buddy).not.toHaveClass(/is-picked/);
  await expect(page.locator('.buddy-message')).toContainText('刚才的位置');
  const again = await buddy.boundingBox();
  const oldScroll = await page.evaluate(() => scrollY);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: again.x + again.width / 2, y: again.y + again.height / 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150, y: page.viewportSize().height - 12 }] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(oldScroll + 35);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(250);
  await unobstructed(page);
});
