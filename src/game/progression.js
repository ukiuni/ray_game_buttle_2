import { CHARACTERS } from './characters.js';

/**
 * Arcade ladder: the player fights every character (including a mirror match
 * in alternate colours) on the opponent's home stage. After the third stage the
 * ladder loops with a stronger CPU, so a run continues until the player loses.
 */
export class Run {
  constructor(playerId, storage = null) {
    this.playerId = playerId;
    this.stage = 1; // 1-based stage number
    this.wins = 0;
    this.storage = storage;
    const others = CHARACTERS.filter((c) => c.id !== playerId).map((c) => c.id);
    this.order = [...others, playerId];
  }

  get opponentId() {
    return this.order[(this.stage - 1) % this.order.length];
  }

  get loop() {
    return Math.floor((this.stage - 1) / this.order.length);
  }

  /** CPU difficulty level grows with every stage. */
  get cpuLevel() {
    return this.stage - 1;
  }

  get isMirror() {
    return this.opponentId === this.playerId;
  }

  get stageId() {
    return this.opponentId;
  }

  recordWin() {
    this.wins++;
    this.stage++;
    this.saveBest();
  }

  get best() {
    if (!this.storage) return this.wins;
    try {
      return Math.max(this.wins, Number(this.storage.getItem('rgb2.best') || 0));
    } catch {
      return this.wins;
    }
  }

  saveBest() {
    if (!this.storage) return;
    try {
      const b = Number(this.storage.getItem('rgb2.best') || 0);
      if (this.wins > b) this.storage.setItem('rgb2.best', String(this.wins));
    } catch {
      /* storage unavailable */
    }
  }
}
