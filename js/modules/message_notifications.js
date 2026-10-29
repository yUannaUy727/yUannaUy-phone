// 系统消息通知：只处理新消息，不在历史渲染时发送。
(() => {
    const preferenceKey = 'uwu-message-notifications-enabled';
    const promptedKey = 'uwu-message-notifications-prompted';
    const seen = new Set();
    const queued=new Map();
    let routeBound=false;
    let enabled = true;
    let requesting = false;
    let testTimer;
    try { enabled = localStorage.getItem(preferenceKey) !== 'false'; } catch (_) {}
    // WebToApp 的通知兼容层实现标准 Notification 构造器，不需要 Service Worker。
    const supported = () => 'Notification' in window && typeof Notification.requestPermission === 'function';
    const webSupported = () => window.isSecureContext && 'serviceWorker' in navigator;
    const inWebView = () => window.__webtoapp_notification_polyfill__ || /(?:\bwv\b|WebToApp)/i.test(navigator.userAgent || '');
    let callbackPermission = 'default';
    const permission = () => Notification.permission || callbackPermission;
    const status = (text) => {
        const el = document.getElementById('message-notification-status');
        if (el) el.textContent = text;
    };
    function refresh() {
        const toggle = document.getElementById('message-notification-switch');
        if (toggle) toggle.checked = enabled;
        if (!supported()) return status('通知接口不可用：套壳 APK 请在 WebToApp 特殊设置开启通知兼容层后重新打包；网页版请使用支持通知的浏览器');
        if (permission() === 'denied') return status('系统权限已拒绝，请到浏览器网站设置和手机通知设置中允许通知');
        if(permission()==='granted'&&window.__webtoapp_notification_polyfill__&&(typeof NativeBridge==='undefined'||typeof NativeBridge.showWebNotificationWithUrl!=='function'))return status('通知可显示；此套壳基础接口不支持点击定位，请查看随包WebToApp通知定位说明');
        status(permission() === 'granted'
            ? (enabled ? '通知接口权限已允许；发送测试确认手机实际显示，APK还需系统通知权限' : '系统权限已允许，消息通知开关已关闭')
            : '尚未授权，点击「授权通知」允许系统通知');
    }
    async function request() {
        if (!supported() || requesting) { refresh(); return false; }
        if (permission() !== 'default') { refresh(); return permission() === 'granted'; }
        requesting = true;
        try {
            // 必须直接在用户点击处理过程中调用，不能先等待注册 Service Worker。
            const result = await new Promise((resolve, reject) => {
                // 同时兼容 Promise 与旧版套壳回调；在点击事件内直接调用。
                const returned = Notification.requestPermission(resolve);
                if (returned && typeof returned.then === 'function') returned.then(resolve, reject);
                else if (typeof returned === 'string') resolve(returned);
            });
            callbackPermission = result || 'default';
            try { localStorage.setItem(promptedKey, 'true'); } catch (_) {}
            refresh();
            return result === 'granted';
        } catch (error) {
            status('无法申请通知权限：APK请检查通知兼容层和手机对本应用的通知权限，再点击授权通知重试');
            return false;
        } finally { requesting = false; }
    }
    async function registration() {
        await navigator.serviceWorker.register('sw.js');
        let timeout;
        try {
            return await Promise.race([
                navigator.serviceWorker.ready,
                new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('通知服务启动超时，请刷新重试')), 10000); })
            ]);
        } finally { clearTimeout(timeout); }
    }
    function visibleChatRoom() {
        const screen=document.getElementById('chat-room-screen');
        return document.hidden!==true&&screen?.classList.contains('active')===true
            &&typeof currentChatId!=='undefined'&&currentChatId!==null&&currentChatId!==''
            &&typeof currentChatType!=='undefined'&&['private','group'].includes(currentChatType);
    }
    function visibleChat(chatId,chatType) {
        const screen=document.getElementById('chat-room-screen');
        return !document.hidden && (typeof document.hasFocus!=='function'||document.hasFocus())
            && screen?.classList.contains('active') && typeof currentChatId!=='undefined'
            && String(currentChatId)===String(chatId) && currentChatType===chatType;
    }
    function chatUrl(data) {
        if(data.test||typeof location==='undefined')return '';
        const url=new URL(location.href);url.searchParams.set('notificationChat',String(data.chatId));url.searchParams.set('notificationType',data.chatType);return url.href;
    }
    function route(data){
        if(data.test||!['private','group'].includes(data.chatType))return false;
        const list=data.chatType==='private'?db.characters:db.groups;
        const chat=list?.find(c=>String(c.id)===String(data.chatId));
        if(!chat||typeof openChatRoom!=='function')return false;
        openChatRoom(chat.id,data.chatType);return true;
    }
    async function routeFromUrl(){
        if(typeof location==='undefined')return;
        const params=new URLSearchParams(location.search),chatId=params.get('notificationChat'),chatType=params.get('notificationType');
        if(!chatId||!['private','group'].includes(chatType))return;
        for(let i=0;i<100;i++){
            if(document.querySelector('.screen.active')&&route({chatId,chatType})){
                params.delete('notificationChat');params.delete('notificationType');history.replaceState(null,'',location.pathname+(params.toString()?'?'+params:'')+location.hash);return;
            }
            await new Promise(resolve=>setTimeout(resolve,100));
        }
    }
    async function send(title, body, data, tag) {
        if(!data.test&&visibleChatRoom())return;
        if (!supported() || permission() !== 'granted') throw new Error('系统通知尚未授权');
        const options = { body, tag, data:{...data,uwuUrl:chatUrl(data)} };
        // WebToApp基础polyfill不传onclick；增强接口必须由套壳提供，不能猜点击目标。
        if(inWebView()&&options.data.uwuUrl&&typeof NativeBridge!=='undefined'&&typeof NativeBridge.showWebNotificationWithUrl==='function') {
            if(NativeBridge.showWebNotificationWithUrl(title,body,tag,options.data.uwuUrl))return;
        }
        if(inWebView()&&window.__webtoapp_notification_polyfill__)status('当前套壳基础通知不支持点击定位；需使用随包说明中的WebToApp原生接口增强');
        let webError;
        if (!inWebView() && webSupported()) {
            try {
                const reg = await registration();
                if(!data.test&&visibleChatRoom())return;
                await reg.showNotification(title, options);
                return;
            } catch (error) { webError = error; }
        }
        if(!data.test&&visibleChatRoom())return;
        try {
            const notification = new Notification(title, options);
            notification.onclick = () => {
                notification.close?.();
                window.focus?.();
                route(data);
            };
        } catch (error) {
            throw webError || new Error('套壳通知未能发送，请开启 WebToApp 通知兼容层并重新打包，然后在手机设置允许本应用通知');
        }
    }
    function onApiOpen() {
        refresh();
        let prompted = false;
        try { prompted = localStorage.getItem(promptedKey) === 'true'; } catch (_) {}
        if (enabled && !prompted && supported() && permission() === 'default'
            && (inWebView() || navigator.userActivation?.isActive)) void request();
    }
    function notify(message, chatId, chatType, options={}) {
        if (!enabled || !supported() || permission() !== 'granted'
            || !message || message.role !== 'assistant' || message.isThinking || message.isStatusUpdate
            || message.isWithdrawn || !message.id || seen.has(message.id)) return;
        // Another character already gets UwU's in-app popup while chatting.
        if(visibleChatRoom()){queued.delete(message.id);seen.add(message.id);if(seen.size>1000)seen.delete(seen.values().next().value);return;}
        if(options.defer){queued.set(message.id,{message,chatId,chatType});return;}
        let body = window.SmartMessaging ? window.SmartMessaging.stripNote(String(message.content || '')).clean : String(message.content || '');
        if (/^\s*(?:<thinking>|\[system:)/i.test(body)) return;
        const chat = chatType === 'private' ? db.characters.find(c => c.id === chatId) : db.groups.find(g => g.id === chatId);
        if (!chat) return;
        const member = chatType === 'group' && (chat.members || []).find(m => m.id === message.senderId);
        const sender = member || chat;
        const title = sender.remarkName || sender.groupNickname || sender.realName || sender.name || '角色新消息';
        const match = body.match(/^\[[\s\S]*?的消息[：:]([\s\S]*)\]$/);
        if (match) body = match[1];
        if ((message.parts || []).some(p => p.type === 'html')) body = '[卡片消息]';
        body = body.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').replace(/<[^>]*>/g, '').trim();
        if (!body) return;
        seen.add(message.id);
        if (seen.size > 1000) seen.delete(seen.values().next().value);
        void send(String(title), body.slice(0, 240), { chatId, chatType }, `uwu-message-${message.id}`)
            .catch(() => status('消息通知发送失败，请检查系统权限或发送测试通知'));
    }
    function flush(chatId,chatType){
        for(const [id,item] of queued){if(item.chatId===chatId&&item.chatType===chatType){queued.delete(id);notify(item.message,chatId,chatType);}}
    }
    function setup() {
        const toggle = document.getElementById('message-notification-switch');
        toggle?.addEventListener('change', () => {
            enabled = toggle.checked;
            try { localStorage.setItem(preferenceKey, String(enabled)); } catch (_) {}
            if (!enabled) { clearTimeout(testTimer); refresh(); }
            else void request();
        });
        document.getElementById('message-notification-authorize')?.addEventListener('click', () => void request());
        document.getElementById('message-notification-test')?.addEventListener('click', async () => {
            clearTimeout(testTimer);
            if (!enabled) return status('请先打开消息通知开关');
            if (!await request()) return;
            status('5 秒后发送临时测试通知，可切换到桌面查看；网页需保持运行');
            testTimer = setTimeout(async () => {
                try {
                    await send('UwU 通知测试', '看到这条消息说明系统通知可以显示。角色回复也会在这里出现。', { test: true }, 'uwu-notification-test');
                    status('测试已交给系统，请查看通知栏；未显示时检查手机通知、横幅和勿扰设置');
                } catch (error) { status(`测试失败：${error.message}`); }
            }, 5000);
        });
        if(!routeBound){
            routeBound=true;
            navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='uwu-open-chat')route(event.data);});
            window.addEventListener('load',()=>void routeFromUrl());
            window.addEventListener('pageshow',()=>void routeFromUrl());
            window.addEventListener('uwu-db-ready',()=>void routeFromUrl());
            window.addEventListener('uwu-notification-click',event=>route(event.detail||{}));
            if(document.readyState==='complete')void routeFromUrl();
        }
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
        refresh();
    }
    window.MessageNotifications = { setup, onApiOpen, notify, flush, route, visibleChat };
})();
