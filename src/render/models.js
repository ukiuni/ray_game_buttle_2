import * as THREE from 'three';

// Procedural, rigged character models. Each character is built from lathe /
// sphere / tube primitives attached to a joint hierarchy so it can be posed by
// the animator. Detail levels are tuned so every character is ~20,000 triangles.

let gradientMap = null;
function getGradient() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 215, 215, 215, 255, 255, 255, 255, 255]);
  gradientMap = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}

function toon(color, map = null, extra = {}) {
  return new THREE.MeshToonMaterial({ color, map, gradientMap: getGradient(), ...extra });
}

function metal(color) {
  return new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.28 });
}

/** Smooth limb built from a lathe profile: tapers from rTop to rBot with a bulge. */
function limbGeometry(rTop, rMid, rBot, len, seg, rows, bulgeAt = 0.4) {
  const pts = [];
  // bottom cap to top cap, increasing y
  const capRows = 3;
  for (let i = 0; i <= capRows; i++) {
    const a = (i / capRows) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.sin(a) * rBot + 1e-4, -len - Math.cos(a) * rBot * 0.6));
  }
  for (let i = 1; i < rows; i++) {
    const t = i / rows; // 0 bottom -> 1 top
    const u = 1 - t; // distance from top 0..1
    let r;
    if (u < bulgeAt) {
      const k = u / bulgeAt;
      r = rTop + (rMid - rTop) * Math.sin((k * Math.PI) / 2);
    } else {
      const k = (u - bulgeAt) / (1 - bulgeAt);
      r = rMid + (rBot - rMid) * (1 - Math.cos((k * Math.PI) / 2));
    }
    pts.push(new THREE.Vector2(r, -len * u));
  }
  for (let i = 0; i <= capRows; i++) {
    const a = (i / capRows) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * rTop + 1e-4, Math.sin(a) * rTop * 0.6));
  }
  return new THREE.LatheGeometry(pts, seg);
}

