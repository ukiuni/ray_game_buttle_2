import * as THREE from 'three';
import { buildCharacter } from './models.js';
import { Animator } from './animator.js';
import { STAGES } from '../game/characters.js';
import { STAGE_HALF } from '../game/match.js';

const IMG_ASPECT = 1672 / 941;
const BG_DIST = 30;
const YAW = Math.PI / 2 - 0.42;
const PIVOT_H = 0.95;

function softTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.65)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,1)';
  g.lineWidth = 10;
  g.shadowColor = 'white';
  g.shadowBlur = 16;
  g.beginPath();
  g.arc(64, 64, 46, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** CPU-driven particle pool rendered as a single Points object. */
class Particles {
  constructor(max, texture) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.baseSize = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, scale: { value: 400 } },
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying float vA; varying vec3 vC; uniform float scale;
        void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D map; varying float vA; varying vec3 vC;
        void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * t.rgb, t.a * vA); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  emit(x, y, z, vx, vy, vz, color, size, life, grav = 0) {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    const c = new THREE.Color(color);
    this.col[i * 3] = c.r;
    this.col[i * 3 + 1] = c.g;
    this.col[i * 3 + 2] = c.b;
    this.baseSize[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.grav[i] = grav;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        this.size[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3] *= 0.97;
      this.vel[i * 3 + 2] *= 0.97;
      this.alpha[i] = k;
      this.size[i] = this.baseSize[i] * (0.4 + 0.6 * k);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.alpha.needsUpdate = true;
    g.attributes.size.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }
}

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    // ?test=1 : low graphics mode used by automated tests on software-rendered CI
    const low = /[?&]test=1/.test(window.location.search);
    this.lowGfx = low;
    const dpr = low ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !low && dpr < 2, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(dpr);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = !low;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 100);
    this.camera.position.set(0, 1.5, 7);
    this.scene.add(this.camera);
    this.textures = {};
    this.loader = new THREE.TextureLoader();
    this.soft = softTexture();
    this.ring = ringTexture();
    this.particles = new Particles(900, this.soft);
    this.scene.add(this.particles.points);
    this.ambient = null;
    this.fighters = [];
    this.projViews = new Map();
    this.flashes = [];
    this.shake = 0;
    this.camX = 0;
    this.camHalfW = 3.4;
    this.zoom = 0;
    this.stageFx = null;
    this.flashLight = 0;
    this.lightning = 0;

    this.setupLights();
    this.setupBackground();
    this.setupGround();
    this.resize();
  }

  // ------------------------------------------------------------------ assets
  loadTexture(url, opts = {}) {
    if (this.textures[url]) return Promise.resolve(this.textures[url]);
    return new Promise((resolve) => {
      this.loader.load(
        url,
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
          if (opts.repeat) {
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(opts.repeat, opts.repeat);
          }
          this.textures[url] = t;
          resolve(t);
        },
        undefined,
        () => resolve(null),
      );
    });
  }

  async preload(onProgress) {
    const urls = [];
    for (const id of ['kaen', 'raiga', 'hyoka']) {
      urls.push([`assets/tex_${id}_cloth.jpg`, { repeat: 2 }], [`assets/tex_${id}_face.jpg`, {}], [STAGES[id].image, {}]);
    }
    let done = 0;
    await Promise.all(
      urls.map(([u, o]) =>
        this.loadTexture(u, o).then(() => {
          done++;
          if (onProgress) onProgress(done / urls.length);
        }),
      ),
    );
  }

  charTextures(id) {
    return { cloth: this.textures[`assets/tex_${id}_cloth.jpg`], face: this.textures[`assets/tex_${id}_face.jpg`] };
  }

  // ------------------------------------------------------------------ setup
  setupLights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x302030, 1.6);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffffff, 2.2);
    this.key.position.set(-3, 7, 6);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    const sc = this.key.shadow.camera;
    sc.left = -5;
    sc.right = 5;
    sc.top = 5;
    sc.bottom = -2;
    sc.near = 1;
    sc.far = 25;
    this.key.shadow.bias = -0.0015;
    this.scene.add(this.key);
    this.scene.add(this.key.target);
    this.rim = new THREE.DirectionalLight(0xffaa66, 2.4);
    this.rim.position.set(2, 4, -6);
    this.scene.add(this.rim);
  }

  setupBackground() {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.bgMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false, toneMapped: false });
    this.bg = new THREE.Mesh(geo, this.bgMat);
    this.bg.position.set(0, 0, -BG_DIST);
    this.bg.renderOrder = -10;
    this.camera.add(this.bg);
  }

  setupGround() {
    const geo = new THREE.PlaneGeometry(40, 12);
    const mat = new THREE.ShadowMaterial({ opacity: 0.42 });
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  setStage(stageId) {
    const st = STAGES[stageId];
    this.stage = st;
    const tex = this.textures[st.image];
    if (tex) {
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      this.bgMat.map = tex;
      this.bgMat.needsUpdate = true;
    }
    const rimColor = { kaen: 0xff8a3a, raiga: 0x6ad0ff, hyoka: 0xaef0ff }[stageId];
    this.hemi.color.set(st.light);
    this.hemi.groundColor.set(st.fog);
    this.key.color.set(st.light);
    this.rim.color.set(rimColor);
    this.scene.background = new THREE.Color(st.fog);
    this.setupStageFx(st.particles);
    this.updateBackgroundCrop();
  }

  setupStageFx(kind) {
    if (this.stageFx) {
      this.scene.remove(this.stageFx.obj);
      this.stageFx.obj.geometry.dispose();
    }
    const n = kind === 'rain' ? 260 : kind === 'snow' ? 220 : 140;
    const pos = new Float32Array(n * (kind === 'rain' ? 6 : 3));
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      seeds[i * 4] = Math.random() * 16 - 8;
      seeds[i * 4 + 1] = Math.random() * 6;
      seeds[i * 4 + 2] = Math.random() * 6 - 4;
      seeds[i * 4 + 3] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    let obj;
    if (kind === 'rain') {
      obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.35, depthWrite: false }));
    } else {
      const color = kind === 'snow' ? 0xffffff : 0xff7a2a;
      obj = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: kind === 'snow' ? 0.06 : 0.05, map: this.soft, transparent: true, depthWrite: false, blending: kind === 'snow' ? THREE.NormalBlending : THREE.AdditiveBlending }));
    }
    obj.frustumCulled = false;
    this.scene.add(obj);
    this.stageFx = { kind, obj, seeds, n, t: 0 };
  }

  updateStageFx(dt) {
    const fx = this.stageFx;
    if (!fx) return;
    fx.t += dt;
    const pos = fx.obj.geometry.attributes.position.array;
    const cx = this.camX;
    for (let i = 0; i < fx.n; i++) {
      const s = fx.seeds;
      const ph = s[i * 4 + 3];
      if (fx.kind === 'rain') {
        let y = 6 - ((fx.t * 0.22 + ph * 6) % 6);
        const x = cx + s[i * 4] + y * 0.12;
        const z = s[i * 4 + 2];
        pos[i * 6] = x;
        pos[i * 6 + 1] = y;
        pos[i * 6 + 2] = z;
        pos[i * 6 + 3] = x + 0.03;
        pos[i * 6 + 4] = y + 0.28;
        pos[i * 6 + 5] = z;
      } else if (fx.kind === 'snow') {
        const y = 6 - ((fx.t * 0.012 + ph * 6) % 6);
        pos[i * 3] = cx + s[i * 4] + Math.sin(fx.t * 0.02 + ph * 10) * 0.4;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = s[i * 4 + 2];
      } else {
        const y = (fx.t * 0.015 + ph * 5) % 5;
        pos[i * 3] = cx + s[i * 4] + Math.sin(fx.t * 0.03 + ph * 20) * 0.3;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = s[i * 4 + 2];
      }
    }
    fx.obj.geometry.attributes.position.needsUpdate = true;
    if (fx.kind === 'rain') {
      // occasional lightning flashes
      if (this.lightning <= 0 && Math.random() < 0.004 * dt) this.lightning = 14;
    }
    if (this.lightning > 0) this.lightning -= dt;
  }

  // ------------------------------------------------------------------ fighters
  clearFighters() {
    for (const v of this.fighters) this.scene.remove(v.root);
    this.fighters = [];
    for (const [, pv] of this.projViews) this.scene.remove(pv.obj);
    this.projViews.clear();
  }

  makeFighterView(charId, variant) {
    const model = buildCharacter(charId, this.charTextures(charId), variant);
    const root = new THREE.Group();
    const tilt = new THREE.Group();
    const yaw = new THREE.Group();
    tilt.position.y = PIVOT_H;
    model.position.y = -PIVOT_H;
    yaw.add(model);
    tilt.add(yaw);
    root.add(tilt);
    this.scene.add(root);
    // blob shadow for contact grounding
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.005;
    this.scene.add(blob);
    return { root, tilt, yaw, model, anim: new Animator(model), blob, charId };
  }

  setupMatch(p1Id, p2Id, p2Variant, stageId) {
    this.clearFighters();
    this.setStage(stageId);
    this.fighters = [this.makeFighterView(p1Id, 0), this.makeFighterView(p2Id, p2Variant)];
    this.showcaseMode = false;
  }

  /** Character select / title showcase: one model in the centre. */
  showcase(charId) {
    this.clearFighters();
    this.setStage(charId);
    const v = this.makeFighterView(charId, 0);
    this.fighters = [v];
    this.showcaseMode = true;
    this.showcaseT = 0;
  }

  syncFighter(v, f, dt) {
    v.anim.update(f, dt);
    v.root.position.set(f.x, f.y, 0);
    v.root.scale.x = f.facing;
    v.tilt.rotation.z = v.anim.tilt + v.anim.flip;
    v.tilt.position.y = PIVOT_H - (PIVOT_H - 0.16) * v.anim.lift;
    v.yaw.rotation.y = YAW + v.anim.spin;
    v.blob.position.x = f.x;
    const h = Math.max(0, f.y);
    v.blob.scale.setScalar(Math.max(0.3, 1 - h * 0.4));
    v.blob.material.opacity = 0.35 * Math.max(0.2, 1 - h * 0.5);
  }

  // ------------------------------------------------------------------ projectiles
  makeProjectile(p) {
    const g = new THREE.Group();
    const color = new THREE.Color(p.color);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(1.1);
    g.add(halo);
    let spinner = null;
    if (p.char === 'raiga') {
      // four-point shuriken
      const shape = new THREE.Shape();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = i % 2 === 0 ? 0.32 : 0.09;
        if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 });
      geo.center();
      spinner = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: color, emissiveIntensity: 0.9, metalness: 0.8, roughness: 0.2 }));
      g.add(spinner);
    } else if (p.char === 'hyoka') {
      spinner = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0xdff8ff, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.9, roughness: 0.1 });
      for (let i = 0; i < 6; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.42, 6), mat);
        c.rotation.z = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
        c.rotation.y = (Math.random() - 0.5) * 0.6;
        c.position.set((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2);
        spinner.add(c);
      }
      g.add(spinner);
    } else {
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
      g.add(core);
      const outer = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.soft, color: 0xff3a00, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      outer.scale.setScalar(1.7);
      g.add(outer);
    }
    this.scene.add(g);
    return { obj: g, spinner, color: p.color, char: p.char };
  }

  syncProjectiles(match, dt) {
    const alive = new Set();
    for (const p of match.projectiles) {
      alive.add(p.id);
      let pv = this.projViews.get(p.id);
      if (!pv) {
        pv = this.makeProjectile(p);
        this.projViews.set(p.id, pv);
      }
      pv.obj.position.set(p.x, p.y, 0);
      const dir = Math.sign(p.vx);
      if (pv.spinner) {
        if (pv.char === 'raiga') pv.spinner.rotation.z -= 0.45 * dt * dir;
        else pv.spinner.scale.x = dir;
      }
      // trail
      for (let i = 0; i < 2; i++) {
        const c = pv.char === 'kaen' ? (Math.random() < 0.5 ? 0xff5a10 : 0xffc040) : pv.color;
        this.particles.emit(p.x - dir * 0.15, p.y + (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.2, -dir * 0.01, (Math.random() - 0.3) * 0.015, 0, c, 0.35, 16);
      }
    }
    for (const [id, pv] of this.projViews) {
      if (!alive.has(id)) {
        this.scene.remove(pv.obj);
        this.projViews.delete(id);
      }
    }
  }

  // ------------------------------------------------------------------ effects
  burst(x, y, color, count, speed, size = 0.3, life = 22) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const c = Math.random() < 0.4 ? 0xffffff : color;
      this.particles.emit(x, y, 0.2, Math.cos(a) * v, Math.sin(a) * v, (Math.random() - 0.5) * v, c, size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), 0.002);
    }
  }

  flash(x, y, color, scale, life, ring = false) {
    const mat = new THREE.SpriteMaterial({ map: ring ? this.ring : this.soft, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.position.set(x, y, 0.3);
    sp.scale.setScalar(scale * 0.3);
    sp.renderOrder = 6;
    this.scene.add(sp);
    this.flashes.push({ sp, life, max: life, scale, ring });
  }

  handleEvent(e) {
    switch (e.type) {
      case 'hit': {
        const s = e.strength;
        this.burst(e.x, e.y, e.color, 14 + s * 10, 0.05 + s * 0.02, 0.3 + s * 0.06);
        this.flash(e.x, e.y, 0xffffff, 1.0 + s * 0.4, 10);
        this.flash(e.x, e.y, e.color, 1.2 + s * 0.5, 14, true);
        this.shake = Math.max(this.shake, [0.04, 0.08, 0.12, 0.18][s]);
        break;
      }
      case 'block':
        this.burst(e.x, e.y, 0x88ccff, 10, 0.04, 0.25);
        this.flash(e.x, e.y, 0x9fd8ff, 0.9, 10, true);
        break;
      case 'clash':
        this.burst(e.x, e.y, 0xffffff, 30, 0.07, 0.35);
        this.flash(e.x, e.y, 0xffffff, 2.2, 16, true);
        break;
      case 'knockdown':
      case 'land':
        if (e.type === 'knockdown') {
          for (let i = 0; i < 16; i++) this.particles.emit(e.x + (Math.random() - 0.5) * 1.2, 0.05, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.03, Math.random() * 0.02, 0, 0x8a7a6a, 0.5, 30, 0.0005);
          this.shake = Math.max(this.shake, 0.08);
        }
        break;
      case 'super': {
        const f = this.fighters[e.side];
        if (f) {
          const x = f.root.position.x;
          for (let i = 0; i < 60; i++) {
            const a = Math.random() * Math.PI * 2;
            this.particles.emit(x + Math.cos(a) * 1.2, 1 + Math.sin(a) * 1.2, 0, -Math.cos(a) * 0.04, -Math.sin(a) * 0.04, 0, 0xffe080, 0.4, 28);
          }
          this.zoom = 1;
          this.zoomX = x;
        }
        break;
      }
      case 'special': {
        const f = this.fighters[e.side];
        if (f) this.flash(f.root.position.x, 1.2, 0xffffff, 1.4, 8);
        break;
      }
      case 'ko':
        this.shake = 0.25;
        break;
      default:
        break;
    }
  }

  updateFlashes(dt) {
    for (const fl of this.flashes) {
      fl.life -= dt;
      const k = Math.max(0, fl.life / fl.max);
      fl.sp.material.opacity = k;
      const sc = fl.ring ? fl.scale * (1.3 - k) * 1.6 : fl.scale * (0.6 + (1 - k) * 0.6);
      fl.sp.scale.setScalar(sc);
      if (fl.life <= 0) {
        this.scene.remove(fl.sp);
        fl.sp.material.dispose();
      }
    }
    this.flashes = this.flashes.filter((f) => f.life > 0);
  }

  // ------------------------------------------------------------------ camera
  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.updateBackgroundCrop();
  }

  updateBackgroundCrop() {
    const cam = this.camera;
    const hgt = 2 * BG_DIST * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const wid = hgt * cam.aspect;
    this.bg.scale.set(wid, hgt, 1);
    const tex = this.bgMat.map;
    if (!tex) return;
    let fx = 0.8;
    let fy = (fx * IMG_ASPECT) / cam.aspect;
    if (fy > 1) {
      fy = 1;
      fx = cam.aspect / IMG_ASPECT;
    }
    this.bgFx = fx;
    tex.repeat.set(fx, fy);
    tex.offset.y = (1 - fy) * 0.12;
    tex.offset.x = (1 - fx) / 2;
  }

  updateCamera(dt, focus) {
    const cam = this.camera;
    let targetX = this.camX;
    let halfW = 3.4;
    if (this.showcaseMode) {
      targetX = 0;
      halfW = 1.6;
    } else if (focus) {
      const [a, b] = focus;
      targetX = (a.x + b.x) / 2;
      halfW = Math.max(2.9, Math.abs(a.x - b.x) / 2 + 1.25);
    }
    const lim = STAGE_HALF - 2.4;
    targetX = Math.max(-lim, Math.min(lim, targetX));
    const k = 1 - Math.pow(0.88, dt);
    this.camX += (targetX - this.camX) * k;
    this.camHalfW += (halfW - this.camHalfW) * k * 0.6;
    if (this.zoom > 0) this.zoom = Math.max(0, this.zoom - 0.012 * dt);
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    let z = this.camHalfW / (tanV * cam.aspect);
    z = Math.max(this.showcaseMode ? 3.6 : 4.6, Math.min(11, z));
    const zoomK = this.zoom > 0 ? Math.sin(Math.min(1, this.zoom) * Math.PI) * 0.35 : 0;
    const cx = this.zoom > 0 ? this.camX + (this.zoomX - this.camX) * zoomK : this.camX;
    z *= 1 - zoomK;
    const sh = this.shake;
    const sx = (Math.random() - 0.5) * sh;
    const sy = (Math.random() - 0.5) * sh;
    this.shake = Math.max(0, this.shake - 0.012 * dt);
    const camY = this.showcaseMode ? 1.15 : 1.45;
    cam.position.set(cx + sx, camY + sy, z);
    cam.lookAt(cx + sx * 0.5, this.showcaseMode ? 0.95 : 1.1, 0);
    // background parallax
    const tex = this.bgMat.map;
    if (tex && this.bgFx !== undefined) {
      const range = (1 - this.bgFx) / 2;
      tex.offset.x = range + (cx / (STAGE_HALF - 2.4 || 1)) * range * 0.95;
    }
    this.key.position.set(cx - 3, 7, 6);
    this.key.target.position.set(cx, 0, 0);
    this.ground.position.x = cx;
    this.hemi.intensity = 1.6 + (this.lightning > 0 ? (Math.sin(this.lightning) > 0 ? 2.5 : 0.5) : 0);
  }

  /** Sync the scene to the match state and render. */
  frame(match, dt) {
    if (this.showcaseMode && this.fighters[0]) {
      this.showcaseT += dt;
      const fake = this.showcaseFighter || (this.showcaseFighter = { x: 0, y: 0, vx: 0, vy: 0, facing: 1, state: 'idle', stateFrame: 0, char: { id: this.fighters[0].charId } });
      fake.char = { id: this.fighters[0].charId };
      fake.stateFrame += dt;
      fake.state = this.showcaseWin ? 'win' : 'idle';
      this.syncFighter(this.fighters[0], fake, dt);
      this.fighters[0].yaw.rotation.y = 0.35 + Math.sin(this.showcaseT * 0.01) * 0.35;
    } else if (match) {
      for (let i = 0; i < this.fighters.length; i++) this.syncFighter(this.fighters[i], match.f[i], dt);
      this.syncProjectiles(match, dt);
    }
    this.particles.update(dt);
    this.updateFlashes(dt);
    this.updateStageFx(dt);
    this.updateCamera(dt, match && !this.showcaseMode ? match.f : null);
    this.renderer.render(this.scene, this.camera);
  }
}
