// 真人回复控制：日常窗口、输入节奏和费用限制均在本地执行。
(() => {
    const MINUTE=60000;
    const inputs=new Map();
    const clamp=(v,min,max,d)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):d;
    const clean=v=>typeof v==='string'?v.slice(0,120):'';
    const random=(a,b)=>a+Math.random()*Math.max(0,b-a);
    const smart=chat=>window.SmartMessaging.state(chat);
    const timeMinutes=v=>typeof v==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v)?Number(v.slice(0,2))*60+Number(v.slice(3)):null;
    function inHours(now=Date.now()) {
        const config=db.apiSettings?.smartReplyHours;
        if(!config?.enabled)return true;
        const start=timeMinutes(config.start),end=timeMinutes(config.end);
        if(start===null||end===null)return false;
        if(start===end)return true;
        const date=new Date(now),minute=date.getHours()*60+date.getMinutes();
        return start<end?minute>=start&&minute<end:minute>=start||minute<end;
    }
    function counter(chat,now=Date.now()) {
        const d=new Date(now),date=d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
        if(chat.smartAutoUsage?.date!==date)chat.smartAutoUsage={date,count:0};
        return chat.smartAutoUsage;
    }
    function budgetAvailable(chat) {
        const limit=Number(chat.smartAutoLimit)||0;
        return limit<=0||counter(chat).count<limit;
    }
    function allowed(chat,automaticSmart=true) {
        if(automaticSmart&&!inHours())return 'outside_hours';
        if(smart(chat).autoErrorPause)return 'api_error';
        if(!budgetAvailable(chat))return 'budget';
        return '';
    }
    async function reserve(chat,options,controller) {
        const reason=allowed(chat,options.automatic===true);
        if(reason)return reason;
        const usage=counter(chat);usage.count++;
        try { await saveData(); } catch(error){usage.count--;throw error;}
        if(controller.signal.aborted){usage.count--;await saveData();return 'stale';}
        markInterleave(chat,options);
        return '';
    }
    function normalizeDaily(v) {
        v=v&&typeof v==='object'?v:{};
        const min=clamp(v.min_minutes,1,720,45),max=clamp(v.max_minutes,min,1440,150);
        return {enabled:v.enabled!==false||!clean(v.pause_reason),min_minutes:min,max_minutes:max,
            probability:clamp(v.probability,0,1,.55),busy_probability:clamp(v.busy_probability,0,1,.3),
            pause_minutes:clamp(v.pause_minutes,0,10080,0),pause_reason:clean(v.pause_reason),
            wake_probability:clamp(v.wake_probability,0,1,.65),wake_min_minutes:clamp(v.wake_min_minutes,.1,120,3),
            wake_max_minutes:clamp(v.wake_max_minutes,.1,240,25)};
    }
    function normalizeDialogue(v) {
        v=v&&typeof v==='object'?v:{};
        return {mode:['immediate','waiting','casual','finished'].includes(v.mode)?v.mode:'casual',
            awaiting:clean(v.awaiting),can_interrupt_activity:v.can_interrupt_activity===true,
            reply_min_seconds:clamp(v.reply_min_seconds,2,3600,4),reply_max_seconds:clamp(v.reply_max_seconds,2,7200,12),
            wait_minutes:clamp(v.wait_minutes,.5,240,10),pause_reason:clean(v.pause_reason)};
    }
    const factors=chat=>({less:{time:1.6,chance:.45,aging:.5},normal:{time:1,chance:1,aging:1},more:{time:.65,chance:1.5,aging:1.5}}[smart(chat).level]);
    function policy(chat) {
        const s=smart(chat);
        if(!s.dailyPolicy && s.note)s.dailyPolicy=normalizeDaily(null);
        return s.dailyPolicy;
    }
    function limited(chat,now=Date.now()) {
        return smart(chat).events.some(e=>e.startAt<=now&&e.endAt>now&&!['paused','completed','cancelled','unknown'].includes(e.phase)&&e.availability==='limited');
    }
    function sampleChance(chat,now=Date.now()) {return limited(chat,now)?random(.45,.55):random(.70,.90);}
    function chanceSeed(){return {localChanceFree:random(.70,.90),localChanceBusy:random(.45,.55)};}
    function contactChance(chat,node,now=Date.now()) {
        if(!Number.isFinite(node.localChanceFree)||!Number.isFinite(node.localChanceBusy))Object.assign(node,chanceSeed());
        const s=smart(chat),age=Math.max(0,s.silenceMs||0);
        let chance=limited(chat,now)?node.localChanceBusy:node.localChanceFree;
        if(limited(chat,now)){if(age>=4*60*MINUTE)chance=Math.max(chance,.9);else if(age>=3*60*MINUTE)chance=Math.max(chance,.7);}
        else {if(age>=3*60*MINUTE)chance=1;else if(age>=2*60*MINUTE)chance=Math.max(chance,.9);}
        return chance;
    }
    function advanceSilence(chat,now=Date.now()) {
        const s=smart(chat),last=s.silenceCheckedAt;
        const paused=!!s.sleep&&now>=s.sleep.startsAt&&now<s.sleep.wakeAt || window.SmartMessaging.activityRemaining(chat,now)>0 || dailyPaused(chat,now) || !inHours(now);
        if(!Number.isFinite(s.silenceMs))s.silenceMs=0;
        if(last&&!paused&&!s.silencePaused)s.silenceMs+=Math.max(0,now-last);
        s.silenceCheckedAt=now;s.silencePaused=paused;
    }
    function scheduleDaily(chat,now=Date.now()) {
        const s=smart(chat),p=policy(chat);
        if(!p||!p.enabled)return;
        s.dailySerial=(s.dailySerial||0)+1;
        s.dailyWindow={id:'daily-'+s.dailySerial,dueAt:now+random(p.min_minutes,p.max_minutes)*factors(chat).time*MINUTE,
            decided:false,accepted:false,...chanceSeed(),archiveId:chat.activeArchiveId||null};
    }
    function updatePaper(chat,note,parts,now) {
        const s=smart(chat);
        if(note.daily && (!parts||parts.has('daily'))) {
            s.dailyPolicy=normalizeDaily(note.daily);
            s.dailyPauseUntil=s.dailyPolicy.pause_minutes>0?now+s.dailyPolicy.pause_minutes*MINUTE:0;
        } else if(!s.dailyPolicy)s.dailyPolicy=normalizeDaily(null);
        if(note.dialogue&&(!parts||parts.has('dialogue'))) {
            s.dialogue=normalizeDialogue(note.dialogue);
            s.dialogueUntil=now+s.dialogue.wait_minutes*MINUTE;
        } else if(!parts)s.dialogue={mode:'casual'};
    }
    function contacted(chat,now=Date.now()) {
        const s=smart(chat);s.lastContactAt=now;s.lastVisibleContactAt=now;s.silenceMs=0;s.silenceCheckedAt=now;s.dailyMisses=0;
        s.wakeWindow=null;s.backgroundTask=null;scheduleDaily(chat,now);
    }
    function onWake(chat,wakeAt,now=Date.now()) {
        const s=smart(chat),p=policy(chat);
        scheduleDaily(chat,now); // 旧窗口不补发，恢复日常线的新窗口。
        if(!p?.enabled)return;
        const min=p.wake_min_minutes,max=Math.max(min,p.wake_max_minutes);
        s.wakeWindow={id:'wake-'+wakeAt,dueAt:now+random(min,max)*MINUTE,
            expiresAt:now+Math.max(max,60)*MINUTE,probability:p.wake_probability,decided:false,accepted:false,
            kind:'routine',source:'wake',motive:'醒后自然联系',direction:'按人设决定问候、承接昨晚话题或分享醒后生活，不强制说早安'};
    }
    function dailyPaused(chat,now=Date.now()) {
        const s=smart(chat),p=policy(chat);
        if(!p)return true;
        if(!p.enabled && s.dailyPauseUntil && now>=s.dailyPauseUntil){p.enabled=true;s.dailyPauseUntil=0;scheduleDaily(chat,now);}
        return !p.enabled||now<(s.dailyPauseUntil||0);
    }
    function proactivePaused(chat,now=Date.now()){return !!policy(chat)?.pause_reason && dailyPaused(chat,now);}
    function immediate(chat,now=Date.now()) {
        const s=smart(chat);
        return ['immediate','waiting'].includes(s.dialogue?.mode)&&now<(s.dialogueUntil||0);
    }
    async function backgroundOpportunity(chat,now=Date.now()) {
        const s=smart(chat),p=policy(chat);
        const oldEnabled=p?.enabled;
        if(dailyPaused(chat,now)||immediate(chat,now))return null;
        if(s.dailyWindow&&s.dailyWindow.archiveId!==(chat.activeArchiveId||null)){scheduleDaily(chat,now);s.wakeWindow=null;s.backgroundTask=null;await saveData();}
        if(oldEnabled!==p.enabled)await saveData();
        if(!s.dailyWindow){scheduleDaily(chat,now);await saveData();}
        // 恢复页面不会将几个小时的窗口逐个补发。
        if(now-s.dailyWindow.dueAt>Math.max(p.max_minutes,60)*MINUTE){scheduleDaily(chat,now);await saveData();return null;}
        const candidates=[s.wakeWindow,s.dailyWindow].filter(Boolean).sort((a,b)=>a.dueAt-b.dueAt);
        for(const w of candidates) {
            if(w.expiresAt&&now>w.expiresAt){s.wakeWindow=null;await saveData();continue;}
            if(now<w.dueAt)continue;
            if(window.SmartMessaging.activityRemaining(chat,now)>0){const available=now+window.SmartMessaging.activityRemaining(chat,now);if(w.dueAt!==available){w.dueAt=available;await saveData();}continue;}
            // 具体日常计划优先，避免相近时刻重复分享；并不封锁整段忙碌时段。
            if(s.nodes.some(n=>n.kind==='routine'&&Math.abs(n.dueAt-now)<Math.min(p.min_minutes,15)*MINUTE))continue;
            if(!w.decided) {
                const chance=w.source==='wake'?w.probability:contactChance(chat,w,now);
                w.accepted=Math.random()<chance;w.decided=true;
                await saveData(); // 一次判断结果在请求前持久化。
            }
            if(!w.accepted) {
                if(w.source==='wake')s.wakeWindow=null;
                else {s.dailyMisses=(s.dailyMisses||0)+1;s.lastDecision='上一次机会未触发，已安排下一次（未调用 API）';scheduleDaily(chat,now);}
                await saveData();continue;
            }
            if(s.backgroundTask?.id===w.id)return s.backgroundTask;
            return s.backgroundTask={...w,kind:'routine',source:w.source||'daily',eventId:'',respectActivity:true,
                maxRounds:4,probability:1,expiresAt:w.expiresAt||now+60*MINUTE,
                userId:s.lastUserId||null,archiveId:chat.activeArchiveId||null,
                motive:w.motive||'按角色自己的日常联系节奏想起对方',
                direction:w.direction||'结合人设、生活事件和当前时间，自然分享或联系；不把预计外部事件当作已发生，不重复最近分享，不要求对方逐条回应'};
        }
        return null;
    }
    function consumedBackground(chat,node,now=Date.now()) {
        const s=smart(chat);
        if(node?.source==='wake')s.wakeWindow=null;
        if(node?.source==='daily')scheduleDaily(chat,now);
    }
    function inputState(chat){if(!inputs.has(chat.id))inputs.set(chat.id,{hasText:false,lastInputAt:0,lastSendAt:0,used:false,burst:0});return inputs.get(chat.id);}
    function activeTyping(chat,now=Date.now()){
        const i=inputState(chat);
        return i.hasText&&now-i.lastInputAt<12000;
    }
    function bindInput(el) {
        if(!el||el.dataset.smartTypingBound)return;
        el.dataset.smartTypingBound='true';
        const changed=()=>{
            if(typeof currentChatType==='undefined'||currentChatType!=='private')return;
            const chat=db.characters.find(c=>c.id===currentChatId);if(!chat)return;
            const i=inputState(chat),now=Date.now();
            if(now-Math.max(i.lastInputAt,i.lastSendAt)>20000){i.used=false;i.burst++;}
            i.hasText=!!el.value.trim();i.lastInputAt=now;
        };
        el.addEventListener('input',changed);el.addEventListener('compositionupdate',changed);el.addEventListener('compositionend',changed);
    }
    function sent(chat,message,now=Date.now()) {
        const i=inputState(chat);
        if(now-Math.max(i.lastInputAt,i.lastSendAt)>20000){i.used=false;i.burst++;}
        i.lastSendAt=now;
        if(typeof currentChatId!=='undefined'&&currentChatId===chat.id&&typeof messageInput!=='undefined')i.hasText=!!messageInput.value.trim();
        const unfinished=/(?:我跟你说|然后|还有|就是|因为|等一下|我想说|…|\.\.\.)[\s\]）]*$/.test(String(message.content||''));
        i.unfinished=unfinished;
    }
    function ready(chat,kind,now=Date.now(),node=null) {
        const i=inputState(chat),typing=activeTyping(chat,now);
        if(kind!=='reply' && (!node || node.kind!=='followup'))return !typing;
        const fast=immediate(chat,now),buffer=fast?2000:4000;
        if(now-i.lastSendAt<buffer)return false;
        if(!typing)return true;
        if(!chat.smartInterleaved||i.used||i.unfinished)return false;
        if(now-(i.lastInterleaveAt||0)<(fast?15000:45000))return false;
        return true;
    }
    function replyOptions(chat,kind,now=Date.now()) {
        const i=inputState(chat);
        return {interleaved:(kind==='reply'||smart(chat).plan?.kind==='followup')&&chat.smartInterleaved===true&&activeTyping(chat,now)&&!i.used,
            burst:i.burst};
    }
    function canCrossReply(chat,kind,now=Date.now()) {
        const i=inputState(chat),fast=immediate(chat,now);
        return chat.smartInterleaved===true && (kind==='reply'||smart(chat).plan?.kind==='followup')
            && !i.used && !i.unfinished && now-i.lastSendAt>=(fast?2000:4000)
            && now-(i.lastInterleaveAt||0)>=(fast?15000:45000);
    }
    function crossed(chat) {const i=inputState(chat);i.used=true;i.lastInterleaveAt=Date.now();}
    function earlyReply(chat,now=Date.now()) {
        const s=smart(chat),r=s.note?.reply;
        return chat.smartInterleaved===true && activeTyping(chat,now) && ready(chat,'reply',now)
            && !s.sleep && r && r.min_seconds<=120 && r.max_seconds<=120 && !r.busy_until_minutes
            && !window.SmartMessaging.activityRemaining(chat,now);
    }
    function markInterleave(chat,options) {
        if(!options.interleaved)return;
        const i=inputState(chat);if(i.burst!==options.burst)return;
        i.used=true;i.lastInterleaveAt=Date.now();
    }
    function status(chat) {
        const usage=counter(chat),limit=Number(chat.smartAutoLimit)||0;
        return '今日自动请求 '+usage.count+(limit>0?'/'+limit:'（不限次数）')+(!inHours()?'；当前不在真人回复时段':'');
    }
    window.SmartReplyControl={inHours,allowed,reserve,counter,budgetAvailable,normalizeDaily,normalizeDialogue,
        chanceSeed,sampleChance,contactChance,advanceSilence,policy,scheduleDaily,updatePaper,contacted,onWake,immediate,dailyPaused,proactivePaused,backgroundOpportunity,consumedBackground,
        bindInput,sent,ready,earlyReply,canCrossReply,crossed,replyOptions,status,activeTyping,inputState};
})();
