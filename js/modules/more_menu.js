// --- Menu Screen & Status Bar Manager Logic ---

// 初始化 Menu 页面
function initMoreMenu() {
    // 初始化搜索模块
    if (window.SearchSystem) {
        window.SearchSystem.init();
        
        // 绑定搜索入口点击
        const searchEntry = document.querySelector('.search-bar-decoration');
        if (searchEntry) {
            searchEntry.addEventListener('click', () => {
                window.SearchSystem.open();
            });
        }
    }

    const menuGrid = document.querySelector('.menu-grid');
    if (!menuGrid) return;

    menuGrid.addEventListener('click', (e) => {
        const item = e.target.closest('.menu-item');
        if (!item) return;

        const action = item.dataset.action;
        if (action === 'status-bar') {
            openStatusBarManager();
        } else if (action === 'calendar') {
            window.CalendarUI.open();
        } else if (action === 'star') {
            showToast('收藏功能开发中...');
        } else if (action === 'drawing-workshop') {
            switchScreen('drawing-workshop-screen');
        } else if (action === 'cot-settings') {
            switchScreen('cot-settings-screen');
        }
    });

    // 绑定状态栏管理界面的按钮事件
    const addStatusPresetBtn = document.getElementById('add-status-preset-btn');
    if (addStatusPresetBtn) {
        addStatusPresetBtn.addEventListener('click', () => {
            openStatusBarEditor();
        });
    }

    const folderButton = document.getElementById('add-status-folder-btn');
    if(folderButton)folderButton.onclick=()=>createStatusBarFolder().catch(e=>showToast(e.message));

    const saveStatusPresetBtn = document.getElementById('save-status-preset-btn');
    if (saveStatusPresetBtn) {
        saveStatusPresetBtn.addEventListener('click', saveStatusBarPreset);
    }

    const importStatusPresetBtn = document.getElementById('import-status-preset-btn');
    if (importStatusPresetBtn) importStatusPresetBtn.addEventListener('click', () => document.getElementById('status-preset-import-input').click());

    const statusPresetImportInput = document.getElementById('status-preset-import-input');
    if (statusPresetImportInput) statusPresetImportInput.addEventListener('change', importStatusBarPreset);

// 初始化编辑器预览逻辑
initStatusBarPreview();
}

// 简单的 HTML 转义函数
function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, '"')
        .replace(/'/g, "&#039;");
}

