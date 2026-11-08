import { InputBuffer, dirX, dirY } from './input.js';

export const GROUND_Y = 0;
export const STAND_H = 1.75;
export const CROUCH_H = 1.1;
export const BODY_HALF = 0.3;

const ACTIONABLE = new Set(['idle', 'walk', 'crouch']);

export class Fighter {
  constructor(char, side) {
    this.char = char;
    this.side = side; // 0 = player 1 (left start), 1 = player 2
    this.buffer = new InputBuffer();
    this.reset(side === 0 ? -1.6 : 1.6, side === 0 ? 1 : -1);
    this.gauge = 0;
  }

  reset(x, facing) {
    this.x = x;
    this.y = GROUND_Y;
    this.vx = 0;
    this.vy = 0;
    this.slide = 0;
    this.facing = facing;
    this.hp = this.char.hp;
    this.maxHp = this.char.hp;
    this.state = 'idle';
    this.stateFrame = 0;
    this.move = null;
    this.moveName = null;
    this.moveFrame = 0;
    this.hitConnected = false;
    this.hitCount = 0;
    this.lastHitFrame = -99;
    this.stun = 0;
    this.airMoveUsed = false;
    this.jumpDir = 0;
    this.comboCount = 0;
    this.comboDamage = 0;
    this.blocking = false;
    this.lastBlockLevel = null;
    this.ko = false;
    this.invulnTimer = 0;
    this.buffer = new InputBuffer();
    this.input = { dir: 5, pressed: {}, held: {} };
    this.projectileActive = false;
    this.landingLag = 0;
    this.walkDir = 0;
  }

  get airborne() {
    return this.y > GROUND_Y + 1e-6 || this.state === 'jump' || this.state === 'airattack' || this.state === 'airhit' || this.state === 'fall';
  }

  get crouching() {
    return this.state === 'crouch' || (this.state === 'blockstun' && this.lastBlockLevel === 'crouch') ||
      (this.state === 'attack' && this.moveName && this.moveName.startsWith('c'));
  }

  get actionable() {
    return ACTIONABLE.has(this.state);
  }

  setState(s) {
    this.state = s;
    this.stateFrame = 0;
  }

  /** Whether the fighter is currently holding back (block input). */
  holdingBack() {
    const d = this.input.dir;
    return d === 4 || d === 1 || d === 7;
  }

  canBlock() {
    return (this.actionable || this.state === 'blockstun') && this.holdingBack() && !this.airborne;
  }

  isInvulnerable() {
    if (this.invulnTimer > 0) return true;
    if (this.state === 'knockdown' || this.state === 'getup' || this.state === 'ko') return true;
    if (this.move && this.move.invuln && this.moveFrame <= this.move.invuln) return true;
    return false;
  }

  hurtbox() {
    if (this.airborne) {
      return { x0: this.x - BODY_HALF, x1: this.x + BODY_HALF, y0: this.y + 0.15, y1: this.y + 1.55 };
    }
    const h = this.crouching ? CROUCH_H : STAND_H;
    return { x0: this.x - BODY_HALF, x1: this.x + BODY_HALF, y0: this.y, y1: this.y + h };
  }

