// --- 数据库与全局状态 (js/db.js) ---

// 常量定义
const BLOCKED_API_DOMAINS = [
    'api522.pro',
    'api521.pro',
    'api520.pro'
];

const colorThemes = {
    'white_pink': {
        name: '白/粉',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(255,204,204,0.9)', text: '#A56767'}
    },
    'white_blue': {
        name: '白/蓝',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(173,216,230,0.9)', text: '#4A6F8A'}
    },
    'white_yellow': {
        name: '白/黄',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(249,237,105,0.9)', text: '#8B7E4B'}
    },
    'white_green': {
        name: '白/绿',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(188,238,188,0.9)', text: '#4F784F'}
    },
    'white_purple': {
        name: '白/紫',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(185,190,240,0.9)', text: '#6C5B7B'}
    },
    'black_red': {
        name: '黑/红',
        received: {bg: 'rgba(30,30,30,0.85)', text: '#E0E0E0'},
        sent: {bg: 'rgb(226,62,87,0.9)', text: '#fff'}
    },
    'black_green': {
        name: '黑/绿',
        received: {bg: 'rgba(30,30,30,0.85)', text: '#E0E0E0'},
        sent: {bg: 'rgba(119,221,119,0.9)', text: '#2E5C2E'}
    },
    'black_white': {
        name: '黑/白',
        received: {bg: 'rgba(30,30,30,0.85)', text: '#E0E0E0'},
        sent: {bg: 'rgba(245,245,245,0.9)', text: '#333'}
    },
    'white_black': {
        name: '白/黑',
        received: {bg: 'rgba(255,255,255,0.9)', text: '#6D6D6D'},
        sent: {bg: 'rgba(50,50,50,0.85)', text: '#F5F5F5'}
    },
    'yellow_purple': {
        name: '黄/紫',
        received: {bg: 'rgba(255,250,205,0.9)', text: '#8B7E4B'},
        sent: {bg: 'rgba(185,190,240,0.9)', text: '#6C5B7B'}
    },
    'pink_blue': {
        name: '粉/蓝',
        received: {bg: 'rgba(255,231,240,0.9)', text: '#7C6770'},
        sent: {bg: 'rgba(173,216,230,0.9)', text: '#4A6F8A'}
    },
};

const defaultWidgetSettings = {
    centralCircleImage: 'https://i.postimg.cc/mD83gR29/avatar-1.jpg',
    topLeft: { emoji: '🎧', text: '𝑀𝑒𝑚𝑜𝑟𝑖𝑒𝑠✞' },
    topRight: { emoji: '🐈‍⬛', text: '𐙚 ♰.𝐾𝑖𝑡𝑡𝑒𝑛.♰' },
    bottomLeft: { emoji: '💿', text: '᪗₊𝔹𝕒𝕓𝕖𝕚𝕤₊' },
    bottomRight: { emoji: '🥛', text: '.☘︎ ˖+×+.' }
};

const defaultIcons = {
    'chat-list-screen': {name: '404', url: 'https://i.postimg.cc/VvQB8dQT/chan-143.png'},
    'api-settings-screen': {name: 'api', url: 'https://i.postimg.cc/50FqT8GL/chan-125.png'},
    'wallpaper-screen': {name: '壁纸', url: 'https://i.postimg.cc/3wqFttL3/chan-90.png'},
    'world-book-screen': {name: '世界书', url: 'https://i.postimg.cc/prCWkrKT/chan-74.png'},
    'customize-screen': {name: '自定义', url: 'https://i.postimg.cc/vZVdC7gt/chan-133.png'},
    'font-settings-screen': {name: '字体', url: 'https://i.postimg.cc/FzVtC0x4/chan-21.png'},
    'tutorial-screen': {name: '教程', url: 'https://i.postimg.cc/6QgNzCFf/chan-118.png'},
    'day-mode-btn': {name: '白昼模式', url: 'https://i.postimg.cc/Jz0tYqnT/chan-145.png'},
    'night-mode-btn': {name: '夜间模式', url: 'https://i.postimg.cc/htYvkdQK/chan-146.png'},
    'music-screen': {name: '音乐', url: 'https://i.postimg.cc/ydd65txK/1758451018266.png'},
    'console-screen': {name: '控制台', url: 'https://i.postimg.cc/sfMwnRvn/ji-lichan-(128).png'},
    'storage-analysis-screen': {name: '存储分析', url: 'https://i.postimg.cc/J0F3Lt0T/chan-107.png'},
    'widget-market-screen': {name: '小组件', url: 'https://i.postimg.cc/NG2k67zS/ji-lichan-(138).png'},
    'reader-bookshelf-screen': {name: '阅读器', url: 'https://i.postimg.cc/FHkvm6WG/ji-lichan-(41).png'},
    'placeholder-app': {name: '<3', url: 'https://i.postimg.cc/kGSN7qSq/ji-lichan-(136).png'}
};

