import * as THREE from 'three';
import { SEA, TAU, BOTTLE_X0, BOTTLE_X1, ISLAND, radiusAt, insideBottle } from './config.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a || 1), 0, 1);
  return t * t * (3 - 2 * t);
};

export function createLifeSky(ctx = {}) {
  const T = ctx.THREE || THREE;
  const assets = ctx.assets || {};
  const state = ctx.state || {};
  const rand = typeof ctx.rnd === 'function' ? ctx.rnd : Math.random;
  const envMap = assets.env || null;

  const group = new T.Group();
  group.name = 'life-sky';

  // Keep every authored point inside the bottle outline. inset includes the
  // object's own half-extent so animated geometry never crosses the glass.
  function constrain(x, y, z, inset = 0.08) {
    const xMin = BOTTLE_X0 + inset + 0.02;
    const xMax = BOTTLE_X1 - inset - 0.02;
    x = clamp(x, xMin, xMax);
    const r = Math.max(0.02, radiusAt(x) - inset);
    const d = Math.hypot(y, z);
    if (d > r) {
      const s = r / d;
      y *= s;
      z *= s;
    }
    const p = new T.Vector3(x, y, z);
    if (!insideBottle(p, inset)) {
      const rr = Math.max(0.01, radiusAt(p.x) - inset);
      const dd = Math.hypot(p.y, p.z) || 1;
      if (dd > rr) {
        p.y = (p.y / dd) * rr * 0.999;
        p.z = (p.z / dd) * rr * 0.999;
      }
    }
    return p;
  }

  function standard(params = {}) {
    return new T.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0,
      envMap,
      envMapIntensity: 0.75,
      ...params,
    });
  }

  // ---------- Shared geometry/materials ----------
  const sphere24 = new T.SphereGeometry(1, 24, 16);
  const sphere18 = new T.SphereGeometry(1, 18, 12);

  function makeGullWingGeometry() {
    const spanSeg = 14;
    const chordSeg = 6;
    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= spanSeg; i++) {
      const u = i / spanSeg;
      const z = 0.02 + u * 0.72;
      const chord = 0.025 + 0.22 * Math.pow(1 - u, 0.72);
      const sweep = 0.04 * Math.sin(Math.PI * u);
      for (let j = 0; j <= chordSeg; j++) {
        const v = j / chordSeg;
        const x = sweep + (v - 0.5) * chord;
        const camber = 0.028 * Math.sin(Math.PI * v) * Math.sin(Math.PI * u);
        const y = camber + 0.035 * u * u;
        positions.push(x, y, z);
        uvs.push(v, u);
      }
    }
    const row = chordSeg + 1;
    for (let i = 0; i < spanSeg; i++) {
      for (let j = 0; j < chordSeg; j++) {
        const a = i * row + j;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }

  const gullBodyMat = standard({ color: 0xf2f5f7, roughness: 0.62, envMapIntensity: 0.65 });
  const gullWingMat = standard({ color: 0xdfe7ee, roughness: 0.72, side: T.DoubleSide, envMapIntensity: 0.5 });
  const gullDarkMat = standard({ color: 0x5a6874, roughness: 0.74 });
  const beakMat = standard({ color: 0xe09a45, roughness: 0.5 });
  const gullBodyGeo = sphere24;
  const gullHeadGeo = sphere18;
  const gullWingGeo = makeGullWingGeometry();
  const gullTailGeo = sphere18;
  const gullBeakGeo = new T.ConeGeometry(0.024, 0.1, 8);

  const gulls = [];
  for (let i = 0; i < 6; i++) {
    const bird = new T.Group();
    bird.name = 'gull-' + (i + 1);

    const body = new T.Mesh(gullBodyGeo, gullBodyMat);
    body.scale.set(0.24, 0.095, 0.1);
    bird.add(body);

    const head = new T.Mesh(gullHeadGeo, gullBodyMat);
    head.scale.setScalar(0.085);
    head.position.set(0.2, 0.055, 0);
    bird.add(head);

    const beak = new T.Mesh(gullBeakGeo, beakMat);
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.31, 0.05, 0);
    bird.add(beak);

    const tail = new T.Mesh(gullTailGeo, gullDarkMat);
    tail.scale.set(0.12, 0.025, 0.09);
    tail.position.set(-0.25, 0.02, 0);
    bird.add(tail);

    const wingR = new T.Group();
    wingR.position.set(0, 0.035, 0.075);
    wingR.add(new T.Mesh(gullWingGeo, gullWingMat));
    bird.add(wingR);

    const wingL = new T.Group();
    wingL.position.set(0, 0.035, -0.075);
    const leftWingMesh = new T.Mesh(gullWingGeo, gullWingMat);
    leftWingMesh.scale.z = -1;
    wingL.add(leftWingMesh);
    bird.add(wingL);

    const s = 0.88 + rand() * 0.22;
    bird.scale.setScalar(s);
    group.add(bird);

    gulls.push({
      bird, wingR, wingL,
      radiusX: 1.25 + rand() * 0.45,
      radiusZ: 0.72 + rand() * 0.3,
      baseY: 1.55 + rand() * 0.42,
      phase: rand() * TAU,
      speed: 0.23 + rand() * 0.13,
    });
  }

  // ---------- Cumulus clusters, above masts and gulls ----------
  const cloudClear = new T.Color(0xf5f7f9);
  const cloudStorm = new T.Color(0x6f7b86);
  const cloudNight = new T.Color(0x91a0b0);
  const cloudMat = standard({
    color: 0xf5f7f9,
    roughness: 1,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    envMapIntensity: 0.18,
  });
  const cloudLobes = [
    { p: [-0.44, -0.04, 0.0], s: [0.54, 0.39, 0.42] },
    { p: [0.0, 0.1, 0.04], s: [0.58, 0.44, 0.47] },
    { p: [0.46, -0.03, -0.03], s: [0.52, 0.38, 0.42] },
    { p: [0.15, -0.13, 0.18], s: [0.42, 0.31, 0.36] },
  ];
  const cloudSpecs = [
    { x: -3.7, y: 1.95, z: -0.05, scale: 0.92 },
    { x: 0.15, y: 2.0, z: 0.02, scale: 1.05 },
    { x: 3.15, y: 1.9, z: -0.08, scale: 0.86 },
  ];
  const clouds = cloudSpecs.map((spec, i) => {
    const root = new T.Group();
    root.name = 'cumulus-' + (i + 1);
    for (const lobe of cloudLobes) {
      const puff = new T.Mesh(sphere18, cloudMat);
      puff.position.set(lobe.p[0] * spec.scale, lobe.p[1] * spec.scale, lobe.p[2] * spec.scale);
      puff.scale.set(lobe.s[0] * spec.scale, lobe.s[1] * spec.scale, lobe.s[2] * spec.scale);
      puff.renderOrder = 2;
      root.add(puff);
    }
    group.add(root);
    return { root, spec, phase: rand() * TAU, drift: 0.16 + rand() * 0.18 };
  });

  // ---------- Whale: smooth spindle, tail flukes, periodic breach ----------
  const whaleNormal = (() => {
    const src = assets.tex && assets.tex.waterNormal;
    if (!src) return null;
    const t = src.clone();
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(2, 1);
    t.needsUpdate = true;
    return t;
  })();
  const whaleMat = new T.MeshPhysicalMaterial({
    color: 0x274a63,
    roughness: 0.44,
    metalness: 0.02,
    clearcoat: 0.34,
    clearcoatRoughness: 0.3,
    envMap,
    envMapIntensity: 0.95,
    normalMap: whaleNormal,
    normalScale: whaleNormal ? new T.Vector2(0.09, 0.09) : undefined,
  });
  const whaleBellyMat = standard({ color: 0x8ba0a8, roughness: 0.62, envMapIntensity: 0.7 });
  const whaleFinMat = standard({ color: 0x1e3c53, roughness: 0.5, side: T.DoubleSide });

  const whale = new T.Group();
  whale.name = 'whale';
  const whaleBody = new T.Mesh(new T.SphereGeometry(1, 32, 20), whaleMat);
  whaleBody.scale.set(0.86, 0.32, 0.35);
  whale.add(whaleBody);
  const belly = new T.Mesh(sphere24, whaleBellyMat);
  belly.scale.set(0.72, 0.2, 0.27);
  belly.position.set(0.1, -0.17, 0);
  whale.add(belly);
  const dorsal = new T.Mesh(sphere18, whaleFinMat);
  dorsal.scale.set(0.12, 0.15, 0.055);
  dorsal.position.set(-0.05, 0.32, 0);
  whale.add(dorsal);
  const tailPivot = new T.Group();
  tailPivot.position.set(-0.78, 0, 0);
  const tailStock = new T.Mesh(sphere18, whaleMat);
  tailStock.scale.set(0.3, 0.095, 0.1);
  tailStock.position.set(-0.11, 0, 0);
  tailPivot.add(tailStock);
  for (const sign of [1, -1]) {
    const fluke = new T.Mesh(sphere18, whaleFinMat);
    fluke.scale.set(0.3, 0.035, 0.19);
    fluke.position.set(-0.3, 0.01, sign * 0.18);
    fluke.rotation.y = sign * 0.34;
    tailPivot.add(fluke);
  }
  whale.add(tailPivot);
  group.add(whale);
  const whalePhase = rand() * 0.45;

  // ---------- Sun / moon / midnight stars ----------
  function makeGlowTexture(rgb) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      if (!g) return null;
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(' + rgb + ',0.95)');
      grad.addColorStop(0.24, 'rgba(' + rgb + ',0.45)');
      grad.addColorStop(0.58, 'rgba(' + rgb + ',0.12)');
      grad.addColorStop(1, 'rgba(' + rgb + ',0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      const tex = new T.CanvasTexture(c);
      if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
      return tex;
    } catch (e) {
      return null;
    }
  }

  function makeCelestial(rgb, color, radius, haloSize) {
    const root = new T.Group();
    const coreMat = new T.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: T.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const core = new T.Mesh(new T.SphereGeometry(radius, 24, 16), coreMat);
    root.add(core);
    let halo = null;
    const tex = makeGlowTexture(rgb);
    if (tex) {
      halo = new T.Sprite(new T.SpriteMaterial({
        map: tex,
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: T.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }));
      halo.scale.set(haloSize, haloSize, 1);
      root.add(halo);
    }
    const light = new T.PointLight(color, 0, 13, 2);
    root.add(light);
    group.add(root);
    return { root, core, coreMat, halo, light };
  }

  const sun = makeCelestial('255,214,142', 0xffd58a, 0.29, 1.18);
  const moon = makeCelestial('185,210,255', 0xc8dcff, 0.23, 0.92);

  const starCount = 460;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    let x = 0, y = 1, z = 0;
    for (let tries = 0; tries < 24; tries++) {
      x = lerp(BOTTLE_X0 + 0.22, 4.3, rand());
      const R = Math.max(0.02, radiusAt(x) - 0.14);
      const a = rand() * TAU;
      const rr = Math.sqrt(rand()) * R;
      z = Math.cos(a) * rr;
      y = Math.sin(a) * rr;
      if (y > SEA + 0.85 && y < 2.95) break;
    }
    const p = constrain(x, y, z, 0.12);
    starPos[i * 3] = p.x;
    starPos[i * 3 + 1] = p.y;
    starPos[i * 3 + 2] = p.z;
    const w = 0.62 + rand() * 0.38;
    starCol[i * 3] = w * (0.86 + rand() * 0.14);
    starCol[i * 3 + 1] = w * (0.9 + rand() * 0.1);
    starCol[i * 3 + 2] = w;
  }
  const starGeo = new T.BufferGeometry();
  starGeo.setAttribute('position', new T.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new T.BufferAttribute(starCol, 3));
  const starMat = new T.PointsMaterial({
    size: 0.026,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: T.AdditiveBlending,
    toneMapped: false,
  });
  const stars = new T.Points(starGeo, starMat);
  stars.name = 'midnight-stars';
  stars.renderOrder = 1;
  group.add(stars);

  // ---------- Lightning network + flash lights ----------
  const MAX_BOLT_SEGMENTS = 84;
  const boltPositions = new Float32Array(MAX_BOLT_SEGMENTS * 6);
  const boltGeo = new T.BufferGeometry();
  const boltAttr = new T.BufferAttribute(boltPositions, 3);
  boltGeo.setAttribute('position', boltAttr);
  boltGeo.setDrawRange(0, 0);
  const boltMat = new T.LineBasicMaterial({
    color: 0xd9ecff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: T.AdditiveBlending,
    toneMapped: false,
  });
  const boltLines = new T.LineSegments(boltGeo, boltMat);
  boltLines.name = 'lightning-network';
  boltLines.frustumCulled = false;
  boltLines.renderOrder = 6;
  boltLines.visible = false;
  group.add(boltLines);

  const flashA = new T.PointLight(0xbdd8ff, 0, 13, 2);
  const flashB = new T.PointLight(0xe5f2ff, 0, 10, 2);
  flashA.position.copy(constrain(0, 2, 0, 0.12));
  flashB.position.copy(constrain(0, SEA + 0.2, 0, 0.12));
  group.add(flashA, flashB);

  let boltSegments = 0;
  function addBoltSegment(a, b) {
    if (boltSegments >= MAX_BOLT_SEGMENTS) return;
    const o = boltSegments * 6;
    boltPositions[o] = a.x; boltPositions[o + 1] = a.y; boltPositions[o + 2] = a.z;
    boltPositions[o + 3] = b.x; boltPositions[o + 4] = b.y; boltPositions[o + 5] = b.z;
    boltSegments++;
  }

  function buildBolt() {
    boltSegments = 0;
    const startX = lerp(-2.7, 3.1, rand());
    const startY = 2.12 + rand() * 0.28;
    const startZ = (rand() * 2 - 1) * 0.34;
    let p = constrain(startX, startY, startZ, 0.12);
    const points = [p.clone()];
    const steps = 8 + Math.floor(rand() * 5);
    for (let i = 0; i < steps; i++) {
      const u = (i + 1) / steps;
      const y = lerp(startY, SEA + 0.08, u);
      p = constrain(p.x + (rand() - 0.5) * 0.58, y, p.z + (rand() - 0.5) * 0.46, 0.12);
      points.push(p.clone());
    }
    for (let i = 0; i < points.length - 1; i++) addBoltSegment(points[i], points[i + 1]);

    const branches = 1 + Math.floor(rand() * 3);
    for (let b = 0; b < branches; b++) {
      const idx = 1 + Math.floor(rand() * Math.max(1, points.length - 2));
      let q = points[idx].clone();
      const segs = 2 + Math.floor(rand() * 3);
      for (let j = 0; j < segs; j++) {
        const next = constrain(
          q.x + (rand() - 0.5) * 0.56,
          q.y - 0.22 - rand() * 0.24,
          q.z + (rand() - 0.5) * 0.42,
          0.12
        );
        addBoltSegment(q, next);
        q = next;
      }
    }
    boltAttr.needsUpdate = true;
    boltGeo.setDrawRange(0, boltSegments * 2);
    flashA.position.copy(points[0]);
    flashB.position.copy(points[points.length - 1]);
  }

  // ---------- Two-density bottle rain curtain ----------
  const RAIN_HIGH = 1500;
  const RAIN_LOW = 420;
  const rainGeo = new T.CylinderGeometry(0.0065, 0.0065, 1, 5, 1, true);
  const rainMat = new T.MeshBasicMaterial({
    color: 0xbcd8ee,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: T.AdditiveBlending,
    toneMapped: false,
  });
  const rainMesh = new T.InstancedMesh(rainGeo, rainMat, RAIN_HIGH);
  rainMesh.name = 'bottle-rain';
  rainMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  rainMesh.frustumCulled = false;
  rainMesh.visible = false;
  group.add(rainMesh);

  function rainTop(x, z) {
    const R = Math.max(0.1, radiusAt(x) - 0.36);
    return Math.max(SEA + 0.4, Math.min(2.82, Math.sqrt(Math.max(0, R * R - z * z))));
  }
  function newDrop(atTop = false) {
    for (let tries = 0; tries < 24; tries++) {
      const x = lerp(-4.85, 5.55, rand());
      const R = radiusAt(x) - 0.36;
      if (R < 0.55) continue;
      const z = (rand() * 2 - 1) * R * 0.6;
      const top = rainTop(x, z);
      const bottom = SEA + 0.06;
      if (top < bottom + 0.35) continue;
      return {
        x,
        y: atTop ? top : lerp(bottom, top, rand()),
        z,
        speed: 0.86 + rand() * 1.45,
        len: 0.18 + rand() * 0.3,
        phase: rand() * TAU,
      };
    }
    return { x: -1, y: 1.2, z: 0, speed: 1, len: 0.22, phase: 0 };
  }
  const drops = [];
  for (let i = 0; i < RAIN_HIGH; i++) drops.push(newDrop());
  const rainDummy = new T.Object3D();
  const inverseWorldQuat = new T.Quaternion();

  // ---------- State / public API ----------
  let stormLevel = clamp(Number(state.stormLevel ?? state.storm ?? 0) || 0, 0, 1);
  let clock = 0;
  let nextFlash = 2.2 + rand() * 4.5;
  let flashDuration = 0;
  let flashLeft = 0;
  let flashAmp = 0;

  function setStormLevel(v) {
    stormLevel = clamp(Number(v) || 0, 0, 1);
  }

  function update(t, dt, storm, night, day) {
    const step = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
    clock = Number.isFinite(t) ? t : clock + step;
    if (Number.isFinite(storm)) stormLevel = clamp(storm, 0, 1);
    const n = clamp(Number.isFinite(night) ? night : (Number(state.night) || 0), 0, 1);
    const d = Number.isFinite(day) ? (((day % 1) + 1) % 1) : (((Number(state.day) || 0) % 1 + 1) % 1);

    // Gulls: smooth circling with coupled wing-beat and banking.
    for (const g of gulls) {
      const a = g.phase + clock * g.speed;
      const px = -1.1 + Math.cos(a) * g.radiusX;
      const pz = -0.05 + Math.sin(a) * g.radiusZ;
      const py = g.baseY + 0.16 * Math.sin(clock * 0.72 + g.phase);
      g.bird.position.copy(constrain(px, py, pz, 0.92));
      const tx = -Math.sin(a) * g.radiusX;
      const tz = Math.cos(a) * g.radiusZ;
      g.bird.rotation.set(
        0.045 * Math.sin(clock * 1.25 + g.phase),
        Math.atan2(-tz, tx),
        0.075 * Math.sin(clock * 0.86 + g.phase)
      );
      const beat = Math.max(0, Math.sin(clock * 2.85 + g.phase));
      const flap = 0.28 + 0.56 * beat * beat;
      g.wingR.rotation.x = -flap;
      g.wingL.rotation.x = flap;
    }

    // Clouds drift slowly; storm/night darken the same PBR puffs.
    for (const c of clouds) {
      const p = constrain(
        c.spec.x + Math.sin(clock * 0.035 + c.phase) * c.drift + stormLevel * 0.16,
        c.spec.y + Math.sin(clock * 0.11 + c.phase) * 0.055,
        c.spec.z + Math.cos(clock * 0.043 + c.phase) * 0.08,
        0.86
      );
      c.root.position.copy(p);
    }
    cloudMat.opacity = 0.34 - n * 0.08 + stormLevel * 0.13;
    cloudMat.color.copy(cloudClear).lerp(cloudStorm, stormLevel * 0.68).lerp(cloudNight, n * 0.28);

    // Whale cycle: long submerged cruise, short arched breach.
    const cycle = (clock * 0.055 + whalePhase) % 1;
    const breachU = cycle < 0.23 ? cycle / 0.23 : 0;
    const breach = cycle < 0.23 ? Math.sin(Math.PI * breachU) : 0;
    const pitch = cycle < 0.23 ? Math.sin(TAU * breachU) * 0.58 : 0;
    const wy = SEA - 0.42 + breach * 1.86 + Math.sin(clock * 0.55) * 0.035 * (1 - breach);
    whale.position.copy(constrain(
      ISLAND.x + 2.0 + Math.sin(clock * 0.075) * 0.34,
      wy,
      0.36 + Math.cos(clock * 0.09) * 0.13,
      1.05
    ));
    whale.rotation.set(0, Math.sin(clock * 0.06) * 0.18, pitch);
    tailPivot.rotation.x = Math.sin(clock * 4.1) * (0.11 + breach * 0.18);

    // Celestial phase: day 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset.
    const a = d * TAU;
    const sunH = -Math.cos(a);
    const moonH = Math.cos(a);
    const sunPos = constrain(0.4 + Math.sin(a) * 2.45, -1.0 + (sunH + 1) * 1.66, -0.04, 0.68);
    const moonPos = constrain(0.4 - Math.sin(a) * 2.25, -1.0 + (moonH + 1) * 1.56, 0.08, 0.62);
    sun.root.position.copy(sunPos);
    moon.root.position.copy(moonPos);
    const sunVis = smoothstep(-0.05, 0.2, sunH) * (1 - 0.78 * n);
    const moonVis = smoothstep(-0.05, 0.2, moonH) * (0.22 + 0.78 * n);
    sun.root.visible = sunVis > 0.01;
    moon.root.visible = moonVis > 0.01;
    if (sun.halo) sun.halo.material.opacity = sunVis * 0.62;
    if (moon.halo) moon.halo.material.opacity = moonVis * 0.5;
    sun.coreMat.opacity = sunVis;
    moon.coreMat.opacity = moonVis;
    sun.light.intensity = sunVis * (0.55 + 0.45 * (1 - n));
    moon.light.intensity = moonVis * 0.32;

    const twinkle = 0.93 + 0.07 * Math.sin(clock * 2.1);
    starMat.opacity = (0.03 + 0.92 * smoothstep(0.28, 0.95, n)) * (1 - 0.38 * moonVis) * twinkle;
    stars.visible = starMat.opacity > 0.01;

    // Lightning: storm-gated jagged network plus two flash sources.
    if (stormLevel > 0.16) {
      nextFlash -= step;
      if (nextFlash <= 0) {
        buildBolt();
        flashDuration = 0.14 + rand() * 0.18;
        flashLeft = flashDuration;
        flashAmp = 0.55 + rand() * 0.45;
        nextFlash = (0.9 + rand() * 3.8) / (0.55 + stormLevel);
      }
    }
    flashLeft = Math.max(0, flashLeft - step);
    let flash = flashLeft > 0
      ? flashAmp * Math.pow(flashLeft / Math.max(0.001, flashDuration), 0.68) * (0.74 + 0.26 * Math.sin(clock * 92))
      : 0;
    flash *= smoothstep(0.12, 0.52, stormLevel);
    boltLines.visible = flash > 0.01;
    boltMat.opacity = flash * 0.95;
    flashA.intensity = flash * (2.2 + stormLevel * 2.5);
    flashB.intensity = flash * (1.3 + stormLevel * 1.7);
    if (state && typeof state === 'object') state.lightning = flash;

    // Rain: positions stay in bottle-local coordinates while each streak is
    // counter-rotated so its long axis remains world-vertical when the ship rolls.
    const rainVisible = stormLevel > 0.06;
    rainMesh.visible = rainVisible;
    if (rainVisible) {
      const count = stormLevel >= 0.55 ? RAIN_HIGH : RAIN_LOW;
      rainMesh.count = count;
      rainMat.opacity = clamp((stormLevel - 0.05) * 1.18, 0, 1) * (stormLevel >= 0.55 ? 0.58 : 0.38);
      group.updateWorldMatrix(true, false);
      group.getWorldQuaternion(inverseWorldQuat);
      inverseWorldQuat.invert();
      for (let i = 0; i < count; i++) {
        const drop = drops[i];
        drop.y -= step * drop.speed * (1 + stormLevel * 1.15);
        const top = rainTop(drop.x, drop.z);
        if (drop.y < SEA + 0.05) Object.assign(drop, newDrop(true));
        const driftX = Math.sin(clock * 1.6 + drop.phase) * 0.025 * (1 + stormLevel);
        const streakLen = drop.len * (1 + stormLevel * 0.3);
        const yTop = Math.min(drop.y, top);
        rainDummy.position.set(drop.x + driftX, yTop - streakLen * 0.5, drop.z);
        rainDummy.quaternion.copy(inverseWorldQuat);
        rainDummy.scale.set(1, streakLen, 1);
        rainDummy.updateMatrix();
        rainMesh.setMatrixAt(i, rainDummy.matrix);
      }
      rainMesh.instanceMatrix.needsUpdate = true;
    }
  }

  return { group, update, setStormLevel };
}
