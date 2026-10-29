// --- 教程与备份功能 (js/modules/tutorial.js) ---

function setupTutorialApp() {
    const tutorialContentArea = document.getElementById('tutorial-content-area');
    tutorialContentArea.addEventListener('click', (e) => {
        const header = e.target.closest('.tutorial-header');
        if (header) {
            header.parentElement.classList.toggle('open');
        }
    });
}

function updateLogCredits(log){return (log.credits||[]).map(line=>`<div style="margin:0;line-height:1.7">${line}</div>`).join('');}
function updateLogNotes(log){return log.notes.map(note=>/^\d+\./.test(note)?`<h4 style="margin:16px 0 8px;color:#333">${note}</h4>`:`<div style="margin-bottom:7px;line-height:1.7;color:#666">› ${note}</div>`).join('');}
function renderUpdateLog() {
    const tutorialContent = document.getElementById('tutorial-content-area');
    if (!tutorialContent) return;

    const updateSection = document.createElement('div');
    updateSection.className = 'tutorial-item'; 

    let notesHtml = '';
    updateLog.forEach((log, index) => {
        notesHtml += `
            <div style="margin-bottom: 15px; ${index < updateLog.length - 1 ? 'padding-bottom: 10px; border-bottom: 1px solid #f0f0f0;' : ''}">
                <h4 style="font-size: 15px; color: #333; margin: 0 0 5px 0;">${log.version==='2.8.2'?'版本'+log.version+'（'+log.date+'）':'版本 '+log.version+' ('+log.date+')'}</h4>
                ${updateLogCredits(log)}
                ${updateLogNotes(log)}
            </div>
        `;
    });

    updateSection.innerHTML = `
        <div class="tutorial-header">更新日志</div>
        <div class="tutorial-content" style="padding-top: 15px;">
            ${notesHtml}
        </div>
    `;
    
    tutorialContent.appendChild(updateSection);
}

function showUpdateModal() {
    const modal = document.getElementById('update-log-modal');
    const contentEl = document.getElementById('update-log-modal-content');
    const closeBtn = document.getElementById('close-update-log-modal');

    const latestLog = updateLog[0];
    if (!latestLog) return;

    // 优化内容渲染
    let notesHtml = '<div style="text-align: left; max-height: 60vh; overflow-y: auto; padding-right: 5px;">'+updateLogCredits({...latestLog,credits:latestLog.credits.filter(line=>line!=='爱你们')});
    (latestLog.popupNotes||latestLog.notes).forEach(note => {
        // 处理加粗标记 **text** -> <b>text</b>
        let formattedNote = note.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

        if (note.includes('————')) {
            // 分割线
            notesHtml += '<hr style="margin: 15px 0; border: 0; border-top: 1px dashed #ccc;">';
        } else if (/^\d+\./.test(note)) {
            // 标题行 (例如 "1.日记功能升级！")
            notesHtml += `<h4 style="margin: 15px 0 8px; color: #333; font-size: 15px; font-weight: 600;">${formattedNote}</h4>`;
        } else {
            // 普通内容行
            notesHtml += `<div style="margin-bottom: 6px; color: #555; font-size: 13px; line-height: 1.5; padding-left: 12px; position: relative;">
                <span style="position: absolute; left: 0; top: 0; color: #999;">•</span>${formattedNote}
            </div>`;
        }
    });
    notesHtml += '</div>';

    contentEl.innerHTML = `
        <h3 style="margin-top: 0; margin-bottom: 15px; text-align: center;">U••U ${latestLog.version} 更新</h3>
        ${notesHtml}
        <p style="font-size: 12px; color: #888; text-align: center; margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">完整更新记录与使用方法请在“教程”应用内查看。</p>
    `;

    modal.classList.add('visible');

    // 强制阅读倒计时
    const originalText = "我知道了";
    let timeLeft = 10;
    closeBtn.disabled = true;
    closeBtn.textContent = `请阅读 (${timeLeft}s)`;
    closeBtn.style.opacity = '0.6';
    closeBtn.style.cursor = 'not-allowed';

    const timer = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            closeBtn.textContent = `请阅读 (${timeLeft}s)`;
        } else {
            clearInterval(timer);
            closeBtn.disabled = false;
            closeBtn.textContent = originalText;
            closeBtn.style.opacity = '1';
            closeBtn.style.cursor = 'pointer';
        }
    }, 1000);

    closeBtn.onclick = () => {
        modal.classList.remove('visible');
        localStorage.setItem('lastSeenVersion', appVersion);
        localStorage.setItem('uwuSeenRelease', 'U••U20261028');
    };
}

function checkForUpdates() {
    if (localStorage.getItem('uwuSeenRelease') !== 'U••U20261028') setTimeout(showUpdateModal, 500);
}

