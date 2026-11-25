import * as THREE from 'three';
import {WAVES,rnd} from './config.js';

// 由同源波形参数生成 GLSL（避免手写漂移）
let _d='',_n='';
for(const v of WAVES){
  const D='vec2('+v.dx.toFixed(5)+','+v.dz.toFixed(5)+')';
  const k=v.k.toFixed(5),a=v.a.toFixed(5),w=v.w.toFixed(5),q=v.q.toFixed(5);
  _d+='{vec2 D='+D+';float k='+k+',A='+a+'*amp,ph=k*dot(D,p)-t*'+w+',c=cos(ph),s=sin(ph);off+=vec3('+q+'*A*D.x*c,A*s,'+q+'*A*D.y*c);}\n';
  _n+='{vec2 D='+D+';float k='+k+',A='+a+'*amp,ph=k*dot(D,p)-t*'+w+',c=cos(ph);acc+=vec3(-D.x*k*A*c,0.,-D.y*k*A*c);}\n';
}
export const WAVE_GLSL=
  'vec3 gDisp(vec2 p,float t,float storm){float amp=1.0+storm*2.2;vec3 off=vec3(0.0);'+_d+'return off;}\n'+
  'vec3 gNorm(vec2 p,float t,float storm){float amp=1.0+storm*2.2;vec3 acc=vec3(0.0,1.0,0.0);'+_n+'return normalize(acc);}\n';

export const RIM_GLSL='float bottleRadius(float x){if(x<4.45)return 3.18;if(x<5.95)return mix(3.18,1.02,(x-4.45)/1.5);return 1.02;}';

export function makeMesh(geo,mat,parent,pos=[0,0,0],rot=[0,0,0]){
  const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.rotation.set(...rot);
  m.castShadow=true;m.receiveShadow=true;if(parent)parent.add(m);return m;
}
export function box(parent,mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){
  return makeMesh(new THREE.BoxGeometry(sx,sy,sz),mat,parent,[x,y,z],[rx,ry,rz]);
}
export function tubeBetween(a,b,r,mat,parent,seg=10){
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);
  const m=makeMesh(new THREE.CylinderGeometry(r,r,d.length(),seg),mat,parent);
  m.position.copy(av.add(bv).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;
}
// 复制纹理并设置重复/色彩空间
export function tile(tex,rx=1,ry=1,srgb=true){
  const t=tex.clone();t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.needsUpdate=true;
  if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;
}