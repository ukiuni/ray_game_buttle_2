import { describe, it, expect } from 'vitest';
import { buildCharacter, countTriangles } from '../../src/render/models.js';
import { CHARACTERS } from '../../src/game/characters.js';

describe('character models', () => {
  for (const c of CHARACTERS) {
    for (const variant of [0, 1]) {
      it(`${c.id} (colour ${variant}) is about 20,000 triangles and fully rigged`, () => {
        const m = buildCharacter(c.id, {}, variant);
        const tris = countTriangles(m);
        expect(tris).toBeGreaterThanOrEqual(18000);
        expect(tris).toBeLessThanOrEqual(22000);
        const j = m.userData.joints;
        for (const name of ['hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'handL', 'shR', 'elR', 'handR', 'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR']) {
          expect(j[name], name).toBeTruthy();
        }
        expect(m.userData.chains.length).toBeGreaterThan(0);
      });
    }
  }
  it('characters have distinct silhouettes (different builds)', () => {
    const sizes = CHARACTERS.map((c) => buildCharacter(c.id).userData.build.shoulderW);
    expect(new Set(sizes).size).toBe(3);
  });
});
