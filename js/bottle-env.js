import * as THREE from 'three';
import { tile } from './utils.js';
import { radiusAt, BOTTLE_X0, BOTTLE_X1, SEA, ISLAND } from './config.js';

const TAU = Math.PI * 2;
const GLASS_ORDER = 30;
const TOP_Y = 0.34;
const TABLE_X = ISLAND.x;
const TABLE_Z = ISLAND.z + 0.15;

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  draw(g, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function seeded(n) { let s = n >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function corkColorMap() {
  return canvasTexture(512, (g, s) => {
    const r = seeded(9271);
    g.fillStyle = '#b0824b'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 16000; i++) {
      const v = r();
      g.fillStyle = v > 0.55 ? 'rgba(62,36,18,' + (0.12 + v * 0.3) + ')'
        : 'rgba(238,199,139,' + (0.08 + v * 0.2) + ')';
      g.fillRect(r() * s, r() * s, 1 + r() * 4, 1 + r() * 12);
    }
    for (let i = 0; i < 120; i++) {
      const y = r() * s;
      g.strokeStyle = 'rgba(48,27,13,' + (0.06 + r() * 0.12) + ')';
      g.lineWidth = 0.5 + r();
      g.beginPath(); g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y + (r() - 0.5) * 20, s * 0.7, y + (r() - 0.5) * 20, s, y);
      g.stroke();
    }
  });
}

function corkBumpMap() {
  return canvasTexture(256, (g, s) => {
    const r = seeded(4139);
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 12000; i++) {
      const v = Math.floor(70 + r() * 150);
      g.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')';
      g.beginPath(); g.arc(r() * s, r() * s, 0.5 + r() * 1.6, 0, TAU); g.fill();
    }
  });
}

function waxMap() {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#8f1720'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 1600; i++) {
      const a = i * 2.39996, rad = Math.sqrt(i / 1600) * s * 0.5;
      g.fillStyle = i % 2 ? 'rgba(255,150,120,0.06)' : 'rgba(45,0,0,0.08)';
      g.fillRect(s / 2 + Math.cos(a) * rad, s / 2 + Math.sin(a) * rad, 3, 3);
    }
  });
}

function tagMap() {
  return canvasTexture(512, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = '#d8c39a';
    g.beginPath();
    g.moveTo(s * 0.08, s * 0.06); g.lineTo(s * 0.92, s * 0.10);
    g.lineTo(s * 0.96, s * 0.86); g.lineTo(s * 0.08, s * 0.94);
    g.closePath(); g.fill();
    g.strokeStyle = '#6f5437'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#3a2b1c'; g.textAlign = 'center';
    g.font = 'bold 48px serif'; g.fillText('ISLA', s * 0.5, s * 0.36);
    g.font = '30px serif'; g.fillText('1867', s * 0.5, s * 0.53);
    g.strokeStyle = 'rgba(71,48,28,0.55)'; g.lineWidth = 3;
    g.beginPath(); g.arc(s * 0.5, s * 0.71, 50, 0, TAU);
    g.moveTo(s * 0.5 - 64, s * 0.71); g.lineTo(s * 0.5 + 64, s * 0.71); g.stroke();
  });
}

function woodMaterial(tex, color, rough, env, repeatX, repeatY) {
  const t = tex ? tile(tex, repeatX, repeatY) : null;
  return new THREE.MeshStandardMaterial({
    map: t, bumpMap: t, bumpScale: 0.028,
    color: color, roughness: rough, metalness: 0.02,
    envMap: env || null, envMapIntensity: 0.3,
  });
}

function box(parent, mat, x, y, z, sx, sy, sz, rx, ry, rz) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz, 2, 2, 2), mat);
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function buildBottleGlass(THREE_in, material) {
  const x0 = BOTTLE_X0 + 0.04, x1 = BOTTLE_X1 - 0.04;
  const profile = [new THREE_in.Vector2(0, x0)];
  const steps = 112;
  for (let i = 0; i <= steps; i++) {
    const x = x0 + (x1 - x0) * i / steps;
    profile.push(new THREE_in.Vector2(radiusAt(x), x));
  }
  profile.push(new THREE_in.Vector2(0, x1));
  const shell = new THREE_in.Mesh(new THREE_in.LatheGeometry(profile, 96), material);
  shell.rotation.z = -Math.PI / 2;
  shell.renderOrder = GLASS_ORDER;
  shell.castShadow = false; shell.receiveShadow = false;
  const group = new THREE_in.Group();
  group.name = 'glass-shell';
  group.add(shell);
  return group;
}