// --- Guide System (分步引导) ---
const GuideSystem = {
    check: function(guideId, nextCallback) {
        // 检查是否已显示过
        if (localStorage.getItem(guideId) === 'true') return;

        // 根据 ID 定义引导内容
        let config = null;
        switch (guideId) {
            case 'guide_search_entry':
                config = {
                    target: '.search-bar-decoration',
                    text: '新增搜索功能！支持按角色、群聊筛选，快速查找历史记录。',
                    position: 'bottom'
                };
                break;
            case 'guide_char_gallery':
                config = {
                    target: '#char-gallery-manage-btn',
                    text: '新增 TA 相册！在这里管理角色的专属照片，在聊天设置里开启此开关后，聊天时角色可直接发送上传的图片。',
                    position: 'top'
                };
                break;
            case 'guide_group_summary':
                config = {
                    target: '#memory-journal-btn',
                    text: '群聊记录太多？点击这里一键生成智能总结，自动关联当前群聊世界书，内置提示词。',
                    position: 'top'
                };
                break;
            case 'guide_group_notice':
                config = {
                    target: '#setting-group-notice',
                    text: '新增群公告！设置剧情背景或重要通知，让所有成员知晓。',
                    position: 'bottom',
                    parent: '.kkt-item' // 高亮父容器
                };
                break;
            case 'guide_group_gossip':
                config = {
                    target: '#setting-group-allow-gossip',
                    text: '开启群内私聊！双击群聊标题可查看，群成员之间可以悄悄互动，八卦吐槽更真实。',
                    position: 'bottom',
                    parent: '.kkt-item'
                };
                break;
        }

        if (config) {
            // 稍微延迟以确保 DOM 渲染完成
            setTimeout(() => {
                const targetEl = document.querySelector(config.target);
                if (targetEl && targetEl.offsetParent !== null) { // 确保元素可见
                    this.show(targetEl, config, guideId, nextCallback);
                }
            }, 500);
        }
    },

    show: function(targetEl, config, guideId, nextCallback) {
        // 1. 先滚动到可见区域
        const highlightEl = config.parent ? targetEl.closest(config.parent) : targetEl;
        
        // 特殊处理 Swiper 容器内的元素，避免触发页面整体水平滚动
        const swiperWrapper = highlightEl.closest('.function-swiper-wrapper');
        if (swiperWrapper) {
            const slide = highlightEl.closest('.function-slide');
            if (slide) {
                // 滚动到对应的 slide，使用 inline: 'start' 确保对齐且不溢出
                slide.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
            } else {
                highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        } else {
            highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // 强制重置页面水平滚动，防止露出侧边栏
        const resetScroll = () => {
            document.documentElement.scrollLeft = 0;
            document.body.scrollLeft = 0;
        };
        // 在滚动开始和结束时多次尝试重置
        setTimeout(resetScroll, 50);
        setTimeout(resetScroll, 200);
        setTimeout(resetScroll, 600);

        // 2. 延迟显示引导（等待滚动完成）
        setTimeout(() => {
            // 再次重置滚动位置，确保万无一失
            resetScroll();

            // 移除现有的引导
            this.cleanup();

            // 创建遮罩
            const overlay = document.createElement('div');
            overlay.className = 'guide-overlay visible';
            document.body.appendChild(overlay);

            // 重新计算高亮位置（滚动后）
            const rect = highlightEl.getBoundingClientRect();
            
            // 创建高亮框
            const highlightBox = document.createElement('div');
            highlightBox.className = 'guide-highlight-box';
            // 强制使用 fixed 定位，避免滚动容器导致的坐标偏移问题
            highlightBox.style.position = 'fixed';
            highlightBox.style.top = `${rect.top}px`;
            highlightBox.style.left = `${rect.left}px`;
            highlightBox.style.width = `${rect.width}px`;
            highlightBox.style.height = `${rect.height}px`;
            document.body.appendChild(highlightBox);

            // 创建提示气泡
            const tooltip = document.createElement('div');
            tooltip.className = `guide-tooltip ${config.position || 'bottom'} visible`;
            // 气泡也使用 fixed 定位
            tooltip.style.position = 'fixed';
            
            tooltip.innerHTML = `
                <div class="guide-content">${config.text}</div>
                <div class="guide-footer">
                    <button class="guide-btn guide-btn-primary">我知道了</button>
                </div>
            `;
            document.body.appendChild(tooltip);

            // 计算气泡位置 (需要先添加到 DOM 获取尺寸)
            const tooltipRect = tooltip.getBoundingClientRect();
            const tooltipWidth = tooltipRect.width;
            const screenWidth = window.innerWidth;
            const margin = 10; // 屏幕边缘间距

            let tooltipTop, tooltipLeft;
            
            // 初始水平居中对齐目标
            let idealLeft = rect.left + rect.width / 2 - tooltipWidth / 2;

            // 边界检测与调整
            if (idealLeft < margin) {
                tooltipLeft = margin;
            } else if (idealLeft + tooltipWidth > screenWidth - margin) {
                tooltipLeft = screenWidth - tooltipWidth - margin;
            } else {
                tooltipLeft = idealLeft;
            }

            // 计算箭头偏移量 (相对于 tooltip 左边缘)
            const targetCenterX = rect.left + rect.width / 2;
            let arrowRelX = targetCenterX - tooltipLeft;
            
            // 限制箭头在 tooltip 内部 (留出圆角空间)
            const arrowMargin = 20;
            if (arrowRelX < arrowMargin) arrowRelX = arrowMargin;
            if (arrowRelX > tooltipWidth - arrowMargin) arrowRelX = tooltipWidth - arrowMargin;

            // 设置箭头位置变量
            tooltip.style.setProperty('--arrow-left', `${arrowRelX}px`);

            // 垂直位置
            if (config.position === 'top') {
                tooltipTop = rect.top - 10; 
                tooltip.style.transform = 'translateY(-100%) translateY(-10px)';
            } else {
                tooltipTop = rect.bottom + 10;
                tooltip.style.transform = 'translateY(10px)';
            }
            
            tooltip.style.top = `${tooltipTop}px`;
            tooltip.style.left = `${tooltipLeft}px`;

            // 绑定事件
            const closeGuide = () => {
                this.cleanup();
                localStorage.setItem(guideId, 'true');
                if (nextCallback) nextCallback();
            };

            overlay.addEventListener('click', closeGuide);
            tooltip.querySelector('.guide-btn-primary').addEventListener('click', closeGuide);
        }, 500); // 等待 500ms 确保滚动完成
    },

    cleanup: function() {
        const overlay = document.querySelector('.guide-overlay');
        const highlight = document.querySelector('.guide-highlight-box');
        const tooltip = document.querySelector('.guide-tooltip');
        if (overlay) overlay.remove();
        if (highlight) highlight.remove();
        if (tooltip) tooltip.remove();
    }
};
window.GuideSystem = GuideSystem;

let loadingBtn = false

function renderTutorialContent() {
    const tutorialContentArea = document.getElementById('tutorial-content-area');
    const tutorials = [
        {title: '写在前面', imageUrls: ['https://i.postimg.cc/3RJfvgzq/xie-zai-qian-mian(1).jpg']},
        {
            title: '软件介绍',
            imageUrls: ['https://i.postimg.cc/VvsJRh6q/IMG-20250713-162647.jpg', 'https://i.postimg.cc/8P5FfxxD/IMG-20250713-162702.jpg', 'https://i.postimg.cc/3r94R3Sn/IMG-20250713-162712.jpg']
        },
        {
            title: '404',
            imageUrls: ['https://i.postimg.cc/x8scFPJW/IMG-20250713-162756.jpg', 'https://i.postimg.cc/pX6mfqtj/IMG-20250713-162809.jpg', 'https://i.postimg.cc/YScjV00q/IMG-20250713-162819.jpg', 'https://i.postimg.cc/13VfJw9j/IMG-20250713-162828.jpg']
        },
        {title: '404-群聊', imageUrls: ['https://i.postimg.cc/X7LSmRTJ/404.jpg']}
    ];
    tutorialContentArea.innerHTML = '';
    renderUpdateLog();
    const v81Help=document.createElement('div');v81Help.className='tutorial-item';
    v81Help.innerHTML="<div class=\"tutorial-header\">U••U 新增功能与操作</div><div class=\"tutorial-content\" style=\"line-height:1.8;padding:12px 16px\"><section><h4>小剧场</h4><p><b>入口：</b>单人聊天 → 加号面板第三页末尾 → 小剧场。</p><p>默认使用主API；需要副API时，在API设置的“使用副API的功能”中勾选“小剧场”。创作、续写与本篇总结共用这个选项。</p><p>新建时自动读取当前双方人设。世界书与文风分别绑定，均可多选；设置字数、双方描写人称及是否参考收藏记忆，再填写创作指令。开启参考收藏记忆后，可读取全部已点亮日记，或自行输入最近X条；未点亮的不计入。字数可选“字数范围”或“不少于”，留空时遵循指令中的字数要求。</p><p>“保存生成预设”保存绑定和生成设置，不保存创作指令；应用预设时保留当前指令。“保存草稿并退出”保存当前指令与设置，可从“草稿记录”恢复。</p><p>点击分类堆展开文稿，搜索框可查找标题和正文。投送点“接受”进入阅读，点“拒绝”仍保留文稿，可稍后从列表打开。</p><p>离开小剧场页面可继续生成；关闭、刷新应用或被系统挂起可能中断。已有正文会保留，可继续续写。</p></section><section><h4>小剧场阅读与总结</h4><p><b>入口：</b>小剧场 → 打开文稿。</p><p>底部提供目录、页码跳转和续写。每层楼为一页，包含输入的指令；点击“续写”才展开输入框。</p><p>顶部“Aa”调整字体、字号、字距、行距、段距、边距、阅读配色与背景，也可导入字体和背景图片。</p><p>右上角“···”可编辑当前页、修改标题、移动分类、导出TXT，以及设置本篇资料、上下文页数和总结。续写面板显示预计上下文token。</p><p>“续写参考本篇总结”控制是否读取已有总结；“自动总结”控制是否按设置间隔生成总结。不开自动总结时，按需手动生成。创建面板、本篇资料和总结面板均可绑定“总结规范世界书”，只影响本篇总结，不加入正文创作请求。</p><p>编辑已被总结引用的页面会使相关总结失效；仅开启自动总结时询问是否更新。正文、指令与总结只保留在本篇，不加入线上聊天或其他文稿。</p></section><section><h4>文风库</h4><p><b>入口：</b>主页 → 世界书 → 标题旁⌄ → 文风。</p><p>右上角＋在按钮下方展开菜单，可新建文风、创建文件夹或导入TXT／DOCX。编辑时可调整所在文件夹与分组。</p><p>在小剧场创建面板中勾选文风。文风与世界书分开绑定，不会自动加入正常聊天。</p></section><section><h4>音乐与一起听</h4><p><b>入口：</b>主页 → 音乐〈3〉。一起听入口：单人聊天 → 加号面板 → 一起听。</p><p>首次使用先打开音乐设置中的“后端部署教程”。部署自己的音乐服务，填写服务地址和口令，再使用网易云App扫码登录。</p><p>在“一起听对象与歌单权限”中绑定角色、选择歌单并设置权限。专属歌单用于角色自己想听的歌，共同歌单用于想分享给你听的歌。</p><p>播放器中可搜索、切歌、暂停、查看歌词和管理待播。临时待播中的歌曲可继续追加，尚未播放的歌曲可以移除。</p><p>音乐设置中可开关悬浮窗，在“音乐自主互动”中配置角色主动操作。开启真人回复后，音乐互动沿用真人回复调用。</p><p>搜索最多返回50条候选，角色单次选歌仍有数量限制，不要求加满。搜索数量需要配套新版后端，仅更新前端不会改变后端返回数量。</p></section><section><h4>书影音</h4><p><b>入口：</b>单人聊天 → 偷看菜单 → 书影音。封面配置入口：主页 → API设置 → 获取封面。</p><p>首页查看角色评价，收藏架查看收藏的作品；进入评价详情可留言、分享或更换作品封面。</p><p>需要电影、书籍封面时，先看“获取封面”中的“手机部署教程与完整代码”，部署后填写自己的接口地址，开启、测试并保存。音乐封面读取已连接的音乐服务。</p><p>默认后端地址连接失败时，请配置可用VPN，或绑定自己在当地网络可访问的域名。绑定步骤见封面部署教程，绑定后仍需测试。</p></section><section><h4>拾页</h4><p><b>入口：</b>主页 → API设置 → 拾页。</p><p>先看“手机部署教程”，部署自己的拾页服务，再填写服务地址与解析口令，测试并保存。</p><p>开启“自动读取小红书链接”后，在聊天中分享链接即可读取。需要识别配图时，再开启“读取配图内容”并设置图片上限；图片识别使用当前聊天API。</p><p>默认后端地址连接失败时，请配置可用VPN，或绑定自己在当地网络可访问的域名。绑定步骤见拾页部署教程，绑定后仍需测试。</p></section><section><h4>后端域名与前端授权</h4><p><b>入口：</b>音乐、拾页及封面设置中的部署教程。</p><p>使用自有域名时，先将自己的域名接入Cloudflare，等待域名状态为Active，再进入对应Worker的域名设置，添加Custom Domain。等待DNS与证书生效，测试后将新的HTTPS地址填回对应功能。</p><p>音乐、拾页和封面分别使用自己的Worker，不要互相覆盖。域名后缀或购买地区不保证能够直连，以实际测试结果为准。</p><p>教程要求设置ALLOWED_ORIGINS时，填写你自己使用的UwU前端来源，只保留协议、域名及实际使用的端口，不带路径和末尾斜杠。多个来源用英文逗号分隔；不要填成后端服务地址。</p></section><section><h4>真人回复</h4><p><b>入口：</b>单人聊天 → 聊天设置 → 功能 → 真人回复。</p><p>开启后展开配置，按需设置生效时段与回复参数。需要副API时，在API设置中勾选对应功能。</p><p>角色会结合日常安排、忙碌、睡眠、双方当地时间与聊天情况决定回复时机。等待期间可以继续发送消息，角色回复时会结合期间的新消息作答。</p></section><section><h4>投票</h4><p><b>入口：</b>聊天 → 加号面板 → 投票。</p><p>填写选项后发送，注释可留空；有注释时作为普通聊天消息发送。</p><p>点击选项投票或改选，再点已选项取消。“添加选项”可补充选项并发送新卡片。下一次接收角色回复时，会提供当前最终选择。</p></section><section><h4>待办</h4><p><b>入口：</b>聊天 → 加号面板 → 待办。</p><p>点击事项文字展开并调整进度。</p><p>分享时可选单方、双方当前页、双方已完成或双方全部计划。双方卡片左右滑动切换，也可点击右下角圆点。</p></section><section><h4>日历、经期与时差</h4><p><b>入口：</b>聊天 → 加号面板 → 日历。知情设置：聊天设置 → 功能。城市与时区：聊天设置 → 设定。</p><p>在日历中选择日期记录或修改经期、感受与备注。</p><p>各角色分别设置经期知情、提前提醒及节假日、调休知情。双方城市与时区分别填写，聊天、通话及真人回复按相应当地时间使用。</p></section><section><h4>自动总结与日记</h4><p><b>入口：</b>聊天 → 加号面板 → 回忆日记。</p><p>打开“自动总结设置”，选择按消息条数或时间生成小总结，并设置大总结合并方式。</p><p>“总结API”配置独立接口，总结设置中绑定相应世界书。</p><p>进入日记详情可编辑标题和正文、查看关联来源及大小总结关系。修改关联聊天后，可按提示选择是否更新总结。</p></section><section><h4>向量记忆</h4><p><b>入口：</b>模式入口：聊天设置 → 记忆模式 → 向量记忆。管理入口：聊天 → 加号面板 → 向量记忆。</p><p>先在向量记忆设置中配置提取API、嵌入API与检索参数，再分批提取历史或开启自动提取。</p><p>记忆列表中可查看、编辑和管理条目，处理事件跟进与核心记忆。更换嵌入模型后，需要更新索引。</p></section><section><h4>世界书</h4><p><b>入口：</b>主页 → 世界书。聊天绑定入口：单人聊天 → 聊天设置 → 设定 → 关联世界书。</p><p>世界书右上角＋可创建条目、文件夹、导入TXT／DOCX及管理世界书预设。</p><p>聊天设置中的已绑定列表与选择页面可直接查看、修改原条目；其他绑定同一条目的角色同步使用修改后的内容。</p></section><section><h4>思维链与伪思维链</h4><p><b>入口：</b>聊天 → 右上角更多菜单 → 思维链。</p><p>预设列表可长按拖动排序，内置预设可还原。</p><p>使用伪思维链时，选择“默认伪思维链头尾部”，保留“引子”和“尾声”，在中间添加自己的条目，并关闭“预填thinking”。需要调整各阶段输出时编辑尾声。</p></section><section><h4>状态栏</h4><p><b>入口：</b>单人聊天 → 聊天设置 → 状态栏。</p><p>状态栏预设支持文件夹分类、移动与搜索，可按文件夹选择绑定。</p><p>聊天中的状态栏可翻面查看同轮思维链。删除时按面板选项选择要清除的内容，状态栏快照、原始消息和思维链分别管理。</p></section><section><h4>聊天操作</h4><p><b>入口：</b>聊天消息、长按菜单与加号面板。</p><p>左滑消息可引用，原长按菜单保留。</p><p>长按user消息，可在其后补充历史记录；后面已有角色回复时也能补充。</p><p>加号面板中的停止生成可停止当前聊天生成及后续气泡显示，不关闭真人回复总开关。</p></section><section><h4>CSS编辑</h4><p><b>入口：</b>原有CSS编辑框 → 查找旁的展开按钮。</p><p>展开后可在大编辑框中修改，继续使用查找与替换。</p></section><section><h4>外观与顶部留白</h4><p><b>入口：</b>主页 → 个性化设置。</p><p>可开关应用夜间模式，聊天内保留自己的美化。</p><p>顶部留白可按设备选择“自动”“增加顶部留白”或“不额外留白”。</p></section><section><h4>备份与容量分析</h4><p><b>入口：</b>备份入口：主页 → 教程 → 页面下方。容量分析入口：主页底部Dock栏第三个 → 存储空间。</p><p>按需选择完整备份、精简备份，或单独导出全部向量记忆。恢复前核对备份文件与导入范围。</p><p>若需将数据导入其他版本的UwU，请使用“完整备份”导出。</p><p>容量分析中查看各类数据占用，聊天记录包含聊天存档。</p></section><section><h4>生成预设</h4><p><b>入口：</b>小剧场创建面板 → 生成预设；点击“管理”可查看、编辑、改名或删除。</p><p>保存界面中除创作指令外的绑定与生成设置，包括世界书、文风、总结规范世界书、字数、人称、上下文、收藏日记读取和总结设置。应用时保留当前指令；点进已保存预设可编辑。</p></section><section><h4>手动增加记忆</h4><p><b>入口：</b>聊天 → 加号面板 → 回忆日记 → 列表上方“手动添加总结”。</p><p>自行填写标题和正文，可选择同时收藏。不关联聊天消息范围，不占自动总结进度。</p></section></div>";tutorialContentArea.appendChild(v81Help);
    tutorials.forEach(tutorial => {
        const item = document.createElement('div');
        item.className = 'tutorial-item';
        const imagesHtml = tutorial.imageUrls.map(url => `<img src="${url}" alt="${tutorial.title}教程图片">`).join('');
        item.innerHTML = `<div class="tutorial-header">${tutorial.title}</div><div class="tutorial-content">${imagesHtml}</div>`;
        tutorialContentArea.appendChild(item);
    });

    const backupNotice = document.createElement('p');backupNotice.textContent="若需将数据导入其他版本的UwU，请使用“完整备份”导出。";backupNotice.className='kkt-item-subtitle';tutorialContentArea.appendChild(backupNotice);
    const backupDataBtn = document.createElement('button');
    backupDataBtn.className = 'btn btn-primary';
    backupDataBtn.id = 'tutorial-full-backup-btn';
    backupDataBtn.textContent = '备份数据';
    backupDataBtn.disabled = loadingBtn

    backupDataBtn.addEventListener('click', () => triggerManualBackup());
    const importDataBtn = document.createElement('label');
    importDataBtn.className = 'btn btn-neutral';
    importDataBtn.textContent = '导入数据';
    importDataBtn.style.marginTop = '15px'
    importDataBtn.style.display = 'block'
    importDataBtn.disabled = loadingBtn;
    importDataBtn.setAttribute('for', 'import-data-input')
    document.querySelector('#import-data-input').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if(confirm('此操作将覆盖当前所有聊天记录和设置。此操作不可撤销。确定要继续吗？')){
            try {
                showToast('正在导入数据，请稍候...');

                const decompressionStream = new DecompressionStream('gzip');
                const decompressedStream = file.stream().pipeThrough(decompressionStream);
                const jsonString = await new Response(decompressedStream).text();

                let data = window.UwUBackupCodec.parseText(jsonString);

                const importResult = await importBackupData(data);

                if (importResult.success) {
                    showToast(`数据导入成功！${importResult.message} 应用即将刷新。`);
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    showToast(`导入失败: ${importResult.error}`);
                }
            } catch (error) {
                console.error("导入失败:", error);
                showToast(`解压或解析文件时发生错误: ${error.message}`);
            } finally {
                event.target.value = null;
            }
        }else {
            event.target.value = null;
        }

    })

    tutorialContentArea.appendChild(backupDataBtn);
    const yuanBackupBtn=document.createElement('button');yuanBackupBtn.className='btn btn-neutral';yuanBackupBtn.textContent='导出 yuan 兼容备份';yuanBackupBtn.onclick=()=>triggerManualBackup('yuan');tutorialContentArea.appendChild(yuanBackupBtn);
    const compatibleBackupBtn=document.createElement('button');compatibleBackupBtn.className='btn btn-neutral';compatibleBackupBtn.textContent='导出通用完整备份';compatibleBackupBtn.onclick=()=>triggerManualBackup(true);tutorialContentArea.appendChild(compatibleBackupBtn);
    const compactHint=document.createElement('p');compactHint.textContent='默认备份采用无损去重，请用本版本恢复；导入旧版或其他项目请选择通用完整备份。';compactHint.style.cssText='font-size:12px;color:#999;line-height:1.7;';tutorialContentArea.appendChild(compactHint);
    const vectorBackupBtn=document.createElement('button');vectorBackupBtn.id='tutorial-export-vector-memory';vectorBackupBtn.className='btn btn-neutral';vectorBackupBtn.textContent='导出向量记忆';vectorBackupBtn.onclick=exportAllVectorMemory;tutorialContentArea.appendChild(vectorBackupBtn);
    tutorialContentArea.appendChild(importDataBtn);

    // 定期备份提醒设置
    const reminderSection = document.createElement('div');
    reminderSection.innerHTML = `
        <div style="font-size:0.89rem; color:#999; margin:20px 0 8px;">定期备份提醒</div>
        <div class="btn-white" style="display:block; cursor:default; background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>开启提醒</span>
                <label class="switch" style="position:relative; display:inline-block; width:40px; height:24px;">
                    <input type="checkbox" id="backup-reminder-switch" style="opacity:0; width:0; height:0;">
                    <span style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#ccc; transition:.4s; border-radius:24px;" id="reminder-switch-slider"></span>
                    <style>
                        #backup-reminder-switch:checked + #reminder-switch-slider { background-color: #333; }
                        #reminder-switch-slider:before { position:absolute; content:""; height:16px; width:16px; left:4px; bottom:4px; background-color:white; transition:.4s; border-radius:50%; }
                        #backup-reminder-switch:checked + #reminder-switch-slider:before { transform: translateX(16px); }
                    </style>
                </label>
            </div>
            <div id="reminder-interval-setting" style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                <span style="font-size:0.89rem; color:#666;">提醒频率</span>
                <select id="backup-reminder-interval" style="border:1px solid #eee; padding:5px; border-radius:4px; font-size:0.89rem; background:#fff;">
                    <option value="1">每 1 天</option>
                    <option value="3">每 3 天</option>
                    <option value="7">每 7 天</option>
                    <option value="15">每 15 天</option>
                    <option value="30">每 30 天</option>
                </select>
            </div>
        </div>
    `;
    tutorialContentArea.appendChild(reminderSection);

    const reminderSwitch = document.getElementById('backup-reminder-switch');
    const reminderInterval = document.getElementById('backup-reminder-interval');
    
    if (db.backupReminderSettings) {
        reminderSwitch.checked = db.backupReminderSettings.enabled !== false;
        reminderInterval.value = db.backupReminderSettings.interval || 3;
        document.getElementById('reminder-interval-setting').style.display = reminderSwitch.checked ? 'flex' : 'none';
    }

    reminderSwitch.addEventListener('change', async () => {
        db.backupReminderSettings.enabled = reminderSwitch.checked;
        document.getElementById('reminder-interval-setting').style.display = reminderSwitch.checked ? 'flex' : 'none';
        await saveData();
    });

    reminderInterval.addEventListener('change', async () => {
        db.backupReminderSettings.interval = parseInt(reminderInterval.value);
        await saveData();
    });

    // GitHub Backup UI
    const githubSection = document.createElement('div');
    const iconEyeOpen = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const iconEyeClosed = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    githubSection.innerHTML = `
        <div style="font-size:0.89rem; color:#999; margin:20px 0 8px;">云端备份 (GitHub)</div>
        <div class="btn-white" style="display:block; cursor:default; background:#fff; border:1px solid #e0e0e0; border-radius:8px; padding:12px;">
            <div id="gh-collapse-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding-bottom:5px;">
                <div style="display:flex; align-items:center;">
                    <span style="color:#333; font-weight:500;">🔧 配置参数</span>
                    <div id="gh-help-btn" style="margin-left:8px; display:flex; align-items:center; padding:2px; cursor:pointer;">
                        <svg style="width:16px; height:16px; color:#1890ff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    </div>
                </div>
                <svg class="toggle-icon" style="width:14px; height:14px; color:#999; transition:transform 0.3s;" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>
            </div>

            <div id="gh-config-area" style="display:none; margin-top:10px; padding-top:10px; border-top:1px dashed #eee;">
                <div style="margin-bottom:10px;">
                    <div style="font-size:0.81rem; color:#666; margin-bottom:5px;">GitHub Token</div>
                    <div style="position:relative;">
                        <input type="password" id="gh-token-input" placeholder="ghp_xxxx..." style="width:100%; border:1px solid #eee; padding:8px; padding-right:35px; border-radius:4px; font-size:0.89rem;">
                        <div id="gh-eye-btn" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); color:#999; cursor:pointer; display:flex;">
                            ${iconEyeClosed}
                        </div>
                    </div>
                </div>
                <div style="margin-bottom:10px;">
                    <div style="font-size:0.81rem; color:#666; margin-bottom:5px;">仓库路径 (用户名/仓库名)</div>
                    <input type="text" id="gh-repo-input" placeholder="username/repo" style="width:100%; border:1px solid #eee; padding:8px; border-radius:4px; font-size:0.89rem;">
                </div>
                <div style="margin-bottom:10px;">
                    <div style="font-size:0.81rem; color:#666; margin-bottom:5px;">备份文件名 (可选，填则覆盖)</div>
                    <input type="text" id="gh-filename-input" placeholder="例如: my_backup.ee" style="width:100%; border:1px solid #eee; padding:8px; border-radius:4px; font-size:0.89rem;">
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; border-top:1px solid #f5f5f5; padding-top:10px;">
                <span>自动备份开关</span>
                <label class="switch" style="position:relative; display:inline-block; width:40px; height:24px;">
                    <input type="checkbox" id="gh-auto-switch" style="opacity:0; width:0; height:0;">
                    <span style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#ccc; transition:.4s; border-radius:24px;" id="gh-switch-slider"></span>
                    <style>
                        #gh-auto-switch:checked + #gh-switch-slider { background-color: #333; }
                        #gh-switch-slider:before { position:absolute; content:""; height:16px; width:16px; left:4px; bottom:4px; background-color:white; transition:.4s; border-radius:50%; }
                        #gh-auto-switch:checked + #gh-switch-slider:before { transform: translateX(16px); }
                    </style>
                </label>
            </div>

            <div id="gh-interval-setting" style="display:none; justify-content:space-between; align-items:center; margin-top:10px;">
                <span style="font-size:0.89rem; color:#666;">备份频率</span>
                <select id="gh-interval-select" style="border:1px solid #eee; padding:5px; border-radius:4px; font-size:0.89rem; background:#fff;">
                    <option value="24">每 24 小时</option>
                    <option value="36">每 36 小时</option>
                    <option value="48">每 48 小时</option>
                </select>
            </div>

            <div style="margin-top:15px; display:flex; gap:10px;">
                <div id="gh-backup-btn" style="flex:1; background:#333; color:#fff; text-align:center; padding:8px; border-radius:4px; font-size:0.89rem; cursor:pointer;">立即备份</div>
                <div id="gh-restore-btn" style="flex:1; background:#1890ff; color:#fff; text-align:center; padding:8px; border-radius:4px; font-size:0.89rem; cursor:pointer;">恢复最新</div>
                <div id="gh-check-btn" style="flex:1; background:#f5f5f5; color:#666; text-align:center; padding:8px; border-radius:4px; font-size:0.89rem; cursor:pointer;">检查状态</div>
            </div>
            
            <div id="gh-status-msg" style="margin-top:10px; font-size:0.74rem; color:#999;"></div>
        </div>
    `;
    
    tutorialContentArea.appendChild(githubSection);

    const existingOverlay = document.getElementById('gh-help-overlay');
    if (existingOverlay) existingOverlay.remove();

    const helpOverlay = document.createElement('div');
    helpOverlay.id = 'gh-help-overlay';
    helpOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: none; align-items: center; justify-content: center;';
    
    helpOverlay.onclick = function(e) { 
        if(e.target === this) this.style.display = 'none'; 
    };
    
    helpOverlay.innerHTML = `
        <div class="modal-window" style="width: 85%; max-height: 80vh; overflow-y: auto; background: #fff; padding: 20px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; margin-bottom:15px; text-align:center; font-size:1.1rem; color: var(--primary-color);">GitHub 配置指南</h3>
            
            <h4 style="margin:10px 0 5px; color:#333;">1. 获取 Token</h4>
            <ol style="padding-left:20px; font-size:0.89rem; color:#555; line-height:1.6;">
                <li>登录 GitHub，点击头像 → <strong>Settings</strong></li>
                <li>左侧菜单到底 → <strong>Developer settings</strong></li>
                <li><strong>Personal access tokens</strong> → <strong>Tokens (classic)</strong></li>
                <li>Generate new token (classic)</li>
                <li>Expiration 选 <strong>No expiration</strong></li>
                <li><strong style="color:#d32f2f;">Scopes 必须勾选 repo (包含所有子项)</strong></li>
                <li>点击 Generate，复制 ghp_ 开头的字符。<br><strong style="color:#d32f2f;">一定要现在复制并保存好！一旦刷新页面，你就再也看不到它了。</strong></li>
            </ol>

            <h4 style="margin:15px 0 5px; color:#333;">2. 创建仓库</h4>
            <ol style="padding-left:20px; font-size:0.89rem; color:#555; line-height:1.6;">
                <li>右上角 + 号 → <strong>New repository</strong></li>
                <li>Repository name 填个名字</li>
                <li>建议选 <strong>Private</strong> (私有)</li>
                <li>点击 Create repository</li>
            </ol>

            <h4 style="margin:15px 0 5px; color:#333;">3. 填写示例</h4>
            <ul style="padding-left:20px; font-size:0.89rem; color:#555; line-height:1.6;">
                <li>Token: <code>ghp_xxxxxxxxxxxx...</code></li>
                <li>仓库路径: <code>用户名/仓库名</code></li>
            </ul>

            <div style="margin-top:20px; text-align: center;">
                <button class="btn btn-primary" onclick="document.getElementById('gh-help-overlay').style.display='none'">我学会了</button>
            </div>
        </div>
    `;
    document.body.appendChild(helpOverlay);

    document.getElementById('gh-collapse-header').addEventListener('click', function() {
        const area = document.getElementById('gh-config-area');
        const icon = this.querySelector('.toggle-icon');
        if (area.style.display === 'none') {
            area.style.display = 'block';
            icon.style.transform = 'rotate(180deg)';
        } else {
            area.style.display = 'none';
            icon.style.transform = 'rotate(0deg)';
        }
    });

    document.getElementById('gh-help-btn').addEventListener('click', function(e) {
        e.stopPropagation(); 
        document.getElementById('gh-help-overlay').style.display = 'flex';
    });

    document.getElementById('gh-eye-btn').addEventListener('click', function() {
        const input = document.getElementById('gh-token-input');
        if (input.type === 'password') {
            input.type = 'text';
            this.innerHTML = iconEyeOpen;
        } else {
            input.type = 'password';
            this.innerHTML = iconEyeClosed;
        }
    });

    const saveHandler = () => { if(window.GitHubMgr) window.GitHubMgr.saveConfig(); };
    document.getElementById('gh-token-input').addEventListener('change', saveHandler);
    document.getElementById('gh-repo-input').addEventListener('change', saveHandler);
    document.getElementById('gh-filename-input').addEventListener('change', saveHandler);
    document.getElementById('gh-auto-switch').addEventListener('change', saveHandler);
    document.getElementById('gh-interval-select').addEventListener('change', saveHandler);

    document.getElementById('gh-backup-btn').addEventListener('click', () => window.GitHubMgr.testUpload());
    document.getElementById('gh-restore-btn').addEventListener('click', () => window.GitHubMgr.restoreLatest());
    document.getElementById('gh-check-btn').addEventListener('click', () => window.GitHubMgr.checkStatus());

    if(window.GitHubMgr) {
        window.GitHubMgr.init();
    }
}

