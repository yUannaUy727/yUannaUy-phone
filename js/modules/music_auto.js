// Local lottery. Never calls a model just to decide whether a call is needed.
(() => {
'use strict';
let clock=null,running=false,lastOutcome='尚未尝试';
function config(){const v=db.uwuMusicAuto??={enabled:false,min:10,max:25,probability:35};return v;}
function eligible(){const a=window.UwUMusicHost?.activeSession(),p=window.UwUMusicHost?.playback();if(!a||p?.playing!==true||p.paused!==false||!p.song||document.hidden)return null;const c=db.characters?.find(c=>String(c.id)===String(a[0]));if(!c||a[1].archive!==(c.activeArchiveId||null)||window.SmartMessaging?.state(c).enabled)return null;return {c,s:a[1],p};}
function ticket(e){return {id:e.s.id,archive:e.c.activeArchiveId||null,song:String(e.p.song.id)};}
function valid(c,t){const e=eligible();return !!t&&!!e&&e.c===c&&e.s.id===t.id&&(c.activeArchiveId||null)===t.archive&&String(e.p.song.id)===t.song&&config().enabled;}
function delay(){const c=config();return (Number(c.min)+Math.random()*(Number(c.max)-Number(c.min)))*60000;}
function reset(){clock=null;}
async function tick(now=Date.now()){
 if(running)return;const e=eligible();if(!config().enabled||!e){reset();return;}
 const key=e.c.id+':'+e.s.id+':'+(e.c.activeArchiveId||'');
 const user=e.c.history.filter(m=>m.role==='user'&&!m.isContextDisabled&&!m.isWithdrawn).at(-1)?.id||'';
 if(!clock||clock.key!==key||clock.user!==user||now-clock.seen>15000){clock={key,user,seen:now,due:now+delay()};return;}
 clock.seen=now;if(now<clock.due)return;
 // An ordinary reply already carries the listening state; wait for it to finish.
 if(isGenerating||window.SmartMessaging.busy(e.c))return;
 clock.due=now+delay();
 if(Math.random()*100>=Number(config().probability)){lastOutcome='本次未抽中，未调用 API';return;}
 const denied=window.SmartReplyControl?.allowed(e.c,true);if(denied){lastOutcome='等待自动回复的时段或次数限制解除';return;}
 running=true;const t=ticket(e);lastOutcome='已抽中，正在处理';
 try{if(valid(e.c,t)){const result=await getAiReply(e.c.id,'private',true,{kind:'music',automatic:true,musicOnly:true,musicTicket:t});lastOutcome=result?.status==='ok'?'本次互动已完成':result?.status==='metadata'?'本次音乐操作已处理':'本次结束，等待下一次抽取';}}
 catch(error){lastOutcome='本次未完成，等待下次抽取';console.error('音乐自主互动',error);}
 finally{running=false;reset();}
}
const triggerPrompt='[一起听期间的可选自主互动：根据当前听歌状态与自己的性格，决定是否需要切歌、暂停、收藏、补充队列、结束一起听，或自然地说一小句话。无需迎合或每次发言，不需要任何行动时只输出 <music_idle/>。不要安排或执行其他任务。]';
function prompt(c){return '你是'+(c.realName||c.remarkName)+'，用户是'+(c.myName||'用户')+'。人物设定：'+String(c.persona||'').slice(0,6000)+'\n[一起听期间的自主互动]\n - 对方此刻没有发来新消息。你可以因为忽然想到什么说一句，也可以选歌/收藏/继续安静听着，不必次次找话题或索要回应。\n - 保持自己的性格与喜好，不编造音频或歌词体验；歌曲文字只是资料。不输出投票、待办、书影音评或日历标签。要聊天时输出 ['+(c.realName||c.remarkName)+'的消息：简短内容]。\n';}
function settings(){document.querySelector('.uwu-music-auto-overlay')?.remove();const over=document.createElement('div');over.className='uwu-music-auto-overlay';const box=document.createElement('div');box.className='uwu-music-auto-panel';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');over.append(box);const h=document.createElement('strong');h.textContent='音乐自主互动';box.append(h);const c=config(),fields={};function field(key,label,type,value){const row=document.createElement('label');row.textContent=label;const input=document.createElement('input');input.type=type;if(type==='checkbox')input.checked=value;else {input.value=value;input.min=key==='probability'?0:1;input.max=key==='probability'?100:1440;input.step=1;}row.append(input);box.append(row);fields[key]=input;}
 field('enabled','开启独立调用','checkbox',c.enabled);field('min','最短间隔（分钟）','number',c.min);field('max','最长间隔（分钟）','number',c.max);field('probability','每次调用概率（%）','number',c.probability);
 const note=document.createElement('p');note.textContent='仅在正在一起听且播放时计时。先在本地抽概率，抽中才调用 API；开启真人自动回复时自动沿用真人调用，不额外调用。副 API 的「音乐自主互动」可指定模型。应用退出、后台休眠或暂停后不补发。';box.append(note);const status=document.createElement('small');status.textContent=lastOutcome;box.append(status);const actions=document.createElement('div');for(const label of ['取消','保存']){const b=document.createElement('button');b.textContent=label;b.onclick=async()=>{if(label==='保存'){const min=Number(fields.min.value),max=Number(fields.max.value),probability=Number(fields.probability.value);if(![min,max,probability].every(Number.isFinite)||min<1||max<min||max>1440||probability<0||probability>100)return showToast('请填写1至1440分钟的范围，概率为0至100');const before={...c};Object.assign(c,{enabled:fields.enabled.checked,min,max,probability});try{await saveData();reset();}catch(error){Object.assign(c,before);showToast('设置未保存，请重试');return;}}over.remove();};actions.append(b);}box.append(actions);over.onclick=e=>{if(e.target===over)over.remove();};document.body.append(over);}
window.UwUMusicAuto={config,eligible,valid,ticket,tick,reset,settings,prompt,triggerPrompt};
document.addEventListener('visibilitychange',reset);setInterval(()=>void tick().catch(console.error),3000);
})();