const peekScreenApps = {
    'messages': { name: '消息', url: 'https://i.postimg.cc/Kvs4tDh5/export202509181826424260.png' },
    'memos': { name: '备忘录', url: 'https://i.postimg.cc/JzD0xH1C/export202509181829064550.png' },
    'cart': { name: '购物车', url: 'https://i.postimg.cc/pLwT6VTh/export202509181830143960.png' },
    'transfer': { name: '中转站', url: 'https://i.postimg.cc/63wQBHCB/export202509181831140230.png' },
    'browser': { name: '浏览器', url: 'https://i.postimg.cc/SKcsF02Z/export202509181830445980.png' },
    'drafts': { name: '草稿箱', url: 'https://i.postimg.cc/ZKqC9D2R/export202509181827225860.png' },
    'album': { name: '相册', url: 'https://i.postimg.cc/qBcdpqNc/export202509221549335970.png' },
    'steps': { name: '步数', url: 'https://i.postimg.cc/5NndFrq6/export202509181824532800.png' },
    'unlock': { name: 'unlock！', url: 'https://i.postimg.cc/28zNyYWs/export202509221542593320.png' },
    'bag': { name: '翻包', url: 'https://i.postimg.cc/kGSN7qSq/ji-lichan-(136).png' }
};

const DEFAULT_COT_ITEMS_GPT = [
    {
        "id": "cot_item_gpt_head",
        "name": "引子",
        "content": "[本轮任务：交付一份完整的角色回复编辑报告]\n本轮交付由编辑报告与最终成稿两部分组成。请根据下面各条目及当前聊天上下文，交付一份具体、可供审阅的报告，内容以实际启用条目的要求为准。\n\n报告采用 <preplan> 与 </preplan> 包裹，不用代码块。报告内交付各条目要求的具体成果；最终成稿不作为报告中的栏目，而是在闭合 </preplan> 后，直接按前端原有角色消息格式交付。最终成稿只交付一次。\n\n交付要求：\n- 按已启用模块的原有标题、顺序分别填写，不合并多个阶段。只交付具体结论、稿件和文字校对成果，不写逐步心理推导。\n- 不用“创作简述”“表达方向”或“已检查”代替实际条目成果。\n- 场景事实以现有上下文为准，未知注明未知；不虚构用户经历或尚未提供的资料。\n- 如有规则模块，分别填写本轮适用情况；如有检查清单，每个项目分别标明“通过 / 需修改 / 不适用”，附简短的文本依据。\n- 如条目要求草稿，完整写出草稿；如要求检查与修改，需要修改时列出“原句 → 修改后”和对应规则，并按要求交付修订稿与复核结果；没有命中时如实写“无须修改”，不故意制造错误。\n- 只执行实际提供且启用的模块，不自行增加未要求的阶段。条目要求的草稿、校对及修订记录属于报告；最终角色正文放在 </preplan> 之后。不要在报告内单列【最终成稿】栏目，也不要将最终角色正文再包入其他标签或代码块。\n\n以下是本轮报告的具体要求：\n<preplan_spec>",
        "enabled": true,
        "locked": false
    },
    {
        "id": "cot_item_gpt_tail",
        "name": "尾声",
        "content": "</preplan_spec>\n\n请按以下顺序交付本轮成果：\n<preplan>\n依次填写以上所有已启用模块，保留各模块标题，交付各模块要求的具体成果。\n如有草稿、检查、修改或复核模块，按其原有顺序与具体要求完整填写；未提供或未启用的模块不补写。\n</preplan>\n此处接完整的最终角色回复，使用前端原有聊天消息格式，不加“最终成稿”等标题，不用代码块，不再包入preplan标签。\n\n上述栏目说明是交付结构，请用本轮的具体成果填写，不照抄占位说明。报告结束不代表本轮交付结束：闭合 </preplan> 后，还须交付最终角色回复。最终成稿只放标签外一次；如有草稿与校对记录，仍保留在报告内。\n\n【交付结束条件】\n完成报告后，闭合 </preplan>，随后立即将最终角色回复，按[角色名的消息：内容]等原有聊天格式输出在标签外；如启用了校对或修改模块，最终回复应采用完成相应校对与修改后的版本。\n\n报告里的草稿或修订稿不能代替标签外的正式回复。只有报告和正式回复两部分都已输出，本轮任务才算完成。不要在报告末尾结束整次回复。",
        "enabled": true,
        "locked": false
    }
];

