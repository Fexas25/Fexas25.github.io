const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const site = path.resolve(process.env.SITE_DIR || path.join(__dirname, '../../_site'));
function pages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? pages(file) : entry.name.endsWith('.html') ? [file] : [];
  });
}
const routes = pages(site).map(file => '/' + path.relative(site, file).split(path.sep).map(encodeURIComponent).join('/'));
if (!routes.length) throw Error('正式构建没有 HTML 页面，无法进行手机检查');

// Fail on uncaught application errors and broken local assets, independently of remote services.
test.beforeEach(async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => {
    const reason = request.failure()?.errorText || '';
    if (request.url().startsWith('http://127.0.0.1:4173/') && !/aborted|cancelled/i.test(reason)) errors.push(`${reason} ${request.url()}`);
  });
  page.on('response', response => {
    if (response.url().startsWith('http://127.0.0.1:4173/') && response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  page.__mobileErrors = errors;
  // The paused GitHub publisher is outside this suite; never contact its API.
  await page.route('https://api.github.com/**', route => route.fulfill({ json: { tree: [] } }));
});
test.afterEach(async ({ page }) => {
  expect(page.__mobileErrors, '浏览器脚本错误或本地资源加载失败').toEqual([]);
});

async function noOverflow(page) {
  const state = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return {
      overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - width,
      suspects: [...document.querySelectorAll('body *')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width && (r.right > width + 1 || r.left < -1) && getComputedStyle(el).position !== 'fixed';
      }).slice(0, 12).map(el => `${el.tagName}#${el.id}.${el.className}`),
    };
  });
  expect(state.overflow, `横向溢出候选：${state.suspects.join(', ')}`).toBeLessThanOrEqual(1);
}

async function reachable(locator) {
  // Skip links intentionally appear only on keyboard focus.
  if (await locator.evaluate(el => el.classList.contains('skip-link'))) await locator.focus();
  await locator.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
  // Floating characters intentionally never become stationary. Hit-test their current
  // position instead of disabling the site's animation to satisfy Playwright's stability check.
  const floating = await locator.evaluate(el => el.getAnimations({ subtree: true }).some(animation => animation.effect.getTiming().iterations === Infinity));
  if (floating) {
    await expect.poll(() => locator.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
      return target === el || el.contains(target);
    }), { message: '漂浮控件的点击位置被遮挡' }).toBe(true);
  } else {
    await locator.click({ trial: true });
  }
  if (await locator.evaluate(el => el.classList.contains('skip-link'))) await locator.blur();
}

for (const route of routes) {
  test(`页面布局和按钮 ${route}`, async ({ page }) => {
    await page.goto(route);
    if (await page.locator('#studio-intro').isVisible()) await page.locator('#intro-enter').click();
    await expect(page.locator('#studio-intro')).not.toBeVisible();
    await page.evaluate(async () => {
      await document.fonts.ready;
      const images = [...document.images];
      for (const image of images) image.loading = 'eager';
      await Promise.all(images.map(image => image.decode().catch(() => {})));
    });
    await noOverflow(page);
    if (['/index.html', '/editor.html', '/competitive-programming/index.html', '/projects/index.html', '/art/index.html'].includes(route)) {
      const screenshot = test.info().outputPath('mobile-default.png');
      await page.screenshot({ path: screenshot, fullPage: true });
      await test.info().attach('默认简洁视图', { path: screenshot, contentType: 'image/png' });
    }
    // Check the quiet default view, then reveal low-frequency controls and test them too.
    const disclosures = page.locator('details');
    for (let i = 0; i < await disclosures.count(); i++) {
      const disclosure = disclosures.nth(i);
      if (await disclosure.isVisible() && await disclosure.getAttribute('open') === null) {
        await disclosure.locator(':scope > summary').click();
      }
    }
    await noOverflow(page);
    const controls = page.locator('summary, a[href], button, select, input:not([type="hidden"]), textarea');
    for (let i = 0; i < await controls.count(); i++) {
      const control = controls.nth(i);
      if (await control.isVisible() && await control.isEnabled()) {
        await test.step(`可操作：${await control.evaluate(el => el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 45) || el.tagName)}`, async () => {
          await reachable(control);
        });
      }
    }
    await noOverflow(page);
  });
}

