// CI runners render WebGL in software, so the game runs slower than real time there.
export const T = process.env.CI ? 120_000 : 20_000;

export async function gotoTitle(page) {
  await page.goto('./?test=1');
  await page.waitForFunction(() => window.__rgb2 && window.__rgb2.screen === 'title', null, { timeout: T * 2 });
}

export async function startFight(page, charId = 'kaen') {
  await gotoTitle(page);
  await page.locator('#start-btn').tap({ force: true });
  await page.waitForFunction(() => window.__rgb2.screen === 'select');
  await page.locator(`.card[data-id="${charId}"]`).tap({ force: true });
  await page.locator('#select-ok').tap({ force: true });
  await page.waitForFunction(() => window.__rgb2.screen === 'fight', null, { timeout: T });
  await page.waitForFunction(() => window.__rgb2.match.phase === 'fight', null, { timeout: T });
}

/** Dispatch a touch-like pointer sequence at screen coordinates. */
export async function touch(page, selector, type, x, y, id = 1) {
  await page.evaluate(
    ({ selector, type, x, y, id }) => {
      const el = document.querySelector(selector);
      el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1 }));
    },
    { selector, type, x, y, id },
  );
}

export async function center(page, selector) {
  const b = await page.locator(selector).boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
