// Independent manuscripts: no chat-history writes, normal-chat prompts or memory indexing.
(() => {
'use strict';
const jobs=new Map();let saveQueue=Promise.resolve();
const clone=v=>JSON.parse(JSON.stringify(v)),id=()=> 'ss_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
const defaults={contextPages:6,charPerson:'第三人称',userPerson:'第二人称',minWords:'',maxWords:'',wordMode:'range',referenceMemory:false,memoryMode:'all',memoryCount:10,summaryEnabled:true,autoSummary:false,summaryInterval:10};
const readerDefaults={font:'serif',size:18,line:1.9,letter:0,paragraph:1.2,margin:24,indent:false,align:'left',background:'#faf9f5',color:'#303238',image:'',imageOpacity:.18,imagePosition:'center',customFont:null};
const PROMPT=`[独立短打创作]
根据提供的资料与本次指令，创作一篇独立的短打小说；续写时承接本篇已有内容。

[资料读取]
请先阅读并理解以下标签内的资料：
<char_persona>：char的人设。
<user_persona>：user的人设。
<worldbook>：本篇绑定的世界书。
<writing_style>：本篇绑定的文风。
<story_instruction>：本次创作或续写指令。
<reference_memory>：选择参考时提供的收藏记忆。
<story_summary>：本篇已有总结。
<story_context>：本篇提供的前文。

未提供或为空的资料不假装已知；未指定的故事细节可以合理创作。

[人物与创作要求]
 - 理解双方人设中的性格、语气、动机与行为逻辑，并落实到人物言行。
 - 本次指令可以调整双方关系、社会身份、背景与人物变化；明确改动按指令执行，其余沿用所提供的设定。
 - 叙述方式、描写、节奏和语言遵循所选文风；本次指令明确提出的具体要求优先，未指定的部分沿用文风与设定。
 - 根据故事需要描写双方人物，不替人物强加缺少依据的反应。情节与人物变化保持合理衔接。
 - 参考记忆仅在提供时使用，与本篇明确改设冲突的内容不直接套用。本篇故事独立于主线。

[描写人称]
 - char与user分别使用本次设置的第一、第二或第三人称。
 - 人物对话中的人称按说话者与交谈对象正常使用，不受叙述人称限制。
 - 双方都使用第一人称时，切换视角须明确区分，避免两个“我”混淆。

[篇幅]
 - 设置了目标字数范围时，以该范围作为本次生成的篇幅要求。
 - 设置了“不少于”字数时，以该字数作为下限，不设字数上限。
 - 未设置字数要求时，遵循本次指令中的字数要求。
 - 两者均未指定时，根据内容自然安排篇幅。
 - 字数要求针对本次生成，不将已有正文计入。不用重复内容凑字数。

[输出]
 - 首次输出标题和正文，续写不重复标题。
 - 使用普通文字和正常标点，段落间空一行，不加格式标记、代码块或字面的换行转义符。
 - 只输出作品，不附分析、解释或字数汇报。

[续写]
 - 依据本篇提供的最新正文、总结和新指令继续创作，承接已发生事件、人物状态与未完情节。
 - 新指令明确要求改变走向、跳转时间或切换场景时，按要求推进；否则自然接续，不重新开篇或大段复述前文。
 - 总结只作为前文参考，不直接复述为正文。不强制每次生成都收尾，也不固定制造悬念。`;
function state(){const s=db.uwuShortStories??={version:1,documents:[],categories:[]};s.drafts??=[];s.presets??=[];return s;}
function styles(){return db.uwuWritingStyles??=[];}
function changed(){window.dispatchEvent(new CustomEvent('uwu-stories-change'));}
function persist(key='uwuShortStories'){
 const owner=db,value=clone(db[key]);
 const task=saveQueue.catch(()=>{}).then(async()=>{
  if(db!==owner||db[key]===undefined)throw Error('数据已切换，未覆盖新数据');
  if(typeof dexieDB!=='undefined'&&dexieDB?.globalSettings)await dexieDB.globalSettings.put({key,value});else await saveData();
 });saveQueue=task;return task;
}
function get(docId){return state().documents.find(d=>d.id===docId);}
function check(doc){if(get(doc.id)!==doc)throw Error('文稿已删除或数据已替换');}
function event(doc){doc.updatedAt=Date.now();changed();}
function validateSettings(raw){
 const x={...defaults,...raw};if(!['all','recent'].includes(x.memoryMode))throw Error('请选择有效的收藏日记读取方式');if(x.referenceMemory&&x.memoryMode==='recent'&&(!Number.isSafeInteger(Number(x.memoryCount))||Number(x.memoryCount)<1))throw Error('最近日记条数须为正整数');if(Number.isSafeInteger(Number(x.memoryCount))&&Number(x.memoryCount)>0)x.memoryCount=Number(x.memoryCount);x.wordMode=raw?.wordMode||(x.minWords!==''&&x.maxWords===''?'minimum':'range');if(!['range','minimum'].includes(x.wordMode))throw Error('请选择有效字数要求');if(x.wordMode==='minimum')x.maxWords='';for(const k of ['charPerson','userPerson'])if(!['第一人称','第二人称','第三人称'].includes(x[k]))throw Error('请选择有效描写人称');
 for(const k of ['minWords','maxWords']){if(x[k]===null||x[k]===undefined)x[k]='';if(x[k]!==''&&(!Number.isSafeInteger(Number(x[k]))||Number(x[k])<1||Number(x[k])>100000))throw Error('目标字数须为1至100000的整数或留空');if(x[k]!=='')x[k]=Number(x[k]);}
 if(x.minWords!==''&&x.maxWords!==''&&x.minWords>x.maxWords)throw Error('最少字数不能超过最多字数');
 if(!Number.isSafeInteger(Number(x.contextPages))||Number(x.contextPages)<1||Number(x.contextPages)>500)throw Error('上下文读取页数须为1至500');
 if(!Number.isSafeInteger(Number(x.summaryInterval))||Number(x.summaryInterval)<1||Number(x.summaryInterval)>500)throw Error('总结间隔须为1至500页');
 x.contextPages=Number(x.contextPages);x.summaryInterval=Number(x.summaryInterval);return x;
}
function sourceRows(ids,rows){return [...new Set(ids||[])].map(id=>rows.find(r=>r.id===id&&r.type!=='folder')).filter(Boolean).map(r=>({id:r.id,name:r.name,content:String(r.content||'')}));}
function memories(chat){
 const rows=window.JournalAutomation?.favorites?window.JournalAutomation.favorites(chat):(chat.memoryJournals||[]).filter(j=>j.isFavorited&&!j.needsUpdate);
 return rows.map(j=>({id:j.id,title:j.title||'',content:String(j.content||''),createdAt:Number(j.createdAt)||0})).sort((a,b)=>a.createdAt-b.createdAt);
}
function selectedMemories(doc,settings){const rows=doc.referenceMemory||[];return settings.memoryMode==='recent'?rows.slice(-settings.memoryCount):rows;}
function draft(chat,options){
 if(!(db.characters||[]).includes(chat))throw Error('请选择当前单人聊天角色');
 const settings=validateSettings(options.settings),s=state(),doc={id:id(),charId:chat.id,charName:chat.realName||chat.name||chat.remarkName||'角色',userName:chat.myName||'你',senderName:chat.remarkName||chat.realName||chat.name||'角色',persona:String(chat.persona||''),userPersona:String(chat.myPersona||''),title:String(options.title||'未命名文稿').slice(0,120),categoryId:s.categories.some(c=>c.id===options.categoryId&&c.charId===chat.id)?options.categoryId:null,settings,worldbooks:sourceRows(options.worldBookIds,db.worldBooks||[]),writingStyles:sourceRows(options.styleIds,styles()),summaryWorldbooks:sourceRows(options.summaryWorldBookIds,db.worldBooks||[]),tavernData:clone(chat.tavernData||{}),referenceMemory:settings.referenceMemory?memories(chat):[],pages:[],summaries:[],reader:{...readerDefaults},readPosition:{page:0,scroll:0},createdAt:Date.now(),updatedAt:Date.now(),notice:null,job:null};
 return doc;
}
async function create(chat,options){const doc=draft(chat,options),s=state();
 s.documents.push(doc);try{await persist();}catch(e){s.documents=s.documents.filter(d=>d!==doc);throw e;}changed();return doc;
}
// Creation drafts and binding combinations live beside manuscripts, never in chat history.
async function saveDraft(charId,data,oldId=null){
 if(!(db.characters||[]).some(c=>c.id===charId))throw Error('角色已不存在');
 const list=state().drafts,old=list.find(d=>d.id===oldId&&d.charId===charId),before=old?clone(old):null;
 const value={title:String(data.title||''),categoryId:data.categoryId||null,settings:clone(data.settings||defaults),worldBookIds:[...new Set(data.worldBookIds||[])],styleIds:[...new Set(data.styleIds||[])],summaryWorldBookIds:[...new Set(data.summaryWorldBookIds||[])],instruction:String(data.instruction||''),presetId:data.presetId||'',ui:clone(data.ui||{}),updatedAt:Date.now()};
 let row=old;if(row)Object.assign(row,value);else list.push(row={id:id(),charId,createdAt:Date.now(),...value});
 try{await persist();}catch(e){if(before)Object.assign(row,before);else list.splice(list.indexOf(row),1);throw e;}changed();return row;
}
async function removeDraft(draftId){const list=state().drafts,at=list.findIndex(d=>d.id===draftId);if(at<0)return;const [row]=list.splice(at,1);try{await persist();}catch(e){list.splice(at,0,row);throw e;}changed();}
function presetConfig(preset){return clone(preset.config||{worldBookIds:preset.worldBookIds||[],styleIds:preset.styleIds||[]});}
async function savePreset(name,config,stylesOrId=[],oldId=null){
 name=String(name||'').trim();if(!name)throw Error('请填写预设名称');const legacy=Array.isArray(config),presetId=legacy?oldId:typeof stylesOrId==='string'?stylesOrId:oldId;
 const value={name,worldBookIds:[...new Set((legacy?config:config.worldBookIds)||[])],styleIds:[...new Set((legacy?stylesOrId:config.styleIds)||[])],updatedAt:Date.now()};
 if(!legacy){value.config={};for(const key of ['title','categoryId','categoryName','charId','settings','worldBookIds','styleIds','summaryWorldBookIds'])if(config[key]!==undefined)value.config[key]=clone(config[key]);value.version=2;}
 const list=state().presets,old=list.find(p=>p.id===presetId),before=old?clone(old):null;let row=old;if(row)Object.assign(row,value);else list.push(row={id:id(),...value});
 try{await persist();}catch(e){if(before)Object.assign(row,before);else list.splice(list.indexOf(row),1);throw e;}changed();return row;
}

async function removePreset(presetId){const list=state().presets,at=list.findIndex(p=>p.id===presetId);if(at<0)return;const [row]=list.splice(at,1);try{await persist();}catch(e){list.splice(at,0,row);throw e;}changed();}
function escapeData(text){return String(text||'').replace(/</g,'＜').replace(/>/g,'＞');}
const tag=(name,text)=>`<${name}>\n${escapeData(text)}\n</${name}>`;
function substitutions(doc,text){return String(text||'').replace(/\{\{char\}\}/g,doc.charName).replace(/\{\{user\}\}/g,doc.userName);}
function fingerprint(p){let h=2166136261;const s=p.role+'\n'+p.content;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return String(h>>>0);}
function validSummary(doc,s){return !!s&&!s.stale&&s.sources.every(x=>doc.pages.some(p=>p.id===x.id&&fingerprint(p)===x.hash));}
function latestSummary(doc){return [...doc.summaries].reverse().find(s=>validSummary(doc,s));}
function prepare(doc,instruction,settings=doc.settings,excludeIds=[]){
 settings=validateSettings(settings);const summary=settings.summaryEnabled?latestSummary(doc):null,covered=new Set(summary?.sources.map(x=>x.id)||[]);
 const pages=doc.pages.filter(p=>!excludeIds.includes(p.id)&&!['failed','generating'].includes(p.status)&&p.content?.trim()&&!covered.has(p.id)).slice(-settings.contextPages);
 const sections=[['内置规则',PROMPT],['人物',tag('char_persona',doc.charName+'\n'+doc.persona)+'\n'+tag('user_persona',doc.userName+'\n'+doc.userPersona)],['世界书',tag('worldbook',doc.worldbooks.map(w=>w.name+'\n'+substitutions(doc,w.content)).join('\n\n'))],['文风',tag('writing_style',doc.writingStyles.map(w=>w.name+'\n'+substitutions(doc,w.content)).join('\n\n'))],['本次指令',tag('story_instruction',substitutions(doc,instruction))],['记忆',settings.referenceMemory?tag('reference_memory',selectedMemories(doc,settings).map(m=>(m.title||'')+'\n'+m.content).join('\n\n')):''],['总结',summary?tag('story_summary',summary.content):''],['最近前文',tag('story_context',pages.map(p=>`第${doc.pages.indexOf(p)+1}页 · ${p.role==='user'?'创作指令':'正文'}\n${p.content}`).join('\n\n'))],['生成设置',`char描写：${settings.charPerson}；user描写：${settings.userPerson}。\n${settings.wordMode==='minimum'&&settings.minWords!==''?`本次篇幅：不少于${settings.minWords}字，不设字数上限。`:settings.minWords!==''||settings.maxWords!==''?`本次目标字数：${settings.minWords!==''?'至少'+settings.minWords+'字':''}${settings.minWords!==''&&settings.maxWords!==''?'，':''}${settings.maxWords!==''?'至多'+settings.maxWords+'字':''}。`:'未设置字数范围，按本次指令中的字数要求；指令也未指定时自然安排。'}\n${doc.pages.some(p=>p.role==='assistant'&&!excludeIds.includes(p.id)&&p.content)?'本次为续写，不重复作品标题。':'本次为首次创作，第一行单独输出作品标题，空一行后输出正文。'}`]];
 const token=text=>typeof countTextTokens==='function'?countTextTokens(text):Math.ceil(text.length*.9);
 let messages=[{role:'system',content:sections[0][1]},{role:'user',content:sections.slice(1).map(x=>x[1]).filter(Boolean).join('\n\n')}];
 const breakdown=sections.map(([name,text])=>({name,tokens:token(text)}));
 return {messages,breakdown,tokens:messages.reduce((n,m)=>n+token(m.content)+4,0),pageIds:pages.map(p=>p.id),summaryId:summary?.id||null};
}
function apiConfig(){
 const config=resolveAuxiliaryApiConfig('shortStories'),label=config.isSecondaryApi?'副API':'主API';
 if(!['url','key','model'].every(k=>String(config[k]||'').trim()))throw Error('请先在API设置中完整配置'+label);
 if((typeof BLOCKED_API_DOMAINS!=='undefined'?BLOCKED_API_DOMAINS:[]).some(d=>config.url.includes(d)))throw Error('此API地址不可使用');
 return {...config,streamEnabled:true};
}
function outputParts(data,provider,stream){
 if(provider==='gemini'){const cand=data.candidates?.[0];return {text:(cand?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join(''),finish:cand?.finishReason,usage:data.usageMetadata};}
 const c=data.choices?.[0];return {text:(stream?c?.delta?.content:c?.message?.content)||'',finish:c?.finish_reason,usage:data.usage};
}
async function request(messages,signal,onText=()=>{}){
 const config=apiConfig(),q=buildChatApiRequest(config,messages,{temperature:config.temperatureEnabled?Number(config.temperature):undefined});if(config.provider==='gemini'){q.endpoint=q.endpoint.replace(':generateContent',':streamGenerateContent');q.endpoint+=(q.endpoint.includes('?')?'&':'?')+'alt=sse';}else q.requestBody.stream=true;
 const r=await fetch(q.endpoint,{method:'POST',headers:q.headers,body:JSON.stringify(q.requestBody),signal});
 if(!r.ok){let detail=await r.text();if(config.key)detail=detail.split(config.key).join('[隐藏]');throw Error('API返回 '+r.status+'：'+detail.slice(0,600));}
 let text='',finish=null,usage=null,ended=false,streamed=false;const accept=(data,stream)=>{if(data.error)throw Error(String(data.error.message||'API返回错误'));const o=outputParts(data,config.provider,stream);if(typeof o.text!=='string')throw Error('API正文格式不支持');text+=o.text;if(o.finish)finish=o.finish;if(o.usage)usage=o.usage;if(o.text)onText(text);};
 if((r.headers.get('content-type')||'').includes('text/event-stream')){
  streamed=true;const reader=r.body.getReader(),decoder=new TextDecoder();let buffer='',payload=[];
  const consume=line=>{if(line===''){if(payload.length){const raw=payload.join('\n');payload=[];if(raw==='[DONE]')ended=true;else accept(JSON.parse(raw),true);}return;}if(line.startsWith('data:'))payload.push(line.slice(5).trimStart());};
  try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let at;while((at=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,at).replace(/\r$/,''));buffer=buffer.slice(at+1);}}buffer+=decoder.decode();if(buffer)consume(buffer.replace(/\r$/,''));consume('');}finally{reader.releaseLock();}
 }else{const data=await r.json();if(Array.isArray(data)){for(const x of data)accept(x,false);}else accept(data,false);}
 if(signal.aborted)throw Error('生成已停止');const filtered=/SAFETY|RECITATION|BLOCKLIST|PROHIBITED|content_filter/i.test(finish||'');
 if(!text.trim())throw Error(filtered?'接口返回内容过滤（'+finish+'），没有收到正文。可修改指令后重试。':'API没有返回正文');
 const incomplete=streamed&&!finish&&!ended;return {text,finish,usage,incomplete,filtered,truncated:filtered||incomplete||/length|MAX_TOKENS/i.test(finish||'')};
}
function parseFirst(text){const lines=String(text).replace(/^\uFEFF/,'').trim().split(/\r?\n/),line=lines[0].replace(/^#{1,6}\s*/, '').trim();if(lines.length>1&&line.length>0&&line.length<=100)return {title:line.replace(/^《|》$/g,''),body:lines.slice(1).join('\n').replace(/^\s*\n/,'')};return {title:null,body:text.trim()};}
async function generate(doc,instruction,settings=doc.settings,retry=false){
 check(doc);if(jobs.has(doc.id))throw Error('本篇正在生成，请稍候');if(!String(instruction||'').trim())throw Error('请填写创作或续写指令');apiConfig();const originalStore=state();
 settings=validateSettings(settings);let user,answer;
 if(retry&&doc.job?.userId&&doc.job?.targetId){user=doc.pages.find(p=>p.id===doc.job.userId);answer=doc.pages.find(p=>p.id===doc.job.targetId);if(!user||!answer)throw Error('原任务记录不完整');instruction=user.content;}else{user={id:id(),role:'user',content:String(instruction),createdAt:Date.now(),status:'complete'};answer={id:id(),role:'assistant',content:'',createdAt:Date.now(),status:'generating'};doc.pages.push(user,answer);}
 const prior={settings:doc.settings,job:doc.job,answer:clone(answer)};doc.settings=settings;answer.status='generating';answer.content='';
 const firstResponse=!doc.pages.some(p=>p!==answer&&p.role==='assistant'&&p.content),prepared=prepare(doc,instruction,settings,[user.id,answer.id]),job={id:id(),kind:'story',status:'running',userId:user.id,targetId:answer.id,instruction:String(instruction),startedAt:Date.now(),error:'',tokens:prepared.tokens},controller=new AbortController();doc.job=job;jobs.set(doc.id,controller);event(doc);
 try{await persist();}catch(e){jobs.delete(doc.id);if(!retry)doc.pages=doc.pages.filter(p=>p!==user&&p!==answer);else Object.assign(answer,prior.answer);doc.settings=prior.settings;doc.job=prior.job;changed();throw e;}
 let lastSave=Date.now();const valid=()=>state()===originalStore&&get(doc.id)===doc&&doc.job===job;
 try{
  const result=await request(prepared.messages,controller.signal,text=>{if(!valid()){controller.abort();return;}if(firstResponse){const parsed=parseFirst(text);if(parsed.title&&parsed.body.trim()){doc.title=parsed.title;answer.generatedTitle=parsed.title;answer.content=parsed.body;}else answer.content=text;}else answer.content=text;changed();if(Date.now()-lastSave>4000){lastSave=Date.now();void persist().catch(()=>{});}});
  if(!valid())return;
  if(firstResponse){const parsed=parseFirst(result.text);if(parsed.title){doc.title=parsed.title;answer.generatedTitle=parsed.title;}answer.content=parsed.body;}else answer.content=result.text.trim();
  if(!answer.content.trim())throw Error('API只返回了标题，没有正文，请重试');
  answer.status=result.truncated?'partial':'complete';answer.updatedAt=Date.now();job.status=result.truncated?'partial':'complete';job.usage=result.usage;job.error=result.filtered?'接口返回内容过滤（'+result.finish+'），已保留收到的正文。可在续写中修改指令后继续。':result.incomplete?'输出流未正常结束，已保留收到的正文，可继续续写。':result.truncated?'输出达到接口上限，已保留正文，可继续续写。':'';doc.notice={id:id(),pageId:answer.id,status:'pending'};event(doc);
  try{await persist();}catch(e){job.status='save_failed';job.error='正文已生成但保存失败，请重试保存';changed();return;}
  window.dispatchEvent(new CustomEvent('uwu-story-ready',{detail:{id:doc.id,noticeId:doc.notice.id}}));
 }catch(e){if(valid()){
  const hasText=!!answer.content.trim();answer.status=hasText?'partial':'failed';job.status=controller.signal.aborted?'stopped':'failed';job.error=String(e.message).slice(0,700);
  if(hasText)doc.notice={id:id(),pageId:answer.id,status:'pending'};
  event(doc);try{await persist();if(hasText)window.dispatchEvent(new CustomEvent('uwu-story-ready',{detail:{id:doc.id,noticeId:doc.notice.id}}));}catch(saveError){job.status='save_failed';job.error='保存失败，请重试保存';}
 }}
 finally{if(jobs.get(doc.id)===controller)jobs.delete(doc.id);changed();}
 if(valid()&&job.status==='complete'&&doc.settings.autoSummary&&needsSummary(doc))void summarize(doc).catch(e=>{doc.summaryError=e.message;changed();});
}
function needsSummary(doc){const last=latestSummary(doc),covered=new Set(last?.sources.map(x=>x.id)||[]);return doc.pages.filter(p=>p.status==='complete'&&!covered.has(p.id)).length>=doc.settings.summaryInterval;}
async function summarize(doc){
 check(doc);if(jobs.has(doc.id))throw Error('本篇正在生成，请稍候');apiConfig();const controller=new AbortController(),owner=state(),pages=doc.pages.filter(p=>p.content&&['complete','partial'].includes(p.status));if(!pages.length)throw Error('本篇还没有可总结内容');
 const old=latestSummary(doc),covered=new Set(old?.sources.map(x=>x.id)||[]),fresh=pages.filter(p=>!covered.has(p.id));if(!fresh.length&&old)return old;
 const input=[tag('summary_worldbook',(doc.summaryWorldbooks||[]).map(w=>w.name+'\n'+substitutions(doc,w.content)).join('\n\n')),old?tag('previous_summary',old.content):'',tag('manuscript_pages',fresh.map(p=>`第${doc.pages.indexOf(p)+1}页 · ${p.role==='user'?'创作要求':'正文'}\n${p.content}`).join('\n\n'))].filter(Boolean).join('\n\n');
 const hashes=pages.map(p=>({id:p.id,hash:fingerprint(p)}));jobs.set(doc.id,controller);doc.summaryStatus='running';doc.summaryError='';changed();
 try{const result=await request([{role:'system',content:'你是独立短打的记忆整理者。只根据提供的本篇正文、创作要求和已有总结，生成用于后续续写的合并总结。保留人物身份与关系、时间线、已发生事件、状态变化、伏笔及未完线索。创作要求未在正文发生的内容须明确区分。不要续写、评价或引入主线聊天；旧总结与新正文冲突时以新正文为准。总结规范在summary_worldbook标签中提供时按其要求整理。直接输出总结，不附解释。'},{role:'user',content:input}],controller.signal);
  if(state()!==owner||get(doc.id)!==doc)throw Error('文稿已切换或删除');if(result.filtered)throw Error('接口返回内容过滤，旧总结保留');if(result.truncated)throw Error('总结输出被截断，旧总结保留');if(!hashes.every(h=>doc.pages.some(p=>p.id===h.id&&fingerprint(p)===h.hash)))throw Error('总结期间正文已修改，请重新总结');
  const summary={id:id(),content:result.text.trim(),sources:hashes,through:Math.max(...pages.map(p=>doc.pages.indexOf(p)+1)),createdAt:Date.now(),stale:false},prior=doc.summaries.slice();doc.summaries=[...doc.summaries,summary].slice(-20);doc.summaryStatus='complete';
  try{await persist();}catch(e){doc.summaries=prior;throw e;}changed();return summary;
 }catch(e){if(get(doc.id)===doc){doc.summaryStatus='failed';doc.summaryError=String(e.message);await persist().catch(()=>{});}throw e;}finally{if(jobs.get(doc.id)===controller)jobs.delete(doc.id);changed();}
}
async function editPage(doc,pageId,text){check(doc);if(jobs.has(doc.id))throw Error('请先停止本篇生成再编辑');const p=doc.pages.find(p=>p.id===pageId);if(!p)throw Error('楼层不存在');if(!text.trim())throw Error('正文不能为空');const before=clone(p),summaries=clone(doc.summaries),covered=doc.summaries.some(s=>s.sources.some(h=>h.id===p.id));if(p.content===text)return false;p.content=text;p.status='complete';p.updatedAt=Date.now();for(const s of doc.summaries)if(s.sources.some(h=>h.id===p.id))s.stale=true;event(doc);try{await persist();}catch(e){Object.assign(p,before);doc.summaries=summaries;throw e;}return covered&&doc.settings.autoSummary;}
async function editSummary(doc,text){check(doc);if(jobs.has(doc.id))throw Error('请先等待本篇生成完成');const s=doc.summaries.at(-1);if(!s)throw Error('还没有总结');const before=clone(s);s.content=text;s.sources=s.sources.map(h=>{const p=doc.pages.find(p=>p.id===h.id);return p?{id:p.id,hash:fingerprint(p)}:h;});s.stale=false;try{await persist();}catch(e){Object.assign(s,before);throw e;}changed();}
async function configure(doc,options){check(doc);if(jobs.has(doc.id))throw Error('请先等待本篇生成完成');const old={settings:doc.settings,worldbooks:doc.worldbooks,writingStyles:doc.writingStyles,summaryWorldbooks:doc.summaryWorldbooks,referenceMemory:doc.referenceMemory};doc.settings=validateSettings(options.settings);if(options.worldBookIds)doc.worldbooks=sourceRows(options.worldBookIds,db.worldBooks||[]);if(options.styleIds)doc.writingStyles=sourceRows(options.styleIds,styles());if(options.summaryWorldBookIds)doc.summaryWorldbooks=sourceRows(options.summaryWorldBookIds,db.worldBooks||[]);if(doc.settings.referenceMemory&&!old.settings.referenceMemory){const chat=(db.characters||[]).find(c=>c.id===doc.charId);doc.referenceMemory=chat?memories(chat):[];}event(doc);try{await persist();}catch(e){Object.assign(doc,old);throw e;}}
async function category(charId,name,parentId=null,oldId=null){name=String(name||'').trim();if(!name)throw Error('请填写分类名称');const s=state();if(parentId&&!s.categories.some(c=>c.id===parentId&&c.charId===charId))throw Error('分类不存在');let row=s.categories.find(c=>c.id===oldId&&c.charId===charId);const before=row?clone(row):null;if(row)row.name=name;else{s.categories.push(row={id:id(),charId,name,parentId});}try{await persist();}catch(e){if(before)Object.assign(row,before);else s.categories=s.categories.filter(c=>c!==row);throw e;}changed();return row;}
async function deleteCategory(charId,categoryId){const s=state(),old=clone(s);s.categories=s.categories.filter(c=>!(c.charId===charId&&c.id===categoryId));for(const d of s.documents)if(d.charId===charId&&d.categoryId===categoryId)d.categoryId=null;try{await persist();}catch(e){Object.assign(s,old);throw e;}changed();}
async function remove(doc){check(doc);const s=state();jobs.get(doc.id)?.abort();jobs.delete(doc.id);const pos=s.documents.indexOf(doc);s.documents.splice(pos,1);try{await persist();}catch(e){s.documents.splice(pos,0,doc);throw e;}changed();}
function stop(doc){jobs.get(doc.id)?.abort();}
async function rename(doc,title){check(doc);const old=doc.title;doc.title=String(title||'').trim().slice(0,120);if(!doc.title){doc.title=old;throw Error('标题不能为空');}try{await persist();}catch(e){doc.title=old;throw e;}changed();}
async function move(doc,categoryId){check(doc);if(categoryId&&!state().categories.some(c=>c.id===categoryId&&c.charId===doc.charId))throw Error('分类不存在');const old=doc.categoryId;doc.categoryId=categoryId;try{await persist();}catch(e){doc.categoryId=old;throw e;}changed();}
async function saveReader(doc,reader){check(doc);const old=doc.reader;doc.reader={...readerDefaults,...reader};try{await persist();}catch(e){doc.reader=old;throw e;}changed();}
async function acknowledge(doc,status,noticeId){check(doc);const notice=doc.notice;if(!notice||noticeId&&notice.id!==noticeId)return;const old=notice.status;notice.status=status;try{await persist();}catch(e){notice.status=old;throw e;}changed();}
async function retrySave(doc){check(doc);await persist();if(doc.job?.status==='save_failed'){doc.job.status=doc.pages.find(p=>p.id===doc.job.targetId)?.content?'complete':'failed';await persist();if(doc.notice?.status==='pending')window.dispatchEvent(new CustomEvent('uwu-story-ready',{detail:{id:doc.id,noticeId:doc.notice.id}}));}changed();}
async function recover(){let dirty=false;for(const d of state().documents){if(d.job?.status==='running'){d.job.status='interrupted';d.job.error='页面退出或刷新中断了生成，已保留收到的内容，可手动重试';for(const p of d.pages)if(p.status==='generating')p.status=p.content?'partial':'failed';dirty=true;}if(d.summaryStatus==='running'){d.summaryStatus='failed';d.summaryError='总结已中断，旧总结保留';dirty=true;}}if(dirty)await persist();changed();}
window.UwUStories={state,styles,id,clone,defaults,readerDefaults,PROMPT,get,draft,create,saveDraft,removeDraft,savePreset,presetConfig,removePreset,prepare,generate,summarize,latestSummary,validSummary,editPage,editSummary,configure,category,deleteCategory,remove,stop,rename,move,saveReader,acknowledge,retrySave,persist,recover,busy:doc=>jobs.has(doc.id),validateSettings,parseFirst};
window.addEventListener('uwu-db-ready',()=>void recover().catch(e=>console.error('文稿恢复失败',e.message)));
window.addEventListener('pagehide',()=>{if(db.uwuShortStories)void persist().catch(()=>{});});
})();
