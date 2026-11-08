import { describe, it, expect } from 'vitest';
import { Match, MAX_SEPARATION } from '../../src/game/match.js';
import { getCharacter } from '../../src/game/characters.js';
import { emptyInput } from '../../src/game/input.js';

const I = (o = {}) => ({ ...emptyInput(), ...o });
function fightMatch(a = 'kaen', b = 'raiga') {
  const m = new Match(getCharacter(a), getCharacter(b), { introFrames: 2 });
  for (let i = 0; i < 3; i++) m.step([I(), I()]);
  expect(m.phase).toBe('fight');
  return m;
}
function run(m, n, p1 = I(), p2 = I()) {
  const ev = [];
  for (let i = 0; i < n; i++) {
    m.step([typeof p1 === 'function' ? p1(i) : p1, typeof p2 === 'function' ? p2(i) : p2]);
    ev.push(...m.drainEvents());
  }
  return ev;
}

describe('movement', () => {
  it('walks forward and back', () => {
    const m = fightMatch();
    const x0 = m.f[0].x;
    run(m, 20, I({ dir: 6 }));
    expect(m.f[0].x).toBeGreaterThan(x0);
    const x1 = m.f[0].x;
    run(m, 20, I({ dir: 4 }));
    expect(m.f[0].x).toBeLessThan(x1);
  });
  it('jumps and lands', () => {
    const m = fightMatch();
    run(m, 10, I({ dir: 8 }));
    expect(m.f[0].y).toBeGreaterThan(0);
    run(m, 80);
    expect(m.f[0].y).toBe(0);
    expect(['idle', 'landing']).toContain(m.f[0].state);
  });
  it('fighters cannot overlap or exceed screen separation', () => {
    const m = fightMatch();
    run(m, 200, I({ dir: 6 }), I({ dir: 6 }));
    expect(Math.abs(m.f[0].x - m.f[1].x)).toBeGreaterThanOrEqual(0.59);
    run(m, 400, I({ dir: 4 }), I({ dir: 4 }));
    expect(Math.abs(m.f[0].x - m.f[1].x)).toBeLessThanOrEqual(MAX_SEPARATION + 1e-6);
  });
});

function closeIn(m) {
  m.f[0].x = -0.5;
  m.f[1].x = 0.4;
}

describe('attacks', () => {
  it('a standing punch hits an idle opponent and deals damage', () => {
    const m = fightMatch();
    closeIn(m);
    const ev = run(m, 30, (i) => I({ LP: i === 0 }));
    expect(ev.some((e) => e.type === 'hit')).toBe(true);
    expect(m.f[1].hp).toBeLessThan(m.f[1].maxHp);
  });
  it('holding back blocks a mid attack (only chip-free)', () => {
    const m = fightMatch();
    closeIn(m);
    const ev = run(m, 30, (i) => I({ HK: i === 0 }), I({ dir: 6 })); // P2 faces left, back = screen right
    expect(ev.some((e) => e.type === 'block')).toBe(true);
    expect(m.f[1].hp).toBe(m.f[1].maxHp);
  });
  it('a low attack beats a standing block but not a crouching block', () => {
    let m = fightMatch();
    closeIn(m);
    let ev = run(m, 30, (i) => I({ dir: 2, LK: i === 0 }), I({ dir: 6 }));
    expect(ev.some((e) => e.type === 'hit')).toBe(true);
    m = fightMatch();
    closeIn(m);
    ev = run(m, 30, (i) => I({ dir: 2, LK: i === 0 }), I({ dir: 3 }));
    expect(ev.some((e) => e.type === 'block')).toBe(true);
  });
  it('sweep knocks down', () => {
    const m = fightMatch();
    closeIn(m);
    const ev = run(m, 60, (i) => I({ dir: 2, HK: i === 0 }));
    expect(ev.some((e) => e.type === 'knockdown')).toBe(true);
  });
  it('236+P spawns a projectile that travels and hits', () => {
    const m = fightMatch();
    const seq = [2, 2, 3, 3, 6];
    const ev = run(m, 120, (i) => (i < seq.length ? I({ dir: seq[i] }) : i === seq.length ? I({ dir: 6, HP: true }) : I()));
    expect(ev.some((e) => e.type === 'special' && e.move === 'FIREBALL')).toBe(true);
    expect(ev.some((e) => e.type === 'hit' && e.strength === 2)).toBe(true);
  });
  it('623+P performs the rising anti-air', () => {
    const m = fightMatch();
    const seq = [6, 2, 3];
    const ev = run(m, 10, (i) => (i < seq.length ? I({ dir: seq[i] }) : i === seq.length ? I({ dir: 3, LP: true }) : I()));
    expect(ev.some((e) => e.type === 'special' && e.move === 'RISING')).toBe(true);
  });
  it('super requires a full gauge and HP+HK', () => {
    const m = fightMatch();
    closeIn(m);
    let ev = run(m, 2, (i) => I({ HP: i === 0, HK: i === 0 }));
    expect(ev.some((e) => e.type === 'super')).toBe(false);
    run(m, 40);
    m.f[0].gauge = 100;
    ev = run(m, 140, (i) => I({ HP: i === 0, HK: i === 0 }));
    expect(ev.some((e) => e.type === 'super')).toBe(true);
    expect(m.f[0].gauge).toBeLessThan(100);
    expect(m.f[1].hp).toBeLessThan(m.f[1].maxHp - 150);
  });
});

describe('rounds and match', () => {
  it('KO ends the round and two round wins end the match', () => {
    const m = new Match(getCharacter('kaen'), getCharacter('hyoka'), { introFrames: 2, koFrames: 10 });
    for (let r = 0; r < 2; r++) {
      run(m, 5);
      m.f[1].hp = 1;
      closeIn(m);
      run(m, 40, (i) => I({ HP: i === 0 }));
      run(m, 20);
    }
    expect(m.wins[0]).toBe(2);
    expect(m.phase).toBe('matchEnd');
    expect(m.winner).toBe(0);
  });
  it('time over awards the round to the healthier fighter', () => {
    const m = fightMatch();
    m.f[0].hp = 500;
    m.timer = 2;
    const ev = run(m, 3);
    expect(ev.some((e) => e.type === 'announce' && e.text === 'TIME UP')).toBe(true);
    expect(m.roundWinner).toBe(1);
  });
});
