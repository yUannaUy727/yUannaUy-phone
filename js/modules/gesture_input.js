// Shared drag input. Pointer and touch observations belong to one interaction;
// interrupted legacy touch metadata must not permanently disable the next drag.
(()=>{
'use strict';
let active=null,blockedUntil=0,lastTouch=0;
const bindings=new WeakMap(),options={capture:true,passive:false};
function finish(e,cancelled=true){const a=active;if(!a)return;active=null;a.binding.handlers.end?.(a.lastPoint||a.point,e,cancelled);}
function reset(e){finish(e,true);blockedUntil=0;lastTouch=0;}
function bindingAt(target){for(let el=target?.nodeType===3?target.parentNode:target;el;el=el.parentNode){const b=bindings.get(el);if(b&&!b.destroyed)return b;}return null;}
function begin(binding,e,kind,p,inferred=false){
 if(!p||binding.destroyed||!binding.el.isConnected||Date.now()<blockedUntil)return;
 if(kind==='mouse'&&Date.now()-lastTouch<800)return;
 if(kind==='touch')lastTouch=Date.now();
 const id=kind==='touch'?p.identifier:e.pointerId,now=Date.now();
 const same=active?.binding===binding;
 if(same&&active.seeds[kind]?.id!==undefined&&active.seeds[kind].id!==id&&now-active.lastInput<250){finish(e,true);blockedUntil=now+300;return;}
 const paired=same&&!active.seeds[kind]&&now-active.at<160&&Math.hypot(p.clientX-active.point.x,p.clientY-active.point.y)<20;
 if(paired){active.seeds[kind]={id};active.lastInput=now;if(kind==='pointer')active.kind=kind;return;}
 finish(e,true);
 if(!binding.el.isConnected)return;
 const point={kind,id,x:p.clientX,y:p.clientY,event:e};
 if(binding.handlers.start?.(point,e)===false)return;
 active={binding,kind,seeds:{[kind]:{id}},point,lastPoint:point,at:now,lastInput:now,prevented:false,inferred};
}
function move(e,kind,p){
 if(!p)return;
 if(!active){const b=bindingAt(e.target);if(b&&kind!=='mouse'&&(e.pointerType!=='mouse'||e.buttons&1))begin(b,e,kind,p,true);return;}
 const a=active,seed=a.seeds[kind];if(!seed)return;
 if(kind==='pointer'&&e.pointerId!==seed.id)return;
 a.lastInput=Date.now();
 if(a.kind!==kind){if(a.prevented&&e.cancelable)e.preventDefault();return;}
 a.lastPoint={...a.point,kind,id:seed.id,x:p.clientX,y:p.clientY};
 a.binding.handlers.move?.(a.lastPoint,e);a.prevented=!!e.defaultPrevented;
}
function end(e,kind,cancelled=false){
 const a=active,seed=a?.seeds[kind];if(!seed)return;
 if(kind==='pointer'&&e.pointerId!==seed.id)return;
 if(kind==='touch'){
  const changed=[...(e.changedTouches||[])],remaining=[...(e.touches||[])];
  if(changed.length&&!changed.some(t=>t.identifier===seed.id))return;
  if(!changed.length&&!cancelled&&remaining.some(t=>t.identifier===seed.id))return;
 }
 delete a.seeds[kind];
 if(cancelled){
  if(!Object.keys(a.seeds).length){finish(e,true);return;}
  if(a.kind===kind)a.kind=a.seeds.pointer?'pointer':a.seeds.touch?'touch':'mouse';
  return;
 }
 if(a.kind===kind||!Object.keys(a.seeds).length)finish(e,false);
}
function touchPoint(e){const seed=active?.seeds.touch,changed=[...(e.changedTouches||[])];if(seed)return [...changed,...(e.touches||[])].find(t=>t.identifier===seed.id);return changed.length===1?changed[0]:e.touches?.length===1?e.touches[0]:null;}
for(const kind of ['touch','pointer','mouse']){
 document.addEventListener(kind+'move',e=>move(e,kind,kind==='touch'?touchPoint(e):e),options);
 document.addEventListener(kind==='touch'?'touchend':kind==='pointer'?'pointerup':'mouseup',e=>end(e,kind),true);
}
document.addEventListener('touchcancel',e=>end(e,'touch',true),true);
document.addEventListener('pointercancel',e=>end(e,'pointer',true),true);
for(const name of ['blur','focus','pagehide','pageshow','uwu:app-resume'])window.addEventListener(name,reset);
for(const name of ['visibilitychange','freeze','resume'])document.addEventListener(name,reset);
function bind(el,handlers){
 const previous=bindings.get(el);previous?.destroy();
 const binding={el,handlers,destroyed:false};
 const touch=e=>{const changed=[...(e.changedTouches||[])];if(changed.length>1){if(active?.binding===binding&&active.seeds.pointer)return;finish(e,true);blockedUntil=Date.now()+300;return;}const p=changed[0]||(e.touches?.length===1?e.touches[0]:null);if(p)begin(binding,e,'touch',p);};
 const pointer=e=>{if(e.pointerType==='mouse'&&e.button!==0||!window.PointerEvent&&e.button!==0)return;begin(binding,e,window.PointerEvent?'pointer':'mouse',e);};
 const onPointer=window.PointerEvent?'pointerdown':'mousedown';
 el.addEventListener('touchstart',touch,{passive:false});el.addEventListener(onPointer,pointer);
 const handle={cancel(){if(active?.binding===binding)finish(null,true);},destroy(){if(active?.binding===binding)finish(null,true);binding.destroyed=true;el.removeEventListener('touchstart',touch);el.removeEventListener(onPointer,pointer);if(bindings.get(el)===binding)bindings.delete(el);}};
 binding.destroy=handle.destroy;bindings.set(el,binding);return handle;
}
window.UwUGestureInput={bind,cancel:()=>finish(null,true)};
})();
