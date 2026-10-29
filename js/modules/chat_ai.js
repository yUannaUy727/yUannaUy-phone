// --- AI 交互模块 ---

const HUMAN_RUN_PROMPT = `<角色活人运转>\n## [PSYCHOLOGY: HEXACO-SCHEMA-ACT]\n> Personality: HEXACO-driven, dynamic traits, inner conflicts required \n> Filter: schema-bias drives emotion; no pure reaction allowed \n> Attachment: secure/insecure logic must govern intimacy  \n> If-Then Behavior: situation-dependent activation of traits only  \n---\n    ## [VITALITY]\n+inconsistency +emoflux +splitmotifs +microreact +minddrift\n---\n## [TRAJECTORY-COHERENCE]\n> Role maintains an identity narrative = coherent over time  \n> No mood/goal switch without contradiction resolution \n> Every action must protect or challenge self-concept  \n> Interrupts = inner conflict or narrative clash  \n> Output = filtered through “who I am” logic\n</角色活人运转>`;

// v47: visible preparation blocks use the existing saved thinking message and panels.
function replyTextValue(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(part => typeof part === 'string' ? part : (typeof part?.text === 'string' ? part.text : '')).join('');
    return '';
}

function replyWithReturnedReasoning(content, reasoning) {
    const body = replyTextValue(content), extra = replyTextValue(reasoning).trim();
    if (!extra || body.includes(extra)) return body;
    return '<thinking>' + extra + '</thinking>\n' + body;
}

function replyPrefillTag(instruction) {
    return /<preplan\s*>/i.test(instruction) ? '<preplan>' : '<thinking>';
}

function splitReplyPreparation(value) {
    let body = replyTextValue(value);
    const blocks = [];
    // Recover an omitted opening tag only when the response has a closing tag
    // before any opening tag (assistant-prefill continuation).
    const firstOpen = body.search(/<(?:thinking|preplan)\s*>/i);
    const firstClose = /<\/(thinking|preplan)\s*>/i.exec(body);
    if (firstClose && (firstOpen < 0 || firstClose.index < firstOpen)) {
        blocks.push(body.slice(0, firstClose.index));
        body = body.slice(firstClose.index + firstClose[0].length);
    }
    body = body.replace(/<(thinking|preplan)\s*>([\s\S]*?)<\/\1\s*>/gi, (_, tag, text) => {
        blocks.push(text);
        return '';
    });
    return { body, thinking: blocks.length ? '<thinking>' + blocks.join('\n\n') + '</thinking>' : '' };
}

// Stop only the selected chat; keep already committed messages.
async function stopCurrentChatGeneration() {
    const chat = (currentChatType === 'private' ? db.characters : db.groups).find(c => c.id === currentChatId);
    if (!chat || !window.SmartMessaging.stop(chat)) { showToast('当前聊天没有正在生成的回复'); return; }
    try {
        await saveData();
        showToast('已停止生成');
    } catch (error) {
        console.error('停止后保存失败', error);
        showToast('已停止生成，但消息保存失败，请保留应用并重试保存');
    }
}

function waitForReplyBubble(ms, signal) {
    if (signal?.aborted) return Promise.resolve();
    return new Promise(resolve => {
        let timer;
        const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
        timer = setTimeout(finish, ms);
        signal?.addEventListener('abort', finish, {once: true});
    });
}