/** Torso-like lathe from a list of [y, r] pairs. */
function latheFrom(profile, seg) {
  return new THREE.LatheGeometry(profile.map(([y, r]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
}

function mesh(geo, mat, parent, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.rot) m.rotation.set(...opts.rot);
  if (opts.scale) m.scale.set(...opts.scale);
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = false;
  if (parent) parent.add(m);
  return m;
}

export function countTriangles(obj) {
  let tris = 0;
  obj.traverse((o) => {
    if (o.isMesh && o.geometry) {
      const g = o.geometry;
      tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    }
  });
  return Math.round(tris);
}

const PALETTES = {
  kaen: [
    { skin: 0xd99a6c, cloth: 0xffffff, hair: 0xc8241c, glove: 0xd42a20, belt: 0x161616, band: 0x1a1a1a, trim: 0xffc23a, shoe: 0x3a2418 },
    { skin: 0xd99a6c, cloth: 0x8fb4ff, hair: 0x2a2a38, glove: 0x2a52c8, belt: 0xf4f4f4, band: 0xf0f0f0, trim: 0xb8e0ff, shoe: 0x202430 },
  ],
  raiga: [
    { skin: 0xf2d2be, cloth: 0xffffff, hair: 0xb8c4e8, glove: 0x23224a, belt: 0x5a2a8a, scarf: 0xffd21e, guard: 0xaab4c8, wrap: 0xe8e2d0, shoe: 0x1a1a2a },
    { skin: 0xf2d2be, cloth: 0xff9a9a, hair: 0x1c1c22, glove: 0x4a1418, belt: 0x8a1a1a, scarf: 0xff3a3a, guard: 0x3a3a40, wrap: 0x2a2a2a, shoe: 0x241010 },
  ],
  hyoka: [
    { skin: 0xf6e0d4, cloth: 0xffffff, hair: 0xb8d4f4, tights: 0x2c3c5c, boot: 0xf2f8ff, sash: 0x3ab4f0, crystal: 0x9fe6ff, wrap: 0xffffff },
    { skin: 0xf6e0d4, cloth: 0xffb8e0, hair: 0x2a1a3a, tights: 0x3a1a2a, boot: 0x2a1a2a, sash: 0xff4aa0, crystal: 0xff9ae0, wrap: 0xffe0f0 },
  ],
};

const BUILD = {
  kaen: { scale: 0.94, shoulderW: 0.235, chestR: 0.2, waistR: 0.15, armR: 0.058, foreR: 0.05, thighR: 0.095, shinR: 0.07, armLen: 0.28, foreLen: 0.26, thighLen: 0.44, shinLen: 0.43, neckR: 0.055, headR: 0.112 },
  raiga: { scale: 0.97, shoulderW: 0.205, chestR: 0.175, waistR: 0.13, armR: 0.047, foreR: 0.042, thighR: 0.083, shinR: 0.06, armLen: 0.3, foreLen: 0.28, thighLen: 0.47, shinLen: 0.46, neckR: 0.048, headR: 0.108 },
  hyoka: { scale: 0.92, shoulderW: 0.18, chestR: 0.158, waistR: 0.105, armR: 0.04, foreR: 0.034, thighR: 0.085, shinR: 0.056, armLen: 0.27, foreLen: 0.25, thighLen: 0.47, shinLen: 0.45, neckR: 0.04, headR: 0.106 },
};

/**
 * Build a character model.
 * @param {string} id character id
 * @param {{cloth?:THREE.Texture, face?:THREE.Texture}} textures
 * @param {number} variant 0 = default colours, 1 = alternate colours (mirror match)
 */
export function buildCharacter(id, textures = {}, variant = 0) {
  const pal = PALETTES[id][variant];
  const B = BUILD[id];
  const J = {};
  const chains = [];
  const root = new THREE.Group();
  root.name = `char-${id}`;
  const body = new THREE.Group(); // scaled container
  body.scale.setScalar(B.scale);
  root.add(body);

  const clothMap = textures.cloth || null;
  const mats = {
    skin: toon(pal.skin),
    cloth: toon(pal.cloth, clothMap),
    hair: toon(pal.hair),
    face: toon(0xffffff, textures.face || null),
    dark: toon(0x1a1a1a),
    eye: toon(0xffffff),
  };
  if (!textures.face) mats.face.color.set(pal.skin);

  const joint = (name, parent, x, y, z) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    J[name] = g;
    return g;
  };

  const legLen = B.thighLen + B.shinLen + 0.07;
  const hips = joint('hips', body, 0, legLen, 0);
  const spine = joint('spine', hips, 0, 0.1, 0);
  const chest = joint('chest', spine, 0, 0.12, 0);
  const neck = joint('neck', chest, 0, 0.38, 0);
  const head = joint('head', neck, 0, 0.07, 0);

  // ---------------- torso -------------------------------------------------
  const cR = B.chestR;
  const wR = B.waistR;
  const female = id === 'hyoka';
  const torsoProfile = [
    [-0.02, wR * 0.95],
    [0.04, wR * 1.0],
    [0.12, wR * 1.08 + (cR - wR) * 0.3],
    [0.2, cR * 0.98],
    [0.26, cR * 1.03],
    [0.31, cR * 1.0],
    [0.345, cR * 0.86],
    [0.37, cR * 0.6],
    [0.385, B.neckR * 1.25],
    [0.39, 0.0],
  ];
  const torso = mesh(latheFrom(torsoProfile, 44), mats.cloth, chest, { scale: [1.32, 1, 0.82] });
  torso.name = 'torso';
  // abdomen
  mesh(latheFrom([[-0.02, wR * 1.05], [0.04, wR * 0.98], [0.1, wR * 0.96], [0.14, wR * 1.0]], 36), id === 'kaen' ? mats.cloth : mats.cloth, spine, { scale: [1.3, 1, 0.85] });
  // pelvis
  mesh(latheFrom([[-0.14, 0.0], [-0.13, wR * 0.7], [-0.09, wR * 1.12], [-0.02, wR * 1.18], [0.06, wR * 1.1], [0.11, wR * 1.04]], 36), female ? toon(pal.tights) : mats.cloth, hips, { scale: [1.35, 1, 0.9] });

  if (female) {
    // bust
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.068, 22, 16), mats.cloth, chest, { pos: [s * 0.068, 0.235, 0.085], scale: [1, 0.92, 0.9] });
    // mandarin collar
    mesh(new THREE.CylinderGeometry(B.neckR * 1.35, B.neckR * 1.5, 0.05, 40, 1, true), toon(pal.sash), chest, { pos: [0, 0.39, 0] });
  } else if (id === 'kaen') {
    // open gi chest: pectorals + V-shaped skin area and gold trim collar
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.085, 16, 10), mats.skin, chest, { pos: [s * 0.075, 0.25, 0.1], scale: [1.1, 0.8, 0.62] });
    const trimMat = toon(pal.trim);
    for (const s of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.09, 0.38, 0.05),
        new THREE.Vector3(s * 0.11, 0.3, 0.155),
        new THREE.Vector3(s * 0.05, 0.16, 0.175),
        new THREE.Vector3(-s * 0.02, 0.04, 0.16),
      ]);
      mesh(new THREE.TubeGeometry(curve, 24, 0.016, 8, false), trimMat, chest);
    }
    // abs (visible six-pack under open gi)
    for (let r = 0; r < 3; r++) for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.03, 10, 6), mats.skin, chest, { pos: [s * 0.03, 0.13 - r * 0.045, 0.142 - r * 0.004], scale: [1, 0.8, 0.5] });
  } else {
    // raiga: chest armour plate + diagonal strap
    mesh(new THREE.SphereGeometry(0.16, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2.3), metal(pal.guard), chest, { pos: [0, 0.22, 0.02], scale: [1.25, 0.7, 0.9], rot: [Math.PI / 2 - 0.2, 0, 0] });
    mesh(new THREE.TorusGeometry(0.2, 0.014, 6, 40), toon(pal.belt), chest, { pos: [0, 0.2, 0], rot: [0.2, 0, 0.8], scale: [1.15, 1, 0.8] });
  }

  // belt / sash
  const beltMat = toon(pal.belt || pal.sash);
  mesh(new THREE.TorusGeometry(wR * 1.18, 0.024, 6, 32), beltMat, hips, { pos: [0, 0.07, 0], rot: [Math.PI / 2, 0, 0], scale: [1.3, 0.9, 1] });
  // belt knot + tails (animated chains)
  mesh(new THREE.SphereGeometry(0.035, 16, 12), beltMat, hips, { pos: [0.02, 0.07, wR * 1.05], scale: [1.3, 1, 0.7] });
  for (const s of [-1, 1]) {
    const c = makeChain(hips, 3, 0.07, (len) => mesh(new THREE.BoxGeometry(0.04, len, 0.012, 1, 2, 1), beltMat, null, { pos: [0, -len / 2, 0] }), [s * 0.03 + 0.02, 0.05, wR * 1.1]);
    c.sway = 0.3;
    c.phase = s;
    chains.push(c);
  }

  // ---------------- head ---------------------------------------------------
  const hR = B.headR;
  mesh(new THREE.CylinderGeometry(B.neckR * 0.95, B.neckR * 1.1, 0.12, 28, 3), mats.skin, neck, { pos: [0, 0.0, 0] });
  const skull = mesh(new THREE.SphereGeometry(hR, 28, 18), mats.skin, head, { pos: [0, hR, 0], scale: [0.92, 1.12, 1] });
  skull.name = 'skull';
  // jaw
  mesh(new THREE.SphereGeometry(hR * 0.72, 16, 10), mats.skin, head, { pos: [0, hR * 0.55, hR * 0.12], scale: [0.95, 0.85, 0.95] });
  // face decal: partial sphere in front with the generated face texture
  const faceGeo = new THREE.SphereGeometry(hR * 1.012, 24, 18, Math.PI / 2 - 0.8, 1.6, 1.0, 1.05);
  const face = mesh(faceGeo, mats.face, head, { pos: [0, hR, 0], scale: [0.92, 1.12, 1], shadow: false });
  face.name = 'face';
  // ears
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(hR * 0.22, 10, 8), mats.skin, head, { pos: [s * hR * 0.9, hR * 1.0, -hR * 0.05], scale: [0.45, 1, 0.75] });

  buildHair(id, head, hR, mats, pal, chains);

  // ---------------- arms ----------------------------------------------------
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const sh = joint('sh' + side, chest, s * B.shoulderW, 0.31, 0);
    const el = joint('el' + side, sh, 0, -B.armLen, 0);
    const hand = joint('hand' + side, el, 0, -B.foreLen, 0);

    // deltoid
    const sleeveless = id !== 'raiga';
    const delt = mesh(new THREE.SphereGeometry(B.armR * 1.45, 18, 12), sleeveless ? mats.skin : mats.cloth, sh, { pos: [s * 0.01, -0.02, 0], scale: [1, 1.05, 1] });
    delt.name = 'deltoid';
    const armMat = id === 'raiga' ? mats.cloth : mats.skin;
    mesh(limbGeometry(B.armR * 1.15, B.armR * 1.2, B.armR * 0.85, B.armLen, 20, 8, 0.35), armMat, sh);
    mesh(limbGeometry(B.foreR * 1.15, B.foreR * 1.15, B.foreR * 0.78, B.foreLen, 20, 8, 0.3), armMat, el);
    // elbow joint filler
    mesh(new THREE.SphereGeometry(B.foreR * 1.12, 12, 8), armMat, el);

    // forearm accessories
    if (id === 'raiga') {
      mesh(new THREE.CylinderGeometry(B.foreR * 1.45, B.foreR * 1.25, B.foreLen * 0.62, 24, 2, true), metal(pal.guard), el, { pos: [0, -B.foreLen * 0.55, 0] });
      for (let k = 0; k < 3; k++) mesh(new THREE.TorusGeometry(B.foreR * 1.45, 0.006, 4, 20), metal(0x8890a8), el, { pos: [0, -B.foreLen * (0.3 + k * 0.22), 0], rot: [Math.PI / 2, 0, 0] });
    } else {
      // wrist wraps
      mesh(new THREE.CylinderGeometry(B.foreR * 0.95, B.foreR * 0.9, B.foreLen * 0.3, 28, 4, true), toon(id === 'kaen' ? pal.glove : pal.wrap), el, { pos: [0, -B.foreLen * 0.84, 0] });
    }

    // fist
    const gloveMat = toon(pal.glove || pal.skin);
    const handMat = id === 'hyoka' ? mats.skin : gloveMat;
    buildFist(hand, handMat, s, B.foreR, id === 'kaen' ? toon(pal.trim) : null);
  }

  // ---------------- legs ----------------------------------------------------
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? 1 : -1;
    const hp = joint('hip' + side, hips, s * (wR * 0.75), -0.05, 0);
    const kn = joint('kn' + side, hp, 0, -B.thighLen, 0);
    const an = joint('an' + side, kn, 0, -B.shinLen, 0);
    let thighMat = mats.cloth;
    let shinMat = mats.cloth;
    if (id === 'hyoka') {
      thighMat = toon(pal.tights);
      shinMat = toon(pal.boot);
    }
    const baggy = id === 'kaen' ? 1.35 : 1.0;
    mesh(limbGeometry(B.thighR * 1.1 * baggy, B.thighR * 1.15 * baggy, B.thighR * 0.75 * baggy, B.thighLen, 22, 8, 0.3), thighMat, hp);
    mesh(new THREE.SphereGeometry(B.shinR * 1.15 * baggy, 14, 10), thighMat, kn);
    mesh(limbGeometry(B.shinR * 1.05 * baggy, B.shinR * 1.15 * baggy, B.shinR * 0.7 * (id === 'kaen' ? 1.5 : 1), B.shinLen, 22, 8, 0.3), shinMat, kn);
    if (id === 'raiga') {
      // shin wraps
      for (let k = 0; k < 3; k++) mesh(new THREE.TorusGeometry(B.shinR * (1.02 - k * 0.1), 0.014, 5, 20), toon(pal.wrap), kn, { pos: [0, -B.shinLen * (0.45 + k * 0.16), 0], rot: [Math.PI / 2 + 0.15, 0, 0] });
    }
    if (id === 'hyoka') {
      // boot cuff
      mesh(new THREE.TorusGeometry(B.shinR * 1.12, 0.016, 5, 24), toon(pal.sash), kn, { pos: [0, -B.shinLen * 0.15, 0], rot: [Math.PI / 2, 0, 0] });
    }
    // foot
    const footMat = id === 'kaen' ? mats.skin : id === 'raiga' ? toon(pal.shoe) : toon(pal.boot);
    mesh(new THREE.SphereGeometry(0.05, 16, 10), footMat, an, { pos: [0, -0.035, 0.06], scale: [0.95, 0.6, 2.05] });
    mesh(new THREE.SphereGeometry(0.045, 12, 8), footMat, an, { pos: [0, -0.02, -0.01], scale: [1, 1, 1] });
    if (id === 'kaen') {
      // toes
      for (let t = 0; t < 4; t++) mesh(new THREE.SphereGeometry(0.012, 8, 5), mats.skin, an, { pos: [(t - 1.5) * 0.02, -0.05, 0.155], scale: [1, 0.8, 1.3] });
    }
  }

  // ---------------- character specific extras -------------------------------
  if (id === 'kaen') {
    // gi skirt (lower jacket) flaps over hips
    mesh(latheFrom([[-0.2, wR * 1.45], [-0.12, wR * 1.32], [-0.04, wR * 1.25], [0.05, wR * 1.2]], 56), mats.cloth, hips, { scale: [1.32, 1, 0.92] });
  } else if (id === 'raiga') {
    // long scarf: neck wrap + two flowing tails
    const scarfMat = toon(pal.scarf, null, { side: THREE.DoubleSide });
    mesh(new THREE.TorusGeometry(B.neckR * 1.55, 0.03, 10, 32), scarfMat, neck, { pos: [0, 0.0, 0], rot: [Math.PI / 2 - 0.1, 0, 0], scale: [1.1, 1, 1] });
    for (const s of [-1, 1]) {
      const c = makeChain(neck, 8, 0.075, (len) => mesh(new THREE.BoxGeometry(0.07, len, 0.01, 2, 2, 1), scarfMat, null, { pos: [0, -len / 2, 0] }), [s * 0.03, -0.01, -B.neckR * 1.5]);
      c.base = [1.25 + (s > 0 ? 0.1 : 0.3), 0, s * 0.15];
      c.sway = 0.55;
      c.phase = s * 1.7;
      chains.push(c);
    }
    // waist pouch
    mesh(new THREE.BoxGeometry(0.06, 0.07, 0.035, 4, 4, 2), toon(0x2a2030), hips, { pos: [-wR * 1.2, 0.02, 0.04] });
  } else if (id === 'hyoka') {
    // qipao skirt panels (front & back) hanging from the hips
    const panelGeo = new THREE.CylinderGeometry(wR * 1.2, wR * 1.5, 0.3, 24, 6, true, -0.62, 1.24);
    mesh(panelGeo, toon(pal.cloth, clothMap, { side: THREE.DoubleSide }), hips, { pos: [0, -0.12, 0], scale: [1.32, 1, 0.98] });
    const back = mesh(panelGeo, toon(pal.cloth, clothMap, { side: THREE.DoubleSide }), hips, { pos: [0, -0.12, 0], scale: [1.32, 1, 0.98], rot: [0, Math.PI, 0] });
    back.name = 'skirtBack';
    // sash ribbons
    for (const s of [-1, 1]) {
      const c = makeChain(hips, 4, 0.07, (len) => mesh(new THREE.BoxGeometry(0.045, len, 0.008, 2, 3, 1), toon(pal.sash, null, { side: THREE.DoubleSide }), null, { pos: [0, -len / 2, 0] }), [s * wR * 1.05, 0.06, -wR * 0.8]);
      c.sway = 0.4;
      c.phase = s;
      chains.push(c);
    }
  }

  root.userData = { id, joints: J, chains, variant, build: B };
  root.traverse((o) => {
    if (o.isMesh) o.frustumCulled = false;
  });
  return root;
}