function buildStopper(parent, assets) {
  const cork = new THREE.Mesh(
    new THREE.CylinderGeometry(0.80, 0.85, 0.70, 40, 1, false),
    new THREE.MeshStandardMaterial({ map: corkColorMap(), bumpMap: corkBumpMap(),
      bumpScale: 0.022, roughness: 0.92, metalness: 0, color: 0xc79a63 })
  );
  cork.rotation.z = Math.PI / 2;
  cork.position.set(BOTTLE_X1 - 0.65, 0, 0);
  cork.castShadow = true; parent.add(cork);

  const waxMat = new THREE.MeshPhysicalMaterial({
    map: waxMap(), color: 0x9c1420, roughness: 0.38, metalness: 0,
    clearcoat: 0.5, clearcoatRoughness: 0.28, side: THREE.DoubleSide,
  });
  const wax = new THREE.Mesh(new THREE.SphereGeometry(0.82, 40, 20, 0, TAU, 0, Math.PI * 0.5), waxMat);
  wax.rotation.z = -Math.PI / 2;
  wax.position.set(BOTTLE_X1 - 0.27, 0, 0);
  wax.scale.set(0.42, 1, 1);
  wax.castShadow = true; wax.renderOrder = GLASS_ORDER - 4;
  parent.add(wax);

  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x8c6b43, roughness: 0.88 });
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.045, 10, 40), ropeMat);
  rope.rotation.y = Math.PI / 2;
  rope.position.set(BOTTLE_X1 - 0.88, 0, 0);
  rope.castShadow = true; parent.add(rope);

  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8),
    new THREE.MeshStandardMaterial({ map: tagMap(), transparent: true, alphaTest: 0.35,
      roughness: 0.85, metalness: 0, side: THREE.DoubleSide }));
  tag.position.set(BOTTLE_X1 - 0.90, -0.92, 0.12);
  tag.rotation.set(-0.1, -0.32, 0.16);
  tag.castShadow = true; parent.add(tag);

  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.0, 8),
    new THREE.MeshStandardMaterial({ color: 0x5f462a, roughness: 0.9 }));
  cord.position.set(BOTTLE_X1 - 1.0, -0.45, 0.08);
  cord.rotation.z = -0.2; parent.add(cord);
  void assets;
  return { cork, wax, rope, tag };
}

