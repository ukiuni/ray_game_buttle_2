import { Fighter, BODY_HALF, GROUND_Y } from './fighter.js';
import { emptyInput } from './input.js';

export const STAGE_HALF = 7.0;
export const MAX_SEPARATION = 5.6;
export const ROUND_TIME = 99;
export const ROUNDS_TO_WIN = 2;
const FPS = 60;

function overlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

/**
 * One versus match (best of 3 rounds) between two fighters.
 * Pure simulation: no rendering, deterministic given inputs and rng.
 */
export class Match {
  constructor(char1, char2, opts = {}) {
    this.f = [new Fighter(char1, 0), new Fighter(char2, 1)];
    this.wins = [0, 0];
    this.round = 0;
    this.projectiles = [];
    this.events = [];
    this.frame = 0;
    this.hitstop = 0;
    this.freeze = 0; // super flash freeze
    this.slowmo = 0;
    this.winner = null; // 0 / 1 when match ends
    this.roundWinner = null;
    this.introFrames = opts.introFrames ?? 110;
    this.koFrames = opts.koFrames ?? 170;
    this.startRound();
  }

  startRound() {
    this.round++;
    this.f[0].reset(-1.6, 1);
    this.f[1].reset(1.6, -1);
    // gauge persists between rounds
    this.projectiles = [];
    this.timer = ROUND_TIME * FPS;
    this.phase = 'intro';
    this.phaseFrame = 0;
    this.roundWinner = null;
    this.events.push({ type: 'roundStart', round: this.round });
  }

  get timeLeft() {
    return Math.ceil(this.timer / FPS);
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }

  /** Advance the simulation one frame. inputs = [raw1, raw2]. */
  step(inputs) {
    this.frame++;
    this.phaseFrame++;
    const [a, b] = this.f;

    if (this.phase === 'matchEnd') {
      for (const f of this.f) f.stateFrame++;
      return;
    }

    if (this.phase === 'intro') {
      if (this.phaseFrame === 1) this.events.push({ type: 'announce', text: this.round >= 3 && this.wins[0] === this.wins[1] ? 'FINAL ROUND' : `ROUND ${this.round}` });
      if (this.phaseFrame === Math.floor(this.introFrames * 0.6)) this.events.push({ type: 'announce', text: 'FIGHT!' , fight: true });
      if (this.phaseFrame >= this.introFrames) {
        this.phase = 'fight';
        this.phaseFrame = 0;
      }
      // still allow idle animation
      a.stateFrame++;
      b.stateFrame++;
      return;
    }

    if (this.freeze > 0) {
      this.freeze--;
      // keep buffering inputs during freeze
      a.buffer.push(inputs[0] || emptyInput(), a.facing);
      b.buffer.push(inputs[1] || emptyInput(), b.facing);
      return;
    }

    if (this.hitstop > 0) {
      this.hitstop--;
      return;
    }

    const fighting = this.phase === 'fight';
    const in0 = fighting ? inputs[0] || emptyInput() : emptyInput();
    const in1 = fighting ? inputs[1] || emptyInput() : emptyInput();

    // facing update (only when grounded and actionable)
    for (const [me, op] of [[a, b], [b, a]]) {
      if ((me.actionable || me.state === 'jumpsquat') && !me.airborne) {
        const want = op.x >= me.x ? 1 : -1;
        if (Math.abs(op.x - me.x) > 0.05) me.facing = want;
      }
    }

    const prev = [a.x, b.x];
    for (const [i, me] of this.f.entries()) {
      const ev = me.think(i === 0 ? in0 : in1);
      if (ev && ev.type === 'super') {
        this.freeze = 40;
        this.events.push({ type: 'super', side: i, name: me.char.specialNames.SUPER });
      } else if (ev && ev.type === 'special') {
        this.events.push({ type: 'special', side: i, name: me.char.specialNames[ev.name], move: ev.name });
      }
    }
    for (const me of this.f) me.physics(this.events);

    for (const e of this.events) {
      if (e.type === 'spawnProjectile' && !e.done) {
        e.done = true;
        const me = this.f[e.side];
        const m = me.char.moves.FIREBALL;
        const speed = m.speed * (me.strength === 'H' ? 1.3 : 1);
        this.projectiles.push({
          owner: e.side,
          x: me.x + me.facing * 0.7,
          y: me.y + 1.15,
          vx: me.facing * speed,
          life: 160,
          dead: false,
          color: me.char.projColor,
          char: me.char.id,
          id: this.frame * 10 + e.side,
        });
        me.projectileActive = true;
      }
    }

    this.resolvePush(prev);
    this.resolveHits();
    this.updateProjectiles();

    if (this.phase === 'fight') {
      this.timer--;
      this.checkRoundEnd();
    } else if (this.phase === 'ko') {
      const w = this.f[this.roundWinner];
      if (this.phaseFrame >= 80 && w && w.actionable) w.setState('win');
      if (this.phaseFrame >= this.koFrames) this.finishRound();
    }
  }

