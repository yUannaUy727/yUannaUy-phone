// --- 回忆日记功能 (js/modules/journal.js) ---

let generatingChatId = null;

function setupMemoryJournalScreen() {
    const generateNewJournalBtn = document.getElementById('generate-new-journal-btn');
    const generateJournalModal = document.getElementById('generate-journal-modal');
    const generateJournalForm = document.getElementById('generate-journal-form');
    const journalListContainer = document.getElementById('journal-list-container');
    const editDetailBtn = document.getElementById('edit-journal-detail-btn');
    const bindWorldBookBtn = document.getElementById('bind-journal-worldbook-btn');
    // 新增元素引用
    const journalStyleModal = document.getElementById('journal-style-selection-modal');
    const saveJournalStyleBtn = document.getElementById('save-journal-style-btn');
    const journalStyleRadios = document.querySelectorAll('input[name="journal-style-mode"]');
    const customStyleContainer = document.getElementById('journal-custom-style-container');
    const journalStyleWorldBookList = document.getElementById('journal-style-worldbook-list');
    // 新增：多选管理相关元素
    const manageBtn = document.getElementById('journal-manage-btn');
    const cancelManageBtn = document.getElementById('journal-cancel-manage-btn');
    const multiSelectBar = document.getElementById('journal-multi-select-bar');
    const batchDeleteBtn = document.getElementById('journal-batch-delete-btn');
    const mergeBtn = document.getElementById('journal-merge-btn');
    const selectCountSpan = document.getElementById('journal-select-count');

    let isMultiSelectMode = false;
    let selectedJournalIds = new Set();

    // 绑定按钮点击事件
    if (manageBtn) {
        manageBtn.addEventListener('click', () => {
            toggleMultiSelectMode(true);
        });
    }

    if (cancelManageBtn) {
        cancelManageBtn.addEventListener('click', () => {
            toggleMultiSelectMode(false);
        });
    }

    if (batchDeleteBtn) {
        batchDeleteBtn.addEventListener('click', async () => {
            if (selectedJournalIds.size === 0) return;
            if (await window.JournalAutomation.deleteWithChoice(currentChatType==='private'?db.characters.find(c=>c.id===currentChatId):db.groups.find(c=>c.id===currentChatId),[...selectedJournalIds])) {
                const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
                if (!chat) return;


                toggleMultiSelectMode(false);
                renderJournalList();
                showToast('已批量删除');
            }
        });
    }

    if (mergeBtn) {
        mergeBtn.addEventListener('click', async () => {
            if (selectedJournalIds.size < 2) {
                showToast('请至少选择 2 篇日记进行合并');
                return;
            }
            await mergeJournals(Array.from(selectedJournalIds));
        });
    }

    function toggleMultiSelectMode(active) {
        isMultiSelectMode = active;
        const manual=document.getElementById('journal-add-written-btn');if(manual)manual.style.display=active?'none':'block';
        selectedJournalIds.clear();
        updateSelectCount();

        const container = document.getElementById('journal-list-container');
        const cards = container.querySelectorAll('.journal-card');
        
        if (active) {
            manageBtn.style.display = 'none';
            cancelManageBtn.style.display = 'flex';
            multiSelectBar.style.display = 'flex';
            generateNewJournalBtn.style.display = 'none'; // 隐藏生成按钮避免干扰
            if (bindWorldBookBtn) bindWorldBookBtn.style.display = 'none';
            
            cards.forEach(card => {
                card.classList.add('select-mode');
            });
        } else {
            manageBtn.style.display = 'flex';
            cancelManageBtn.style.display = 'none';
            multiSelectBar.style.display = 'none';
            generateNewJournalBtn.style.display = 'flex';
            if (bindWorldBookBtn && currentChatType === 'private') bindWorldBookBtn.style.display = 'flex';

            cards.forEach(card => {
                card.classList.remove('select-mode');
                const checkbox = card.querySelector('.journal-checkbox');
                if (checkbox) checkbox.classList.remove('checked');
            });
        }
    }

    function updateSelectCount() {
        if (selectCountSpan) {
            selectCountSpan.textContent = `已选 ${selectedJournalIds.size} 篇`;
        }
    }

    async function mergeJournals(journalIds) {
        const chat = currentChatType==='private'?db.characters.find(c=>c.id===currentChatId):db.groups.find(c=>c.id===currentChatId);
        if(!chat)return;
        toggleMultiSelectMode(false);
        await window.JournalAutomation.mergeManual(chat,journalIds);
    }

    bindWorldBookBtn.addEventListener('click', () => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        if (!chat) return;

        // 仅私聊支持新风格设置
        if (currentChatType === 'private') {
            // 智能迁移
            const migrationMsg = migrateJournalSettings(chat);
            if (migrationMsg) {
                showToast(migrationMsg);
            }

            // 设置 Radio 状态
            const currentMode = chat.journalStyleSettings.mode || 'default';
            const radio = document.querySelector(`input[name="journal-style-mode"][value="${currentMode}"]`);
            if (radio) radio.checked = true;

            // 显示/隐藏自定义列表
            customStyleContainer.style.display = (currentMode === 'custom') ? 'flex' : 'none';

            // 渲染世界书列表 (总是渲染，以便切换时可用)
            renderCategorizedWorldBookList(journalStyleWorldBookList, db.worldBooks, chat.journalStyleSettings.customWorldBookIds || [], 'journal-style-wb-select');
            
            journalStyleModal.classList.add('visible');
        } else {
            showToast('群聊暂不支持自定义风格设置');
        }
    });

    // Radio 切换事件
    journalStyleRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            customStyleContainer.style.display = (e.target.value === 'custom') ? 'flex' : 'none';
        });
    });

    // 保存按钮点击事件
    saveJournalStyleBtn.addEventListener('click', async () => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : null;
        if (!chat) return;

        const selectedMode = document.querySelector('input[name="journal-style-mode"]:checked').value;
        const selectedIds = Array.from(journalStyleWorldBookList.querySelectorAll('.item-checkbox:checked')).map(input => input.value);

        chat.journalStyleSettings = {
            mode: selectedMode,
            customWorldBookIds: selectedIds
        };
        
        // 同步更新旧字段以保持潜在的向后兼容性
        chat.journalWorldBookIds = selectedIds;

        await saveData();
        journalStyleModal.classList.remove('visible');
        showToast('日记风格设置已保存');
    });

    generateNewJournalBtn.addEventListener('click', () => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        const totalMessages = chat ? chat.history.length : 0;
        
        const rangeInfo = document.getElementById('journal-range-info');
        rangeInfo.textContent = `当前聊天总消息数: ${totalMessages}`;

        const modalTitle = document.querySelector('#generate-journal-modal h3');
        if (modalTitle) {
            modalTitle.textContent = (currentChatType === 'group') ? '生成群聊总结' : '指定总结范围';
        }

        generateJournalForm.reset();
        generateJournalModal.classList.add('visible');
    });

    generateJournalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const startInput = document.getElementById('journal-range-start');
        const endInput = document.getElementById('journal-range-end');
        const includeFavoritedCheckbox = document.getElementById('journal-include-favorited');

        const start = parseInt(startInput.value);
        const end = parseInt(endInput.value);
        const includeFavorited = includeFavoritedCheckbox.checked;
        
        if (isNaN(start) || isNaN(end) || start <= 0 || end < start) {
            showToast('请输入有效的起止范围');
            return;
        }

        generateJournalModal.classList.remove('visible');
        await generateJournal(start, end, includeFavorited);
    });

    journalListContainer.addEventListener('click', async (e) => {
        const target = e.target;
        if(target.closest('.journal-drawer-button'))return;
        const card = target.closest('.journal-card');
        if (!card) return;

        const journalId = card.dataset.id;
        
        // 多选模式逻辑
        if (isMultiSelectMode) {
            if (selectedJournalIds.has(journalId)) {
                selectedJournalIds.delete(journalId);
                card.querySelector('.journal-checkbox').classList.remove('checked');
            } else {
                selectedJournalIds.add(journalId);
                card.querySelector('.journal-checkbox').classList.add('checked');
            }
            updateSelectCount();
            return; // 阻止进入详情页
        }

        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        if (!chat) return;
        const journal = chat.memoryJournals.find(j => j.id === journalId);
        if (!journal) return;

        if (target.closest('.delete-journal-btn')) {
            if (await window.JournalAutomation.deleteWithChoice(chat,[journalId])) {

                renderJournalList();
                showToast('日记已删除');
            }
            return;
        }

        if (target.closest('.favorite-journal-btn')) {
            journal.isFavorited = !journal.isFavorited;
            await saveData();
            target.closest('.favorite-journal-btn').classList.toggle('favorited', journal.isFavorited);
            showToast(journal.isFavorited ? '已收藏' : '已取消收藏');
            return;
        }
        
        const date = new Date(journal.createdAt);
        const formattedDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        
        currentJournalDetailId = journal.id;

        const titleEl = document.getElementById('journal-detail-title');
        const contentEl = document.getElementById('journal-detail-content');

        titleEl.removeAttribute('contenteditable');
        contentEl.removeAttribute('contenteditable');
        titleEl.style.border = 'none';
        contentEl.style.border = 'none';
        titleEl.style.padding = '0';
        contentEl.style.padding = '0';
        editDetailBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z" /></svg>`;

        titleEl.textContent = journal.title;
        document.getElementById('journal-detail-meta').textContent = window.JournalAutomation.detailText(journal);
        document.getElementById('journal-detail-content').textContent = journal.content;
        window.JournalAutomation.detailTools(chat,journal);
        
        switchScreen('memory-journal-detail-screen');
    });

    editDetailBtn.addEventListener('click', () => toggleJournalDetailEditing(editDetailBtn));

}