function buildStudy(parent, assets) {
  const env = (assets && assets.env) || null;
  const wood = assets && assets.tex && assets.tex.woodTable;
  const tableMat = woodMaterial(wood, 0x7b5532, 0.46, env, 2.2, 1.4);
  const frameMat = woodMaterial(wood, 0x3c2a1c, 0.72, env, 1.4, 0.5);
  const braceMat = woodMaterial(wood, 0x513621, 0.62, env, 1.0, 1.0);

  const table = box(parent, tableMat, TABLE_X, TOP_Y, TABLE_Z, 4.6, 0.18, 2.3);
  for (const dx of [-2.05, 2.05]) {
    for (const dz of [-0.95, 0.95]) {
      box(parent, braceMat, TABLE_X + dx, -0.10, TABLE_Z + dz, 0.18, 0.94, 0.18);
    }
  }
  for (const dz of [-0.95, 0.95]) {
    box(parent, frameMat, TABLE_X, TOP_Y - 0.19, TABLE_Z + dz, 4.3, 0.16, 0.10);
  }
  box(parent, frameMat, TABLE_X, TOP_Y - 0.19, TABLE_Z, 0.12, 0.14, 1.9);
  for (const dx of [-2.05, 2.05]) {
    box(parent, braceMat, TABLE_X + dx, TOP_Y - 0.48, TABLE_Z, 0.12, 0.12, 1.8, 0.55, 0, 0);
  }

  const wx = TABLE_X, wz = TABLE_Z - 1.45, wy = 1.42;
  box(parent, frameMat, wx - 2.18, wy, wz, 0.14, 1.92, 0.14);
  box(parent, frameMat, wx + 2.18, wy, wz, 0.14, 1.92, 0.14);
  box(parent, frameMat, wx, wy + 0.97, wz, 4.5, 0.16, 0.16);
  box(parent, frameMat, wx, wy - 0.97, wz, 4.5, 0.14, 0.18);
  box(parent, frameMat, wx, wy, wz, 0.12, 1.9, 0.12);
  box(parent, frameMat, wx, wy + 0.12, wz, 4.4, 0.10, 0.12);

  const covers = [0x3d2735, 0x27383f, 0x4a3423, 0x283c2b];
  let stackY = TOP_Y + 0.13;
  for (let i = 0; i < 4; i++) {
    const h = 0.11 + (i % 2) * 0.03;
    const cover = new THREE.MeshStandardMaterial({
      color: covers[i], roughness: 0.62, metalness: 0.02,
      map: wood ? tile(wood, 0.4, 0.4) : null,
      envMap: env, envMapIntensity: 0.14,
    });
    box(parent, cover, TABLE_X + 1.35, stackY, TABLE_Z + 0.22, 0.95, h, 0.66, 0, (i - 1.5) * 0.07, 0);
    box(parent, new THREE.MeshStandardMaterial({ color: 0xd8c8a5, roughness: 0.86 }),
      TABLE_X + 1.35, stackY, TABLE_Z + 0.22, 0.88, h - 0.035, 0.60, 0, (i - 1.5) * 0.07, 0);
    stackY += h + 0.012;
  }

  const brass = new THREE.MeshStandardMaterial({
    color: 0xb78b3c, metalness: 0.9, roughness: 0.25,
    envMap: env, envMapIntensity: 1.35,
  });
  const darkBrass = new THREE.MeshStandardMaterial({
    color: 0x604a24, metalness: 0.85, roughness: 0.35,
    envMap: env, envMapIntensity: 0.85,
  });
  const scope = new THREE.Group();
  scope.position.set(TABLE_X - 1.15, TOP_Y + 0.09, TABLE_Z + 0.18);
  scope.rotation.y = -0.26;
  parent.add(scope);
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 12), darkBrass);
  hub.position.y = 0.38; scope.add(hub);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3 + 0.4;
    const foot = new THREE.Vector3(Math.cos(a) * 0.42, -0.34, Math.sin(a) * 0.34);
    const from = hub.position;
    const dir = foot.clone().sub(from);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, dir.length(), 12), darkBrass);
    leg.position.copy(from).add(foot).multiplyScalar(0.5);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    leg.castShadow = true; scope.add(leg);
  }
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 1.46, 40, 1, true), brass);
  tube.rotation.z = Math.PI / 2; tube.rotation.x = 0.1;
  tube.position.set(0, 0.52, 0); tube.castShadow = true; scope.add(tube);
  for (const x of [-0.62, 0.62]) {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.035, 10, 32), darkBrass);
    collar.rotation.y = Math.PI / 2; collar.position.set(x, 0.52, 0); scope.add(collar);
  }
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.05, 32),
    new THREE.MeshPhysicalMaterial({ color: 0x2a3a48, metalness: 0.2, roughness: 0.08,
      clearcoat: 1, envMap: env, envMapIntensity: 1.2 }));
  lens.rotation.z = Math.PI / 2; lens.position.set(0.75, 0.52, 0); scope.add(lens);
  const eyepiece = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.22, 24), darkBrass);
  eyepiece.rotation.z = Math.PI / 2; eyepiece.position.set(-0.8, 0.52, 0); scope.add(eyepiece);

  return { table, scope };
}

function buildLights(parent, assets) {
  const warm = new THREE.PointLight(0xffb469, 9, 9, 2);
  warm.position.set(TABLE_X + 0.8, 2.05, TABLE_Z + 0.75);
  warm.castShadow = true;
  warm.shadow.mapSize.set(1024, 1024);
  warm.shadow.bias = -0.0005;
  warm.shadow.radius = 3;
  parent.add(warm);
  const window = new THREE.PointLight(0xffc98a, 5, 7, 2);
  window.position.set(TABLE_X, 1.5, TABLE_Z - 1.3);
  parent.add(window);
  const fill = new THREE.DirectionalLight(0x93b8d6, 0.5);
  fill.position.set(-5, 6, 2.5); parent.add(fill);
  const ambient = new THREE.AmbientLight(0x6d5238, 0.42);
  parent.add(ambient);
  void assets;
  return { warm, window, fill, ambient };
}

