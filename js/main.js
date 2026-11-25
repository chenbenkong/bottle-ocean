import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {SEA,TAU,state,clamp,lerp,insideBottle,rnd} from './config.js';
import {loadAssets} from './assets.js';
import {createBottleEnv} from './bottle-env.js';
import {createOcean} from './ocean.js';
import {createIslandShip} from './island-ship.js';
import {createLifeSky} from './life-sky.js';

const $=id=>document.getElementById(id);
const errorEl=$('loadError');
function fail(msg){errorEl.style.display='block';errorEl.textContent=msg;console.error('[瓶中海]',msg);}
window.addEventListener('error',e=>{if(!window.__READY__)fail('加载失败：'+(e.message||'未知错误'));});

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x101820);
scene.fog=new THREE.FogExp2(0x101820,0.012);
const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,0.05,120);
camera.position.set(13,7.6,23);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,-0.35,0);controls.enableDamping=true;controls.dampingFactor=0.055;
controls.minDistance=14;controls.maxDistance=40;controls.minPolarAngle=.28;controls.maxPolarAngle=Math.PI*.52;
controls.autoRotate=true;controls.autoRotateSpeed=.32;let idle;
controls.addEventListener('start',()=>{controls.autoRotate=false;clearTimeout(idle);});
controls.addEventListener('end',()=>{idle=setTimeout(()=>controls.autoRotate=true,4200);});

// 基础灯光：HDRI 加载后由环境贴图接管反射，这里补主光与暖辅光
const hemi=new THREE.HemisphereLight(0xcfe0e6,0x1d262a,1.1);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffd2a1,2.6);sun.position.set(-8,12,9);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-14;sun.shadow.camera.right=14;
sun.shadow.camera.top=11;sun.shadow.camera.bottom=-9;sun.shadow.bias=-0.0005;scene.add(sun);
const warm=new THREE.PointLight(0xff9a4d,28,22,2);warm.position.set(-8,3,-2);scene.add(warm);


// 瓶外写实书房：桌面、托架、旧书、黄铜望远镜（与瓶体同一世界坐标）
function buildRoom(A){
  const g=new THREE.Group();g.name='room';scene.add(g);
  const woodTex=A.tex.woodTable,wood=A.tex.wood;
  const tbl=woodTex?new THREE.MeshStandardMaterial({map:woodTex,color:0x8a5a34,roughness:0.46,metalness:0.02,envMap:A.env,envMapIntensity:0.9}):new THREE.MeshStandardMaterial({color:0x6b4228,roughness:0.6});
  const dark=wood?new THREE.MeshStandardMaterial({map:wood,color:0x4a3120,roughness:0.62,envMap:A.env,envMapIntensity:0.5}):new THREE.MeshStandardMaterial({color:0x3b2718,roughness:0.7});
  const brass=new THREE.MeshStandardMaterial({color:0xb98a3e,roughness:0.22,metalness:0.92,envMap:A.env,envMapIntensity:1.5});
  const B=(x,y,z,sx,sy,sz,m,rx=0,ry=0,rz=0)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=o.receiveShadow=true;g.add(o);return o;};
  // 桌面位于瓶身下方 y=-3.5，瓶子半径约3.18，下缘约-3.18，故桌面略低
  B(0,-3.55,0,26,0.32,13,tbl);
  for(const x of[-11.5,11.5])for(const z of[-5.5,5.5])B(x,-5.6,z,0.7,4.1,0.7,dark);
  // 木托架：两个鞍座托住瓶身
  for(const x of[-3.6,3.4]){B(x,-3.15,0,1.0,0.5,6.4,dark);for(const z of[-2.4,2.4])B(x,-2.82,z,0.85,0.85,1.3,tbl);}
  // 旧书（桌面左前）
  const covers=[0x3a4a3d,0x6d3229,0x2f3340];
  covers.forEach((c,i)=>{const y=-3.31+i*0.16;B(-7.6+i*0.06,y,2.2,3.0,0.15,2.1,new THREE.MeshStandardMaterial({color:c,roughness:0.85}),0,(i-1)*0.05,0);B(-7.55+i*0.06,y+0.005,2.2,2.86,0.11,1.98,new THREE.MeshStandardMaterial({color:0xc8b895,roughness:0.95}),0,(i-1)*0.05,0);});
  // 黄铜望远镜（桌面右前）：镜筒 + 三脚架
  const scope=new THREE.Group();scope.position.set(7.6,-3.15,2.6);scope.rotation.y=-0.45;g.add(scope);
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.34,2.6,24),brass);tube.rotation.z=Math.PI/2;tube.position.y=0.75;tube.castShadow=true;scope.add(tube);
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,0.22,24),brass);lens.rotation.z=Math.PI/2;lens.position.set(1.35,0.75,0);scope.add(lens);
  const legM=new THREE.MeshStandardMaterial({color:0x8a6229,roughness:0.4,metalness:0.7,envMap:A.env,envMapIntensity:1});
  for(const p of[[-0.5,-0.72,0.55],[0.5,-0.72,0.55],[0,-0.72,-0.7]]){const d=new THREE.Vector3(...p),m=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,d.length(),8),legM);m.position.copy(d.clone().multiplyScalar(0.5).add(new THREE.Vector3(0,0.6,0)));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());scope.add(m);}
  return g;
}

