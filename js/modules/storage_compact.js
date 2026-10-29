// Read-only deduplicated estimate. Async traversal yields to navigation between small slices.
(() => {
'use strict';
function counter(){
 const objects=new WeakMap(),strings=new Map(),seen=new Map(),keys=new Map();
 const bytes=s=>{let n=0;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c<128)n++;else if(c<2048)n+=2;else if(c>=0xd800&&c<=0xdbff&&i+1<s.length&&s.charCodeAt(i+1)>=0xdc00&&s.charCodeAt(i+1)<=0xdfff){n+=4;i++;}else n+=3;}return n;};
 function* digest(s){let a=2166136261,b=5381;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;if(i%16384===0)yield;}return (a>>>0)+':'+(b>>>0);}
 const normalized=v=>v&&typeof v.toJSON==='function'?v.toJSON():v;
 const keyInfo=k=>{if(!keys.has(k)){const text=JSON.stringify(k);keys.set(k,{text,size:bytes(text)});}return keys.get(k);};
 function* info(value){
  yield;const v=normalized(value);
  if(v===undefined||typeof v==='function'||typeof v==='symbol')return null;
  if(v===null)return {size:4,key:'null'};
  if(typeof v!=='object'){
   if(typeof v==='string'&&strings.has(v))return strings.get(v);
   const text=JSON.stringify(v),r={size:bytes(text),key:typeof v+':'+(yield* digest(text))};
   if(typeof v==='string')strings.set(v,r);return r;
  }
  if(objects.has(v))return objects.get(v);
  let size=2,signature=Array.isArray(v)?'array:':'object:',count=0;
  if(Array.isArray(v)){for(const item of v){const child=(yield* info(item))||{size:4,key:'null'};size+=child.size+(count++?1:0);signature+=child.key+':'+child.size+';';}}
  else for(const key of Object.keys(v)){const child=yield* info(v[key]);if(!child)continue;const k=keyInfo(key);size+=k.size+1+child.size+(count++?1:0);signature+=k.text+':'+child.key+':'+child.size+';';}
  const r={size,key:size+':'+(yield* digest(signature))};objects.set(v,r);return r;
 }
 function* equal(a,b){
  yield;a=normalized(a);b=normalized(b);if(a===b)return true;
  if(a===null||b===null||typeof a!==typeof b)return false;
  if(typeof a!=='object')return JSON.stringify(a)===JSON.stringify(b);
  if(Array.isArray(a)!==Array.isArray(b))return false;
  if(Array.isArray(a)){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(!(yield* equal(a[i]===undefined?null:a[i],b[i]===undefined?null:b[i])))return false;return true;}
  const ak=[],bk=[];for(const k of Object.keys(a))if(yield* info(a[k]))ak.push(k);for(const k of Object.keys(b))if(yield* info(b[k]))bk.push(k);
  if(ak.length!==bk.length)return false;for(let i=0;i<ak.length;i++)if(ak[i]!==bk[i]||!(yield* equal(a[ak[i]],b[bk[i]])))return false;return true;
 }
 function* walk(value,path){
  yield;const v=normalized(value),r=yield* info(v);if(!r)return 0;
  const eligible=r.size>=512&&(typeof v==='string'||v&&typeof v==='object'&&!(!Array.isArray(v)&&Object.prototype.hasOwnProperty.call(v,'archives')));
  if(eligible){const matches=seen.get(r.key)||[];let match;for(const x of matches)if(yield* equal(x.value,v)){match=x;break;}
   if(match){const reference=4+bytes(JSON.stringify({path,source:match.path}))+1;if(reference<r.size)return reference;}
   matches.push({value:v,path:[...path]});seen.set(r.key,matches);
  }
  if(v===null||typeof v!=='object')return r.size;
  let result=2,count=0;
  if(Array.isArray(v)){for(let i=0;i<v.length;i++)result+=(count++?1:0)+((yield* info(v[i]))?(yield* walk(v[i],[...path,i])):4);}
  else for(const key of Object.keys(v)){if(!(yield* info(v[key])))continue;result+=keyInfo(key).size+1+(count++?1:0)+(yield* walk(v[key],[...path,key]));}
  return result;
 }
 const sync=iter=>{let step;do{step=iter.next();}while(!step.done);return step.value;};
 async function asyncRun(iter,options={}){
  const clock=()=>typeof performance!=='undefined'?performance.now():Date.now();
  const check=()=>{if(options.shouldContinue&&!options.shouldContinue()){const e=Error('容量分析已取消');e.name='AbortError';throw e;}};
  // Let the requested screen paint before inspecting its data.
  await new Promise(resolve=>setTimeout(resolve,0));let slice=clock(),n=0;
  while(true){check();const step=iter.next();if(step.done)return step.value;
   if(++n%128===0&&clock()-slice>=6){await new Promise(resolve=>setTimeout(resolve,0));slice=clock();}
  }
 }
 let sequence=0;
 return {measure:(value,category)=>sync(walk(value,[category,sequence++])),measureAsync:(value,category,options)=>asyncRun(walk(value,[category,sequence++]),options)};
}
window.UwUCompactStorage={counter};
})();
