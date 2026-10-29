// Device-local layout preference: native chrome and viewport insets vary by container.
(() => {
'use strict';
const key='uwu.layout.topInsetMode.v1',modes=['auto','extra','none'];
function read(){try{const value=localStorage.getItem(key);return modes.includes(value)?value:'auto';}catch{return 'auto';}}
let mode=read();
function resolve(systemTop,selected=mode){const top=Math.max(0,Number(systemTop)||0);return selected==='none'?0:selected==='extra'?Math.max(24,top):top;}
function value(){const top=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--uwu-system-safe-top'))||0;return resolve(top);}
function apply(){
 document.documentElement.style.setProperty('--uwu-top-inset',value()+'px');
 const frame=document.getElementById('uwu-music-frame');try{frame?.contentWindow?.UwUBridge?.appTheme();}catch{}
}
function setMode(next){if(!modes.includes(next))return;const before=mode;try{localStorage.setItem(key,next);mode=next;}catch{mode=before;showToast('顶部留白设置未保存，请重试');}apply();return mode;}
window.UwUTopInsets={mode:()=>mode,value,resolve,apply,setMode};
document.addEventListener('change',e=>{if(e.target.id==='uwu-top-inset-mode')e.target.value=setMode(e.target.value);});
for(const event of ['resize','orientationchange','fullscreenchange','uwu-db-ready'])window.addEventListener(event,apply);
document.addEventListener('fullscreenchange',apply);window.visualViewport?.addEventListener('resize',apply);
for(const query of ['(display-mode: fullscreen)','(display-mode: standalone)'])window.matchMedia(query).addEventListener?.('change',apply);
apply();
})();