// 创建完整的备份数据
async function createFullBackupData() {
    // The export writer captures one cooperative snapshot without JSON round trips.
    const backupData = {...db.uwuBackupExtras,...db};
    backupData._exportVersion = '3.0'; 
    backupData._exportTimestamp = Date.now();
    return backupData;
}

// 导入备份数据
async function importBackupData(data) {
    const startTime = Date.now();
    const previous=db;
    try {
        data=window.UwUBackupCodec?window.UwUBackupCodec.unpack(data):data;
        if(data.modules)data=data.modules;
        if(!data||!Array.isArray(data.characters)||!Array.isArray(data.groups))throw Error("备份聊天列表无效，原数据保留");
        let convertedData = data;

        if (data._exportVersion !== '3.0') {
            showToast('检测到旧版备份文件，正在转换格式...');
            
            const reassembleHistory = (chat, backupData) => {
                if (!chat.history || !Array.isArray(chat.history) || chat.history.length === 0) {
                    return [];
                }
                if (typeof chat.history[0] === 'object' && chat.history[0] !== null) {
                    return chat.history;
                }
                if (backupData.__chunks__ && typeof chat.history[0] === 'string') {
                    let fullHistory = [];
                    chat.history.forEach(key => {
                        if (backupData.__chunks__[key]) {
                            try {
                                const chunk = JSON.parse(backupData.__chunks__[key]);
                                fullHistory = fullHistory.concat(chunk);
                            } catch (e) {
                                console.error(`Failed to parse history chunk ${key}`, e);
                            }
                        }
                    });
                    return fullHistory;
                }
                return []; 
            };

            const newData = { ...data };

            if (newData.characters) {
                newData.characters = newData.characters.map(char => ({
                    ...char,
                    history: reassembleHistory(char, data)
                }));
            }
            if (newData.groups) {
                newData.groups = newData.groups.map(group => ({
                    ...group,
                    history: reassembleHistory(group, data)
                }));
            }

            // 兼容性处理：将旧版“世界书·中”转换为“世界书·前 + 深度300”
            if (newData.worldBooks && Array.isArray(newData.worldBooks)) {
                newData.worldBooks = newData.worldBooks.map(item => {
                    if (item.type === 'entry' && (item.position === 'middle' || item.position === 'center')) {
                        return {
                            ...item,
                            position: 'before',
                            depth: 300
                        };
                    }
                    return item;
                });
            }
            
            convertedData = newData;
        }

        for(const chat of [...(db.characters||[]),...(db.groups||[])]){window.VectorMemory?.suspend(chat);window.JournalAutomation?.suspend?.(chat);}
        const extras={...(convertedData.uwuBackupExtras||{})};for(const key of Object.keys(convertedData))if(!globalSettingKeys.includes(key)&&!['characters','groups','worldBooks','myStickers','_exportVersion','_exportTimestamp','modules'].includes(key))Object.defineProperty(extras,key,{value:convertedData[key],enumerable:true,writable:true,configurable:true});
        db={...db,...convertedData,uwuBackupExtras:extras};
        if (!db.insWidgetSettings) db.insWidgetSettings = { avatar1: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg', bubble1: 'love u.', avatar2: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg', bubble2: 'miss u.' };
        if (!db.homeWidgetSettings) db.homeWidgetSettings = JSON.parse(JSON.stringify(defaultWidgetSettings));


        showToast('正在写入新数据...');
        await dexieDB.transaction('rw',dexieDB.tables,async()=>{await Promise.all([dexieDB.characters.clear(),dexieDB.groups.clear(),dexieDB.worldBooks.clear(),dexieDB.myStickers.clear(),dexieDB.globalSettings.clear()]);await saveData(db);});

        const duration = Date.now() - startTime;
        const message = `导入完成 (耗时${duration}ms)`;
        
        return { success: true, message: message };

    } catch (error) {
        db=previous;console.error('导入数据失败:', error);
        return {
            success: false,
            error: error.message,
            duration: Date.now() - startTime
        };
    }
}

