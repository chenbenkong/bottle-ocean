import * as THREE from 'three';

// ============ 世界常量（所有模块共享的坐标契约） ============
export const SEA = -0.62;
export const TAU = Math.PI * 2;
export const BODY_R = 3.18;          // 瓶身半径
export const BODY_END = 4.45;        // 瓶身到瓶颈过渡起点
export const NECK_R = 1.02;          // 瓶颈半径
export const NECK_END = 5.95;        // 瓶颈过渡终点
export const BOTTLE_X0 = -5.82;      // 瓶底
export const BOTTLE_X1 = 7.95;       // 瓶口
export const ISLAND = {x:-2.15, z:-0.35};

// Gerstner 波：JS 浮力与 GLSL 顶点位移共用同一组参数
export const WAVES = [
  {dx:0.94, dz:0.34, k:1.10, a:0.085, w:1.30, q:0.55},
  {dx:-0.37,dz:0.93, k:1.85, a:0.050, w:1.85, q:0.50},
  {dx:0.71, dz:-0.71,k:3.05, a:0.028, w:2.25, q:0.40},
  {dx:0.20, dz:0.98, k:5.10, a:0.016, w:2.90, q:0.30},
];
export function waveHeight(x,z,t,storm=0){
  const amp=1+storm*2.2;let h=0;
  for(const v of WAVES) h+=v.a*amp*Math.sin(v.k*(v.dx*x+v.dz*z)-t*v.w);
  return h;
}
export function radiusAt(x){
  if(x<BOTTLE_X0||x>BOTTLE_X1)return 0;
  if(x<BODY_END)return BODY_R;
  if(x<NECK_END)return BODY_R+(NECK_R-BODY_R)*(x-BODY_END)/(NECK_END-BODY_END);
  return NECK_R;
}
export function insideBottle(p,margin=0.08){
  const r=radiusAt(p.x)-margin;if(r<=0)return false;
  return p.y*p.y+p.z*p.z<=r*r;
}

// ============ 全局状态 ============
export const state = {
  speed:1, storm:0, stormTarget:0, stormLevel:0,
  day:0.71, time:0, real:0, lightning:0,
  quality:1, fps:60,
};

// ============ 共享素材清单（已实测可用） ============
const gh='https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/';
const ph='https://dl.polyhaven.org/file/ph-assets/';
export const ASSETS = {
  hdri:{
    sunset: ph+'HDRIs/hdr/1k/venice_sunset_1k.hdr',
    studio: ph+'HDRIs/hdr/1k/kloppenheim_02_1k.hdr',
  },
  tex:{
    wood:      gh+'hardwood2_diffuse.jpg',
    woodTable: ph+'Textures/jpg/1k/wood_table/wood_table_diff_1k.jpg',
    sand:      ph+'Textures/jpg/1k/sand_01/sand_01_diff_1k.jpg',
    grass:     gh+'terrain/grasslight-big.jpg',
    waterNormal: gh+'waternormals.jpg',
  },
};

// ============ 写实材质工厂：统一所有模块的 PBR 基调 ============
export function pbr(params={}){
  return new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.72,metalness:0.04,...params});
}
export function physical(params={}){
  return new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:0.5,metalness:0.0,...params});
}

// ============ 工具 ============
export const clamp=THREE.MathUtils.clamp;
export const lerp=THREE.MathUtils.lerp;
export function seeded(seed){let s=seed>>>0;return()=>((s=(s*1664525+1013904223)>>>0)/4294967296);}
export const rnd=seeded(160);