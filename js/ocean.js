import * as THREE from 'three';
import {SEA, BOTTLE_X0, BOTTLE_X1} from './config.js';
import {WAVE_GLSL, RIM_GLSL} from './utils.js';

const WAVE_GLSL_LOCAL = `${WAVE_GLSL}
`;

// PMREM CubeUV sampling (matches three.js cube_uv_reflection_fragment).
// CUBEUV_TEXEL_WIDTH/HEIGHT and CUBEUV_MAX_MIP are injected by the renderer for
// ShaderMaterial when the PMREM envMap uniform is present.
const CUBEUV_HELPER = `
#ifndef CUBEUV_TEXEL_WIDTH
#define CUBEUV_TEXEL_WIDTH 0.0013020833333333333
#endif
#ifndef CUBEUV_TEXEL_HEIGHT
#define CUBEUV_TEXEL_HEIGHT 0.0009765625
#endif
#ifndef CUBEUV_MAX_MIP
#define CUBEUV_MAX_MIP 8.0
#endif
#define cubeUV_minMipLevel 4.0
#define cubeUV_minTileSize 16.0
float cubeUVFace(vec3 d){
  vec3 a=abs(d);
  if(a.x>a.z){if(a.x>a.y)return d.x>0.0?0.0:3.0;return d.y>0.0?1.0:4.0;}
  if(a.z>a.y)return d.z>0.0?2.0:5.0;
  return d.y>0.0?1.0:4.0;
}
vec2 cubeUVFaceUV(vec3 d,float face){
  vec2 uv;
  if(face==0.0)uv=vec2(d.z,d.y)/abs(d.x);
  else if(face==1.0)uv=vec2(-d.x,-d.z)/abs(d.y);
  else if(face==2.0)uv=vec2(-d.x,d.y)/abs(d.z);
  else if(face==3.0)uv=vec2(-d.z,d.y)/abs(d.x);
  else if(face==4.0)uv=vec2(-d.x,d.z)/abs(d.y);
  else uv=vec2(d.x,d.y)/abs(d.z);
  return 0.5*(uv+1.0);
}
vec3 cubeUVBilinear(sampler2D envMap,vec3 d,float mipInt){
  float face=cubeUVFace(d);
  float filterInt=max(cubeUV_minMipLevel-mipInt,0.0);
  mipInt=max(mipInt,cubeUV_minMipLevel);
  float faceSize=exp2(mipInt);
  highp vec2 uv=cubeUVFaceUV(d,face)*(faceSize-2.0)+1.0;
  if(face>2.0){uv.y+=faceSize;face-=3.0;}
  uv.x+=face*faceSize;
  uv.x+=filterInt*3.0*cubeUV_minTileSize;
  uv.y+=4.0*(exp2(CUBEUV_MAX_MIP)-faceSize);
  uv.x*=CUBEUV_TEXEL_WIDTH;
  uv.y*=CUBEUV_TEXEL_HEIGHT;
  return texture2D(envMap,uv).rgb;
}
vec4 envMapCubeUV(vec3 d){
  float mip=cubeUV_minMipLevel+2.0; // mirror-like roughness ~0.06
  return vec4(cubeUVBilinear(uEnvMap,d,floor(mip)),1.0);
}
`;

// ==== water surface shader ====
const SURFACE_VERT = `
precision highp float;

uniform float uTime;
uniform float uStorm;
uniform sampler2D uWaterNormal;

varying vec3 vWorldPos;
varying vec3 vLocalPos;
varying vec3 vWaveNormal;
varying vec2 vUv;
varying float vCrest;
varying float vFoamNoise;

${WAVE_GLSL_LOCAL}

${RIM_GLSL}

void main() {
  vec3 pos = position;
  vec3 wave = gDisp(pos.xz, uTime, uStorm);
  pos += wave;

  // All vertices stay inside the bottle cross-section: y²+z² ≤ (radius-margin)²
  float br = bottleRadius(pos.x);
  float rad = max(0.01, br - 0.10);
  float radZ = min(br - 0.16, sqrt(max(0.0, rad*rad - pos.y*pos.y)));
  pos.z = clamp(pos.z, -radZ, radZ);
  pos.y = clamp(pos.y, -rad, rad);

  vCrest = clamp((wave.y / (0.085 * (1.0 + uStorm * 2.2)) + 1.0) * 0.5, 0.0, 1.0);
  vWaveNormal = gNorm(pos.xz, uTime, uStorm);

  vec2 nUv1 = pos.xz * 0.32 + vec2(uTime * 0.013, uTime * 0.009);
  vec2 nUv2 = pos.xz * 0.47 - vec2(uTime * 0.018, uTime * 0.011);
  vec3 n1 = texture2D(uWaterNormal, nUv1).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(uWaterNormal, nUv2).xyz * 2.0 - 1.0;
  vFoamNoise = clamp((n1.r + n2.b) * 0.5 + 0.5, 0.0, 1.0);

  vUv = uv;
  vLocalPos = pos;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SURFACE_FRAG = `
