/**
 * Service-worker based update manager.
 *
 * - Checks for a new version on start-up, periodically, when the app returns to
 *   the foreground and when the network comes back.
 * - A newly installed worker waits. It is only activated (followed by a reload)
 *   while the game reports a "safe" moment (title / character select / game
 *   over). It is never applied in the middle of a match or a winning streak.
 */
export class UpdateManager {
  constructor({
    swUrl = './sw.js',
    nav = typeof navigator !== 'undefined' ? navigator : null,
    win = typeof window !== 'undefined' ? window : null,
    doc = typeof document !== 'undefined' ? document : null,
    reload = () => win && win.location.reload(),
    onStatus = () => {},
    interval = 5 * 60 * 1000,
  } = {}) {
    this.swUrl = swUrl;
    this.nav = nav;
    this.win = win;
    this.doc = doc;
    this.reload = reload;
    this.onStatus = onStatus;
    this.interval = interval;
    this.safe = false;
    this.waiting = null;
    this.applying = false;
    this.reloadPending = false;
    this.registration = null;
    this.timer = null;
  }

  get supported() {
    return !!(this.nav && this.nav.serviceWorker);
  }

  async register() {
    if (!this.supported) return null;
    const sw = this.nav.serviceWorker;
    const reg = await sw.register(this.swUrl, { updateViaCache: 'none' });
    this.registration = reg;

    sw.addEventListener('controllerchange', () => {
      // A new worker took control. Reload only at a safe moment.
      if (this.hadController || this.applying) {
        this.reloadPending = true;
        this.tryApply();
      }
      this.hadController = true;
    });
    this.hadController = !!sw.controller;

    if (reg.waiting && sw.controller) this.setWaiting(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      if (!nw) return;
      this.onStatus('downloading');
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed' && sw.controller) this.setWaiting(nw);
      });
    });

    if (this.win) {
      this.timer = this.win.setInterval(() => this.check(), this.interval);
      this.win.addEventListener('online', () => this.check());
    }
    if (this.doc) {
      this.doc.addEventListener('visibilitychange', () => {
        if (this.doc.visibilityState === 'visible') this.check();
      });
    }
    return reg;
  }

  async check() {
    if (!this.registration) return false;
    try {
      await this.registration.update();
      this.onStatus('checked');
      return true;
    } catch {
      return false;
    }
  }

  setWaiting(worker) {
    this.waiting = worker;
    this.onStatus('ready');
    this.tryApply();
  }

  /** Called by the game whenever it enters/leaves a state where updating is OK. */
  setSafe(safe) {
    this.safe = !!safe;
    if (this.safe) {
      this.tryApply();
      // opportunistic check when returning to menus
      this.check();
    }
  }

  get hasUpdate() {
    return !!this.waiting || this.reloadPending;
  }

  tryApply() {
    if (!this.safe) return false;
    if (this.reloadPending) {
      this.reloadPending = false;
      this.onStatus('reloading');
      this.reload();
      return true;
    }
    if (this.waiting && !this.applying) {
      this.applying = true;
      this.onStatus('applying');
      this.waiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    }
    return false;
  }
}