// Folders share the existing preset collection so normal save/backup includes them.
let statusFolderId=null,statusEditorParentId=null,statusWriteBusy=false,statusPickerClose=null;
const statusFolderIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
function statusItems(){return db.statusBarPresets||[];}
function statusFind(id){return statusItems().find(p=>p.id===id);}
function statusIsFolder(id){return !!id&&statusFind(id)?.type==='folder';}
function statusParent(item){let id=item?.parentId,seen=new Set([item?.id]);const parent=statusFind(id);if(!parent||parent.type!=='folder')return null;while(id){if(seen.has(id))return null;seen.add(id);const p=statusFind(id);if(!p||p.type!=='folder')break;id=p.parentId;}return parent.id;}
function statusPath(id){const result=[],seen=new Set();while(statusIsFolder(id)&&!seen.has(id)){seen.add(id);const p=statusFind(id);result.unshift(p);id=p.parentId;}return result;}
function statusDescendant(id,parent){return id===parent||statusPath(parent).some(p=>p.id===id);}
function statusNode(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function statusButton(text,fn,cls='sb-folder-button'){const b=statusNode('button',text,cls);b.type='button';b.onclick=e=>{e?.stopPropagation();return Promise.resolve().then(fn).catch(error=>showToast(error.message||'操作失败'));};return b;}
async function statusWrite(change){if(statusWriteBusy)throw Error('正在保存，请稍候');statusWriteBusy=true;const original=db.statusBarPresets;db.statusBarPresets=statusItems().map(p=>({...p}));try{change();await saveData();}catch(error){db.statusBarPresets=original;throw error;}finally{statusWriteBusy=false;}}
function statusCrumbs(host,id,go){host.replaceChildren();host.append(statusButton('全部',()=>go(null)));for(const p of statusPath(id)){host.append(statusNode('span','›','sb-folder-separator'),statusButton(p.name,()=>go(p.id)));}}
function statusFolderSelect(select,value){select.replaceChildren();const root=statusNode('option','根目录');root.value='';select.append(root);for(const p of statusItems().filter(p=>p.type==='folder')){const option=statusNode('option',statusPath(p.id).map(p=>p.name).join(' / '));option.value=p.id;select.append(option);}select.value=statusIsFolder(value)?value:'';}
async function createStatusBarFolder(){const name=prompt('文件夹名称：')?.trim();if(!name)return;const parent=statusIsFolder(statusFolderId)?statusFolderId:null;await statusWrite(()=>{db.statusBarPresets.push({id:'sb_folder_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),type:'folder',name,parentId:parent});});renderStatusBarManager();}
async function renameStatusBarFolder(id){const folder=statusFind(id);if(folder?.type!=='folder')return;const name=prompt('文件夹名称：',folder.name)?.trim();if(!name||name===folder.name)return;await statusWrite(()=>{const current=statusFind(id);if(current?.type!=='folder')throw Error('文件夹已不存在');current.name=name;});renderStatusBarManager();}
async function deleteStatusBarFolder(id){const folder=statusFind(id);if(folder?.type!=='folder'||!confirm('删除此文件夹？其中的状态栏和子文件夹会移回上一级，不会删除。'))return;await statusWrite(()=>{const current=statusFind(id);if(current?.type!=='folder')throw Error('文件夹已不存在');const parent=statusParent(current);for(const item of statusItems())if(item.parentId===id)item.parentId=parent;db.statusBarPresets=statusItems().filter(p=>p.id!==id);});if(statusFolderId===id)statusFolderId=null;renderStatusBarManager();}
function openStatusBrowser({mode='select',itemId=null,onSelect}={}){
 statusPickerClose?.();let folder=null,query='';const focus=document.activeElement;
 const overlay=statusNode('div',undefined,'sb-folder-overlay'),box=statusNode('div',undefined,'sb-folder-dialog');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label',mode==='move'?'移动到文件夹':'选择状态栏');
 const close=()=>{overlay.remove();if(statusPickerClose===close)statusPickerClose=null;if(focus?.isConnected)focus.focus({preventScroll:true});};statusPickerClose=close;
 const header=statusNode('div',undefined,'sb-folder-dialog-head');header.append(statusNode('strong',mode==='move'?'移动到文件夹':'选择状态栏'),statusButton('×',close));
 const search=statusNode('input',undefined,'sb-folder-search');search.type='search';search.placeholder=mode==='move'?'搜索文件夹':'搜索状态栏';search.setAttribute('aria-label',search.placeholder);
 const crumbs=statusNode('nav',undefined,'sb-folder-crumbs'),list=statusNode('div',undefined,'sb-folder-browser-list'),footer=statusNode('div',undefined,'sb-folder-dialog-footer');
 const go=id=>{folder=id;query='';search.value='';draw();};
 const move=statusButton('移到这里',async()=>{if(query.trim())return;if(folder&&!statusIsFolder(folder))throw Error('目标文件夹已不存在');await statusWrite(()=>{const item=statusFind(itemId);if(!item)throw Error('状态栏或文件夹已不存在');if(item.type==='folder'&&statusDescendant(item.id,folder))throw Error('不能移入自身或子文件夹');item.parentId=folder;});close();renderStatusBarManager();},'sb-folder-primary');
 if(mode==='move')footer.append(statusButton('取消',close),move);else footer.append(statusButton('取消',close));
 function draw(){
  if(folder&&!statusIsFolder(folder))folder=null;statusCrumbs(crumbs,folder,go);list.replaceChildren();
  const term=query.trim().toLocaleLowerCase(),items=statusItems().filter(p=>mode!=='move'||p.type==='folder').filter(p=>mode!=='move'||!statusDescendant(itemId,p.id)).filter(p=>term?String(p.name||'').toLocaleLowerCase().includes(term):statusParent(p)===folder).sort((a,b)=>Number(b.type==='folder')-Number(a.type==='folder'));
  if(!items.length)list.append(statusNode('p',term?'没有匹配的内容':'文件夹为空','sb-folder-empty'));
  for(const item of items){const isFolder=item.type==='folder',row=statusButton('',()=>{const current=statusFind(item.id);if(!current)throw Error('该条目已不存在');if(current.type==='folder')go(current.id);else{onSelect?.(current);close();}},'sb-folder-browser-row');if(isFolder){const icon=statusNode('span',undefined,'sb-folder-icon');icon.innerHTML=statusFolderIcon;row.append(icon);}const label=statusNode('span',undefined,'sb-folder-label');label.append(statusNode('span',item.name));if(term){label.append(statusNode('small',statusPath(statusParent(item)).map(p=>p.name).join(' / ')||'根目录'));}row.append(label,statusNode('span',isFolder?'›':'选择','sb-folder-row-tail'));list.append(row);}
  move.disabled=!!term;move.title=term?'请先进入目标文件夹':'';
 }
 search.oninput=()=>{query=search.value;draw();};overlay.onclick=e=>{if(e.target===overlay)close();};overlay.addEventListener('keydown',e=>{if(e.key==='Escape')close();});box.append(header,search,crumbs,list,footer);overlay.append(box);document.body.append(overlay);draw();search.focus({preventScroll:true});return {close,go};
}
function openStatusBarSelector(){
 const ids=['setting-status-prompt-suffix','setting-status-regex','setting-status-replace'],fields=ids.map(id=>document.getElementById(id)),button=document.getElementById('setting-status-preset-select');
 const chatId=typeof currentChatId==='undefined'?null:currentChatId,chatType=typeof currentChatType==='undefined'?null:currentChatType;
 return openStatusBrowser({onSelect:p=>{if(fields.some((n,i)=>!n||!n.isConnected||document.getElementById(ids[i])!==n)||(typeof currentChatId!=='undefined'&&currentChatId!==chatId)||(typeof currentChatType!=='undefined'&&currentChatType!==chatType))throw Error('聊天已切换，请重新选择');fields[0].value=p.promptSuffix||'';fields[1].value=p.regexPattern||'';fields[2].value=p.replacePattern||'';if(button?.isConnected){button.value=p.id;button.textContent=p.name+' ›';}}});
}

// 打开状态栏管理界面
function openStatusBarManager(){renderStatusBarManager();switchScreen('status-bar-manager-screen');}
function renderStatusBarManager(){
 const host=document.getElementById('status-bar-preset-list');if(!host)return;if(!statusIsFolder(statusFolderId))statusFolderId=null;
 const crumbs=document.getElementById('sb-folder-breadcrumb');if(crumbs)statusCrumbs(crumbs,statusFolderId,id=>{statusFolderId=id;const search=document.getElementById('sb-manager-search');if(search)search.value='';renderStatusBarManager();});
 const search=document.getElementById('sb-manager-search');if(search)search.oninput=renderStatusBarManager;const term=search?.value.trim().toLocaleLowerCase()||'';
 host.replaceChildren();const items=statusItems().filter(p=>term?String(p.name||'').toLocaleLowerCase().includes(term):statusParent(p)===statusFolderId).sort((a,b)=>Number(b.type==='folder')-Number(a.type==='folder'));
 if(!items.length){host.append(statusNode('p',term?'没有匹配的状态栏或文件夹':'暂无内容，点击右上角添加','sb-folder-empty'));return;}
 for(const item of items){const folder=item.type==='folder',card=statusNode('div',undefined,'preset-card'+(folder?' sb-folder-card':'')),info=statusNode('button',undefined,'sb-folder-card-main');info.type='button';info.onclick=()=>{if(folder){statusFolderId=item.id;if(search)search.value='';renderStatusBarManager();}else openStatusBarEditor(item.id);};
  if(folder){const icon=statusNode('span',undefined,'sb-folder-icon');icon.innerHTML=statusFolderIcon;info.append(icon);}const text=statusNode('span',undefined,'preset-info-col');text.append(statusNode('span',item.name,'preset-name'),statusNode('span',folder?statusItems().filter(p=>statusParent(p)===item.id).length+' 项':(item.promptSuffix||'无 Prompt 后缀'),'preset-desc'));info.append(text);
  const actions=statusNode('div',undefined,'preset-actions-col');actions.append(statusButton('移动',()=>openStatusBrowser({mode:'move',itemId:item.id}),'preset-action-btn sb-folder-text-action'));
  if(folder)actions.append(statusButton('改名',()=>renameStatusBarFolder(item.id),'preset-action-btn sb-folder-text-action'));else actions.append(statusButton('导出',()=>exportStatusBarPreset(item.id),'preset-action-btn sb-folder-text-action'));
  actions.append(statusButton('删除',()=>folder?deleteStatusBarFolder(item.id):deleteStatusBarPreset(item.id),'preset-action-btn delete sb-folder-text-action'));card.append(info,actions);host.append(card);
 }
}

// 打开状态栏编辑器（新增或编辑）
window.openStatusBarEditor = function(presetId = null) {
    const title = document.getElementById('status-bar-editor-title');
    const nameInput = document.getElementById('sb-preset-name');
    const promptInput = document.getElementById('sb-preset-prompt');
    const regexInput = document.getElementById('sb-preset-regex');
    const htmlInput = document.getElementById('sb-preset-html');
    const idInput = document.getElementById('sb-preset-id');
    const testInput = document.getElementById('sb-test-input');

    const folderSelect=document.getElementById('sb-preset-folder');
    statusEditorParentId=presetId?statusParent(statusFind(presetId)):statusFolderId;
    if(folderSelect)statusFolderSelect(folderSelect,statusEditorParentId);
    if (presetId) {
        const preset = statusItems().find(p => p.id === presetId && p.type!=='folder');
        if(!preset){showToast('预设已不存在');return;}
        if (preset) {
            title.textContent = '编辑预设';
            nameInput.value = preset.name;
            promptInput.value = preset.promptSuffix;
            regexInput.value = preset.regexPattern;
            htmlInput.value = preset.replacePattern;
            idInput.value = preset.id;
        }
    } else {
        title.textContent = '新建预设';
        nameInput.value = '';
        promptInput.value = '';
        regexInput.value = '';
        htmlInput.value = '';
        idInput.value = '';
    }

    // 重置测试输入和预览
    testInput.value = '';
    updateStatusBarPreview(); // 触发一次预览更新

    switchScreen('status-bar-editor-screen');
};

// 初始化状态栏预览逻辑
function initStatusBarPreview() {
    const inputs = ['sb-test-input', 'sb-preset-regex', 'sb-preset-html'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateStatusBarPreview);
        }
    });
}

// 更新预览
function updateStatusBarPreview() {
    const testText = document.getElementById('sb-test-input').value;
    const regexStr = document.getElementById('sb-preset-regex').value;
    const htmlTpl = document.getElementById('sb-preset-html').value;
    const statusTag = document.getElementById('sb-match-status');
    const previewContainer = document.getElementById('sb-preview-container');

    if (!testText || !regexStr) {
        statusTag.textContent = '等待输入';
        statusTag.className = 'status-tag';
        previewContainer.innerHTML = '<span style="color:#ccc;">请输入测试文本和正则...</span>';
        return;
    }

    try {
        const regex = new RegExp(regexStr);
        const match = testText.match(regex);

        if (match) {
            statusTag.textContent = '匹配成功';
            statusTag.className = 'status-tag success';
            
            let resultHtml = htmlTpl;
            // 替换 $1, $2 等变量
            // 注意：match[0] 是完整匹配，match[1] 是第一个捕获组
            // 用户习惯用 $1 代表第一个捕获组
            
            // 倒序替换，防止 $1 误伤 $10
            for (let i = match.length - 1; i >= 1; i--) {
                // 对捕获内容进行 HTML 转义，防止破坏布局
                const safeContent = escapeHtml(match[i]);
                resultHtml = resultHtml.replace(new RegExp('\\$' + i, 'g'), safeContent);
            }
            
            previewContainer.innerHTML = resultHtml;
        } else {
            statusTag.textContent = '未匹配';
            statusTag.className = 'status-tag';
            previewContainer.innerHTML = '<span style="color:#999;">正则未匹配到内容</span>';
        }
    } catch (e) {
        statusTag.textContent = '正则错误';
        statusTag.className = 'status-tag error';
        previewContainer.innerHTML = `<span style="color:red;">${e.message}</span>`;
    }
}

// 导出单个预设
window.exportStatusBarPreset = function(presetId) {
    const preset = statusItems().find(p => p.id === presetId && p.type!=='folder');
    if (!preset) return;

    const data = JSON.stringify(preset, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `status_preset_${preset.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

// 导入预设
function importStatusBarPreset(e){const file=e.target.files[0];if(!file)return;const parent=statusIsFolder(statusFolderId)?statusFolderId:null;const reader=new FileReader();reader.onload=async event=>{try{const imported=JSON.parse(event.target.result),items=Array.isArray(imported)?imported:[imported];if(!items.length||items.some(p=>!p||typeof p.name!=='string'||typeof p.regexPattern!=='string'||p.type==='folder'))throw Error('无效的预设文件');await statusWrite(()=>{if(parent&&!statusIsFolder(parent))throw Error('导入目标文件夹已不存在');for(const p of items)db.statusBarPresets.push({...p,id:'sb_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9),type:'entry',parentId:parent});});renderStatusBarManager();showToast('成功导入 '+items.length+' 个预设');}catch(error){showToast(error.message||'导入失败');}};reader.readAsText(file);e.target.value='';}

// 保存预设
async function saveStatusBarPreset(){const id=document.getElementById('sb-preset-id').value,name=document.getElementById('sb-preset-name').value.trim(),promptSuffix=document.getElementById('sb-preset-prompt').value,regexPattern=document.getElementById('sb-preset-regex').value,replacePattern=document.getElementById('sb-preset-html').value,parentId=document.getElementById('sb-preset-folder')?.value||null;if(!name)return showToast('请输入预设名称');try{new RegExp(regexPattern);}catch{return showToast('正则表达式无效，请检查');}try{await statusWrite(()=>{if(parentId&&!statusIsFolder(parentId))throw Error('文件夹已不存在，请重新选择');if(id){const preset=statusFind(id);if(!preset||preset.type==='folder')throw Error('预设已不存在');Object.assign(preset,{name,promptSuffix,regexPattern,replacePattern,parentId});}else db.statusBarPresets.push({id:'sb_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9),name,promptSuffix,regexPattern,replacePattern,parentId});});statusFolderId=parentId;showToast('预设已保存');openStatusBarManager();}catch(error){showToast(error.message||'保存失败');}}

// 删除预设
window.deleteStatusBarPreset=async function(presetId,event){event?.stopPropagation();if(!statusFind(presetId)||!confirm('确定要删除这个预设吗？'))return;try{await statusWrite(()=>{db.statusBarPresets=statusItems().filter(p=>p.id!==presetId);});renderStatusBarManager();showToast('预设已删除');}catch(error){showToast(error.message||'删除失败');}};

// 填充设置页面的下拉框 (供 settings.js 调用)
function populateStatusBarPresetSelect(){const button=document.getElementById('setting-status-preset-select');if(!button)return;const fields=['setting-status-prompt-suffix','setting-status-regex','setting-status-replace'].map(id=>document.getElementById(id)?.value||'');const match=fields.some(Boolean)?statusItems().find(p=>p.type!=='folder'&&[p.promptSuffix||'',p.regexPattern||'',p.replacePattern||''].every((v,i)=>v===fields[i])):null;button.value=match?.id||'';button.textContent=match?match.name+' ›':'选择状态栏 ›';button.onclick=openStatusBarSelector;const quick=document.getElementById('quick-save-status-preset-btn');if(quick)quick.onclick=saveStatusBarPresetFromSettings;}

// 从设置界面快速保存预设
async function saveStatusBarPresetFromSettings(){const promptSuffix=document.getElementById('setting-status-prompt-suffix').value,regexPattern=document.getElementById('setting-status-regex').value,replacePattern=document.getElementById('setting-status-replace').value;if(!regexPattern&&!replacePattern)return showToast('请先填写状态栏配置');try{new RegExp(regexPattern);}catch{return showToast('正则表达式无效，请检查');}const button=document.getElementById('setting-status-preset-select'),selected=statusFind(button?.value),parentId=selected?statusParent(selected):null;const name=prompt('请输入预设名称（当前文件夹内同名将覆盖）：',selected?.name||'')?.trim();if(!name)return;try{let saved;await statusWrite(()=>{if(parentId&&!statusIsFolder(parentId))throw Error('文件夹已不存在，请重新选择');const existing=statusItems().find(p=>p.type!=='folder'&&p.name===name&&statusParent(p)===parentId);saved=existing||{id:'sb_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9),parentId};Object.assign(saved,{name,promptSuffix,regexPattern,replacePattern});if(!existing)db.statusBarPresets.push(saved);});showToast('预设已保存');populateStatusBarPresetSelect();if(button){button.value=saved.id;button.textContent=saved.name+' ›';}}catch(error){showToast(error.message||'保存失败');}}

// 导出全局函数供 HTML 调用
window.openStatusBarEditor = openStatusBarEditor;
window.deleteStatusBarPreset = deleteStatusBarPreset;
