(() => {
'use strict';
function nightApply(target){
 const active=target||document.querySelector('.screen.active')?.id;
 document.body.classList.toggle('uwu-night-active',!!db.uwuNightMode&&active!=='chat-room-screen');
 const style=document.getElementById('global-css-style');if(style)style.textContent=db.uwuNightMode?'':db.globalCss||'';
}
window.UwUNight={apply:nightApply};
document.addEventListener('change',async e=>{if(e.target.id!=='uwu-night-toggle')return;const before=!!db.uwuNightMode;db.uwuNightMode=e.target.checked;nightApply();try{await saveData();}catch{db.uwuNightMode=before;e.target.checked=before;nightApply();showToast('夜间设置保存失败');}});
window.addEventListener('uwu-db-ready',()=>nightApply());
function cotDrag(row,id){row.classList.add('uwu-cot-draggable');row.title='长按拖动排序';let timer=null,active=false,frame=0,y=0,start=null,original=[];const list=()=>document.getElementById('cot-preset-list-container');function position(schedule=true){const host=list();if(!host||!active)return;const box=host.getBoundingClientRect();if(y<box.top+40)host.scrollTop-=9;else if(y>box.bottom-40)host.scrollTop+=9;const next=[...host.children].filter(n=>n!==row&&n.dataset.cotPresetId).find(n=>y<n.getBoundingClientRect().top+n.getBoundingClientRect().height/2);host.insertBefore(row,next||null);if(schedule)frame=requestAnimationFrame(()=>position());}
 const gesture=UwUGestureInput.bind(row,{start(p,e){if(e.target.closest('button,input,textarea')||cotPresetMoveBusy)return false;start=p;y=p.y;timer=setTimeout(()=>{active=true;original=[...db.cotPresets];row.classList.add('uwu-cot-dragging');position();navigator.vibrate?.(15);},320);},move(p,e){y=p.y;if(active){if(e.cancelable)e.preventDefault();}else if(start&&Math.hypot(p.x-start.x,p.y-start.y)>10){clearTimeout(timer);timer=null;}},async end(p,e,cancelled){clearTimeout(timer);if(active&&!cancelled)position(false);cancelAnimationFrame(frame);row.classList.remove('uwu-cot-dragging');const was=active;active=false;start=null;if(!was)return;if(cancelled){const host=list();if(host)for(const preset of original){const node=[...host.children].find(n=>n.dataset.cotPresetId===preset.id);if(node)host.append(node);}return;}const host=list();if(!host)return;const ids=[...host.children].map(n=>n.dataset.cotPresetId);db.cotPresets=ids.map(x=>original.find(p=>p.id===x)).filter(Boolean);cotPresetMoveBusy=true;try{await saveData();renderCotPresetSelect();}catch{db.cotPresets=original;showToast('排序保存失败，已恢复');}finally{cotPresetMoveBusy=false;openCotPresetManageModal();}}});row.addEventListener('contextmenu',e=>e.preventDefault());}
window.UwUInteractions={cotDrag};
// Chat swipe is delegated by swipe_reply.js, independent of sorting gestures.
})();
