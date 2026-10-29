// Full serialized UTF-8 size, counted in small slices. No deduplication of reported data.
(() => {
'use strict';
function counter(){
 const objects=new WeakMap(),strings=new Map(),active=new WeakSet();
 function* stringSize(text){let size=2;for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);
  if(c===34||c===92||c===8||c===9||c===10||c===12||c===13)size+=2;
  else if(c<32)size+=6;else if(c<128)size++;else if(c<2048)size+=2;
  else if(c>=0xd800&&c<=0xdbff&&i+1<text.length&&text.charCodeAt(i+1)>=0xdc00&&text.charCodeAt(i+1)<=0xdfff){size+=4;i++;}
  else if(c>=0xd800&&c<=0xdfff)size+=6;else size+=3;
  if(i%16384===0)yield;
 }return size;}
 function* sizeOf(value){
  yield;const v=value&&typeof value.toJSON==='function'?value.toJSON():value;
  if(v===undefined||typeof v==='function'||typeof v==='symbol')return null;
  if(v===null)return 4;
  if(typeof v==='string'){if(!strings.has(v))strings.set(v,yield* stringSize(v));return strings.get(v);}
  if(typeof v!=='object')return JSON.stringify(v).length;
  if(objects.has(v))return objects.get(v);
  if(active.has(v))throw Error('数据存在循环引用，无法统计');active.add(v);
  let size=2,count=0;
  if(Array.isArray(v)){for(const item of v)size+=(count++?1:0)+((yield* sizeOf(item))??4);}
  else for(const key of Object.keys(v)){const child=yield* sizeOf(v[key]);if(child===null)continue;size+=(count++?1:0)+(yield* sizeOf(key))+1+child;}
  active.delete(v);objects.set(v,size);return size;
 }
 async function measureAsync(value,category,options={}){
  const clock=()=>typeof performance!=='undefined'?performance.now():Date.now();
  const check=()=>{if(options.shouldContinue&&!options.shouldContinue()){const e=Error('容量统计已取消');e.name='AbortError';throw e;}};
  check();await new Promise(resolve=>setTimeout(resolve,0));const iter=sizeOf(value);let start=clock(),n=0;
  while(true){check();const step=iter.next();if(step.done)return step.value??0;if(++n%128===0&&clock()-start>=6){await new Promise(resolve=>setTimeout(resolve,0));start=clock();}}
 }
 return {measureAsync};
}
window.UwUStorageSize={counter};
})();