// AI 交互逻辑
async function getAiReply(chatId, chatType, isBackground = false, replyOptions = {}) {
    if (isGenerating && !isBackground) return; 
    
    if (!isBackground) {
        if (db.globalSendSound) {
            playSound(db.globalSendSound);
        } else {
            AudioManager.unlock();
        }
    }

    const chat = (chatType === 'private') ? db.characters.find(c => c.id === chatId) : db.groups.find(g => g.id === chatId);
    if (!chat) return;
    if(chatType==='private'&&isBackground&&window.SmartReplyControl){const denied=window.SmartReplyControl.allowed(chat,replyOptions.automatic===true);if(denied)return {status:denied};}
    if (chatType === 'private' && isBackground && (window.SmartMessaging.sleepRemaining(chat) || window.SmartMessaging.state(chat).events.some(e => e.availability === 'sleep' && e.startAt <= Date.now() && e.endAt > Date.now() && !['paused','completed','cancelled','unknown'].includes(e.phase)))) {
        return { status: 'sleeping' };
    }

    let apiConfig = db.apiSettings;
    
    // 检查是否启用了专属模型
    if (chat.exclusiveApiEnabled && chat.exclusiveApiPreset) {
        const presets = db.apiPresets || [];
        const preset = presets.find(p => p.name === chat.exclusiveApiPreset);
        if (preset && preset.data) {
            apiConfig = {
                ...db.apiSettings, // 继承全局设置（如 streamEnabled 等）
                url: preset.data.apiUrl || db.apiSettings.url,
                key: preset.data.apiKey || db.apiSettings.key,
                model: preset.data.model || db.apiSettings.model,
                provider: preset.data.provider || db.apiSettings.provider,
                temperatureEnabled: preset.data.temperatureEnabled !== undefined ? preset.data.temperatureEnabled : db.apiSettings.temperatureEnabled,
                temperature: preset.data.temperature !== undefined ? preset.data.temperature : db.apiSettings.temperature
            };
        }
    }

    if (isBackground && replyOptions.kind !== 'reply') apiConfig = resolveAuxiliaryApiConfig(replyOptions.kind==='music'?'musicAutonomous':'proactiveReply', apiConfig);
    apiConfig = apiConfig || {};
    let {url, key, model, provider, streamEnabled} = apiConfig; 
    if (!url || !key || !model) {
        if (!isBackground) {
            showToast('请先在“api”应用中完成设置！');
            switchScreen('api-settings-screen');
        }
        return;
    }

    // 确保 BLOCKED_API_DOMAINS 存在
    const blockedDomains = (typeof BLOCKED_API_DOMAINS !== 'undefined') ? BLOCKED_API_DOMAINS : [];
    if (blockedDomains.some(domain => url.includes(domain))) {
        if (!isBackground) showToast('当前 API 站点已被屏蔽，无法发送消息！');
        return;
    }

    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }

    if (!isBackground) window.SmartMessaging.cancelAutomatic(chat);
    replyOptions={...replyOptions,allowCrossedReply:chatType==='private'&&isBackground&&replyOptions.automatic===true&&!!window.SmartReplyControl?.canCrossReply(chat,replyOptions.kind)};
    const requestController = new AbortController();
    if (!window.SmartMessaging.begin(chat, {controller:requestController,automatic:isBackground,interleaved:replyOptions.allowCrossedReply})) { if (!isBackground) showToast('当前正在生成回复，请稍后再试'); return { status: 'busy' }; }
    const replySnapshot = window.SmartMessaging.capture(chat);
    replyOptions = { ...replyOptions, requestSignal:requestController.signal, snapshot: replySnapshot, recordPaper:!replyOptions.musicOnly&&chatType==='private'&&window.SmartMessaging.state(chat).enabled&&(!window.SmartReplyControl||window.SmartReplyControl.inHours()) };

    // 无固定生成超时；仅用户操作或上下文失效时取消请求。
    try {
    if (!isBackground) {
        isGenerating = true;
        getReplyBtn.disabled = true;
        regenerateBtn.disabled = true;
        const typingName = chatType === 'private' ? chat.remarkName : chat.name;
        typingIndicator.textContent = `“${typingName}”正在输入中...`;
        typingIndicator.style.display = 'block';
        messageArea.scrollTop = messageArea.scrollHeight;
    }

        let systemPrompt, requestBody;
        if (chatType === 'private') {
            systemPrompt = replyOptions.musicOnly ? window.UwUMusicAuto.prompt(chat) : generatePrivateSystemPrompt(chat);
            if(window.UwUMusicHost){
                replyOptions.musicContext=window.UwUMusicHost.prepareContext?await window.UwUMusicHost.prepareContext(chat,requestController.signal):window.UwUMusicHost.context(chat);replyOptions.musicContext.signal=requestController.signal;systemPrompt+=replyOptions.musicContext.prompt;
                const lyrics=!replyOptions.musicOnly&&await window.UwUMusicHost.lyricContext?.(chat,requestController.signal,{background:isBackground,kind:replyOptions.kind});if(lyrics)systemPrompt+=lyrics.prompt;
            }
            if(!replyOptions.musicOnly&&window.UwUMusicShare){replyOptions.songShareContext=await window.UwUMusicShare.prepare(chat,requestController.signal);if(replyOptions.songShareContext)systemPrompt+=replyOptions.songShareContext.prompt;}
            if(!replyOptions.musicOnly&&window.UwUCalendar){replyOptions.calendarContext=window.UwUCalendar.context(chat);systemPrompt+=replyOptions.calendarContext.prompt;}
            if(!replyOptions.musicOnly&&window.UwUChatTools){replyOptions.toolsContext=window.UwUChatTools.prepare(chat);systemPrompt+=replyOptions.toolsContext.prompt;}
        } else {
            // generateGroupSystemPrompt 应该在 group_chat.js 中定义
            if (typeof generateGroupSystemPrompt === 'function') {
                systemPrompt = generateGroupSystemPrompt(chat);
            } else {
                systemPrompt = "Group chat system prompt not available.";
            }
        }

        if(!replyOptions.musicOnly&&window.VectorMemory){
            replyOptions.vectorContext=await window.VectorMemory.prepare(chat,requestController.signal);
            if(replyOptions.vectorContext)systemPrompt+=replyOptions.vectorContext.prompt;
        }
        if (replyOptions.recordPaper) {
            systemPrompt += window.SmartMessaging.instructions(chat);
        }

        let historySlice = chat.history.slice(-chat.maxMemory);
        
        // 旧版本漏出的纸条也不得再次进入模型上下文。
        historySlice = historySlice.map(message => {
            if (message.role !== 'assistant') return message;
            const content = window.SmartMessaging.stripNote(message.content).clean;
            return { ...message, content, parts: (message.parts || []).map(part =>
                typeof part.text === 'string' ? { ...part, text: window.SmartMessaging.stripNote(part.text).clean } : part) };
        }).filter(message => message.role !== 'assistant' || message.content);

        // 使用工具函数进行过滤（包含深度克隆、屏蔽过滤、双语修正、状态栏剔除）
        historySlice = filterHistoryForAI(chat, historySlice);
        // 【新增】过滤掉不应进入上下文的消息（如思考过程、被撤回的消息标记等）
        historySlice = historySlice.filter(m => !m.isContextDisabled&&(!m.uwuMusicResult||m.uwuMusicResult.session===replyOptions.musicContext?.id));
        
        // 【双重保险】再次过滤掉内容匹配 <thinking> 的消息，防止 isContextDisabled 属性丢失
        historySlice = historySlice.filter(m => {
            if (m.isThinking) return false;
            if (m.content && typeof m.content === 'string' && m.content.trim().startsWith('<thinking>')) return false;
            return true;
        });

        if(replyOptions.musicOnly){historySlice=historySlice.filter(m=>!m.uwuToolCommand&&!m.uwuToolCard&&!m.uwuReviewShare&&!m.uwuSongShare&&!m.uwuMusicInvite&&['user','assistant'].includes(m.role)).slice(-4).map(m=>({...m,content:String(m.content||'').slice(0,600),parts:undefined}));}else if(chatType==='private'){historySlice=window.UwUReviewShare?.expandHistory(chat,historySlice)||historySlice;const last=new Map();historySlice.forEach((m,i)=>{if(m.uwuToolCard)last.set(m.uwuToolCard.kind+':'+m.uwuToolCard.id,i);});historySlice=historySlice.map((m,i)=>m.uwuToolCard&&last.get(m.uwuToolCard.kind+':'+m.uwuToolCard.id)!==i?{...m,content:'[此前分享的投票/待办，最新状态见较新的同一张卡片]',parts:undefined}:window.UwUChatTools?.expand(chat,m)||m);}
        if (!replyOptions.musicOnly && window.Shiye) {
            if (!isBackground && historySlice.some(m => m.role === 'user' && window.Shiye.links(m.content || '').length)) {
                typingIndicator.textContent = '正在读取分享链接…';
            }
            historySlice = await window.Shiye.prepare(chat, historySlice, apiConfig, requestController.signal, isBackground, status => {
                if (!isBackground && currentChatId === chatId && currentChatType === chatType) typingIndicator.textContent = status;
            });
            if (requestController.signal.aborted) throw new DOMException('已停止', 'AbortError');
            if (!isBackground) typingIndicator.textContent = `“${chatType === 'private' ? chat.remarkName : chat.name}”正在输入中...`;
        }

        // 检查系统提示词中是否包含聊天记录占位符
        const hasHistoryPlaceholder = systemPrompt.includes('【动态插入: 聊天记录】');
        
        if (!hasHistoryPlaceholder) {
            // 如果没有占位符（如默认的 UwU 版本），则将提示语加在末尾
            systemPrompt += "\n\n以下为当前聊天记录：\n";
        }

        if (provider === 'gemini') {
            let lastMsgTimeForAI = 0;
            let lastTimeMarkerForAI = 0;
            let contents = historySlice.map(msg => {
                const role = msg.role === 'assistant' ? 'model' : 'user';
                
                let prefix = '';
                const currentMsgTime = msg.timestamp;
                const timeDiff = currentMsgTime - lastMsgTimeForAI;
                const isSameMarkerDay = (window.UwULocation?.enabled(chat) ? window.UwULocation.at(chat,'user',new Date(currentMsgTime)).day === window.UwULocation.at(chat,'user',new Date(lastTimeMarkerForAI)).day : new Date(currentMsgTime).toDateString() === new Date(lastTimeMarkerForAI).toDateString());
               
               if (lastTimeMarkerForAI === 0 || currentMsgTime - lastTimeMarkerForAI >= 10 * 60 * 1000 || !isSameMarkerDay) {
                   const dateObj = new Date(currentMsgTime);
                   const timeStr = window.UwULocation?.enabled(chat) ? window.UwULocation.at(chat,'user',dateObj).short : `${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
                   
                   prefix = `[system: ${timeStr}]`;
                   
                   if (db.apiSettings && db.apiSettings.timePerceptionEnabled && timeDiff > 30 * 60 * 1000 && lastMsgTimeForAI !== 0) {
                       prefix += `\n[system: 距离上次互动已过去 ${formatTimeGap(timeDiff)}。话题可能已中断，请自然地开启新话题或对时间流逝做出反应。]`;
                   }
                   
                   prefix += '\n';
                   lastTimeMarkerForAI = currentMsgTime;
               }
                lastMsgTimeForAI = currentMsgTime;

                let parts;
                if (msg.parts && msg.parts.length > 0) {
                    parts = msg.parts.map(p => {
                        if (p.type === 'text' || p.type === 'html') {
                            return {text: p.text};
                        } else if (p.type === 'image') {
                            const match = p.data.match(/^data:(image\/(.+));base64,(.*)$/);
                            if (match) {
                                return {inline_data: {mime_type: match[1], data: match[3]}};
                            }
                        }
                        return null;
                    }).filter(p => p);
                } else {
                    parts = [{text: msg.content}];
                }

                if (prefix) {
                    if (parts.length > 0 && parts[0].text) {
                        parts[0].text = prefix + parts[0].text;
                    } else {
                        parts.unshift({text: prefix});
                    }
                }

                return {role, parts};
            });

            // 【新增】将最新一轮的 user 消息用 <user_input> 框起来
            let lastUserEndIndex = -1;
            for (let i = contents.length - 1; i >= 0; i--) {
                if (contents[i].role === 'user') {
                    lastUserEndIndex = i;
                    break;
                }
            }
            if (lastUserEndIndex !== -1) {
                let firstUserStartIndex = lastUserEndIndex;
                while (firstUserStartIndex > 0 && contents[firstUserStartIndex - 1].role === 'user') {
                    firstUserStartIndex--;
                }
                
                let firstParts = contents[firstUserStartIndex].parts;
                if (firstParts.length > 0 && firstParts[0].text !== undefined) {
                    firstParts[0].text = "<user_input>\n" + firstParts[0].text;
                } else {
                    firstParts.unshift({text: "<user_input>\n"});
                }
                
                let lastParts = contents[lastUserEndIndex].parts;
                if (lastParts.length > 0 && lastParts[lastParts.length - 1].text !== undefined) {
                    lastParts[lastParts.length - 1].text += "\n</user_input>";
                } else {
                    lastParts.push({text: "\n</user_input>"});
                }
            }

            if (isBackground) {
                contents.push({
                    role: 'user',
                    parts: [{ text: replyOptions.automatic ? (replyOptions.musicOnly?window.UwUMusicAuto.triggerPrompt:window.SmartMessaging.backgroundPrompt(chat, replyOptions)) : `[系统通知：距离上次互动已有一段时间。请以${chat.realName}的身份主动发起新话题，或自然地延续之前的对话。]` }]
                });
            } else if (historySlice.length > 0 && historySlice[historySlice.length - 1].role === 'assistant') {
                contents.push({
                    role: 'user',
                    parts: [{ text: `[系统通知：我暂未回复，${chat.realName}再次主动发送了消息]` }]
                });
            }

            // 如果有占位符，在 Gemini 模式下，我们将聊天记录格式化为文本并替换占位符
            if (hasHistoryPlaceholder) {
                let historyTextForPlaceholder = "<chat_history>\n";
                
                // 提取除了最后一条用户消息之外的所有历史记录
                let historyContents = [];
                let lastUserContent = null;
                
                if (contents.length > 0) {
                    // 找到最后一条用户消息
                    let lastUserIndex = -1;
                    for (let i = contents.length - 1; i >= 0; i--) {
                        if (contents[i].role === 'user') {
                            lastUserIndex = i;
                            break;
                        }
                    }
                    
                    if (lastUserIndex !== -1) {
                        historyContents = contents.slice(0, lastUserIndex);
                        lastUserContent = contents.slice(lastUserIndex); // 包含最后一条用户消息及其后的系统通知等
                    } else {
                        historyContents = contents;
                    }
                }

                historyContents.forEach(c => {
                    const roleName = c.role === 'model' ? chat.realName : chat.myName;
                    const text = c.parts.map(p => p.text || '').join('');
                    historyTextForPlaceholder += `${roleName}: ${text}\n`;
                });
                historyTextForPlaceholder += "</chat_history>";
                systemPrompt = systemPrompt.replace('【动态插入: 聊天记录】', historyTextForPlaceholder);
                
                // 清空原有的 contents，只保留最后一条用户消息
                if (lastUserContent) {
                    contents = lastUserContent;
                } else {
                    contents = [];
                }
            }

            requestBody = {
                contents: contents,
                system_instruction: {parts: [{text: systemPrompt}]},
                generationConfig: {
                    temperature: apiConfig.temperatureEnabled && apiConfig.temperature !== undefined ? apiConfig.temperature : 1.0
                }
            };
        } else {
            const messages = [{role: 'system', content: systemPrompt}];
            
            const pushOrMergeMessage = (role, content) => {
                const lastMessage = messages[messages.length - 1];
                if (lastMessage && lastMessage.role === role && role !== 'system') {
                    if (typeof lastMessage.content === 'string' && typeof content === 'string') {
                        lastMessage.content += '\n' + content;
                    } else {
                        let lastContentArr = Array.isArray(lastMessage.content) ? lastMessage.content : [{type: 'text', text: lastMessage.content}];
                        let newContentArr = Array.isArray(content) ? content : [{type: 'text', text: content}];
                        
                        const lastItem = lastContentArr[lastContentArr.length - 1];
                        const firstNewItem = newContentArr[0];
                        
                        if (lastItem.type === 'text' && firstNewItem.type === 'text') {
                            lastItem.text += '\n' + firstNewItem.text;
                            lastContentArr = lastContentArr.concat(newContentArr.slice(1));
                        } else {
                            if (lastItem.type === 'text') {
                                lastItem.text += '\n';
                            } else {
                                lastContentArr.push({type: 'text', text: '\n'});
                            }
                            lastContentArr = lastContentArr.concat(newContentArr);
                        }
                        lastMessage.content = lastContentArr;
                    }
                } else {
                    messages.push({role: role, content: content});
                }
            };

            let lastTimeMarkerForAI = 0;
            
            historySlice.forEach(msg => {
               let content;
               let prefix = '';
               
               const currentMsgTime = msg.timestamp;
               const isSameMarkerDay = (window.UwULocation?.enabled(chat) ? window.UwULocation.at(chat,'user',new Date(currentMsgTime)).day === window.UwULocation.at(chat,'user',new Date(lastTimeMarkerForAI)).day : new Date(currentMsgTime).toDateString() === new Date(lastTimeMarkerForAI).toDateString());
               
               if (lastTimeMarkerForAI === 0 || currentMsgTime - lastTimeMarkerForAI >= 10 * 60 * 1000 || !isSameMarkerDay) {
                   const dateObj = new Date(currentMsgTime);
                   const timeStr = window.UwULocation?.enabled(chat) ? window.UwULocation.at(chat,'user',dateObj).short : `${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
                   prefix = `[system: ${timeStr}]\n`;
                   lastTimeMarkerForAI = currentMsgTime;
               }

               if (msg.role === 'user' && msg.quote) {
                   const replyTextMatch = msg.content.match(/\[.*?的消息：([\s\S]+?)\]/);
                   const replyText = replyTextMatch ? replyTextMatch[1] : msg.content;
                   
                   content = `${prefix}[${chat.myName}引用“${msg.quote.content}”并回复：${replyText}]` + (msg.shiyeContext || '');
                   if (msg.shiyeImages?.length) content = [{type:'text',text:content}, ...msg.shiyeImages.map(data=>({type:'image_url',image_url:{url:data}}))];
                   pushOrMergeMessage('user', content);

               } else {
                   if (msg.parts && msg.parts.length > 0) {
                       let prefixAdded = false;
                       
                       content = msg.parts.map(p => {
                           if (p.type === 'text' || p.type === 'html') {
                               const textContent = (!prefixAdded) ? (prefix + p.text) : p.text;
                               prefixAdded = true;
                               return {type: 'text', text: textContent};
                           } else if (p.type === 'image') {
                               return {type: 'image_url', image_url: {url: p.data}};
                           }
                           return null;
                       }).filter(p => p);
                   } else {
                       content = prefix + msg.content;
                   }
                   
                   pushOrMergeMessage(msg.role, content);
               }
            });

            // 【新增】将最新一轮的 user 消息用 <user_input> 框起来
            let lastUserIndex = -1;
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    lastUserIndex = i;
                    break;
                }
            }
            if (lastUserIndex !== -1) {
                let msg = messages[lastUserIndex];
                if (typeof msg.content === 'string') {
                    msg.content = "<user_input>\n" + msg.content + "\n</user_input>";
                } else if (Array.isArray(msg.content)) {
                    msg.content.unshift({type: 'text', text: "<user_input>\n"});
                    msg.content.push({type: 'text', text: "\n</user_input>"});
                }
            }

            // 如果有占位符，将 messages 数组中的历史记录格式化为文本并替换占位符
            if (hasHistoryPlaceholder) {
                let historyTextForPlaceholder = "<chat_history>\n";
                
                // 找到最后一条用户消息的索引
                let lastUserIndex = -1;
                for (let i = messages.length - 1; i >= 0; i--) {
                    if (messages[i].role === 'user') {
                        lastUserIndex = i;
                        break;
                    }
                }

                // 提取历史记录（跳过第一个 system 消息，且不包含最后一条用户消息）
                const endIndex = lastUserIndex !== -1 ? lastUserIndex : messages.length;
                for (let i = 1; i < endIndex; i++) {
                    const msg = messages[i];
                    const roleName = msg.role === 'assistant' ? chat.realName : chat.myName;
                    let text = '';
                    if (typeof msg.content === 'string') {
                        text = msg.content;
                    } else if (Array.isArray(msg.content)) {
                        text = msg.content.map(p => p.text || '').join('');
                    }
                    historyTextForPlaceholder += `${roleName}: ${text}\n`;
                }
                historyTextForPlaceholder += "</chat_history>";
                
                // 替换 system 消息中的占位符
                if (messages.length > 0 && messages[0].role === 'system') {
                    messages[0].content = messages[0].content.replace('【动态插入: 聊天记录】', historyTextForPlaceholder);
                }

                // 清空原有的历史记录，只保留 system 消息和最后一条用户消息
                if (lastUserIndex !== -1) {
                    const systemMsg = messages[0];
                    const lastUserMsgs = messages.slice(lastUserIndex);
                    messages.length = 0; // 清空数组
                    messages.push(systemMsg, ...lastUserMsgs);
                } else {
                    // 如果没有用户消息，只保留 system 消息
                    messages.splice(1);
                }
            }

            // === 【第三步：处理后台通知与 CoT 序列】 ===
            
            // 1. 如果是后台消息，先插入系统通知（作为任务输入）
            if (isBackground) {
                pushOrMergeMessage('user', replyOptions.automatic ? (replyOptions.musicOnly?window.UwUMusicAuto.triggerPrompt:window.SmartMessaging.backgroundPrompt(chat, replyOptions)) : `[系统通知：我已有一段时间没有和你互动了，请以${chat.realName}的身份主动地延续之前的对话或发起新话题，或对时间流逝做出反应。]`);
            } else if (historySlice.length > 0 && historySlice[historySlice.length - 1].role === 'assistant') {
                pushOrMergeMessage('user', `[系统通知：我暂未回复，${chat.realName}再次主动发送了消息]`);
            }

            // 2. 插入 CoT 序列（无论前台后台，只要开启就插入）
            const cotEnabled = db.cotSettings && db.cotSettings.enabled;
            
            if (cotEnabled) {
                let cotInstruction = '';
                // 优先使用角色专属 CoT 预设
                let activePresetId = 'default';
                if (chat.exclusiveCotPreset) {
                    activePresetId = chat.exclusiveCotPreset;
                } else if (db.cotSettings && db.cotSettings.activePresetId) {
                    activePresetId = db.cotSettings.activePresetId;
                }
                const preset = (db.cotPresets || []).find(p => p.id === activePresetId);
                
                if (preset && preset.items) {
                    cotInstruction = preset.items
                        .filter(item => item.enabled)
                        .map(item => item.content)
                        .join('\n\n');
                }

                if (cotInstruction) {
                    // 1. 插入后置指令
                    messages.push({
                        role: 'system', // 或者 'user'
                        content: cotInstruction
                    });

                    // 2. 插入触发器
                    pushOrMergeMessage('user', '[incipere]');

                    // 3. 插入 Prefill (预填/强塞)
                    const prefillEnabled = db.cotSettings.prefillEnabled !== false;
                    if (prefillEnabled) {
                        pushOrMergeMessage('assistant', replyPrefillTag(cotInstruction));
                    }
                }
            }

            requestBody = {
                model: model, 
                messages: messages, 
                stream: streamEnabled,
                temperature: apiConfig.temperatureEnabled && apiConfig.temperature !== undefined ? apiConfig.temperature : 1.0
            };
        }
        
        // 格式化打印日志
        let logText = "========== [发送给 AI 的请求内容] ==========\n";
        if (requestBody.messages) {
            requestBody.messages.forEach(msg => {
                logText += `【${msg.role}】:\n`;
                if (typeof msg.content === 'string') {
                    logText += msg.content + "\n\n";
                } else if (Array.isArray(msg.content)) {
                    let textContent = "";
                    msg.content.forEach(part => {
                        if (part.type === 'text') {
                            textContent += part.text;
                        } else if (part.type === 'image_url') {
                            textContent += "[图片：base64图片已在此简略]";
                        }
                    });
                    logText += textContent + "\n\n";
                }
            });
        } else if (requestBody.contents) {
            if (requestBody.system_instruction && requestBody.system_instruction.parts) {
                logText += `【system】:\n`;
                requestBody.system_instruction.parts.forEach(part => {
                    logText += (part.text || "") + "\n";
                });
                logText += "\n";
            }
            requestBody.contents.forEach(c => {
                logText += `【${c.role}】:\n`;
                let textContent = "";
                if (c.parts) {
                    c.parts.forEach(part => {
                        if (part.text !== undefined) {
                            textContent += part.text;
                        } else if (part.inline_data) {
                            textContent += "[图片：base64图片已在此简略]";
                        }
                    });
                }
                logText += textContent + "\n\n";
            });
        }
        logText += "============================================";
        console.log(logText);

        const endpoint = (provider === 'gemini') ? `${url}/v1beta/models/${model}:${streamEnabled ? 'streamGenerateContent' : 'generateContent'}?key=${getRandomValue(key)}` : `${url}/v1/chat/completions`;
        const headers = (provider === 'gemini') ? {'Content-Type': 'application/json'} : {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`
        };
        if(chatType==='private'&&isBackground&&window.SmartReplyControl){const denied=await window.SmartReplyControl.reserve(chat,replyOptions,requestController);if(denied)return {status:denied};}
        if(replyOptions.calendarContext&&!window.UwUCalendar.current(chat,replyOptions.calendarContext))return {status:'stale'};
        window.VectorMemory?.markSent(chat,replyOptions.vectorContext);
        const response = await fetch(endpoint, {
            method: 'POST',
            signal: requestController.signal,
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const error = new Error(`API Error: ${response.status} ${await response.text()}`);
            error.response = response;
            throw error;
        }
        
        if (streamEnabled) {
            return await processStream(response, chat, provider, chatId, chatType, isBackground, replyOptions);
        } else {
            let result;
            try {
                result = await response.json();
                console.log('【API完整响应数据】:', result);
            } catch (e) {
                const text = await response.text();
                console.error("Failed to parse JSON:", text);
                throw new Error(`API返回了非JSON格式数据 (可能是网页HTML)。请检查API地址是否正确。原始内容开头: ${text.substring(0, 50)}...`);
            }

            let fullResponse = "";
            if (provider === 'gemini') {
                fullResponse = (result.candidates?.[0]?.content?.parts || []).filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('');
            } else {
                const message = result.choices?.[0]?.message || {};
                fullResponse = replyWithReturnedReasoning(message.content, message.reasoning_content || message.reasoning);
            }
            
            return await handleAiReplyContent(fullResponse, chat, chatId, chatType, isBackground, replyOptions);
        }

    } catch (error) {
        if (requestController.signal.aborted) return {status:'cancelled'};
        if (isBackground && replySnapshot.epoch !== window.SmartMessaging.state(chat).epoch) return { status: 'stale' };
        if (!isBackground) showApiError(error);
        else console.error("Background Auto-Reply Error:", error);
        return { status: 'error' };
    } finally {
        window.SmartMessaging.end(chat, requestController);
        if (!isBackground) {
            isGenerating = false;
            getReplyBtn.disabled = false;
            regenerateBtn.disabled = false;
            typingIndicator.style.display = 'none';
        }
    }
}

async function processStream(response, chat, apiType, targetChatId, targetChatType, isBackground = false, replyOptions = {}) {
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let fullResponse = "", accumulatedChunk = "", returnedReasoning = "";
    const appendStreamFrame = frame => {
        for (const line of frame.split("\n")) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
                const delta = JSON.parse(data).choices?.[0]?.delta || {};
                fullResponse += replyTextValue(delta.content);
                returnedReasoning += replyTextValue(delta.reasoning_content || delta.reasoning);
            } catch (_) {}
        }
    };
    for (; ;) {
        const {done, value} = await reader.read();
        if (done) break;
        accumulatedChunk += decoder.decode(value, {stream: true});
        if (apiType === "openai" || apiType === "deepseek" || apiType === "claude" || apiType === "newapi") {
            const parts = accumulatedChunk.split(/\r?\n\r?\n/);
            accumulatedChunk = parts.pop();
            parts.forEach(appendStreamFrame);
        }
    }
    accumulatedChunk += decoder.decode();
    if (apiType !== 'gemini' && accumulatedChunk.trim()) appendStreamFrame(accumulatedChunk);
    if (apiType === "gemini") {
        try {
            const parsedStream = JSON.parse(accumulatedChunk);
            fullResponse = parsedStream.map(item => (item.candidates?.[0]?.content?.parts || []).filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('')).join('');
        } catch (e) {
            console.error("Error parsing Gemini stream:", e, "Chunk:", accumulatedChunk);
            if (!isBackground) showToast("解析Gemini响应失败");
            return;
        }
    }
    fullResponse = replyWithReturnedReasoning(fullResponse, returnedReasoning);
    return await handleAiReplyContent(fullResponse, chat, targetChatId, targetChatType, isBackground, replyOptions);
}

// Bubble pacing follows the visible chat, regardless of how the reply was triggered.
function replyChatVisible(chatId,chatType){
    return typeof currentChatId!=='undefined'&&currentChatId===chatId
        &&typeof currentChatType!=='undefined'&&currentChatType===chatType
        &&document.hidden!==true
        &&document.getElementById('chat-room-screen')?.classList.contains('active')===true;
}

async function handleAiReplyContent(fullResponse, chat, targetChatId, targetChatType, isBackground = false, replyOptions = {}) {
    if (replyOptions.requestSignal?.aborted) return {status:'cancelled'};
    if(replyOptions.musicOnly&&!window.UwUMusicAuto.valid(chat,replyOptions.musicTicket))return {status:'stale'};
    if(replyOptions.musicOnly)fullResponse=String(fullResponse).replace(/<music_idle\s*\/>/gi,'').trim();
    // 请求期间有新消息、切存档或关闭模式时，废弃旧的自动结果。
    const allowInterleave=isBackground&&replyOptions.automatic===true&&(replyOptions.interleaved===true||replyOptions.allowCrossedReply===true);
    if (replyOptions.snapshot && !window.SmartMessaging.current(chat, replyOptions.snapshot,allowInterleave)) return { status: 'stale' };
    const replyHistory=chat.history,replyArchive=chat.activeArchiveId||null;
    if(replyOptions.calendarContext&&!window.UwUCalendar.current(chat,replyOptions.calendarContext))return {status:'stale'};
    const sameReplyTarget=()=>!replyOptions.requestSignal?.aborted&&(!replyOptions.calendarContext||window.UwUCalendar.current(chat,replyOptions.calendarContext))&&chat.history===replyHistory&&(chat.activeArchiveId||null)===replyArchive&&(targetChatType==='private'?db.characters:db.groups).includes(chat);
    const calendarAck=window.UwUCalendar?.stripAck(fullResponse)||{clean:fullResponse,keys:[]};
    fullResponse=calendarAck.clean;
    const musicParsed=window.UwUMusicHost?.parse(fullResponse)||{clean:fullResponse,actions:[]};
    fullResponse=musicParsed.clean;
    const shareParsed=targetChatType==='private'&&!replyOptions.musicOnly&&window.UwUMusicShare?window.UwUMusicShare.parse(fullResponse):{clean:fullResponse,actions:[]};
    fullResponse=shareParsed.clean;
    const reviewParsed=targetChatType==='private'&&!replyOptions.musicOnly&&window.UwUReviews?window.UwUReviews.parse(fullResponse):{clean:fullResponse,actions:[]};
    fullResponse=reviewParsed.clean;
    const toolsParsed=targetChatType==='private'&&!replyOptions.musicOnly&&window.UwUChatTools?window.UwUChatTools.parse(fullResponse):{clean:fullResponse,actions:[]};
    fullResponse=toolsParsed.clean;
    const extracted = window.SmartMessaging.stripNote(fullResponse);
    fullResponse = extracted.clean;
    if (!fullResponse && !musicParsed.actions.length && !toolsParsed.actions.length && !reviewParsed.actions.length && !shareParsed.actions.length && extracted.note && targetChatType === 'private' && window.SmartMessaging.state(chat).enabled && replyOptions.recordPaper!==false) {
        // 已出现新用户消息时，不让旧请求的纸条覆盖新状态。
        if(allowInterleave&&replyOptions.snapshot?.userId!==chat.history.filter(m=>m.role==='user'&&!m.isWithdrawn&&!m.isContextDisabled).at(-1)?.id)return {status:'stale'};
        // 只有内部碎片时仍更新可恢复的记录，但不能算角色已经主动说了一轮。
        window.SmartMessaging.checkpoint(chat);
        window.SmartMessaging.commit(chat, extracted.note, replyOptions.kind === 'proactive' ? 'metadata_proactive' : 'metadata');
        await saveData();
        return { status: 'metadata' };
    }
    if(!fullResponse.trim()&&!toolsParsed.actions.length&&!reviewParsed.actions.length&&!shareParsed.actions.length&&musicParsed.actions.length&&targetChatType==='private'&&sameReplyTarget()){if(extracted.note&&window.SmartMessaging.state(chat).enabled&&replyOptions.recordPaper!==false){window.SmartMessaging.checkpoint(chat);window.SmartMessaging.commit(chat,extracted.note,replyOptions.kind==='proactive'?'metadata_proactive':'metadata');await saveData();}await window.UwUMusicHost?.execute(chat,musicParsed.actions,replyOptions.musicContext);return {status:'metadata'};}
    window.SmartMessaging.checkpoint(chat);
    const rawResponse = fullResponse;
    let historyStart = chat.history.length;
    const roundId = replyOptions.roundId || 'round_'+Date.now()+'_'+Math.random().toString(36).slice(2);
    const reviewWorkIds=targetChatType==='private'&&sameReplyTarget()?window.UwUReviews?.apply(chat,reviewParsed,roundId)||[]:[];
    if(targetChatType==='private'&&sameReplyTarget())window.UwUChatTools?.apply(chat,toolsParsed);
    if (fullResponse || toolsParsed.actions.length || reviewParsed.actions.length || shareParsed.actions.length) {
        // 1. 移除 [incipere] 标签
        fullResponse = fullResponse.replace(/\[incipere\]/g, "");

        // 2. Capture both original thinking and visible preplan blocks.
        const preparation = splitReplyPreparation(fullResponse);
        if (preparation.thinking) {
            const thinkingContent = preparation.thinking;

            // 创建思考过程消息对象
            const thinkingMsg = {
                id: `msg_${Date.now()}_${Math.random()}`,
                role: 'assistant',
                content: thinkingContent,
                timestamp: Date.now(),
                roundId,
                isThinking: true,
                isContextDisabled: true // 【关键】标记为不进入上下文
            };
            
            // 存入历史记录
            chat.history.push(thinkingMsg);

            // 【新增】清理旧的思维链消息，仅保留最近 50 条
            const maxThinkingMsgs = 50;
            let thinkingCount = 0;
            const idsToRemove = new Set();
            // 从后往前遍历，保留最近的 50 个，其他的标记为待删除
            for (let i = chat.history.length - 1; i >= 0; i--) {
                if (chat.history[i].isThinking) {
                    thinkingCount++;
                    if (thinkingCount > maxThinkingMsgs) {
                        idsToRemove.add(chat.history[i].id);
                    }
                }
            }
            if (idsToRemove.size > 0) {
                // Keep the same history object: retention is not an archive switch.
                for (let i = chat.history.length - 1; i >= 0; i--) {
                    if (idsToRemove.has(chat.history[i].id)) chat.history.splice(i, 1);
                }
                historyStart -= idsToRemove.size;
            }
            
            // 添加到界面气泡（由于 regex 设置，会被隐藏，仅 Debug 模式可见）
            addMessageBubble(thinkingMsg, targetChatId, targetChatType);
            
            // 从即将显示的文本中移除思考内容
            fullResponse = preparation.body;
        }

        // --- 朋友圈指令解析 ---
        const momentPostWithImageRegex = /\[(.*?)\s*发布了一条带图动态[：:](.*?)\|([\s\S]+?)\]/;
        const momentPostRegex = /\[(.*?)\s*发布了一条动态[：:]([\s\S]+?)\]/;
        const momentCommentRegex = /\[(.*?)\s*(?:评论了|回复了)\s*(.*?)(?:(?:的|在)动态["“'‘](.*?)["”'’])?(?:下的评论)?[：:]\s*([\s\S]+?)\]/;
        const momentSignatureRegex = /\[(.*?)\s*更新了个性签名[：:]([\s\S]+?)\]/;

        let momentPostWithImageMatch, momentPostMatch, momentCommentMatch, momentSignatureMatch;
        
        let messagesToProcess = getMixedContent(fullResponse).filter(item => item.content.trim() !== '');
        let remainingMessages = [];

        for (const item of messagesToProcess) {
            const content = item.content.trim();
            momentPostWithImageMatch = content.match(momentPostWithImageRegex);
            momentPostMatch = content.match(momentPostRegex);
            momentCommentMatch = content.match(momentCommentRegex);
            momentSignatureMatch = content.match(momentSignatureRegex);

            let isMomentAction = false;

            if (momentPostWithImageMatch) {
                isMomentAction = true;
                const author = momentPostWithImageMatch[1].trim();
                const imageDesc = momentPostWithImageMatch[2].trim();
                const momentContent = momentPostWithImageMatch[3].trim();
                
                if (!chat.moments) chat.moments = [];
                chat.moments.unshift({
                    id: `moment_${Date.now()}`,
                    author: author,
                    content: momentContent,
                    imageDescription: imageDesc, // 保存图片描述
                    timestamp: Date.now(),
                roundId,
                    likes: [],
                    comments: []
                });

                const notificationMsg = {
                    id: `msg_${Date.now()}_${Math.random()}`,
                    role: 'system',
                    content: `[system-display:您关注的 ${author} 发布了新动态]`,
                    timestamp: Date.now(),
                roundId,
                    isContextDisabled: true
                };
                chat.history.push(notificationMsg);
                addMessageBubble(notificationMsg, targetChatId, targetChatType);
            }
            else if (momentPostMatch && !momentPostWithImageMatch) { // 确保不重复匹配
                isMomentAction = true;
                const author = momentPostMatch[1].trim();
                const momentContent = momentPostMatch[2].trim();
                
                if (!chat.moments) chat.moments = [];
                chat.moments.unshift({
                    id: `moment_${Date.now()}`,
                    author: author,
                    content: momentContent,
                    timestamp: Date.now(),
                roundId,
                    likes: [],
                    comments: []
                });

                const notificationMsg = {
                    id: `msg_${Date.now()}_${Math.random()}`,
                    role: 'system',
                    content: `[system-display:您关注的 ${author} 发布了新动态]`,
                    timestamp: Date.now(),
                roundId,
                    isContextDisabled: true
                };
                chat.history.push(notificationMsg);
                addMessageBubble(notificationMsg, targetChatId, targetChatType);
            } 
            else if (momentCommentMatch) {
                isMomentAction = true;
                const commenter = momentCommentMatch[1].trim();
                const commentedOn = momentCommentMatch[2].trim();
                const momentSnippet = momentCommentMatch[3] ? momentCommentMatch[3].trim() : null;
                const commentContent = momentCommentMatch[4].trim();

                if (chat.moments && chat.moments.length > 0) {
                    let targetMoment = null;
                    if (momentSnippet) {
                        targetMoment = chat.moments.find(m => m.content.includes(momentSnippet));
                    }
                    if (!targetMoment) {
                        targetMoment = chat.moments.sort((a, b) => b.timestamp - a.timestamp)[0];
                    }

                    if (targetMoment) {
                        if (!targetMoment.comments) targetMoment.comments = [];
                        const newComment = {
                            id: `comment_${Date.now()}`,
                            author: commenter,
                            content: commentContent,
                            timestamp: Date.now(),
                            roundId
                        };
                        const isReplyToComment = content.includes('回复了') && content.includes('下的评论');
                        if (isReplyToComment || (commentedOn !== chat.realName && commentedOn !== '自己')) {
                             newComment.replyTo = commentedOn;
                        }
                        targetMoment.comments.push(newComment);
                        if (commentedOn === chat.myName || commentedOn === '你') {
                            const notificationMsg = {
                                id: `msg_${Date.now()}_${Math.random()}`,
                                role: 'system',
                                content: `[system-display:您在${chat.realName}的动态下的评论被回复了]`,
                                timestamp: Date.now(),
                roundId,
                                isContextDisabled: true
                            };
                            chat.history.push(notificationMsg);
                            addMessageBubble(notificationMsg, targetChatId, targetChatType);
                        }
                    }
                }
            }
            else if (momentSignatureMatch) {
                isMomentAction = true;
                const newSignature = momentSignatureMatch[2].trim();
                chat.momentsSignature = newSignature;
                
                if (document.getElementById('moments-screen').classList.contains('active')) {
                    renderMomentsScreen();
                }
            }

            if (isMomentAction) {
                const originalCmdMsg = {
                    id: `msg_${Date.now()}_${Math.random()}`,
                    role: 'assistant',
                    content: content,
                    timestamp: Date.now(),
                roundId,
                    isContextDisabled: false
                };
                chat.history.push(originalCmdMsg);
                addMessageBubble(originalCmdMsg, targetChatId, targetChatType);
            } else {
                remainingMessages.push(item);
            }
        }
        
        fullResponse = remainingMessages.map(item => item.content).join('\n');
        // --- 朋友圈指令解析结束 ---

        // --- 红包结算逻辑 ---
        const redPacketMsg = chat.history.find(m => m.type === 'red-packet' && !m.isRevealed);
        if (redPacketMsg) {
            redPacketMsg.isRevealed = true;
            // 触发重新渲染红包消息
            setTimeout(() => {
                if (currentChatId === chat.id) {
                    renderMessages(false, false);
                }
            }, 500);
        }

        if (db.globalReceiveSound) {
            playSound(db.globalReceiveSound);
        }
        // ... 后续代码保持不变 ...
        console.log('【AI原始返回内容】:', rawResponse);
        let cleanedResponse = fullResponse.replace(/^\[system:.*?\]\s*/, '').replace(/^\(时间:.*?\)\s*/, '');
        const trimmedResponse = cleanedResponse.trim();
        let messages;

        if (trimmedResponse.startsWith('<') && trimmedResponse.endsWith('>')) {
            messages = [{ type: 'html', content: trimmedResponse }];
        } else {
            messages = getMixedContent(fullResponse).filter(item => item.content.trim() !== '');
        }

        let firstMessageProcessed = false;

        for (const item of messages) {
            if(replyOptions.requestSignal?.aborted)return {status:'cancelled'};
            if(!sameReplyTarget())return {status:'stale'};
            // 自动剔除不存在的表情包
            const stickerRegex = /\[(?:.*?的)?表情包：(.+?)\]/i;
            const stickerMatch = item.content.match(stickerRegex);
            if (stickerMatch) {
                const stickerName = stickerMatch[1].trim();
                const groups = (chat.stickerGroups || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
                let targetSticker = null;
                
                // 1. 优先在绑定分组中查找
                if (groups.length > 0) {
                    targetSticker = db.myStickers.find(s => groups.includes(s.group) && s.name === stickerName);
                }
                
                // 2. 兜底在所有表情包中查找
                if (!targetSticker) {
                    targetSticker = db.myStickers.find(s => s.name === stickerName);
                }
                
                // 3. 如果完全找不到，则剔除该消息
                if (!targetSticker) {
                    console.log(`[Auto-Filter] 剔除不存在的表情包: ${stickerName}`);
                    continue; 
                }
            }

            // --- 自动隔空投送检测 ---
            const photoRegex = /\[(.*?)发来的照片\/视频：(.*?)\]/;
            const photoMatch = item.content.match(photoRegex);
            if (photoMatch && chat.autoAirDropEnabled) {
                // 延迟一点触发，确保消息已经渲染
                setTimeout(() => {
                    if (typeof receiveAirDropPhoto === 'function') {
                        // 找到刚插入的这条消息的 ID
                        const targetMsg = chat.history[chat.history.length - 1];
                        if (targetMsg) {
                            receiveAirDropPhoto(targetMsg.id, true);
                        }
                    }
                }, 500);
            }

            // --- 视频/语音通话邀请检测 ---
            const callInviteRegex = /\[(.*?)向(.*?)发起了(视频|语音)通话\]/;
            const callInviteMatch = item.content.match(callInviteRegex);
            if (callInviteMatch) {
                const type = callInviteMatch[3] === '视频' ? 'video' : 'voice';
                // 触发来电界面
                if (window.VideoCallModule && typeof window.VideoCallModule.receiveCall === 'function') {
                    window.VideoCallModule.receiveCall(type);
                }
                // 不将此消息显示为普通气泡，或者显示为系统通知
                // 这里选择显示为系统通知样式的消息
                const message = {
                    id: `msg_${Date.now()}_${Math.random()}`,
                    role: 'system', // 使用 system 角色
                    content: item.content.trim(),
                    timestamp: Date.now(),
                            roundId
                };
                chat.history.push(message);
                addMessageBubble(message, targetChatId, targetChatType);
                continue; // 跳过后续处理
            }

            if (targetChatType === 'private') {
                const char = db.characters.find(c => c.id === targetChatId);
                if (char && char.statusPanel && char.statusPanel.enabled && char.statusPanel.regexPattern) {
                    try {
                        let pattern = char.statusPanel.regexPattern;
                        let flags = 'gs'; 

                        const matchParts = pattern.match(/^\/(.*?)\/([a-z]*)$/);
                        if (matchParts) {
                            pattern = matchParts[1];
                            flags = matchParts[2] || 'gs';
                            if (!flags.includes('s')) flags += 's';
                        }

                    const regex = new RegExp(pattern, flags);
                    const match = regex.exec(item.content);
                    
                    if (match) {
                        const rawStatus = match[0];
                        
                        let html = char.statusPanel.replacePattern;
                        
                            // 使用正则一次性查找模板中的 $数字 并替换
    html = html.replace(/\$(\d+)/g, (fullMatch, groupIndex) => {
        const index = parseInt(groupIndex, 10);
        // 如果捕获组存在，则返回对应内容；否则保持原样
        return (match[index] !== undefined) ? match[index] : fullMatch;
    });


                        // Save to history
                        if (!char.statusPanel.history) char.statusPanel.history = [];
                        
                        // Add new status to the beginning
                        char.statusPanel.history.unshift({
                            raw: rawStatus,
                            html: html,
                            timestamp: Date.now(),
                            roundId
                        });

                        // Keep only last 20 items
                        if (char.statusPanel.history.length > 20) {
                            char.statusPanel.history = char.statusPanel.history.slice(0, 20);
                        }

                        char.statusPanel.currentStatusRaw = rawStatus;
                        char.statusPanel.currentStatusHtml = html;
                        
                        item.isStatusUpdate = true;
                        item.statusSnapshot = {
                            regex: pattern,
                            replacePattern: char.statusPanel.replacePattern
                        };
                        }
                    } catch (e) {
                        console.error("状态栏正则解析错误:", e);
                    }
                }
            }

            // 主动回复和点击回复在当前聊天室都逐条显示；离开后直接保存。
            if (replyChatVisible(targetChatId,targetChatType)) {
                const delay = firstMessageProcessed ? (900 + Math.random() * 1300) : (400 + Math.random() * 400);
                await waitForReplyBubble(delay, replyOptions.requestSignal);
                if(replyOptions.requestSignal?.aborted)return {status:'cancelled'};
            if(!sameReplyTarget())return {status:'stale'};
                
                // 如果开启了多条消息提示音，且不是第一条消息（第一条已由系统默认逻辑播放），则播放提示音
                if (firstMessageProcessed && db.multiMsgSoundEnabled && db.globalReceiveSound) {
                    playSound(db.globalReceiveSound);
                }
            }
            firstMessageProcessed = true;

            const aiWithdrawRegex = /\[(.*?)撤回了一条消息：([\s\S]*?)\]/;
            const aiWithdrawRegexEn = /\[(?:system:\s*)?(.*?) withdrew a message\. Original: ([\s\S]*?)\]/;
            
            const withdrawMatch = item.content.match(aiWithdrawRegex) || item.content.match(aiWithdrawRegexEn);

            if (withdrawMatch) {
                const characterName = withdrawMatch[1];
                const originalContent = withdrawMatch[2].trim();

                // --- 【新增兜底机制】检查上一条消息是否为重复输出 ---
                if (chat.history.length > 0) {
                    const lastMsg = chat.history[chat.history.length - 1];
                    // 提取上一条消息的纯文本内容（剥离包装标签）
                    let lastMsgPureContent = lastMsg.content;
                    const textMatch = lastMsg.content.match(/\[.*?的消息[：:]([\s\S]+?)\]/);
                    if (textMatch) {
                        lastMsgPureContent = textMatch[1].trim();
                    } else {
                        lastMsgPureContent = lastMsgPureContent.trim();
                    }

                    // 检查内容是否匹配且发送者一致
                    const isSameContent = (lastMsgPureContent === originalContent);
                    let isSameSender = false;
                    if (targetChatType === 'private') {
                        isSameSender = (lastMsg.role === 'assistant');
                    } else {
                        const sender = chat.members.find(m => (m.realName === characterName || m.groupNickname === characterName));
                        isSameSender = (sender && lastMsg.senderId === sender.id);
                    }

                    if (isSameContent && isSameSender) {
                        console.log(`[Withdraw-Fallback] 检测到重复输出，移除上一条消息: ${lastMsg.id}`);
                        chat.history.pop(); // 从历史记录移除
                        // 从 DOM 移除
                        const lastMsgEl = messageArea.querySelector(`.message-wrapper[data-id="${lastMsg.id}"]`);
                        if (lastMsgEl) lastMsgEl.remove();
                    }
                }
                // ----------------------------------------------

                const normalContent = `[${characterName}的消息：${originalContent}]`;
                
                const message = {
                    id: `msg_${Date.now()}_${Math.random()}`,
                    role: 'assistant',
                    content: normalContent,
                    parts: [{type: 'text', text: normalContent}],
                    timestamp: Date.now(),
                roundId,
                    originalContent: originalContent, 
                    isWithdrawn: false 
                };

                if (targetChatType === 'group') {
                    const sender = chat.members.find(m => (m.realName === characterName || m.groupNickname === characterName));
                    if (sender) {
                        message.senderId = sender.id;
                    }
                }

                chat.history.push(message);
                addMessageBubble(message, targetChatId, targetChatType);
                
                setTimeout(async () => {
                    message.isWithdrawn = true;
                    message.content = `[${characterName}撤回了一条消息：${originalContent}]`;
                    
                    await saveData();
                    
                    if ((targetChatType === 'private' && currentChatId === chat.id) || 
                        (targetChatType === 'group' && currentChatId === chat.id)) {
                         renderMessages(false, true);
                    }
                }, 2000);

                continue; 
            }

            if (targetChatType === 'private') {
                const character = chat;
                const myName = character.myName;

                const aiQuoteRegex = new RegExp(`\\[${character.realName}引用[“"](.*?)["”]并回复：([\\s\\S]*?)\\]`);
                const aiQuoteMatch = item.content.match(aiQuoteRegex);

                if (aiQuoteMatch) {
                    const quotedText = aiQuoteMatch[1];
                    const replyText = aiQuoteMatch[2];

                    const originalMessage = chat.history.slice().reverse().find(m => {
                        if (m.role === 'user') {
                            const userMessageMatch = m.content.match(/\[.*?的消息：([\s\S]+?)\]/);
                            const userMessageText = userMessageMatch ? userMessageMatch[1] : m.content;
                            return userMessageText.trim() === quotedText.trim();
                        }
                        return false;
                    });

                    if (originalMessage) {
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: `[${character.realName}的消息：${replyText}]`,
                            parts: [{ type: 'text', text: `[${character.realName}的消息：${replyText}]` }],
                            timestamp: Date.now(),
                roundId,
                            isStatusUpdate: item.isStatusUpdate,
                            statusSnapshot: item.statusSnapshot,
                            quote: {
                                messageId: originalMessage.id,
                                senderId: 'user_me',
                                content: quotedText
                            }
                        };
                        chat.history.push(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    } else {
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: `[${character.realName}的消息：${replyText}]`,
                            parts: [{ type: 'text', text: `[${character.realName}的消息：${replyText}]` }],
                            timestamp: Date.now(),
                roundId,
                            isStatusUpdate: item.isStatusUpdate,
                            statusSnapshot: item.statusSnapshot
                        };
                        chat.history.push(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    }
                } else {
                    const receivedTransferRegex = new RegExp(`\\[${character.realName}的转账：.*?元；备注：.*?\\]`);
                    const giftRegex = new RegExp(`\\[${character.realName}送来的礼物：.*?\\]`);

                    const message = {
                        id: `msg_${Date.now()}_${Math.random()}`,
                        role: 'assistant',
                        content: item.content.trim(),
                        parts: [{type: item.type, text: item.content.trim()}],
                        timestamp: Date.now(),
                roundId,
                        isStatusUpdate: item.isStatusUpdate,
                        statusSnapshot: item.statusSnapshot
                    };

                    if (receivedTransferRegex.test(message.content)) {
                        message.transferStatus = 'pending';
                    } else if (giftRegex.test(message.content)) {
                        message.giftStatus = 'sent';
                    }

                    chat.history.push(message);
                    addMessageBubble(message, targetChatId, targetChatType);
                }

            } else if (targetChatType === 'group') {
                const group = chat;
                
                // --- 私聊通知 (不拦截) ---
                if (group.allowGossip && typeof handleGossipMessage === 'function') {
                    handleGossipMessage(group, item.content);
                }

                // 优先检查是否为私聊消息
                const privateRegex = /^\[Private: (.*?) -> (.*?): ([\s\S]+?)\]$/;
                const privateEndRegex = /^\[Private-End: (.*?) -> (.*?)\]$/;
                
                if (privateRegex.test(item.content) || privateEndRegex.test(item.content)) {
                    const match = item.content.match(privateRegex) || item.content.match(privateEndRegex);
                    let senderId = 'unknown';
                    
                    if (match) {
                        const senderName = match[1];
                        // 尝试匹配发送者
                        if (senderName === group.me.nickname) {
                            senderId = 'user_me';
                        } else {
                            const sender = group.members.find(m => m.realName === senderName || m.groupNickname === senderName);
                            if (sender) senderId = sender.id;
                        }
                    }

                    const message = {
                        id: `msg_${Date.now()}_${Math.random()}`,
                        role: 'assistant',
                        content: item.content.trim(),
                        parts: [{type: item.type, text: item.content.trim()}],
                        timestamp: Date.now(),
                roundId,
                        senderId: senderId
                    };
                    group.history.push(message);
                    addMessageBubble(message, targetChatId, targetChatType);
                    continue; // 私聊消息处理完毕，跳过后续普通消息匹配
                }

                const groupTransferRegex = /\[(.*?)\s*向\s*(.*?)\s*转账：([\d.,]+)元；备注：(.*?)\]/;
                const transferMatch = item.content.match(groupTransferRegex);

                const r = /\[(.*?)((?:的消息|的语音|发送的表情包|发来的照片\/视频))：/;
                const nameMatch = item.content.match(r);
                
                if (transferMatch) {
                    const senderName = transferMatch[1];
                    const sender = group.members.find(m => (m.realName === senderName || m.groupNickname === senderName));
                    if (sender) {
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: item.content.trim(),
                            parts: [{type: item.type, text: item.content.trim()}],
                            timestamp: Date.now(),
                roundId,
                            senderId: sender.id,
                            transferStatus: 'pending'
                        };
                        group.history.push(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    }
                } else if (nameMatch || item.char) {
                    const senderName = item.char || (nameMatch[1]);
                    const sender = group.members.find(m => (m.realName === senderName || m.groupNickname === senderName));
                    console.log(sender)
                    if (sender) {
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: item.content.trim(),
                            parts: [{type: item.type, text: item.content.trim()}],
                            timestamp: Date.now(),
                roundId,
                            senderId: sender.id
                        };
                        group.history.push(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    }
                }
            }
        }

        const newReplies = chat.history.slice(historyStart).filter(m => m.role === 'assistant' && !m.isThinking && !m.isStatusUpdate);
        if (!newReplies.length) {if(targetChatType==='private'&&sameReplyTarget()){
            if(extracted.note&&window.SmartMessaging.state(chat).enabled&&replyOptions.recordPaper!==false){
                if(allowInterleave&&replyOptions.snapshot?.userId!==chat.history.filter(m=>m.role==='user'&&!m.isWithdrawn&&!m.isContextDisabled).at(-1)?.id)return {status:'stale'};
                window.SmartMessaging.commit(chat,extracted.note,replyOptions.kind==='proactive'?'metadata_proactive':'metadata');await saveData();
            }
            await window.UwUMusicHost?.execute(chat,musicParsed.actions,replyOptions.musicContext);await window.UwUMusicShare?.execute(chat,shareParsed.actions,replyOptions.songShareContext);if(reviewParsed.actions.length||toolsParsed.actions.length){window.UwUChatTools?.ack(chat,replyOptions.toolsContext);await saveData();if(reviewWorkIds.length)void window.UwUReviews.hydrate(chat,reviewWorkIds);}}return { status: musicParsed.actions.length||toolsParsed.actions.length||reviewParsed.actions.length||shareParsed.actions.length?'metadata':'empty' };}
        const crossed=targetChatType==='private'&&allowInterleave&&window.SmartMessaging.finishCrossedReply(chat,replyOptions.snapshot);
        if (!crossed && targetChatType === 'private' && window.SmartMessaging.state(chat).enabled && replyOptions.recordPaper!==false) {
            window.SmartMessaging.commit(chat, extracted.note, replyOptions.kind);
            window.SmartMessaging.state(chat).failures = 0;
        }
        if(!crossed&&!replyOptions.musicOnly&&targetChatType==='private'&&replyOptions.recordPaper===false){const state=window.SmartMessaging.state(chat);state.pendingReply=null;state.lastContactAt=Date.now();state.lastUserId=chat.history.filter(m=>m.role==='user').at(-1)?.id||null;}
        window.JournalAutomation?.finishRoll(chat);
        const rollbackCalendar=window.UwUCalendar?.record(chat,replyOptions.calendarContext,calendarAck.keys,newReplies);
        window.UwUChatTools?.ack(chat,replyOptions.toolsContext);
        try{await saveData();}catch(error){rollbackCalendar?.();throw error;}
        if(reviewWorkIds.length)void window.UwUReviews.hydrate(chat,reviewWorkIds);
        if(replyOptions.vectorContext)void window.VectorMemory.afterReply(chat,replyOptions.vectorContext,newReplies).catch(console.error);
        if(targetChatType==='private'&&sameReplyTarget()){await window.UwUMusicHost?.execute(chat,musicParsed.actions,replyOptions.musicContext);await window.UwUMusicShare?.execute(chat,shareParsed.actions,replyOptions.songShareContext);}
        window.MessageNotifications?.flush(targetChatId,targetChatType);
        renderChatList();

        // 触发独立的电量检查（不阻塞主流程）
        if (window.BatteryInteraction && typeof window.BatteryInteraction.triggerIndependentCheck === 'function') {
            window.BatteryInteraction.triggerIndependentCheck(chat);
        }
        return { status: 'ok' };
    }
    return { status: 'empty' };
}

async function handleRegenerate() {
    if (isGenerating) return;

    const chat = (currentChatType === 'private')
        ? db.characters.find(c => c.id === currentChatId)
        : db.groups.find(g => g.id === currentChatId);

    if (!chat || !chat.history || chat.history.length === 0) {
        showToast('没有可供重新生成的内容。');
        return;
    }

    const lastUserMessageIndex = chat.history.map(m => m.role).lastIndexOf('user');

    if (lastUserMessageIndex === -1 || lastUserMessageIndex === chat.history.length - 1) {
        showToast('AI尚未回复，无法重新生成。');
        return;
    }

    const originalLength = chat.history.length;
    window.JournalAutomation?.beginRoll(chat,chat.history.slice(lastUserMessageIndex+1),chat.history[lastUserMessageIndex].id);
    window.UwUChatTools?.rollbackPolls(chat,chat.history[lastUserMessageIndex].id);
    window.SmartMessaging.rollback(chat);
    chat.history.splice(lastUserMessageIndex + 1);

    if (chat.history.length === originalLength) {
        showToast('未找到AI的回复，无法重新生成。');
        return;
    }
    
    if (currentChatType === 'private') {
        recalculateChatStatus(chat);
    }

    await saveData();
    
    currentPage = 1; 
    renderMessages(false, true); 

    await getAiReply(currentChatId, currentChatType);
}
