import { describe, it, expect, vi } from 'vitest';
import { UpdateManager } from '../../src/update.js';

class Emitter {
  constructor() {
    this.l = {};
  }
  addEventListener(t, f) {
    (this.l[t] ||= []).push(f);
  }
  emit(t) {
    for (const f of this.l[t] || []) f();
  }
}

function setup({ controller = true } = {}) {
  const sw = new Emitter();
  sw.controller = controller ? {} : null;
  const reg = new Emitter();
  reg.update = vi.fn(async () => {});
  reg.waiting = null;
  sw.register = vi.fn(async () => reg);
  const nav = { serviceWorker: sw };
  const reload = vi.fn();
  const statuses = [];
  const win = new Emitter();
  win.setInterval = vi.fn(() => 1);
  const doc = new Emitter();
  doc.visibilityState = 'visible';
  const um = new UpdateManager({ nav, win, doc, reload, onStatus: (s) => statuses.push(s) });
  return { um, sw, reg, reload, statuses, win, doc };
}

function newWorker(reg, sw) {
  const w = new Emitter();
  w.state = 'installing';
  w.postMessage = vi.fn();
  reg.installing = w;
  reg.emit('updatefound');
  w.state = 'installed';
  w.emit('statechange');
  return w;
}

describe('update manager', () => {
  it('registers and checks periodically / on visibility / online', async () => {
    const { um, reg, win, doc } = setup();
    await um.register();
    expect(win.setInterval).toHaveBeenCalled();
    doc.emit('visibilitychange');
    win.emit('online');
    expect(reg.update).toHaveBeenCalledTimes(2);
  });

  it('never applies an update during a match', async () => {
    const { um, sw, reg, reload } = setup();
    await um.register();
    um.setSafe(false); // fighting
    const w = newWorker(reg, sw);
    expect(um.hasUpdate).toBe(true);
    expect(w.postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    // match ends -> back at a menu
    um.setSafe(true);
    expect(w.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    sw.emit('controllerchange');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('applies immediately when already at a safe screen', async () => {
    const { um, sw, reg, reload } = setup();
    await um.register();
    um.setSafe(true);
    const w = newWorker(reg, sw);
    expect(w.postMessage).toHaveBeenCalled();
    sw.emit('controllerchange');
    expect(reload).toHaveBeenCalled();
  });

  it('defers a reload triggered elsewhere until it is safe', async () => {
    const { um, sw, reload } = setup();
    await um.register();
    um.setSafe(false);
    sw.emit('controllerchange');
    expect(reload).not.toHaveBeenCalled();
    um.setSafe(true);
    expect(reload).toHaveBeenCalled();
  });

  it('does not treat the very first install as an update', async () => {
    const { um, sw, reg, reload } = setup({ controller: false });
    await um.register();
    um.setSafe(true);
    const w = newWorker(reg, sw);
    expect(w.postMessage).not.toHaveBeenCalled();
    sw.emit('controllerchange');
    expect(reload).not.toHaveBeenCalled();
  });
});
