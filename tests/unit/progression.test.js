import { describe, it, expect } from 'vitest';
import { Run } from '../../src/game/progression.js';
import { aiParams } from '../../src/game/ai.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

describe('arcade run', () => {
  it('fights every character, ending with a mirror match, then loops harder', () => {
    const r = new Run('raiga', memStorage());
    const seen = [];
    for (let i = 0; i < 6; i++) {
      seen.push([r.opponentId, r.isMirror, r.loop, r.cpuLevel]);
      r.recordWin();
    }
    expect(seen.slice(0, 3).map((s) => s[0])).toEqual(['kaen', 'hyoka', 'raiga']);
    expect(seen[2][1]).toBe(true);
    expect(seen[3][2]).toBe(1);
    expect(seen[5][3]).toBeGreaterThan(seen[0][3]);
    expect(r.wins).toBe(6);
  });
  it('stage background matches the opponent', () => {
    const r = new Run('kaen');
    expect(r.stageId).toBe(r.opponentId);
  });
  it('remembers the best streak', () => {
    const s = memStorage();
    const r = new Run('kaen', s);
    r.recordWin();
    r.recordWin();
    expect(s.getItem('rgb2.best')).toBe('2');
    const r2 = new Run('hyoka', s);
    r2.recordWin();
    expect(s.getItem('rgb2.best')).toBe('2');
    expect(r2.best).toBe(2);
  });
  it('CPU gets stronger every stage', () => {
    const a = aiParams(0);
    const b = aiParams(5);
    expect(b.reaction).toBeLessThan(a.reaction);
    expect(b.block).toBeGreaterThan(a.block);
    expect(b.antiAir).toBeGreaterThan(a.antiAir);
  });
});