// 正文用 textarea 编辑，浏览器回车生成的段落不会在 textContent 保存时丢失。
async function toggleJournalDetailEditing(button) {
    if (!currentJournalDetailId || button.disabled) return;
    const titleEl=document.getElementById('journal-detail-title');
    const contentEl=document.getElementById('journal-detail-content');
    const editor=document.getElementById('journal-detail-content-editor');
    const chat=currentChatType==='private'?db.characters.find(c=>c.id===currentChatId):db.groups.find(c=>c.id===currentChatId);
    const journal=chat?.memoryJournals?.find(j=>j.id===currentJournalDetailId);
    if(!journal)return;
    const archive=chat.activeArchiveId||'';
    if(!editor){
        titleEl.setAttribute('contenteditable','true');
        titleEl.style.border='1px dashed #ccc';titleEl.style.padding='5px';
        contentEl.removeAttribute('contenteditable');
        const input=document.createElement('textarea');
        input.id='journal-detail-content-editor';input.className='journal-detail-text-editor';
        input.setAttribute('aria-label','编辑日记正文');input.spellcheck=false;
        input.value=journal.content||'';
        input.dataset.journalId=String(journal.id);input.dataset.chatId=String(chat.id);
        input.dataset.archive=String(archive);input.dataset.chatType=currentChatType;
        contentEl.replaceChildren(input);
        button.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9,16.17L4.83,12L3.41,13.41L9,19L21,7L19.59,5.59L9,16.17Z" /></svg>';
        input.focus();return;
    }
    if(editor.dataset.journalId!==String(journal.id)||editor.dataset.chatId!==String(chat.id)||editor.dataset.archive!==String(archive)||editor.dataset.chatType!==currentChatType){
        showToast('日记或存档已切换，请重新打开后编辑');return;
    }
    const before={title:journal.title,content:journal.content};
    const title=(titleEl.innerText??titleEl.textContent).trim();
    // 不 trim 正文：连续空行、首尾空行、空格缩进均按输入原样保存。
    const content=editor.value;
    button.disabled=true;editor.readOnly=true;titleEl.setAttribute('contenteditable','false');
    try {
        journal.title=title;journal.content=content;
        if(journal.isMerged){journal.needsUpdate=false;delete journal.updateError;const state=window.JournalAutomation.state(chat);state.jobs=state.jobs.filter(job=>job.targetId!==journal.id);}
        await window.JournalAutomation.syncEdited(chat,journal);
        if((chat.activeArchiveId||'')!==archive||!chat.memoryJournals.includes(journal))throw Error('日记或存档已切换，本次编辑未保存');
        await saveData();
        if(currentJournalDetailId===journal.id&&document.getElementById('journal-detail-content-editor')===editor){
            titleEl.textContent=journal.title;contentEl.textContent=journal.content;
            titleEl.removeAttribute('contenteditable');contentEl.removeAttribute('contenteditable');
            titleEl.style.border='none';titleEl.style.padding='0';contentEl.style.border='none';contentEl.style.padding='0';
            button.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z" /></svg>';
        }
        showToast('日记已保存');renderJournalList();
    } catch(error) {
        Object.assign(journal,before);
        if(document.getElementById('journal-detail-content-editor')===editor)titleEl.setAttribute('contenteditable','true');
        showToast(error.message||'日记保存失败，请重试');
    } finally {button.disabled=false;editor.readOnly=false;}
}

