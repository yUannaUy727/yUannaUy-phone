// 每轮附加内容：新回复用roundId绑定；旧记录只在能确认关联时配对。
(() => {
    function rounds(chat) {
        const map=new Map();let current=null;
        const add=(id,time)=>{if(!map.has(id))map.set(id,{id,timestamp:time||0,thinking:null,statuses:[],rawMessages:[]});return map.get(id);};
        for(const m of chat.history||[]){
            if(m.role==='user'){current=null;continue;}
            if(m.role!=='assistant')continue;
            if(m.roundId)current=add(m.roundId,m.timestamp);
            else if(m.isThinking)current=add('old-thinking-'+m.id,m.timestamp);
            else if(m.isStatusUpdate)current=add('old-raw-'+m.id,m.timestamp);
            else continue;
            if(m.isThinking)current.thinking=m;
            if(m.isStatusUpdate)current.rawMessages.push(m);
        }
        for(const status of chat.statusPanel?.history||[]){
            let row=status.roundId?add(status.roundId,status.timestamp):null;
            // 旧记录没有轮次标识，不猜测它与哪份思维链属于同一轮。
            if(!row){
                const matches=(chat.history||[]).filter(m=>isRawStatus(m)&&status.raw&&String(m.content).includes(status.raw));
                row=matches.length===1?add(matches[0].roundId||'old-raw-'+matches[0].id,matches[0].timestamp):add('old-status-'+status.timestamp+'-'+map.size,status.timestamp);
            }
            row.statuses.push(status);
        }
        if(!chat.statusPanel?.history?.length&&chat.statusPanel?.currentStatusHtml&&!chat.statusPanel?.deletedAll){
            add('old-current-status',0).statuses.push({html:chat.statusPanel.currentStatusHtml,raw:chat.statusPanel.currentStatusRaw,timestamp:0});
        }
        return [...map.values()].filter(r=>r.thinking||r.statuses.length||r.rawMessages.length).sort((a,b)=>a.timestamp-b.timestamp).slice(-20);
    }
    async function removeStatus(chat,row,all=false){
        const panel=chat.statusPanel;if(!panel)return;
        const before={history:panel.history,currentStatusRaw:panel.currentStatusRaw,currentStatusHtml:panel.currentStatusHtml,deletedAll:panel.deletedAll};
        panel.history=all?[]:(panel.history||[]).filter(s=>!row.statuses.includes(s));
        const newest=panel.history[0];panel.currentStatusRaw=newest?.raw||'';panel.currentStatusHtml=newest?.html||'';panel.deletedAll=!newest;
        try{await saveData();}catch(error){Object.assign(panel,before);throw error;}
        // 只删面板快照，不删聊天消息、人设和该轮思维链。
    }
    const isRawStatus=m=>m.role==='assistant'&&m.isStatusUpdate===true&&!m.isThinking;
    function rawForRow(chat,row){
        const explicit=(chat.history||[]).filter(m=>isRawStatus(m)&&(m.roundId===row.id||row.rawMessages?.some(r=>r.id===m.id)));
        if(explicit.length)return explicit;
        const candidates=(chat.history||[]).filter(m=>isRawStatus(m)&&row.statuses.some(s=>s.raw&&String(m.content).includes(s.raw)));
        return candidates.length===1?candidates:[];
    }
    function refreshChat(chat){
        if(typeof currentChatId!=='undefined'&&String(currentChatId)===String(chat.id)&&typeof renderMessages==='function')renderMessages(false,false);
    }
    function archiveRollback(chat){
        const archive=chat.archives?.find(a=>a.id===chat.activeArchiveId);
        const before=archive?{data:archive.data,updatedAt:archive.updatedAt}:null;
        return ()=>{if(archive)Object.assign(archive,before);};
    }
    function restoreHistory(chat,before){
        const known=new Set(before.map(m=>m.id));
        // 保存失败期间抵达的新消息仍保留，不用旧数组覆盖它们。
        const arrived=chat.history.filter(m=>!known.has(m.id));
        chat.history=arrived.length?[...before,...arrived]:before;
    }
    async function removeRawStatus(chat,row,all=false){
        const ids=new Set((all?chat.history.filter(isRawStatus):rawForRow(chat,row)).map(m=>m.id));
        const before=chat.history,restoreArchive=archiveRollback(chat);chat.history=before.filter(m=>!ids.has(m.id));
        try{await saveData();}catch(error){restoreHistory(chat,before);restoreArchive();throw error;}
        refreshChat(chat);
    }
    async function trimSnapshots(chat){
        const panel=chat.statusPanel;if(!panel?.history||panel.history.length<=20)return;
        const before=panel.history,restoreArchive=archiveRollback(chat);panel.history=before.slice(0,20);
        try{await saveData();}catch(error){panel.history=before;restoreArchive();throw error;}
    }
    function thoughtText(m){return m?window.SmartMessaging.stripNote(String(m.content||'')).clean.replace(/^\s*<thinking>/,'').replace(/<\/thinking>\s*$/,'').trim():'';}
    async function changeThinking(chat,id,text,expected){
        const m=chat.history.find(m=>m.id===id&&m.isThinking);if(!m)throw Error('这条思维链已经被删除');
        if(expected!==undefined&&m.content!==expected)throw Error('这条思维链已在另一处修改，请先取消并重新编辑');
        const before={...m},restoreArchive=archiveRollback(chat);const content='<thinking>'+String(text)+'</thinking>';
        m.content=content;if(m.parts)m.parts=[{type:'text',text:content}];if(m.originalContent!==undefined)m.originalContent=content;
        try{await saveData();}catch(error){Object.assign(m,before);restoreArchive();throw error;}
        refreshChat(chat);
    }
    async function removeThinking(chat,id){
        const before=chat.history,restoreArchive=archiveRollback(chat);chat.history=before.filter(m=>!(m.id===id&&m.isThinking));
        try{await saveData();}catch(error){restoreHistory(chat,before);restoreArchive();throw error;}
        refreshChat(chat);
    }
    const hasSnapshots=chat=>!!(chat.statusPanel?.history?.length||(!chat.statusPanel?.deletedAll&&chat.statusPanel?.currentStatusHtml));
    let activeViewer=null;
    function thinkingCard(chat,row){
        const card=document.createElement('div');card.className='status-thinking-text';
        const tools=document.createElement('div');tools.className='status-thinking-tools';
        const edit=document.createElement('button'),del=document.createElement('button');edit.type=del.type='button';
        const pencil='<path d="M14 4l6 6M4 20l5-1L20 8a2 2 0 0 0-4-4L5 15z"/>';
        const check='<path d="M5 12l4 4L19 6"/>';
        const trash='<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>';
        const icon=(button,title,path)=>{button.title=title;button.setAttribute('aria-label',title);button.innerHTML='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';};
        icon(edit,'修改思维链',pencil);icon(del,'删除此思维链',trash);tools.append(edit,del);
        const pre=document.createElement('pre');pre.className='status-thinking-body';
        const input=document.createElement('textarea');input.className='status-thinking-editor';input.setAttribute('aria-label','编辑本轮思维链');input.hidden=true;
        const notice=document.createElement('p');notice.className='status-thinking-notice';notice.hidden=true;
        card.append(tools,pre,input,notice);
        let editing=false,saving=false,original=null;
        const message=()=>chat.history.find(m=>m.id===row.thinking?.id&&m.isThinking);
        const sync=()=>{
            const m=message();if(!editing)pre.textContent=m?thoughtText(m):'本轮暂无思维链';
            edit.disabled=saving||!m;del.disabled=saving||!m;tools.hidden=!m&&!editing;
        };
        const cancel=()=>{if(saving)return;editing=false;input.hidden=true;pre.hidden=false;notice.hidden=true;icon(edit,'修改思维链',pencil);sync();};
        input.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();cancel();}});
        edit.addEventListener('click',async()=>{
            if(saving)return;
            const m=message();if(!m)return;
            if(!editing){editing=true;original=m.content;input.value=thoughtText(m);input.hidden=false;pre.hidden=true;icon(edit,'确认修改',check);input.focus?.();return;}
            saving=true;sync();notice.hidden=true;
            try{await changeThinking(chat,m.id,input.value,original);saving=false;cancel();}
            catch(error){saving=false;notice.hidden=false;notice.textContent='修改未保存：'+error.message;sync();}
        });
        del.addEventListener('click',async()=>{
            if(saving)return;const m=message();if(!m)return;
            if(!confirm('确定删除这一条思维链？不会删除状态栏或聊天回复。'))return;
            saving=true;sync();
            try{await removeThinking(chat,m.id);saving=false;cancel();}
            catch(error){saving=false;notice.hidden=false;notice.textContent='删除未保存成功，已恢复记录，请重试';sync();}
        });
        sync();return {card,sync,isEditing:()=>editing};
    }
    async function open(chatId,selectedId=null,showBack=false){
        const chat=db.characters.find(c=>c.id===chatId);if(!chat)return;
        try{if(chat.statusPanel?.history?.length>20)await trimSnapshots(chat);}catch(error){showToast('旧面板记录清理未保存成功，请重试');return;}
        const content=document.getElementById('char-status-content'),overlay=document.getElementById('char-status-overlay');
        if(!content||!overlay)return;
        let rows=rounds(chat);
        if(!db.statusThinkingEnabled)rows=rows.filter(r=>r.statuses.length);
        if(!rows.length)rows.push({id:'empty',statuses:[],thinking:null});
        let index=selectedId?rows.findIndex(r=>r.id===selectedId):rows.length-1;
        if(index<0)index=rows.length-1;
        let back=showBack&&!!db.statusThinkingEnabled,removing=false;
        content.classList.remove('reply-detail-panel');content.replaceChildren();
        for(const id of ['status-delete-current','status-delete-all','status-delete-picker','status-flip-face'])document.getElementById(id)?.remove();
        const swiper=document.createElement('div');swiper.className='status-swiper';
        const indicator=document.createElement('div');indicator.className='status-indicator';
        const button=(id,label,path)=>{
            const el=document.createElement('button');el.id=id;el.type='button';el.className='status-glass-action';el.title=label;el.setAttribute('aria-label',label);
            el.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
            overlay.appendChild(el);return el;
        };
        const del=button('status-delete-current','删除状态栏','<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>');
        const flip=button('status-flip-face','翻到思维链','<rect x="7" y="4" width="13" height="16" rx="3"/><path d="M13.5 8v8M4 16a6 6 0 0 1 0-9M1 7h3v3"/>');
        flip.hidden=!db.statusThinkingEnabled;
        overlay.classList.toggle('status-has-flip',!!db.statusThinkingEnabled);
        const faces=[];
        rows.forEach(row=>{
            const slide=document.createElement('div');slide.className='status-slide';
            const front=document.createElement('div');front.className='status-slide-inner';
            const rear=document.createElement('div');rear.className='status-slide-inner status-thinking-face';
            slide.append(front,rear);swiper.appendChild(slide);faces.push({front,rear,frontLoaded:false,backLoaded:false});
        });
        const load=(i)=>{
            if(i<0||i>=rows.length)return;
            const face=faces[i],row=rows[i];
            if(!face.frontLoaded){
                face.frontLoaded=true;
                if(!row.statuses.length){const p=document.createElement('p');p.className='status-face-empty';p.textContent='本轮暂无状态栏';face.front.appendChild(p);}
                else for(const status of row.statuses){
                    const html=typeof processTemplate==='function'?processTemplate(status.html||'',chat):(status.html||'');
                    // 沿用原状态栏：完整HTML/样式放iframe，普通模板直接渲染。
                    if(/<!DOCTYPE html>|<html|<style/i.test(html)){
                        const frame=document.createElement('iframe');frame.title='本轮状态栏';frame.style.cssText='width:100%;height:100%;min-height:80vh;border:none;background:transparent;display:block;';frame.srcdoc=html;face.front.appendChild(frame);
                    }else face.front.insertAdjacentHTML('beforeend',html);
                }
            }
            if(back&&!face.backLoaded){
                face.backLoaded=true;
                face.editor=thinkingCard(chat,row);face.rear.appendChild(face.editor.card);
            }
        };
        const draw=()=>{
            for(const f of faces){f.front.hidden=back;f.rear.hidden=!back;f.editor?.sync();}
            for(let i=index-2;i<=index+2;i++)load(i);
            indicator.textContent=(index+1)+' / '+rows.length;
            flip.title=back?'翻到状态栏':'翻到思维链';flip.setAttribute('aria-label',flip.title);flip.setAttribute('aria-pressed',String(back));
            del.disabled=removing||(!hasSnapshots(chat)&&!chat.history.some(isRawStatus));
        };
        content.append(swiper,indicator);
        flip.addEventListener('click',()=>{back=!back;draw();});
        swiper.addEventListener('scroll',()=>{
            if(swiper.offsetWidth>0){index=Math.max(0,Math.min(rows.length-1,Math.round(swiper.scrollLeft/swiper.offsetWidth)));draw();}
        });
        const deletion=async (row,isAll,raw=false)=>{
            if(removing)return;
            document.getElementById('status-delete-picker')?.remove();
            const scope=(raw?'原始状态栏消息':'面板快照');
            if(!await window.JournalAutomation.confirm('确认删除',`确定删除${isAll?'全部':'当前'}${scope}？此操作不会删除另一类状态栏。`))return;
            removing=true;draw();
            try{await (raw?removeRawStatus(chat,row,isAll):removeStatus(chat,row,isAll));open(chatId,row.id,back);}catch(error){console.error(error);showToast('删除未保存成功，已恢复原状态，请重试');removing=false;draw();}
        };
        del.addEventListener('click',()=>{
            if(removing||document.getElementById('status-delete-picker'))return;
            const row=rows[index];
            const picker=document.createElement('div');picker.id='status-delete-picker';picker.className='status-delete-picker';
            const dialog=document.createElement('div');dialog.className='status-delete-options';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','删除状态栏');
            const title=document.createElement('p');title.textContent='要删除哪些状态栏？';dialog.appendChild(title);
            const dismiss=()=>{picker.remove();del.focus?.();};
            const choice=(text,disabled,action)=>{const el=document.createElement('button');el.type='button';el.textContent=text;el.disabled=disabled;el.addEventListener('click',action);dialog.appendChild(el);return el;};
            const current=choice('仅删除当前面板快照',!row.statuses.length,()=>deletion(row,false));
            const all=choice('删除全部面板快照',!hasSnapshots(chat),()=>deletion(row,true));
            const rawCurrent=choice('删除当前原始状态栏消息',!rawForRow(chat,row).length,()=>deletion(row,false,true));
            const rawAll=choice('删除全部原始状态栏消息',!chat.history.some(isRawStatus),()=>deletion(row,true,true));
            choice('取消',false,dismiss);
            picker.appendChild(dialog);overlay.appendChild(picker);
            picker.addEventListener('click',event=>{if(event.target===picker)dismiss();});
            picker.addEventListener('keydown',event=>{
                if(event.key==='Escape'){event.preventDefault();dismiss();}
                if(event.key==='Tab'){
                    const buttons=Array.from(dialog.querySelectorAll('button')).filter(b=>!b.disabled),first=buttons[0],last=buttons.at(-1);
                    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
                    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
                }
            });
            [current,all,rawCurrent,rawAll].find(b=>!b.disabled)?.focus?.();
        });
        activeViewer={chatId,sync:()=>{if(overlay.classList.contains('visible'))draw();}};
        draw();overlay.classList.add('visible');
        // 与原版相同，打开时定位最新页；删除后保留当前轮次。
        setTimeout(()=>{if(!swiper.isConnected)return;swiper.style.scrollBehavior='auto';swiper.scrollLeft=index*swiper.offsetWidth;setTimeout(()=>{swiper.style.scrollBehavior='smooth';},50);},0);
    }
    window.ReplyDetails={open,rounds,removeStatus,removeRawStatus,rawForRow,trimSnapshots,changeThinking,removeThinking,thinkingCard,sync(chat){if(activeViewer?.chatId===chat.id)activeViewer.sync();}};
    const scheduled=new WeakSet();
    window.ChatViewWork={scroll(el){if(scheduled.has(el))return;scheduled.add(el);const run=()=>{scheduled.delete(el);el.scrollTop=el.scrollHeight;};if(typeof requestAnimationFrame==='function')requestAnimationFrame(run);else run();}};
})();
