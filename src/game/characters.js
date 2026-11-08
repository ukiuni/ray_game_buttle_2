// Character definitions and frame data (60 fps).
// Hitboxes are expressed relative to the fighter origin (feet), with x pointing
// toward the opponent. Units are metres.

const base = {
  // standing normals
  LP: { startup: 4, active: 3, recovery: 7, damage: 30, hitstun: 15, blockstun: 10, box: [0.25, 1.15, 0.95, 1.5], level: 'high', push: 0.18, cancel: true, chain: true, gauge: 4, sfx: 'light' },
  HP: { startup: 7, active: 3, recovery: 17, damage: 80, hitstun: 21, blockstun: 15, box: [0.25, 1.1, 1.12, 1.5], level: 'high', push: 0.32, cancel: true, gauge: 8, sfx: 'heavy' },
  LK: { startup: 5, active: 3, recovery: 9, damage: 40, hitstun: 16, blockstun: 11, box: [0.2, 0.55, 1.05, 0.95], level: 'mid', push: 0.2, cancel: true, gauge: 4, sfx: 'light' },
  HK: { startup: 9, active: 4, recovery: 19, damage: 95, hitstun: 22, blockstun: 16, box: [0.2, 0.8, 1.3, 1.35], level: 'mid', push: 0.42, gauge: 8, sfx: 'heavy' },
  // crouching normals
  cLP: { startup: 4, active: 2, recovery: 7, damage: 25, hitstun: 14, blockstun: 9, box: [0.2, 0.6, 0.9, 0.9], level: 'mid', push: 0.15, cancel: true, chain: true, gauge: 4, sfx: 'light' },
  cHP: { startup: 6, active: 4, recovery: 20, damage: 85, hitstun: 22, blockstun: 14, box: [0.0, 0.9, 0.85, 2.1], level: 'mid', push: 0.25, antiAir: true, cancel: true, launch: true, gauge: 8, sfx: 'heavy' },
  cLK: { startup: 5, active: 3, recovery: 9, damage: 30, hitstun: 15, blockstun: 10, box: [0.2, 0.0, 1.05, 0.35], level: 'low', push: 0.18, cancel: true, chain: true, gauge: 4, sfx: 'light' },
  cHK: { startup: 9, active: 4, recovery: 23, damage: 90, hitstun: 30, blockstun: 15, box: [0.2, 0.0, 1.35, 0.35], level: 'low', push: 0.3, knockdown: true, gauge: 8, sfx: 'heavy' },
  // jumping normals (overheads)
  jLP: { startup: 4, active: 8, recovery: 3, damage: 35, hitstun: 15, blockstun: 10, box: [0.1, 0.6, 0.8, 1.2], level: 'overhead', push: 0.15, air: true, gauge: 4, sfx: 'light' },
  jHP: { startup: 7, active: 6, recovery: 4, damage: 80, hitstun: 20, blockstun: 14, box: [0.1, 0.4, 0.95, 1.1], level: 'overhead', push: 0.25, air: true, gauge: 8, sfx: 'heavy' },
  jLK: { startup: 4, active: 9, recovery: 3, damage: 40, hitstun: 15, blockstun: 10, box: [0.1, 0.2, 0.9, 0.8], level: 'overhead', push: 0.15, air: true, gauge: 4, sfx: 'light' },
  jHK: { startup: 7, active: 6, recovery: 4, damage: 90, hitstun: 20, blockstun: 14, box: [0.1, 0.1, 1.1, 0.75], level: 'overhead', push: 0.28, air: true, gauge: 8, sfx: 'heavy' },
};

// Special moves shared structure. Each character overrides names, colours and tuning.
const specials = {
  // 236 + P : projectile
  FIREBALL: { startup: 13, active: 0, recovery: 30, damage: 70, hitstun: 22, blockstun: 18, projectile: true, chip: 0.2, gauge: 10, level: 'mid', push: 0.35, sfx: 'special' },
  // 623 + P : rising anti-air (invincible on startup)
  RISING: { startup: 3, active: 12, recovery: 26, damage: 120, hitstun: 30, blockstun: 20, box: [0.05, 0.8, 0.85, 2.3], level: 'mid', push: 0.3, invuln: 8, launch: true, rise: 0.17, chip: 0.2, gauge: 10, sfx: 'special' },
  // 214 + K : forward rush attack
  RUSH: { startup: 8, active: 16, recovery: 18, damage: 100, hitstun: 24, blockstun: 16, box: [0.1, 0.5, 1.15, 1.4], level: 'mid', push: 0.4, dash: 0.12, chip: 0.2, gauge: 10, knockdown: true, sfx: 'special' },
  // HP + HK with full gauge : super
  SUPER: { startup: 10, active: 20, recovery: 30, damage: 300, hitstun: 50, blockstun: 25, box: [0.1, 0.3, 1.5, 1.9], level: 'mid', push: 0.5, dash: 0.15, invuln: 12, chip: 0.25, knockdown: true, launch: true, gauge: 0, super: true, sfx: 'super' },
};