const DEFAULT_COT_PRESETS = [
    {
        id: 'default',
        name: '默认思维链',
        items: [
            {
                id: 'cot_item_1',
                name: '引子',
                content: '[System Directive]:\n你必须严格遵守 [incipere] 协议。在回复前，请先进入 <thinking> 标签进行深度推演。\n请按以下步骤查阅 System Prompt 中的模块并思考：',
                enabled: true
            },
            {
                id: 'cot_item_2',
                name: '准备动脑了吗？',
                content: '---\n## 【前置规则】\n### **必须**读取所有<logic_rules>和<output_formats>：了解**所有**需要遵守的规则，然后进行以下步骤精简准确的思考',
                enabled: true
            },
            {
                id: 'cot_item_3',
                name: '给我读设定！',
                content: '---\n## 【行为校准】\n基于<char_settings>和<角色活人运转>构建角色人格\n### Phase1: person\n1. **自我意识校验 (Ref: <char_settings>和<角色活人运转>)**\n   - 是否塑造鲜活真实人格？\n   - 你（角色）是否具有自己的聊天习惯/风格？\n   - 你想如何回应我？',
                enabled: true
            },
            {
                id: 'cot_item_4',
                name: '当个人吧。',
                content: '### Phase2: Verisimilitude\n2.**真实聊天**\n   - 是否根据以下两点要求采用了真人聊天思路？\n    - 正常人的注意力是有限的，不会每句话都非得逐句回复。\n    - 不对已有信息进行重复反问。\n    - 断点处理：若与上一条消息间隔较久，默认双方只是自然忙碌后重新拿起手机或默认期间以其他方式保持联系，自然接续话题。',
                enabled: true
            },
            {
                id: 'cot_item_5',
                name: '有特殊格式吗？',
                content: '### Phase3: chat role\n3. **逻辑检索 (Ref: <logic_rules>)**\n   - 当前是否为双语对话情境？若无，跳过此条\n   - 是否需要输出状态栏？若无相关要求，则跳过此条',
                enabled: true
            },
            {
                id: 'cot_item_6',
                name: '最后确认一下。',
                content: '## 【最后确认】\n\n4. 整合<Chatting Guidelines>，是否合理自然回复且不偏离人设？回顾<output_formats>，输出消息格式是否正确？',
                enabled: true
            },
            {
                id: 'cot_item_7',
                name: '尾声',
                content: '每轮输出前，必须先严格按照<thinking>…</thinking>内的步骤进行逐条思考，无需重复其中的条目，但思考内容需精简准确、清晰、可执行，不得跳步骤。\n<thinking>中的所有分析必须在输出中完全落实，不得偏离、删减或弱化。\n\n格式：\n<thinking>\n...思考过程...\n</thinking>',
                enabled: true
            }
        ]
    },
    { id: 'default_gpt', name: '默认伪思维链头尾部', items: JSON.parse(JSON.stringify(DEFAULT_COT_ITEMS_GPT)) }
];

const globalSettingKeys = [
    'apiSettings', 'wallpaper', 'homeScreenMode', 'fontUrl', 'customIcons',
    'uwuReviewCovers', 'uwuNightMode', 'uwuMusic', 'uwuCalendar', 'uwuShortStories', 'uwuWritingStyles', 'uwuBackupExtras', 'worldBookPresets', 'apiPresets', 'uwuEmbeddingPresets', 'bubbleCssPresets', 'myPersonaPresets', 'globalCss',
    'globalCssPresets', 'fontPresets', 'homeSignature', 'insWidgetSettings', 'homeWidgetSettings',
    'inlineThinkingEnabled', 'statusThinkingEnabled', 'chatFolders', 'fontSizeScale', 'activePersonaId', 'moreProfileCardBg', 'statusBarPresets', 'themeSettings', 'themePresets', 'savedKeyboardHeight',
    'globalSendSound', 'globalReceiveSound', 'multiMsgSoundEnabled', 'soundPresets', 'galleryPresets',
    'cotSettings', 'cotPresets', 'hasSeenVideoCallDisclaimer', 'hasSeenVideoCallAvatarHint',
    'workshopSettings', 'workshopLlmPresets', 'workshopPromptPresets', 'homeLayoutOrder',
    'homeLayoutPages', 'widgetTemplates', 'addedWidgets', 'backupReminderSettings',
    'stUnlocked'
];


