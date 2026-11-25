import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  SEA, TAU, ISLAND, rnd, insideBottle,
  waveHeight as configWaveHeight, state as globalState
} from './config.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

export function createIslandShip(ctx) {
  const C = ctx || {};
  const T = C.THREE || THREE;
  const st = C.state || globalState;
  const waveFn = typeof C.waveHeight === 'function' ? C.waveHeight : configWaveHeight;
  const assets = C.assets || {};

  const shipGroup = new T.Group();
  shipGroup.name = 'realistic-ship-orbit';
  const shipVisual = new T.Group();
  shipVisual.name = 'realistic-ship-visual';
  shipGroup.add(shipVisual);

  const islandGroup = new T.Group();
  islandGroup.name = 'realistic-coral-island';
  islandGroup.position.set(ISLAND.x, SEA, ISLAND.z);

  const random = rnd;
  const animators = [];
  const sailParts = [];
  let frame = 0;

  function seeded(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function fallbackTexture(base, seed, mode) {
    const r = seeded(seed);
    const n = 64;
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4;
        if (mode === 'normal') {
          data[i] = 128;
          data[i + 1] = 128;
          data[i + 2] = 255;
          data[i + 3] = 255;
        } else {
          const grain = (r() - 0.5) * 26 + Math.sin(x * 0.37 + y * 0.11 + seed) * 5;
          data[i] = Math.max(0, Math.min(255, base[0] + grain));
          data[i + 1] = Math.max(0, Math.min(255, base[1] + grain));
          data[i + 2] = Math.max(0, Math.min(255, base[2] + grain));
          data[i + 3] = 255;
        }
      }
    }
    const t = new T.DataTexture(data, n, n, T.RGBAFormat);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.needsUpdate = true;
    if (T.SRGBColorSpace) t.colorSpace = mode === 'normal' ? T.NoColorSpace : T.SRGBColorSpace;
    return t;
  }

  function grainNormalTexture(seed, strength) {
    const n = 64;
    const data = new Uint8Array(n * n * 4);
    const height = [];
    const r = seeded(seed);
    for (let y = 0; y < n; y++) {
      height[y] = [];
      for (let x = 0; x < n; x++) {
        height[y][x] = Math.sin(x * 0.82 + Math.sin(y * 0.13) * 2.2) * 0.55 +
          Math.sin(x * 0.19 + y * 0.07) * 0.25 + (r() - 0.5) * 0.12;
      }
    }
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const xl = height[y][(x - 1 + n) % n];
        const xr = height[y][(x + 1) % n];
        const yl = height[(y - 1 + n) % n][x];
        const yr = height[(y + 1) % n][x];
        let nx = (xl - xr) * strength;
        let ny = (yl - yr) * strength;
        const len = Math.hypot(nx, ny, 1) || 1;
        nx /= len; ny /= len;
        const i = (y * n + x) * 4;
        data[i] = Math.round((nx * 0.5 + 0.5) * 255);
        data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        data[i + 2] = Math.round((1 / len * 0.5 + 0.5) * 255);
        data[i + 3] = 255;
      }
    }
    const t = new T.DataTexture(data, n, n, T.RGBAFormat);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.needsUpdate = true;
    if (T.NoColorSpace) t.colorSpace = T.NoColorSpace;
    return t;
  }

  function patternedSailTexture(striped) {
    const n = 128;
    const data = new Uint8Array(n * n * 4);
    const r = seeded(striped ? 902 : 118);
    for (let y = 0; y < n; y++) {
      const stripe = striped && ((y > 16 && y < 31) || (y > 61 && y < 78) || (y > 105 && y < 118));
      for (let x = 0; x < n; x++) {
        const i = (y * n + x) * 4;
        const weave = Math.sin(x * 0.72) * 2.2 + Math.sin(y * 0.91) * 2.0 + (r() - 0.5) * 5;
        const c = stripe ? [151, 35, 34] : [229, 220, 199];
        data[i] = Math.max(0, Math.min(255, c[0] + weave));
        data[i + 1] = Math.max(0, Math.min(255, c[1] + weave));
        data[i + 2] = Math.max(0, Math.min(255, c[2] + weave));
        data[i + 3] = 255;
      }
    }
    const t = new T.DataTexture(data, n, n, T.RGBAFormat);
    t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
    t.needsUpdate = true;
    if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace;
    return t;
  }

  function getTexture(key, rx, ry, srgb, base, normal) {
    const src = assets.tex && assets.tex[key];
    let t;
    if (src && src.isTexture) {
      t = src.clone();
      t.needsUpdate = true;
    } else {
      t = fallbackTexture(base || [160, 150, 130], key.length * 37, normal ? 'normal' : 'color');
    }
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = 4;
    if (T.SRGBColorSpace) t.colorSpace = srgb === false ? T.NoColorSpace : T.SRGBColorSpace;
    return t;
  }

  const texSand = getTexture('sand', 2.4, 2.4, true, [198, 174, 127]);
  const texGrass = getTexture('grass', 2.0, 2.0, true, [83, 116, 58]);
  const texWood = getTexture('wood', 1.6, 1.0, true, [94, 59, 35]);
  const texDeck = getTexture('woodTable', 2.2, 1.0, true, [139, 96, 55]);
  const texWaterNormal = getTexture('waterNormal', 3.0, 3.0, false, [128, 128, 255], true);
  const texGrainNormal = grainNormalTexture(41, 0.85);
  const texSail = patternedSailTexture(false);
  const texSailRed = patternedSailTexture(true);

  const M = {
    island: new T.MeshStandardMaterial({
      map: texSand, normalMap: texGrainNormal,
      normalScale: new T.Vector2(0.16, 0.16), roughness: 0.96, metalness: 0
    }),
    foam: new T.MeshBasicMaterial({ color: 0xdfe9e8, transparent: true, opacity: 0.38, depthWrite: false }),
    hull: new T.MeshStandardMaterial({
      map: texWood, normalMap: texGrainNormal, normalScale: new T.Vector2(0.22, 0.22),
      color: 0x8a5838, roughness: 0.61, metalness: 0.05
    }),
    deck: new T.MeshStandardMaterial({
      map: texDeck, normalMap: texGrainNormal, normalScale: new T.Vector2(0.18, 0.18),
      color: 0xb98b56, roughness: 0.78, metalness: 0.02
    }),
    trim: new T.MeshStandardMaterial({ color: 0x4a2c1d, roughness: 0.66 }),
    keel: new T.MeshStandardMaterial({ color: 0x33231a, roughness: 0.58, metalness: 0.12 }),
    mast: new T.MeshStandardMaterial({ map: texWood, color: 0x7a4d2f, roughness: 0.7 }),
    rope: new T.MeshStandardMaterial({ color: 0x7a6245, roughness: 1.0 }),
    ropeLine: new T.LineBasicMaterial({ color: 0x5d4932, transparent: true, opacity: 0.9 }),
    plankLine: new T.LineBasicMaterial({ color: 0x5b3a24, transparent: true, opacity: 0.48 }),
    white: new T.MeshStandardMaterial({ color: 0xe8e6de, roughness: 0.62 }),
    red: new T.MeshStandardMaterial({ color: 0xa72f2b, roughness: 0.55 }),
    darkRed: new T.MeshStandardMaterial({ color: 0x6f211f, roughness: 0.62 }),
    roof: new T.MeshStandardMaterial({ color: 0x6a3b2b, roughness: 0.82 }),
    glass: new T.MeshPhysicalMaterial({
      color: 0xffe1a2, roughness: 0.08, metalness: 0.0, transmission: 0.58,
      thickness: 0.08, transparent: true, opacity: 0.62, side: T.DoubleSide
    }),
    lamp: new T.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb345, emissiveIntensity: 2.4, roughness: 0.35 }),
    beam: new T.MeshBasicMaterial({
      color: 0xffdca0, transparent: true, opacity: 0.11, blending: T.AdditiveBlending,
      depthWrite: false, side: T.DoubleSide
    }),
    window: new T.MeshStandardMaterial({
      color: 0xffc56e, emissive: 0xff9c3d, emissiveIntensity: 2.0, roughness: 0.3, side: T.DoubleSide
    }),
    sail: new T.MeshStandardMaterial({ map: texSail, color: 0xffffff, roughness: 0.93, metalness: 0, side: T.DoubleSide }),
    sailRed: new T.MeshStandardMaterial({ map: texSailRed, color: 0xffffff, roughness: 0.93, metalness: 0, side: T.DoubleSide }),
    leaf: new T.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.86, side: T.DoubleSide }),
    leafDark: new T.MeshStandardMaterial({ color: 0x2f6332, roughness: 0.9, side: T.DoubleSide }),
    coconut: new T.MeshStandardMaterial({ color: 0x6b4528, roughness: 0.88 }),
    gold: new T.MeshStandardMaterial({ color: 0xffcb54, emissive: 0x7c4b00, emissiveIntensity: 0.5, metalness: 0.86, roughness: 0.22 }),
    brass: new T.MeshStandardMaterial({ color: 0xb4934d, metalness: 0.82, roughness: 0.3 }),
    iron: new T.MeshStandardMaterial({ color: 0x3c4145, metalness: 0.72, roughness: 0.52 }),
    clay: new T.MeshStandardMaterial({ color: 0xa8613e, roughness: 0.83 }),
    coralPink: new T.MeshStandardMaterial({ color: 0xdf7f7a, roughness: 0.74 }),
    coralOrange: new T.MeshStandardMaterial({ color: 0xe29a4b, roughness: 0.76 }),
    coralViolet: new T.MeshStandardMaterial({ color: 0xa77bb8, roughness: 0.78 }),
    seabed: new T.MeshStandardMaterial({
      color: 0x6f7967, normalMap: texWaterNormal, normalScale: new T.Vector2(0.12, 0.12), roughness: 0.98
    }),
    bubble: new T.MeshPhysicalMaterial({
      color: 0xcfeaff, roughness: 0.04, metalness: 0, transmission: 0.8,
      transparent: true, opacity: 0.46, depthWrite: false
    }),
    crab: new T.MeshStandardMaterial({ color: 0xc65b3a, roughness: 0.7 }),
    fishA: new T.MeshStandardMaterial({ color: 0x5ea6c4, roughness: 0.48, metalness: 0.18 }),
    fishB: new T.MeshStandardMaterial({ color: 0xd1ab67, roughness: 0.5, metalness: 0.12 }),
    eye: new T.MeshStandardMaterial({ color: 0x101418, roughness: 0.25 })
  };

  function addMesh(parent, geometry, material, position, rotation, scale) {
    const m = new T.Mesh(geometry, material);
    if (position) m.position.set(position[0], position[1], position[2]);
    if (rotation) m.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    if (parent) parent.add(m);
    return m;
  }

  function addLines(parent, pairs, material) {
    const pts = [];
    for (const p of pairs) pts.push(new T.Vector3(p[0][0], p[0][1], p[0][2]), new T.Vector3(p[1][0], p[1][1], p[1][2]));
    const line = new T.LineSegments(new T.BufferGeometry().setFromPoints(pts), material);
    if (parent) parent.add(line);
    return line;
  }

  function cylinderBetween(parent, a, b, rBottom, rTop, material, radial) {
    const av = new T.Vector3(a[0], a[1], a[2]);
    const bv = new T.Vector3(b[0], b[1], b[2]);
    const d = bv.clone().sub(av);
    const len = d.length();
    const g = new T.CylinderGeometry(rTop, rBottom, len, radial || 12, 1, false);
    const m = addMesh(parent, g, material);
    m.position.copy(av.clone().add(bv).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    return m;
  }

  function taperedCurveTube(points, r0, r1, segments, radial) {
    const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(p[0], p[1], p[2])));
    const seg = segments || 18;
    const sides = radial || 8;
    const frames = curve.computeFrenetFrames(seg, false);
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      const p = curve.getPointAt(u);
      const r = lerp(r0, r1, u);
      for (let j = 0; j <= sides; j++) {
        const v = j / sides;
        const ang = v * Math.PI * 2;
        const nx = Math.cos(ang) * r;
        const ny = Math.sin(ang) * r;
        pos.push(
          p.x + frames.normals[i].x * nx + frames.binormals[i].x * ny,
          p.y + frames.normals[i].y * nx + frames.binormals[i].y * ny,
          p.z + frames.normals[i].z * nx + frames.binormals[i].z * ny
        );
        uv.push(u, v);
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < sides; j++) {
        const a = i * (sides + 1) + j;
        const b = (i + 1) * (sides + 1) + j;
        const c = a + 1;
        const d = b + 1;
        idx.push(a, c, b, c, d, b);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function addRopeCurve(parent, points, radius, material) {
    const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(p[0], p[1], p[2])));
    return addMesh(parent, new T.TubeGeometry(curve, 28, radius, 6, false), material);
  }

  function billowSail(width, height, rows, cols, bulge) {
    const g = new T.PlaneGeometry(width, height, cols, rows);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const u = x / width + 0.5;
      const v = y / height + 0.5;
      const belly = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      const ripple = Math.sin(u * Math.PI * 5 + v * 2.4) * 0.018 * Math.sin(Math.PI * v);
      p.setZ(i, bulge * belly + ripple);
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
    g.userData.base = Float32Array.from(p.array);
    return g;
  }

  function collectLocalPoints(root) {
    root.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(root.matrixWorld).invert();
    const out = [];
    root.traverse((obj) => {
      if (!obj.isMesh && !obj.isLine && !obj.isLineSegments) return;
      const geo = obj.geometry;
      if (!geo) return;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const m = new T.Matrix4().multiplyMatrices(inv, obj.matrixWorld);
      for (let i = 0; i < 8; i++) {
        const v = new T.Vector3(
          i & 1 ? bb.max.x : bb.min.x,
          i & 2 ? bb.max.y : bb.min.y,
          i & 4 ? bb.max.z : bb.min.z
        ).applyMatrix4(m);
        out.push(v);
      }
    });
    return out;
  }

  function allInside(points, matrix, margin) {
    const v = new T.Vector3();
    for (const p of points) {
      v.copy(p).applyMatrix4(matrix);
      if (!insideBottle(v, margin)) return false;
    }
    return true;
  }

  function fitStatic(root) {
    const pts = collectLocalPoints(root);
    if (allInside(pts, root.matrixWorld, 0.09)) return 1;
    let lo = 0.05;
    let hi = 1;
    let best = lo;
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) * 0.5;
      const m = new T.Matrix4().compose(root.position, root.quaternion, new T.Vector3(mid, mid, mid));
      if (allInside(pts, m, 0.09)) { best = mid; lo = mid; } else { hi = mid; }
    }
    root.scale.setScalar(best);
    return best;
  }

  function fitShipVisual() {
    const pts = collectLocalPoints(shipVisual);
    const test = (s) => {
      const center = new T.Vector3();
      for (let ai = 0; ai < 72; ai++) {
        const a = (ai / 72) * TAU;
        center.set(-1.75 + Math.cos(a) * 3.25, SEA + 0.12, 0.05 + Math.sin(a) * 1.82);
        const yaw = Math.atan2(-Math.cos(a) * 1.82, -Math.sin(a) * 3.25);
        const my = new T.Matrix4().makeRotationY(yaw);
        const tr = new T.Matrix4().makeTranslation(center.x, center.y, center.z);
        for (const roll of [-0.13, 0, 0.13]) {
          for (const pitch of [-0.11, 0, 0.11]) {
            const m = tr.clone().multiply(my)
              .multiply(new T.Matrix4().makeRotationX(roll))
              .multiply(new T.Matrix4().makeRotationZ(pitch))
              .multiply(new T.Matrix4().makeScale(s, s, s));
            if (!allInside(pts, m, 0.09)) return false;
          }
        }
      }
      return true;
    };
    if (test(1)) return 1;
    let lo = 0.05, hi = 1, best = lo;
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) * 0.5;
      if (test(mid)) { best = mid; lo = mid; } else { hi = mid; }
    }
    return best;
  }

  function islandSurface(x, z) {
    const r = Math.hypot(x / 1.50, z / 1.28);
    const n = Math.sin(x * 8.3 + z * 3.7) * Math.cos(z * 7.1 - x * 2.4) * 0.025;
    return Math.max(0.03, 0.40 * Math.exp(-1.65 * r * r) + n + 0.08);
  }

  function buildIslandDome() {
    const g = new T.SphereGeometry(1, 96, 40);
    const p = g.attributes.position;
    const grass = [];
    const wet = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) * 1.50;
      const z = p.getZ(i) * 1.28;
      const r = Math.min(1, Math.hypot(x / 1.50, z / 1.28));
      const n = Math.sin(x * 8.3 + z * 3.7) * Math.cos(z * 7.1 - x * 2.4) * 0.025 +
        Math.sin(x * 18.7 - z * 10.9) * 0.011;
      let y = p.getY(i) * 0.17 + 0.40 * Math.exp(-1.65 * r * r) + n * (1 - r * 0.55);
      if (y < -0.12) y = -0.12 + (y + 0.12) * 0.22;
      p.setXYZ(i, x, y, z);
      grass.push(clamp01((0.74 - r) / 0.42) * clamp01((y - 0.06) / 0.26));
      wet.push(clamp01((r - 0.70) / 0.30) * clamp01((0.26 - y) / 0.24));
    }
    p.needsUpdate = true;
    g.setAttribute('aGrass', new T.Float32BufferAttribute(grass, 1));
    g.setAttribute('aWet', new T.Float32BufferAttribute(wet, 1));
    g.computeVertexNormals();

    const mat = M.island.clone();
    const vertexPrefix = [
      'attribute float aGrass;',
      'attribute float aWet;',
      'varying float vGrass;',
      'varying float vWet;',
      ''
    ].join('\n');
    const fragmentPrefix = [
      'uniform sampler2D grassMap;',
      'varying float vGrass;',
      'varying float vWet;',
      ''
    ].join('\n');
    const beginVertexReplacement = [
      '#include <begin_vertex>',
      'vGrass = aGrass;',
      'vWet = aWet;'
    ].join('\n');
    const mapFragmentReplacement = [
      '#ifdef USE_MAP',
      '  vec4 sandC = texture2D( map, vMapUv );',
      '  vec4 grassC = texture2D( grassMap, vMapUv * 1.35 );',
      '  float gm = smoothstep( 0.18, 0.78, vGrass );',
      '  vec4 mixedC = mix( sandC, grassC, gm );',
      '  float wm = smoothstep( 0.55, 1.0, vWet );',
      '  mixedC.rgb *= mix( vec3( 1.0 ), vec3( 0.55, 0.62, 0.64 ), wm );',
      '  diffuseColor *= mixedC;',
      '#endif'
    ].join('\n');
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.grassMap = { value: texGrass };
      shader.vertexShader = vertexPrefix + shader.vertexShader.replace(
        '#include <begin_vertex>',
        beginVertexReplacement
      );
      shader.fragmentShader = fragmentPrefix + shader.fragmentShader.replace(
        '#include <map_fragment>',
        mapFragmentReplacement
      );
    };
    mat.customProgramCacheKey = () => 'island-sand-grass-wet-v1';
    addMesh(islandGroup, g, mat, [0, -0.05, 0]);

    const foam = addMesh(islandGroup, new T.TorusGeometry(1.43, 0.018, 8, 120), M.foam, [0, 0.055, 0], [Math.PI / 2, 0, 0], [1, 0.86, 1]);
    foam.castShadow = false;
  }

  function buildLighthouse() {
    const lx = -0.47;
    const lz = -0.42;
    const baseY = islandSurface(lx, lz);
    const g = new T.Group();
    g.position.set(lx, baseY, lz);
    islandGroup.add(g);

    addMesh(g, new T.CylinderGeometry(0.25, 0.29, 0.12, 32), M.trim, [0, 0.06, 0]);
    addMesh(g, new T.CylinderGeometry(0.21, 0.24, 0.36, 32), M.white, [0, 0.30, 0]);
    addMesh(g, new T.CylinderGeometry(0.205, 0.215, 0.15, 32), M.red, [0, 0.555, 0]);
    addMesh(g, new T.CylinderGeometry(0.175, 0.19, 0.30, 32), M.white, [0, 0.78, 0]);
    addMesh(g, new T.CylinderGeometry(0.155, 0.17, 0.09, 32), M.trim, [0, 0.975, 0]);
    addMesh(g, new T.CylinderGeometry(0.125, 0.125, 0.22, 32), M.glass, [0, 1.11, 0]);
    addMesh(g, new T.SphereGeometry(0.052, 18, 12), M.lamp, [0, 1.11, 0]);
    addMesh(g, new T.CylinderGeometry(0.16, 0.145, 0.035, 32), M.brass, [0, 1.235, 0]);
    addMesh(g, new T.ConeGeometry(0.18, 0.19, 32), M.darkRed, [0, 1.35, 0]);
    addMesh(g, new T.SphereGeometry(0.024, 12, 8), M.brass, [0, 1.46, 0]);

    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU;
      cylinderBetween(g, [Math.cos(a) * 0.13, 1.0, Math.sin(a) * 0.13],
        [Math.cos(a) * 0.13, 1.23, Math.sin(a) * 0.13], 0.008, 0.008, M.brass, 8);
    }

    const pivot = new T.Group();
    pivot.position.set(0, 1.11, 0);
    g.add(pivot);
    const beamGeo = new T.ConeGeometry(0.34, 1.85, 36, 1, true);
    beamGeo.translate(0, -0.925, 0);
    const beam = addMesh(pivot, beamGeo, M.beam, [0, 0, 0], [0, 0, Math.PI / 2]);
    beam.castShadow = false;
    beam.receiveShadow = false;
    const beam2 = addMesh(pivot, beamGeo.clone(), M.beam, [0, 0, 0], [0, 0, -Math.PI / 2]);
    beam2.castShadow = false;
    beam2.receiveShadow = false;

    const light = new T.PointLight(0xffc37a, 2.4, 3.2, 2);
    light.position.set(0, 1.11, 0);
    g.add(light);
    animators.push((t) => {
      pivot.rotation.y = t * 0.68;
      const night = 1 - (typeof st.day === 'number' ? st.day : 0.7);
      light.intensity = 1.1 + night * 2.4 + (st.lightning || 0) * 1.5;
      M.lamp.emissiveIntensity = 1.8 + night * 1.3;
      M.beam.opacity = 0.055 + night * 0.075;
    });
  }

  function buildHut() {
    const hx = 0.42;
    const hz = 0.34;
    const baseY = islandSurface(hx, hz);
    const g = new T.Group();
    g.position.set(hx, baseY, hz);
    g.rotation.y = -0.34;
    islandGroup.add(g);

    addMesh(g, new RoundedBoxGeometry(0.60, 0.38, 0.48, 4, 0.035), M.white, [0, 0.20, 0]);
    addMesh(g, new RoundedBoxGeometry(0.66, 0.055, 0.54, 4, 0.02), M.trim, [0, 0.405, 0]);

    const roofShape = new T.Shape();
    roofShape.moveTo(-0.40, 0);
    roofShape.lineTo(0, 0.29);
    roofShape.lineTo(0.40, 0);
    roofShape.closePath();
    const roofGeo = new T.ExtrudeGeometry(roofShape, {
      depth: 0.58, bevelEnabled: true, bevelSize: 0.025,
      bevelThickness: 0.025, bevelSegments: 3, curveSegments: 4
    });
    roofGeo.translate(0, 0, -0.29);
    addMesh(g, roofGeo, M.roof, [0, 0.43, 0]);

    addMesh(g, new RoundedBoxGeometry(0.10, 0.18, 0.015, 3, 0.008), M.trim, [0, 0.16, 0.246]);
    addMesh(g, new RoundedBoxGeometry(0.15, 0.13, 0.012, 3, 0.006), M.window, [-0.18, 0.24, 0.248]);
    addMesh(g, new RoundedBoxGeometry(0.15, 0.13, 0.012, 3, 0.006), M.window, [0.18, 0.24, 0.248]);
    addMesh(g, new RoundedBoxGeometry(0.14, 0.12, 0.012, 3, 0.006), M.window, [0, 0.24, -0.248]);

    const glow = new T.PointLight(0xffa94d, 1.5, 1.8, 2);
    glow.position.set(0, 0.25, 0.10);
    g.add(glow);
    animators.push(() => {
      const night = 1 - (typeof st.day === 'number' ? st.day : 0.7);
      glow.intensity = 0.75 + night * 1.7 + (st.lightning || 0) * 0.5;
      M.window.emissiveIntensity = 1.2 + night * 1.6;
    });
  }

  function buildPalm(x, z, height) {
    const baseY = islandSurface(x, z);
    const g = new T.Group();
    g.position.set(x, baseY, z);
    islandGroup.add(g);
    const lean = (random() - 0.5) * 0.16;
    const trunk = [
      [0, 0, 0],
      [lean * 0.22, height * 0.32, 0],
      [lean * 0.62, height * 0.68, 0],
      [lean, height, 0]
    ];
    addMesh(g, taperedCurveTube(trunk, 0.055, 0.028, 22, 10), M.mast);

    const crown = new T.Group();
    crown.position.set(lean, height, 0);
    g.add(crown);
    addMesh(crown, new T.SphereGeometry(0.052, 12, 8), M.coconut, [0, 0, 0]);
    const leafCount = 8;
    for (let i = 0; i < leafCount; i++) {
      const a = (i / leafCount) * TAU + random() * 0.18;
      const len = 0.46 + random() * 0.16;
      const leafGeo = new T.PlaneGeometry(0.115, len, 4, 14);
      const p = leafGeo.attributes.position;
      for (let v = 0; v < p.count; v++) {
        const px = p.getX(v);
        const py = p.getY(v);
        const u = py / len + 0.5;
        const taper = Math.sin(Math.PI * Math.min(1, u * 0.98));
        p.setX(v, px * (0.35 + 0.65 * taper));
        p.setZ(v, -0.16 * u * u + Math.sin(u * Math.PI) * 0.045);
      }
      p.needsUpdate = true;
      leafGeo.computeVertexNormals();
      const leaf = addMesh(crown, leafGeo, i % 2 ? M.leaf : M.leafDark,
        [Math.cos(a) * 0.03, 0.01, Math.sin(a) * 0.03],
        [-0.48 - random() * 0.18, -a, 0]);
      leaf.castShadow = true;
    }
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU;
      addMesh(crown, new T.SphereGeometry(0.035, 12, 8), M.coconut,
        [Math.cos(a) * 0.05, -0.045, Math.sin(a) * 0.05]);
    }
    return g;
  }

  function buildDockAndRowboat() {
    const dock = new T.Group();
    dock.position.set(0.93, 0.025, 0.55);
    dock.rotation.y = -0.22;
    islandGroup.add(dock);
    for (let i = 0; i < 8; i++) {
      addMesh(dock, new RoundedBoxGeometry(0.15, 0.045, 0.62, 3, 0.012),
        M.deck, [i * 0.14, 0, 0], [0, 0, 0]);
    }
    for (let i = 0; i < 4; i++) {
      const x = i * 0.32 + 0.03;
      for (const z of [-0.27, 0.27]) {
        cylinderBetween(dock, [x, -0.38, z], [x, 0.08, z], 0.024, 0.02, M.trim, 10);
      }
    }

    const rowboat = new T.Group();
    rowboat.position.set(1.76, 0.015, 0.78);
    rowboat.rotation.y = -0.52;
    rowboat.scale.setScalar(0.42);
    islandGroup.add(rowboat);
    buildHull(rowboat, { small: true });
    cylinderBetween(rowboat, [-0.10, 0.30, -0.24], [0.54, 0.34, -0.34], 0.012, 0.009, M.mast, 8);
    cylinderBetween(rowboat, [-0.10, 0.30, 0.24], [0.54, 0.34, 0.34], 0.012, 0.009, M.mast, 8);
    const baseY = rowboat.position.y;
    animators.push((t) => {
      const h = waveFn(rowboat.position.x + ISLAND.x, rowboat.position.z + ISLAND.z, t, st.storm || 0);
      rowboat.position.y = baseY + h * 0.35;
      rowboat.rotation.z = Math.sin(t * 1.1 + 1.2) * 0.035 * (1 + (st.storm || 0));
    });
  }

  function buildChest(parent, position, scale, open) {
    const g = new T.Group();
    g.position.set(position[0], position[1], position[2]);
    g.scale.setScalar(scale);
    parent.add(g);
    addMesh(g, new RoundedBoxGeometry(0.40, 0.24, 0.27, 4, 0.025), M.trim, [0, 0.12, 0]);
    const lid = addMesh(g, new RoundedBoxGeometry(0.42, 0.10, 0.29, 4, 0.025), M.deck,
      [0, open ? 0.34 : 0.26, open ? -0.07 : 0], [open ? -0.72 : 0, 0, 0]);
    for (const x of [-0.15, 0.15]) {
      addMesh(g, new RoundedBoxGeometry(0.035, 0.27, 0.285, 3, 0.008), M.brass, [x, 0.14, 0]);
    }
    addMesh(g, new T.SphereGeometry(0.028, 12, 8), M.gold, [0, 0.22, 0.142]);
    if (open) {
      for (let i = 0; i < 7; i++) {
        addMesh(g, new T.CylinderGeometry(0.042, 0.042, 0.012, 18), M.gold,
          [(random() - 0.5) * 0.22, 0.27 + random() * 0.05, (random() - 0.5) * 0.16],
          [0.12, random() * TAU, 0.08]);
      }
    }
    const glow = new T.PointLight(0xffc24d, 1.2, 2.0, 2);
    glow.position.set(0, 0.30, 0);
    g.add(glow);
    animators.push((t) => {
      glow.intensity = 1.0 + Math.sin(t * 2.3 + position[0] * 3) * 0.22;
      lid.rotation.x = open ? -0.72 + Math.sin(t * 0.9) * 0.025 : 0;
    });
    return g;
  }

  function buildAnchor(position) {
    const g = new T.Group();
    g.position.set(position[0], position[1], position[2]);
    g.rotation.z = -0.48;
    islandGroup.add(g);
    cylinderBetween(g, [0, -0.28, 0], [0, 0.24, 0], 0.028, 0.028, M.iron, 12);
    addMesh(g, new T.TorusGeometry(0.065, 0.017, 10, 24), M.iron, [0, 0.32, 0]);
    addMesh(g, new RoundedBoxGeometry(0.36, 0.035, 0.05, 3, 0.01), M.iron, [0, -0.24, 0]);
    addRopeCurve(g, [[-0.17, -0.22, 0], [-0.13, -0.34, 0], [0, -0.38, 0], [0.13, -0.34, 0], [0.17, -0.22, 0]], 0.022, M.iron);
    addMesh(g, new T.ConeGeometry(0.045, 0.10, 4), M.iron, [-0.18, -0.22, 0], [0, 0, Math.PI / 2]);
    addMesh(g, new T.ConeGeometry(0.045, 0.10, 4), M.iron, [0.18, -0.22, 0], [0, 0, -Math.PI / 2]);
  }

  function buildAmphora(position, scale, rotation) {
    const g = new T.Group();
    g.position.set(position[0], position[1], position[2]);
    g.scale.setScalar(scale);
    g.rotation.set(rotation[0], rotation[1], rotation[2]);
    islandGroup.add(g);
    const pts = [
      [0.035, -0.24], [0.085, -0.20], [0.120, -0.08], [0.125, 0.05],
      [0.095, 0.17], [0.055, 0.22], [0.052, 0.29], [0.075, 0.31]
    ].map((p) => new T.Vector2(p[0], p[1]));
    addMesh(g, new T.LatheGeometry(pts, 28), M.clay);
    for (const side of [-1, 1]) {
      addMesh(g, new T.TorusGeometry(0.075, 0.014, 8, 20, Math.PI), M.clay,
        [side * 0.105, 0.17, 0], [0, side * Math.PI / 2, side * 0.25]);
    }
  }

  function buildCoral(position, colorMat, scale, seed) {
    const r = seeded(seed);
    const g = new T.Group();
    g.position.set(position[0], position[1], position[2]);
    g.scale.setScalar(scale);
    islandGroup.add(g);
    function branch(start, dir, length, radius, depth) {
      const end = [
        start[0] + dir[0] * length,
        start[1] + dir[1] * length,
        start[2] + dir[2] * length
      ];
      const mid = [
        (start[0] + end[0]) * 0.5 + (r() - 0.5) * 0.07,
        (start[1] + end[1]) * 0.5,
        (start[2] + end[2]) * 0.5 + (r() - 0.5) * 0.07
      ];
      addMesh(g, taperedCurveTube([start, mid, end], radius, radius * 0.55, 10, 7), colorMat);
      if (depth <= 0) {
        addMesh(g, new T.SphereGeometry(radius * 0.85, 8, 6), colorMat, end);
        return;
      }
      for (let k = 0; k < 2; k++) {
        const sign = k === 0 ? -1 : 1;
        const nd = [
          dir[0] + sign * (0.35 + r() * 0.25),
          dir[1] * 0.82 + 0.18,
          dir[2] + (r() - 0.5) * 0.5
        ];
        const l = Math.hypot(nd[0], nd[1], nd[2]) || 1;
        branch(end, [nd[0] / l, nd[1] / l, nd[2] / l], length * 0.70, radius * 0.62, depth - 1);
      }
    }
    branch([0, 0, 0], [0, 1, 0], 0.30, 0.035, 2);
  }

  function buildFishSchool() {
    const fish = [];
    const centers = [
      [-1.55, -1.05, -0.32], [-1.10, -1.28, 0.42],
      [-0.35, -0.94, -0.55], [-2.25, -1.50, 0.15]
    ];
    for (let c = 0; c < centers.length; c++) {
      for (let i = 0; i < 5; i++) {
        const g = new T.Group();
        const mat = (c + i) % 2 ? M.fishA : M.fishB;
        addMesh(g, new T.SphereGeometry(1, 16, 10), mat, [0, 0, 0], null, [0.095, 0.050, 0.032]);
        addMesh(g, new T.ConeGeometry(0.045, 0.085, 3), mat, [-0.115, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.35]);
        addMesh(g, new T.SphereGeometry(0.010, 8, 6), M.eye, [0.061, 0.017, 0.026]);
        islandGroup.add(g);
        fish.push({ g, center: centers[c], phase: random() * TAU, radius: 0.18 + random() * 0.26, speed: 0.45 + random() * 0.35 });
      }
    }
    animators.push((t) => {
      for (const f of fish) {
        const a = t * f.speed + f.phase;
        f.g.position.set(
          f.center[0] + Math.cos(a) * f.radius,
          f.center[1] + Math.sin(a * 1.7) * 0.055,
          f.center[2] + Math.sin(a) * f.radius * 0.62
        );
        f.g.rotation.y = -a + Math.PI / 2;
      }
    });
  }

  function buildBubbles() {
    const bubbles = [];
    const origins = [[-1.35, -1.42, -0.62], [-0.62, -1.58, 0.31], [-2.55, -1.33, 0.48]];
    for (let i = 0; i < 24; i++) {
      const o = origins[i % origins.length];
      const b = addMesh(islandGroup, new T.SphereGeometry(0.012 + random() * 0.016, 10, 8), M.bubble);
      b.castShadow = false;
      bubbles.push({ b, o, phase: random(), speed: 0.11 + random() * 0.09, drift: (random() - 0.5) * 0.12 });
    }
    animators.push((t) => {
      for (const q of bubbles) {
        const u = (q.phase + t * q.speed) % 1;
        q.b.position.set(q.o[0] + Math.sin(t * 1.3 + q.phase * 9) * q.drift, q.o[1] + u * 1.12, q.o[2] + Math.cos(t + q.phase * 7) * q.drift);
        const s = 0.65 + u * 0.55;
        q.b.scale.setScalar(s);
      }
    });
  }

  function buildCrab() {
    const g = new T.Group();
    const x = 0.98, z = -0.43;
    g.position.set(x, islandSurface(x, z) + 0.03, z);
    islandGroup.add(g);
    addMesh(g, new T.SphereGeometry(1, 20, 12), M.crab, [0, 0.045, 0], null, [0.10, 0.052, 0.075]);
    for (const side of [-1, 1]) {
      addMesh(g, new T.SphereGeometry(0.035, 12, 8), M.crab, [side * 0.115, 0.065, -0.045]);
      cylinderBetween(g, [side * 0.065, 0.035, -0.02], [side * 0.13, 0.055, -0.09], 0.011, 0.008, M.crab, 8);
      for (let i = 0; i < 3; i++) {
        cylinderBetween(g, [side * 0.07, 0.025, -0.01 + i * 0.035],
          [side * (0.15 + i * 0.012), 0.005, -0.02 + i * 0.05], 0.008, 0.005, M.crab, 6);
      }
    }
    addMesh(g, new T.SphereGeometry(0.009, 8, 6), M.eye, [0.045, 0.085, -0.055]);
    addMesh(g, new T.SphereGeometry(0.009, 8, 6), M.eye, [-0.045, 0.085, -0.055]);
    animators.push((t) => {
      g.position.x = x + Math.sin(t * 0.42) * 0.045;
      g.rotation.y = Math.sin(t * 0.31) * 0.16;
    });
  }

  function buildHull(parent, options) {
    const small = !!(options && options.small);
    const hull = new T.Group();
    hull.name = small ? 'rowboat-hull' : 'ship-hull';
    parent.add(hull);

    const profile = [
      { x: -1.28, w: 0.10, d: 0.18, deck: 0.30 },
      { x: -1.05, w: 0.31, d: 0.27, deck: 0.25 },
      { x: -0.55, w: 0.43, d: 0.34, deck: 0.205 },
      { x: 0.15, w: 0.44, d: 0.36, deck: 0.205 },
      { x: 0.75, w: 0.36, d: 0.31, deck: 0.245 },
      { x: 1.12, w: 0.20, d: 0.23, deck: 0.33 },
      { x: 1.42, w: 0.012, d: 0.08, deck: 0.48 }
    ];
    function at(x) {
      for (let i = 0; i < profile.length - 1; i++) {
        if (x <= profile[i + 1].x) {
          const a = profile[i], b = profile[i + 1];
          const t = smoothstep(a.x, b.x, x);
          return { w: lerp(a.w, b.w, t), d: lerp(a.d, b.d, t), deck: lerp(a.deck, b.deck, t) };
        }
      }
      return profile[profile.length - 1];
    }

    const N = 54, C = 14;
    const verts = [], uvs = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const x = lerp(-1.28, 1.42, i / N);
      const p = at(x);
      for (let j = 0; j <= C; j++) {
        const th = (j / C) * Math.PI;
        const z = p.w * Math.cos(th);
        const y = p.deck - p.d * Math.sin(th) + 0.018 * Math.pow(Math.abs(Math.cos(th)), 4);
        verts.push(x, y, z);
        uvs.push(i / N, j / C);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < C; j++) {
        const a = i * (C + 1) + j;
        const b = (i + 1) * (C + 1) + j;
        const c = a + 1;
        const d = b + 1;
        idx.push(a, c, b, c, d, b);
      }
    }
    const hullGeo = new T.BufferGeometry();
    hullGeo.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
    hullGeo.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    hullGeo.setIndex(idx);
    hullGeo.computeVertexNormals();
    addMesh(hull, hullGeo, M.hull);

    const Q = 10;
    const dv = [], du = [], di = [];
    for (let i = 0; i <= N; i++) {
      const x = lerp(-1.28, 1.42, i / N);
      const p = at(x);
      for (let q = 0; q <= Q; q++) {
        const u = -1 + (2 * q) / Q;
        const z = p.w * u * 0.95;
        const y = p.deck + 0.012 * (1 - u * u) + 0.008 * Math.sin(x * 12) * Math.sin(u * Math.PI);
        dv.push(x, y, z);
        du.push(i / N, q / Q);
      }
    }
    for (let i = 0; i < N; i++) {
      for (let q = 0; q < Q; q++) {
        const a = i * (Q + 1) + q;
        const b = (i + 1) * (Q + 1) + q;
        const c = a + 1;
        const d = b + 1;
        di.push(a, c, b, c, d, b);
      }
    }
    const deckGeo = new T.BufferGeometry();
    deckGeo.setAttribute('position', new T.Float32BufferAttribute(dv, 3));
    deckGeo.setAttribute('uv', new T.Float32BufferAttribute(du, 2));
    deckGeo.setIndex(di);
    deckGeo.computeVertexNormals();
    addMesh(hull, deckGeo, M.deck);

    const plankPairs = [];
    for (const q of [0.2, 0.4, 0.6, 0.8]) {
      for (let i = 0; i < N; i += 2) {
        const x0 = lerp(-1.28, 1.42, i / N);
        const x1 = lerp(-1.28, 1.42, (i + 1) / N);
        const p0 = at(x0), p1 = at(x1);
        plankPairs.push([[x0, p0.deck + 0.014, p0.w * q * 0.94], [x1, p1.deck + 0.014, p1.w * q * 0.94]]);
        plankPairs.push([[x0, p0.deck + 0.014, -p0.w * q * 0.94], [x1, p1.deck + 0.014, -p1.w * q * 0.94]]);
      }
    }
    addLines(hull, plankPairs, M.plankLine);

    for (const side of [1, -1]) {
      const railPts = [];
      for (let i = 0; i <= N; i += 2) {
        const x = lerp(-1.28, 1.42, i / N);
        const p = at(x);
        railPts.push(new T.Vector3(x, p.deck + 0.13, side * p.w * 0.98));
      }
      addMesh(hull, new T.TubeGeometry(new T.CatmullRomCurve3(railPts), N, 0.018, 6, false), M.trim);
      for (let i = 4; i < N - 3; i += 7) {
        const x = lerp(-1.28, 1.42, i / N);
        const p = at(x);
        cylinderBetween(hull, [x, p.deck, side * p.w * 0.95],
          [x, p.deck + 0.135, side * p.w * 0.98], 0.010, 0.010, M.trim, 8);
      }
    }

    const keelShape = new T.Shape();
    keelShape.moveTo(-1.18, -0.26);
    keelShape.quadraticCurveTo(0.05, -0.47, 1.34, -0.20);
    keelShape.lineTo(1.20, -0.14);
    keelShape.quadraticCurveTo(0.00, -0.34, -1.10, -0.17);
    keelShape.closePath();
    const keelEx = new T.ExtrudeGeometry(keelShape, {
      depth: 0.07, bevelEnabled: true, bevelSize: 0.022,
      bevelThickness: 0.018, bevelSegments: 3, curveSegments: 12
    });
    keelEx.translate(0, 0, -0.035);
    addMesh(hull, keelEx, M.keel);

    const lathePts = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16;
      const r = Math.max(0.004, Math.sin(Math.PI * u) * 0.105);
      lathePts.push(new T.Vector2(r, lerp(-1.15, 1.35, u)));
    }
    const keelLathe = new T.LatheGeometry(lathePts, 18);
    keelLathe.rotateZ(-Math.PI / 2);
    keelLathe.scale(1, 0.62, 0.35);
    keelLathe.translate(0, -0.40, 0);
    addMesh(hull, keelLathe, M.keel);

    const transom = new T.Shape();
    transom.moveTo(-1.31, 0.16);
    transom.lineTo(-1.31, 0.45);
    transom.quadraticCurveTo(-1.18, 0.50, -1.05, 0.31);
    transom.lineTo(-1.05, 0.19);
    transom.closePath();
    const transomGeo = new T.ExtrudeGeometry(transom, {
      depth: 0.17, bevelEnabled: true, bevelSize: 0.02,
      bevelThickness: 0.018, bevelSegments: 3, curveSegments: 8
    });
    transomGeo.translate(0, 0, -0.085);
    addMesh(hull, transomGeo, M.trim);

    if (!small) {
      cylinderBetween(hull, [1.34, 0.36, 0], [1.96, 0.57, 0], 0.034, 0.011, M.mast, 12);
      addMesh(hull, new T.SphereGeometry(0.022, 10, 8), M.brass, [1.96, 0.57, 0]);
    }
    return hull;
  }

  function buildRigging() {
    buildHull(shipVisual, {});
    const defs = [
      { x: 0.82, h: 1.48, r: 0.030, yards: [
        { y: 0.50, w: 0.62, sh: 0.33 },
        { y: 1.04, w: 0.44, sh: 0.25 }
      ] },
      { x: 0.02, h: 1.98, r: 0.038, yards: [
        { y: 0.46, w: 0.80, sh: 0.42, stripe: true },
        { y: 1.02, w: 0.65, sh: 0.36, stripe: true },
        { y: 1.52, w: 0.47, sh: 0.28 }
      ] },
      { x: -0.78, h: 1.42, r: 0.027, yards: [
        { y: 0.48, w: 0.56, sh: 0.31 },
        { y: 0.96, w: 0.40, sh: 0.24 }
      ] }
    ];
    const ropePairs = [];
    for (const def of defs) {
      const topY = 0.20 + def.h;
      cylinderBetween(shipVisual, [def.x, 0.17, 0], [def.x, topY, 0], def.r, def.r * 0.52, M.mast, 16);
      addMesh(shipVisual, new T.SphereGeometry(def.r * 0.85, 10, 8), M.brass, [def.x, topY, 0]);

      for (const yard of def.yards) {
        const y = 0.20 + yard.y;
        cylinderBetween(shipVisual, [def.x, y, -yard.w / 2], [def.x, y, yard.w / 2], 0.014, 0.014, M.mast, 10);
        const sailGeo = billowSail(yard.w * 0.94, yard.sh, 10, 16, 0.055 + yard.w * 0.055);
        const mat = yard.stripe ? M.sailRed : M.sail;
        addMesh(shipVisual, sailGeo, mat, [def.x + 0.012, y - yard.sh * 0.5 - 0.018, 0], [0, Math.PI / 2, 0]);
        sailParts.push({ geo: sailGeo, phase: random() * TAU });

        for (const s of [-1, 1]) {
          ropePairs.push([[def.x, y, s * yard.w / 2], [def.x, topY, 0]]);
          ropePairs.push([[def.x, y - yard.sh, s * yard.w * 0.46], [def.x, topY, 0]]);
        }
      }

      for (const s of [-1, 1]) {
        ropePairs.push([[def.x, topY, 0], [def.x - 0.28, 0.30, s * 0.34]]);
        ropePairs.push([[def.x, topY, 0], [def.x + 0.30, 0.30, s * 0.33]]);
      }
    }

    ropePairs.push([[0.02, 2.18, 0], [1.92, 0.57, 0]]);
    ropePairs.push([[0.02, 2.18, 0], [-1.25, 0.42, 0]]);
    ropePairs.push([[0.82, 1.68, 0], [1.92, 0.57, 0]]);
    ropePairs.push([[-0.78, 1.62, 0], [-1.25, 0.42, 0]]);
    addLines(shipVisual, ropePairs, M.ropeLine);

    addRopeCurve(shipVisual, [[1.92, 0.57, 0], [1.35, 1.24, 0], [0.02, 2.18, 0]], 0.007, M.rope);
    addRopeCurve(shipVisual, [[-1.25, 0.42, 0], [-0.60, 1.20, 0], [0.02, 2.18, 0]], 0.007, M.rope);

    const flagGeo = new T.PlaneGeometry(0.26, 0.10, 6, 2);
    const flag = addMesh(shipVisual, flagGeo, M.red, [-0.13, 2.13, 0], [0, 0, 0]);
    flag.material = M.red;
    animators.push((t) => {
      flag.rotation.y = Math.sin(t * 2.1) * 0.22;
      flag.rotation.z = Math.sin(t * 1.6) * 0.06;
    });
  }

  function buildIslandScene() {
    buildIslandDome();
    buildLighthouse();
    buildHut();
    buildPalm(-0.12, -0.62, 1.12);
    buildPalm(0.72, -0.22, 0.96);
    buildPalm(0.16, 0.78, 1.04);
    buildPalm(-0.78, 0.34, 0.86);
    buildDockAndRowboat();

    const tx = -0.18, tz = 0.54;
    buildChest(islandGroup, [tx, islandSurface(tx, tz) + 0.02, tz], 0.62, false);

    for (let i = 0; i < 14; i++) {
      const a = random() * TAU;
      const r = 0.55 + random() * 0.78;
      addMesh(islandGroup, new T.SphereGeometry(0.025 + random() * 0.035, 10, 8),
        random() > 0.5 ? M.coralPink : M.coralOrange,
        [Math.cos(a) * r, islandSurface(Math.cos(a) * r, Math.sin(a) * r) + 0.02, Math.sin(a) * r],
        [random(), random(), random()], [1.4, 0.7, 1.0]);
    }

    for (let i = 0; i < 5; i++) {
      addMesh(islandGroup, new T.SphereGeometry(0.38 + random() * 0.22, 28, 14), M.seabed,
        [(random() - 0.5) * 3.1, -0.90 - random() * 0.22, (random() - 0.5) * 2.1],
        [0, random() * TAU, 0], [1.5, 0.14, 1.0]);
    }

    buildChest(islandGroup, [1.26, -0.62, -0.74], 1.15, true);
    buildAnchor([-1.16, -1.08, 0.66]);
    buildAmphora([-0.74, -0.76, -0.86], 1.0, [0.24, 0.3, 0.15]);
    buildAmphora([-0.33, -0.82, 0.92], 0.92, [-0.18, 1.1, -0.1]);
    buildAmphora([0.62, -0.74, -1.02], 0.86, [0.32, -0.5, 0.28]);
    buildCoral([-1.38, -0.98, -0.82], M.coralPink, 1.0, 11);
    buildCoral([-0.20, -1.02, 1.18], M.coralOrange, 1.18, 29);
    buildCoral([0.98, -1.12, 0.52], M.coralViolet, 0.92, 47);
    buildCoral([0.35, -0.95, -1.22], M.coralPink, 0.86, 61);
    buildFishSchool();
    buildBubbles();
    buildCrab();
  }

  buildIslandScene();
  buildRigging();

  const initialStorm = typeof st.storm === 'number' ? st.storm : 0;
  update(0, 0, initialStorm);

  const islandFit = fitStatic(islandGroup);
  const shipFit = fitShipVisual();
  shipVisual.scale.setScalar(shipFit);
  islandGroup.userData.insideBottleFit = islandFit;
  shipGroup.userData.insideBottleFit = shipFit;
  shipGroup.userData.orbit = { cx: -1.75, cz: 0.05, rx: 3.25, rz: 1.82 };

  function attachToHost() {
    const g = typeof globalThis !== 'undefined' ? globalThis : null;
    const dbg = g && g.__SCENE_DEBUG__;
    const host = C.parent || C.innerWorld || C.root ||
      (g && g.__ISLAND_SHIP_HOST__) ||
      (dbg && dbg.env && dbg.env.innerWorld) ||
      (dbg && dbg.scene);
    if (host && typeof host.add === 'function' && !shipGroup.parent && !islandGroup.parent) {
      host.add(shipGroup);
      host.add(islandGroup);
      return true;
    }
    return false;
  }
  if (!attachToHost() && typeof requestAnimationFrame === 'function') {
    let tries = 0;
    const deferAttach = () => {
      if (attachToHost() || ++tries > 180) return;
      requestAnimationFrame(deferAttach);
    };
    requestAnimationFrame(deferAttach);
  }

  function update(t, dt, storm) {
    frame++;
    const s = Number.isFinite(storm) ? storm : (typeof st.storm === 'number' ? st.storm : 0);
    const speed = typeof st.speed === 'number' ? st.speed : 1;
    const a = t * 0.055 * speed + 0.35;
    const px = -1.75 + Math.cos(a) * 3.25;
    const pz = 0.05 + Math.sin(a) * 1.82;
    const yaw = Math.atan2(-Math.cos(a) * 1.82, -Math.sin(a) * 3.25);
    const fx = Math.cos(yaw);
    const fz = -Math.sin(yaw);
    const rx = Math.sin(yaw);
    const rz = Math.cos(yaw);

    const bow = waveFn(px + fx * 1.05, pz + fz * 1.05, t, s);
    const stern = waveFn(px - fx * 1.00, pz - fz * 1.00, t, s);
    const starboard = waveFn(px + rx * 0.42, pz + rz * 0.42, t, s);
    const port = waveFn(px - rx * 0.42, pz - rz * 0.42, t, s);
    const avg = (bow + stern + starboard + port) * 0.25;

    shipGroup.position.set(px, SEA + avg + 0.018, pz);
    shipGroup.rotation.y = yaw;
    shipVisual.rotation.x = Math.atan2(port - starboard, 0.84) * 0.85;
    shipVisual.rotation.z = Math.atan2(bow - stern, 2.05) * 0.85;

    if (frame % 2 === 0) {
      for (const sail of sailParts) {
        const p = sail.geo.attributes.position;
        const base = sail.geo.userData.base;
        const amp = 0.010 + s * 0.022;
        for (let i = 0; i < p.count; i++) {
          const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
          const w = Math.sin(Math.PI * (bx / 0.80 + 0.5)) * Math.sin(Math.PI * (by / 0.45 + 0.5));
          p.setZ(i, bz + amp * Math.sin(t * 2.7 + sail.phase + bx * 5.2 + by * 2.1) * w);
        }
        p.needsUpdate = true;
        sail.geo.computeVertexNormals();
      }
    }

    for (const fn of animators) fn(t, dt || 0, s);
  }

  update(0, 0, initialStorm);

  return {
    shipGroup,
    islandGroup,
    update,
    getShipPosition() {
      return shipGroup.position.clone();
    }
  };
}