// env reflection uses analytic sky; PMREM helper omitted

precision highp float;

uniform float uTime;
uniform float uStorm;
uniform float uNight;
uniform vec3 uSunDir;
uniform sampler2D uWaterNormal;
uniform sampler2D uEnvMap;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uFoamColor;
uniform float uOpacity;

varying vec3 vWorldPos;
varying vec3 vLocalPos;
varying vec3 vWaveNormal;
varying vec2 vUv;
varying float vCrest;
varying float vFoamNoise;

float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise2(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),
             mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);
}

void main() {
  vec2 uvA = vLocalPos.xz * 0.34 + vec2(uTime * 0.012, uTime * 0.008);
  vec2 uvB = vLocalPos.xz * 0.51 - vec2(uTime * 0.017, uTime * 0.010);
  vec3 nA = texture2D(uWaterNormal, uvA).xyz * 2.0 - 1.0;
  vec3 nB = texture2D(uWaterNormal, uvB).xyz * 2.0 - 1.0;
  vec3 detail = normalize(vec3(nA.x + nB.x, 2.0, nA.y + nB.y));
  vec3 N = normalize(vWaveNormal + vec3(detail.x, 0.0, detail.z) * (0.34 + 0.26*uStorm));
  N = normalize(N);

  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);

  vec3 R = reflect(-V, N);
  float skyT = clamp(R.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 skyDay = mix(vec3(0.30,0.52,0.78), vec3(0.82,0.91,1.0), skyT);
  vec3 skyNight = mix(vec3(0.03,0.05,0.10), vec3(0.08,0.12,0.25), skyT);
  vec3 sky = mix(skyDay, skyNight, uNight);
  vec3 reflection = sky;

  float depthT = clamp(vCrest * 0.7 + ndv * 0.3, 0.0, 1.0);
  vec3 refractCol = mix(uDeepColor, uShallowColor, depthT);
  refractCol *= mix(1.0, 0.42, uNight);

  vec3 L = normalize(uSunDir);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 220.0) * mix(1.0, 0.35, uNight);
  vec3 sunCol = mix(vec3(1.0,0.93,0.78), vec3(0.52,0.68,1.0), uNight);
  vec3 color = mix(refractCol, reflection, clamp(F + 0.05, 0.0, 1.0)) + sunCol * spec * (1.2 + 2.0*uStorm);

  float fn = noise2(vLocalPos.xz * (3.0 + 2.0*uStorm) + vec2(uTime*0.08, -uTime*0.06));
  float foamMask = smoothstep(0.74 - 0.34*uStorm, 0.92 - 0.20*uStorm, vCrest*0.65 + fn*0.35 + vFoamNoise*0.12);
  float streak = noise2(vLocalPos.xz * vec2(18.0, 5.0) + vec2(uTime*0.25, 0.0));
  foamMask *= smoothstep(0.25, 0.65, streak + 0.25*uStorm);
  vec3 foam = uFoamColor * mix(1.0, 0.55, uNight) * (0.75 + 0.5*fn);
  color = mix(color, foam, clamp(foamMask * (0.35 + 0.65*uStorm), 0.0, 1.0));

  color = mix(color, vec3(0.88,0.92,0.95) * mix(1.0,0.5,uNight), uStorm * 0.18 * (0.5 + 0.5*fn));

  gl_FragColor = vec4(color, uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// ==== deep water body shader (inside bottle, below waterline; no seabed) ====
const BODY_VERT = `
precision highp float;
varying vec3 vLocalPos;
varying vec3 vWorldPos;
void main(){
  vLocalPos = position;
  vec4 wp = modelMatrix * vec4(position,1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const BODY_FRAG = `
precision highp float;
uniform float uTime;
uniform float uStorm;
uniform float uNight;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;

varying vec3 vLocalPos;
varying vec3 vWorldPos;

float hash21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise2(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),
             mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);
}
float caustic(vec2 p,float t){
  vec2 q=p*2.4;
  float a=noise2(q+vec2(t*0.13,t*0.09));
  float b=noise2(q*1.7-vec2(t*0.17,-t*0.11));
  float c=1.0-abs(a-b);
  return pow(clamp(c,0.0,1.0), 5.0);
}