const appVersion = "2.8.2";
const updateLog = [
    {
        "version": "2.8.2",
        "date": "2026-10-27",
        "credits": [
            "U••U 基于1900版本1.8.9的二改 by从今若许闲乘月",
            "感谢EE、1900、莫由（论坛功能by莫由）、Anrrow（伪思维链灵感by Anrrow）、粥粥（存储容量统计修正by粥粥）",
            "感谢火火、秩秩提供灵感帮忙测试",
            "感谢小齿的精神鼓励",
            "爱你们"
        ],
        "notes": [
            "1.新增功能",
            "伪思维链：内置默认伪思维链头尾部预设，可在引子和尾声之间添加自定义条目，适配无法读取thinking输出的模型。",
            "小剧场：自动读取双方人设，分别绑定世界书与文风，独立创作和续写。支持字数范围或最少字数、双方描写人称、收藏日记可选读取全部或最近X条已点亮内容、总结规范世界书、生成预设与草稿保存。文稿可分类、搜索，生成后以隔空投送提醒；正文、指令和总结独立于线上聊天。",
            "文风库：独立保存和管理文风，支持手动添加、TXT／DOCX导入、文件夹与分组。",
            "生成预设：保存界面中除创作指令外的全部绑定和生成设置，包括世界书、文风、总结规范、字数、人称、上下文、收藏日记读取及总结设置；可应用、编辑和管理。",
            "手动增加记忆：回忆日记中可自行填写标题和正文，手动补充总结并按需点亮收藏，不关联聊天消息、不占自动总结进度。",
            "真人回复：角色根据自己的日常安排、忙碌程度、睡眠状态、双方当地时间和当前聊天情况，自主决定何时回复。支持交错聊天，你可以在等待时继续发消息，角色回复时会结合期间的新消息作答；也可主动找你聊天，并结合已开启的功能进行音乐等互动。",
            "自动总结：按条数或时间生成小总结，再合并为大总结；支持独立总结API、大小总结世界书、来源追踪及失败重试。",
            "向量记忆：历史分批及自动提取、四分类、事件跟进、相似记忆核对、核心记忆、相关日记原文读取，支持独立接口和记忆导入导出。",
            "音乐与一起听：支持歌曲搜索、播放、歌词显示、歌曲分享及双方互相邀请一起听，记录一起听时长，并提供可拖动的悬浮播放器。共同歌单存放角色想分享给你听的歌，专属歌单存放角色自己想听的歌，临时待播用于安排本次播放。一起听时，角色可结合聊天切歌、暂停、继续播放、添加歌曲或移除尚未播放的歌曲；平常聊天中也可按授权搜索歌曲、增删共同与专属歌单。支持单独配置音乐自主互动，由角色主动进行音乐操作。",
            "书影音：角色自主发表书评、影评、乐评，维护网名、签名及模拟好友评论，支持收藏架、用户留言、评价分享、旧评价查询与作品封面。",
            "投票：双方都能发起、选择、改选、取消或添加选项；支持多选、可选注释及头像选择结果。",
            "待办清单：双方事项、进度更新、完成记录及聊天分享；支持单方或双方合并分享，左右滑动切换。",
            "日历、经期与节假日：经期记录、更正、预测、感受与备注；各角色分别设置经期知情、提前提醒及节假日与调休知情。",
            "城市与时差：分别设置双方城市和时区，为聊天、通话及真人回复提供当地时间与时差，支持夏令时。",
            "拾页：读取分享的小红书正文与配图，和补充文字一起交给当前聊天模型；支持引用、重生成缓存、无标题及纯配图内容。",
            "应用夜间模式：应用页面转为夜间显示，聊天内沿用自己的美化。",
            "备份扩展：无损精简备份、向量记忆合集导出及yuan格式备份导入导出兼容。",
            "2.修复",
            "主屏幕小组件：修复模板样式未及时加载、返回主页后显示异常，以及内容越出组件范围的问题。",
            "TT通话指令：补全语音、视频通话格式，开启对应功能后角色可以通过TT主动发起通话。",
            "存储容量统计：修正角色资料的统计归类，将聊天存档计入聊天记录容量，使储存分析与备份内容对应；不改动实际聊天、存档及备份资料。",
            "3.新增操作",
            "小剧场阅读：纵向目录按楼层跳页，包含创作指令；Aa调整字体、字号、间距、阅读配色与自定义背景。更多菜单可编辑正文、整理本篇总结及配置上下文；点击续写再展开输入，显示预计上下文token。",
            "左滑引用：消息可以向左滑动引用，保留原长按菜单。",
            "补充user历史消息：长按user消息可在其后新增记录，后面已有角色回复时也能补充。",
            "停止生成：加号面板可停止当前聊天的生成及后续气泡显示，不关闭真人回复总开关。",
            "世界书文档导入与预设：支持导入文档、整理分类、保存预设及批量绑定。",
            "聊天内编辑世界书：已绑定列表与选择页面可直接查看、修改原条目，其他绑定同一条目的角色同步使用。",
            "思维链排序与还原：预设及内部条目支持排序，预设列表可长按拖动，内置预设可一键还原。",
            "状态栏翻面与删除：翻面查看同轮思维链，背面可修改和删除；面板快照、原始状态栏消息与思维链分别管理。",
            "状态栏文件夹：支持嵌套分类、移动和搜索，聊天设置中可按文件夹选择预设。",
            "CSS放大编辑：展开大编辑框，继续使用查找与替换，方便手机操作。",
            "日记编辑与来源查看：编辑标题、正文，查看关联来源，并在修改相关聊天后选择是否更新总结；大小总结可展开对应关系。",
            "备份与容量操作：导出显示整理、压缩进度，减少大数据处理阻塞；支持单独导出全部向量记忆，保留完整备份和分类导出。",
            "若需将数据导入其他版本的UwU，请使用“完整备份”导出。"
        ],
        "popupNotes": [
            "新增小剧场与文风库，支持独立创作、续写、文稿保存和阅读排版。支持完整生成预设、收藏日记读取范围及总结规范世界书。",
            "回忆日记支持手动增加记忆，自行填写标题和正文，可选收藏。",
            "新增真人回复、自动总结、向量记忆、音乐与一起听、书影音、投票、待办、日历经期、拾页及夜间模式。",
            "增加左滑引用、世界书文档导入与预设、聊天内编辑世界书、思维链排序与伪思维链、状态栏分类等操作。",
            "修复小组件显示、TT主动通话及存储容量统计问题。",
            "功能入口、配置方法和完整更新记录请查看「教程 → U••U 新增功能与操作」。",
            "若需将数据导入其他版本的UwU，请使用“完整备份”导出。"
        ]
    }
];

