// 放大时移动同一个编辑框与查找工具，保留原有内容、监听器及查找/替换状态。
(() => {
    let active=null;
    const expandIcon='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3h7v7M21 3l-7 7M10 21H3v-7M3 21l7-7"/></svg>';
    const shrinkIcon='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3l-7 7V3M14 10h7M3 21l7-7v7M10 14H3"/></svg>';
    function close() {
        if(!active)return;
        const {toolbar,textarea,toolbarPlace,textareaPlace,overlay,button,disabled,readOnly,onKey,observer,bodyOverflow}=active;
        active=null;observer.disconnect();document.removeEventListener('keydown',onKey,true);
        toolbarPlace.replaceWith(toolbar);textareaPlace.replaceWith(textarea);
        textarea.disabled=disabled;textarea.readOnly=readOnly;
        toolbar.classList.remove('css-editor-toolbar');textarea.classList.remove('css-editor-textarea');
        button.innerHTML=expandIcon;button.title='放大 CSS 编辑框';button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded','false');
        overlay.remove();document.body.style.overflow=bodyOverflow;button.focus({preventScroll:true});
    }
    function open(toolbar,textarea,button) {
        if(active){if(active.textarea===textarea){close();return;}close();}
        const toolbarPlace=document.createComment('CSS toolbar position'),textareaPlace=document.createComment('CSS textarea position');
        toolbar.replaceWith(toolbarPlace);textarea.replaceWith(textareaPlace);
        const overlay=document.createElement('div'),dialog=document.createElement('div');
        overlay.className='modal-overlay visible css-editor-overlay';dialog.className='css-editor-dialog';
        dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','放大 CSS 编辑框');
        toolbar.classList.add('css-editor-toolbar');textarea.classList.add('css-editor-textarea');
        dialog.append(toolbar,textarea);overlay.append(dialog);document.body.append(overlay);
        button.innerHTML=shrinkIcon;button.title='缩小 CSS 编辑框';button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded','true');
        const bodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
        const chatId=typeof currentChatId==='undefined'?null:currentChatId,chatType=typeof currentChatType==='undefined'?null:currentChatType;
        const disabled=textarea.disabled,readOnly=textarea.readOnly;
        if(disabled){textarea.disabled=false;textarea.readOnly=true;}
        const onKey=e=>{
            if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
            if(e.key!=='Tab')return;
            const nodes=[...dialog.querySelectorAll('button,input,textarea')].filter(n=>!n.disabled&&n.getClientRects().length);
            if(!nodes.length)return;
            if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}
            else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}
        };
        const observer=new MutationObserver(()=>{if(!toolbarPlace.isConnected||!textareaPlace.isConnected||(typeof currentChatId!=='undefined'&&currentChatId!==chatId)||(typeof currentChatType!=='undefined'&&currentChatType!==chatType))close();});
        active={toolbar,textarea,toolbarPlace,textareaPlace,overlay,button,disabled,readOnly,onKey,observer,bodyOverflow};
        document.addEventListener('keydown',onKey,true);observer.observe(document.body,{childList:true,subtree:true});
        overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
        button.focus({preventScroll:true});
    }
    function attach(toolbar,textarea) {
        if(toolbar.querySelector('.css-editor-expand-btn'))return;
        const search=toolbar.querySelector('.toolbar-toggle-btn');if(!search)return;
        const actions=document.createElement('div');actions.className='css-editor-actions';
        search.replaceWith(actions);actions.append(search);
        const button=document.createElement('button');button.type='button';button.className='toolbar-toggle-btn css-editor-expand-btn';button.innerHTML=expandIcon;
        button.title='放大 CSS 编辑框';button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded','false');actions.append(button);
        button.addEventListener('click',()=>open(toolbar,textarea,button));
    }
    window.CssEditorExpansion={attach,close};
})();
