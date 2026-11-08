import { describe, it, expect } from 'vitest';
import { InputBuffer, vectorToDir, mirrorDir, emptyInput } from '../../src/game/input.js';

const feed = (buf, dirs, facing = 1, last = {}) => {
  dirs.forEach((d, i) => buf.push({ ...emptyInput(), dir: d, ...(i === dirs.length - 1 ? last : {}) }, facing));
};

describe('joystick to direction', () => {
  it('maps vectors to numpad directions', () => {
    expect(vectorToDir(0, 0)).toBe(5);
    expect(vectorToDir(0.1, 0.1)).toBe(5);
    expect(vectorToDir(1, 0)).toBe(6);
    expect(vectorToDir(-1, 0)).toBe(4);
    expect(vectorToDir(0, 1)).toBe(8);
    expect(vectorToDir(0, -1)).toBe(2);
    expect(vectorToDir(0.7, 0.7)).toBe(9);
    expect(vectorToDir(-0.7, -0.7)).toBe(1);
    expect(vectorToDir(0.7, -0.7)).toBe(3);
  });
  it('mirrors directions', () => {
    expect(mirrorDir(6)).toBe(4);
    expect(mirrorDir(3)).toBe(1);
    expect(mirrorDir(8)).toBe(8);
  });
});

describe('motion commands', () => {
  it('detects quarter circle forward (236)', () => {
    const b = new InputBuffer();
    feed(b, [5, 2, 2, 3, 3, 6, 6]);
    expect(b.detectSpecial()).toBe('FIREBALL');
  });
  it('detects 236 while facing left using mirrored input (214 on screen)', () => {
    const b = new InputBuffer();
    feed(b, [5, 2, 1, 4], -1);
    expect(b.detectSpecial()).toBe('FIREBALL');
  });
  it('detects dragon punch (623)', () => {
    const b = new InputBuffer();
    feed(b, [5, 6, 2, 3]);
    expect(b.detectSpecial()).toBe('RISING');
  });
  it('detects quarter circle back (214)', () => {
    const b = new InputBuffer();
    feed(b, [5, 2, 1, 4]);
    expect(b.detectSpecial()).toBe('RUSH');
  });
  it('prefers fireball when walking forward then doing 236', () => {
    const b = new InputBuffer();
    feed(b, [6, 6, 6, 2, 3, 6]);
    expect(b.detectSpecial()).toBe('FIREBALL');
  });
  it('ignores stale motions', () => {
    const b = new InputBuffer();
    feed(b, [2, 3, 6, ...Array(20).fill(5)]);
    expect(b.detectSpecial()).toBe(null);
  });
  it('tracks button press edges', () => {
    const b = new InputBuffer();
    b.push({ ...emptyInput(), LP: true }, 1);
    expect(b.last().pressed.LP).toBe(true);
    b.push({ ...emptyInput(), LP: true }, 1);
    expect(b.last().pressed.LP).toBe(false);
    expect(b.pressedWithin('LP', 2)).toBe(true);
  });
});
