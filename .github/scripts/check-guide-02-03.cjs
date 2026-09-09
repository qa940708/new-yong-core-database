'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(process.env.RUNNER_TEMP, 'guide-browser/node_modules/playwright'));

(async () => {
  const out = path.join(process.env.RUNNER_TEMP, 'guide-check');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const missing = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('response', response => { if (response.status() >= 400) missing.push(response.status() + ' ' + response.url()); });
  const origin = 'http://127.0.0.1:8765';
  const manifest = JSON.parse(fs.readFileSync('assets/guide-media/guide-02-03-manifest.json', 'utf8'));
  const report = { release: manifest.release, guides: [], originalGuide: null, mobile: [], errorFallback: null };
  for (const guide of manifest.guides) {
    await page.goto(origin + '/' + guide.page);
    await page.waitForFunction(() => document.querySelector('#guide-video')?.readyState >= 1);
    assert.equal(await page.locator('.guide-nav a').first().innerText(), '功能導覽');
    assert.equal(await page.locator('.guide-series').first().locator('a').count(), 3);
    assert.equal(await page.locator('.guide-series').first().locator('a[aria-current="page"]').count(), 1);
    assert.equal(await page.locator('.chapter-button').count(), guide.chapters.length);
    const metadata = await page.locator('#guide-video').evaluate(video => ({
      src: video.currentSrc, poster: video.poster, duration: video.duration,
      width: video.videoWidth, height: video.videoHeight, controls: video.controls,
      playsInline: video.playsInline, autoplay: video.autoplay,
    }));
    assert(metadata.src.endsWith('/' + guide.video));
    assert(metadata.poster.endsWith('/' + guide.poster));
    assert(Math.abs(metadata.duration - guide.duration) < 0.1);
    assert.equal(metadata.width, guide.width);
    assert.equal(metadata.height, guide.height);
    assert.equal(metadata.controls, true);
    assert.equal(metadata.playsInline, true);
    assert.equal(metadata.autoplay, false);
    await page.locator('#guide-video').evaluate(async video => { video.muted = true; await video.play(); });
    await page.waitForFunction(() => document.querySelector('#guide-video').currentTime > 0.3);
    const chapters = [];
    for (const seek of guide.chapters) {
      await page.locator(`.chapter-button[data-seek="${seek}"]`).click();
      await page.waitForFunction(expected => {
        const video = document.querySelector('#guide-video');
        return video.currentTime >= expected + 0.1 && video.currentTime < expected + 3;
      }, seek);
      await page.locator('#guide-video').evaluate(video => video.pause());
      assert.equal(await page.locator(`.chapter-button[data-seek="${seek}"]`).getAttribute('aria-current'), 'step');
      chapters.push({ seek, playback: 'passed' });
    }
    await page.locator('#guide-video').evaluate(async video => { video.currentTime = video.duration - 0.6; await video.play(); });
    await page.waitForFunction(() => document.querySelector('#guide-video').ended, undefined, { timeout: 15000 });
    await page.locator('#guide-video').evaluate(video => { video.currentTime = 2.2; });
    await page.locator('img').evaluateAll(images => images.forEach(image => { image.loading = 'eager'; }));
    await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator('#guide-video-error').isVisible(), false);
    assert.equal(await page.locator('.player-meta a').getAttribute('href'), '../' + guide.video);
    await page.screenshot({ path: path.join(out, guide.id + '-desktop.png'), fullPage: true });
    report.guides.push({ id: guide.id, status: 'passed', metadata, chapters, endPlayback: 'passed', originalSha256: guide.sha256 });
    console.log('PASS:', guide.id, 'playback, all chapter jumps, video ending and images');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), guide.id + ': mobile horizontal overflow');
      if (width === 390) await page.screenshot({ path: path.join(out, guide.id + '-mobile.png'), fullPage: true });
      report.mobile.push({ id: guide.id, width, status: 'passed' });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto(origin + '/guide/');
  await page.waitForFunction(() => document.querySelector('#guide-video')?.readyState >= 1);
  assert.equal(await page.locator('.guide-series a').count(), 3);
  assert.equal(await page.locator('.chapter-button').count(), 4);
  assert.equal(await page.locator('.guide-nav a').first().innerText(), '功能導覽');
  assert((await page.locator('#guide-video').evaluate(video => video.currentSrc)).endsWith('/start-v1.mp4'));
  await page.locator('#guide-video').evaluate(async video => { video.muted = true; await video.play(); });
  await page.waitForFunction(() => document.querySelector('#guide-video').currentTime > 0.25);
  await page.locator('#guide-video').evaluate(video => video.pause());
  report.originalGuide = 'Original video, four chapter controls, series links and first navigation item passed';
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Original page mobile overflow');
  await page.screenshot({ path: path.join(out, 'guide-index-mobile.png'), fullPage: true });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  // Begin the deliberate network failure only after the deferred player listeners exist.
  await page.goto(origin + '/guide/travel.html');
  await page.waitForFunction(() => document.querySelector('#guide-video')?.readyState >= 1);
  let blockedRequests = 0;
  await page.route('**/travel-v3.mp4*', route => { blockedRequests += 1; return route.abort('failed'); });
  await page.locator('#guide-video').evaluate(video => {
    video.pause();
    video.muted = true;
    video.preload = 'auto';
    video.querySelector('source').src = '../assets/guide-media/travel-v3.mp4?test=deliberate-load-error';
    video.load();
    video.play().catch(() => {});
  });
  await page.waitForFunction(() => document.querySelector('#guide-video-error')?.hidden === false);
  assert(blockedRequests > 0, 'The failure test did not intercept a media request');
  await page.unroute('**/travel-v3.mp4*');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#guide-video')?.readyState >= 1);
  assert.equal(await page.locator('#guide-video-error').isVisible(), false);
  report.errorFallback = 'Actual media request blocked after initialization; load error shown; normal playback restored after reload';
  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);
  report.status = 'passed';
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log('PASS: both original MP4s, all 12 chapter jumps, video endings, images, downloads, mobile widths 320/390, original guide and error fallback.');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