function deepMerge(a, b) {
  const out = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b || {})])) {
    out[k] = { ...(a[k] || {}), ...((b && b[k]) || {}) };
  }
  return out;
}

export const CHARACTERS = [
  {
    id: 'kaen',
    name: 'KAEN',
    jpName: 'カエン',
    title: '紅蓮の拳士',
    stage: 'kaen',
    stageName: '火炎寺',
    hp: 1000,
    walk: 0.048,
    backWalk: 0.036,
    jumpV: 0.2,
    jumpH: 0.06,
    gravity: 0.0105,
    damageScale: 1.1,
    reachScale: 1.0,
    color: 0xe0402a,
    accent: 0xffc040,
    projColor: 0xff6a1a,
    specialNames: { FIREBALL: '烈火弾', RISING: '昇炎拳', RUSH: '紅蓮脚', SUPER: '奥義・鳳凰天翔' },
    moves: deepMerge(deepMerge(base, specials), {
      FIREBALL: { speed: 0.12 },
      RISING: { damage: 130 },
    }),
  },
  {
    id: 'raiga',
    name: 'RAIGA',
    jpName: 'ライガ',
    title: '迅雷の忍',
    stage: 'raiga',
    stageName: '雷鳴街',
    hp: 1000,
    walk: 0.062,
    backWalk: 0.05,
    jumpV: 0.215,
    jumpH: 0.075,
    gravity: 0.0115,
    damageScale: 1.05,
    reachScale: 1.02,
    color: 0x3a3f9a,
    accent: 0xffe03a,
    projColor: 0x7ad8ff,
    specialNames: { FIREBALL: '雷迅手裏剣', RISING: '天雷昇', RUSH: '疾風迅雷', SUPER: '奥義・万雷閃' },
    moves: deepMerge(deepMerge(base, specials), {
      LP: { startup: 3 },
      LK: { startup: 4 },
      FIREBALL: { speed: 0.17, startup: 11, damage: 60 },
      RUSH: { dash: 0.17, startup: 6 },
    }),
  },
  {
    id: 'hyoka',
    name: 'HYOKA',
    jpName: 'ヒョウカ',
    title: '氷華の舞姫',
    stage: 'hyoka',
    stageName: '氷華神社',
    hp: 980,
    walk: 0.052,
    backWalk: 0.042,
    jumpV: 0.205,
    jumpH: 0.065,
    gravity: 0.0105,
    damageScale: 0.95,
    reachScale: 1.08,
    color: 0xe8f4ff,
    accent: 0x4ec8ff,
    projColor: 0x9feaff,
    specialNames: { FIREBALL: '氷柱華', RISING: '雪月昇脚', RUSH: '氷輪旋風', SUPER: '奥義・絶対零華' },
    moves: deepMerge(deepMerge(base, specials), {
      FIREBALL: { speed: 0.09, damage: 80, hitstun: 26 },
      HK: { damage: 100 },
    }),
  },
];

export function getCharacter(id) {
  const c = CHARACTERS.find((ch) => ch.id === id);
  if (!c) throw new Error(`unknown character ${id}`);
  return c;
}

export const STAGES = {
  kaen: { id: 'kaen', name: '火炎寺', image: 'assets/bg_kaen.jpg', particles: 'embers', fog: 0x2a0f22, light: 0xffb27a },
  raiga: { id: 'raiga', name: '雷鳴街', image: 'assets/bg_raiga.jpg', particles: 'rain', fog: 0x0b0f2a, light: 0xa8b8ff },
  hyoka: { id: 'hyoka', name: '氷華神社', image: 'assets/bg_hyoka.jpg', particles: 'snow', fog: 0x0e2233, light: 0xd8f0ff },
};
