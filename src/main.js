import './style.css';
import { CHARACTERS, getCharacter, STAGES } from './game/characters.js';
import { Match } from './game/match.js';
import { CpuAI } from './game/ai.js';
import { Run } from './game/progression.js';
import { GameRenderer } from './render/scene.js';
import { Controls } from './ui/controls.js';
import { Hud } from './ui/hud.js';
import { Audio } from './audio.js';
import { UpdateManager } from './update.js';
import { lockViewport, tryFullscreenLandscape } from './viewport.js';

const $ = (id) => document.getElementById(id);
const STEP = 1000 / 60;
const AUTO_NEXT_SECONDS = 5;

function safeStorage() {
  try {
    const s = window.localStorage;
    s.setItem('rgb2.test', '1');
    s.removeItem('rgb2.test');
    return s;
  } catch {
    return null;
  }
}

const storage = safeStorage();
const audio = new Audio(storage);
const renderer = new GameRenderer($('game'));
const controls = new Controls(document);
const hud = new Hud();

const G = {
  screen: 'loading',
  run: null,
  match: null,
  ai: null,
  paused: false,
  selected: 'kaen',
  matchEndTimer: 0,
  slowmo: 0,
  autoTimer: null,
  autoLeft: 0,
  resultHandled: false,
};

// ------------------------------------------------------------------ updates
const toast = (msg, ms = 2600) => {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), ms);
};

const updater = new UpdateManager({
  onStatus: (s) => {
    if (s === 'ready' && !updater.safe) toast('新しいバージョンがあります（試合が終わったら更新します）');
    if (s === 'applying' || s === 'reloading') toast('アップデートを適用しています…');
  },
});

const SAFE_SCREENS = new Set(['loading', 'title', 'select', 'gameover']);

// ------------------------------------------------------------------ screens
function showScreen(name) {
  G.screen = name;
  for (const el of document.querySelectorAll('.screen')) el.classList.remove('active');
  const el = $(`screen-${name}`);
  if (el) el.classList.add('active');
  const inGame = name === 'fight' || name === 'result' || name === 'gameover' || name === 'pause';
  hud.show(inGame && name !== 'gameover' && name !== 'result');
  $('controls').classList.toggle('hidden', name !== 'fight');
  controls.reset();
  updater.setSafe(SAFE_SCREENS.has(name));
  document.body.dataset.screen = name;
}

// title background slideshow
const titleBgs = ['kaen', 'raiga', 'hyoka'].map((id) => STAGES[id].image);
let titleBgIdx = 0;
function cycleTitleBg() {
  $('screen-title').querySelector('.title-bg').style.backgroundImage = `url(${titleBgs[titleBgIdx % titleBgs.length]})`;
  titleBgIdx++;
}
setInterval(() => G.screen === 'title' && cycleTitleBg(), 6000);

function goTitle() {
  stopAuto();
  G.match = null;
  G.run = null;
  cycleTitleBg();
  showScreen('title');
  audio.startMusic('title');
  $('best-record').textContent = `BEST ${bestRecord()}連勝`;
}

function bestRecord() {
  try {
    return Number((storage && storage.getItem('rgb2.best')) || 0);
  } catch {
    return 0;
  }
}

// ------------------------------------------------------------------ select
function buildSelect() {
  const cards = $('cards');
  cards.innerHTML = '';
  for (const c of CHARACTERS) {
    const d = document.createElement('div');
    d.className = 'card';
    d.dataset.id = c.id;
    d.innerHTML = `<img src="assets/px_${c.id}.png" alt="${c.name}" /><div><div class="cname">${c.name}</div><div class="ctitle">${c.title}</div></div>`;
    d.addEventListener('click', () => {
      audio.play('select');
      selectChar(c.id);
    });
    cards.appendChild(d);
  }
}

function statBars(c) {
  const power = Math.round(c.damageScale * 60);
  const speed = Math.round(c.walk * 1300);
  const reach = Math.round(c.reachScale * 60);
  const rows = [
    ['POWER', power],
    ['SPEED', speed],
    ['REACH', reach],
  ];
  return rows.map(([k, v]) => `<span>${k}</span><div class="stat-bar" style="width:${Math.min(100, v)}%"></div>`).join('');
}

function selectChar(id) {
  G.selected = id;
  for (const el of document.querySelectorAll('.card')) el.classList.toggle('selected', el.dataset.id === id);
  const c = getCharacter(id);
  const sn = c.specialNames;
  $('char-info').innerHTML = `
    <div class="cname">${c.name}</div>
    <div class="jp">${c.jpName}</div>
    <div class="ctitle">${c.title}</div>
    <div class="stats">${statBars(c)}</div>
    <div class="moves">
      ↓↘→+P：${sn.FIREBALL}<br/>
      →↓↘+P：${sn.RISING}<br/>
      ↓↙←+K：${sn.RUSH}<br/>
      強P+強K：${sn.SUPER}
    </div>`;
  renderer.showcase(id);
}

