/**
 * Lock the viewport: no pinch zoom, no double-tap zoom, no scrolling/bounce,
 * no context menu / text selection, and keep the layout sized to the visible area.
 */
export function lockViewport(onResize) {
  const prevent = (e) => {
    if (e.cancelable) e.preventDefault();
  };
  // iOS Safari pinch gestures (ignores user-scalable=no)
  document.addEventListener('gesturestart', prevent, { passive: false });
  document.addEventListener('gesturechange', prevent, { passive: false });
  document.addEventListener('gestureend', prevent, { passive: false });
  // multi-finger touch zoom & scroll
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.cancelable) e.preventDefault();
    },
    { passive: false },
  );
  // double-tap zoom
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      const interactive = e.target && e.target.closest && e.target.closest('button, .card, #controls');
      if (now - lastTouchEnd < 350 && e.cancelable && !interactive) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false },
  );
  document.addEventListener('dblclick', prevent, { passive: false });
  document.addEventListener('contextmenu', prevent);
  // ctrl + wheel / ctrl + +/- zoom on desktop
  window.addEventListener('wheel', (e) => e.ctrlKey && prevent(e), { passive: false });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault();
  });

  const fix = () => {
    // keep the page pinned to the origin (iOS can scroll the layout viewport)
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    document.documentElement.style.setProperty('--vh', `${window.innerHeight}px`);
    onResize && onResize();
  };
  window.addEventListener('resize', fix);
  window.addEventListener('orientationchange', () => setTimeout(fix, 250));
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fix);
    window.visualViewport.addEventListener('scroll', () => window.scrollTo(0, 0));
  }
  fix();
}

/** Try to go fullscreen + lock landscape (Android Chrome). Silently ignored elsewhere. */
export async function tryFullscreenLandscape() {
  const el = document.documentElement;
  try {
    const standalone = window.matchMedia && window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
    if (!standalone && !document.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' });
    }
  } catch {
    /* not allowed */
  }
  try {
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
  } catch {
    /* not supported (iOS) */
  }
}
