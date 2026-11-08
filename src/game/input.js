// Input representation and motion-command detection.
// Directions use numpad notation relative to the screen:
//   7 8 9
//   4 5 6
//   1 2 3
// Fighters convert to "forward/back" relative notation using their facing.

export const BUTTONS = ['LP', 'HP', 'LK', 'HK'];

export function emptyInput() {
  return { dir: 5, LP: false, HP: false, LK: false, HK: false };
}

/** Convert an analogue vector (x right, y up, both -1..1) into a numpad direction. */
export function vectorToDir(x, y, dead = 0.3) {
  const mag = Math.hypot(x, y);
  if (mag < dead) return 5;
  const ang = Math.atan2(y, x); // 0 = right, pi/2 = up
  const sector = Math.round(ang / (Math.PI / 4)); // -4..4
  switch (((sector % 8) + 8) % 8) {
    case 0: return 6;
    case 1: return 9;
    case 2: return 8;
    case 3: return 7;
    case 4: return 4;
    case 5: return 1;
    case 6: return 2;
    case 7: return 3;
    default: return 5;
  }
}

/** Mirror a screen direction horizontally (used when facing left). */
export function mirrorDir(d) {
  return { 1: 3, 3: 1, 4: 6, 6: 4, 7: 9, 9: 7 }[d] || d;
}

export function dirX(d) {
  if (d === 1 || d === 4 || d === 7) return -1;
  if (d === 3 || d === 6 || d === 9) return 1;
  return 0;
}
export function dirY(d) {
  if (d >= 7) return 1;
  if (d <= 3) return -1;
  return 0;
}

const MOTIONS = {
  // ordered from most specific to least, so 623 beats 236 when both match
  RISING: [6, 2, 3],
  FIREBALL: [2, 3, 6],
  RUSH: [2, 1, 4],
};

export class InputBuffer {
  constructor(size = 40) {
    this.size = size;
    this.frames = []; // {dir (relative), pressed:{}, held:{}}
    this.prevHeld = { LP: false, HP: false, LK: false, HK: false };
  }

  /** Push a raw screen input; facing = 1 (right) or -1 (left). Returns the processed frame. */
  push(raw, facing) {
    const dir = facing === 1 ? raw.dir : mirrorDir(raw.dir);
    const pressed = {};
    const held = {};
    for (const b of BUTTONS) {
      held[b] = !!raw[b];
      pressed[b] = held[b] && !this.prevHeld[b];
    }
    this.prevHeld = held;
    const f = { dir, pressed, held };
    this.frames.push(f);
    if (this.frames.length > this.size) this.frames.shift();
    return f;
  }

  last() {
    return this.frames[this.frames.length - 1] || { dir: 5, pressed: {}, held: {} };
  }

  /** Was the given button newly pressed within the last `window` frames? */
  pressedWithin(button, window = 1) {
    const n = this.frames.length;
    for (let i = n - 1; i >= Math.max(0, n - window); i--) {
      if (this.frames[i].pressed[button]) return true;
    }
    return false;
  }

  /**
   * Detect a motion sequence (relative dirs) completed within `window` frames,
   * ending no earlier than `lateness` frames ago.
   */
  hasMotion(seq, window = 20, lateness = 8) {
    const n = this.frames.length;
    const start = Math.max(0, n - window);
    let idx = seq.length - 1;
    // walk backwards finding the sequence in reverse
    for (let i = n - 1; i >= start && idx >= 0; i--) {
      const d = this.frames[i].dir;
      if (matchDir(d, seq[idx])) {
        if (idx === seq.length - 1 && n - 1 - i > lateness) return false;
        idx--;
      }
    }
    return idx < 0;
  }

  /** Return name of special motion detected (or null). */
  detectSpecial() {
    const d = this.last().dir;
    // When the stick is currently forward, a 236 is far more likely than 623.
    const order = d === 6 || d === 9 ? ['FIREBALL', 'RISING', 'RUSH'] : ['RISING', 'FIREBALL', 'RUSH'];
    for (const name of order) {
      if (this.hasMotion(MOTIONS[name])) return name;
    }
    return null;
  }

  clearMotion() {
    // prevent the same motion being re-used by subsequent presses
    for (const f of this.frames) f.dir = 5;
  }
}

function matchDir(actual, wanted) {
  if (actual === wanted) return true;
  // lenient: accept 1/3 as 2 for down, 9/3 as 6 for forward, etc. only for the
  // final cardinal direction to make touch input forgiving
  if (wanted === 6) return actual === 6 || actual === 9;
  if (wanted === 4) return actual === 4 || actual === 7;
  return false;
}

export { MOTIONS };