function renderJournalList() {
    const container = document.getElementById('journal-list-container');
    const placeholder = document.getElementById('no-journals-placeholder');
    container.innerHTML = '';

    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    if(chat){window.JournalAutomation.migrate(chat);window.JournalAutomation.toolbar(chat,container);}
    const journals = chat ? chat.memoryJournals : [];

    // 更新标题和按钮显示
    const bindBtn = document.getElementById('bind-journal-worldbook-btn');
    const title = document.querySelector('#memory-journal-screen .title');
    
    if (currentChatType === 'group') {
        if (bindBtn) bindBtn.style.display = 'none';
        if (title) title.textContent = '智能总结';
        if (placeholder) {
            placeholder.innerHTML = '<p>还没有总结哦~</p><p>点击右上角的“+号”来生成第一篇吧！</p>';
        }
    } else {
        if (bindBtn) bindBtn.style.display = 'flex';
        if (title) title.textContent = '回忆日记';
        if (placeholder) {
            placeholder.innerHTML = '<p>还没有日记哦~</p><p>点击右上角的“+号”来创建第一篇吧！</p>';
        }
    }

    let isShowingLoading = false;
    // 恢复生成状态卡片
    if (typeof isGenerating !== 'undefined' && isGenerating && generatingChatId === currentChatId) {
        const loadingCard = document.createElement('li');
        loadingCard.className = 'journal-card generating';
        loadingCard.id = 'journal-generating-card';
        loadingCard.innerHTML = `
            <div class="spinner"></div>
            <div class="text">正在${currentChatType === 'group' ? '总结群聊' : '编织回忆'}...</div>
        `;
        container.appendChild(loadingCard);
        isShowingLoading = true;
    }

    if ((!journals || journals.length === 0) && !isShowingLoading) {
        if (placeholder) placeholder.style.display = 'block';
        return;
    }

    if (placeholder) placeholder.style.display = 'none';

    const sortedJournals = [...journals].sort((a, b) => a.createdAt - b.createdAt);

    sortedJournals.forEach(journal => {
        const card = document.createElement('li');
        card.className = 'journal-card';
        card.dataset.id = journal.id;

        const date = new Date(journal.createdAt);
        const formattedDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

        card.innerHTML = `
            <div class="journal-checkbox"></div>
            <div class="journal-card-header">
                <div class="journal-card-title"></div>
            </div>
            <div class="journal-card-actions">
                <button class="action-icon-btn favorite-journal-btn" title="收藏">
                    <svg viewBox="0 0 24 24">
                        <path class="star-outline" d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" fill="currentColor"/>
                        <path class="star-solid" d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/>
                    </svg>
                </button>
                <button class="action-icon-btn delete-journal-btn" title="删除">
                    <svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg>
                </button>
            </div>
            <div class="journal-card-footer" style="justify-content: space-between; height: auto; opacity: 1; margin-top: 10px;">
                <span class="journal-card-date">${formattedDate}</span>
                <span class="journal-card-range">范围: ${journal.range.start}-${journal.range.end}</span>
            </div>
        `;

        card.querySelector('.journal-card-title').textContent=journal.title;
        if (journal.isFavorited) {
            card.querySelector('.favorite-journal-btn').classList.add('favorited');
        }

        container.appendChild(card);
    });
    if(chat)window.JournalAutomation.decorate(chat,container);
}