function goSelect() {
  stopAuto();
  showScreen('select');
  selectChar(G.selected);
  audio.startMusic('title');
}

// ------------------------------------------------------------------ match flow
function startRun(charId) {
  G.run = new Run(charId, storage);
  startMatch();
}

function startMatch() {
  stopAuto();
  const run = G.run;
  const p1 = getCharacter(run.playerId);
  const p2 = getCharacter(run.opponentId);
  const variant = run.isMirror ? 1 : 0;
  G.match = new Match(p1, p2);
  G.ai = new CpuAI(1, run.cpuLevel);
  G.matchEndTimer = 0;
  G.resultHandled = false;
  G.slowmo = 0;
  G.paused = false;

  // VS screen
  $('vs-p1').src = `assets/px_${p1.id}.png`;
  $('vs-p2').src = `assets/px_${p2.id}.png`;
  $('vs-p1-name').textContent = p1.name;
  $('vs-p2-name').textContent = p2.name + (variant ? ' (2P)' : '');
  $('vs-stage').textContent = `STAGE ${run.stage}${run.loop > 0 ? `  ― ${run.loop + 1}周目` : ''}`;
  $('vs-stage-name').textContent = STAGES[run.stageId].name;
  showScreen('vs');
  audio.play('confirm');
  renderer.setupMatch(p1.id, p2.id, variant, run.stageId);
  hud.setup(G.match, run.stage, run.wins, [p1.name, p2.name]);
  setTimeout(() => {
    if (G.screen !== 'vs') return;
    showScreen('fight');
    audio.startMusic(run.stageId);
  }, 2300);
}

function onMatchEnd(winner) {
  if (G.resultHandled) return;
  G.resultHandled = true;
  const run = G.run;
  if (winner === 0) {
    run.recordWin();
    audio.play('win');
    $('result-streak').textContent = `${run.wins}連勝！`;
    const cleared = (run.stage - 1) % 3 === 0;
    $('result-msg').textContent = cleared
      ? `全ステージ制覇！ 次は ${run.loop + 1}周目 ― CPUがさらに強くなる！`
      : `次のステージ ${run.stage}：VS ${getCharacter(run.opponentId).name}（${STAGES[run.stageId].name}）`;
    showScreen('result');
    startAuto();
  } else {
    audio.play('lose');
    audio.stopMusic();
    run.saveBest();
    $('gameover-streak').textContent = `記録：${run.wins}連勝（STAGE ${run.stage}で敗北）`;
    $('gameover-best').textContent = `ベスト記録：${Math.max(bestRecord(), run.wins)}連勝`;
    showScreen('gameover');
  }
}

function startAuto() {
  stopAuto();
  G.autoLeft = AUTO_NEXT_SECONDS;
  const circle = $('auto-circle');
  const tick = () => {
    $('auto-count').textContent = String(Math.ceil(G.autoLeft));
    circle.style.strokeDashoffset = String(106.8 * (1 - G.autoLeft / AUTO_NEXT_SECONDS));
    if (G.autoLeft <= 0) {
      stopAuto();
      startMatch();
      return;
    }
    G.autoLeft -= 0.1;
  };
  tick();
  G.autoTimer = setInterval(tick, 100);
}

function stopAuto() {
  if (G.autoTimer) clearInterval(G.autoTimer);
  G.autoTimer = null;
}

function pause(on) {
  if (G.screen !== 'fight' && G.screen !== 'pause') return;
  G.paused = on;
  showScreen(on ? 'pause' : 'fight');
  if (on) audio.suspend();
  else audio.resume();
}

// ------------------------------------------------------------------ simulation
function handleEvents(events) {
  for (const e of events) {
    renderer.handleEvent(e);
    switch (e.type) {
      case 'announce':
        hud.announce(e.text, !!e.ko);
        audio.play(e.fight ? 'fight' : e.ko ? 'ko' : 'announce');
        break;
      case 'hit':
        audio.play(['light', 'heavy', 'special', 'super'][e.strength]);
        hud.combo(e.attacker, e.combo);
        if (e.side === 0 && navigator.vibrate) {
          try {
            navigator.vibrate(e.strength >= 1 ? 30 : 12);
          } catch {
            /* ignore */
          }
        }
        break;
      case 'block':
        audio.play('block');
        break;
      case 'special':
        hud.special(e.name);
        audio.play(e.move === 'FIREBALL' ? 'fireball' : 'whoosh');
        break;
      case 'super': {
        hud.special(e.name);
        audio.play('superStart');
        const fl = $('flash');
        fl.classList.add('dark');
        fl.classList.remove('on');
        void fl.offsetWidth;
        fl.classList.add('on');
        break;
      }
      case 'ko': {
        G.slowmo = 70;
        const fl = $('flash');
        fl.classList.remove('dark', 'on');
        void fl.offsetWidth;
        fl.classList.add('on');
        break;
      }
      case 'jump':
        audio.play('jump');
        break;
      case 'knockdown':
        audio.play('heavy');
        break;
      default:
        break;
    }
  }
}