// 全局变量
var db = {
    characters: [],
    groups: [],
    apiSettings: {},
    wallpaper: 'https://i.postimg.cc/W4Z9R9x4/ins-1.jpg',
    myStickers: [],
    homeScreenMode: 'night',
    worldBooks: [],
    fontUrl: '',
    customIcons: {},
    uwuBackupExtras: {},
            apiPresets: [],
            uwuEmbeddingPresets: [],
    bubbleCssPresets: [],
    myPersonaPresets: [],
    fontPresets: [],
    globalCss: '',
    globalCssPresets: [],
    homeSignature: '编辑个性签名...',
    insWidgetSettings: {
        avatar1: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg',
        bubble1: 'love u.',
        avatar2: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg',
        bubble2: 'miss u.'
    },
    chatFolders: [],
    inlineThinkingEnabled: false,
    statusThinkingEnabled: false,
    fontSizeScale: 1.0,
    savedKeyboardHeight: null,
    activePersonaId: null,
    moreProfileCardBg: 'https://i.postimg.cc/XvFDdTKY/Smart-Select-20251013-023208.jpg',
    statusBarPresets: [],
    themeSettings: {
        global: {
            iconColor: '#000000',
            textColor: '#2a3032',
            titleColor: '#000000',
            backgroundColor: '#ffffff'
        },
        wallpapers: {
            contacts: '',
            chats: '',
            more: ''
        },
        bottomNav: {
            iconColor: '#999999',
            activeIconColor: '#2a3032',
            items: [
                { defaultIcon: '', activeIcon: '' },
                { defaultIcon: '', activeIcon: '' },
                { defaultIcon: '', activeIcon: '' },
                { defaultIcon: '', activeIcon: '' }
            ]
        },
        chatScreen: {
            bottomBarColor: '#ffffff',
            iconColor: '#000000',
            folderPillColor: '#ffffff'
        }
    },
    themePresets: [],
    globalSendSound: '',
    globalReceiveSound: '',
    multiMsgSoundEnabled: false,
    soundPresets: [],
    galleryPresets: [],
    cotSettings: {
        enabled: false,
        activePresetId: 'default',
        prefillEnabled: true,
        callPrefillEnabled: true
    },
    cotPresets: JSON.parse(JSON.stringify(DEFAULT_COT_PRESETS)),
    workshopSettings: {
        provider: '',
        apiType: 'official',
        apiUrl: '',
        apiKey: '',
        model: '',
        width: 832,
        height: 1216,
        cfgScale: 5.0,
        rateLimit: 45,
        positivePrompt: '',
        characterPrompt: '',
        negativePrompt: '',
        llmIndependentApi: false,
        llmApiPresetId: '',
        gptLlmIndependentApi: false,
        gptLlmApiPresetId: '',
        boundCharacters: []
    },
    workshopLlmPresets: [],
    workshopPromptPresets: [],
    widgetTemplates: [],
    addedWidgets: [],
    backupReminderSettings: {
        enabled: true,
        interval: 3,
        lastReminderTime: 0
    }
};


var currentChatId = null;
var currentChatType = null;
var isGenerating = false;
var longPressTimer = null;
var isInMultiSelectMode = false;
var editingMessageId = null;
var currentPage = 1;
var currentTransferMessageId = null;
var currentEditingWorldBookId = null;
var currentStickerActionTarget = null;
var currentJournalDetailId = null;
var currentQuoteInfo = null;
var isDebugMode = false;
var currentFolderId = 'all';
var currentFolderActionTarget = null;
var currentGroupAction = {type: null, recipients: []};
var isRawEditMode = false;
var isStickerManageMode = false;
var selectedStickerIds = new Set();
var isWorldBookMultiSelectMode = false;
var selectedWorldBookIds = new Set();
var generatingPeekApps = new Set();
var selectedMessageIds = new Set();
var currentStickerCategory = 'recent';
const MESSAGES_PER_PAGE = 50;


// Dexie 数据库初始化
var dexieDB; // 声明全局变量，但不初始化

