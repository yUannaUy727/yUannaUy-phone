// Capture-level delegation: pointer and touch are alternative observations of one swipe.
// A cancelled/malformed legacy touch stream must not erase a live pointer stream.
(() => {
'use strict';
let gesture=null,suppressUntil=0,multiUntil=0;const rejected={};
const trace=[];
function log(type,e,reason){const p=e?.changedTouches?.[0]||e;trace.push({t:Date.now(),type,reason,stream:gesture?.owner||'',touches:e?.touches?.length,changed:e?.changedTouches?.length,touchIds:e?.touches?[...e.touches].map(t=>t.identifier).slice(0,4):undefined,changedIds:e?.changedTouches?[...e.changedTouches].map(t=>t.identifier).slice(0,4):undefined,pointer:e?.pointerType,button:e?.button,target:String(e?.target?.className||e?.target?.tagName||'').slice(0,110),x:Math.round(p?.clientX||0),y:Math.round(p?.clientY||0)});if(trace.length>32)trace.shift();}
function reset(reason){if(gesture){gesture.row.style.transform=gesture.originalTransform;gesture.row.classList.remove('uwu-swipe-ready');gesture=null;}if(reason)log('reset',null,reason);}
function currentChat(){if(typeof currentChatId==='undefined'||typeof currentChatType==='undefined')return null;return (currentChatType==='private'?db.characters:db.groups)?.find(c=>c.id===currentChatId);}
function targetRow(e){const target=e.target?.closest?e.target:e.target?.parentElement;const row=target?.closest('.message-wrapper[data-id]');const area=document.getElementById('message-area');if(!row||!area?.contains(row)){log(e.type,e,'outside-message');return null;}if(typeof isInMultiSelectMode!=='undefined'&&isInMultiSelectMode){log(e.type,e,'multi-select');return null;}if(target.closest('input,textarea,video,audio,.uwu-todo-card,.uwu-poll-option,.uwu-poll-add')){log(e.type,e,'interactive-control');return null;}return row;}
function start(e,kind,p){
 const row=targetRow(e);if(!row){reset('outside-start');return;}if(Date.now()<multiUntil){log(e.type,e,'fresh-multitouch');return;}
 const id=kind==='touch'?p.identifier:e.pointerId;delete rejected[kind];
 const paired=gesture&&gesture.row===row&&Date.now()-gesture.at<120&&Math.hypot(p.clientX-gesture.x,p.clientY-gesture.y)<14;
 if(gesture?.seeds[kind]&&gesture.seeds[kind].id!==id&&Date.now()-(gesture.lastInput||gesture.at)<250){reset('multiple-fresh-contacts');multiUntil=Date.now()+300;return;}
 if(!paired){reset();const chat=currentChat();if(!chat){log(e.type,e,'missing-chat');return;}gesture={row,chat,chatId:currentChatId,chatType:currentChatType,history:chat.history,archive:chat.activeArchiveId||null,id:row.dataset.id,x:p.clientX,y:p.clientY,at:Date.now(),seeds:{},owner:null,dx:0,originalTransform:row.style.transform};}
 gesture.seeds[kind]={id,x:p.clientX,y:p.clientY};gesture.lastInput=Date.now();log(e.type,e,'start-'+kind);
}
function move(e,kind,p){
 if(!p)return;
 const id=kind==='touch'?p.identifier:e.pointerId;
 if(gesture&&Date.now()-(gesture.lastInput||gesture.at)>800)reset('idle-stream');
 if(!gesture?.seeds[kind]){
  // Some WebViews resume MOVE delivery without a fresh DOWN after an OS gesture.
  // Rebase at the first delivered sample, then require a full new horizontal swipe.
  if(rejected[kind]?.id===id&&Date.now()-rejected[kind].at<800){rejected[kind].at=Date.now();return;}if(Date.now()<multiUntil)return;
  if(kind==='mouse'||kind==='pointer'&&e.pointerType==='mouse'&&!(e.buttons&1))return;
  if(gesture?.owner)return;
  start(e,kind,p);log(e.type,e,'rebase-missing-start-'+kind);return;
 }
 const seed=gesture.seeds[kind];if(kind==='pointer'&&e.pointerId!==seed.id)return;
 gesture.lastInput=Date.now();
 if(gesture.owner&&gesture.owner!==kind){if(e.cancelable)e.preventDefault();return;}
 const dx=p.clientX-seed.x,dy=p.clientY-seed.y;
 if(!gesture.owner){
  if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)){rejected[kind]={id:seed.id,at:Date.now()};delete gesture.seeds[kind];log(e.type,e,'vertical-scroll');if(!Object.keys(gesture.seeds).length)reset();return;}
  if(dx>=-12||Math.abs(dx)<=Math.abs(dy)*1.4)return;
  // Neutralise a pre-v78 row listener if a stale cached script is still present.
  window.UwUGestureInput?.cancel();gesture.owner=kind;log(e.type,e,'horizontal-'+kind);
 }
 if(e.cancelable)e.preventDefault();if(typeof longPressTimer!=='undefined')clearTimeout(longPressTimer);
 gesture.dx=Math.max(-80,Math.min(0,dx));gesture.row.style.transform='translateX('+gesture.dx+'px)';gesture.row.classList.toggle('uwu-swipe-ready',gesture.dx<=-50);
}
function end(e,kind,p,cancelled=false){
 delete rejected[kind];if(!gesture?.seeds[kind])return;const seed=gesture.seeds[kind];if(kind==='pointer'&&e.pointerId!==seed.id)return;
 if(cancelled){rejected[kind]={id:seed.id,at:Date.now()};log(e.type,e,'cancel-'+kind);delete gesture.seeds[kind];if(!Object.keys(gesture.seeds).length){reset();return;}if(gesture.owner===kind){gesture.owner=null;gesture.dx=0;gesture.row.style.transform=gesture.originalTransform;gesture.row.classList.remove('uwu-swipe-ready');}return;}
 if(!gesture.owner&&p)move(e,kind,p);
 if(!gesture)return;if(gesture.owner!==kind){delete gesture.seeds[kind];return;}
 const g=gesture,chat=currentChat();const valid=chat===g.chat&&currentChatId===g.chatId&&currentChatType===g.chatType&&chat.history===g.history&&(chat.activeArchiveId||null)===g.archive&&g.row.isConnected;
 const message=valid&&chat.history.find(m=>String(m.id)===g.id&&!m.isWithdrawn);
 const quote=g.dx<=-50&&!!message;log(e.type,e,quote?'quote':'below-threshold-or-stale');reset();
 if(quote){suppressUntil=Date.now()+600;if(typeof longPressTimer!=='undefined')clearTimeout(longPressTimer);startQuoteReply(message.id);}
}
const opts={capture:true,passive:false};
document.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;start(e,'pointer',e);},opts);
document.addEventListener('pointermove',e=>move(e,'pointer',e),opts);
document.addEventListener('pointerup',e=>end(e,'pointer',e),true);
document.addEventListener('pointercancel',e=>end(e,'pointer',e,true),true);
document.addEventListener('touchstart',e=>{
 const changed=[...(e.changedTouches||[])];
 // Track the fresh changed contact, not the total legacy touch list. Android system
 // gestures can leave stale contacts in that list after a screenshot interruption.
 if(changed.length>1){if(gesture?.seeds.pointer){log(e.type,e,'legacy-multiple-pointer-kept');return;}reset('multiple-changed-touches');multiUntil=Date.now()+300;return;}
 const p=changed[0]||(e.touches?.length===1?e.touches[0]:null);if(p)start(e,'touch',p);else log(e.type,e,'no-fresh-touch');
},opts);
document.addEventListener('touchmove',e=>{const seed=gesture?.seeds.touch,changed=[...(e.changedTouches||[])];const p=seed?[...changed,...(e.touches||[])].find(t=>t.identifier===seed.id):changed.length===1?changed[0]:e.touches?.length===1?e.touches[0]:null;move(e,'touch',p);},opts);
document.addEventListener('touchend',e=>{const seed=gesture?.seeds.touch;if(!seed){delete rejected.touch;return;}const changed=[...(e.changedTouches||[])];const p=changed.find(t=>t.identifier===seed.id);if(!p&&[...(e.touches||[])].some(t=>t.identifier===seed.id))return;end(e,'touch',p);},true);
document.addEventListener('touchcancel',e=>{const id=gesture?.seeds.touch?.id,changed=[...(e.changedTouches||[])];if(id!==undefined&&changed.length&&!changed.some(t=>t.identifier===id)){log(e.type,e,'unrelated-cancel');return;}end(e,'touch',null,true);},true);
if(!window.PointerEvent){document.addEventListener('mousedown',e=>{if(e.button===0)start(e,'mouse',e);},opts);document.addEventListener('mousemove',e=>move(e,'mouse',e),opts);document.addEventListener('mouseup',e=>end(e,'mouse',e),true);}
for(const name of ['blur','focus','pagehide','pageshow','uwu:app-resume'])window.addEventListener(name,()=>{reset(name);for(const key of Object.keys(rejected))delete rejected[key];suppressUntil=0;multiUntil=0;});
for(const name of ['visibilitychange','freeze','resume'])document.addEventListener(name,()=>{reset(name);for(const key of Object.keys(rejected))delete rejected[key];suppressUntil=0;multiUntil=0;});
document.addEventListener('click',e=>{if(Date.now()<suppressUntil&&document.getElementById('message-area')?.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
function diagnostics(){return JSON.stringify({version:'78r2',pointerEvents:!!window.PointerEvent,hidden:document.hidden,visibility:document.visibilityState,multiSelect:typeof isInMultiSelectMode==='undefined'?null:isInMultiSelectMode,active:gesture?{stream:gesture.owner,seeds:Object.keys(gesture.seeds),dx:gesture.dx}:null,events:trace});}
async function copy(){const value=diagnostics();try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);showToast('左滑诊断已复制');return;}}catch(_){}
 const input=document.createElement('textarea');input.value=value;input.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';document.body.append(input);input.select();let copied=false;try{copied=document.execCommand('copy');}catch(_){}input.remove();if(copied)showToast('左滑诊断已复制');else window.prompt('左滑诊断（长按复制）',value);
}
window.UwUSwipeReply={diagnostics,copy,cancel:()=>reset('manual')};
})();
