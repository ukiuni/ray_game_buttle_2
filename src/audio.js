// Tiny WebAudio synthesiser for SFX and a looping per-stage BGM.

const SCALES = {
  kaen: { root: 45, scale: [0, 3, 5, 7, 10], tempo: 150 }, // A minor pentatonic
  raiga: { root: 43, scale: [0, 2, 3, 7, 8], tempo: 164 }, // G, darker
  hyoka: { root: 50, scale: [0, 2, 5, 7, 9], tempo: 132 }, // D major pentatonic
  title: { root: 48, scale: [0, 3, 5, 7, 10], tempo: 120 },
};

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  constructor(storage) {
    this.storage = storage;
    this.ctx = null;
    this.enabled = true;
    try {
      this.enabled = (storage && storage.getItem('rgb2.sound')) !== 'off';
    } catch {
      /* ignore */
    }
    this.bgm = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.7 : 0;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.32;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    try {
      this.storage && this.storage.setItem('rgb2.sound', on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    if (this.master) this.master.gain.value = on ? 0.7 : 0;
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, dur, type = 'square', vol = 0.3, slide = 0, when = 0, bus = this.sfxBus) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noiseHit(dur, vol = 0.4, freq = 2000, q = 1, when = 0, bus = this.sfxBus) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  play(name) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'light':
        this.noiseHit(0.08, 0.5, 1800, 1.2);
        this.tone(220, 0.07, 'square', 0.15, 0.5);
        break;
      case 'heavy':
        this.noiseHit(0.16, 0.7, 900, 0.8);
        this.tone(110, 0.18, 'sawtooth', 0.3, 0.4);
        break;
      case 'special':
        this.noiseHit(0.25, 0.6, 700, 0.7);
        this.tone(160, 0.3, 'sawtooth', 0.3, 0.3);
        break;
      case 'super':
        this.noiseHit(0.35, 0.8, 500, 0.6);
        this.tone(90, 0.4, 'sawtooth', 0.35, 0.3);
        break;
      case 'block':
        this.noiseHit(0.06, 0.4, 4000, 3);
        this.tone(900, 0.05, 'triangle', 0.15);
        break;
      case 'whoosh':
        this.noiseHit(0.12, 0.18, 1200, 0.5);
        break;
      case 'fireball':
        this.tone(300, 0.35, 'sawtooth', 0.22, 2.5);
        this.noiseHit(0.3, 0.3, 1500, 0.6);
        break;
      case 'superStart':
        for (let i = 0; i < 4; i++) this.tone(400 + i * 200, 0.25, 'square', 0.12, 1.5, i * 0.06);
        break;
      case 'ko':
        this.tone(220, 1.2, 'sawtooth', 0.35, 0.2);
        this.noiseHit(0.9, 0.6, 300, 0.5);
        break;
      case 'jump':
        this.tone(300, 0.08, 'triangle', 0.1, 1.6);
        break;
      case 'land':
        this.noiseHit(0.05, 0.15, 400, 1);
        break;
      case 'select':
        this.tone(880, 0.08, 'square', 0.15, 1.5);
        break;
      case 'confirm':
        this.tone(660, 0.1, 'square', 0.18);
        this.tone(990, 0.18, 'square', 0.18, 1, 0.08);
        break;
      case 'announce':
        this.tone(330, 0.3, 'square', 0.12);
        this.tone(495, 0.3, 'square', 0.1);
        break;
      case 'fight':
        this.tone(523, 0.12, 'square', 0.18);
        this.tone(784, 0.35, 'square', 0.18, 1, 0.1);
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'square', 0.15, 1, i * 0.12));
        break;
      case 'lose':
        [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.2, 1, i * 0.2));
        break;
      default:
        break;
    }
  }

  /** Start a simple generated BGM loop for a stage key. */
  startMusic(key) {
    if (!this.ctx) return;
    this.stopMusic();
    const conf = SCALES[key] || SCALES.title;
    const step = 60 / conf.tempo / 2; // eighth notes
    let next = this.ctx.currentTime + 0.1;
    let i = 0;
    const bassPat = [0, 0, 3, 0, 2, 0, 4, 3];
    const leadPat = [4, -1, 3, 2, -1, 4, 5, -1, 7, -1, 5, 4, 3, -1, 2, -1];
    const state = { stopped: false };
    const tick = () => {
      if (state.stopped || !this.ctx) return;
      while (next < this.ctx.currentTime + 0.25) {
        const when = next - this.ctx.currentTime;
        const bar = Math.floor(i / 16) % 4;
        const shift = [0, 0, 3, 2][bar];
        const deg = bassPat[i % 8] + shift;
        const note = conf.root + conf.scale[deg % 5] + 12 * Math.floor(deg / 5);
        if (this.enabled) {
          this.tone(midi(note), step * 0.9, 'sawtooth', 0.12, 1, when, this.musicBus);
          if (i % 4 === 0) this.tone(55, 0.14, 'sine', 0.5, 0.5, when, this.musicBus);
          if (i % 2 === 1) this.noiseHit(0.03, 0.08, 7000, 1, when, this.musicBus);
          if (i % 8 === 4) this.noiseHit(0.12, 0.2, 1800, 0.7, when, this.musicBus);
          const ld = leadPat[i % 16];
          if (ld >= 0 && key !== 'title') {
            const ln = conf.root + 24 + conf.scale[(ld + shift) % 5] + 12 * Math.floor((ld + shift) / 5);
            this.tone(midi(ln), step * 0.8, 'square', 0.05, 1, when, this.musicBus);
          }
        }
        next += step;
        i++;
      }
      state.timer = setTimeout(tick, 60);
    };
    tick();
    this.bgm = state;
  }

  stopMusic() {
    if (this.bgm) {
      this.bgm.stopped = true;
      clearTimeout(this.bgm.timer);
      this.bgm = null;
    }
  }
}