function stepGame() {
  const m = G.match;
  const p = controls.getInput();
  const c = G.ai.update(m);
  m.step([p, c]);
  handleEvents(m.drainEvents());
  hud.update(m);
  if (m.phase === 'matchEnd' && !G.resultHandled) {
    G.matchEndTimer++;
    if (G.matchEndTimer > 100) onMatchEnd(m.winner);
  }
}

let last = performance.now();
let acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dtMs = Math.min(100, now - last);
  last = now;
  const running = G.match && (G.screen === 'fight' || G.screen === 'result' || G.screen === 'gameover') && !G.paused;
  if (running) {
    let scale = 1;
    if (G.slowmo > 0) scale = 0.35;
    acc += dtMs * scale;
    let n = 0;
    while (acc >= STEP && n < 6) {
      stepGame();
      if (G.slowmo > 0) G.slowmo--;
      acc -= STEP;
      n++;
    }
    if (n === 6) acc = 0;
  }
  const showMatch = G.match && G.screen !== 'select' && G.screen !== 'title';
  try {
    renderer.frame(showMatch ? G.match : null, G.paused ? 0 : (dtMs / STEP) * (G.slowmo > 0 ? 0.35 : 1));
  } catch (err) {
    console.error(err);
  }
}

// ------------------------------------------------------------------ wiring
function firstInteraction() {
  audio.unlock();
  if (matchMedia('(pointer: coarse)').matches) tryFullscreenLandscape();
}

function bindUi() {
  $('start-btn').addEventListener('click', () => {
    firstInteraction();
    audio.play('confirm');
    goSelect();
  });
  $('select-back').addEventListener('click', () => goTitle());
  $('select-ok').addEventListener('click', () => {
    firstInteraction();
    startRun(G.selected);
  });
  $('next-btn').addEventListener('click', () => {
    stopAuto();
    startMatch();
  });
  $('quit-btn').addEventListener('click', () => {
    // stopping a run voluntarily records the streak and goes back to the title
    if (G.run) G.run.saveBest();
    goTitle();
  });
  $('retry-btn').addEventListener('click', () => startRun(G.run ? G.run.playerId : G.selected));
  $('reselect-btn').addEventListener('click', () => goSelect());
  $('title-btn').addEventListener('click', () => goTitle());
  $('pause-btn').addEventListener('click', () => pause(true));
  $('resume-btn').addEventListener('click', () => pause(false));
  $('pause-title-btn').addEventListener('click', () => {
    G.paused = false;
    goTitle();
  });
  $('howto-btn').addEventListener('click', () => $('screen-howto').classList.add('active'));
  $('howto-close').addEventListener('click', () => $('screen-howto').classList.remove('active'));
  const sb = $('sound-btn');
  const syncSound = () => (sb.textContent = `SOUND: ${audio.enabled ? 'ON' : 'OFF'}`);
  sb.addEventListener('click', () => {
    audio.unlock();
    audio.setEnabled(!audio.enabled);
    syncSound();
  });
  syncSound();
  document.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (G.screen === 'fight') pause(true);
      audio.suspend();
    } else if (G.screen !== 'pause') {
      audio.resume();
    }
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (G.screen === 'fight') pause(true);
      else if (G.screen === 'pause') pause(false);
    }
  });
}

async function boot() {
  lockViewport(() => renderer.resize());
  bindUi();
  buildSelect();
  const ver = document.querySelector('meta[name="app-version"]');
  $('version').textContent = `ver ${ver ? ver.content : 'dev'}`;
  requestAnimationFrame(loop);
  await renderer.preload((p) => {
    $('load-bar').style.width = `${Math.round(p * 100)}%`;
  });
  $('load-text').textContent = 'READY';
  goTitle();
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    updater.register().then(() => updater.check()).catch((e) => console.warn('SW registration failed', e));
  }
}

// Debug / test hooks (used by automated end-to-end tests)
window.__rgb2 = {
  get screen() {
    return G.screen;
  },
  get match() {
    return G.match;
  },
  get run() {
    return G.run;
  },
  get updater() {
    return updater;
  },
  renderer,
  /** Instantly deplete one side's HP (for testing the round/match flow). */
  koSide(side) {
    const m = G.match;
    if (!m || m.phase !== 'fight') return false;
    const loser = m.f[side];
    const winner = m.f[1 - side];
    loser.koNow(winner);
    m.onKO(side);
    return true;
  },
  setAutoNextSeconds(s) {
    G.autoLeft = s;
  },
};

boot();