async function generateJournal(start, end, includeFavorited = false) {
    const modeChat=currentChatType==='private'?db.characters.find(c=>c.id===currentChatId):db.groups.find(c=>c.id===currentChatId);
    if(modeChat&&window.VectorMemory&&!window.VectorMemory.diaryAllowed(modeChat)){showToast('请先切换到日记记忆模式');return;}
    const targetChatId=currentChatId,targetChatType=currentChatType;
    showToast('正在生成日记，请稍候...');
    
    // 显示列表占位卡片
    const container = document.getElementById('journal-list-container');
    const placeholder = document.getElementById('no-journals-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    const loadingCard = document.createElement('li');
    loadingCard.className = 'journal-card generating';
    loadingCard.id = 'journal-generating-card';
    loadingCard.innerHTML = `
        <div class="spinner"></div>
        <div class="text">正在${currentChatType === 'group' ? '总结群聊' : '编织回忆'}...</div>
    `;
    
    if (container.firstChild) {
        container.insertBefore(loadingCard, container.firstChild);
    } else {
        container.appendChild(loadingCard);
    }
    container.scrollTop = 0;

    isGenerating = true; 
    generatingChatId = currentChatId;

    try {
        const chat = targetChatType==='private'?db.characters.find(c=>c.id===targetChatId):db.groups.find(c=>c.id===targetChatId);
        if (!chat) {
            throw new Error("未找到当前聊天。");
        }

        const startIndex = start - 1;
        const endIndex = end;
        
        if (startIndex < 0 || endIndex > chat.history.length || startIndex >= endIndex) {
            throw new Error("无效的消息范围。");
        }

        const sourceMessages = JSON.parse(JSON.stringify(chat.history.slice(startIndex,endIndex)));
        const summaryArchiveId = chat.activeArchiveId||null;
        const summaryMemoryEpoch=window.VectorMemory?.state(chat).epoch;
        const summarySegment = window.JournalAutomation.state(chat).segment;
        // ...
        let messagesToSummarize = chat.history.slice(startIndex, endIndex);
        
        const summaryPrompt = buildJournalSummaryPrompt(chat, messagesToSummarize, targetChatType, includeFavorited);

        const apiConfig = window.SummaryApi.resolve(chat);
        let { url, key, model } = apiConfig;
        if (!url || !key || !model) {
            throw new Error("API设置不完整。");
        }

        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }

        const { requestBody, endpoint, headers } = buildChatApiRequest(
            apiConfig,
            [{ role: 'user', content: summaryPrompt }],
            window.SummaryApi.options(apiConfig)
        );

        const rawContent = await fetchAiResponse(apiConfig, requestBody, headers, endpoint);
        if(window.VectorMemory&&(!window.VectorMemory.diaryAllowed(chat)||window.VectorMemory.state(chat).epoch!==summaryMemoryEpoch))throw new Error('记忆模式已切换，本次日记未保存');

        const titleMatch = rawContent.match(/<title>([\s\S]*?)<\/title>/i);
        const contentMatch = rawContent.match(/<content>([\s\S]*?)<\/content>/i);

        if(!titleMatch?.[1]?.trim()||!contentMatch?.[1]?.trim())throw new Error("总结未返回完整标题和正文");
        const parsedTitle = titleMatch[1].trim();
        const parsedContent = contentMatch ? contentMatch[1].trim() : "内容为空。";

        const newJournal = {
            id: `journal_${Date.now()}`,
            range: { start, end },
            startMessageId: chat.history[start - 1]?.id || null,
            endMessageId: chat.history[end - 1]?.id || null,
            title: parsedTitle,
            content: parsedContent,
            createdAt: Date.now(),
            chatId: targetChatId,
            chatType: targetChatType,
            isFavorited: false 
        };

        if (!chat.memoryJournals) {
            chat.memoryJournals = [];
        }
        if((chat.activeArchiveId||null)!==summaryArchiveId||window.JournalAutomation.state(chat).segment!==summarySegment)throw new Error('聊天存档已切换或记录已清空，请重新生成');
        const oldProcessed=[...window.JournalAutomation.state(chat).processedCoverage];
        window.JournalAutomation.attach(chat,newJournal,sourceMessages);
        chat.memoryJournals.push(newJournal);
        try{await saveData();}catch(error){chat.memoryJournals=chat.memoryJournals.filter(j=>j.id!==newJournal.id);window.JournalAutomation.state(chat).processedCoverage=oldProcessed;throw error;}

        if(currentChatId===targetChatId)renderJournalList();
        showToast('新日记已生成！');

    } catch (error) {
        // 移除生成卡片
        const card = document.getElementById('journal-generating-card');
        if(card) card.remove();
        
        // 如果列表为空，恢复显示 placeholder
        const chat = targetChatType==='private'?db.characters.find(c=>c.id===targetChatId):db.groups.find(c=>c.id===targetChatId);
        if (!chat || !chat.memoryJournals || chat.memoryJournals.length === 0) {
             const placeholder = document.getElementById('no-journals-placeholder');
             if (placeholder) placeholder.style.display = 'block';
        }

        showApiError(error);
    } finally {
        isGenerating = false; 
        generatingChatId = null;
    }
}

