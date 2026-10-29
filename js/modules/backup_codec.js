// Lossless export-only deduplication. Runtime archives and records are untouched.
(() => {
'use strict';const FORMAT='uwu-lossless-backup-1';
const digest=s=>{let a=2166136261,b=5381;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b,33)^c;}return s.length+':'+(a>>>0)+':'+(b>>>0);};
function at(root,path){let value=root;for(const key of path){if(value===null||typeof value!=='object'||!Object.prototype.hasOwnProperty.call(value,key))throw Error('备份引用路径无效');value=value[key];}return value;}
function set(root,path,value){if(!path.length)throw Error('备份不能替换根节点');const parent=at(root,path.slice(0,-1)),key=path.at(-1);if(!Object.prototype.hasOwnProperty.call(parent,key))throw Error('备份恢复位置无效');Object.defineProperty(parent,key,{value,writable:true,enumerable:true,configurable:true});}
function packJSON(json){const root=JSON.parse(json),seen=new Map(),refs=[];
function walk(value,path){if(path.length&&value!==null&&(typeof value==='object'||typeof value==='string')&&!(typeof value==='object'&&!Array.isArray(value)&&Object.prototype.hasOwnProperty.call(value,'archives'))&&!(Array.isArray(value)&&['characters','groups'].includes(path.at(-1)))){const text=typeof value==='string'?JSON.stringify(value):JSON.stringify(value);if(text.length>=2048){const key=digest(text),matches=seen.get(key)||[];for(const source of matches)if(JSON.stringify(at(root,source))===text){refs.push({path:[...path],source:[...source]});return null;}matches.push([...path]);seen.set(key,matches);}}
if(Array.isArray(value))return value.map((v,i)=>walk(v,[...path,i]));if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value))Object.defineProperty(out,key,{value:walk(value[key],[...path,key]),enumerable:true,writable:true,configurable:true});return out;}return value;}
const data=walk(root,[]);if(!refs.length)return json;const packed=JSON.stringify({format:FORMAT,originalDigest:digest(JSON.stringify(root)),data,refs});return packed.length<json.length?packed:json;}
function unpack(value){if(value?.format!==FORMAT)return value;if(!value.data||typeof value.data!=='object'||!Array.isArray(value.refs))throw Error('精简备份结构不完整');const root=value.data;for(const ref of value.refs){if(!Array.isArray(ref.path)||!ref.path.length||!Array.isArray(ref.source)||ref.source.length>=ref.path.length&&ref.source.every((k,i)=>ref.path[i]===k))throw Error('备份引用关系无效');if(at(root,ref.path)!==null)throw Error('备份恢复位置不是占位符');const source=at(root,ref.source);set(root,ref.path,JSON.parse(JSON.stringify(source)));}if(digest(JSON.stringify(root))!==value.originalDigest)throw Error('精简备份完整性校验失败，原数据未替换');return root;}
// yuan v3 newline export: validate completely before any database write.
function parseText(text){
 const input=String(text).replace(/^\uFEFF/,'');
 try{return JSON.parse(input);}catch(original){
  const lines=input.split(/\r?\n/).filter(x=>x.trim());let header;
  try{header=JSON.parse(lines[0]);}catch{throw original;}
  if(header?.type!=='header'||header.format!=='ovo-stream-backup')throw original;
  if(header.formatRevision!==1||header.partial===true)throw Error('暂不支持这个 yuan 备份版本或局部备份，请使用完整备份');
  const root={},open=new Map(),chats=new Map();let count=0,footer=null,messages=0;
  const put=(obj,key,value)=>{if(typeof key!=='string')throw Error('yuan 记录缺少字段名称');Object.defineProperty(obj,key,{value,writable:true,enumerable:true,configurable:true});};
  for(let n=1;n<lines.length;n++){
   let r;try{r=JSON.parse(lines[n]);}catch{throw Error('yuan 备份第 '+(n+1)+' 行损坏，原数据保留');}
   if(r.type==='footer'){if(n!==lines.length-1||footer)throw Error('yuan 完成标记位置无效');footer=r;continue;}
   count++;const k=r.key;
   if(r.type==='array-start'||r.type==='object-start'){
    if(Object.hasOwn(root,k)||open.has(k))throw Error('yuan 字段重复');put(root,k,r.type==='array-start'?[]:{});open.set(k,r.type==='array-start'?'array':'object');
   }else if(r.type==='array-item'){
    if(open.get(k)!=='array'||r.index!==root[k].length||!Object.hasOwn(r,'value'))throw Error('yuan 数组分段不完整');root[k].push(r.value);
   }else if(r.type==='object-entry'){
    if(open.get(k)!=='object'||Object.hasOwn(root[k],r.property)||!Object.hasOwn(r,'value'))throw Error('yuan 对象记录无效');put(root[k],r.property,r.value);
   }else if(r.type==='chat-start'){
    if(!['characters','groups'].includes(k)||open.get(k)!=='array'||r.chatIndex!==root[k].length||!r.value||typeof r.value!=='object'||Array.isArray(r.value))throw Error('yuan 聊天起始记录无效');
    const c={...r.value,history:[]};root[k].push(c);chats.set(k+':'+r.chatIndex,c);
   }else if(r.type==='chat-history'){
    const c=chats.get(k+':'+r.chatIndex);if(!c||!Array.isArray(r.value))throw Error('yuan 聊天分段缺少角色');c.history.push(...r.value);messages+=r.value.length;
   }else if(r.type==='chat-end'){
    if(!chats.delete(k+':'+r.chatIndex))throw Error('yuan 聊天结束记录无效');
   }else if(r.type==='array-end'||r.type==='object-end'){
    if(open.get(k)!==(r.type==='array-end'?'array':'object')||[...chats.keys()].some(x=>x.startsWith(k+':')))throw Error('yuan 分段结束记录无效');open.delete(k);
   }else if(r.type==='value'){
    if(Object.hasOwn(root,k)||!Object.hasOwn(r,'value'))throw Error('yuan 字段重复或缺少内容');put(root,k,r.value);
   }else throw Error('不认识的 yuan 记录类型：'+String(r.type));
  }
  if(!footer?.completed||open.size||chats.size||footer.recordCount!==count+1||footer.processedMessages!==messages)throw Error('yuan 备份未完整导出，原数据保留');
  if(!Array.isArray(root.characters)||!Array.isArray(root.groups))throw Error('yuan 备份缺少聊天列表');
  root._exportVersion=header.exportVersion||'3.0';root._exportTimestamp=header.exportTimestamp;
  return root;
 }
}
function toYuan(value){
 const root=unpack(JSON.parse(JSON.stringify(value))),rows=[],add=x=>rows.push(JSON.stringify(x));let messages=0,items=0;
 const keys=Object.keys(root).filter(k=>!['_exportVersion','_exportTimestamp'].includes(k));
 add({type:'header',format:'ovo-stream-backup',formatRevision:1,exportVersion:'3.0',exportTimestamp:Date.now(),partial:false,exportTables:null,dataKeys:keys});
 for(const key of keys){const v=root[key];
  if(Array.isArray(v)){
   add({type:'array-start',key});
   v.forEach((item,index)=>{
    if(['characters','groups'].includes(key)){
     const {history=[],...rest}=item;add({type:'chat-start',key,chatIndex:index,value:rest});items++;
     for(let i=0;i<history.length;i+=50){const chunk=history.slice(i,i+50);add({type:'chat-history',key,chatIndex:index,value:chunk});messages+=chunk.length;}
     add({type:'chat-end',key,chatIndex:index});
    }else{add({type:'array-item',key,index,value:item});items++;}
   });add({type:'array-end',key});
  }else if(v&&typeof v==='object'){
   add({type:'object-start',key});for(const [property,val] of Object.entries(v)){add({type:'object-entry',key,property,value:val});items++;}add({type:'object-end',key});
  }else{add({type:'value',key,value:v});items++;}
 }
 add({type:'footer',recordCount:rows.length,processedItems:items,processedMessages:messages,completed:true});return rows.join('\n');
}

window.UwUBackupCodec={packJSON,unpack,digest,FORMAT,parseText,toYuan};
})();