  resolvePush(prev) {
    const [a, b] = this.f;
    // body collision when both near ground level / overlapping vertically
    const verticalOverlap = Math.abs(a.y - b.y) < 1.3;
    const minDist = BODY_HALF * 2;
    const dx = b.x - a.x;
    if (verticalOverlap && Math.abs(dx) < minDist && a.state !== 'knockdown' && b.state !== 'knockdown') {
      const push = (minDist - Math.abs(dx)) / 2;
      const dir = dx === 0 ? (a.facing === 1 ? 1 : -1) : Math.sign(dx);
      a.x -= dir * push;
      b.x += dir * push;
    }
    // stage bounds
    for (const f of this.f) {
      if (f.x < -STAGE_HALF) { f.x = -STAGE_HALF; }
      if (f.x > STAGE_HALF) { f.x = STAGE_HALF; }
    }
    // re-resolve push against walls (corner)
    const d2 = b.x - a.x;
    if (verticalOverlap && Math.abs(d2) < minDist) {
      if (a.x <= -STAGE_HALF + 1e-6 || b.x <= -STAGE_HALF + 1e-6) {
        const left = a.x < b.x ? a : b;
        const right = left === a ? b : a;
        right.x = left.x + minDist;
      } else if (a.x >= STAGE_HALF - 1e-6 || b.x >= STAGE_HALF - 1e-6) {
        const right = a.x > b.x ? a : b;
        const left = right === a ? b : a;
        left.x = right.x - minDist;
      }
    }
    // camera separation limit
    const dist = Math.abs(b.x - a.x);
    if (dist > MAX_SEPARATION) {
      const prevDist = Math.abs(prev[1] - prev[0]);
      const over = dist - Math.max(MAX_SEPARATION, Math.min(prevDist, dist));
      if (over > 0) {
        // pull back whichever moved away most
        const moveA = Math.abs(a.x - prev[0]);
        const moveB = Math.abs(b.x - prev[1]);
        const target = moveA >= moveB ? a : b;
        const other = target === a ? b : a;
        target.x += Math.sign(other.x - target.x) * over;
      }
    }
  }

  resolveHits() {
    const [a, b] = this.f;
    const hits = [];
    for (const [att, def] of [[a, b], [b, a]]) {
      const hb = att.hitbox();
      if (!hb || def.isInvulnerable()) continue;
      if (overlap(hb, def.hurtbox())) hits.push([att, def]);
    }
    for (const [att, def] of hits) {
      const move = att.move;
      if (!move) continue;
      const hb = att.hitbox();
      const res = def.receiveHit(att, move);
      att.hitConnected = true;
      att.hitCount++;
      att.lastHitFrame = att.moveFrame;
      // if defender is cornered, push attacker back instead
      if (Math.abs(def.x) >= STAGE_HALF - 0.05 && !move.dash) {
        att.slide = -att.facing * move.push * 0.8;
      }
      const strength = move.super ? 3 : move.sfx === 'special' ? 2 : move.sfx === 'heavy' ? 1 : 0;
      this.hitstop = res.blocked ? 5 : [7, 10, 12, 9][strength];
      this.events.push({
        type: res.blocked ? 'block' : 'hit',
        side: def.side,
        attacker: att.side,
        x: (Math.max(hb.x0, def.x - 0.3) + Math.min(hb.x1, def.x + 0.3)) / 2,
        y: Math.min(hb.y1, def.y + 1.5) - 0.15,
        strength,
        damage: res.damage,
        combo: def.comboCount,
        color: att.char.projColor,
      });
      if (def.ko) this.onKO(def.side);
    }
  }