  /** Current active hitbox in world space, or null. */
  hitbox() {
    const m = this.move;
    if (!m || !m.box) return null;
    const f = this.moveFrame;
    if (f <= m.startup || f > m.startup + m.active) return null;
    if (m.multiHit) {
      if (this.hitCount >= m.multiHit) return null;
      if (this.hitConnected && f - this.lastHitFrame < m.hitInterval) return null;
    } else if (this.hitConnected) {
      return null;
    }
    const r = this.char.reachScale;
    const [a, y0, b, y1] = m.box;
    const xa = this.x + this.facing * a * r;
    const xb = this.x + this.facing * b * r;
    return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: this.y + y0, y1: this.y + y1 };
  }

  startMove(name) {
    const m = this.char.moves[name];
    if (!m) return false;
    if (name === 'SUPER') {
      if (this.gauge < 100) return false;
      this.gauge = 0;
    }
    if (name === 'FIREBALL' && this.projectileActive) return false;
    this.move = name === 'SUPER' ? { ...m, multiHit: 5, hitInterval: 4 } : m;
    this.moveName = name;
    this.lastMove = name; // sticky record of the most recent move (used by tests / UI)
    this.moveCount = (this.moveCount || 0) + 1;
    this.moveFrame = 0;
    this.hitConnected = false;
    this.hitCount = 0;
    this.lastHitFrame = -99;
    this.spawnedProjectile = false;
    if (m.air) {
      this.setState('airattack');
      this.airMoveUsed = true;
    } else {
      this.setState('attack');
      this.vx = 0;
    }
    return true;
  }

  /** Process controls for one frame. Returns an event-like object when a special/super starts. */
  think(raw) {
    const inp = this.buffer.push(raw, this.facing);
    this.input = inp;
    if (this.ko) return null;
    const p = inp.pressed;
    const anyPunch = p.LP || p.HP;
    const anyKick = p.LK || p.HK;

    // Super: HP + HK pressed together (within 4 frames) with full gauge.
    const superInput = (p.HP || p.HK) && this.buffer.pressedWithin('HP', 4) && this.buffer.pressedWithin('HK', 4);

    const canSpecial = this.actionable || (this.state === 'attack' && this.move && this.move.cancel && this.hitConnected &&
      this.moveFrame <= this.move.startup + this.move.active + 10);

    if (canSpecial) {
      if (superInput && this.gauge >= 100) {
        this.startMove('SUPER');
        return { type: 'super' };
      }
      if (anyPunch || anyKick) {
        const sp = this.buffer.detectSpecial();
        if (sp && ((sp !== 'RUSH' && anyPunch) || (sp === 'RUSH' && anyKick))) {
          if (this.startMove(sp)) {
            this.buffer.clearMotion();
            this.strength = p.HP || p.HK ? 'H' : 'L';
            return { type: 'special', name: sp };
          }
        }
      }
    }

    // Chain light attacks into each other on connection.
    if (this.state === 'attack' && this.move && this.move.chain && this.hitConnected &&
      this.moveFrame > this.move.startup + this.move.active - 1 && (p.LP || p.LK)) {
      const crouch = dirY(inp.dir) < 0;
      const name = (crouch ? 'c' : '') + (p.LP ? 'LP' : 'LK');
      this.startMove(name);
      return null;
    }

    if (this.actionable) {
      const dy = dirY(inp.dir);
      const dx = dirX(inp.dir); // relative: +1 forward
      const btn = p.HP ? 'HP' : p.HK ? 'HK' : p.LP ? 'LP' : p.LK ? 'LK' : null;
      if (btn) {
        this.startMove((dy < 0 ? 'c' : '') + btn);
        return null;
      }
      if (dy > 0) {
        this.setState('jumpsquat');
        this.jumpDir = dx;
        return null;
      }
      if (dy < 0) {
        if (this.state !== 'crouch') this.setState('crouch');
        this.vx = 0;
        return null;
      }
      if (dx !== 0) {
        if (this.state !== 'walk' || this.walkDir !== dx) this.setState('walk');
        this.walkDir = dx;
        this.vx = this.facing * dx * (dx > 0 ? this.char.walk : this.char.backWalk);
      } else if (this.state !== 'idle') {
        this.setState('idle');
        this.vx = 0;
      } else {
        this.vx = 0;
      }
    } else if (this.state === 'jump' && !this.airMoveUsed) {
      const btn = p.HP ? 'HP' : p.HK ? 'HK' : p.LP ? 'LP' : p.LK ? 'LK' : null;
      if (btn) this.startMove('j' + btn);
    }
    return null;
  }

  /** Advance timers and physics for one frame. Returns list of produced events. */
  physics(events) {
    this.stateFrame++;
    if (this.invulnTimer > 0) this.invulnTimer--;

    switch (this.state) {
      case 'jumpsquat':
        this.vx = 0;
        if (this.stateFrame >= 4) {
          this.setState('jump');
          this.vy = this.char.jumpV;
          this.vx = this.jumpDir * this.char.jumpH * this.facing;
          this.airMoveUsed = false;
          events.push({ type: 'jump', side: this.side });
        }
        break;
      case 'attack': {
        this.moveFrame++;
        const m = this.move;
        if (m.dash) {
          const inMotion = this.moveFrame > m.startup && this.moveFrame <= m.startup + m.active;
          this.vx = inMotion ? this.facing * m.dash : 0;
        }
        if (m.rise && this.moveFrame === m.startup + 1) {
          this.vy = m.rise;
          this.vx = this.facing * 0.035;
          this.y += 0.001;
        }
        if (m.projectile && !this.spawnedProjectile && this.moveFrame >= m.startup) {
          this.spawnedProjectile = true;
          events.push({ type: 'spawnProjectile', side: this.side });
        }
        if (this.moveFrame >= m.startup + m.active + m.recovery) {
          if (this.y > GROUND_Y) {
            this.setState('fall');
          } else {
            this.endMove();
          }
        }
        break;
      }
      case 'airattack':
        this.moveFrame++;
        if (this.moveFrame >= this.move.startup + this.move.active + this.move.recovery) {
          this.move = null;
          this.moveName = null;
          this.state = 'jump';
        }
        break;
      case 'hitstun':
      case 'blockstun':
        this.stun--;
        if (this.stun <= 0) {
          this.setState(this.state === 'blockstun' && this.lastBlockLevel === 'crouch' ? 'crouch' : 'idle');
          this.comboCount = 0;
          this.comboDamage = 0;
        }
        break;
      case 'knockdown':
        if (this.stateFrame >= 40) {
          if (this.ko) {
            this.setState('ko');
          } else {
            this.setState('getup');
          }
        }
        break;
      case 'getup':
        if (this.stateFrame >= 22) {
          this.setState('idle');
          this.invulnTimer = 4;
          this.comboCount = 0;
          this.comboDamage = 0;
        }
        break;
      case 'landing':
        this.vx = 0;
        if (this.stateFrame >= this.landingLag) this.setState('idle');
        break;
      default:
        break;
    }

    // slide (pushback)
    if (Math.abs(this.slide) > 0.0005) {
      const s = this.slide * 0.22;
      this.x += s;
      this.slide -= s;
    } else {
      this.slide = 0;
    }

    // integrate
    this.x += this.vx;
    const inAir = this.y > GROUND_Y || this.vy > 0;
    if (inAir) {
      this.y += this.vy;
      this.vy -= this.char.gravity;
      if (this.y <= GROUND_Y) {
        this.y = GROUND_Y;
        this.vy = 0;
        this.land(events);
      }
    }
  }

  land(events) {
    events.push({ type: 'land', side: this.side, x: this.x });
    if (this.state === 'airhit') {
      this.vx = 0;
      this.setState('knockdown');
      events.push({ type: 'knockdown', side: this.side, x: this.x });
      return;
    }
    if (this.state === 'jump' || this.state === 'airattack') {
      this.move = null;
      this.moveName = null;
      this.vx = 0;
      this.landingLag = 3;
      this.setState('landing');
      return;
    }
    if (this.state === 'fall' || (this.state === 'attack' && this.move && this.move.rise)) {
      this.move = null;
      this.moveName = null;
      this.vx = 0;
      this.landingLag = 12;
      this.setState('landing');
    }
  }

  endMove() {
    this.move = null;
    this.moveName = null;
    this.vx = 0;
    this.setState(dirY(this.input.dir) < 0 ? 'crouch' : 'idle');
  }

  /** Apply a hit from an attacker's move. Returns result info. */
  receiveHit(attacker, move) {
    const level = move.level || 'mid';
    const back = this.holdingBack();
    const crouchHeld = dirY(this.input.dir) < 0;
    let blocked = false;
    if (this.canBlock()) {
      if (level === 'low') blocked = crouchHeld;
      else if (level === 'overhead') blocked = !crouchHeld;
      else blocked = back;
    }
    const dmgScale = attacker.char.damageScale;
    const perHit = move.multiHit ? move.damage / move.multiHit : move.damage;
    if (blocked) {
      const chip = Math.round(perHit * dmgScale * (move.chip || 0));
      this.hp = Math.max(0, this.hp - chip);
      this.stun = move.blockstun;
      this.lastBlockLevel = crouchHeld ? 'crouch' : 'stand';
      this.setState('blockstun');
      this.move = null;
      this.moveName = null;
      this.vx = 0;
      this.slide = attacker.facing * move.push * 1.1;
      this.gauge = Math.min(100, this.gauge + 3);
      attacker.gauge = Math.min(100, attacker.gauge + Math.ceil((move.gauge || 0) / 2));
      if (this.hp <= 0) this.koNow(attacker);
      return { blocked: true, damage: chip };
    }

    this.lastHitLow = level === 'low';
    const scale = Math.max(0.3, 1 - this.comboCount * 0.1);
    const dmg = Math.max(1, Math.round(perHit * dmgScale * scale));
    this.hp = Math.max(0, this.hp - dmg);
    this.comboCount++;
    this.comboDamage += dmg;
    this.gauge = Math.min(100, this.gauge + Math.round(dmg * 0.04));
    attacker.gauge = Math.min(100, attacker.gauge + (move.gauge || 0));
    this.move = null;
    this.moveName = null;

    const finalMulti = move.multiHit ? attacker.hitCount + 1 >= move.multiHit : true;
    const wasAir = this.airborne;
    if (this.hp <= 0) {
      this.koNow(attacker);
    } else if (wasAir || (move.launch && finalMulti) || (move.knockdown && finalMulti)) {
      this.setState('airhit');
      this.vy = move.launch ? 0.16 : wasAir ? 0.1 : 0.07;
      this.y = Math.max(this.y, 0.01);
      this.vx = attacker.facing * (move.launch ? 0.035 : 0.045);
    } else {
      this.setState('hitstun');
      this.stun = move.hitstun;
      this.vx = 0;
      this.slide = attacker.facing * move.push;
    }
    return { blocked: false, damage: dmg };
  }

  koNow(attacker) {
    this.ko = true;
    this.hp = 0;
    this.move = null;
    this.moveName = null;
    this.setState('airhit');
    this.vy = 0.17;
    this.y = Math.max(this.y, 0.01);
    this.vx = attacker.facing * 0.06;
  }
}
