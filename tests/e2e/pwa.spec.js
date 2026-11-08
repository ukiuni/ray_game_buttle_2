import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { gotoTitle, startFight } from './helpers.js';

const SW = new URL('../../dist/sw.js', import.meta.url).pathname;

test.describe('PWA', () => {
  // service-worker behaviour is checked in Chromium (Android) only; Playwright's WebKit lacks SW support
  test.skip(({ browserName }) => browserName !== 'chromium', 'service workers tested in chromium');

  test('installable manifest + service worker + offline play', async ({ page, context }) => {
    await gotoTitle(page);
    const manifest = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    await page.waitForFunction(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return !!(r && r.active) && !!navigator.serviceWorker.controller;
    }, null, { timeout: 30_000 }).catch(async () => {
      // first load is not controlled yet: reload once
      await page.reload();
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30_000 });
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.__rgb2 && window.__rgb2.screen === 'title', null, { timeout: 30_000 });
    await context.setOffline(false);
  });

  test('a new version is not applied during a fight, but is applied at a menu', async ({ page }) => {
    const original = readFileSync(SW, 'utf8');
    try {
      await gotoTitle(page);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30_000 }).catch(() => page.reload());
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30_000 });
      await page.waitForFunction(() => window.__rgb2 && window.__rgb2.screen === 'title');
      await startFight(page, 'kaen');
      await page.evaluate(() => (window.__marker = 'same-page'));
      // deploy a "new version"
      writeFileSync(SW, original.replace(/const VERSION = "([0-9a-f]+)"/, 'const VERSION = "$1-next"'));
      await page.evaluate(() => window.__rgb2.updater.check());
      await page.waitForFunction(() => window.__rgb2.updater.hasUpdate, null, { timeout: 30_000 });
      await page.waitForTimeout(1500);
      // still the same page, still fighting
      expect(await page.evaluate(() => [window.__marker, window.__rgb2.screen])).toEqual(['same-page', 'fight']);
      // finish the run (lose) -> game over is a safe point -> update + reload
      for (let r = 0; r < 2; r++) {
        await page.waitForFunction(() => window.__rgb2.match && window.__rgb2.match.phase === 'fight', null, { timeout: 20_000 });
        await page.evaluate(() => window.__rgb2.koSide(0));
      }
      await page.waitForFunction(() => window.__marker !== 'same-page', null, { timeout: 30_000 });
      await page.waitForFunction(() => window.__rgb2 && window.__rgb2.screen === 'title', null, { timeout: 30_000 });
    } finally {
      writeFileSync(SW, original);
    }
  });
});
