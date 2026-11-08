import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { CHARACTERS, STAGES } from '../../src/game/characters.js';

const root = new URL('../../', import.meta.url).pathname;

describe('generated art assets', () => {
  it('has codex-generated source art for every character and stage', () => {
    for (const c of CHARACTERS) {
      for (const f of [`bg_${c.id}.png`, `tex_${c.id}_cloth.png`, `tex_${c.id}_face.png`, `px_${c.id}.png`]) {
        expect(existsSync(`${root}art_src/${f}`), f).toBe(true);
      }
    }
  });
  it('has web-ready assets referenced by the game', () => {
    for (const c of CHARACTERS) {
      for (const f of [`tex_${c.id}_cloth.jpg`, `tex_${c.id}_face.jpg`, `px_${c.id}.png`]) {
        expect(statSync(`${root}public/assets/${f}`).size).toBeGreaterThan(1000);
      }
    }
    for (const s of Object.values(STAGES)) expect(existsSync(`${root}public/${s.image}`)).toBe(true);
  });
  it('has a valid PWA manifest with icons', () => {
    const m = JSON.parse(readFileSync(`${root}public/manifest.webmanifest`, 'utf8'));
    expect(m.display).toBe('fullscreen');
    expect(m.orientation).toBe('landscape');
    expect(m.start_url).toBe('./');
    for (const i of m.icons) expect(existsSync(`${root}public/${i.src}`), i.src).toBe(true);
    expect(m.icons.some((i) => i.sizes === '512x512')).toBe(true);
    expect(m.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });
  it('locks the viewport in index.html', () => {
    const html = readFileSync(`${root}index.html`, 'utf8');
    expect(html).toMatch(/user-scalable=no/);
    expect(html).toMatch(/maximum-scale=1/);
    expect(html).toMatch(/rel="manifest"/);
  });
});