let composer=null,bloom=null,renderPass=null;
function setupComposer(){
  composer=new EffectComposer(renderer);
  renderPass=new RenderPass(scene,camera);composer.addPass(renderPass);
  bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0.42,0.7,0.82);composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

let A,env,ocean,isle,life,modules={};
try{
  A=await loadAssets(renderer,p=>{$('loadStatus').textContent='加载资源 '+Math.round(p*100)+'%…';});
  scene.environment=A.env;
  const ctx={THREE,assets:A,state,rnd,createOcean,createIslandShip};
  env=createBottleEnv(ctx);scene.add(env.bottleRoot);
  buildRoom(A);
  ocean=createOcean(ctx);env.innerWorld.add(ocean.group);
  isle=createIslandShip(ctx);
  life=createLifeSky(ctx);env.innerWorld.add(life.group);
  modules={env,ocean,isle,life};
  setupComposer();
}catch(e){fail('资源或模块初始化失败：'+e.message);throw e;}

const phaseEl=$('phase'),speedEl=$('speedRead'),sailingEl=$('sailing'),banner=$('stormBanner'),fpsEl=$('fps'),qEl=$('qualityRead');
function setSpeed(v){state.speed=v;speedEl.textContent=v===0?'暂停':'× '+v;document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',Number(b.dataset.speed)===v));}
document.querySelectorAll('[data-speed]').forEach(b=>b.addEventListener('click',()=>setSpeed(Number(b.dataset.speed))));
function setStormLevel(v){
  state.stormLevel=v;state.stormTarget=v/2;
  document.querySelectorAll('[data-storm]').forEach(b=>b.classList.toggle('active',Number(b.dataset.storm)===v));
  sailingEl.textContent=['平静','风暴','飓风'][v];
  banner.textContent=v===2?'飓 风 正 在 登 陆':'风 暴 正 在 经 过';banner.classList.toggle('on',v>0);
  life&&life.setStormLevel&&life.setStormLevel(v);
}
document.querySelectorAll('[data-storm]').forEach(b=>b.addEventListener('click',()=>{const v=Number(b.dataset.storm);setStormLevel(state.stormLevel===v?0:v);}));
function resetScene(){
  setSpeed(1);setStormLevel(0);state.storm=0;state.stormTarget=0;
  state.day=.71;state.time=0;state.real=0;state.lightning=0;
  camera.position.set(13,7.6,23);controls.target.set(0,-0.35,0);controls.autoRotate=true;controls.update();
  env.bottleRoot.rotation.set(0,0,0);env.innerWorld.quaternion.identity();renderer.toneMappingExposure=1.05;
}
$('resetBtn').addEventListener('click',resetScene);

function dayWeights(p){
  const dawn=Math.max(0,1-Math.abs(p-.25)/.25),day=Math.max(0,1-Math.abs(p-.5)/.25),
        dusk=Math.max(0,1-Math.abs(p-.75)/.25),night=Math.max(0,1-Math.min(p,1-p)/.25);
  return{dawn,day,dusk,night};
}
function updateDay(dt){
  state.day=(state.day+dt/120)%1;const w=dayWeights(state.day),night=clamp(w.night*1.35,0,1),daylight=clamp(w.day+w.dawn*.55+w.dusk*.35,0,1);
  let label='子夜';if(state.day>=.15&&state.day<.4)label='黎明';else if(state.day>=.4&&state.day<.65)label='正午';else if(state.day>=.65&&state.day<.9)label='黄昏';phaseEl.textContent=label;
  const a=state.day*TAU-Math.PI*.5;sun.position.set(Math.cos(a)*10,3+Math.max(0,Math.sin(a))*8,Math.cos(a)*6+4);
  sun.intensity=.8+daylight*2.6;sun.color.setHSL(.09,0.45,lerp(.42,.72,daylight));
  hemi.intensity=.5+daylight*.9;warm.intensity=18+w.dusk*30+night*14;
  const c=new THREE.Color(0x101820);c.lerp(new THREE.Color(0x080d18),night*.6);scene.background.copy(c);scene.fog.color.copy(c);
  renderer.toneMappingExposure=1.0+night*.18+w.dusk*.12;
  env.setNight&&env.setNight(night);ocean.uniforms&&(ocean.uniforms.uNight.value=night);
  ocean.setSunDir&&ocean.setSunDir(sun.position.clone().normalize());
  return{night,daylight,w};
}
function updateStorm(dt){
  state.storm=lerp(state.storm,state.stormTarget,1-Math.exp(-dt*3));const s=state.storm;
  env.bottleRoot.rotation.x=Math.sin(state.real*2.5)*(.035+s*.05)*s;
  env.innerWorld.quaternion.copy(env.bottleRoot.quaternion).invert();
  if(bloom)bloom.strength=.42+s*.22;
}

let last=performance.now(),frames=0,fpsT=0,lowT=0;
function animate(now){
  requestAnimationFrame(animate);
  const raw=Math.min((now-last)/1000,.05);last=now;state.real+=raw;
  const dt=raw*state.speed;state.time+=dt;
  updateStorm(raw);const day=updateDay(dt);
  env.update&&env.update(dt,state);
  ocean.update&&ocean.update(state.time,state.storm,day.night);
  isle.update&&isle.update(state.time,dt,state.storm);
  life.update&&life.update(state.time,dt,state.storm,day.night,state.day);
  controls.update();
  if(composer&&state.quality>0)composer.render();else renderer.render(scene,camera);
  frames++;fpsT+=raw;
  if(fpsT>=1){state.fps=Math.round(frames/fpsT);fpsEl.textContent=state.fps+' FPS';
    fpsEl.style.color=state.fps>=50?'#9bbca7':'#d9b277';
    // 自适应画质：连续低帧则依次关闭 bloom、降低分辨率
    if(state.fps<32){lowT+=fpsT;if(lowT>4){
      if(state.quality===1){renderer.setPixelRatio(1);state.quality=0.5;qEl.textContent='均衡';lowT=0;}
      else if(state.quality===0.5){if(bloom)bloom.enabled=false;state.quality=0;qEl.textContent='流畅';lowT=0;}
    }}else lowT=0;
    frames=0;fpsT=0;
    window.__SCENE_STATE__={fps:state.fps,quality:state.quality,day:+state.day.toFixed(3),storm:+state.storm.toFixed(2),level:state.stormLevel,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  }
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer&&composer.setSize(innerWidth,innerHeight);});

resetScene();
window.__READY__=true;
window.__SCENE_DEBUG__={THREE,scene,camera,renderer,controls,state,env,ocean,isle,life,setStormLevel,resetScene,insideBottle};
document.getElementById('loading').classList.add('hide');
requestAnimationFrame(animate);
console.log('BOTTLE_REALISTIC_READY',JSON.stringify({three:THREE.REVISION,hdri:!!A.env,modules:Object.keys(modules)}));