test('检测器能识别横向溢出和按钮遮挡', async ({ page }) => {
  await page.setContent('<meta name="viewport" content="width=device-width"><button>测试按钮</button>');
  await reachable(page.getByRole('button'));
  await page.evaluate(() => { document.body.style.width = '2000px'; });
  await expect(noOverflow(page)).rejects.toThrow();
  await page.evaluate(() => {
    document.body.style.width = '';
    const overlay = document.createElement('div');
    overlay.style = 'position:fixed;inset:0;z-index:9999';
    document.body.append(overlay);
  });
  await expect(page.getByRole('button').click({ trial: true, timeout: 500 })).rejects.toThrow();
});

test('首页抽签弹窗和签到记录保持一致', async ({ page }) => {
  await page.goto('/');
  await page.locator('#intro-enter').click();
  await page.locator('.draw-box[data-draw]').click();
  const dialog = page.locator('#fortune-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#fortune-title')).not.toHaveText(/抽签中|正在/);
  await noOverflow(page);
  await page.getByRole('button', { name: '关闭今日签' }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto('/daily-checkin/');
  await expect(page.locator('#total-days')).toHaveText('1');
  await expect(page.locator('#checkin-btn')).toBeDisabled();
  await page.reload();
  await expect(page.locator('#total-days')).toHaveText('1');
});

test('搜索、筛选和文章跳转', async ({ page, request }) => {
  const response = await request.get('/search-index.json');
  const data = await response.json();
  const entries = Array.isArray(data) ? data : data.entries;
  const entry = entries.find(item => item.category === 'writing');
  expect(entry, '搜索索引需要至少一篇博客').toBeTruthy();
  await page.goto('/search/');
  await page.locator('[name="q"]').fill(entry.title);
  await page.locator('[name="category"]').selectOption('writing');
  const result = page.locator('[data-search-results] a').filter({ hasText: entry.title }).first();
  await expect(result).toBeVisible();
  await noOverflow(page);
  await page.locator('[name="q"]').fill('不存在的文章mobilecheck987654');
  await expect(page.locator('[data-search-results] .entry-card')).toHaveCount(0);
  await page.locator('.filter-reset').click();
  await expect(page.locator('[name="q"]')).toHaveValue('');
  await page.locator('[name="q"]').fill(entry.title);
  await result.click();
  await expect(page.locator('[data-reading-content]')).toBeVisible();
  await page.goto('/competitive-programming/');
  const disclosure = page.locator('.archive-disclosure');
  await expect(page.locator('[data-search-input]')).not.toBeVisible();
  await disclosure.locator('summary').click();
  await page.locator('[data-search-input]').fill('不存在的文章mobilecheck987654');
  await expect(page.locator('[data-no-results]')).toBeVisible();
  await disclosure.locator('summary').click();
  await expect(disclosure.locator('summary')).toContainText('已筛选');
  await disclosure.locator('summary').click();
  await page.locator('[data-search-input]').fill('');
  await expect(page.locator('[data-no-results]')).not.toBeVisible();
  await noOverflow(page);
});

test('抽签页首次签到及刷新后的记录', async ({ page }) => {
  await page.goto('/daily-checkin/');
  await expect(page.locator('#total-days')).toHaveText('0');
  await page.locator('#checkin-btn').click();
  await expect(page.locator('#total-days')).toHaveText('1');
  await expect(page.locator('#checkin-btn')).toBeDisabled();
  await noOverflow(page);
  await page.reload();
  await expect(page.locator('#total-days')).toHaveText('1');
  await expect(page.locator('#checkin-btn')).toBeDisabled();
});

