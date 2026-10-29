// v18：持久化总结任务、独立聊天段落及大小总结来源。
(() => {
    const MINUTE=60000;
    const clone=v=>JSON.parse(JSON.stringify(v));
    const uid=()=> 'journal_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const chats=()=>[...(db.characters||[]),...(db.groups||[])];
    const typeOf=c=>(db.groups||[]).includes(c)?'group':'private';
    const currentChat=()=>currentChatType==='group'?db.groups.find(c=>c.id===currentChatId):db.characters.find(c=>c.id===currentChatId);
    const fingerprint=m=>{const value=JSON.stringify([m.content,m.parts,m.timestamp]);let a=2166136261,b=5381;for(let i=0;i<value.length;i++){a=Math.imul(a^value.charCodeAt(i),16777619);b=Math.imul(b,33)^value.charCodeAt(i);}return `${value.length}:${a>>>0}:${b>>>0}`;};
    // 隐藏的附加输出不是总结来源；按消息身份核对，不以可变楼层定位。
    const isAuxiliary=m=>!!(m&&(m.isThinking||m.isStatusUpdate||typeof m.content==='string'&&/^\s*<(?:thinking|preplan)(?:\s|>)/i.test(m.content)));
    const summaryMessages=list=>(list||[]).filter(m=>!isAuxiliary(m));
    function trackingIds(j,map) {
        if(j.sourceTrackingVersion!==2){
            // 旧数据没有保存来源类型。已经消失的条目无法分辨是聊天还是自动清理的附加输出，
            // 仅在此次迁移建立可核对名单；保留原覆盖账本和仍在的聊天指纹，不重写总结。
            j.sourceTrackingIds=(j.sourceIds||[]).filter(id=>map.has(id)&&!isAuxiliary(map.get(id)));
            j.sourceTrackingVersion=2;j.changeNotified=false;
        }
        return j.sourceTrackingIds||[];
    }
    const key=(segment,id)=>segment+':'+id;
    const notices=new Map();
    let running=false,ready=false,prompting=false;
    function state(chat) {
        if(!chat.journalAutomation)chat.journalAutomation={segment:1,jobs:[],small:{enabled:false,mode:'count',count:1000,days:1},big:{enabled:false,mode:'count',count:4000,amount:1,unit:'month'},mergeWorldBookIds:[]};
        const s=chat.journalAutomation;
        s.jobs=s.jobs||[];s.segment=s.segment||1;s.processedCoverage=s.processedCoverage||[];s.big.pieces=s.big.pieces||7;
        return s;
    }
    function validTime(value) {
        if(value===null||value===undefined||value===''||typeof value==='boolean')return null;
        const t=typeof value==='number'?value:typeof value==='string'?(value.trim()!==''&&Number.isFinite(Number(value))?Number(value):Date.parse(value)):NaN;
        return Number.isFinite(t)&&Number.isFinite(new Date(t).getTime())?t:null;
    }
    function applyMessageTimes(j,list) {
        const times=list.map(m=>validTime(m.timestamp)).filter(t=>t!==null);
        j.sourceTimeStart=times[0]??null;j.sourceTimeEnd=times.at(-1)??null;
        j.periodStart=j.sourceTimeStart;j.periodEnd=j.sourceTimeEnd;
        j.messageTimeRangeVersion=1;j.timeRangeUnknown=!times.length;
    }
    function refreshMessageTimes(chat) {
        const map=new Map((chat.history||[]).map((m,i)=>[String(m.id),{m,i}]));
        const journals=chat.memoryJournals||[];
        for(const j of journals.filter(j=>!j.isMerged)){
            const found=(j.sourceIds||[]).map(id=>map.get(String(id))).filter(Boolean).sort((a,b)=>a.i-b.i);
            if(found.length&&!j.sourceCleared)applyMessageTimes(j,found.map(x=>x.m));
            else if(!j.messageTimeRangeVersion){const start=validTime(j.sourceTimeStart),end=validTime(j.sourceTimeEnd);if(j.sourceCleared&&!j.dateEstimated&&start!==null&&end!==null&&!(start===j.createdAt&&end===j.createdAt)){j.periodStart=start;j.periodEnd=end;j.timeRangeUnknown=false;}else{j.sourceTimeStart=null;j.sourceTimeEnd=null;j.periodStart=null;j.periodEnd=null;j.timeRangeUnknown=true;}j.messageTimeRangeVersion=1;}
        }
        const visited=new Set(),visiting=new Set();
        const update=j=>{if(visited.has(j.id)||visiting.has(j.id))return;visiting.add(j.id);const children=journals.filter(c=>(j.childIds||[]).includes(c.id));for(const c of children)if(c.isMerged)update(c);const starts=children.map(c=>validTime(c.periodStart)).filter(t=>t!==null),ends=children.map(c=>validTime(c.periodEnd)).filter(t=>t!==null);if(starts.length&&ends.length){j.periodStart=Math.min(...starts);j.periodEnd=Math.max(...ends);j.sourceTimeStart=j.periodStart;j.sourceTimeEnd=j.periodEnd;j.messageTimeRangeVersion=1;j.timeRangeUnknown=false;}else if(!j.messageTimeRangeVersion){j.periodStart=null;j.periodEnd=null;j.sourceTimeStart=null;j.sourceTimeEnd=null;j.messageTimeRangeVersion=1;j.timeRangeUnknown=true;}visiting.delete(j.id);visited.add(j.id);};
        for(const j of journals.filter(j=>j.isMerged))update(j);
    }
    function attach(chat,j,messages,options={}) {
        const s=state(chat),list=summaryMessages(messages);
        j.segment=options.segment||s.segment;
        j.sourceIds=list.map(m=>m.id);
        j.coverage=j.sourceIds.map(id=>key(j.segment,id));
        j.sourcePrints=Object.fromEntries(list.map(m=>[m.id,fingerprint(m)]));
        j.sourceTrackingIds=[...j.sourceIds];j.sourceTrackingVersion=2;
        j.coveredCount=j.coverage.length;
        j.summaryMode=options.mode||'manual';
        applyMessageTimes(j,list);
        j.originalRange={...j.range};
        j.isMerged=false;
    }
    function migrate(chat) {
        const s=state(chat);
        // Repair v18's inferred 'cleared' tag without asserting that source records exist.
        for(const j of chat.memoryJournals||[])if(j.sourceCleared&&j.dateEstimated&&j.segment===0&&!(j.sourceIds||[]).length&&!j.clearConfirmed){
            delete j.sourceCleared;j.sourceUnverified=true;
        }
        const legacyJournals=(chat.memoryJournals||[]).filter(j=>!j.coverage||j.dateEstimated&&!j.clearConfirmed);
        for(const j of chat.memoryJournals||[])if(!j.coverage){
            const list=(chat.history||[]).slice(Math.max(0,j.range?.start-1),j.range?.end||0);
            // Endpoint identities must match; never attach old floors to new messages.
            const matches=(!j.startMessageId||j.startMessageId===list[0]?.id)&&(!j.endMessageId||j.endMessageId===list.at(-1)?.id);
            if(matches&&list.length)attach(chat,j,list);
            else {
                j.segment=0;j.originalRange={...j.range};j.sourceIds=[];j.sourcePrints={};
                j.coverage=Array.from({length:Math.max(0,(j.range?.end||0)-(j.range?.start||1)+1)},(_,i)=>key(0,'legacy-floor-'+((j.range?.start||1)+i)));
                j.coveredCount=j.coverage.length;j.periodStart=j.createdAt;j.periodEnd=j.createdAt;j.sourceUnverified=true;j.dateEstimated=true;
            }
        }
        const history=chat.history||[];
        for(const j of chat.memoryJournals||[])if(j.sourceUnverified&&!j.clearConfirmed&&j.startMessageId&&j.endMessageId){
            const start=history.findIndex(m=>m.id===j.startMessageId),end=history.findIndex(m=>m.id===j.endMessageId);
            if(start>=0&&end>=start){
                const retained={title:j.title,content:j.content,isFavorited:j.isFavorited,createdAt:j.createdAt};
                attach(chat,j,history.slice(start,end+1));Object.assign(j,retained);
                delete j.sourceUnverified;delete j.dateEstimated;
            }
        }
        s.processedCoverage=[...new Set([...s.processedCoverage,...collectCoverage(chat.memoryJournals||[])])];
        const savedBoundaries=(chat.memoryJournals||[]).filter(j=>!j.clearConfirmed&&!j.isMerged&&j.endMessageId);
        if((legacyJournals.length||savedBoundaries.length)&&!s.legacyBoundary&&s.segment===1){
            const latest=[...(savedBoundaries.length?savedBoundaries:legacyJournals)].sort((a,b)=>(b.range?.end||0)-(a.range?.end||0)||(b.createdAt||0)-(a.createdAt||0))[0];
            let at=history.findIndex(m=>m.id===latest.endMessageId);
            if(at<0||isAuxiliary(history[at])){
                const ids=new Set(latest.sourceIds||[]);
                at=history.findLastIndex(m=>ids.has(m.id)&&!isAuxiliary(m));
            }
            s.legacyBoundary={segment:s.segment,endMessageId:at>=0?history[at].id:null,oldRangeEnd:latest.range?.end||0,confirmed:at>=0};
        }
        refreshMessageTimes(chat);
        return s;
    }
    function clearHistory(chat) {
        window.VectorMemory?.onHistoryCleared(chat);
        const s=migrate(chat);
        for(const j of chat.memoryJournals||[])if(!j.isMerged&&!j.sourceIndependent&&j.segment===s.segment){j.sourceCleared=true;j.clearConfirmed=true;}
        for(const job of s.jobs)if(job.kind==='small'&&job.segment===s.segment){job.sourceCleared=true;}
        s.segment++;delete s.dayCursor;delete s.rollReplacement;delete s.legacyBoundary;
    }
    function collectCoverage(list) {return [...new Set(list.flatMap(j=>j.coverage||[]))];}
    function unmergedCoverage(chat,list) {const used=new Set((chat.memoryJournals||[]).filter(j=>j.isMerged).flatMap(j=>j.coverage||[]));return collectCoverage(list).filter(id=>!used.has(id));}
    function availableSmall(chat) {
        const childIds=new Set((chat.memoryJournals||[]).filter(j=>j.isMerged).flatMap(j=>j.childIds||[]));
        return (chat.memoryJournals||[]).filter(j=>!j.isMerged&&!childIds.has(j.id)&&unmergedCoverage(chat,[j]).length>0).sort((a,b)=>(a.periodStart||a.createdAt)-(b.periodStart||b.createdAt)||a.createdAt-b.createdAt);
    }
    function unassigned(chat) {
        const s=migrate(chat),done=new Set((chat.memoryJournals||[]).filter(j=>!j.isMerged&&j.segment===s.segment).flatMap(j=>j.sourceIds||[]));
        for(const job of s.jobs)if(job.kind==='small'&&job.segment===s.segment)for(const id of job.sourceIds)done.add(id);
        const processed=new Set(s.processedCoverage);
        const h=chat.history||[],boundary=s.legacyBoundary;
        if(boundary&&boundary.segment===s.segment){
            if(!boundary.confirmed)return [];
            const at=h.findIndex(m=>m.id===boundary.endMessageId);
            // A removed anchor cannot make earlier messages suddenly unsummarized.
            if(at<0){boundary.confirmed=false;return [];}
            return summaryMessages(h.slice(at+1)).filter(m=>!done.has(m.id)&&!processed.has(key(s.segment,m.id)));
        }
        return summaryMessages(h).filter(m=>!done.has(m.id)&&!processed.has(key(s.segment,m.id)));
    }
    function makeJob(chat,kind,fields) {
        const s=state(chat),job={id:uid(),resultId:uid(),kind,status:'pending',attempts:0,retryAt:0,revision:0,archiveId:chat.activeArchiveId||null,...fields};
        s.jobs.push(job);return job;
    }
    function smallJob(chat,list,fields={}) {
        if(!list.length)return null;
        list=summaryMessages(list);if(!list.length)return null;
        const s=state(chat),start=chat.history.findIndex(m=>m.id===list[0].id)+1,end=chat.history.findIndex(m=>m.id===list.at(-1).id)+1;
        return makeJob(chat,'small',{segment:s.segment,sourceIds:list.map(m=>m.id),messages:clone(list),range:{start,end},periodStart:list[0].timestamp,periodEnd:list.at(-1).timestamp,mode:'count',...fields});
    }
    function dayStart(at) {const d=new Date(at);d.setHours(4,0,0,0);if(d.getTime()>at)d.setDate(d.getDate()-1);return d.getTime();}
    function addDays(at,days){const d=new Date(at);d.setDate(d.getDate()+days);return d.getTime();}
    function addPeriod(at,n,unit) {
        if(unit==='day'||unit==='week')return addDays(at,n*(unit==='week'?7:1));
        const d=new Date(at),day=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+n*(unit==='year'?12:1));
        const max=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(day,max));return d.getTime();
    }
    function settlement(history,boundary,now) {
        const users=history.filter(m=>m.role==='user'&&!m.isWithdrawn&&!m.isContextDisabled).map(m=>Number(m.timestamp)).filter(Number.isFinite).sort((a,b)=>a-b);
        let cutoff=boundary,last=users.filter(t=>t<=boundary).at(-1);
        if(last!==undefined&&boundary-last<30*MINUTE)cutoff=last+30*MINUTE;
        for(const t of users)if(t>boundary&&t<=cutoff)cutoff=t+30*MINUTE;
        return cutoff<=now?cutoff:null;
    }
    function queueAutomatic(chat,now=Date.now()) {
        if(window.VectorMemory&&!window.VectorMemory.diaryAllowed(chat))return;
        const s=migrate(chat),a=s.small,list=unassigned(chat);
        if(a.enabled&&list.length){
            if(a.mode==='count'){
                if(list.length>=a.count)smallJob(chat,list.slice(0,a.count));
            } else {
                const begin=s.dayCursor??dayStart(list[0].timestamp||now),boundary=addDays(dayStart(begin),a.days),cutoff=settlement(chat.history,boundary,now);
                if(cutoff!==null){const batch=list.filter(m=>m.timestamp<cutoff);
                    if(batch.length)smallJob(chat,batch,{periodStart:begin,periodEnd:cutoff,mode:'time'});
                    s.dayCursor=cutoff;
                }
            }
        }
        const b=s.big,parts=availableSmall(chat);
        if(!b.enabled||!parts.length||s.jobs.some(j=>j.kind==='merge'&&!j.targetId))return;
        if(parts.some(j=>j.needsUpdate)||s.jobs.some(j=>j.kind==='small'))return;
        let chosen=[];
        if(b.mode==='pieces'){if(parts.length<b.pieces)return;chosen=parts.slice(0,b.pieces);}
        else if(b.mode==='count') {
            for(const j of parts){chosen.push(j);if(unmergedCoverage(chat,chosen).length>=b.count)break;}
            if(unmergedCoverage(chat,chosen).length<b.count)return;
        } else {
            const begin=parts[0].periodStart||parts[0].createdAt,cutoff=addPeriod(begin,b.amount,b.unit);
            if(now<cutoff)return;
            chosen=parts.filter(j=>(j.periodEnd||j.createdAt)<=cutoff);
            if(!chosen.length)return;
        }
        mergeJob(chat,chosen);
    }
    function mergeJob(chat,parts,targetId) {
        return makeJob(chat,'merge',{childIds:parts.map(j=>j.id),targetId:targetId||null,periodStart:Math.min(...parts.map(j=>j.periodStart||j.createdAt)),periodEnd:Math.max(...parts.map(j=>j.periodEnd||j.createdAt))});
    }
    function requestUpdate(chat,j,syncParents=true) {
        if(!(chat.memoryJournals||[]).includes(j)||j.sourceIndependent)return;
        const s=state(chat);j.needsUpdate=true;
        if(s.jobs.some(job=>job.targetId===j.id))return;
        if(j.isMerged){const parts=(chat.memoryJournals||[]).filter(x=>j.childIds.includes(x.id));if(parts.length)mergeJob(chat,parts,j.id);return;}
        if(j.sourceCleared)return;
        const ids=new Set(j.sourceIds),list=summaryMessages(chat.history).filter(m=>ids.has(m.id));
        smallJob(chat,list,{targetId:j.id,segment:j.segment,range:j.originalRange||j.range,periodStart:j.periodStart,periodEnd:j.periodEnd,mode:j.summaryMode,syncParents});
        if(!list.length){j.needsUpdate=true;j.updateError='原范围内已没有消息，可手动编辑或删除此总结';}
    }
    function beginRoll(chat,removed,userId) {
        const s=migrate(chat),ids=new Set(removed.map(m=>m.id));
        s.rollReplacement={userId,summaryIds:(chat.memoryJournals||[]).filter(j=>!j.isMerged&&!j.sourceCleared&&j.sourceIds?.some(id=>ids.has(id))).map(j=>j.id),removedIds:[...ids]};
    }
    function finishRoll(chat) {
        const s=state(chat),roll=s.rollReplacement;if(!roll)return;
        const at=chat.history.findIndex(m=>m.id===roll.userId),messages=summaryMessages(chat.history.slice(at+1)).filter(m=>m.role==='assistant');
        if(!messages.length)return;
        for(const id of roll.summaryIds){const j=(chat.memoryJournals||[]).find(x=>x.id===id);if(!j)continue;
            j.sourceIds=[...j.sourceIds.filter(x=>!roll.removedIds.includes(x)),...messages.map(m=>m.id)];
            j.coverage=j.sourceIds.map(x=>key(j.segment,x));j.coveredCount=j.coverage.length;
            j.sourceTrackingIds=[...j.sourceIds];j.sourceTrackingVersion=2;
            j.changeNotified=false;
        }
        delete s.rollReplacement;
    }
    function removeJournals(chat,ids,updateParents=false) {
        migrate(chat);const gone=new Set(ids),list=chat.memoryJournals||[],s=state(chat);
        for(const j of list)if(gone.has(j.id)&&j.isMerged){for(const child of list.filter(c=>j.childIds.includes(c.id))){delete child.parentId;child.isFavorited=child.favoriteBeforeMerge===true;}}
        chat.memoryJournals=list.filter(j=>!gone.has(j.id));
        s.jobs=s.jobs.filter(job=>!gone.has(job.targetId)&&!(job.kind==='merge'&&job.childIds.some(id=>gone.has(id))));
        for(const parent of chat.memoryJournals.filter(j=>j.childIds?.some(id=>gone.has(id)))){
            parent.deletedChildIds=[...new Set([...(parent.deletedChildIds||[]),...parent.childIds.filter(id=>gone.has(id))])];
            if(updateParents){parent.childIds=parent.childIds.filter(id=>!gone.has(id));parent.needsUpdate=true;
                if(parent.childIds.length)requestUpdate(chat,parent);
                else parent.updateError='小总结已全部删除，无法重新生成；请手动编辑或删除此大总结';
            }
        }
    }
    async function deleteWithChoice(chat,ids) {
        const gone=new Set(ids),affected=(chat.memoryJournals||[]).filter(j=>!gone.has(j.id)&&j.childIds?.some(id=>gone.has(id)));
        let update=false;
        if(affected.length){
            const choice=await deletionChoice();if(choice===null)return false;update=choice;
        }else if(!await glassConfirm('删除总结？','删除总结内容不会清零已总结进度或重新计算旧消息。','删除总结'))return false;
        const old=clone(chat.memoryJournals||[]),s=state(chat),before=clone(s);
        removeJournals(chat,ids,update);
        try{await saveData();}catch(error){chat.memoryJournals=old;chat.journalAutomation=before;throw error;}
        return true;
    }
    function deletionChoice() {
        return new Promise(resolve=>{
            const overlay=document.createElement('div'),box=document.createElement('div');overlay.className='v18-glass-overlay';box.className='v18-glass-dialog';
            box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
            overlay.onkeydown=e=>{if(e.key==='Escape'){overlay.remove();resolve(null);}};
            const h=document.createElement('h3');h.textContent='删除小总结';const p=document.createElement('p');p.textContent='清理小总结可以保留大总结；只有希望删除相应记忆内容时才更新大总结。已总结计数始终保留。';box.append(h,p);
            for(const [label,value]of [['仅删除小总结，保留大总结',false],['删除小总结，并更新大总结',true],['取消',null]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>{overlay.remove();resolve(value);};box.append(button);}
            overlay.append(box);document.body.append(overlay);
        });
    }
    async function syncEdited(chat,j) {
        const parents=(chat.memoryJournals||[]).filter(p=>p.childIds?.includes(j.id));
        if(parents.length&&await glassConfirm('同步更新大总结？','小总结已修改。是否使用修改后的内容重新生成对应大总结？','同步更新','只保存小总结'))for(const p of parents)requestUpdate(chat,p);
    }
    async function regenerate(chat,j) {
        if(window.VectorMemory&&!window.VectorMemory.diaryAllowed(chat)){showToast('请先切换到日记记忆模式');return;}
        const parts=(chat.memoryJournals||[]).filter(x=>j.childIds?.includes(x.id));
        if(!parts.length){showToast('没有保留的小总结，只能手动编辑大总结');return;}
        const missing=(j.deletedChildIds||[]).length||parts.length<(j.childIds||[]).length;
        if(!await glassConfirm('重新生成大总结？',missing?'部分小总结已删除，只能用剩余小总结重新生成，可能丢失已删部分的细节。成功后替换，失败保留旧内容。':'使用对应小总结和大总结世界书重新生成，成功后替换，失败保留旧内容。','重新生成'))return;
        if(state(chat).jobs.some(job=>job.targetId===j.id)){showToast('这份大总结已有更新任务');return;}
        mergeJob(chat,parts,j.id);await saveData();void tick();
    }
    async function addWritten(chat,title,content,isFavorited=false){
        title=String(title||'').trim();content=String(content||'');if(!title||!content.trim())throw Error('请填写标题和总结内容');
        if(!chats().includes(chat))throw Error('聊天已不存在');
        const j={id:'written_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),title,content,isFavorited:!!isFavorited,createdAt:Date.now(),sourceIndependent:true,summaryMode:'written',isMerged:false,range:{start:0,end:0},originalRange:{start:0,end:0},sourceIds:[],sourcePrints:{},sourceTrackingIds:[],sourceTrackingVersion:2,coverage:[],coveredCount:0,segment:state(chat).segment,messageTimeRangeVersion:1,timeRangeUnknown:true,periodStart:null,periodEnd:null};
        const list=chat.memoryJournals??=[];list.push(j);try{await saveData();}catch(error){list.splice(list.indexOf(j),1);throw error;}return j;
    }
    function detailTools(chat,j) {
        document.getElementById('journal-detail-tools')?.remove();if(!j.isMerged)return;
        const bar=document.createElement('div');bar.id='journal-detail-tools';const button=document.createElement('button');button.type='button';button.className='journal-drawer-button';button.textContent='重新生成大总结';button.onclick=()=>regenerate(chat,j);bar.append(button);
        const body=document.getElementById('journal-detail-content');body.parentNode.insertBefore(bar,body);
    }
    function favorites(chat) {
        if(window.VectorMemory&&!window.VectorMemory.diaryAllowed(chat))return [];
        const list=chat.memoryJournals||[],litParents=new Set(list.filter(j=>j.isMerged&&j.isFavorited&&!j.needsUpdate).map(j=>j.id));
        return list.filter(j=>j.isFavorited&&!j.needsUpdate&&!litParents.has(j.parentId));
    }
    function onMessageInserted(chat,message,afterId) {
        const s=migrate(chat),map=new Map((chat.history||[]).map(m=>[m.id,m])),undo=[];
        for(const j of chat.memoryJournals||[])if(!j.isMerged&&!j.sourceCleared&&j.segment===s.segment&&(j.sourceIds||[]).includes(afterId)){
            const keys=['sourceIds','sourceTrackingIds','sourceTrackingVersion','coverage','coveredCount','changeNotified'];
            const before=Object.fromEntries(keys.map(k=>[k,j[k]===undefined?undefined:clone(j[k])]));
            trackingIds(j,map);const at=j.sourceIds.indexOf(afterId);j.sourceIds.splice(at+1,0,message.id);
            j.sourceTrackingIds.push(message.id);j.coverage=[...new Set([...(j.coverage||[]),key(j.segment,message.id)])];j.coveredCount=j.coverage.length;j.changeNotified=false;
            undo.push(()=>{for(const k of keys)if(before[k]===undefined)delete j[k];else j[k]=before[k];});
        }
        return ()=>undo.forEach(fn=>fn());
    }
    function reconcileAll() {
        if(!ready)return;
        for(const chat of chats()) {
            const s=migrate(chat),map=new Map((chat.history||[]).map(m=>[m.id,m]));
            const boundary=s.legacyBoundary;
            if(boundary?.confirmed&&boundary.segment===s.segment){
                const at=(chat.history||[]).findIndex(m=>m.id===boundary.endMessageId);
                if(at>=0)boundary.previousIds=(chat.history||[]).slice(Math.max(0,at-99),at+1).map(m=>m.id);
                else {const covered=new Set((chat.memoryJournals||[]).filter(j=>!j.isMerged&&j.segment===s.segment).flatMap(j=>j.sourceIds||[]));const replacement=(boundary.previousIds||[]).filter(id=>map.has(id)&&!isAuxiliary(map.get(id))).at(-1)||(chat.history||[]).findLast(m=>covered.has(m.id)&&!isAuxiliary(m))?.id;if(replacement)boundary.endMessageId=replacement;else boundary.confirmed=false;}
            }
            for(const job of s.jobs)if(job.kind==='small'&&!job.sourceCleared&&job.segment===s.segment){
                const fresh=summaryMessages(job.sourceIds.map(id=>map.get(id)).filter(Boolean));
                if(JSON.stringify(fresh)!==JSON.stringify(job.messages)){job.messages=clone(fresh);job.sourceIds=fresh.map(m=>m.id);job.revision++;}
            }
            for(const j of chat.memoryJournals||[])if(!j.isMerged&&!j.sourceCleared&&j.segment===s.segment&&j.sourcePrints){
                if(s.rollReplacement?.summaryIds.includes(j.id))continue;
                const changed=trackingIds(j,map).some(id=>!map.has(id)||!isAuxiliary(map.get(id))&&fingerprint(map.get(id))!==j.sourcePrints[id]);
                if(changed&&!j.changeNotified){j.changeNotified=true;notices.set(chat.id+':'+j.id,{chat,j,archiveId:chat.activeArchiveId||null,owner:s});}
                if(j.needsUpdate&&s.jobs.some(job=>job.targetId===j.id)){
                    const job=s.jobs.find(job=>job.targetId===j.id);if(job.status==='paused')continue;
                }
            }
        }
        if(notices.size&&!prompting)setTimeout(()=>void showChanges(),0);
    }
    async function showChanges() {
        if(prompting)return;prompting=true;
        try {while(notices.size){const [id,{chat,j,archiveId,owner}]=notices.entries().next().value;notices.delete(id);
            if(j.sourceCleared||(chat.activeArchiveId||null)!==archiveId||state(chat)!==owner||!(chat.memoryJournals||[]).includes(j))continue;
            const sourceMap=new Map((chat.history||[]).map(m=>[m.id,m]));
            if(!trackingIds(j,sourceMap).some(id=>!sourceMap.has(id)||!isAuxiliary(sourceMap.get(id))&&fingerprint(sourceMap.get(id))!==j.sourcePrints[id])){j.changeNotified=false;continue;}
            const update=await glassConfirm('更新相关总结？','你调整的消息已包含在“'+j.title+'”中。是否按修改后的记录更新这份总结？清空聊天记录不会触发此操作。','更新总结','保留原总结');
            if((chat.activeArchiveId||null)!==archiveId||state(chat)!==owner||!(chat.memoryJournals||[]).includes(j))continue;
            if(update){const parents=(chat.memoryJournals||[]).filter(p=>p.childIds?.includes(j.id));const sync=!parents.length||await glassConfirm('同步更新大总结？','是否将这次小总结更新同步到对应大总结？','同步更新','仅更新小总结');requestUpdate(chat,j,sync);if(sync)for(const parent of parents)requestUpdate(chat,parent);}
            // Store the new baseline even when retaining the original summary.
            j.sourcePrints=Object.fromEntries((chat.history||[]).filter(m=>j.sourceIds.includes(m.id)).map(m=>[m.id,fingerprint(m)]));
            j.sourceIds=j.sourceIds.filter(id=>(chat.history||[]).some(m=>m.id===id));
            j.sourceTrackingIds=(j.sourceTrackingIds||[]).filter(id=>j.sourceIds.includes(id));
            j.changeNotified=false;
            await saveData();refresh(chat);
        }} finally {prompting=false;}
    }
    function mergePrompt(chat,parts) {
        const books=(state(chat).mergeWorldBookIds||[]).map(id=>(db.worldBooks||[]).find(w=>w.id===id)).filter(Boolean).sort((a,b)=>(a.depth||100)-(b.depth||100)).map(w=>w.content).join('\n\n');
        return `请将以下已完成的小总结按时间顺序合并成精简的大总结。保留关键事实、关系变化、重要约定、未完成事项和必要原话；不编造细节，不升华。输出<title>标题</title><content>正文</content>。\n${books?'请遵守以下大总结专用世界书要求：\n'+books:''}\n${parts.map(j=>`【${j.title}】\n时间：${fullDate(j.periodStart)}至${fullDate(j.periodEnd)}\n${j.content}`).join('\n\n---\n\n')}`;
    }
    const diaryControllers=new Map();
    function suspend(chat){diaryControllers.get(chat)?.abort();}
    async function runJob(chat,job) {
        if(window.VectorMemory&&!window.VectorMemory.diaryAllowed(chat))return;
        if(running||isGenerating||window.SmartMessaging?.busy(chat)||prompting)return;
        if(job.kind==='merge'){
            const parts=(chat.memoryJournals||[]).filter(j=>job.childIds.includes(j.id));
            if(parts.some(j=>j.needsUpdate)||parts.length!==job.childIds.length)return;
        }
        running=true;const diaryController=new AbortController();diaryControllers.set(chat,diaryController);
        const s=state(chat),archive=chat.activeArchiveId||null,revision=job.revision;
        job.status='running';job.attempts++;
        try {
            await saveData();
            const snapshot=clone(job),parts=snapshot.kind==='merge'?(chat.memoryJournals||[]).filter(j=>snapshot.childIds.includes(j.id)):null;
            const partStamp=parts?JSON.stringify(parts.map(j=>[j.id,j.content,j.title,j.needsUpdate])):null;
            const prompt=parts?mergePrompt(chat,parts):buildJournalSummaryPrompt(chat,clone(snapshot.messages),typeOf(chat));
            if(!parts&&!snapshot.messages.length)throw new Error('这批消息已全部删除，无法生成总结');
            const config=window.SummaryApi.resolve(chat);
            if(!config.url||!config.key||!config.model)throw new Error('总结 API 设置不完整');
            const {requestBody,endpoint,headers}=buildChatApiRequest(config,[{role:'user',content:prompt}],window.SummaryApi.options(config));
            const raw=await fetchAiResponse(config,requestBody,headers,endpoint,false,diaryController.signal);
            const title=raw.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim(),content=raw.match(/<content>([\s\S]*?)<\/content>/i)?.[1]?.trim();
            if(!title||!content)throw new Error('总结未返回完整标题和正文');
            if((chat.activeArchiveId||null)!==archive||state(chat)!==s||(window.VectorMemory&&!window.VectorMemory.diaryAllowed(chat))){job.status='pending';return;}
            if(!s.jobs.some(j=>j.id===job.id))return;
            if(job.revision!==revision||parts&&partStamp!==JSON.stringify((chat.memoryJournals||[]).filter(j=>job.childIds.includes(j.id)).map(j=>[j.id,j.content,j.title,j.needsUpdate]))){job.status='pending';job.retryAt=Date.now();job.attempts--;await saveData();return;}
            const oldList=clone(chat.memoryJournals||[]),oldJobs=clone(s.jobs),oldProcessed=[...s.processedCoverage];
            try {
                let result={id:job.targetId||job.resultId,title,content,createdAt:Date.now(),chatId:chat.id,chatType:typeOf(chat),isFavorited:false,range:{...job.range},periodStart:job.periodStart,periodEnd:job.periodEnd};
                const old=(chat.memoryJournals||[]).find(j=>j.id===job.targetId);
                if(old)result={...old,...result,createdAt:old.createdAt,isFavorited:old.isFavorited,needsUpdate:false,updatedAt:Date.now()};
                if(parts){
                    result.isMerged=true;result.childIds=parts.map(j=>j.id);result.coverage=collectCoverage(parts);result.coveredCount=result.coverage.length;
                    result.range={start:Math.min(...parts.map(j=>j.range.start)),end:Math.max(...parts.map(j=>j.range.end))};
                    result.segments=[...new Set(parts.map(j=>j.segment))];result.segment=result.segments.length===1?result.segments[0]:null;
                    result.sourceRanges=parts.map(j=>({segment:j.segment,range:{...j.range}}));
                    const priorCoverage=new Set((chat.memoryJournals||[]).filter(j=>j.isMerged&&j.id!==result.id).flatMap(j=>j.coverage||[]));
                    result.cumulativeRange=old?.cumulativeRange||{start:priorCoverage.size+1,end:priorCoverage.size+result.coverage.filter(id=>!priorCoverage.has(id)).length};
                    result.isFavorited=old?old.isFavorited:true;
                    for(const child of parts){if(!old)child.favoriteBeforeMerge=child.isFavorited;child.isFavorited=false;child.parentId=result.id;}
                } else {attach(chat,result,job.messages,{segment:job.segment,periodStart:job.periodStart,periodEnd:job.periodEnd,mode:job.mode});result.sourceCleared=job.sourceCleared===true;result.clearConfirmed=job.sourceCleared===true;if(!old)result.isFavorited=true;}
                chat.memoryJournals=(chat.memoryJournals||[]).filter(j=>j.id!==result.id);chat.memoryJournals.push(result);refreshMessageTimes(chat);
                s.jobs=s.jobs.filter(j=>j.id!==job.id);
                if(old&&!parts&&job.syncParents!==false){for(const parent of chat.memoryJournals.filter(j=>j.childIds?.includes(result.id)))requestUpdate(chat,parent);}
                await saveData();
            } catch(error){chat.memoryJournals=oldList;s.jobs=oldJobs;s.processedCoverage=oldProcessed;throw error;}
            showToast(parts?'大总结已保存，小总结已收纳':'总结已保存');refresh(chat);
        } catch(error) {
            if((chat.activeArchiveId||null)!==archive||state(chat)!==s)return;
            if(diaryController.signal.aborted){job.status='pending';job.attempts=Math.max(0,job.attempts-1);return;}
            const task=s.jobs.find(j=>j.id===job.id)||job;
            task.lastError=String(error.message||error);task.status=task.attempts>=3?'paused':'pending';
            task.retryAt=Date.now()+(task.attempts===1?MINUTE:2*MINUTE);
            try{await saveData();}catch(e){console.error('总结任务未保存',e);}
            if(task.status==='paused'){await glassConfirm('总结未完成','初次生成和两次自动重试均未成功。原总结保留，你可以在自动总结设置中手动重试。\n'+task.lastError,'知道了',null);}
            refresh(chat);
        } finally {diaryControllers.delete(chat);running=false;}
    }
    async function tick() {
        if(!ready||running||isGenerating||document.hidden)return;
        for(const chat of chats()){
            if(window.VectorMemory&&!window.VectorMemory.diaryAllowed(chat))continue;
            if(window.SmartMessaging?.busy(chat))continue;
            const s=state(chat);const before=JSON.stringify(s);
            queueAutomatic(chat);
            if(JSON.stringify(s)!==before)await saveData();
            const job=s.jobs.find(j=>j.status!=='paused'&&Date.now()>=(j.retryAt||0)&&!(j.kind==='merge'&&(chat.memoryJournals||[]).some(x=>j.childIds.includes(x.id)&&x.needsUpdate)));
            if(job){await runJob(chat,job);return;}
        }
    }
    function refresh(chat) {if(chat.id===currentChatId&&document.getElementById('journal-list-container'))renderJournalList();}
    function fullDate(t) {if(validTime(t)===null)return '时间待确认';return new Date(t).toLocaleString('zh-CN',{hour12:false});}
    function date(t){if(validTime(t)===null)return '时间待确认';const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
    function cardTime(j){return j.isMerged||j.summaryMode==='time'?(j.timeRangeUnknown?'时间待确认':date(j.periodStart)+' ～ '+date(j.periodEnd)):date(j.createdAt);}
    function rangeText(j){if(j.sourceIndependent)return '手动补充 · 未关联聊天';return j.isMerged&&j.segments?.length>1?`累计范围: ${j.cumulativeRange?.start||1}-${j.cumulativeRange?.end||j.coveredCount}`:`范围: ${j.range.start}-${j.range.end}`;}
    function detailText(j){if(j.sourceIndependent)return '创建于 '+fullDate(j.createdAt)+'\n手动补充 · 未关联聊天消息，不占自动总结进度';return `创建于 ${fullDate(j.createdAt)}\n${'时间范围：'+(j.timeRangeUnknown?'时间待确认':fullDate(j.periodStart)+' ～ '+fullDate(j.periodEnd))+'\n'}${j.sourceRanges?j.sourceRanges.map(r=>`聊天段${r.segment}：${r.range.start}-${r.range.end}`).join('；'):`聊天段${j.segment||1} · 消息范围：${j.range.start}-${j.range.end}`} · ${j.sourceUnverified&&!(j.sourceIds||[]).length?'原记录':'覆盖'}${j.coveredCount||0}条${j.sourceCleared?' · 原消息已清空':j.sourceUnverified?' · 旧总结来源未确认':''}${j.needsUpdate?' · 总结待更新':''}${j.updateError?'\n'+j.updateError:''}`;}
    function decorate(chat,container) {
        migrate(chat);
        const cards=new Map([...container.querySelectorAll('.journal-card[data-id]')].map(c=>[c.dataset.id,c]));
        const js=chat.memoryJournals||[],parents=new Set(js.map(j=>j.id));
        for(const j of js){
            const card=cards.get(j.id);if(!card)continue;
            card.querySelector('.journal-card-date').textContent=cardTime(j);
            card.querySelector('.journal-card-range').textContent=rangeText(j);
            if(j.sourceCleared||j.needsUpdate){const label=document.createElement('div');label.className='journal-state-label';label.textContent=j.needsUpdate?'总结待更新':'原消息已清空';card.append(label);}
            if(j.isMerged){
                const parts=js.filter(x=>j.childIds.includes(x.id)),button=document.createElement('button'),drawer=document.createElement('div');
                button.type='button';button.className='journal-drawer-button';button.textContent=`展开小总结 · ${parts.length}篇`;button.setAttribute('aria-expanded','false');
                drawer.className='journal-drawer';drawer.hidden=true;
                button.onclick=e=>{e.stopPropagation();drawer.hidden=!drawer.hidden;button.textContent=`${drawer.hidden?'展开':'收起'}小总结 · ${parts.length}篇`;button.setAttribute('aria-expanded',String(!drawer.hidden));};
                card.append(button,drawer);
                for(const child of parts){const childCard=cards.get(child.id);if(childCard)drawer.append(childCard);}
            } else if(j.parentId&&!parents.has(j.parentId))delete j.parentId;
        }
    }
    function glassConfirm(title,message,yes='确认删除',no='取消') {
        return new Promise(resolve=>{
            const overlay=document.createElement('div');overlay.className='v18-glass-overlay';
            const box=document.createElement('div');box.className='v18-glass-dialog';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
            const heading=document.createElement('h3'),body=document.createElement('p'),actions=document.createElement('div');heading.textContent=title;body.textContent=message;
            const previous=document.activeElement;const finish=value=>{overlay.remove();previous?.focus?.();resolve(value);};
            const ok=document.createElement('button');ok.type='button';ok.textContent=yes;ok.onclick=()=>finish(true);actions.append(ok);
            if(no){const cancel=document.createElement('button');cancel.type='button';cancel.textContent=no;cancel.onclick=()=>finish(false);actions.append(cancel);}
            box.append(heading,body,actions);overlay.append(box);document.body.append(overlay);(actions.lastChild||ok).focus();
            overlay.onkeydown=e=>{if(e.key==='Escape'&&no)finish(false);if(e.key==='Tab'){const bs=[...actions.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===bs[0]){e.preventDefault();bs.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===bs.at(-1)){e.preventDefault();bs[0].focus();}}};
        });
    }
    async function mergeManual(chat,ids) {
        if(window.VectorMemory&&!window.VectorMemory.diaryAllowed(chat)){showToast('当前未启用日记记忆，请在向量记忆页切换模式');return;}
        migrate(chat);const parts=(chat.memoryJournals||[]).filter(j=>ids.includes(j.id));
        if(parts.some(j=>j.isMerged||j.parentId||j.needsUpdate)){showToast('请选择未收纳、无需更新的小总结');return;}
        if(running||isGenerating){showToast('当前正在生成，请稍后再试');return;}
        const job=mergeJob(chat,parts);await saveData();await runJob(chat,job);
    }
    function settings(chat) {
        const s=migrate(chat),overlay=document.createElement('div'),box=document.createElement('form');overlay.className='v18-glass-overlay';box.className='v18-glass-dialog journal-auto-settings';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
        box.innerHTML=`<h3>自动总结</h3><fieldset><legend>小总结</legend><label><input name="smallEnabled" type="checkbox">开启自动小总结</label><label><input name="smallMode" type="radio" value="count">按条数 <input name="smallCount" type="number" min="1" max="1000000" step="1"> 条</label><label><input name="smallMode" type="radio" value="time">按天数 <input name="smallDays" type="number" min="1" max="3650" step="1"> 天</label><p>手机当地时间凌晨4点分界；user停发满30分钟才结算，char单方面发消息不延后。</p></fieldset><fieldset><legend>大总结自动合并</legend><label><input name="bigEnabled" type="checkbox">开启自动大总结</label><label><input name="bigMode" type="radio" value="count">按条数 <input name="bigCount" type="number" min="1" max="10000000" step="1"> 条</label><label><input name="bigMode" type="radio" value="pieces">按小总结篇数 <input name="bigPieces" type="number" min="1" max="10000" step="1"> 篇</label><label><input name="bigMode" type="radio" value="time">按周期 <input name="bigAmount" type="number" min="1" max="3650" step="1"><select name="bigUnit"><option value="day">天</option><option value="week">周</option><option value="month">月</option><option value="year">年</option></select></label><p class="journal-merge-progress"></p></fieldset><div class="journal-job-list"></div><div class="journal-settings-actions"><button type="submit">保存</button><button type="button" class="close-settings">取消</button></div>`;
        const f=box.elements;f.smallEnabled.checked=s.small.enabled;f.smallMode.value=s.small.mode;f.smallCount.value=s.small.count;f.smallDays.value=s.small.days;f.bigEnabled.checked=s.big.enabled;f.bigMode.value=s.big.mode;f.bigCount.value=s.big.count;f.bigPieces.value=s.big.pieces;f.bigAmount.value=s.big.amount;f.bigUnit.value=s.big.unit;
        if(s.legacyBoundary&&!s.legacyBoundary.confirmed){const warning=document.createElement('p');warning.textContent='旧总结结束边界未确认，自动小总结暂停，已有进度保留。可确认从当前记录末尾继续，避免从头重复总结。';const resume=document.createElement('button');resume.type='button';resume.textContent='从当前记录末尾继续';resume.onclick=async()=>{if(!chat.history.length)return;s.legacyBoundary={segment:s.segment,endMessageId:chat.history.at(-1).id,confirmed:true};await saveData();overlay.remove();void tick();};box.querySelector('.journal-job-list').append(warning,resume);}
        box.querySelector('.journal-merge-progress').textContent=`未合并累计：${unmergedCoverage(chat,availableSmall(chat)).length}条；修改门槛保留累计量。`;
        const jobList=box.querySelector('.journal-job-list');
        for(const job of s.jobs){const row=document.createElement('div');row.textContent=`${job.kind==='merge'?'大总结':'小总结'}：${job.status==='paused'?'未完成':job.status==='running'?'生成中':'等待重试'} · 已请求${job.attempts}次 `;if(job.status==='paused'){const btn=document.createElement('button');btn.type='button';btn.textContent='重试';btn.onclick=async()=>{job.status='pending';job.attempts=0;job.retryAt=0;await saveData();overlay.remove();void tick();};row.append(btn);}jobList.append(row);}
        box.querySelector('.close-settings').onclick=()=>overlay.remove();
        box.onsubmit=async e=>{e.preventDefault();if(!box.reportValidity())return;const previous=clone(s.small);s.small={enabled:f.smallEnabled.checked,mode:f.smallMode.value,count:Number(f.smallCount.value),days:Number(f.smallDays.value)};s.big={enabled:f.bigEnabled.checked,mode:f.bigMode.value,count:Number(f.bigCount.value),pieces:Number(f.bigPieces.value),amount:Number(f.bigAmount.value),unit:f.bigUnit.value};if(previous.mode!==s.small.mode)delete s.dayCursor;await saveData();overlay.remove();showToast('自动总结设置已保存');void tick();};
        const books=document.createElement('button');books.type='button';books.className='journal-drawer-button';books.textContent='大总结世界书';books.onclick=()=>{overlay.remove();worldBooks(chat);};
        box.insertBefore(books,box.querySelector('.journal-settings-actions'));
        overlay.append(box);document.body.append(overlay);
    }
    function worldBooks(chat) {
        const s=state(chat),archive=chat.activeArchiveId||null;
        openWorldBookSelector(s.mergeWorldBookIds||[],{title:'大总结世界书',onSave:async ids=>{
            if(state(chat)!==s||(chat.activeArchiveId||null)!==archive)throw new Error('聊天存档已切换，请重新选择');
            const previous=s.mergeWorldBookIds;s.mergeWorldBookIds=ids;
            try{await saveData();}catch(error){s.mergeWorldBookIds=previous;throw error;}
            showToast('大总结世界书已保存');
        }});
    }
    function toolbar(chat,container) {
        document.getElementById('journal-auto-toolbar')?.remove();
        const header=document.querySelector('#memory-journal-screen > .app-header');if(!header)return;
        let left=header.querySelector('.journal-header-left');
        if(!left){left=document.createElement('div');left.className='journal-header-left';const back=header.querySelector('.back-btn');header.insertBefore(left,back);left.append(back);}
        let button=document.getElementById('journal-auto-settings-btn');
        if(!button){button=document.createElement('button');button.id='journal-auto-settings-btn';button.type='button';button.className='action-btn';button.title='自动总结设置';button.setAttribute('aria-label','自动总结设置');
            button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="white"/><circle cx="15" cy="12" r="2" fill="white"/><circle cx="9" cy="18" r="2" fill="white"/></svg>';left.append(button);}
        let api=document.getElementById('journal-summary-api-btn');
        if(!api){api=document.createElement('button');api.id='journal-summary-api-btn';api.type='button';api.className='action-btn';api.title='总结 API';api.setAttribute('aria-label','总结 API');api.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M6 6h12v12H6zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>';left.insertBefore(api,button);}
        let manual=document.getElementById('journal-add-written-btn');if(!manual){manual=document.createElement('button');manual.id='journal-add-written-btn';manual.type='button';manual.className='journal-drawer-button';manual.title='手动添加总结';manual.setAttribute('aria-label','手动添加总结');manual.textContent='＋ 手动添加总结';container.parentNode.insertBefore(manual,container);}manual.onclick=()=>window.UwUCharacterExtras.addJournal(chat);
        api.onclick=()=>window.SummaryApi.open(chat);
        button.onclick=()=>settings(chat);
    }
    window.JournalAutomation={onMessageInserted,summaryMessages,isAuxiliary,validTime,applyMessageTimes,refreshMessageTimes,suspend,detailTools,regenerate,syncEdited,deleteWithChoice,beginRoll,finishRoll,removeJournals,addWritten,favorites,state,migrate,attach,clearHistory,reconcileAll,queueAutomatic,runJob,tick,confirm:glassConfirm,mergeManual,decorate,toolbar,cardTime,rangeText,detailText,requestUpdate,collectCoverage,unmergedCoverage,availableSmall,unassigned,settlement,addPeriod,smallJob};
    window.addEventListener('uwu-db-ready',()=>{ready=true;for(const c of chats()){const s=migrate(c);for(const job of s.jobs)if(job.status==='running'){job.status='pending';job.retryAt=Date.now();}}reconcileAll();void saveData().then(()=>tick()).catch(console.error);setInterval(()=>void tick().catch(console.error),15000);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void tick().catch(console.error);});
})();
