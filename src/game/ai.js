import { mirrorDir } from './input.js';

/** Deterministic PRNG (mulberry32) so tests can be reproducible. */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function aiParams(level) {
  const L = Math.max(0, level);
  return {
    reaction: Math.max(5, Math.round(22 - 3 * L)),
    block: Math.min(0.92, 0.3 + 0.12 * L),
    antiAir: Math.min(0.88, 0.15 + 0.14 * L),
    aggression: Math.min(0.92, 0.38 + 0.09 * L),
    special: Math.min(0.5, 0.12 + 0.06 * L),
    combo: Math.min(0.95, 0.2 + 0.15 * L),
    punish: Math.min(0.95, 0.2 + 0.15 * L),
    think: Math.max(5, 20 - 2 * L),
  };
}

const NONE = { dir: 5, LP: false, HP: false, LK: false, HK: false };

export class CpuAI {
  constructor(side, level = 0, rng = Math.random) {
    this.side = side;
    this.level = level;
    this.p = aiParams(level);
    this.rng = rng;
    this.queue = [];
    this.snapshots = [];
    this.hold = null; // {raw, frames}
    this.cooldown = 0;
  }

  /** Map a facing-relative direction to a screen direction for this fighter. */
  scr(rel, me) {
    return me.facing === 1 ? rel : mirrorDir(rel);
  }

  frame(rel, me, btns = {}) {
    return { ...NONE, dir: this.scr(rel, me), ...btns };
  }

  pushPress(me, rel, btn, extraWait = 0) {
    this.queue.push(this.frame(rel, me, { [btn]: true }));
    this.queue.push(this.frame(rel, me));
    for (let i = 0; i < extraWait; i++) this.queue.push(this.frame(rel, me));
  }

  pushMotion(me, seq, btn) {
    for (const d of seq) {
      this.queue.push(this.frame(d, me));
      this.queue.push(this.frame(d, me));
    }
    this.queue.push(this.frame(seq[seq.length - 1], me, { [btn]: true }));
    this.queue.push(this.frame(5, me));
  }

  pushWait(me, n, rel = 5) {
    for (let i = 0; i < n; i++) this.queue.push(this.frame(rel, me));
  }

  /** Light-attack confirm combo ending in a special. */
  pushCombo(me) {
    const r = this.rng();
    const moves = me.char.moves;
    if (r < 0.4) {
      // cLK, cLP -> fireball / rush
      this.pushPress(me, 2, 'LK', moves.cLK.startup + moves.cLK.active - 1);
      this.pushPress(me, 2, 'LP', 1);
      if (this.rng() < this.p.combo) this.pushMotion(me, [2, 3, 6], this.rng() < 0.5 ? 'HP' : 'LP');
    } else if (r < 0.7) {
      // HP -> rush
      this.pushPress(me, 5, 'HP', 2);
      if (this.rng() < this.p.combo) this.pushMotion(me, [2, 1, 4], 'HK');
    } else {
      // LP, LP -> rising
      this.pushPress(me, 5, 'LP', moves.LP.startup + moves.LP.active - 1);
      this.pushPress(me, 5, 'LP', 1);
      if (this.rng() < this.p.combo) this.pushMotion(me, [6, 2, 3], 'HP');
    }
  }

  snapshot(op, match) {
    const m = op.move;
    const active = !!m && op.moveFrame > m.startup && op.moveFrame <= m.startup + m.active;
    const recovering = !!m && op.moveFrame > m.startup + m.active;
    const incoming = match.projectiles.filter((p) => p.owner !== this.side);
    return {
      x: op.x,
      y: op.y,
      state: op.state,
      airborne: op.airborne,
      attacking: !!m,
      startingUp: !!m && op.moveFrame <= m.startup,
      active,
      recovering,
      level: m ? m.level : null,
      vx: op.vx,
      projectiles: incoming.map((p) => ({ x: p.x, vx: p.vx })),
    };
  }

