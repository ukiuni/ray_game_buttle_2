import { describe, it, expect } from 'vitest';
import { Match } from '../../src/game/match.js';
import { CpuAI, makeRng } from '../../src/game/ai.js';
import { CHARACTERS, getCharacter } from '../../src/game/characters.js';

function runMatch(c1, c2, seed, l1 = 3, l2 = 3, maxFrames = 60 * 60 * 12) {
  const m = new Match(getCharacter(c1), getCharacter(c2));
  const ai1 = new CpuAI(0, l1, makeRng(seed));
  const ai2 = new CpuAI(1, l2, makeRng(seed * 7 + 3));
  const stats = { hits: 0, blocks: 0, specials: 0, supers: 0, projectiles: 0, frames: 0 };
  for (let i = 0; i < maxFrames && m.phase !== 'matchEnd'; i++) {
    m.step([ai1.update(m), ai2.update(m)]);
    for (const e of m.drainEvents()) {
      if (e.type === 'hit') stats.hits++;
      if (e.type === 'block') stats.blocks++;
      if (e.type === 'special') stats.specials++;
      if (e.type === 'super') stats.supers++;
      if (e.type === 'spawnProjectile') stats.projectiles++;
    }
    for (const f of m.f) {
      expect(Number.isFinite(f.x)).toBe(true);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(Math.abs(f.x)).toBeLessThanOrEqual(7.0001);
    }
    stats.frames++;
  }
  return { m, stats };
}

describe('full CPU vs CPU matches', () => {
  for (const a of CHARACTERS) {
    for (const b of CHARACTERS) {
      it(`${a.id} vs ${b.id} finishes with a winner`, () => {
        const { m, stats } = runMatch(a.id, b.id, a.hp + b.hp);
        expect(m.phase).toBe('matchEnd');
        expect([0, 1]).toContain(m.winner);
        expect(m.wins[m.winner]).toBe(2);
        expect(stats.hits).toBeGreaterThan(5);
        expect(stats.specials).toBeGreaterThan(0);
      });
    }
  }
});
