// 命名世界书预设：共享组合 + 每个角色独立追加，沿用原世界书ID及提示词读取。
(() => {
    const allChats=()=>[...(db.characters||[]),...(db.groups||[])];
    const uid=()=> 'wb_preset_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    function list(){if(!Array.isArray(db.worldBookPresets))db.worldBookPresets=[];return db.worldBookPresets;}
    function entries(ids){const valid=new Set((db.worldBooks||[]).filter(w=>w.type!=='folder').map(w=>w.id));return [...new Set(ids||[])].filter(id=>valid.has(id));}
    function ensure(chat){if(!Array.isArray(chat.worldBookPresetIds))chat.worldBookPresetIds=[];if(!Array.isArray(chat.worldBookExtraIds))chat.worldBookExtraIds=[...(chat.worldBookIds||[])];}
    function inherited(chat){ensure(chat);return entries(list().filter(p=>chat.worldBookPresetIds.includes(p.id)).flatMap(p=>p.worldBookIds));}
    function sync(chat){ensure(chat);chat.worldBookPresetIds=chat.worldBookPresetIds.filter(id=>list().some(p=>p.id===id));chat.worldBookExtraIds=entries(chat.worldBookExtraIds);chat.worldBookIds=[...new Set([...inherited(chat),...chat.worldBookExtraIds])];}
    function syncAll(){const active=c=>Array.isArray(c.worldBookPresetIds)||Array.isArray(c.worldBookExtraIds);for(const chat of allChats()){if(active(chat))sync(chat);for(const archive of chat.archives||[])if(archive.data&&active(archive.data))sync(archive.data);}}
    function modal(title){const overlay=document.createElement('div'),box=document.createElement('div'),h=document.createElement('h3');overlay.className='v18-glass-overlay';box.className='v18-glass-dialog journal-auto-settings';h.textContent=title;box.append(h);overlay.append(box);document.body.append(overlay);return {overlay,box};}
    function button(box,label,fn){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=fn;box.append(b);return b;}
    function refreshChat(chat){if(chat.id===currentChatId&&typeof renderBoundWorldBooks==='function')renderBoundWorldBooks(currentChatType,chat.worldBookIds);}
    async function persistPreset(id,name,ids){
        name=name.trim();if(!name)throw new Error('请填写预设名称');
        if(list().some(p=>p.id!==id&&p.name===name))throw new Error('预设名称已存在，请使用不同名字');
        const old=JSON.parse(JSON.stringify(list())),at=list().findIndex(p=>p.id===id),p={id:id||uid(),name,worldBookIds:entries(ids)};
        if(at>=0)db.worldBookPresets[at]=p;else list().push(p);syncAll();
        try{await saveData();}catch(error){db.worldBookPresets=old;syncAll();throw error;}
        return p;
    }
    function manage(){
        const {overlay,box}=modal('世界书预设');const items=list();
        if(!items.length){const p=document.createElement('p');p.textContent='先创建常用世界书组合，再到角色聊天设置中绑定。';box.append(p);}
        for(const preset of items){const row=document.createElement('div');row.className='wb-preset-row';const label=document.createElement('span');label.textContent=preset.name+' · '+entries(preset.worldBookIds).length+'本';row.append(label);
            button(row,'编辑',()=>{overlay.remove();edit(preset);});button(row,'删除',async()=>{
                if(!await JournalAutomation.confirm('删除预设？','仅解除该预设绑定，世界书原文及角色单独追加的世界书保留。','删除预设'))return;
                const old=JSON.parse(JSON.stringify(list())),bindings=allChats().flatMap(c=>[c,...(c.archives||[]).map(a=>a.data).filter(Boolean)]).map(c=>[c,[...(c.worldBookPresetIds||[])]]);
                db.worldBookPresets=list().filter(p=>p.id!==preset.id);syncAll();
                try{await saveData();overlay.remove();manage();}catch(error){db.worldBookPresets=old;for(const[c,ids]of bindings)c.worldBookPresetIds=ids;syncAll();showToast('预设删除未保存成功');}
            });box.append(row);
        }
        button(box,'新增预设',()=>{overlay.remove();edit();});button(box,'关闭',()=>overlay.remove());
    }
    function edit(preset=null){
        const {overlay,box}=modal(preset?'编辑世界书预设':'新增世界书预设');const name=document.createElement('input');name.type='text';name.placeholder='预设名称';name.value=preset?.name||'';name.className='wb-preset-name';box.append(name);
        let ids=[...(preset?.worldBookIds||[])];const note=document.createElement('p');const update=()=>{note.textContent='已选择 '+entries(ids).length+' 本世界书';};update();box.append(note);
        button(box,'选择世界书',()=>{overlay.style.display='none';openWorldBookSelector(ids,{title:'预设世界书',onSave:async selected=>{ids=selected;update();},onClose:()=>{overlay.style.display='flex';}});});
        const tip=document.createElement('p');tip.textContent='修改预设后，绑定它的角色会同步更新；角色单独追加的世界书保留。';box.append(tip);
        button(box,'保存',async()=>{try{await persistPreset(preset?.id,name.value,ids);overlay.remove();manage();showToast('世界书预设已保存');}catch(error){showToast(error.message||'保存失败');}});
        button(box,'取消',()=>{overlay.remove();manage();});
    }
    function bind(chat){
        ensure(chat);const owner=chat.activeArchiveId||null,{overlay,box}=modal('绑定世界书预设');const selected=new Set(chat.worldBookPresetIds);
        for(const preset of list()){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=selected.has(preset.id);check.onchange=()=>{if(check.checked)selected.add(preset.id);else selected.delete(preset.id);};label.append(check,document.createTextNode(preset.name+' · '+entries(preset.worldBookIds).length+'本'));box.append(label);}
        const note=document.createElement('p');note.textContent=list().length?'可以绑定多个预设，重复世界书只使用一次。“设置”入口用于此角色单独追加世界书。':'还没有预设，请先在世界书页面的加号菜单中创建。';box.append(note);
        button(box,'保存',async()=>{if((chat.activeArchiveId||null)!==owner){showToast('存档已切换，请重新设置');return;}const old=[...chat.worldBookPresetIds];chat.worldBookPresetIds=[...selected];sync(chat);try{await saveData();overlay.remove();refreshChat(chat);showToast('预设绑定已保存');}catch(error){chat.worldBookPresetIds=old;sync(chat);showToast('绑定未保存成功');}});
        button(box,'取消',()=>overlay.remove());
    }
    window.WorldBookPresets={list,ensure,inherited,sync,syncAll,manage,bind,persistPreset};
    document.addEventListener('DOMContentLoaded',()=>{document.getElementById('wb-menu-presets')?.addEventListener('click',manage);});
})();