  updateProjectiles() {
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.x += p.vx;
      p.life--;
      if (p.life <= 0 || Math.abs(p.x) > STAGE_HALF + 2) p.dead = true;
    }
    // projectile vs projectile
    for (let i = 0; i < this.projectiles.length; i++) {
      for (let j = i + 1; j < this.projectiles.length; j++) {
        const p = this.projectiles[i];
        const q = this.projectiles[j];
        if (p.dead || q.dead || p.owner === q.owner) continue;
        if (Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5) {
          p.dead = q.dead = true;
          this.events.push({ type: 'clash', x: (p.x + q.x) / 2, y: p.y });
        }
      }
    }
    // projectile vs fighter
    for (const p of this.projectiles) {
      if (p.dead) continue;
      const def = this.f[1 - p.owner];
      const att = this.f[p.owner];
      if (def.isInvulnerable()) continue;
      const box = { x0: p.x - 0.25, x1: p.x + 0.25, y0: p.y - 0.25, y1: p.y + 0.25 };
      if (overlap(box, def.hurtbox())) {
        p.dead = true;
        const fakeAtt = { char: att.char, facing: Math.sign(p.vx), gauge: att.gauge, hitCount: 0 };
        const res = def.receiveHit(fakeAtt, att.char.moves.FIREBALL);
        att.gauge = fakeAtt.gauge;
        this.hitstop = res.blocked ? 5 : 9;
        this.events.push({ type: res.blocked ? 'block' : 'hit', side: def.side, attacker: p.owner, x: p.x, y: p.y, strength: 2, damage: res.damage, combo: def.comboCount, color: p.color });
        if (def.ko) this.onKO(def.side);
      }
    }
    for (const p of this.projectiles) {
      if (p.dead) this.events.push({ type: 'projectileGone', id: p.id, x: p.x, y: p.y });
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    for (const f of this.f) f.projectileActive = this.projectiles.some((p) => p.owner === f.side);
  }

  onKO(loserSide) {
    if (this.phase !== 'fight') return;
    this.phase = 'ko';
    this.phaseFrame = 0;
    this.roundWinner = 1 - loserSide;
    this.events.push({ type: 'ko', loser: loserSide });
    this.events.push({ type: 'announce', text: 'K.O.', ko: true });
  }

  checkRoundEnd() {
    if (this.timer > 0) return;
    const [a, b] = this.f;
    const ra = a.hp / a.maxHp;
    const rb = b.hp / b.maxHp;
    // ties go to player 1 (generous to the human)
    this.roundWinner = rb > ra ? 1 : 0;
    this.phase = 'ko';
    this.phaseFrame = 0;
    this.events.push({ type: 'announce', text: 'TIME UP', ko: true });
  }

  finishRound() {
    const w = this.roundWinner;
    this.wins[w]++;
    this.events.push({ type: 'roundEnd', winner: w, wins: [...this.wins] });
    if (this.wins[w] >= ROUNDS_TO_WIN) {
      this.phase = 'matchEnd';
      this.winner = w;
      this.f[w].setState('win');
      this.events.push({ type: 'matchEnd', winner: w });
    } else {
      this.startRound();
    }
  }

  /** When the KO phase is running, put the winner into a victory pose once things settle. */
  get koSettled() {
    return this.phase === 'ko' && this.phaseFrame > 70;
  }
}

export { GROUND_Y };