  /** Produce the CPU's raw input for this frame. */
  update(match) {
    const me = match.f[this.side];
    const op = match.f[1 - this.side];
    this.snapshots.push(this.snapshot(op, match));
    if (this.snapshots.length > 40) this.snapshots.shift();
    if (match.phase !== 'fight') {
      this.queue = [];
      return { ...NONE };
    }
    const seen = this.snapshots[Math.max(0, this.snapshots.length - 1 - this.p.reaction)];

    // got hit: drop plans
    if (me.state === 'hitstun' || me.state === 'airhit' || me.state === 'knockdown') {
      this.queue = [];
      this.hold = null;
      return { ...NONE };
    }
    if (this.queue.length) return this.queue.shift();

    const dist = Math.abs(op.x - me.x);
    const rng = this.rng;

    // keep blocking while in blockstun
    if (me.state === 'blockstun') {
      return this.frame(me.lastBlockLevel === 'crouch' ? 1 : 4, me);
    }

    if (!me.actionable) return this.hold ? this.hold.raw : { ...NONE };

    // --- reactions -------------------------------------------------------
    // anti-air
    if (seen.airborne && seen.state !== 'airhit' && dist < 2.6 && dist > 0.4 && this.cooldown <= 0) {
      this.cooldown = 30;
      if (rng() < this.p.antiAir) {
        if (rng() < 0.6) this.pushMotion(me, [6, 2, 3], 'HP');
        else this.pushPress(me, 2, 'HP');
        return this.queue.shift();
      }
      if (rng() < this.p.block) {
        this.hold = { raw: this.frame(4, me), frames: 20 };
      }
    }

    // incoming projectile
    const proj = seen.projectiles.find((p) => Math.sign(p.vx) === Math.sign(me.x - p.x) && Math.abs(p.x - me.x) < 3.5);
    if (proj && this.cooldown <= 0) {
      this.cooldown = 25;
      const r = rng();
      if (r < this.p.block * 0.6) {
        this.hold = { raw: this.frame(4, me), frames: 30 };
      } else if (r < this.p.block * 0.6 + 0.25 && Math.abs(proj.x - me.x) > 1.5) {
        this.queue.push(this.frame(9, me));
        this.pushWait(me, 6, 5);
        this.pushPress(me, 5, 'HK', 4);
        return this.queue.shift();
      } else if (!me.projectileActive) {
        this.pushMotion(me, [2, 3, 6], 'LP');
        return this.queue.shift();
      }
    }

    // opponent attacking nearby -> block
    if (seen.attacking && !seen.airborne && dist < 2.2 && (seen.startingUp || seen.active)) {
      if (rng() < this.p.block) {
        const low = seen.level === 'low';
        this.hold = { raw: this.frame(low ? 1 : 4, me), frames: 12 };
      }
    }

    // punish recovering opponent
    if (seen.recovering && !seen.airborne && dist < 1.5 && rng() < this.p.punish) {
      this.hold = null;
      this.pushCombo(me);
      return this.queue.shift();
    }

    if (this.cooldown > 0) this.cooldown--;

    if (this.hold && this.hold.frames > 0) {
      this.hold.frames--;
      return this.hold.raw;
    }
    this.hold = null;

    // --- neutral decisions -------------------------------------------------
    const reach = 1.2 * me.char.reachScale;
    const r = rng();
    if (me.gauge >= 100 && dist < 1.6 && r < 0.25 + this.p.aggression * 0.3) {
      this.queue.push(this.frame(5, me, { HP: true, HK: true }));
      this.queue.push(this.frame(5, me));
      return this.queue.shift();
    }
    if (dist > 3.2) {
      if (r < this.p.special * 0.6 && !me.projectileActive) {
        this.pushMotion(me, [2, 3, 6], rng() < 0.5 ? 'HP' : 'LP');
      } else if (r < 0.1 + this.p.aggression * 0.08) {
        this.queue.push(this.frame(9, me));
        this.pushWait(me, 16, 5);
        this.pushPress(me, 5, rng() < 0.5 ? 'HK' : 'HP', 10);
      } else if (r < 0.2 + this.p.aggression * 0.8) {
        this.hold = { raw: this.frame(6, me), frames: this.p.think + Math.floor(rng() * 12) };
      } else {
        this.hold = { raw: this.frame(rng() < 0.5 ? 5 : 4, me), frames: this.p.think };
      }
    } else if (dist > reach) {
      if (r < this.p.special * 0.5 && !me.projectileActive) {
        this.pushMotion(me, [2, 3, 6], rng() < 0.5 ? 'HP' : 'LP');
      } else if (r < 0.15 && dist < reach + 0.6) {
        this.pushPress(me, rng() < 0.5 ? 5 : 2, 'HK', 4);
      } else if (r < 0.25) {
        this.queue.push(this.frame(9, me));
        this.pushWait(me, 14, 5);
        this.pushPress(me, 5, rng() < 0.5 ? 'HK' : 'HP', 10);
      } else if (r < 0.3 + this.p.aggression * 0.6) {
        this.hold = { raw: this.frame(6, me), frames: 6 + Math.floor(rng() * this.p.think) };
      } else if (r < 0.92) {
        this.hold = { raw: this.frame(rng() < 0.6 ? 4 : 1, me), frames: this.p.think };
      } else {
        this.pushMotion(me, [2, 1, 4], 'LK');
      }
    } else {
      // close range
      if (r < this.p.aggression * 0.55) {
        this.pushCombo(me);
      } else if (r < this.p.aggression * 0.8) {
        const opts = ['LP', 'LK', 'HP', 'HK'];
        this.pushPress(me, rng() < 0.4 ? 2 : 5, opts[Math.floor(rng() * opts.length)], 6);
      } else if (r < 0.85) {
        this.hold = { raw: this.frame(rng() < 0.5 ? 4 : 1, me), frames: this.p.think };
      } else {
        this.hold = { raw: this.frame(4, me), frames: 10 };
      }
    }
    if (this.queue.length) return this.queue.shift();
    if (this.hold) return this.hold.raw;
    return { ...NONE };
  }
}
