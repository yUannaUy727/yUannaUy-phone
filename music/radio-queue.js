// One model response supplies concrete choices; bounded searches only resolve them.
(() => {
'use strict';
function create(io){
 let generation=0,enabled=false,pending=new Set(),seen=new Set(),busy=false,last=null;
 function reset(){generation++;enabled=false;pending.clear();seen.clear();busy=false;last=null;}
 function remaining(){const live=new Set(io.queue().map(s=>String(s.id)));for(const id of pending)if(!live.has(id))pending.delete(id);return pending.size;}
 function state(){return {radio:enabled,remaining:remaining(),...(last?{lastSearch:last}:{})};}
 function played(id,replace=false,internal=false){if(replace){if(!internal)reset();enabled=!!io.owner();pending=new Set(io.queue().map(s=>String(s.id)));}pending.delete(String(id));seen.add(String(id));}
 function added(songs){if(!enabled&&io.owner()){enabled=true;pending=new Set(io.queue().slice(io.index()+1).map(s=>String(s.id)));}for(const s of songs){pending.add(String(s.id));seen.add(String(s.id));}if(io.index()>=0)pending.delete(String(io.queue()[io.index()]?.id));}
 function pendingSongs(){remaining();return io.queue().filter(s=>pending.has(String(s.id)));}
 async function start(raw,append=false,options={}){
  if(!io.owner())throw Error('一起听未开启');if(busy)throw Error('正在查找歌曲，请稍后再试');
  if(!Array.isArray(raw)||!raw.length||raw.length>12||raw.some(t=>!t||typeof t!=='object'||!String(t.title||t.name||'').trim()||!String(t.artist||'').trim()||String(t.title||t.name).length>160||String(t.artist).length>160))throw Error('请用tracks列出1至12首具体歌名和歌手，不再按歌手关键词整批填歌');
  const token=generation,stamp=io.stamp(),valid=()=>token===generation&&io.valid(stamp)&&(!options.valid||options.valid()),wanted=raw.length;
  if(!wanted)return {ok:true,added:0,remaining:remaining(),songIds:[]};
  const excluded=new Set([...(append?seen:[]),...io.queue().map(s=>String(s.id))]),rows=new Array(raw.length),failed=[];let cursor=0;
  busy=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
  try{
   // Three concurrent music searches, at most twelve; never ask the model again.
   await Promise.all(Array.from({length:Math.min(3,raw.length)},async()=>{while(cursor<raw.length){const i=cursor++;try{if(!valid()||controller.signal.aborted)throw Error('搜索已取消');rows[i]=await io.resolve({title:raw[i].title||raw[i].name,artist:raw[i].artist},valid,controller.signal);}catch(e){rows[i]={error:String(e.message).slice(0,120)};}}}));
   if(!valid())throw Error('播放或一起听状态已变化，本次选歌已取消');
   const songs=[],artists=new Map();for(let i=0;i<rows.length;i++){const s=rows[i],choice=raw[i];let reason=s?.error;if(!reason&&excluded.has(String(s?.id)))reason='已在队列或本轮播放记录中';const artist=String((s?.ar||s?.artists||[])[0]?.name||'').trim().toLowerCase();if(!reason&&!options.singleArtist&&artist&&(artists.get(artist)||0)>=4)reason='同一歌手过于集中';if(reason){failed.push({title:choice.title||choice.name,artist:choice.artist,reason});continue;}if(songs.length>=wanted)continue;excluded.add(String(s.id));artists.set(artist,(artists.get(artist)||0)+1);songs.push(s);}
   if(!songs.length){last={added:0,failed};throw Error(failed[0]?.reason||'没有准确匹配的歌曲');}
   await io.commit(songs,append,()=>token===generation&&io.owner()===stamp.owner&&(!options.valid||options.valid()));
   if(token!==generation||io.owner()!==stamp.owner)throw Error('一起听状态已变化');
   enabled=true;added(songs);last={added:songs.length,failed};
   return {ok:true,added:songs.length,remaining:remaining(),songIds:songs.map(s=>String(s.id)),chosen:songs.map(s=>({id:String(s.id),title:s.name,artist:(s.ar||s.artists||[]).map(a=>a.name).join('/')})),unmatched:failed,partial:failed.length>0};
  }finally{clearTimeout(timer);if(token===generation)busy=false;}
 }
 return {start,state,reset,played,added,pendingSongs};
}
window.UwURadioQueue={create};
})();
