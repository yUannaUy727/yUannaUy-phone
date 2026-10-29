// In-app phone guide for the bundled API-only backend. It never changes Cloudflare settings itself.
'use strict';
function deploymentGuide(){
 const parts=3;
 function para(text){return E('p',{class:'tiny',text});}
 function step(title,...children){return E('details',{class:'deploy-step'},E('summary',{text:title}),...children);}
 function instructions(rows){return E('ol',{},...rows.map(text=>E('li',{},text)));}
 async function copy(text,field){try{await navigator.clipboard.writeText(text);toast('已复制');}catch{field?.focus();field?.select();try{if(document.execCommand('copy'))return toast('已复制');}catch{}toast('已选中文字，请长按复制');}}
 const partRows=E('div',{class:'deploy-parts'});
 for(let i=1;i<=parts;i++){
  const text=E('textarea',{readonly:true,rows:5,'aria-label':'后端第 '+i+' 段代码',placeholder:'正在读取代码…'}),copyBtn=B('复制第 '+i+' / '+parts+' 段',()=>{if(!text.value)throw Error('代码尚未读取成功');return copy(text.value,text);});copyBtn.disabled=true;
  const retry=B('重新读取',load);async function load(){copyBtn.disabled=true;try{const r=await fetch('backend/part-'+String(i).padStart(2,'0')+'.txt',{cache:'no-store'});if(!r.ok)throw Error('读取失败');text.value=await r.text();if(!text.value||text.value.startsWith('<!'))throw Error('代码文件未部署');copyBtn.disabled=false;retry.hidden=true;}catch{text.value='';text.placeholder='没有读到代码，请确认部署了整个 UwU 文件夹，再点重新读取。';retry.hidden=false;}}
  partRows.append(E('div',{class:'deploy-code'},copyBtn,retry,E('details',{},E('summary',{text:'展开第 '+i+' 段代码'}),text)));void load();
 }
 const sources=E('p',{class:'tiny'},'按 Cloudflare 官方说明核对（2026-10-23）：',...[
  ['创建与部署','https://developers.cloudflare.com/workers/get-started/dashboard/'],
  ['变量和密钥','https://developers.cloudflare.com/workers/configuration/environment-variables/'],
  ['Node.js 兼容','https://developers.cloudflare.com/workers/runtime-apis/nodejs/']
 ].map(([label,href])=>E('a',{href,target:'_blank',rel:'noopener noreferrer',text:label,style:'display:inline-block;margin:4px 10px 4px 0'})));
 sheet('音乐后端 · 手机部署教程',
  para('适用于纯接口后端 v0.7.2。完整音乐页面在 UwU 内，后端域名打开显示 JSON 是正常的。已有音乐 Worker 就更新原项目，原域名可继续用。v0.7.2 搜索每次最多返回50条候选；已部署用户需替换下方代码并重新部署，原口令和来源配置保留。'),
  step('① 已有音乐 Worker：从哪里更新',instructions([
   '登录 Cloudflare，进入 Workers & Pages（Workers 和 Pages），点你原来的音乐 Worker。不要选拾页那个 Worker。',
   '在详情页点 Edit code（编辑代码）。找不到编辑器时，可在手机浏览器菜单开启“桌面版网站”后再进入。',
   '选中代码文件（通常叫 worker.js 或 index.js），全选并清空旧内容。按下面顺序贴第1、2、3段，中间保留换行；三段全部贴完后再点 Deploy（部署）。',
   '已有 TEST_KEY、兼容设置、自定义域名都保留。不要把“完整代码”和“三段代码”重复贴两遍。'
  ])),
  step('② 还没有音乐 Worker：入口怎么选',instructions([
   '在 Workers & Pages 点 Create application（创建应用）。如果提供 Start with Hello World（从 Hello World 开始），选它，填写自己的项目名称并点 Deploy。',
   '如果看到的是模板/仓库入口，选择可编辑 JavaScript Worker 的模板；后续按页面要求创建。这里需要的是运行代码的 Worker，不能用上传静态 HTML 的 Pages 项目代替。',
   '创建后进入项目详情，点 Edit code，然后按第①步替换代码。已有可用音乐 Worker 的用户可以跳过这一步。'
  ])),
  step('③ 运行环境：日期与兼容开关',instructions([
   '打开该 Worker → Settings（设置）→ 找 Runtime（运行时）或 Compatibility date（兼容日期），点编辑。',
   '新建项目建议把兼容日期设为 2026-08-04 或更新日期，然后保存/部署。该日期起 Node.js 兼容已默认启用。',
   '如果沿用 2024-09-23 至 2026-08-03 的旧兼容日期，在 Compatibility flags（兼容标志）里添加 nodejs_compat，再保存/部署。原来已有此标志就保留。',
   '音乐后端不需要 Browser Rendering/BROWSER、KV 或数据库绑定；不要照搬拾页的 BROWSER 绑定步骤。'
  ])),
  step('④ 变量：类型、名称、值分别填什么',para('路径：Worker → Settings → Variables and Secrets（变量和密钥）→ Add（添加）。名称大小写要完全一致。'),
   E('div',{class:'deploy-var'},E('strong',{text:'TEST_KEY'}),instructions(['Type（类型）选 Secret（密钥）。Variable name（名称）填 TEST_KEY。','Value（值）填你自己设置的至少16位口令；已有口令继续使用，不必更换。点 Deploy 或 Save and deploy 保存。之后 UwU 的“私人测试口令”填相同内容。'])),
   E('div',{class:'deploy-var'},E('strong',{text:'ALLOWED_ORIGINS'}),instructions(['Type 选 Text（文本/纯文本）。Variable name 填 ALLOWED_ORIGINS。','Value 填 UwU 网站的完整来源地址，只含 https://域名；不要加聊天路径、/index.html 或末尾斜杠。多个网站用英文逗号分隔，然后 Deploy 保存。']))),
  step('⑤ 把后端连回 UwU',instructions([
   '在 Worker 的 Domains & Routes（域名和路由）中找到部署后的 workers.dev 域名；已有自定义域名可继续使用。如果 workers.dev 不可用，使用你已经配置可访问的自定义域名。',
   '默认 workers.dev 地址在部分网络下需要配置可用的 VPN。也可绑定自己在当地网络可访问的域名；域名后缀或购买地区不代表一定能够直连，需实际测试。',
   '绑定方法：先将自己的域名添加到 Cloudflare，按页面提示在域名注册商处设置 Cloudflare 的名称服务器，等待域名状态变为 Active。进入对应音乐 Worker → Settings → Domains & Routes → Add → Custom Domain（部分界面在 Domains 标签），输入空闲子域名并确认；不要使用已被其他网站或服务占用的主机名。',
   'Cloudflare 会为自定义域名创建 DNS 记录并配置证书。等待生效后，浏览器打开该 HTTPS 域名检查，再将它填入 UwU 的音乐后端地址。后端域名与 ALLOWED_ORIGINS 中填写的前端来源不是同一个设置。',
   '回到 UwU → 主页 <3> → 右上角设置 → 连接地址与悬浮窗，填音乐 Worker 的 https://域名，不加 /api 或 /health，然后点“保存并检查连接”。',
   '回账号设置，填写刚才 TEST_KEY 的值，点“生成登录二维码”；用网易云 App 扫码并确认，再点“检查扫码状态”。',
   '页面提示登录成功后再刷新推荐或歌单。在聊天加号第三页发出一起听邀请，char 接受后开始共享。'
  ])),
  step('⑥ 常见结果怎么处理',instructions([
   '后端域名显示 JSON / ok:true：说明接口正在运行，不是页面丢失。音乐 UI 在 UwU 的 <3> 里。',
   '提示 node:crypto / node:buffer 无法使用：检查第③步兼容日期或 nodejs_compat，保存后重新部署。',
   '提示尚未获准连接/跨域：检查 ALLOWED_ORIGINS 是否与当前 UwU 地址完全一致，类型选 Text，别填成音乐后端的域名。',
   '提示至少16位 TEST_KEY 或口令不正确：检查 Secret 的名称、长度，以及 UwU 中填写的口令是否相同。',
   '连接检查成功不代表网易云账号已登录；扫码失败或无播放地址时，按实际错误检查登录、网络或歌曲权限。'
  ])),
  E('h3',{text:'按顺序复制三段代码'}),para('下面代码与纯接口 v0.7.2 后端一致，每段少于7000字。第一次粘贴前清空 Worker 旧代码，贴完全部三段再部署。'),partRows,
  E('a',{href:'backend/worker.txt?v=072',target:'_blank',rel:'noopener',text:'打开完整代码文件（不要与分段重复粘贴）',class:'tiny'}),sources);
}