// GitHub Manager
const GitHubMgr = {
    config: { token: '', repo: '', auto: false, interval: 48, lastTime: 0, fileName: '' },
    
    init: () => {
        const confStr = localStorage.getItem('gh_config');
        if(confStr) GitHubMgr.config = JSON.parse(confStr);
        
        const tokenInput = document.getElementById('gh-token-input');
        const repoInput = document.getElementById('gh-repo-input');
        const fileNameInput = document.getElementById('gh-filename-input');
        const autoSwitch = document.getElementById('gh-auto-switch');
        
        if(tokenInput) tokenInput.value = GitHubMgr.config.token || '';
        if(repoInput) repoInput.value = GitHubMgr.config.repo || '';
        if(fileNameInput) fileNameInput.value = GitHubMgr.config.fileName || '';
        
        if(autoSwitch) {
            autoSwitch.checked = GitHubMgr.config.auto || false;
            document.getElementById('gh-interval-setting').style.display = autoSwitch.checked ? 'flex' : 'none';
        }
        if(document.getElementById('gh-interval-select')) {
            document.getElementById('gh-interval-select').value = GitHubMgr.config.interval || 48;
        }
        
        if(GitHubMgr.config.auto) GitHubMgr.checkAndBackup();
        GitHubMgr.updateStatusText();
    },
    
    saveConfig: () => {
        let token = document.getElementById('gh-token-input').value.trim();
        // 自动清理 Token：移除前缀和空格
        token = token.replace(/^(Bearer|token)\s+/i, '').replace(/\s+/g, '');

        const repo = document.getElementById('gh-repo-input').value.trim();
        const fileName = document.getElementById('gh-filename-input').value.trim();
        const auto = document.getElementById('gh-auto-switch').checked;
        const interval = parseInt(document.getElementById('gh-interval-select').value);
        
        GitHubMgr.config.token = token;
        GitHubMgr.config.repo = repo;
        GitHubMgr.config.fileName = fileName;
        GitHubMgr.config.auto = auto;
        GitHubMgr.config.interval = interval;
        
        document.getElementById('gh-interval-setting').style.display = auto ? 'flex' : 'none';
        
        localStorage.setItem('gh_config', JSON.stringify(GitHubMgr.config));
        GitHubMgr.updateStatusText();
        
        if(auto) GitHubMgr.checkAndBackup();
    },
    
    updateStatusText: () => {
        const el = document.getElementById('gh-status-msg');
        if(!el) return;
        if(!GitHubMgr.config.lastTime) el.innerText = '从未备份过';
        else {
            const date = new Date(GitHubMgr.config.lastTime);
            const nextTime = new Date(GitHubMgr.config.lastTime + (GitHubMgr.config.interval || 48) * 3600000);
            el.innerText = `上次: ${date.toLocaleString()} (下次约: ${nextTime.toLocaleString()})`;
        }
    },
    
    checkAndBackup: async () => {
        if(!GitHubMgr.config.token || !GitHubMgr.config.repo || !GitHubMgr.config.auto) return;
        const now = Date.now();
        const interval = GitHubMgr.config.interval || 48;
        const hours = (now - (GitHubMgr.config.lastTime || 0)) / (1000 * 60 * 60);
        
        if(hours >= interval) {
            console.log(`距离上次备份已过 ${hours.toFixed(1)} 小时，触发自动备份...`);
            
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed; top:10px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.7); color:#fff; padding:8px 15px; border-radius:20px; font-size:12px; z-index:9999; pointer-events:none; transition:opacity 0.5s;';
            toast.innerText = '正在后台准备自动备份...';
            document.body.appendChild(toast);
            
            try {
                await GitHubMgr.performUpload((msg) => { toast.innerText = '自动备份: ' + msg; });
                toast.innerText = '自动备份成功！';
                setTimeout(() => toast.remove(), 3000);
            } catch(e) {
                console.error('自动备份失败', e);
                toast.innerText = '自动备份失败: ' + e.message;
                setTimeout(() => toast.remove(), 5000);
            }
        }
    },
    
    testUpload: async () => {
        GitHubMgr.saveConfig(); // 强制保存当前输入框的值
        if(!GitHubMgr.config.token || !GitHubMgr.config.repo) return alert('请先填写 Token 和 仓库路径');
        showToast('开始备份...');
        const btn = event.target;
        const originalText = btn.innerText;
        btn.innerText = '备份中...';
        btn.style.pointerEvents = 'none';
        
        try {
            await GitHubMgr.performUpload((msg) => { btn.innerText = msg; });
            showToast('上传成功！');
        } catch(e) {
            showToast('上传失败: ' + e.message);
        } finally {
            btn.innerText = originalText;
            btn.style.pointerEvents = 'auto';
        }
    },
    
    performUpload: async (onProgress) => {
        // 1. 预检权限
        onProgress('正在检查权限...');
        const checkUrl = `https://api.github.com/repos/${GitHubMgr.config.repo}`;
        const checkRes = await fetch(checkUrl, {
            headers: { 'Authorization': `token ${GitHubMgr.config.token}` }
        });
        
        if (!checkRes.ok) {
             if (checkRes.status === 401) throw new Error('Token 无效或过期 (401)');
             if (checkRes.status === 404) throw new Error('仓库不存在或 Token 无权访问 (404)');
             throw new Error(`权限检查失败: ${checkRes.status}`);
        }
        
        const repoInfo = await checkRes.json();
        // 检查 push 权限
        if (repoInfo.permissions && repoInfo.permissions.push === false) {
            throw new Error('Token 缺少写入权限 (push)，请重新生成 Token 并勾选 repo 权限');
        }

        onProgress('正在打包数据...');
        const backupData = await createFullBackupData();
        const compressedBlob = await window.UwUBackupExport.createBlob(backupData, {onProgress});
        
        onProgress('正在编码...');
        const base64Content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const res = reader.result;
                let base64 = res.split(',')[1]; 
                // 移除可能存在的换行符，防止上传失败
                base64 = base64.replace(/\s/g, '');
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(compressedBlob);
        });

        onProgress('正在上传至 GitHub...');
        let path = '';
        let sha = null;
        const customName = GitHubMgr.config.fileName;
        
        if (customName && customName.trim()) {
            path = customName.trim();
            if (!path.endsWith('.ee')) path += '.ee';
            
            try {
                const checkUrl = `https://api.github.com/repos/${GitHubMgr.config.repo}/contents/${encodeURIComponent(path)}`;
                const checkRes = await fetch(checkUrl, {
                    headers: { 'Authorization': `token ${GitHubMgr.config.token}` }
                });
                if (checkRes.ok) {
                    const fileData = await checkRes.json();
                    sha = fileData.sha;
                }
            } catch(e) {
                console.log('File does not exist or error checking:', e);
            }
        } else {
            const dateStr = new Date().toISOString().slice(0, 10);
            path = `AutoBackup_${dateStr}_${Date.now()}.ee`; 
        }
        
        const url = `https://api.github.com/repos/${GitHubMgr.config.repo}/contents/${encodeURIComponent(path)}`;
        
        const body = {
            message: `Auto backup`,
            content: base64Content
        };
        if (sha) body.sha = sha; 

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GitHubMgr.config.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(body)
        });

        if(!response.ok) {
            const errJson = await response.json();
            throw new Error(errJson.message || 'GitHub API Error');
        }

        GitHubMgr.config.lastTime = Date.now();
        localStorage.setItem('gh_config', JSON.stringify(GitHubMgr.config));
        GitHubMgr.updateStatusText();
    },
    
    checkStatus: async () => {
        if(!GitHubMgr.config.token || !GitHubMgr.config.repo) return showToast('未配置');
        const url = `https://api.github.com/repos/${GitHubMgr.config.repo}`;
        try {
            const res = await fetch(url, { headers: { 'Authorization': `token ${GitHubMgr.config.token}` } });
            if(res.ok) {
                const data = await res.json();
                alert(`连接成功！\n仓库: ${data.full_name}\n私有: ${data.private}\n说明: 配置有效`);
            } else {
                alert('连接失败，请检查 Token 或 仓库路径');
            }
        } catch(e) { alert('网络错误: ' + e.message); }
    },
    
    restoreLatest: async () => {
        if(!GitHubMgr.config.token || !GitHubMgr.config.repo) return alert('请先在配置中填写 Token 和 仓库路径');
        if(!confirm('⚠️ 警告：这将下载最新的自动备份并覆盖当前所有数据！\n此操作不可撤销！\n\n确定要继续吗？')) return;

        showToast('正在连接 GitHub...');
        const btn = event.target;
        const originalText = btn.innerText;
        btn.innerText = '恢复中...';
        btn.style.pointerEvents = 'none';

        try {
            const customName = GitHubMgr.config.fileName;
            let targetFile = null;

            if (customName && customName.trim()) {
                let path = customName.trim();
                if (!path.endsWith('.ee')) path += '.ee';
                targetFile = { name: path };
            } else {
                const url = `https://api.github.com/repos/${GitHubMgr.config.repo}/contents/`;
                const res = await fetch(url, { headers: { 'Authorization': `token ${GitHubMgr.config.token}` } });
                
                if(!res.ok) {
                    if(res.status === 404) throw new Error('仓库不存在或路径错误');
                    if(res.status === 401) throw new Error('Token 无效或无权限');
                    throw new Error('获取列表失败: ' + res.status);
                }
                
                const files = await res.json();
                
                const backups = files.filter(f => f.name.startsWith('AutoBackup_') && f.name.endsWith('.ee'));
                if(backups.length === 0) throw new Error('仓库中没有找到任何 .ee 备份文件');

                backups.sort((a, b) => {
                    const getTs = (name) => {
                        const match = name.match(/_(\d+)\.ee$/);
                        return match ? parseInt(match[1]) : 0;
                    };
                    return getTs(b.name) - getTs(a.name);
                });

                targetFile = backups[0];
            }

            if (!targetFile) throw new Error('未找到可恢复的备份文件');

            showToast('正在下载: ' + targetFile.name);

            const dlUrl = `https://api.github.com/repos/${GitHubMgr.config.repo}/contents/${encodeURIComponent(targetFile.name)}`;
            const dlRes = await fetch(dlUrl, {
                headers: {
                    'Authorization': `token ${GitHubMgr.config.token}`,
                    'Accept': 'application/vnd.github.v3.raw'
                }
            });

            if(!dlRes.ok) throw new Error('下载文件失败: ' + dlRes.status);
            
            showToast('下载完成，正在解压...');
            const blob = await dlRes.blob();
            
            const decompressionStream = new DecompressionStream('gzip');
            const decompressedStream = blob.stream().pipeThrough(decompressionStream);
            const jsonString = await new Response(decompressedStream).text();
            
            const data = window.UwUBackupCodec.parseText(jsonString);
            
            showToast('解压完成，开始导入...');
            const importResult = await importBackupData(data);

            if (importResult.success) {
                showToast(`恢复成功！${importResult.message} 应用即将刷新。`);
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                throw new Error(importResult.error);
            }

        } catch(e) {
            console.error(e);
            alert('恢复失败: ' + e.message);
            btn.innerText = originalText;
            btn.style.pointerEvents = 'auto';
        }
    }
};
window.GitHubMgr = GitHubMgr;