test('多篇草稿筛选、继续写、刷新和备份恢复', async ({ page, browser }) => {
  await page.goto('/editor.html');
  await page.locator('#post-title').fill('手机草稿甲');
  await page.locator('#markdown-input').fill('第一篇 **保留内容**');
  await page.locator('#draft-new').click();
  await page.locator('#post-title').fill('手机草稿乙');
  await page.locator('#post-category').selectOption('projects');
  await page.locator('#markdown-input').fill('第二篇工作流');
  await page.locator('#draft-find > summary').click();
  await page.locator('#draft-search').fill('草稿甲');
  await expect(page.locator('#markdown-input')).toHaveValue('第二篇工作流');
  await page.locator('#draft-open').click();
  await expect(page.locator('#markdown-input')).toHaveValue('第一篇 **保留内容**');
  await page.locator('#draft-filter-clear').click();
  await page.locator('#draft-category-filter').selectOption('projects');
  await expect(page.locator('#draft-select option')).toHaveCount(1);
  await expect(page.locator('#draft-selection-info')).toContainText('编辑');
  await noOverflow(page);
  await page.locator('#draft-tools > summary').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#draft-backup-export').click();
  const download = await downloadPromise;
  const backup = await fs.promises.readFile(await download.path());
  expect(JSON.parse(backup).items).toHaveLength(2);
  await page.reload();
  await expect(page.locator('#markdown-input')).toHaveValue('第一篇 **保留内容**');
  const context = await browser.newContext({ viewport: test.info().project.use.viewport, isMobile: true, hasTouch: true, locale: 'zh-CN', baseURL: 'http://127.0.0.1:4173' });
  try {
    const fresh = await context.newPage();
    fresh.on('pageerror', error => page.__mobileErrors.push(error.message));
    await fresh.route('https://api.github.com/**', route => route.fulfill({ json: { tree: [] } }));
    await fresh.goto('/editor.html');
    await fresh.locator('#draft-tools > summary').click();
    const chooserPromise = fresh.waitForEvent('filechooser');
    await fresh.locator('#draft-backup-import').click();
    await (await chooserPromise).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
    await expect(fresh.locator('#draft-backup-status')).toContainText('新增 2 篇');
    await expect(fresh.locator('#draft-select option')).toHaveCount(2);
    await fresh.locator('#draft-find > summary').click();
    await fresh.locator('#draft-search').fill('草稿乙');
    await fresh.locator('#draft-open').click();
    await expect(fresh.locator('#markdown-input')).toHaveValue('第二篇工作流');
    await noOverflow(fresh);
  } catch (error) {
    const fresh = context.pages()[0];
    if (fresh) await test.info().attach('恢复草稿时的页面', { body: await fresh.screenshot(), contentType: 'image/png' });
    throw error;
  } finally { await context.close(); }
});


test('开屏等待点击、进入后不重复打断', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#studio-intro')).toBeVisible();
  await page.waitForTimeout(1400); // Exceed the old automatic dismissal time.
  await expect(page.getByRole('button', { name: '开始摸鱼' })).toBeVisible();
  await noOverflow(page);
  const screenshot = test.info().outputPath('intro-mobile.png');
  await page.screenshot({ path: screenshot });
  await test.info().attach('摸鱼时间开屏', { path: screenshot, contentType: 'image/png' });
  await page.getByRole('button', { name: '开始摸鱼' }).click();
  await expect(page.locator('#studio-intro')).not.toBeVisible();
  await expect(page.locator('#hero-title')).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await page.reload();
  await expect(page.locator('#studio-intro')).not.toBeVisible();
});

test('减少动态效果下静态开屏和键盘进入', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#studio-intro')).toBeVisible();
  await expect(page.locator('.intro-swimmer')).toHaveCSS('animation-name', 'none');
  await page.locator('#intro-enter').press('Enter');
  await expect(page.locator('#studio-intro')).not.toBeVisible();
  await expect(page.locator('#hero-title')).toBeFocused();
});


test('开屏小鱼跳跃、水面四叶草和进入按钮互不干扰', async ({ page }) => {
  await page.goto('/');
  const fish = page.locator('.intro-swimmer').first();
  await expect(fish).toBeVisible();
  const box = await fish.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(fish).toHaveClass(/is-jumping/);
  await expect(page.locator('#studio-intro')).toBeVisible();
  const pond = await page.locator('.intro-pond').boundingBox();
  await page.touchscreen.tap(pond.x + pond.width / 2, pond.y + pond.height - 18);
  await expect(page.locator('.pond-clover')).toHaveCount(1);
  await expect(page.locator('#studio-intro')).toBeVisible();
  await noOverflow(page);
  await page.locator('#intro-enter').click();
  await expect(page.locator('#studio-intro')).not.toBeVisible();
  await expect(page.locator('.pond-effect')).toHaveCount(0);
});


test('开屏正圆水池、猫咪入口与自主跃鱼落水波纹', async ({ page }) => {
  // Advance animation frames deterministically, even on busy CI machines.
  await page.clock.install();
  await page.goto('/');
  const pond = await page.locator('.intro-pond').boundingBox();
  expect(Math.abs(pond.width - pond.height)).toBeLessThan(1);
  await expect(page.getByRole('button', { name: '开始摸鱼', exact: true }).locator('.intro-cat')).toBeVisible();
  await page.clock.runFor(5000);
  await expect(page.locator('.pond-droplets')).toHaveCount(1);
  await page.clock.runFor(750);
  await expect(page.locator('.pond-resonance')).toHaveCount(1);
  await expect(page.locator('.pond-surface-effects .pond-water-wave').first()).toBeVisible();
  await noOverflow(page);
  await page.locator('#intro-enter').click();
  await page.clock.runFor(400);
  await expect(page.locator('#studio-intro')).not.toBeVisible();
  await expect(page.locator('.pond-effect')).toHaveCount(0);
});
