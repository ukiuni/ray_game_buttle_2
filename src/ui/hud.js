const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = $('hud');
    this.p = [0, 1].map((i) => ({
      hp: $(`p${i + 1}-hp`),
      trail: $(`p${i + 1}-trail`),
      wins: $(`p${i + 1}-wins`),
      gauge: $(`p${i + 1}-gauge`),
      name: $(`p${i + 1}-name`),
      portrait: $(`p${i + 1}-portrait`),
      combo: $(`p${i + 1}-combo`),
      comboTimer: 0,
      last: { hp: -1, gauge: -1, wins: -1 },
    }));
    this.timer = $('timer');
    this.stageLabel = $('stage-label');
    this.announceEl = $('announce');
    this.specialEl = $('special-name');
    this.streakEl = $('streak-badge');
    this.lastTime = -1;
  }

  show(on) {
    this.el.classList.toggle('hidden', !on);
  }

  setup(match, stageNo, streak, names) {
    for (let i = 0; i < 2; i++) {
      const f = match.f[i];
      const p = this.p[i];
      p.name.textContent = names?.[i] || f.char.name;
      p.portrait.src = `assets/px_${f.char.id}.png`;
      p.last = { hp: -1, gauge: -1, wins: -1 };
      p.combo.classList.remove('show');
      // the "slot" (combo display) belongs to the attacker side
      p.gaugeWrap = p.gauge.parentElement;
    }
    this.stageLabel.textContent = `STAGE ${stageNo}`;
    this.streakEl.textContent = streak > 0 ? `${streak}連勝中` : '';
    this.streakEl.style.display = streak > 0 ? 'block' : 'none';
    this.lastTime = -1;
    this.update(match);
  }

  update(match) {
    for (let i = 0; i < 2; i++) {
      const f = match.f[i];
      const p = this.p[i];
      const hpPct = Math.max(0, (f.hp / f.maxHp) * 100);
      if (p.last.hp !== hpPct) {
        p.hp.style.width = `${hpPct}%`;
        p.trail.style.width = `${hpPct}%`;
        p.hp.classList.toggle('low', hpPct < 25);
        p.last.hp = hpPct;
      }
      const g = Math.round(f.gauge);
      if (p.last.gauge !== g) {
        p.gauge.style.width = `${g}%`;
        p.gaugeWrap.classList.toggle('full', g >= 100);
        p.last.gauge = g;
      }
      if (p.last.wins !== match.wins[i]) {
        p.wins.innerHTML = [0, 1].map((k) => `<i class="${k < match.wins[i] ? 'on' : ''}"></i>`).join('');
        p.last.wins = match.wins[i];
      }
      if (p.comboTimer > 0) {
        p.comboTimer--;
        if (p.comboTimer === 0) p.combo.classList.remove('show');
      }
    }
    const t = match.timeLeft;
    if (t !== this.lastTime) {
      this.timer.textContent = String(Math.max(0, t)).padStart(2, '0');
      this.lastTime = t;
    }
  }

  combo(attackerSide, count) {
    if (count < 2) return;
    const p = this.p[attackerSide];
    p.combo.textContent = `${count} HITS!`;
    p.combo.classList.add('show');
    p.comboTimer = 70;
  }

  announce(text, ko = false) {
    const el = this.announceEl;
    el.textContent = text;
    el.classList.remove('show', 'ko');
    void el.offsetWidth;
    el.classList.add('show');
    if (ko) el.classList.add('ko');
  }

  special(text) {
    const el = this.specialEl;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
}
