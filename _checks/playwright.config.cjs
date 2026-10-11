const path = require('node:path');
const { defineConfig } = require('@playwright/test');
const site = path.resolve(process.env.SITE_DIR || path.join(__dirname, '../_site'));

// Run after the production build: npm run test:browser --prefix _checks
// SITE_DIR can point to another production build; no tests target the live website.

module.exports = defineConfig({
  testDir: './browser',
  timeout: 60000,
  expect: { timeout: 7000 },
  fullyParallel: true,
  workers: 2,
  retries: 0,
  forbidOnly: !!process.env.CI,
  outputDir: './test-results',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    actionTimeout: 7000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-320', use: { browserName: 'chromium', viewport: { width: 320, height: 780 } } },
    { name: 'chromium-390', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'webkit-390', use: { browserName: 'webkit', viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: `python "${path.join(__dirname, 'serve.py')}" --directory "${site}"`,
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'ignore',
    timeout: 30000,
  },
});
