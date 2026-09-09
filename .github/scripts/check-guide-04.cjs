'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.RUNNER_TEMP, 'guide-browser/node_modules/playwright'));
const base = process.env.GUIDE_BASE_URL || 'http://127.0.0.1:8765/';
const out = path.join(process.env.RUNNER_TEMP, process.env.GUIDE_REPORT_DIR || 'guide-04-check');
fs.mkdirSync(out, { recursive: true });
const report = { base, status: 'running', chapter_checks: [], layouts: [], earlier_guides: [] };

(async () => {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}),
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('response', response => {
    if (response.status() >= 400 && response.url().startsWith(base))
      errors.push(response.status() + ' ' + response.url());
  });
  async function load(relative) {
    const response = await page.goto(new URL(relative + '?release=guide-04-v2&check=' + Date.now(), base).href,
      { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.equal(response.status(), 200);
    await page.waitForFunction(() => {
      const v = document.querySelector('#guide-video');
      return v && v.readyState >= 2 && Number.isFinite(v.duration) && !v.error;
    });
    assert.equal(await page.locator('.guide-nav > a').first().innerText(), '功能導覽');
    assert.equal(await page.locator('.guide-series').first().locator('a').count(), 4);
    assert.equal(await page.locator('.guide-series').first().locator('a[href="./core.html"]').count(), 1);
  }
  try {
    await load('guide/core.html');
    assert.match(await page.title(), /遊玩指南 04・裝備核心/);
    assert.equal(await page.locator('.guide-series').first().locator('a[aria-current="page"]').getAttribute('href'), './core.html');
    const media = await page.locator('#guide-video').evaluate(v => ({duration: v.duration, width: v.videoWidth,
      height: v.videoHeight, controls: v.controls, muted: v.muted, source: v.currentSrc, tracks: v.textTracks.length}));
    assert.ok(Math.abs(media.duration - 79.3) < .1);
    assert.equal(media.width, 1040); assert.equal(media.height, 848);
    assert.equal(media.controls, true); assert.equal(media.muted, false);
    assert.ok(media.source.endsWith('/assets/guide-media/core-v2.mp4'));
    assert.equal(media.tracks, 0, 'Burned subtitles must not be duplicated');
    report.media = media;
    await page.locator('.restart-video').click();
    await page.waitForFunction(() => document.querySelector('#guide-video').currentTime > 0.8);
    report.playback = await page.locator('#guide-video').evaluate(v => ({
      currentTime: v.currentTime, paused: v.paused,
      decodedVideoFrames: v.getVideoPlaybackQuality().totalVideoFrames,
      decodedAudioBytes: typeof v.webkitAudioDecodedByteCount === 'number' ? v.webkitAudioDecodedByteCount : null
    }));
    assert.equal(report.playback.paused, false);
    assert.ok(report.playback.decodedVideoFrames > 0);
    if (report.playback.decodedAudioBytes !== null) assert.ok(report.playback.decodedAudioBytes > 0);
    const expected = [0, 4.5, 13, 24, 39, 55, 67];
    const buttons = page.locator('.chapter-button');
    assert.equal(await buttons.count(), expected.length);
    for (let index = 0; index < expected.length; index++) {
      const button = buttons.nth(index);
      const start = Number(await button.getAttribute('data-seek'));
      const end = Number(await button.getAttribute('data-end'));
      assert.equal(start, expected[index]);
      await button.click();
      await page.waitForFunction(({ start, end }) => {
        const v = document.querySelector('#guide-video');
        return !v.paused && !v.seeking && v.currentTime >= start && v.currentTime < end;
      }, { start, end });
      await page.waitForTimeout(250);
      assert.equal(await button.getAttribute('aria-current'), 'step');
      const actual = await page.locator('#guide-video').evaluate(v => { v.pause(); return v.currentTime; });
      assert.ok(actual >= start && actual < end);
      report.chapter_checks.push({ title: await button.locator('strong').innerText(), target: start, actual, status: 'passed' });
    }
    await page.locator('.restart-video').click();
    await page.waitForFunction(() => document.querySelector('#guide-video').currentTime < 2);
    await page.locator('#guide-video').evaluate(v => v.pause());
    await page.locator('img').evaluateAll(images => images.forEach(image => image.loading = 'eager'));
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator('#guide-video-error').isVisible(), false);
    for (const width of [1440, 768, 390, 360]) {
      await page.setViewportSize({ width, height: width > 800 ? 1000 : 844 });
      await page.waitForTimeout(200);
      const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(layout.scrollWidth <= layout.width + 1, 'Horizontal overflow at ' + width);
      report.layouts.push({ ...layout, status: 'passed' });
      if (width === 1440 || width === 390) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: path.join(out, 'core-' + width + '.png'), fullPage: true });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const [relative, source] of [['guide/', 'start-v1.mp4'], ['guide/travel.html', 'travel-v3.mp4'], ['guide/collection.html', 'collection-v2.mp4']]) {
      await load(relative);
      assert.ok((await page.locator('#guide-video').evaluate(v => v.currentSrc)).endsWith('/' + source));
      await page.locator('.restart-video').click();
      await page.waitForFunction(() => { const v = document.querySelector('#guide-video'); return !v.paused && v.currentTime > .4; });
      await page.locator('#guide-video').evaluate(v => v.pause());
      report.earlier_guides.push({ page: relative, video: source, playback: 'passed', equipment_core_link: 'present' });
    }
    assert.deepEqual(errors, []);
    report.status = 'passed';
    console.log('BROWSER VERIFIED: exact core-video source, real video/audio decoding, all 7 chapter jumps, four viewport widths, and all 3 previous guides');
  } catch (error) {
    report.status = 'failed'; report.error = String(error); report.page_errors = errors;
    await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    fs.writeFileSync(path.join(out, 'browser-report.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