/** Create a chain of joints (for hair, scarves, belt tails) that the animator sways. */
function makeChain(parent, n, segLen, makeSeg, pos) {
  const links = [];
  let p = parent;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    if (i === 0) g.position.set(...pos);
    else g.position.set(0, -segLen, 0);
    p.add(g);
    const m = makeSeg(segLen, i);
    if (m) g.add(m);
    links.push(g);
    p = g;
  }
  return { links, base: [0, 0, 0], sway: 0.3, phase: 0 };
}

function buildFist(hand, mat, s, r, trimMat) {
  // palm block
  mesh(new THREE.SphereGeometry(r * 1.25, 12, 9), mat, hand, { pos: [0, -r * 0.9, 0.0], scale: [0.9, 1.15, 1.05] });
  // knuckles / curled fingers
  for (let k = 0; k < 4; k++) {
    mesh(new THREE.SphereGeometry(r * 0.42, 10, 6), mat, hand, { pos: [s * (k - 1.5) * r * 0.5 * -1, -r * 1.85, r * 0.45], scale: [1, 1.1, 1.2] });
  }
  // thumb
  const thumb = new THREE.CapsuleGeometry(r * 0.3, r * 0.7, 6, 12, 1);
  mesh(thumb, mat, hand, { pos: [-s * r * 0.75, -r * 1.2, r * 0.7], rot: [0.6, 0, s * 0.9] });
  if (trimMat) mesh(new THREE.TorusGeometry(r * 1.1, r * 0.18, 8, 28), trimMat, hand, { pos: [0, -r * 0.2, 0], rot: [Math.PI / 2, 0, 0] });
}