function initDatabase() {
    dexieDB = new Dexie('章鱼喷墨机DB_ee');
    dexieDB.version(1).stores({
        storage: 'key, value'
    });
    dexieDB.version(8).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key',
        workshopHistory: '++id, timestamp',
        workshopVibeGroups: '++id',
        characterPhotos: '++id, charId, timestamp',
        customFonts: '&id',
        reader_books: '&id, lastReadTime',
        reader_chapters: '&id, bookId',
        reader_comments: '++id, bookId, [bookId+chapterIndex+paragraphIndex]'
    });
    dexieDB.version(7).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key',
        workshopHistory: '++id, timestamp',
        workshopVibeGroups: '++id',
        characterPhotos: '++id, charId, timestamp',
        customFonts: '&id',
        reader_books: '&id, lastReadTime',
        reader_chapters: '&id, bookId'
    });
    dexieDB.version(6).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key',
        workshopHistory: '++id, timestamp',
        workshopVibeGroups: '++id',
        characterPhotos: '++id, charId, timestamp',
        customFonts: '&id',
        reader_books: '&id',
        reader_chapters: '&id, bookId'
    });
    dexieDB.version(5).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key',
        workshopHistory: '++id, timestamp',
        workshopVibeGroups: '++id',
        characterPhotos: '++id, charId, timestamp',
        customFonts: '&id'
    });
    dexieDB.version(4).stores({
        characters: '&id',
        groups: '&id',
        worldBooks: '&id',
        myStickers: '&id',
        globalSettings: 'key',
        workshopHistory: '++id, timestamp',
        workshopVibeGroups: '++id',
        characterPhotos: '++id, charId, timestamp'
    }).upgrade(async tx => {
        console.log("Upgrading database to version 2...");
        const oldData = await tx.table('storage').get('章鱼喷墨机');
        if (oldData && oldData.value) {
            console.log("Old data found, starting migration.");
            const data = JSON.parse(oldData.value);
            if (data.characters) await tx.table('characters').bulkPut(data.characters);
            if (data.groups) await tx.table('groups').bulkPut(data.groups);
            if (data.worldBooks) await tx.table('worldBooks').bulkPut(data.worldBooks);
            if (data.myStickers) await tx.table('myStickers').bulkPut(data.myStickers);
            
            const settingsToMigrate = {
                apiSettings: data.apiSettings || {},
                wallpaper: data.wallpaper || 'https://i.postimg.cc/W4Z9R9x4/ins-1.jpg',
                homeScreenMode: data.homeScreenMode || 'night',
                fontUrl: data.fontUrl || '',
                customIcons: data.customIcons || {},
                apiPresets: data.apiPresets || [],
                uwuEmbeddingPresets: data.uwuEmbeddingPresets || [],
                bubbleCssPresets: data.bubbleCssPresets || [],
                myPersonaPresets: data.myPersonaPresets || [],
                globalCss: data.globalCss || '',
                globalCssPresets: data.globalCssPresets || [],
                homeSignature: data.homeSignature || '编辑个性签名...',
                insWidgetSettings: data.insWidgetSettings || { avatar1: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg', bubble1: 'love u.', avatar2: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg', bubble2: 'miss u.' },
                homeWidgetSettings: data.homeWidgetSettings || defaultWidgetSettings,
            moreProfileCardBg: data.moreProfileCardBg || 'https://i.postimg.cc/XvFDdTKY/Smart-Select-20251013-023208.jpg',
            cotSettings: data.cotSettings || { enabled: false, activePresetId: 'default' },
            cotPresets: data.cotPresets || JSON.parse(JSON.stringify(DEFAULT_COT_PRESETS)),
            workshopSettings: {
                provider: '', apiType: 'official', apiUrl: '', apiKey: '', model: '',
                width: 832, height: 1216, cfgScale: 5.0, rateLimit: 45,
                positivePrompt: '', characterPrompt: '', negativePrompt: '', llmIndependentApi: false, llmApiPresetId: '', gptLlmIndependentApi: false, gptLlmApiPresetId: '', boundCharacters: []
            },
            workshopLlmPresets: [],
            workshopPromptPresets: [],
            homeLayoutOrder: ['widget-top', 'widget-ins', 'app-chat', 'app-api', 'app-wallpaper', 'app-worldbook', 'app-customize', 'app-tutorial', 'app-reader', 'widget-heart', 'app-placeholder'],
            widgetTemplates: [],
            addedWidgets: []
        };


            const settingsPromises = Object.entries(settingsToMigrate).map(([key, value]) =>
                tx.table('globalSettings').put({ key, value })
            );
            await Promise.all(settingsPromises);
            
            await tx.table('storage').delete('章鱼喷墨机');
            console.log("Migration complete. Old data removed.");
        } else {
            console.log("No old data found to migrate.");
        }
    });
}