// 全局手动备份触发函数
async function triggerManualBackup(compatible=false) {
    if (loadingBtn) return;
    loadingBtn = true;
    try {
        showToast('正在准备导出数据...');

        const fullBackupData = await createFullBackupData();

        const backupButton = document.getElementById('tutorial-full-backup-btn');
        if (backupButton) backupButton.disabled = true;
        const compressedBlob = await window.UwUBackupExport.createBlob(fullBackupData, {
            mode: compatible === 'yuan' ? 'yuan' : compatible === true ? 'compatible' : 'compact',
            onProgress: message => {
                if (backupButton) backupButton.textContent = message;
            }
        });

        const url = URL.createObjectURL(compressedBlob);
        const a = document.createElement('a');
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
        a.href = url;
        a.download = `章鱼喷墨_备份数据_${date}_${time}.ee`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        showToast('聊天记录导出成功');
        
        // 更新提醒时间
        if (db.backupReminderSettings) {
            db.backupReminderSettings.lastReminderTime = Date.now();
            await saveData();
        }
    } catch (e) {
        showToast(`导出失败, 发生错误: ${e.message}`);
        console.error('导出错误详情:', e);
    } finally {
        loadingBtn = false;
        const backupButton = document.getElementById('tutorial-full-backup-btn');
        if (backupButton) { backupButton.disabled = false; backupButton.textContent = '备份数据'; }
    }
}
window.triggerManualBackup = triggerManualBackup;

function exportAllVectorMemory(){try{const value=window.VectorMemory.exportAllMemory();if(!value.entries.length){showToast('还没有已保存的向量记忆');return;}const blob=new Blob([JSON.stringify(value)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='UwU_AllVectorMemory_'+new Date().toISOString().slice(0,10)+'.uvm';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('已导出全部角色及存档的向量记忆');}catch(error){showToast('向量记忆导出失败：'+error.message);}}