export function createBottleEnv(ctx) {
  const THREE_in = ctx.THREE || THREE;
  const assets = ctx.assets || {};
  const state = ctx.state || {};
  const bottleRoot = new THREE_in.Group();
  bottleRoot.name = 'bottle-env';
  const innerWorld = new THREE_in.Group();
  innerWorld.name = 'inner-world';
  bottleRoot.add(innerWorld);

  const glassMaterial = new THREE_in.MeshPhysicalMaterial({
    color: 0xeaf6f4, metalness: 0, roughness: 0.035,
    transmission: 0.97, thickness: 0.12, ior: 1.45,
    transparent: true, opacity: 0.42, side: THREE_in.DoubleSide, depthWrite: false,
    envMap: assets.env || null, envMapIntensity: 0.75,
    clearcoat: 1, clearcoatRoughness: 0.02,
    specularIntensity: 0.85, specularColor: 0xffffff,
    attenuationColor: new THREE_in.Color(0xffffff), attenuationDistance: 60,
  });
  // MeshPhysicalMaterial 的 transmission + clearcoat + 高 envMapIntensity 自带菲涅尔边缘光，
  // 无需 onBeforeCompile 注入，避免 GLSL 版本差异导致的着色器编译问题。
  glassMaterial.customProgramCacheKey = () => 'bottle-glass-v2';

  const glass = buildBottleGlass(THREE_in, glassMaterial);
  bottleRoot.add(glass);

  // 独立材质：克隆 transmission 材质会丢失 attenuation 状态导致编译异常；用物理玻璃近似即可。
  const thickGlass = new THREE_in.MeshPhysicalMaterial({
    color: 0xe8f4f0, metalness: 0, roughness: 0.05,
    transmission: 0.82, thickness: 0.2, ior: 1.48,
    transparent: true, opacity: 0.6, side: THREE_in.DoubleSide, depthWrite: false,
    envMap: assets.env || null, envMapIntensity: 0.9,
    clearcoat: 0.8, clearcoatRoughness: 0.06,
  });
  const baseRing = new THREE_in.Mesh(
    new THREE_in.TorusGeometry(radiusAt(BOTTLE_X0 + 0.2) - 0.12, 0.14, 16, 64), thickGlass);
  baseRing.rotation.y = Math.PI / 2;
  baseRing.position.x = BOTTLE_X0 + 0.2;
  baseRing.renderOrder = GLASS_ORDER - 2;
  bottleRoot.add(baseRing);
  const lipRing = new THREE_in.Mesh(
    new THREE_in.TorusGeometry(radiusAt(BOTTLE_X1 - 0.14) - 0.03, 0.09, 16, 64), thickGlass);
  lipRing.rotation.y = Math.PI / 2;
  lipRing.position.x = BOTTLE_X1 - 0.14;
  lipRing.renderOrder = GLASS_ORDER - 2;
  bottleRoot.add(lipRing);

  buildStopper(bottleRoot, assets);
  // 书房陈设改由主程序在瓶外创建（见 main.js buildRoom），瓶内保持纯净海景。
  const study = null;
  const lights = buildLights(bottleRoot, assets);

  let nightBlend = 0;
  function setNight(n) {
    nightBlend = THREE_in.MathUtils.clamp(Number(n) || 0, 0, 1);
    lights.warm.intensity = THREE_in.MathUtils.lerp(6, 13, nightBlend);
    lights.window.intensity = THREE_in.MathUtils.lerp(3, 8, nightBlend);
    lights.fill.intensity = THREE_in.MathUtils.lerp(0.5, 0.18, nightBlend);
    lights.ambient.intensity = THREE_in.MathUtils.lerp(0.42, 0.2, nightBlend);
    glassMaterial.envMapIntensity = THREE_in.MathUtils.lerp(1.35, 1.9, nightBlend);
    thickGlass.envMapIntensity = glassMaterial.envMapIntensity;
  }
  function update(dt, nextState) {
    void dt; void study;
    const day = nextState && nextState.day != null ? nextState.day
      : (state.day != null ? state.day : 0.71);
    setNight(1 - THREE_in.MathUtils.clamp(day, 0, 1));
  }
  setNight(1 - THREE_in.MathUtils.clamp(state.day != null ? state.day : 0.71, 0, 1));

  return { bottleRoot, innerWorld, glass, update, setNight };
}