function buildHair(id, head, hR, mats, pal, chains) {
  const hairMat = mats.hair;
  // scalp cap
  mesh(new THREE.SphereGeometry(hR * 1.06, 26, 12, 0, Math.PI * 2, 0, Math.PI * 0.44), hairMat, head, { pos: [0, hR * 1.04, -hR * 0.04], scale: [0.98, 1.12, 1.05], rot: [-0.6, 0, 0] });
  const rnd = mulberry(id.length * 97 + id.charCodeAt(0));
  if (id === 'kaen') {
    // wild spiky crimson hair
    for (let i = 0; i < 36; i++) {
      const th = 0.15 + rnd() * 1.25; // polar from top
      const ph = Math.PI * (0.15 + rnd() * 1.7) + Math.PI / 2; // avoid face
      const dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      if (dir.z > 0.55 && dir.y < 0.5) continue;
      const len = hR * (0.7 + rnd() * 0.75);
      addSpike(head, hairMat, dir, hR, len, hR * 0.24, [0, hR * 1.1, -hR * 0.05], 0.55);
    }
    // front bangs pointing up/forward
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) / 3;
      const dir = new THREE.Vector3(x * 0.6, 0.8, 0.55).normalize();
      addSpike(head, hairMat, dir, hR, hR * 0.75, hR * 0.22, [x * hR * 0.4, hR * 1.55, hR * 0.45], 0.2);
    }
    // headband with long tails
    const bandMat = toon(pal.band);
    mesh(new THREE.TorusGeometry(hR * 0.98, hR * 0.11, 8, 40), bandMat, head, { pos: [0, hR * 1.52, -hR * 0.02], rot: [Math.PI / 2 - 0.12, 0, 0], scale: [0.95, 1.05, 1.4] });
    // flame emblem
    mesh(new THREE.ConeGeometry(hR * 0.16, hR * 0.36, 12), toon(pal.trim), head, { pos: [0, hR * 1.68, hR * 0.98], rot: [0.2, 0, 0] });
    for (const s of [-1, 1]) {
      const c = makeChain(head, 5, hR * 0.55, (len) => mesh(new THREE.BoxGeometry(hR * 0.22, len, 0.008, 1, 2, 1), toon(pal.band, null, { side: THREE.DoubleSide }), null, { pos: [0, -len / 2, 0] }), [s * hR * 0.15, hR * 1.45, -hR * 1.05]);
      c.base = [1.0, 0, s * 0.35];
      c.sway = 0.6;
      c.phase = s * 0.8;
      chains.push(c);
    }
  } else if (id === 'raiga') {
    // messy swept-back silver hair
    for (let i = 0; i < 34; i++) {
      const th = 0.25 + rnd() * 1.35;
      const ph = Math.PI * (0.1 + rnd() * 1.8) + Math.PI / 2;
      const dir = new THREE.Vector3(Math.sin(th) * Math.cos(ph), Math.cos(th) * 0.8, Math.sin(th) * Math.sin(ph) - 0.6).normalize();
      if (dir.z > 0.4 && dir.y < 0.4) continue;
      const len = hR * (0.6 + rnd() * 0.9);
      addSpike(head, hairMat, dir, hR, len, hR * 0.2, [0, hR * 1.1, -hR * 0.05], 0.4);
    }
    // fringe falling over forehead
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) / 2.5;
      const dir = new THREE.Vector3(x * 0.4 - 0.15, -0.65, 0.5).normalize();
      addSpike(head, hairMat, dir, hR, hR * 0.38, hR * 0.18, [x * hR * 0.55, hR * 1.92, hR * 0.42], 0.1);
    }
  } else {
    // hyoka: bangs, side locks, high ponytail
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) / 4;
      const dir = new THREE.Vector3(x * 0.25, -0.85, 0.35).normalize();
      addSpike(head, hairMat, dir, hR, hR * (0.22 + Math.abs(x) * 0.5), hR * 0.2, [x * hR * 0.8, hR * 2.12, hR * 0.42 - Math.abs(x) * hR * 0.25], 0.08);
    }
    for (const s of [-1, 1]) {
      // long side locks
      const c = makeChain(head, 5, hR * 0.45, (len, i) => mesh(new THREE.ConeGeometry(hR * (0.16 - i * 0.022), len * 1.2, 12, 2), hairMat, null, { pos: [0, -len / 2, 0], rot: [Math.PI, 0, 0] }), [s * hR * 0.85, hR * 1.2, hR * 0.35]);
      c.base = [0.05, 0, s * 0.08];
      c.sway = 0.15;
      c.phase = s;
      chains.push(c);
    }
    // hair tie + crystal ornament
    mesh(new THREE.TorusGeometry(hR * 0.22, hR * 0.07, 10, 28), toon(pal.sash), head, { pos: [0, hR * 2.0, -hR * 0.7], rot: [0.9, 0, 0] });
    const cryMat = new THREE.MeshStandardMaterial({ color: pal.crystal, emissive: pal.crystal, emissiveIntensity: 0.45, metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.92 });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      mesh(new THREE.OctahedronGeometry(hR * 0.16, 1), cryMat, head, { pos: [hR * 0.7 + Math.cos(a) * hR * 0.18, hR * 1.75 + Math.sin(a) * hR * 0.18, -hR * 0.2], scale: [0.5, 1.4, 0.5], rot: [0, 0, a] });
    }
    // ponytail: tapered lathe segments in a chain
    const c = makeChain(head, 9, hR * 0.5, (len, i) => {
      const r0 = hR * (0.3 - i * 0.022);
      const r1 = hR * (0.3 - (i + 1) * 0.022);
      return mesh(limbGeometry(Math.max(r0, 0.01), Math.max(r0 * 1.12, 0.012), Math.max(r1, 0.008), len * 1.15, 14, 4, 0.4), hairMat, null, {});
    }, [0, hR * 2.0, -hR * 0.85]);
    c.base = [0.55, 0, 0];
    c.sway = 0.35;
    c.phase = 0;
    c.ponytail = true;
    chains.push(c);
  }
}

function addSpike(parent, mat, dir, hR, len, r, origin, inset) {
  const geo = new THREE.ConeGeometry(r, len, 8, 2);
  geo.translate(0, len / 2, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  const base = new THREE.Vector3(...origin).add(dir.clone().multiplyScalar(hR * (1 - inset * 0.5)));
  m.position.copy(base);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  parent.add(m);
  return m;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
