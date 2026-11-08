// Procedural pose-based animation for the rigged character models.
// A pose is a map of joint name -> [rx, ry, rz]; "hipsY" offsets the pelvis height
// and "lean" tilts the whole body. Poses are blended per frame.

const J = ['hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'handL', 'shR', 'elR', 'handR', 'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR'];

function P(def) {
  const p = { hipsY: 0, hipsZ: 0 };
  for (const j of J) p[j] = [0, 0, 0];
  for (const [k, v] of Object.entries(def)) p[k] = Array.isArray(v) ? [...v] : v;
  return p;
}

// Model faces +Z. Left side = +X. Lead (front) side = left.
// shoulder: -x swings arm forward, +z (L) / -z (R) raises sideways
// elbow: -x bends forearm forward/up. hip: -x lifts leg forward. knee: +x bends.
export const POSES = {
  guard: P({
    hipsY: -0.06,
    hips: [0, -0.55, 0], spine: [0.05, 0.15, 0], chest: [0.05, 0.2, 0], neck: [0, 0.1, 0], head: [-0.05, 0.1, 0],
    shL: [-1.15, 0, 0.35], elL: [-1.75, 0, 0], handL: [0, 0, 0],
    shR: [-0.85, 0, -0.45], elR: [-2.1, 0, 0], handR: [0, 0, 0],
    hipL: [-0.4, 0, 0.12], knL: [0.45, 0, 0], anL: [-0.05, 0, 0],
    hipR: [0.3, 0.2, -0.12], knR: [0.3, 0, 0], anR: [0.0, 0, 0],
  }),
  crouch: P({
    hipsY: -0.38,
    hips: [0, -0.55, 0], spine: [0.35, 0.15, 0], chest: [0.15, 0.2, 0], neck: [-0.3, 0, 0], head: [-0.15, 0.1, 0],
    shL: [-1.2, 0, 0.35], elL: [-1.7, 0, 0],
    shR: [-0.9, 0, -0.45], elR: [-2.0, 0, 0],
    hipL: [-1.45, 0, 0.25], knL: [2.0, 0, 0], anL: [-0.5, 0, 0],
    hipR: [-0.55, 0.2, -0.25], knR: [2.1, 0, 0], anR: [-0.6, 0, 0],
  }),
  jump: P({
    hipsY: 0.0,
    hips: [0, -0.5, 0], spine: [0.2, 0.1, 0], chest: [0.1, 0.2, 0],
    shL: [-1.0, 0, 0.5], elL: [-1.8, 0, 0],
    shR: [-0.7, 0, -0.5], elR: [-2.0, 0, 0],
    hipL: [-1.5, 0, 0.1], knL: [2.2, 0, 0], anL: [0.3, 0, 0],
    hipR: [-0.9, 0, -0.1], knR: [2.0, 0, 0], anR: [0.3, 0, 0],
  }),
  // ---- standing normals (strike poses) ----
  LP: P({
    hipsY: -0.06,
    hips: [0, -0.75, 0], spine: [0.05, -0.2, 0], chest: [0.05, -0.35, 0], neck: [0, 0.35, 0], head: [0, 0.3, 0],
    shL: [-1.55, -0.25, 0.1], elL: [-0.1, 0, 0],
    shR: [-0.85, 0, -0.45], elR: [-2.1, 0, 0],
    hipL: [-0.45, 0, 0.12], knL: [0.45, 0, 0], hipR: [0.35, 0.2, -0.12], knR: [0.3, 0, 0],
  }),
  HP: P({
    hipsY: -0.08,
    hips: [0, 0.15, 0], spine: [0.1, 0.3, 0], chest: [0.1, 0.55, 0], neck: [0, -0.5, 0], head: [0, -0.4, 0],
    shL: [-0.6, 0, 0.6], elL: [-2.0, 0, 0],
    shR: [-1.6, 0.35, -0.05], elR: [-0.05, 0, 0],
    hipL: [-0.55, 0, 0.12], knL: [0.5, 0, 0], hipR: [0.45, 0.1, -0.12], knR: [0.1, 0, 0],
  }),
  LK: P({
    hipsY: -0.02,
    hips: [0, -0.5, 0], spine: [-0.15, 0.1, 0], chest: [-0.05, 0.2, 0],
    shL: [-0.7, 0, 0.5], elL: [-1.9, 0, 0], shR: [-0.5, 0, -0.6], elR: [-2.0, 0, 0],
    hipL: [-1.45, 0, 0.05], knL: [0.15, 0, 0], anL: [0.6, 0, 0],
    hipR: [0.1, 0.2, -0.1], knR: [0.15, 0, 0],
  }),
  HK: P({
    hipsY: 0.02,
    hips: [0, 0.6, -0.15], spine: [-0.1, 0.3, -0.3], chest: [0, 0.3, -0.2], neck: [0, -0.4, 0.3],
    shL: [-0.6, 0, 1.0], elL: [-1.6, 0, 0], shR: [-0.3, 0, -0.9], elR: [-1.6, 0, 0],
    hipL: [0.1, 0, 0.1], knL: [0.2, 0, 0],
    hipR: [-1.2, 0.3, -1.25], knR: [0.15, 0, 0], anR: [0.6, 0, 0],
  }),
  cLP: P({
    hipsY: -0.38,
    hips: [0, -0.7, 0], spine: [0.35, -0.1, 0], chest: [0.1, -0.3, 0], neck: [-0.3, 0.3, 0],
    shL: [-1.55, -0.2, 0.1], elL: [-0.1, 0, 0], shR: [-0.9, 0, -0.45], elR: [-2.0, 0, 0],
    hipL: [-1.45, 0, 0.25], knL: [2.0, 0, 0], anL: [-0.5, 0, 0], hipR: [-0.55, 0.2, -0.25], knR: [2.1, 0, 0], anR: [-0.6, 0, 0],
  }),
  cHP: P({
    hipsY: -0.12,
    hips: [0, 0.1, 0], spine: [-0.1, 0.3, 0], chest: [-0.2, 0.5, 0], neck: [0.2, -0.3, 0], head: [0.2, -0.2, 0],
    shL: [-0.5, 0, 0.6], elL: [-1.9, 0, 0],
    shR: [-2.9, 0.2, -0.2], elR: [-0.6, 0, 0],
    hipL: [-0.6, 0, 0.12], knL: [0.7, 0, 0], hipR: [0.2, 0.1, -0.12], knR: [0.4, 0, 0],
  }),
  cLK: P({
    hipsY: -0.42,
    hips: [0, -0.4, 0], spine: [0.3, 0.1, 0], chest: [0.15, 0.2, 0], neck: [-0.3, 0, 0],
    shL: [-1.1, 0, 0.4], elL: [-1.8, 0, 0], shR: [-0.8, 0, -0.5], elR: [-2.0, 0, 0],
    hipL: [-1.05, 0, 0.3], knL: [0.2, 0, 0], anL: [0.7, 0, 0],
    hipR: [-0.6, 0.2, -0.25], knR: [2.3, 0, 0], anR: [-0.6, 0, 0],
  }),
  cHK: P({
    hipsY: -0.5,
    hips: [0, 0.7, 0], spine: [0.45, 0.2, 0], chest: [0.2, 0.3, 0], neck: [-0.4, -0.3, 0],
    shL: [-0.8, 0, 0.9], elL: [-0.8, 0, 0], shR: [0.2, 0, -0.9], elR: [-0.6, 0, 0],
    hipL: [-1.3, 0, 0.4], knL: [2.2, 0, 0], anL: [-0.5, 0, 0],
    hipR: [-1.45, 0.4, -1.1], knR: [0.1, 0, 0], anR: [0.8, 0, 0],
  }),
  jP: P({
    hips: [0.3, -0.5, 0], spine: [0.25, -0.2, 0], chest: [0.15, -0.3, 0],
    shL: [-1.0, -0.2, 0.3], elL: [-0.1, 0, 0], shR: [-0.6, 0, -0.5], elR: [-2.0, 0, 0],
    hipL: [-1.4, 0, 0.1], knL: [2.0, 0, 0], hipR: [-1.0, 0, -0.1], knR: [2.2, 0, 0],
  }),
  jK: P({
    hips: [0.2, -0.4, 0], spine: [-0.2, 0.1, 0], chest: [-0.1, 0.2, 0],
    shL: [-0.5, 0, 0.8], elL: [-1.6, 0, 0], shR: [-0.3, 0, -0.9], elR: [-1.6, 0, 0],
    hipL: [-1.1, 0, 0.1], knL: [0.1, 0, 0], anL: [0.6, 0, 0], hipR: [-0.7, 0, -0.1], knR: [2.2, 0, 0],
  }),
  FIREBALL: P({
    hipsY: -0.14,
    hips: [0, -0.2, 0], spine: [0.1, 0, 0], chest: [0.1, 0, 0], neck: [0, 0, 0],
    shL: [-1.5, 0, -0.1], elL: [-0.05, 0, 0], handL: [0, 0, 0],
    shR: [-1.5, 0, 0.1], elR: [-0.05, 0, 0],
    hipL: [-0.6, 0, 0.15], knL: [0.6, 0, 0], hipR: [0.5, 0.2, -0.15], knR: [0.4, 0, 0],
  }),
  FIREBALL_WIND: P({
    hipsY: -0.12,
    hips: [0, -0.9, 0], spine: [0.05, -0.3, 0], chest: [0.05, -0.4, 0], neck: [0, 0.6, 0],
    shL: [0.3, 0, 0.3], elL: [-1.6, 0, 0], shR: [0.4, 0, -0.3], elR: [-1.6, 0, 0],
    hipL: [-0.5, 0, 0.15], knL: [0.6, 0, 0], hipR: [0.4, 0.2, -0.15], knR: [0.4, 0, 0],
  }),
  RISING: P({
    hipsY: 0.05,
    hips: [0, 0.3, 0], spine: [-0.2, 0.3, 0], chest: [-0.2, 0.4, 0], neck: [0.3, -0.4, 0],
    shL: [-0.3, 0, 0.5], elL: [-1.8, 0, 0], shR: [-3.0, 0, 0.1], elR: [-0.15, 0, 0],
    hipL: [-1.6, 0, 0.1], knL: [1.9, 0, 0], hipR: [0.2, 0, -0.1], knR: [0.4, 0, 0],
  }),
  RUSH: P({
    hipsY: 0.05,
    hips: [0.1, -0.2, 0], spine: [-0.25, 0.1, 0], chest: [-0.1, 0.1, 0],
    shL: [-0.3, 0, 1.1], elL: [-0.6, 0, 0], shR: [0.3, 0, -1.1], elR: [-0.6, 0, 0],
    hipL: [-1.6, 0, 0], knL: [0.05, 0, 0], anL: [0.7, 0, 0], hipR: [0.4, 0, 0], knR: [1.4, 0, 0],
  }),
  hitHigh: P({
    hipsY: -0.06,
    hips: [0, -0.5, 0], spine: [-0.25, 0, 0], chest: [-0.3, 0.1, 0], neck: [-0.4, 0, 0], head: [-0.3, 0, 0],
    shL: [-0.3, 0, 0.6], elL: [-1.0, 0, 0], shR: [-0.2, 0, -0.7], elR: [-1.0, 0, 0],
    hipL: [-0.2, 0, 0.12], knL: [0.4, 0, 0], hipR: [0.45, 0.2, -0.12], knR: [0.35, 0, 0],
  }),
  hitLow: P({
    hipsY: -0.12,
    hips: [0, -0.5, 0], spine: [0.5, 0, 0], chest: [0.3, 0.1, 0], neck: [0.2, 0, 0],
    shL: [-0.4, 0, 0.3], elL: [-1.4, 0, 0], shR: [-0.5, 0, -0.3], elR: [-1.4, 0, 0],
    hipL: [-0.3, 0, 0.12], knL: [0.7, 0, 0], hipR: [0.35, 0.2, -0.12], knR: [0.6, 0, 0],
  }),
  block: P({
    hipsY: -0.1,
    hips: [0, -0.4, 0], spine: [0.15, 0, 0], chest: [0.1, 0.1, 0], neck: [0.2, 0, 0],
    shL: [-1.4, 0, -0.2], elL: [-2.3, 0, 0], shR: [-1.3, 0, 0.2], elR: [-2.4, 0, 0],
    hipL: [-0.45, 0, 0.12], knL: [0.6, 0, 0], hipR: [0.4, 0.2, -0.12], knR: [0.4, 0, 0],
  }),
  crouchBlock: P({
    hipsY: -0.4,
    hips: [0, -0.4, 0], spine: [0.45, 0, 0], chest: [0.2, 0.1, 0], neck: [-0.2, 0, 0],
    shL: [-1.4, 0, -0.2], elL: [-2.3, 0, 0], shR: [-1.3, 0, 0.2], elR: [-2.4, 0, 0],
    hipL: [-1.45, 0, 0.25], knL: [2.0, 0, 0], anL: [-0.5, 0, 0], hipR: [-0.55, 0.2, -0.25], knR: [2.1, 0, 0], anR: [-0.6, 0, 0],
  }),
  airhit: P({
    hips: [0, -0.3, 0], spine: [-0.4, 0, 0], chest: [-0.3, 0, 0], neck: [-0.5, 0, 0],
    shL: [-2.4, 0, 0.6], elL: [-0.4, 0, 0], shR: [-2.2, 0, -0.6], elR: [-0.4, 0, 0],
    hipL: [-0.6, 0, 0.2], knL: [0.9, 0, 0], hipR: [-0.1, 0, -0.2], knR: [0.5, 0, 0],
  }),
  down: P({
    hipsY: 0,
    hips: [0, 0, 0], spine: [-0.05, 0, 0], chest: [-0.05, 0, 0], neck: [0.2, 0.4, 0], head: [0, 0.3, 0],
    shL: [-0.3, 0, 1.2], elL: [-0.4, 0, 0], shR: [-0.2, 0, -1.1], elR: [-0.6, 0, 0],
    hipL: [-0.3, 0, 0.25], knL: [0.6, 0, 0], hipR: [-0.1, 0, -0.2], knR: [0.2, 0, 0],
  }),
  win: P({
    hipsY: -0.02,
    hips: [0, -0.3, 0], spine: [-0.05, 0.1, 0], chest: [-0.1, 0.2, 0], neck: [0.15, -0.1, 0], head: [-0.15, 0, 0],
    shL: [-0.4, 0, 0.3], elL: [-1.9, 0, 0],
    shR: [-3.0, 0.2, 0.15], elR: [-0.3, 0, 0],
    hipL: [-0.15, 0, 0.18], knL: [0.1, 0, 0], hipR: [0.15, 0.2, -0.18], knR: [0.1, 0, 0],
  }),
};

// Alternate super frames (flurry)
POSES.SUPER_A = { ...POSES.LP, hipsZ: 0 };
POSES.SUPER_B = { ...POSES.HP };
POSES.SUPER_C = { ...POSES.HK };

const NEUTRAL = P({});

function lerpPose(a, b, t, out = P({})) {
  out.hipsY = a.hipsY + (b.hipsY - a.hipsY) * t;
  out.hipsZ = (a.hipsZ || 0) + ((b.hipsZ || 0) - (a.hipsZ || 0)) * t;
  for (const j of J) {
    const pa = a[j] || NEUTRAL[j];
    const pb = b[j] || NEUTRAL[j];
    out[j] = [pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t];
  }
  return out;
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

/** Map a move name to its strike pose. */
function strikePose(name) {
  if (POSES[name]) return POSES[name];
  if (name === 'jLP' || name === 'jHP') return POSES.jP;
  if (name === 'jLK' || name === 'jHK') return POSES.jK;
  return POSES.LP;
}

export class Animator {
  constructor(model) {
    this.model = model;
    this.joints = model.userData.joints;
    this.chains = model.userData.chains;
    this.current = lerpPose(POSES.guard, POSES.guard, 0);
    this.base = this.joints.hips.position.y;
    this.time = 0;
    this.spin = 0;
    this.tilt = 0;
    this.flip = 0;
    this.lift = 0;
    this.lastState = null;
  }

  /** Compute target pose and extra transforms from fighter state. */
  target(f) {
    const t = this.time;
    const s = f.state;
    let pose = POSES.guard;
    let snap = 0.3;
    let tilt = 0;
    let spin = 0;
    let lift = 0; // 0..1 fraction of "lying on the floor"
    let flip = 0;
    const id = f.char.id;

    if (s === 'idle' || s === 'landing' || s === 'jumpsquat') {
      const breathe = Math.sin(t * 0.08) * 0.5 + 0.5;
      pose = lerpPose(POSES.guard, { ...POSES.guard, hipsY: POSES.guard.hipsY - 0.025, knL: [0.55, 0, 0], knR: [0.4, 0, 0], hipL: [-0.47, 0, 0.12], hipR: [0.25, 0.2, -0.12] }, breathe);
      if (s === 'jumpsquat') pose = lerpPose(pose, POSES.crouch, 0.4);
      if (s === 'landing') pose = lerpPose(pose, POSES.crouch, 0.3);
    } else if (s === 'walk') {
      const ph = t * (f.walkDir > 0 ? 0.2 : -0.17);
      const sw = Math.sin(ph);
      pose = lerpPose(POSES.guard, POSES.guard, 0);
      pose.hipL = [-0.4 + sw * 0.45, 0, 0.12];
      pose.knL = [0.45 + Math.max(0, -Math.cos(ph)) * 0.6, 0, 0];
      pose.hipR = [0.3 - sw * 0.45, 0.2, -0.12];
      pose.knR = [0.3 + Math.max(0, Math.cos(ph)) * 0.6, 0, 0];
      pose.hipsY = POSES.guard.hipsY - Math.abs(Math.cos(ph)) * 0.025;
    } else if (s === 'crouch') {
      pose = POSES.crouch;
    } else if (s === 'jump') {
      const up = f.vy > 0;
      pose = up ? lerpPose(POSES.guard, POSES.jump, 0.85) : POSES.jump;
      // Raiga somersaults on forward/back jumps
      if (f.jumpDir !== 0 && id === 'raiga') flip = -f.jumpDir * Math.max(0, Math.min(1, (f.stateFrame - 2) / 32)) * Math.PI * 2;
    } else if (s === 'attack' || s === 'airattack') {
      const m = f.move;
      const name = f.moveName;
      const fr = f.moveFrame;
      let from = s === 'airattack' ? POSES.jump : name.startsWith('c') ? POSES.crouch : POSES.guard;
      let strike = strikePose(name);
      if (name === 'FIREBALL') from = POSES.FIREBALL_WIND;
      if (name === 'SUPER') {
        const k = Math.floor(fr / 4) % 3;
        strike = [POSES.SUPER_A, POSES.SUPER_B, POSES.SUPER_C][k];
        from = POSES.guard;
      }
      if (name === 'RUSH' && id === 'hyoka') spin = fr > m.startup && fr <= m.startup + m.active ? (fr - m.startup) * 0.55 : 0;
      if (name === 'RUSH' && id === 'raiga') strike = { ...POSES.HP, hipsY: -0.1 };
      if (name === 'RISING' && id === 'hyoka') strike = { ...POSES.LK, hipL: [-2.8, 0, 0.1], knL: [0.1, 0, 0], spine: [-0.4, 0, 0] };
      let k;
      if (fr <= m.startup) k = easeOut(fr / Math.max(1, m.startup)) * 0.9;
      else if (fr <= m.startup + m.active) k = 1;
      else k = 1 - (fr - m.startup - m.active) / Math.max(1, m.recovery);
      pose = lerpPose(from, strike, Math.max(0, Math.min(1, k)));
      if (name === 'FIREBALL' && fr < m.startup) pose = lerpPose(POSES.guard, POSES.FIREBALL_WIND, Math.min(1, fr / (m.startup * 0.6)));
      snap = 0.75;
    } else if (s === 'hitstun') {
      pose = f.y > 0 ? POSES.airhit : f.lastHitLow ? POSES.hitLow : POSES.hitHigh;
      snap = f.stateFrame < 3 ? 0.9 : 0.25;
    } else if (s === 'blockstun') {
      pose = f.lastBlockLevel === 'crouch' ? POSES.crouchBlock : POSES.block;
      snap = 0.6;
    } else if (s === 'airhit' || s === 'fall') {
      pose = POSES.airhit;
      tilt = s === 'airhit' ? Math.min(1.3, f.stateFrame * 0.07) : 0;
      snap = 0.4;
    } else if (s === 'knockdown' || s === 'ko') {
      pose = POSES.down;
      tilt = Math.PI / 2;
      lift = 1;
      snap = 0.35;
    } else if (s === 'getup') {
      const k = Math.min(1, f.stateFrame / 20);
      pose = lerpPose(POSES.down, POSES.crouch, k);
      tilt = (Math.PI / 2) * (1 - k);
      lift = 1 - k;
      snap = 0.5;
    } else if (s === 'win') {
      const k = Math.min(1, f.stateFrame / 25);
      pose = lerpPose(POSES.guard, POSES.win, k);
      if (id === 'hyoka') pose = lerpPose(pose, { ...POSES.win, shR: [-0.4, 0, -0.3], elR: [-1.9, 0, 0], shL: [-2.9, 0, -0.1], elL: [-0.4, 0, 0], hipL: [-0.2, 0, 0.05], hipR: [0.05, 0, -0.05] }, k);
      snap = 0.15;
    }
    // block-ready stance when holding back while walking backwards
    if (s === 'walk' && f.walkDir < 0) {
      pose = lerpPose(pose, POSES.block, 0.15);
    }
    return { pose, snap, tilt, spin, lift, flip };
  }

  update(f, dt = 1) {
    this.time += dt;
    const { pose, snap, tilt, spin, lift, flip } = this.target(f);
    const k = 1 - Math.pow(1 - snap, dt);
    lerpPose(this.current, pose, k, this.current);
    this.tilt += (tilt - this.tilt) * Math.min(1, k * 1.2);
    this.spin = spin;
    this.flip = flip;
    this.lift = (this.lift || 0) + (lift - (this.lift || 0)) * Math.min(1, k * 1.2);
    this.apply();
    this.updateChains(f);
  }

  apply() {
    const c = this.current;
    const j = this.joints;
    for (const name of J) {
      const r = c[name];
      if (j[name]) j[name].rotation.set(r[0], r[1], r[2]);
    }
    j.hips.position.y = this.base + c.hipsY;
    j.hips.position.z = c.hipsZ || 0;
  }

  updateChains(f) {
    const t = this.time;
    const speed = Math.abs(f.vx) * 12 + (f.y > 0 ? 0.6 : 0);
    for (const ch of this.chains) {
      const n = ch.links.length;
      for (let i = 0; i < n; i++) {
        const wave = Math.sin(t * 0.12 + ch.phase - i * 0.7) * ch.sway * (0.4 + speed);
        // first link sets the direction, following links droop back towards vertical
        const base = i === 0 ? ch.base : [-ch.base[0] * 0.14, 0, 0];
        const gravity = 0;
        ch.links[i].rotation.set(base[0] + wave * 0.35 + gravity, base[1], base[2] + wave * 0.5);
      }
    }
  }
}
