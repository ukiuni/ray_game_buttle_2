import { test, expect } from '@playwright/test';
import { gotoTitle, startFight, touch, center, T } from './helpers.js';

test('boots to the title screen with WebGL rendering and no errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await gotoTitle(page);
  await expect(page.locator('#start-btn')).toBeVisible();
  const gl = await page.evaluate(() => !!window.__rgb2.renderer.renderer.getContext());
  expect(gl).toBe(true);
  expect(errors).toEqual([]);
});

test('viewport is fixed (no zoom / no scroll)', async ({ page }) => {
  await gotoTitle(page);
  const meta = await page.getAttribute('meta[name="viewport"]', 'content');
  expect(meta).toContain('user-scalable=no');
  expect(meta).toContain('maximum-scale=1');
  const css = await page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return { touch: s.touchAction, overflow: s.overflow, position: s.position };
  });
  expect(css.touch).toBe('none');
  expect(css.overflow).toBe('hidden');
  expect(css.position).toBe('fixed');
  // double tap on the background must not zoom
  await page.touchscreen.tap(20, 20);
  await page.touchscreen.tap(20, 20);
  const scale = await page.evaluate(() => (window.visualViewport ? window.visualViewport.scale : 1));
  expect(scale).toBe(1);
  const scroll = await page.evaluate(() => [window.scrollX, window.scrollY]);
  expect(scroll).toEqual([0, 0]);
});

test('character select shows 3 characters with pixel-art portraits', async ({ page }) => {
  await gotoTitle(page);
  await page.locator('#start-btn').tap({ force: true });
  await expect(page.locator('.card')).toHaveCount(3);
  for (const id of ['kaen', 'raiga', 'hyoka']) {
    await page.locator(`.card[data-id="${id}"]`).tap({ force: true });
    await expect(page.locator('#char-info .cname')).toHaveText(id.toUpperCase());
    const loaded = await page.locator(`.card[data-id="${id}"] img`).evaluate((img) => img.complete && img.naturalWidth > 0);
    expect(loaded).toBe(true);
  }
});

test('joystick on the left moves the fighter, 4 buttons on the right attack', async ({ page }) => {
  await startFight(page, 'kaen');
  const vp = page.viewportSize();
  // layout: joystick in the left half, all four buttons in the right half
  const stick = await center(page, '#stick-base');
  expect(stick.x).toBeLessThan(vp.width / 2);
  for (const b of ['LP', 'HP', 'LK', 'HK']) {
    const c = await center(page, `#btn-${b}`);
    expect(c.x).toBeGreaterThan(vp.width / 2);
  }
  await page.evaluate(() => {
    window.__rgb2.match.f[1].x = 3; // keep the CPU out of the way
  });
  const x0 = await page.evaluate(() => window.__rgb2.match.f[0].x);
  await touch(page, '#stick-zone', 'pointerdown', stick.x, stick.y);
  await touch(page, '#stick-zone', 'pointermove', stick.x + 60, stick.y);
  await page.waitForFunction((x0) => window.__rgb2.match.f[0].x > x0 + 0.1, x0, { timeout: T });
  await touch(page, '#stick-zone', 'pointerup', stick.x + 60, stick.y);
  const x1 = await page.evaluate(() => window.__rgb2.match.f[0].x);
  expect(x1).toBeGreaterThan(x0 + 0.1);

  for (const b of ['LP', 'HP', 'LK', 'HK']) {
    await page.waitForFunction(() => window.__rgb2.match.f[0].actionable, null, { timeout: T });
    await page.evaluate(() => (window.__rgb2.match.f[0].lastMove = null));
    const c = await center(page, `#btn-${b}`);
    // hold the stick neutral and press the button with a second finger
    await touch(page, '#button-zone', 'pointerdown', c.x, c.y, 2);
    const started = await page.waitForFunction((b) => window.__rgb2.match.f[0].lastMove === b, b, { timeout: T }).then(() => true, () => false);
    await touch(page, '#button-zone', 'pointerup', c.x, c.y, 2);
    expect(started, `button ${b}`).toBe(true);
  }
});

test('multi-touch: move and attack at the same time', async ({ page }) => {
  await startFight(page, 'raiga');
  const stick = await center(page, '#stick-base');
  const hp = await center(page, '#btn-HP');
  await touch(page, '#stick-zone', 'pointerdown', stick.x, stick.y, 1);
  await touch(page, '#stick-zone', 'pointermove', stick.x, stick.y + 60, 1); // crouch
  await page.waitForFunction(() => window.__rgb2.match.f[0].state === 'crouch', null, { timeout: T });
  await touch(page, '#button-zone', 'pointerdown', hp.x, hp.y, 2);
  const crouchAttack = await page.waitForFunction(() => window.__rgb2.match.f[0].lastMove === 'cHP', null, { timeout: T }).then(() => true, () => false);
  await touch(page, '#button-zone', 'pointerup', hp.x, hp.y, 2);
  await touch(page, '#stick-zone', 'pointerup', stick.x, stick.y + 60, 1);
  expect(crouchAttack).toBe(true);
});

test('winning automatically starts the next stage until the player loses', async ({ page }) => {
  await startFight(page, 'hyoka');
  const stage1 = await page.evaluate(() => [window.__rgb2.run.stage, window.__rgb2.run.opponentId]);
  expect(stage1).toEqual([1, 'kaen']);
  // win two rounds
  for (let r = 0; r < 2; r++) {
    await page.waitForFunction(() => window.__rgb2.match.phase === 'fight', null, { timeout: T });
    await page.evaluate(() => window.__rgb2.koSide(1));
  }
  await page.waitForFunction(() => window.__rgb2.screen === 'result', null, { timeout: T });
  await expect(page.locator('#result-streak')).toContainText('1連勝');
  await expect(page.locator('#auto-count')).toBeVisible();
  // no tap: it must continue on its own to stage 2
  await page.waitForFunction(() => window.__rgb2.screen === 'vs' || window.__rgb2.screen === 'fight', null, { timeout: T });
  const stage2 = await page.evaluate(() => [window.__rgb2.run.stage, window.__rgb2.run.opponentId]);
  expect(stage2).toEqual([2, 'raiga']);
  await page.waitForFunction(() => window.__rgb2.screen === 'fight', null, { timeout: T });
  // now lose: game over, no auto continue
  for (let r = 0; r < 2; r++) {
    await page.waitForFunction(() => window.__rgb2.match.phase === 'fight', null, { timeout: T });
    await page.evaluate(() => window.__rgb2.koSide(0));
  }
  await page.waitForFunction(() => window.__rgb2.screen === 'gameover', null, { timeout: T });
  await expect(page.locator('#gameover-streak')).toContainText('1連勝');
  await page.waitForTimeout(6500);
  expect(await page.evaluate(() => window.__rgb2.screen)).toBe('gameover');
});

test('pause and resume', async ({ page }) => {
  await startFight(page, 'kaen');
  await page.locator('#pause-btn').tap({ force: true });
  await page.waitForFunction(() => window.__rgb2.screen === 'pause');
  const t0 = await page.evaluate(() => window.__rgb2.match.timer);
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__rgb2.match.timer)).toBe(t0);
  await page.locator('#resume-btn').tap({ force: true });
  await page.waitForFunction(() => window.__rgb2.screen === 'fight');
});

test('portrait orientation shows the rotate notice', async ({ page }) => {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: Math.min(vp.width, vp.height), height: Math.max(vp.width, vp.height) });
  await gotoTitle(page);
  await expect(page.locator('#rotate')).toBeVisible();
});