function migrateJournalSettings(chat) {
    if (!chat.journalStyleSettings) {
        const oldJournalIds = chat.journalWorldBookIds || [];
        const chatCommonIds = chat.worldBookIds || [];
        
        // 1. 剔除重复项 (在通用里已存在的)
        const uniqueCustomIds = oldJournalIds.filter(id => !chatCommonIds.includes(id));
        
        // 2. 决定模式
        let newMode = 'default';
        let migrationMsg = '';

        if (oldJournalIds.length > 0) {
            if (uniqueCustomIds.length === 0) {
                // 情况 A: 旧关联全是通用背景 -> 迁移到默认模式
                newMode = 'default';
                migrationMsg = '日记功能升级：已自动关联聊天室背景，您的旧设置已合并到“默认风格”。';
            } else {
                // 情况 B: 有额外的世界书 -> 迁移到自定义模式，保留额外项
                newMode = 'custom';
                migrationMsg = `日记功能升级：已自动关联聊天室背景，剩余 ${uniqueCustomIds.length} 个特殊设定已保留在“自定义风格”中。`;
            }
        } else {
            // 情况 C: 无旧关联 -> 默认
            newMode = 'default';
        }

        // 3. 应用设置
        chat.journalStyleSettings = { 
            mode: newMode, 
            customWorldBookIds: uniqueCustomIds 
        };
        
        return migrationMsg;
    }
    return null;
}