// 数据保存与加载
const saveData = async () => {
    if (!dexieDB) return;
    window.WorldBookPresets?.syncAll();
    window.JournalAutomation?.reconcileAll();
    window.VectorMemory?.reconcileAll();
    if (typeof syncAllActiveArchives === 'function') {
        syncAllActiveArchives();
    }
    await dexieDB.transaction('rw', dexieDB.tables, async () => {
        await dexieDB.characters.bulkPut(db.characters);
        await dexieDB.groups.bulkPut(db.groups);
        await dexieDB.worldBooks.bulkPut(db.worldBooks);
        await dexieDB.myStickers.bulkPut(db.myStickers);

        const settingsPromises = globalSettingKeys.map(key => {
            if (db[key] !== undefined) {
                return dexieDB.globalSettings.put({ key: key, value: db[key] });
            }
            return null;
        }).filter(p => p);
        await Promise.all(settingsPromises);
    });
};

const loadData = async () => {
    const [characters, groups, worldBooks, myStickers, settingsArray] = await Promise.all([
        dexieDB.characters.toArray(),
        dexieDB.groups.toArray(),
        dexieDB.worldBooks.toArray(),
        dexieDB.myStickers.toArray(),
        dexieDB.globalSettings.toArray()
    ]);

    db.characters = characters;
    db.groups = groups;
    db.worldBooks = worldBooks;
    db.myStickers = myStickers;

    // 兼容旧数据：为没有 type 的世界书条目默认设置为 'entry'
    db.worldBooks.forEach(item => {
        if (!item.type) {
            item.type = 'entry';
        }
    });

    const settings = settingsArray.reduce((acc, { key, value }) => {
        acc[key] = value;
        return acc;
    }, {});

    globalSettingKeys.forEach(key => {
        const defaultValue = {
            apiSettings: {},
            wallpaper: 'https://i.postimg.cc/W4Z9R9x4/ins-1.jpg',
            homeScreenMode: 'night',
            fontUrl: '',
            customIcons: {},
            uwuBackupExtras: {},
            apiPresets: [],
            uwuEmbeddingPresets: [],
            bubbleCssPresets: [],
            myPersonaPresets: [],
            fontPresets: [],
            globalCss: '',
            globalCssPresets: [],
            homeSignature: '编辑个性签名...',
            insWidgetSettings: { avatar1: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg', bubble1: 'love u.', avatar2: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg', bubble2: 'miss u.' },
            homeWidgetSettings: defaultWidgetSettings,
            activePersonaId: null,
            moreProfileCardBg: 'https://i.postimg.cc/XvFDdTKY/Smart-Select-20251013-023208.jpg',
            globalSendSound: '',
            globalReceiveSound: '',
            multiMsgSoundEnabled: false,
            soundPresets: [],
            galleryPresets: [],
            cotSettings: { enabled: false, activePresetId: 'default', prefillEnabled: true, callPrefillEnabled: true },
            cotPresets: JSON.parse(JSON.stringify(DEFAULT_COT_PRESETS)),
            hasSeenVideoCallDisclaimer: false,
            hasSeenVideoCallAvatarHint: false,
            workshopSettings: {
                provider: '', apiType: 'official', apiUrl: '', apiKey: '', model: '',
                width: 832, height: 1216, cfgScale: 5.0, rateLimit: 45,
                positivePrompt: '', characterPrompt: '', negativePrompt: '', llmIndependentApi: false, llmApiPresetId: '', gptLlmIndependentApi: false, gptLlmApiPresetId: '', boundCharacters: []
            },
            workshopLlmPresets: [],
            workshopPromptPresets: [],
            homeLayoutOrder: ['widget-top', 'widget-ins', 'app-chat', 'app-api', 'app-wallpaper', 'app-worldbook', 'app-customize', 'app-tutorial', 'app-reader', 'widget-heart', 'app-placeholder'],
            homeLayoutPages: null,
            backupReminderSettings: { enabled: true, interval: 3, lastReminderTime: 0 },
            stUnlocked: false
        };
        db[key] = settings[key] !== undefined ? settings[key] : (defaultValue[key] !== undefined ? JSON.parse(JSON.stringify(defaultValue[key])) : undefined);
    });

    // Data integrity checks
    db.characters.forEach(c => {
        if (!c.peekData) c.peekData = {}; 
        if (c.isPinned === undefined) c.isPinned = false;
        if (c.status === undefined) c.status = '在线';
        if (!c.worldBookIds) c.worldBookIds = [];
        if (c.customBubbleCss === undefined) c.customBubbleCss = '';
        if (c.useCustomBubbleCss === undefined) c.useCustomBubbleCss = false;
        if (c.showTimestamp === undefined) c.showTimestamp = false;
        if (c.timestampPosition === undefined) c.timestampPosition = 'below_avatar';
        if (!c.statusPanel) {
            c.statusPanel = {
                enabled: false,
                promptSuffix: '',
                regexPattern: '',
                replacePattern: '',
                historyLimit: 3,
                currentStatusRaw: '',
                currentStatusHtml: '',
                history: []
            };
        }
        if (!c.autoReply) {
            c.autoReply = {
                enabled: false,
                interval: 60,
                lastTriggerTime: 0
            };
        }
        if (!c.gallery) c.gallery = [];
        if (c.useRealGallery === undefined) c.useRealGallery = false;
        if (!c.callHistory) c.callHistory = [];
    });
    db.groups.forEach(g => {
        if (g.isPinned === undefined) g.isPinned = false;
        if (!g.worldBookIds) g.worldBookIds = [];
        if (g.customBubbleCss === undefined) g.customBubbleCss = '';
        if (g.useCustomBubbleCss === undefined) g.useCustomBubbleCss = false;
        if (g.showTimestamp === undefined) g.showTimestamp = false;
        if (g.timestampPosition === undefined) g.timestampPosition = 'below_avatar';
        if (!g.callHistory) g.callHistory = [];
    });
    
    // Handle old localStorage data if it exists
    const oldLocalStorageData = localStorage.getItem('gemini-chat-app-db');
    if(oldLocalStorageData) {
        console.log("Found old localStorage data, migrating...");
        const data = JSON.parse(oldLocalStorageData);
        await dexieDB.transaction('rw', dexieDB.tables, async () => {
            if (data.characters) await dexieDB.characters.bulkPut(data.characters);
            if (data.groups) await dexieDB.groups.bulkPut(data.groups);
        });
        localStorage.removeItem('gemini-chat-app-db');
        await loadData();
    }
};

