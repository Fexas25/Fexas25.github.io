const {test,expect}=require('@playwright/test');
test.beforeEach(async({page})=>{await page.addInitScript(()=>sessionStorage.setItem('mx-studio-intro-seen-v2','1'));});
test('音乐按需加载、暂停续播、切歌和手机卡片',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let requests=0;
 page.on('request',r=>{if(r.url().includes('/assets/music/'))requests++;});
 await page.goto('/about/');const root=page.locator('[data-music-player]'),audio=root.locator('audio');
 const tracks=await root.locator('[data-music-tracks]').evaluate(el=>JSON.parse(el.textContent));
 expect(requests).toBe(0);await expect(audio).not.toHaveAttribute('src');
 await root.locator('.music-toggle').click();await expect(root.locator('.music-panel')).toBeVisible();expect(requests).toBe(0);
 await root.locator('[data-music-play]').click();
 await expect.poll(()=>audio.evaluate(el=>!el.paused&&el.currentTime>0)).toBe(true);
 await expect(root).toHaveClass(/is-playing/);
 await root.locator('[data-music-play]').click();const position=await audio.evaluate(el=>el.currentTime);
 await expect.poll(()=>audio.evaluate(el=>el.paused)).toBe(true);
 await root.locator('[data-music-play]').click();await expect.poll(()=>audio.evaluate(el=>el.currentTime)).toBeGreaterThan(position);
 await root.locator('[data-music-next]').click();await expect(root.locator('[data-music-title]')).toHaveText(tracks[1].title);
 await expect.poll(()=>audio.evaluate(el=>!el.paused&&el.currentTime>0)).toBe(true);
 await root.locator('[data-music-play]').click();await root.locator('[data-music-prev]').click();await root.locator('[data-music-prev]').click();
 await expect(root.locator('[data-music-title]')).toHaveText(tracks.at(-1).title);expect(await audio.evaluate(el=>el.paused)).toBe(true);
 await audio.evaluate(el=>el.dispatchEvent(new Event('ended')));await expect(root.locator('[data-music-title]')).toHaveText(tracks[0].title);
 await expect.poll(()=>audio.evaluate(el=>!el.paused)).toBe(true);
 // Wait for the new track and native seek before testing persisted playback.
 await expect.poll(()=>audio.evaluate(el=>el.readyState>=1)).toBe(true);
 await audio.evaluate(el=>{el.currentTime=12;});
 await expect.poll(()=>audio.evaluate(el=>!el.seeking&&el.currentTime>=11)).toBe(true);
 await page.evaluate(()=>{const v=document.createElement('video');document.body.append(v);v.dispatchEvent(new Event('play'));});await expect.poll(()=>audio.evaluate(el=>el.paused)).toBe(true);
 const box=await root.locator('.music-panel').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize().width);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
 await page.keyboard.press('Escape');await expect(root.locator('.music-panel')).toBeHidden();await expect(root.locator('.music-toggle')).toBeFocused();
 await page.goto('/blog/');await expect(page.locator('[data-music-title]')).toHaveText(tracks[0].title);expect(await page.locator('[data-music-audio]').evaluate(el=>el.paused)).toBe(true);
 await page.locator('.music-toggle').click();await page.locator('[data-music-play]').click();await expect.poll(()=>page.locator('[data-music-audio]').evaluate(el=>el.currentTime)).toBeGreaterThan(11);
 expect(errors).toEqual([]);
});
test('英文控制名称、播放失败重试和收起后继续播放',async({page,browserName})=>{
 // WebKit's native media loader can bypass Playwright network interception.
 // Its successful playback is real above; inject one play rejection for retry.
 if(browserName==='webkit')await page.addInitScript(()=>{const original=HTMLMediaElement.prototype.play;let fail=true;HTMLMediaElement.prototype.play=function(){if(fail){fail=false;return Promise.reject(new DOMException('Unavailable','NotSupportedError'));}return original.call(this);};});
 else await page.route('**/assets/music/**',r=>r.abort());
 await page.goto('/about/?lang=en');const root=page.locator('[data-music-player]');
 await root.locator('.music-toggle').click();await expect(root.locator('[data-music-next]')).toHaveAttribute('aria-label','Next track');
 await root.locator('[data-music-play]').click();await expect(root.locator('[role=status]')).toContainText('Could not play');
 await page.unroute('**/assets/music/**');await root.locator('[data-music-play]').click();
 await expect.poll(()=>root.locator('audio').evaluate(el=>!el.paused&&el.currentTime>0)).toBe(true);
 await root.locator('.music-toggle').click();await expect(root.locator('.music-panel')).toBeHidden();expect(await root.locator('audio').evaluate(el=>el.paused)).toBe(false);
});

test('音乐测试服务器支持原生播放器的字节范围请求',async({request})=>{
 const html=await(await request.get('/about/')).text();const src=JSON.parse(html.match(/data-music-tracks[^>]*>([\s\S]*?)<\/script>/)[1])[0].src;
 const response=await request.get(src,{headers:{Range:'bytes=-8'}});expect(response.status()).toBe(206);expect(response.headers()['content-range']).toMatch(/^bytes \d+-\d+\/\d+$/);expect((await response.body()).length).toBe(8);
 const bad=await request.get(src,{headers:{Range:'bytes=999999999-'}});expect(bad.status()).toBe(416);
});
