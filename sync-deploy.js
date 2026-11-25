const fs=require('fs'),path=require('path');
const src='C:\\Users\\cckj\\Documents\\deepseek-harness\\default-workspace\\realism';
const dst='C:\\Users\\cckj\\Documents\\deepseek-harness\\default-workspace\\deploy-bottle-ocean';
function copy(a,b){for(const n of fs.readdirSync(a)){if(n==='.git')continue;const s=path.join(a,n),d=path.join(b,n);const st=fs.statSync(s);if(st.isDirectory()){if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});copy(s,d);}else fs.copyFileSync(s,d);}}
copy(src,dst);
let n=0;function count(a){for(const f of fs.readdirSync(a)){if(f==='.git')continue;const s=path.join(a,f);if(fs.statSync(s).isDirectory())count(s);else n++;}}count(dst);
console.log('SYNCED files='+n);