// 存储分析工具
const dataStorage = {
    getStorageInfo: async function() {
        const stringify = (obj) => {
            try {
                return JSON.stringify(obj).length;
            } catch (e) {
                console.warn("Could not stringify object for size calculation:", obj, e);
                return 0;
            }
        };

        let categorizedSizes = {
            messages: 0,
            charactersAndGroups: 0,
            worldAndForum: 0,
            personalization: 0,
            apiAndCore: 0,
            other: 0
        };

        if (!db || !db.characters) {
            await loadData();
        }

        // 1. Messages (History)
        (db.characters || []).forEach(char => {
            categorizedSizes.messages += stringify(char.history);
        });
        (db.groups || []).forEach(group => {
            categorizedSizes.messages += stringify(group.history);
        });

        // 2. Characters and Groups (metadata)
        (db.characters || []).forEach(char => {
            const charWithoutHistory = { ...char, history: undefined };
            categorizedSizes.charactersAndGroups += stringify(charWithoutHistory);
        });
        (db.groups || []).forEach(group => {
            const groupWithoutHistory = { ...group, history: undefined };
            categorizedSizes.charactersAndGroups += stringify(groupWithoutHistory);
        });

        // 3. World and Forum
        categorizedSizes.worldAndForum += stringify(db.worldBooks);

        // 4. Personalization
        categorizedSizes.personalization += stringify(db.myStickers);
        categorizedSizes.personalization += stringify(db.wallpaper);
        categorizedSizes.personalization += stringify(db.homeScreenMode);
        categorizedSizes.personalization += stringify(db.fontUrl);
        categorizedSizes.personalization += stringify(db.customIcons);
        categorizedSizes.personalization += stringify(db.bubbleCssPresets);
        categorizedSizes.personalization += stringify(db.myPersonaPresets);
        categorizedSizes.personalization += stringify(db.globalCss);
        categorizedSizes.personalization += stringify(db.globalCssPresets);
        categorizedSizes.personalization += stringify(db.homeSignature);
        categorizedSizes.personalization += stringify(db.insWidgetSettings);
        categorizedSizes.personalization += stringify(db.homeWidgetSettings);
        categorizedSizes.personalization += stringify(db.moreProfileCardBg);
        categorizedSizes.personalization += stringify(db.soundPresets);

        // 5. API and Core
        categorizedSizes.apiAndCore += stringify(db.apiSettings);
        categorizedSizes.apiAndCore += stringify(db.apiPresets);
        categorizedSizes.apiAndCore += stringify(db.cotSettings);
        categorizedSizes.apiAndCore += stringify(db.cotPresets);
        categorizedSizes.apiAndCore += stringify(db.workshopSettings);
        categorizedSizes.apiAndCore += stringify(db.workshopLlmPresets);

        // 6. Workshop Data (from Dexie directly as it might be large)
        try {
            const historyCount = await dexieDB.workshopHistory.count();
            // Rough estimation: assume each history item is ~500KB (base64 image + metadata)
            categorizedSizes.other += historyCount * 500 * 1024; 
            
            const vibeCount = await dexieDB.workshopVibeGroups.count();
            // Rough estimation: assume each vibe group is ~200KB
            categorizedSizes.other += vibeCount * 200 * 1024;
        } catch (e) {
            console.warn("Could not calculate workshop data size:", e);
        }

        const totalSize = Object.values(categorizedSizes).reduce((sum, size) => sum + size, 0);

        return {
            totalSize,
            categorizedSizes
        };
    }
};