void main(){
  float depth = clamp((-0.6200 - vLocalPos.y) / 0.30, 0.0, 1.0);
  vec3 col = mix(uShallowColor, uDeepColor, depth);
  float caus = caustic(vLocalPos.xz + vLocalPos.y*0.12, uTime) * (1.0-depth*0.65);
  caus *= 1.0 + uStorm*0.8;
  vec3 causCol = mix(vec3(0.62,0.86,1.0), vec3(0.35,0.55,0.9), uNight);
  col += causCol * caus * mix(0.35, 0.12, uNight);
  col *= mix(1.0, 0.45, uNight);
  float alpha = mix(0.26, 0.48, depth) + caus*0.08;
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createOcean(ctx){
  const {THREE:T, assets, state:appState} = ctx;
  const group = new T.Group();
  group.name='ocean';

  const oceanUniforms = {
    uTime: {value: 0},
    uStorm: {value: appState?.storm ?? 0},
    uNight: {value: 1 - (appState?.day ?? 0.71)},
    uSunDir: {value: new T.Vector3(0.4, 0.75, 0.3).normalize()},
    uWaterNormal: {value: assets?.tex?.waterNormal ?? null},
    uEnvMap: {value: assets?.env ?? assets?.hdri?.sunset ?? assets?.hdri?.studio ?? null},
    uDeepColor: {value: new T.Color(0x05121f)},
    uShallowColor: {value: new T.Color(0x2e7f92)},
    uFoamColor: {value: new T.Color(0xe8f4f6)},
    uOpacity: {value: 0.82},
  };

  if(!oceanUniforms.uWaterNormal.value){
    const d=new T.DataTexture(new Uint8Array([128,128,255,255]),1,1);
    d.needsUpdate=true;oceanUniforms.uWaterNormal.value=d;
  }
  if(!oceanUniforms.uEnvMap.value){
    const d=new T.DataTexture(new Uint8Array([40,70,110,255]),1,1);
    d.needsUpdate=true;oceanUniforms.uEnvMap.value=d;
  }

  function radiusLocal(x){
    if(x<4.45)return 3.18;
    if(x<5.95)return 3.18+(1.02-3.18)*(x-4.45)/1.5;
    return 1.02;
  }

  const NX=200, NZ=70;
  const geo=new T.PlaneGeometry((BOTTLE_X1-BOTTLE_X0), 1, NX, NZ);
  geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position;
  const uv=geo.attributes.uv;
  const x0=BOTTLE_X0+0.16, x1=BOTTLE_X1-0.16;
  for(let i=0;i<pos.count;i++){
    const u=uv.getX(i);
    const x=x0+(x1-x0)*u;
    const v=uv.getY(i);
    const br=radiusLocal(x);
    const half=Math.max(0.12, Math.min(br-0.16, Math.sqrt(Math.max(0.01,(br-0.08)*(br-0.08)-SEA*SEA))));
    const z=(v*2-1)*half;
    pos.setXYZ(i, x, SEA, z);
  }
  pos.needsUpdate=true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const surfMat=new T.ShaderMaterial({
    uniforms:oceanUniforms,
    vertexShader:SURFACE_VERT,
    fragmentShader:SURFACE_FRAG,
    transparent:true,
    depthWrite:false,
    side:T.DoubleSide,
  });
  const water=new T.Mesh(geo,surfMat);
  water.name='oceanSurface';
  water.renderOrder=3;
  group.add(water);

  const bodySeg=96;
  const bodyGeo=new T.BufferGeometry();
  const verts=[],uvs=[],idx=[];
  for(let i=0;i<=bodySeg;i++){
    const u=i/bodySeg, x=x0+(x1-x0)*u;
    const br=radiusLocal(x);
    const rad=br-0.10;
    const yMax=Math.sqrt(Math.max(0.0, rad*rad - SEA*SEA));
    for(let j=0;j<=24;j++){
      const q=j/24;
      const a=q*Math.PI*2;
      const z=Math.sin(a)*rad*0.78;
      const yc=-Math.sqrt(Math.max(0.01, rad*rad - rad*rad*0.78*0.78));
      const y=SEA - 0.012 - (SEA - 0.012 + yc)*q;
      verts.push(x, y, z);
      uvs.push(u,q);
    }
  }
  for(let i=0;i<bodySeg;i++){
    for(let j=0;j<24;j++){
      const a=i*25+j, b=a+25;
      idx.push(a,b,a+1,b,b+1,a+1);
    }
  }
  bodyGeo.setAttribute('position',new T.Float32BufferAttribute(verts,3));
  bodyGeo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
  bodyGeo.setIndex(idx);
  bodyGeo.computeVertexNormals();
  const bodyMat=new T.ShaderMaterial({
    uniforms:oceanUniforms,
    vertexShader:BODY_VERT,
    fragmentShader:BODY_FRAG,
    transparent:true,
    depthWrite:false,
    side:T.DoubleSide,
  });
  const body=new T.Mesh(bodyGeo,bodyMat);
  body.name='deepWaterBody';
  body.renderOrder=2;
  group.add(body);

  const sun=new T.Vector3(0.4,0.75,0.3).normalize();
  function update(t,storm,night){
    oceanUniforms.uTime.value=t;
    oceanUniforms.uStorm.value=storm;
    oceanUniforms.uNight.value=night;
    oceanUniforms.uSunDir.value.copy(sun);
  }
  function setSunDir(v){
    sun.set(v.x,v.y,v.z).normalize();
    oceanUniforms.uSunDir.value.copy(sun);
  }

  return {group, water, uniforms:oceanUniforms, update, setSunDir};
}