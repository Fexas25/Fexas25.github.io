const {expect}=require('@playwright/test');
exports.reveal=async page=>{await page.locator('#view-key').click();await page.locator('#key-password').fill('test-confirm');await page.locator('#key-submit').click();await expect(page.locator('#share-key')).not.toHaveValue('');return page.locator('#share-key').inputValue();};
