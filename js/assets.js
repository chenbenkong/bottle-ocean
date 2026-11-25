import * as THREE from 'three';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {ASSETS} from './config.js';

// 统一的素材加载：HDRI 用 PMREM 生成环境贴图，PBR 贴图并行加载
export async function loadAssets(renderer,onProgress){
  const pmrem=new THREE.PMREMGenerator(renderer);
  const mgr=new THREE.LoadingManager();
  let done=0;const total=7;
  const tick=()=>{done++;onProgress&&onProgress(done/total);};
  mgr.onLoad=()=>{};
  const texLoader=new THREE.TextureLoader(mgr);
  const loadTex=(url,srgb=true)=>new Promise((res)=>{
    texLoader.load(url,(t)=>{if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=renderer.capabilities.getMaxAnisotropy();tick();res(t);},undefined,()=>{tick();res(null);});
  });
  const loadHDR=(url)=>new Promise((res)=>{
    new RGBELoader().load(url,(hdr)=>{hdr.mapping=THREE.EquirectangularReflectionMapping;
      const env=pmrem.fromEquirectangular(hdr).texture;hdr.dispose();tick();res(env);},undefined,()=>{tick();res(null);});
  });
  const [sunset,studio,wood,woodTable,sand,grass,waterNormal]=await Promise.all([
    loadHDR(ASSETS.hdri.sunset), loadHDR(ASSETS.hdri.studio),
    loadTex(ASSETS.tex.wood), loadTex(ASSETS.tex.woodTable), loadTex(ASSETS.tex.sand),
    loadTex(ASSETS.tex.grass), loadTex(ASSETS.tex.waterNormal,false),
  ]);
  return {
    pmrem,
    hdri:{sunset,studio},
    env:sunset||studio,
    tex:{wood,woodTable,sand,grass,waterNormal},
  };
}