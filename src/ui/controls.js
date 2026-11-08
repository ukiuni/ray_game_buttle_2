import { vectorToDir, BUTTONS } from '../game/input.js';

/**
 * Virtual joystick (left) + 4 attack buttons (right) with full multi-touch,
 * plus keyboard fallback for desktop.
 */
export class Controls {
  constructor(root = document) {
    this.stickZone = root.getElementById('stick-zone');
    this.base = root.getElementById('stick-base');
    this.knob = root.getElementById('stick-knob');
    this.buttonZone = root.getElementById('button-zone');
    this.btnEls = {};
    for (const b of BUTTONS) this.btnEls[b] = root.getElementById('btn-' + b);
    this.stick = { id: null, cx: 0, cy: 0, x: 0, y: 0 };
    this.btnPointers = new Map(); // pointerId -> Set(buttons)
    this.keys = new Set();
    this.enabled = true;
    this.bind();
  }

  bind() {
    const z = this.stickZone;
    z.addEventListener('pointerdown', (e) => this.stickDown(e));
    z.addEventListener('pointermove', (e) => this.stickMove(e));
    z.addEventListener('pointerup', (e) => this.stickUp(e));
    z.addEventListener('pointercancel', (e) => this.stickUp(e));
    z.addEventListener('lostpointercapture', (e) => this.stickUp(e));

    const bz = this.buttonZone;
    bz.addEventListener('pointerdown', (e) => this.btnDown(e));
    bz.addEventListener('pointermove', (e) => this.btnMove(e));
    bz.addEventListener('pointerup', (e) => this.btnUp(e));
    bz.addEventListener('pointercancel', (e) => this.btnUp(e));
    bz.addEventListener('lostpointercapture', (e) => this.btnUp(e));

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.reset());
  }

  reset() {
    this.keys.clear();
    this.btnPointers.clear();
    this.stick.id = null;
    this.stick.x = this.stick.y = 0;
    this.renderStick();
    this.renderButtons();
  }

  // ---------------------------------------------------------------- stick
  stickRadius() {
    return this.base.offsetWidth * 0.42 || 50;
  }

  stickDown(e) {
    e.preventDefault();
    if (this.stick.id !== null) return;
    this.stick.id = e.pointerId;
    try {
      this.stickZone.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    // floating stick: re-centre base on touch point (clamped inside the zone)
    const zr = this.stickZone.getBoundingClientRect();
    const size = this.base.offsetWidth || 130;
    const half = size / 2;
    const cx = Math.max(zr.left + half + 4, Math.min(zr.right - half - 4, e.clientX));
    const cy = Math.max(zr.top + half + 4, Math.min(zr.bottom - half - 4, e.clientY));
    this.base.style.left = `${cx - zr.left - half}px`;
    this.base.style.top = `${cy - zr.top - half}px`;
    this.base.style.bottom = 'auto';
    this.stick.cx = cx;
    this.stick.cy = cy;
    this.stickMove(e);
  }

  stickMove(e) {
    if (e.pointerId !== this.stick.id) return;
    e.preventDefault();
    const R = this.stickRadius();
    let dx = e.clientX - this.stick.cx;
    let dy = e.clientY - this.stick.cy;
    const m = Math.hypot(dx, dy);
    if (m > R) {
      dx = (dx / m) * R;
      dy = (dy / m) * R;
    }
    this.stick.x = dx / R;
    this.stick.y = -dy / R;
    this.renderStick();
  }

  stickUp(e) {
    if (e.pointerId !== this.stick.id) return;
    this.stick.id = null;
    this.stick.x = this.stick.y = 0;
    this.base.style.left = '';
    this.base.style.top = '';
    this.base.style.bottom = '';
    this.renderStick();
  }

  renderStick() {
    const R = this.stickRadius();
    this.knob.style.transform = `translate(${this.stick.x * R}px, ${-this.stick.y * R}px)`;
  }

  // ---------------------------------------------------------------- buttons
  /** Buttons under a screen point. Points near the HP/HK border press both (super). */
  buttonsAt(x, y) {
    const hit = new Set();
    const pad = 6;
    for (const b of BUTTONS) {
      const r = this.btnEls[b].getBoundingClientRect();
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) hit.add(b);
    }
    const hp = this.btnEls.HP.getBoundingClientRect();
    const hk = this.btnEls.HK.getBoundingClientRect();
    const midY = (hp.bottom + hk.top) / 2;
    if (x >= Math.min(hp.left, hk.left) && x <= Math.max(hp.right, hk.right) && Math.abs(y - midY) < 14) {
      hit.add('HP');
      hit.add('HK');
    }
    if (hit.size === 0) {
      // nearest button as a forgiving fallback
      let best = null;
      let bd = Infinity;
      for (const b of BUTTONS) {
        const r = this.btnEls[b].getBoundingClientRect();
        const d = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (best) hit.add(best);
    }
    return hit;
  }

  btnDown(e) {
    e.preventDefault();
    try {
      this.buttonZone.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.btnPointers.set(e.pointerId, this.buttonsAt(e.clientX, e.clientY));
    this.renderButtons();
    if (navigator.vibrate) {
      try {
        navigator.vibrate(8);
      } catch {
        /* ignore */
      }
    }
  }

  btnMove(e) {
    if (!this.btnPointers.has(e.pointerId)) return;
    e.preventDefault();
    const next = this.buttonsAt(e.clientX, e.clientY);
    this.btnPointers.set(e.pointerId, next);
    this.renderButtons();
  }

  btnUp(e) {
    if (!this.btnPointers.has(e.pointerId)) return;
    this.btnPointers.delete(e.pointerId);
    this.renderButtons();
  }

  heldButtons() {
    const held = new Set();
    for (const s of this.btnPointers.values()) for (const b of s) held.add(b);
    return held;
  }

  renderButtons() {
    const held = this.heldButtons();
    for (const b of BUTTONS) this.btnEls[b].classList.toggle('down', held.has(b));
  }

  // ---------------------------------------------------------------- output
  /** Raw screen-relative input for this frame. */
  getInput() {
    const k = this.keys;
    let x = this.stick.x;
    let y = this.stick.y;
    if (k.has('ArrowLeft') || k.has('KeyA')) x = -1;
    if (k.has('ArrowRight') || k.has('KeyD')) x = 1;
    if (k.has('ArrowUp') || k.has('KeyW')) y = 1;
    if (k.has('ArrowDown') || k.has('KeyS')) y = -1;
    const dir = this.enabled ? vectorToDir(x, y, 0.32) : 5;
    const held = this.heldButtons();
    const kb = {
      LP: k.has('KeyU') || k.has('KeyZ'),
      HP: k.has('KeyI') || k.has('KeyX'),
      LK: k.has('KeyJ') || k.has('KeyC'),
      HK: k.has('KeyK') || k.has('KeyV'),
    };
    const out = { dir };
    for (const b of BUTTONS) out[b] = this.enabled && (held.has(b) || kb[b]);
    return out;
  }
}