function buildJournalSummaryPrompt(chat, messagesToSummarize, chatType, includeFavorited=false) {
        // 1. 保持原样：第三个参数设为 true，确保你想要的“高权重”隐藏消息能被读进来
        messagesToSummarize = filterHistoryForAI(chat, window.JournalAutomation.summaryMessages(messagesToSummarize), true);

        // 2. 【新增】精准剔除 thinking 消息
        // 你的 chat_ai.js 中生成的思考消息带有 isThinking: true 属性
        // 即使它们包含在上下文里，我们也在生成日记前把它们扔掉
        messagesToSummarize = messagesToSummarize.filter(m => !m.isThinking);

        // 3. 【可选保险】防止只有标签没有属性的情况（针对旧历史记录）
        // 如果你担心以前的历史记录里有 thinking 标签但没有 isThinking 属性，可以加一步正则清洗
        messagesToSummarize.forEach(m => {
            if (m.content && typeof m.content === 'string') {
               m.content = m.content.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
            }
        });

        let worldBooksContent = '';
        let summaryPrompt = '';
        let favoritedJournalsPrompt = '';

        // 新增：读取已收藏的日记 (通用逻辑)
        if (includeFavorited) {
            const favoritedJournals = window.JournalAutomation.favorites(chat)
                .map(j => `标题：${j.title}\n内容：${j.content}`)
                .join('\n\n---\n\n');
            
            if (favoritedJournals) {
                favoritedJournalsPrompt = `【过往回顾】\n这是你之前已经写下的内容，请参考它们，以确保新内容的连续性，并避免重复记录已经记录过的事件。\n\n${favoritedJournals}\n\n`;
            }
        }

        if (chatType === 'group') {
            // 群聊逻辑
            const worldBooksLimitBreak = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'limit_break')).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            const worldBooksBefore = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'before')).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            const worldBooksAfter = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && (wb.position === 'after' || !wb.position))).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            const worldBooksGuidelines = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'guidelines')).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            
            worldBooksContent = [
                ...worldBooksLimitBreak.map(wb => wb.content),
                ...worldBooksBefore.map(wb => wb.content),
                ...worldBooksAfter.map(wb => wb.content),
                ...worldBooksGuidelines.map(wb => wb.content)
            ].join('\n\n');

            summaryPrompt = `你是一个群聊记录总结助手。请以完全客观的第三视角，对以下群聊记录进行精简总结。\n\n`;
            
            if (favoritedJournalsPrompt) {
                summaryPrompt += favoritedJournalsPrompt;
            }

            // 注入群聊基础信息
            summaryPrompt += `群聊名称: ${chat.name}\n`;
            summaryPrompt += `群成员列表: ${chat.members.map(m => `${m.groupNickname}(${m.realName})`).join(', ')}\n\n`;

            // 注入群聊关联的世界书
            if (worldBooksContent) {
                summaryPrompt += `背景设定参考:\n${worldBooksContent}\n\n`;
            }

            summaryPrompt += `总结要求：\n`;
            summaryPrompt += `1. **客观中立**：使用第三人称视角，不带个人情感色彩，不使用强烈的情绪词汇。\n`;
            summaryPrompt += `2. **精简准确**：只陈述事实，概括主要话题和事件，去除无关的闲聊细节。\n`;
            summaryPrompt += `3. **无升华**：不要进行价值升华、感悟或总结性评价，仅记录发生了什么。\n\n`;

            summaryPrompt += `你的输出必须使用XML标签包裹，包含以下两个部分：\n`;
            summaryPrompt += `<title>格式为“日期·核心事件”，例如“1月20日·讨论周末计划”</title>\n`;
            summaryPrompt += `<content>总结正文。分条列出主要讨论点或事件。</content>\n\n`;

            summaryPrompt += `请严格按照上述XML标签格式输出，不要输出任何其他多余的文字。\n\n`;
            summaryPrompt += `聊天记录如下：\n\n---\n${(() => {
                let lastTime = 0;
                return messagesToSummarize.map(m => {
                    let prefix = '';
                    const currentTime = m.timestamp;
                    const timeDiff = currentTime - lastTime;
                    const isSameDay = new Date(currentTime).toDateString() === new Date(lastTime).toDateString();
                    
                    if (lastTime === 0 || timeDiff > 20 * 60 * 1000 || !isSameDay) {
                        const d = new Date(currentTime);
                        const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        prefix = `\n[系统时间: ${timeStr}]\n`;
                    }
                    lastTime = currentTime;
                    return `${prefix}${m.content}`;
                }).join('\n');
            })()}\n---`;

        } else {
            // 私聊逻辑
            // 0. 确保迁移
            migrateJournalSettings(chat);

            // 1. 自动获取通用世界书 (Context)
            const worldBooksLimitBreak = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'limit_break')).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            const worldBooksBefore = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'before')).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            const worldBooksAfter = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && (wb.position === 'after' || !wb.position))).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            const worldBooksGuidelines = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'guidelines')).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
            
            worldBooksContent = [
                ...worldBooksLimitBreak.map(wb => wb.content),
                ...worldBooksBefore.map(wb => wb.content),
                ...worldBooksAfter.map(wb => wb.content),
                ...worldBooksGuidelines.map(wb => wb.content)
            ].join('\n\n');

            // 2. 获取风格设置
            const styleSettings = chat.journalStyleSettings || { mode: 'default', customWorldBookIds: [] };
            
            // 3. 构建 Prompt
            if (styleSettings.mode === 'summary') {
                // 摘要总结风格
                summaryPrompt = `你是一个专业的对话记录总结助手。请根据提供的聊天记录，生成一份精简的摘要总结。\n\n`;
                
                if (favoritedJournalsPrompt) {
                    summaryPrompt += favoritedJournalsPrompt;
                }

                summaryPrompt += `要求：
1. **体现时间进程**：正文内容必须按时间顺序组织，并明确指出时间点。**格式规范：**请严格按照“x年x月x日，发生了[事件]”的格式进行叙述，确保时间线清晰。
2. **客观平实**：使用第三人称视角，客观陈述事实。**绝对禁止使用强烈的情绪词汇**（如“极度愤怒”、“痛彻心扉”、“欣喜若狂”等），保持冷静、克制的叙述风格。
3. **抓取重点**：识别对话中的核心事件、重要话题转折、关键决策或信息。忽略无关的闲聊和琐碎细节。
4. **关键原话摘录（重要）**：
    - 仅当出现具有**极高情感价值**（如表白、郑重承诺、极具感染力的情感宣泄）或**重大剧情价值**（如揭示核心秘密、决定性瞬间）的对话时，请**直接引用角色的原话**。
    - **引用格式**：使用引号包裹原话，例如：${chat.realName}说：“我永远不会离开你。”
    - **严格控制数量**：只摘录最闪光、最不可替代的那几句。如果聊天记录平淡无奇或全是日常琐事，**请不要摘录任何原话**，以免破坏摘要的精简性。
5. **无升华**：不要进行价值升华、感悟或总结性评价，仅记录发生了什么。

你的输出必须使用XML标签包裹，包含以下两个部分：
<title>格式为“日期范围·核心事件”，例如“1月20日-1月22日·关于旅行计划的讨论”</title>
<content>总结正文</content>

请严格按照上述XML标签格式输出，不要输出任何其他多余的文字。

聊天记录如下：\n\n---\n${(() => {
                let lastTime = 0;
                return messagesToSummarize.map(m => {
                    let prefix = '';
                    const currentTime = m.timestamp;
                    const timeDiff = currentTime - lastTime;
                    const isSameDay = new Date(currentTime).toDateString() === new Date(lastTime).toDateString();
                    
                    if (lastTime === 0 || timeDiff > 20 * 60 * 1000 || !isSameDay) {
                        const d = new Date(currentTime);
                        const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        prefix = `\n[系统时间: ${timeStr}]\n`;
                    }
                    lastTime = currentTime;
                    return `${prefix}${m.content}`;
                }).join('\n');
            })()}\n---`;

            } else {
                // 默认风格 (流水账) 或 自定义风格
                // 基础 Prompt (第一人称)
                summaryPrompt = `你是一个日记整理助手。请以角色 "${chat.remarkName || chat.name}" 的第一人称视角，总结以下聊天记录。请专注于重要的情绪、事件和细节。\n\n`;
                
                if (favoritedJournalsPrompt) {
                    summaryPrompt += favoritedJournalsPrompt;
                }

                summaryPrompt += "为了更好地理解角色和背景，请参考以下信息：\n";
                summaryPrompt += "=====\n";

                if (worldBooksContent) {
                    summaryPrompt += `世界观设定:\n${worldBooksContent}\n\n`;
                }

                summaryPrompt += `你的角色设定:\n- 角色名: ${chat.realName}\n- 人设: ${chat.persona || "一个友好、乐于助人的伙伴。"}\n\n`;
                summaryPrompt += `我的角色设定:\n- 我的称呼: ${chat.myName}\n- 我的人设: ${chat.myPersona || "无特定人设。"}\n\n`;
                summaryPrompt += "=====\n";

                // 如果是自定义风格，注入额外要求
                if (styleSettings.mode === 'custom') {
                    const customWorldBooks = (styleSettings.customWorldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id)).filter(Boolean).sort((a, b) => (a.depth || 100) - (b.depth || 100));
                    const customStyleContent = customWorldBooks.map(wb => wb.content).join('\n\n');
                    
                    if (customStyleContent) {
                        summaryPrompt += `\n**特别日记格式/风格要求**：\n请优先严格遵循以下风格指南或格式要求来撰写日记：\n${customStyleContent}\n\n`;
                    }
                }

                summaryPrompt += `请基于以上所有背景信息，总结以下聊天记录。你的输出必须使用XML标签包裹，包含 <title>年月日·一个简洁的标题</title> 和 <content>完整的日记正文</content> 两个部分，请严格按照XML标签格式输出，不要输出任何其他多余的文字。聊天记录如下：\n\n---\n${(() => {
                let lastTime = 0;
                return messagesToSummarize.map(m => {
                    let prefix = '';
                    const currentTime = m.timestamp;
                    const timeDiff = currentTime - lastTime;
                    const isSameDay = new Date(currentTime).toDateString() === new Date(lastTime).toDateString();
                    
                    if (lastTime === 0 || timeDiff > 20 * 60 * 1000 || !isSameDay) {
                        const d = new Date(currentTime);
                        const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        prefix = `\n[系统时间: ${timeStr}]\n`;
                    }
                    lastTime = currentTime;
                    return `${prefix}${m.content}`;
                }).join('\n');
            })()}\n---`;
            }
        }


return summaryPrompt;
}
