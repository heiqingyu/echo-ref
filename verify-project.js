/**
 * 工程完整性检查
 *  1. 所有 JS 文件语法可解析
 *  2. 所有 JSON 文件格式合法
 *  3. app.json 中声明的页面文件齐全
 *  4. 模拟页面数据流（index -> ef -> reference）
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const MP = path.join(ROOT, 'miniprogram');

// 计算引擎（供第 7、8 节使用）
const core = require(path.join(MP, 'utils', 'echo-core.js'));

let pass = 0, fail = 0;
const problems = [];

function ok(msg) { pass++; console.log('  OK   ' + msg); }
function bad(msg) { fail++; problems.push(msg); console.log(' FAIL  ' + msg); }

/* ---- 1. 收集文件 ---- */
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else out.push(p);
  }
  return out;
}
const all = walk(MP);

console.log('\n=== 1. JSON 语法检查 ===');
for (const f of all.filter(f => f.endsWith('.json'))) {
  try {
    JSON.parse(fs.readFileSync(f, 'utf8'));
    ok(path.relative(ROOT, f));
  } catch (e) {
    bad(path.relative(ROOT, f) + ' → ' + e.message);
  }
}

console.log('\n=== 2. JS 语法检查 ===');
const node = process.execPath;
for (const f of all.filter(f => f.endsWith('.js'))) {
  try {
    execSync(`"${node}" --check "${f}"`, { stdio: 'pipe' });
    ok(path.relative(ROOT, f));
  } catch (e) {
    bad(path.relative(ROOT, f) + ' → ' + String(e.stderr).split('\n')[0]);
  }
}

console.log('\n=== 3. app.json 页面文件齐全性 ===');
const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
for (const pg of appJson.pages) {
  const exts = ['js', 'json', 'wxml', 'wxss'];
  const missing = exts.filter(ext => !fs.existsSync(path.join(MP, pg + '.' + ext)));
  if (missing.length === 0) ok(pg + '  (js/json/wxml/wxss 齐全)');
  else bad(pg + ' 缺少: ' + missing.join(', '));
}

console.log('\n=== 4. tabBar 引用的页面必须在 pages 中 ===');
for (const t of appJson.tabBar.list) {
  if (appJson.pages.includes(t.pagePath)) ok(t.pagePath + ' → ' + t.text);
  else bad('tabBar 引用了未注册页面: ' + t.pagePath);
}

console.log('\n=== 4b. 页面结构：合并 + 其他计算 ===');
if (appJson.pages.includes('pages/calculators/calculators')) ok('calculators 页已注册');
else bad('calculators 页未注册');
if (!appJson.pages.includes('pages/reference/reference')) ok('独立 reference 页已移除（并入 index）');
else bad('reference 页仍独立存在，未合并');
if (fs.existsSync(path.join(MP, 'utils', 'echo-calc.js'))) ok('echo-calc.js 引擎存在');
else bad('echo-calc.js 引擎缺失');

console.log('\n=== 4c. 瓣膜页（v1.5.0 起并入公式集） ===');
// ★ 用户 2026-10-24：瓣膜评估页整页删除，内容并入 aortic / mitral / tr-interv 三个判读条目；
//   瓣膜解剖改为公式集里的一个条目（pages/valveana 仍在，但只放 TEE 切面）。
if (appJson.pages.includes('pages/valves/valves')) bad('valves 页应已删除，仍注册在 app.json');
else ok('valves 独立页已删除（并入公式集）');
if (appJson.pages.includes('pages/valveana/valveana')) ok('valveana 页已注册（公式集内条目）');
else bad('valveana 页缺失');
['valve-data.js', 'valve-calc.js'].forEach(f => {
  if (fs.existsSync(path.join(MP, 'utils', f))) ok(f + ' 存在');
  else bad(f + ' 缺失');
});
if (appJson.tabBar.list.length <= 5) ok('tabBar 条目 ' + appJson.tabBar.list.length + ' 个（微信上限 5）');
else bad('tabBar 条目超过微信上限 5 个');
const valveData = require(path.join(MP, 'utils', 'valve-data.js'));
const ids = valveData.VALVE_SECTIONS.map(s => s.id).join(',');
if (ids === 'as,ar,ms,mr,tr') ok('瓣膜分区 = as,ar,ms,mr,tr');
else bad('瓣膜分区异常: ' + ids);
const emptyBlocks = valveData.VALVE_SECTIONS.filter(s => !s.blocks.length || !s.fields.length);
if (emptyBlocks.length === 0) ok('五节均含分级内容与计算字段');
else bad('以下瓣膜缺少内容: ' + emptyBlocks.map(s => s.id).join(','));
const calcJs = fs.readFileSync(path.join(MP, 'pages/calculators/calculators.js'), 'utf8');
['主动脉瓣口面积 AVA', '二尖瓣口面积 MVA', 'PISA · EROA'].forEach(t => {
  if (calcJs.indexOf(t) === -1) ok('瓣膜计算已从公式集目录页移出：「' + t + '」');
  else bad('瓣膜计算仍在公式集目录页重复：' + t);
});

console.log('\n=== 4d. 公式集（目录 + 详情页） ===');
if (appJson.pages.includes('pages/formula/formula')) ok('formula 详情页已注册');
else bad('formula 详情页未注册');
if (appJson.pages.includes('pages/video/video')) ok('video 站内播放页已注册');
else bad('video 播放页未注册');
if (appJson.pages.includes('pages/album/album')) ok('album 专辑二级页已注册');
else bad('album 专辑页未注册');
const albJs = fs.readFileSync(path.join(MP, 'pages/album/album.js'), 'utf8');
if (albJs.indexOf("'/pages/video/video?sec='") !== -1 && albJs.indexOf('&kid=') !== -1 &&
    albJs.indexOf('children') !== -1)
  ok('专辑页按 children 列出切面，跳播放页用 id 传参（v1.9.0 起不再拼 URL）');
else bad('专辑页未接入视频列表');
if (albJs.indexOf('onKw') !== -1 && albJs.indexOf('onChip') !== -1 && albJs.indexOf('rebuild') !== -1)
  ok('专辑页带搜索过滤（onKw / rebuild）与专题导航（onChip）');
else bad('专辑页缺搜索或导航');
const vidJs = fs.readFileSync(path.join(MP, 'pages/video/video.js'), 'utf8');
if (vidJs.indexOf('.mp4') !== -1 && /findEntry\(/.test(vidJs) && vidJs.indexOf('hint') !== -1)
  ok('video 页按 id 取地址、仅接受 https 的 mp4，非 mp4 给复制提示');
else bad('video 页未校验视频地址');
const calcJs2 = fs.readFileSync(path.join(MP, 'pages/calculators/calculators.js'), 'utf8');
if (calcJs2.indexOf("'/pages/video/video?sec='") !== -1) ok('目录点击 mp4 条目跳转站内播放页（id 传参）');
else bad('目录未接入站内播放页');
const segJs2 = fs.readFileSync(path.join(MP, 'pages/segments/segments.js'), 'utf8');
if (segJs2.indexOf("'/pages/video/video?sec='") !== -1) ok('切面学习页点击视频跳站内播放页（id 传参）');
else bad('切面学习页未用 id 传参');
const tabCalc = appJson.tabBar.list.find(t => t.pagePath === 'pages/calculators/calculators');
if (tabCalc && tabCalc.text === '公式集') ok('tabBar 页签名 = 公式集');
else bad('tabBar 公式集页签名异常: ' + (tabCalc && tabCalc.text));
const cgPath = path.join(MP, 'utils', 'calc-groups.js');
if (fs.existsSync(cgPath)) ok('calc-groups.js 定义文件存在');
else bad('calc-groups.js 缺失');
const CG = require(cgPath);
// ★ v1.8.3：partOnly 的条目只作为合并页里的小节存在，不进目录
const VIS_GROUPS = CG.GROUPS.filter(g => !g.partOnly);
if (VIS_GROUPS.length === 42) ok('公式集定义 42 组（' + VIS_GROUPS.map(g => g.id).join('/') + '）');
else bad('公式集分组数异常: ' + VIS_GROUPS.length + '（含 partOnly 共 ' + CG.GROUPS.length + '）');
// 计算条目按 6 个分组归类，每条必须有 sec 且落在 CALC_SECTIONS 内
const calcSecIds = (CG.CALC_SECTIONS || []).map(s => s.id);
if (calcSecIds.join('/') === 'hemo/right/recon')
  ok('计算组 3 个（血流动力学·舒张 / 右心肺循环 / 重构·室壁运动·心肌）——「介入尺寸·先心·随访」组已拆散');
else bad('CALC_SECTIONS 异常: ' + calcSecIds.join('/'));
// v1.5.3：计算器可以直接挂在评估组上，与判读条目同组（不再单起「介入尺寸」组）
const BRIEF_SEC_IDS = ['valve', 'chd', 'chamber'];
const badSec = CG.GROUPS.filter(g => calcSecIds.indexOf(g.sec || 'hemo') === -1 && BRIEF_SEC_IDS.indexOf(g.sec) === -1);
if (!badSec.length) ok('48 条公式的 sec 归属均合法（含并入评估组的 valve / chd / chamber）');
else bad('sec 归属异常: ' + badSec.map(g => g.id).join(','));
const nHemo = VIS_GROUPS.filter(g => (g.sec || 'hemo') === 'hemo').length;
const nRight = VIS_GROUPS.filter(g => g.sec === 'right').length;
const nValveCalc = VIS_GROUPS.filter(g => g.sec === 'valve').length;
const nRecon = VIS_GROUPS.filter(g => g.sec === 'recon').length;
const nChdCalc = VIS_GROUPS.filter(g => g.sec === 'chd').length;
const nChamCalc = VIS_GROUPS.filter(g => g.sec === 'chamber').length;
if (nHemo === 13 && nRight === 6 && nRecon === 13 && nValveCalc === 4 && nChdCalc === 4 && nChamCalc === 2)
  ok('分组条目数 13 / 6 / 13 + 瓣膜 4 + 先心 4 + 心腔 2（合计 42，v1.8.3 三组合并）');
else bad('分组条目数异常: ' + [nHemo, nRight, nRecon, nValveCalc, nChdCalc, nChamCalc].join('/'));
// 网页端 calcVal 是全局共享对象，字段键必须跨条目唯一；
// 例外：ld / lvti 是「LVOT 直径 / VTI」的同义字段，flow 与 shunt 有意共用同一输入
const SHARED_KEYS = { ld: 1, lvti: 1 };
const dupField = [];
const seen = {};
VIS_GROUPS.forEach(g => g.fields.forEach(f => {
  if (!f.k) return;   // 合并页的分段标题 { g: '① …' }
  if (seen[f.k] && !SHARED_KEYS[f.k]) dupField.push(f.k);
  seen[f.k] = 1;
}));
if (!dupField.length) ok(VIS_GROUPS.length + ' 条公式的输入键全局唯一（除有意共享的 ld / lvti / tapse / paspv）');
else bad('输入键冲突: ' + dupField.join(','));
const badGroups = VIS_GROUPS.filter(g => !g.id || !g.title || !g.fields.length || !g.note);
if (badGroups.length === 0) ok('各组均含 id/标题/字段/备注');
else bad('以下组定义不完整: ' + badGroups.map(g => g.id || '?').join(','));
const dupIds = CG.GROUPS.map(g => g.id).filter((v, i, a) => a.indexOf(v) !== i);
if (dupIds.length === 0) ok('组 id 无重复');
else bad('组 id 重复: ' + dupIds.join(','));
const calcWxml = fs.readFileSync(path.join(MP, 'pages/calculators/calculators.wxml'), 'utf8');
if (calcWxml.indexOf('bindtap="onOpen"') !== -1) ok('目录条目已绑定 onOpen 跳转');
else bad('目录条目未绑定 onOpen');
['TR 三尖瓣反流定量', '人工瓣 EOAi 与 PPM'].forEach(t => {
  if (calcWxml.indexOf(t) === -1 && calcJs.indexOf(t) !== -1) ok('瓣膜条目在目录数据中：「' + t + '」');
  else if (calcJs.indexOf(t) !== -1) ok('瓣膜条目在目录数据中：「' + t + '」');
  else if (fs.readFileSync(cgPath, 'utf8').indexOf(t) !== -1) ok('瓣膜条目在 calc-groups 中：「' + t + '」');
  else bad('目录缺少瓣膜条目：' + t);
});
const anaJs = fs.readFileSync(path.join(MP, 'pages/valveana/valveana.js'), 'utf8');
if (/VS\.probeOf/.test(anaJs)) ok('瓣膜解剖页渲染探头位置小图');
else bad('瓣膜页未支持 ?tab= 预选参数');
console.log('\n=== 4e. 公式集扩展：评估类内容 / 参考文献 / 版本号 ===');
const exPath = path.join(MP, 'utils', 'extra-data.js');
if (fs.existsSync(exPath)) ok('extra-data.js 存在');
else bad('extra-data.js 缺失');
const EX = require(exPath);
if (EX.BRIEF_SECTIONS.length === 5) ok('评估内容 5 个分组（切面图像与质控 / 心腔心肌与应变 / 瓣膜 / 先心含术后 / 急症与特殊场景）');
else bad('评估内容分组数异常: ' + EX.BRIEF_SECTIONS.length);
const briefIds = EX.BRIEF_SECTIONS.reduce((a, s2) => a.concat(s2.items.map(i => i.id)), []);
if (briefIds.join(',') === 'tee-20,tte-std,tee-safety,artifact-guide,mimic,contrast-echo,3d-tee,report-std,critical,doppler-basics,echo-interv,tte-measure,lv,rv,rvfun,strain,la-strain,peri,cp-rm,ctrcd,zh-normal,mass,stress-echo,dse,hcm,infiltr,dcm,athlete,arvc,myocarditis,sarcoid,crt,la,mitral,aortic,asload,bav,ie,aortic-root,rheumatic,tr-interv,mv-interv,tavr,prosthetic,shd,pht-rev,tof-pr,ebstein,dorv,asd-close,bubble,coa-echo,mustard,fontan,as-switch,aorta,pe,thrombus,zh-ph,ami-comp,takotsubo,osa,myowork,ecmo,pregnancy-echo,ppcm,sepsis,postop-icu,lung-us,lvad') ok('评估条目 = 70 条（5 个分组）');
else bad('评估条目异常: ' + briefIds.join(','));
// 瓣膜评估组必须合并，不能再单独出现「瓣膜疾病评估」组
const valveSec = EX.BRIEF_SECTIONS.filter(i => i.id === 'valve')[0];
if (valveSec && valveSec.mergeInto === 'valve') ok('瓣膜评估组已合并（mergeInto=valve），无重复分组');
else bad('瓣膜评估组未合并: ' + (valveSec ? valveSec.mergeInto : 'missing'));
const briefBad = EX.BRIEF_SECTIONS.some(sec => sec.items.some(it =>
  !it.title || !it.sub || !it.blocks || !it.blocks.length || !it.source));
if (!briefBad) ok('每条评估内容含标题/说明/内容块/引用编号');
else bad('评估内容定义不完整');
// 加粗标记必须成对：奇数个 ** 会让正文把字面量 ** 显示出来（用户 2026-10-21 / 10-22 两次反馈）
const mdBalanced = (function () {
  let badCell = '';
  EX.BRIEF_SECTIONS.forEach(sec => sec.items.forEach(it => (it.blocks || []).forEach((b, i) => {
    const chk = (s) => {
      if (badCell) return;
      if (typeof s === 'string' && (s.match(/\*\*/g) || []).length % 2) {
        badCell = sec.id + '/' + it.id + ' 第 ' + (i + 1) + ' 块';
      }
    };
    if (b.text) chk(b.text);
    if (b.heads) b.heads.forEach(chk);
    if (b.rows) b.rows.forEach(r => r.forEach(chk));
  })));
  return badCell;
})();
if (!mdBalanced) ok('全部评估内容的 ** 加粗标记成对（不会漏出字面量）');
else bad('存在未闭合的 ** 加粗标记：' + mdBalanced);
const srcBad = EX.BRIEF_SECTIONS.some(sec => sec.items.some(it =>
  it.source.some(rid => !EX.REFS.filter(r => r.id === rid).length)));
if (!srcBad) ok('评估内容的引用编号均能在 REFS 中找到');
else bad('存在悬空的引用编号');
if (EX.REFS.length === 83) ok('参考文献 83 条（新增 R81 2025 ESC/EACTS 瓣膜病指南、R82 2025 中国 LVAD 围术期超声指南、R83 2025 中国儿童冠脉 TTE 共识）');
else bad('参考文献条数异常: ' + EX.REFS.length);
// 文献直链：优先挂官方/免费可直连的 PDF；没有免费版的挂官方需订阅地址（DOI / 期刊页）并标注
const dlAll = EX.REFS.reduce((a, r) => a.concat(r.dl || []), []);
if (dlAll.length >= 80) ok('文献直链 ' + dlAll.length + ' 条（官方 PDF / 免费全文 / 需订阅地址）');
else bad('文献直链过少: ' + dlAll.length);
if (dlAll.every(d => String(d.u).indexOf('https://') === 0 && /PDF|全文|需订阅|官网|免费页面/.test(d.t)))
  ok('每条直链含 https 地址与类型标注');
else bad('存在不合规的文献直链');
const subDl = dlAll.filter(d => d.t === '需订阅');
if (subDl.length >= 5 && subDl.length <= 12 &&
    subDl.every(d => /^https:\/\/doi\.org\/10\.|^https:\/\/rs\.yiigle\.com\/cmaid\//.test(d.u)))
  ok('需订阅地址 ' + subDl.length + ' 条均为 DOI 解析页或中华医学期刊网页面（无死链、无自造地址）');
else bad('需订阅地址不合规: ' + subDl.map(d => d.u).join(' '));
// v1.6.6：R75 原来挂中国循环杂志官网首页，点进去站内搜不到这篇文章 → 改挂公开 PDF 全文
const r79 = EX.REFS.filter(r => r.id === 'R75')[0];
if (r79 && (r79.dl || []).length === 1 && r79.dl[0].t === '中文 PDF' &&
    /^https:\/\/.+\.pdf$/.test(r79.dl[0].u))
  ok('R75 挂公开 PDF 全文直链（不再挂官网首页）');
else bad('R75 直链不合规: ' + JSON.stringify(r79 && r79.dl));
if (!dlAll.some(d => /chinacirculation\.org/.test(d.u)))
  ok('已无指向期刊官网首页的无效直链');
else bad('仍挂着搜不到文章的期刊官网首页');
// 能免费拿到的必须标成免费：免费页面 / 免费全文 PDF / PMC 全文 三类合计应远多于需订阅
const freeDl = dlAll.filter(d => d.t !== '需订阅');
if (freeDl.length >= 70)
  ok('免费可获取链接 ' + freeDl.length + ' 条（免费 PDF / PMC / 免费页面 / 中文全文）');
else bad('免费链接过少: ' + freeDl.length);
if (dlAll.filter(d => d.t === '免费页面').length >= 3)
  ok('「免费页面」类型已启用 ' + dlAll.filter(d => d.t === '免费页面').length + ' 条（进页面点 PDF 即可下）');
else bad('缺少「免费页面」类型');
if (EX.REFS.filter(r => (r.dl || []).length).length >= 35)
  ok('带直链的文献 ' + EX.REFS.filter(r => (r.dl || []).length).length + ' 条（≥35）');
else bad('带直链的文献过少');
if (dlAll.filter(d => /asecho\.org\/wp-content\/uploads\/.+\.pdf$/.test(d.u)).length >= 20)
  ok('ASE 官方 PDF 直链 ≥ 20 条');
else bad('ASE 官方 PDF 直链不足');

console.log('\n=== 4f. 切面学习（含操作规范专辑）/ TEE 切面在线演示（纯外链） ===');
console.log('（原「切面指南」4 份 ASE 官方 PDF 已并入参考文献 R9 / R10 / R38）');
if (EX.LINK_SECTIONS && EX.LINK_SECTIONS.length === 2) ok('外链分组 2 个（切面学习 / TEE 切面在线演示）');
else bad('外链分组数异常: ' + (EX.LINK_SECTIONS || []).length);
const linkIds = EX.LINK_SECTIONS.reduce((a, s3) => a.concat(s3.items.map(i => i.id)), []);
if (linkIds.length === 11) ok('外链条目 11 条（切面学习 5 条单链 + 3 个专辑；TEE 演示 3 条）');
else bad('外链条目数异常: ' + linkIds.length);
const linkBad = EX.LINK_SECTIONS.some(sec => sec.items.some(it => {
  if (!it.id || !it.title || !it.sub) return true;
  if (it.album) return !(it.children && it.children.length);
  return String(it.url).indexOf('https://') !== 0;
}));
if (!linkBad) ok('每条外链含 id/标题/说明/https 地址（专辑须含子条目）');
else bad('外链条目定义不完整');
['tee-sv', 'tte-sv', 'tee-cheat', 'sim-toronto', 'sim-ct2tee', 'sim-atlas'].forEach(function (id) {
  if (linkIds.indexOf(id) !== -1) ok('外链条目存在: ' + id);
  else bad('缺少外链条目: ' + id);
});
if (linkIds.indexOf('guide-tte-cn') === -1 && linkIds.indexOf('guide-tee-28') === -1)
  ok('切面指南条目已从外链移除（并入参考文献）');
else bad('切面指南仍留在外链分组里');
['R9', 'R10', 'R38'].forEach(function (rid) {
  const r = EX.REFS.filter(function (x) { return x.id === rid; })[0];
  if (r && (r.dl || []).length && r.dl.some(function (d) { return /\.pdf$/.test(d.u); }))
    ok('切面指南 PDF 已并入文献 ' + rid);
  else bad('文献 ' + rid + ' 缺少切面指南 PDF 直链');
});
const tteItem = EX.LINK_SECTIONS[0].items.filter(function (i) { return i.id === 'tte-sv'; })[0];
if (tteItem && /TTE-HTML5-SV\/index\.html$/.test(tteItem.url)) ok('TTE 经胸切面为直达交互应用链接');
else bad('TTE 经胸切面链接未直达交互应用');
if (EX.LINK_SECTIONS[1].items.length === 3) ok('TEE 切面在线演示仅 3 条');
else bad('TEE 切面在线演示条目数异常: ' + (EX.LINK_SECTIONS[1] ? EX.LINK_SECTIONS[1].items.length : 'missing'));
// 操作规范：整本书收成 1 个专辑，且排在「切面学习（视频）」第一条
const views = EX.LINK_SECTIONS.filter(function (s3) { return s3.id === 'views'; })[0];
const bvAlb = views ? views.items.filter(function (it) { return it.album; })[0] : null;
if (views && bvAlb && views.items[0] === bvAlb) ok('操作规范专辑排在切面学习第一条');
else bad('操作规范专辑不在切面学习第一条');
if (bvAlb && bvAlb.title === '实用超声规范化检查与操作（视频）') ok('专辑标题为「实用超声规范化检查与操作（视频）」');
else bad('专辑标题异常: ' + (bvAlb ? bvAlb.title : 'missing'));
if (bvAlb && bvAlb.children.length === 25) ok('专辑内 25 段（第三章心血管系统 1–25）');
else bad('专辑子条目数异常: ' + (bvAlb ? bvAlb.children.length : 'missing'));
if (bvAlb && bvAlb.children.every(function (it) { return /\.mp4$/.test(it.url) && it.title && it.id; }))
  ok('25 段均为 mp4 直链且含 id / 标题');
else bad('专辑内存在非 mp4 或缺字段的条目');
if (bvAlb && /王辉/.test(bvAlb.note || '') && /978-7-5189-8028-4/.test(bvAlb.note || '')) ok('专辑标注编者与 ISBN');
else bad('专辑缺少书籍出处');
// v1.8.5：心课堂 17 段（微信文章视频无法直链，转 720p 后托管在独立仓库 echo-ref-media 的 Pages）
const ktAlb = views ? views.items.filter(function (it) { return it.id === 'ktvid'; })[0] : null;
if (ktAlb && ktAlb.album && (ktAlb.children || []).length === 17) ok('心课堂视频专辑 17 段');
else bad('心课堂视频专辑异常: ' + (ktAlb ? (ktAlb.children || []).length : 'missing'));
if (ktAlb && ktAlb.children.every(function (it) {
  return /^https://////heiqingyu//.github//.io///echo-ref-media///videos///[//w-]+//.mp4$/.test(it.url) && it.id && it.title && it.sub;
})) ok('17 段均为 echo-ref-media 的 mp4 直链且含 id / 标题 / 说明');
else bad('心课堂视频存在地址异常或缺字段的条目');
if (views && views.items[0].id === 'bookvid' && views.items[1].id === 'ktvid') ok('心课堂专辑排在操作规范专辑之后（未抢占第一条）');
else bad('切面学习视频专辑顺序异常: ' + (views ? views.items.slice(0, 3).map(function (x) { return x.id; }).join(',') : 'missing'));
// v1.9.0：飞利浦云课堂心脏类目全部课程（151 段，按 8 个专题分组；原 152，去掉平台重复收录的 PISA）
const phAlb = views ? views.items.filter(function (it) { return it.id === 'philips'; })[0] : null;
const phKids = (phAlb && phAlb.children) || [];
const phReal = phKids.filter(function (c) { return !c.g; });
const phGroups = phKids.filter(function (c) { return !!c.g; });
if (phAlb && phAlb.album && phReal.length === 151) ok('飞利浦云课堂专辑 151 段');
else bad('飞利浦专辑段数异常: ' + phReal.length);
if (phGroups.length === 8) ok('飞利浦专辑按 8 个专题分组（组标题不计入段数）');
else bad('飞利浦专辑分组数异常: ' + phGroups.length);
if (phReal.every(function (c) { return c.id && c.title && c.sub && /^https:\/\//.test(c.url); }))
  ok('151 段均含 id / 标题 / 说明 / https 地址');
else bad('飞利浦专辑存在缺字段的条目');
if (new Set(phReal.map(function (c) { return c.id; })).size === 151) ok('飞利浦专辑 id 无重复');
else bad('飞利浦专辑 id 有重复');
const phMp4 = phReal.filter(function (c) { return /\.mp4$/.test(c.url); }).length;
if (phMp4 === 148) ok('148 段为 mp4 直链，3 段 HLS 指向官方详情页');
else bad('飞利浦专辑可播条目数异常: ' + phMp4);
// v1.9.0：平台把同一场讲座挂在两个类目下重复收录，曾出现两条 PISA（ph-108 / ph-112）
const phSameTitle = {};
phReal.forEach(function (c) {
  const k = (c.title || '').replace(/[\s（）()·、,，]/g, '') + '|' + (c.sub || '').slice(0, 10);
  phSameTitle[k] = (phSameTitle[k] || 0) + 1;
});
const phDup = Object.keys(phSameTitle).filter(function (k) { return phSameTitle[k] > 1; });
if (!phDup.length) ok('飞利浦专辑无同题重复条目（PISA 只留讲座那条）');
else bad('飞利浦专辑有重复条目: ' + phDup.join(' / '));
if (!phReal.some(function (c) { return c.id === 'ph-112'; })) ok('重复的 ph-112 已删除');
else bad('ph-112 仍在专辑里');

const phPisa = phReal.filter(function (c) { return c.id === 'ph-108'; })[0];
// v1.9.1：全平台不再转存，PISA 也回飞利浦 OSS 原片（自托管 GitHub Pages 实测更卡）
if (phPisa && phPisa.url === 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/2026.3.23%20PISA%E5%8E%9F%E7%90%86%EF%BC%8C%E8%AF%AF%E5%8C%BA%E5%8F%8A%E5%BA%94%E7%94%A8-%E5%BE%90%E5%AD%90%E7%89%B9.mp4')
  ok('PISA 讲座指向飞利浦 OSS 原片（不转存）');
else if (phPisa && phPisa.url.indexOf('https://philips-idp.oss-cn-shanghai.aliyuncs.com/') === 0)
  ok('PISA 讲座指向飞利浦 OSS 原片（不转存）');
else bad('PISA 条目地址异常: ' + (phPisa ? phPisa.url : 'missing'));
if (phAlb && (phAlb.links || []).length === 1 && /app\.ma\.scrmtech\.com/.test(phAlb.links[0].url))
  ok('飞利浦专辑标注云课堂全部课程入口');
else bad('飞利浦专辑缺少云课堂入口');
// v1.8.5：视频专辑必须给出公众号原文出处（视频是转存的，原文才是第一手）
const ktLk = ktAlb && (ktAlb.links || []);
if (ktLk && ktLk.length === 2 && ktLk.every(function (l) {
  return l.n && /^https://////mp//.weixin//.qq//.com///s///[//w-]+$/.test(l.url);
})) ok('心课堂专辑标注公众号原文出处（上 / 下篇）');
else bad('心课堂专辑缺少公众号原文链接: ' + JSON.stringify(ktAlb ? (ktAlb.links || null) : null));
const extSrc = fs.readFileSync(path.join(MP, 'pages/calculators/calculators.js'), 'utf8');
if (extSrc.indexOf('EX.LINK_SECTIONS') !== -1) ok('目录页已接入 LINK_SECTIONS（搜索 / 专辑子条目仍复用）');
else bad('目录页未接入 LINK_SECTIONS');
// v1.6.3：专辑入口从公式集目录迁到「切面学习」页签，kind: album 的渲染逻辑随之移到 segments.js
const segSrc3 = fs.readFileSync(path.join(MP, 'pages/segments', 'segments.js'), 'utf8');
if (segSrc3.indexOf("kind: 'album'") !== -1) ok('切面学习页把专辑渲染为单条入口（kind: album）');
else bad('切面学习页未把专辑收成单条入口');
// v1.6.4：切面速查 / 标准切面条目打 segOnly 标记 → 只在「切面学习」页签列出，不进公式集目录
const segOnlyIds = [];
EX.BRIEF_SECTIONS.forEach(function (s3) {
  (s3.items || []).forEach(function (it) { if (it.segOnly) segOnlyIds.push(it.id); });
});
if (segOnlyIds.join(',') === 'tee-20,tte-std,tte-measure') ok('切面速查 3 条打上 segOnly 标记（tee-20 / tte-std / tte-measure）');
else bad('segOnly 标记异常: ' + (segOnlyIds.join(',') || '无'));
if (segSrc3.indexOf('segOnly') !== -1) ok('切面学习页按 segOnly 装配速查列表（标题只维护一份）');
else bad('切面学习页未按 segOnly 装配速查列表');
const appSrc4 = fs.readFileSync(path.join(ROOT, 'android-app', 'app.js'), 'utf8');
if (appSrc4.indexOf('viewOriginTab') !== -1 && appSrc4.indexOf('function leaveView') !== -1)
  ok('网页 / APK：从切面学习进详情后返回会切回原页签（leaveView）');
else bad('缺少「返回时切回来源页签」逻辑（viewOriginTab / leaveView）');
if (/onSearch\s*\(/.test(extSrc) && /bindinput="onSearch"/.test(
  fs.readFileSync(path.join(MP, 'pages/calculators/calculators.wxml'), 'utf8')))
  ok('公式集目录带搜索框（输入即筛）');
else bad('公式集目录缺少搜索框');
const calcWxml3 = fs.readFileSync(path.join(MP, 'pages/calculators/calculators.wxml'), 'utf8');
if (calcWxml3.indexOf('data-url="{{it.url}}"') !== -1) ok('目录条目透传 url（小程序内复制链接）');
else bad('目录条目未透传 url');

// ★ v1.8.3：网页的 CALC_GROUPS 是独立副本、条目上没有 sub 字段，
//   目录副标题全靠 app.js 的 CALC_SUB 表；而小程序读 calc-groups.js 的 sub。
//   两处一旦分叉，同一台计算器在网页与小程序会显示不同说明 —— 必须逐字比对。
{
  const subBlk = (appSrc4.match(/const CALC_SUB = \{([\s\S]*?)\n  \};/) || [])[1] || '';
  const webSub = {};
  subBlk.split('\n').forEach((l) => {
    const m = l.match(/^\s{4}'?([a-zA-Z0-9-]+)'?:\s*'([^']*)'/);
    if (m) webSub[m[1]] = m[2];
  });
  const visGroups = CG.GROUPS.filter((g) => !g.partOnly);
  const drift = visGroups.filter((g) => webSub[g.id] !== (g.sub || '')).map((g) => g.id);
  if (drift.length === 0) ok('副标题两端逐字一致（网页 CALC_SUB ↔ calc-groups.sub，' + visGroups.length + ' 条）');
  else bad('副标题两端不一致: ' + drift.join(','));
}

const idxWxml2 = fs.readFileSync(path.join(MP, 'pages/index/index.wxml'), 'utf8');
const idxWxss2 = fs.readFileSync(path.join(MP, 'pages/index/index.wxss'), 'utf8');
if (idxWxml2.indexOf('延展阅读') === -1 && idxWxss2.indexOf('.extlink') === -1) ok('首页已移除延展阅读（已搬至公式集页）');
else bad('首页仍含延展阅读');

const tabList2 = appJson.tabBar.list;
if (tabList2[tabList2.length - 1].pagePath === 'pages/calculators/calculators') ok('公式集排在 tabBar 最后');
else bad('公式集未排在最后: ' + tabList2[tabList2.length - 1].text);

// 版本号三处一致
const VD = require(path.join(MP, 'utils/version.js'));
const vfRaw = fs.readFileSync(path.join(ROOT, 'android-app', 'VERSION'), 'utf8');
const vName = vfRaw.split('\n')[0].trim();
const vCode = parseInt(vfRaw.split('\n')[1].trim(), 10);
if (VD.APP_VERSION === vName) ok('版本号一致: ' + vName);
else bad('版本号不一致: 小程序 ' + VD.APP_VERSION + ' / APK ' + vName);
if (vCode > 1) ok('APK versionCode 已递增: ' + vCode);
else bad('APK versionCode 未递增');
if (/versionCode=/.test(fs.readFileSync(path.join(ROOT, 'android-app/AndroidManifest.xml'), 'utf8'))) ok('AndroidManifest 含 versionCode');
else bad('AndroidManifest 缺 versionCode');

const formulaJs = fs.readFileSync(path.join(MP, 'pages/formula/formula.js'), 'utf8');
['flow', 'shunt', 'bernoulli', 'atrial', 'dfun', 'sync', 'mpap'].forEach(id => {
  if (formulaJs.indexOf("gid === '" + id + "'") !== -1) ok('formula 页含计算分支: ' + id);
  else bad('formula 页缺少计算分支: ' + id);
});

console.log('\n=== 5. WXML 中引用的方法在 JS 中已定义 ===');
const handlerPat = /bind(?:tap|input|change|confirm)="([^"]+)"/g;
for (const pg of appJson.pages) {
  const wxml = fs.readFileSync(path.join(MP, pg + '.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(MP, pg + '.js'), 'utf8');
  const handlers = new Set();
  let m;
  while ((m = handlerPat.exec(wxml)) !== null) handlers.add(m[1]);
  const missing = [...handlers].filter(h => !new RegExp(h + '\\s*\\(').test(js));
  if (missing.length === 0) ok(pg + '  (' + handlers.size + ' 个事件处理器均已定义)');
  else bad(pg + ' 缺少事件处理器: ' + missing.join(', '));
}

console.log('\n=== 6. WXML 标签配对检查 ===');
const SELF_CLOSE = new Set(['input', 'image', 'icon', 'progress', 'import', 'include', 'wxs', 'slot', 'br', 'hr']);
for (const pg of appJson.pages) {
  const wxml = fs.readFileSync(path.join(MP, pg + '.wxml'), 'utf8');
  const stack = [];
  let err = null;
  const tagPat = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  let t;
  while ((t = tagPat.exec(wxml)) !== null) {
    const [, closing, name, , selfClose] = t;
    if (selfClose || SELF_CLOSE.has(name)) continue;
    if (closing) {
      if (stack.length === 0 || stack[stack.length - 1] !== name) {
        err = `意外的 </${name}>，栈顶为 <${stack[stack.length - 1] || '空'}>`;
        break;
      }
      stack.pop();
    } else {
      stack.push(name);
    }
  }
  if (err) bad(pg + ' → ' + err);
  else if (stack.length) bad(pg + ' 未闭合标签: ' + stack.join(', '));
  else ok(pg + ' 标签配对正确');
}

console.log('\n=== 7. ASE 标准端到端（含单位换算）===');
// 先做基础计算（后续两节共用）
const profile = { sex: 'male', height: 170, weight: 65, bsa: core.round(core.bsaDuBois(170, 65), 3) };
const lvedd = 50, lvesd = 32, ivsd = 9, lvpwd = 9;
const fn = core.computeLVFunction(lvedd, lvesd);
const lvm = core.computeLVM(lvedd, ivsd, lvpwd, profile.bsa);
const rwt = core.computeRWT(lvedd, lvpwd);

// 用同一组测量值走 ASE 标准，验证单位换算后判定正确
const aseRows = core.buildReferenceList('male', {
  LVEDD: lvedd,      // 50 mm
  IVSd: ivsd,        // 9 mm
  LVPWd: lvpwd,      // 9 mm
  LVEDV: fn.EDV,     // 118.2 mL
  LVESV: fn.ESV,     // 41 mL
  EF: fn.EF,         // 65.4 %
  LVM: lvm.LVM,      // 158.2 g
  'LVM/BSA': lvm['LVM/BSA'],
}, 'ASE');
console.log('  ASE 男性对照（关键几项）：');
for (const r of aseRows.filter(r => r.hasValue)) {
  console.log(`    ${r.name.padEnd(16, '　')} ${r.value.padStart(7)}${(r.unit||'').padEnd(6,' ')} 参考 ${r.range.padEnd(14)} [${r.statusText}]`);
}
const chk = (key) => aseRows.find(r => r.key === key);
(chk('LVEDD').status === 'normal')
  ? ok('LVEDD 50mm → 正常（修复前误判重度）') : bad('LVEDD 判定错误: ' + chk('LVEDD').statusText);
(chk('IVSd').status === 'normal')
  ? ok('IVSd 9mm → 正常（cm→mm 换算正确）') : bad('IVSd 判定错误: ' + chk('IVSd').statusText);
(chk('EF').status === 'normal')
  ? ok('EF 65.4% → 正常') : bad('EF 判定错误: ' + chk('EF').statusText);
(chk('LVEDV').status === 'normal')
  ? ok('LVEDV 118.2mL → 正常（容积不换算）') : bad('LVEDV 判定错误: ' + chk('LVEDV').statusText);
(chk('LVM').status === 'normal')
  ? ok('LVM 158.2g → 正常') : bad('LVM 判定错误: ' + chk('LVM').statusText);

// ASE 参数数量
(aseRows.length === core.ASE_FIELDS.length)
  ? ok('ASE 参数项数 = ' + aseRows.length)
  : bad('ASE 项数不符: ' + aseRows.length + ' vs ' + core.ASE_FIELDS.length);
(aseRows.length >= 20)
  ? ok('ASE 参数已扩充至 ' + aseRows.length + ' 项') : bad('ASE 参数过少: ' + aseRows.length);

// 所有 ASE 项都必须有有效参考区间
const noRange = aseRows.filter(r => !r.range || r.range.indexOf('—') === 0);
(noRange.length === 0)
  ? ok('所有 ASE 项参考区间完整') : bad('缺参考区间: ' + noRange.map(r => r.key).join(', '));

// 每个 ASE 参数都必须登记原生单位（否则换算会缺失）
const noUnit = core.ASE_FIELDS.filter(k => !core.PARAM_UNIT_ASE[k]);
(noUnit.length === 0)
  ? ok('所有 ASE 参数均已登记原生单位') : bad('未登记原生单位: ' + noUnit.join(', '));

// BSA 联动：切换 BSA 时指数参数的折算范围必须变化
const bsaA = core.buildReferenceList('male', {}, 'ASE', 1.50).find(r => r.key === 'LVEDD/BSA');
const bsaB = core.buildReferenceList('male', {}, 'ASE', 2.00).find(r => r.key === 'LVEDD/BSA');
(bsaA.derivedText !== bsaB.derivedText)
  ? ok(`BSA 联动生效：1.50→${bsaA.derivedText}mm，2.00→${bsaB.derivedText}mm`)
  : bad('BSA 切换时指数参数未联动（两者都是 ' + bsaA.derivedText + '）');
(bsaA.derivedText === '33–47' && bsaB.derivedText === '44–62')
  ? ok('BSA 折算数值与手算一致') : bad('BSA 折算数值异常');
// 反算依据必须是 BSA（不是身高）
const derivedCount = core.buildReferenceList('male', {}, 'ASE', 1.75)
  .filter(r => r.hasDerived).length;
(derivedCount === 5)
  ? ok('共 5 个指数参数参与 BSA 联动') : bad('联动参数数异常: ' + derivedCount);

console.log('\n=== 8. 模拟页面数据流 ===');

// --- index 页：BSA 计算 ---
(profile.bsa > 1.74 && profile.bsa < 1.76) ? ok('index: BSA = ' + profile.bsa) : bad('index: BSA 异常 ' + profile.bsa);

// --- ef 页：计算并写回 ---
const grade = core.gradeEF(fn.EF);
(fn.EDV === 118.2) ? ok('ef: EDV = ' + fn.EDV) : bad('ef: EDV 异常 ' + fn.EDV);
(fn.EF === 65.4) ? ok('ef: EF = ' + fn.EF + '% → ' + grade.text) : bad('ef: EF 异常 ' + fn.EF);
(rwt === 0.36) ? ok('ef: RWT = ' + rwt) : bad('ef: RWT 异常 ' + rwt);
(lvm.LVM === 158.2) ? ok('ef: LVM = ' + lvm.LVM + ' g') : bad('ef: LVM 异常 ' + lvm.LVM);
// 注意：指数基于真实 Du Bois BSA（1.7536），非凑整的 1.75
// 158.2 / 1.7536 ≈ 90.2（程序内部先舍入 LVM 再算指数，与界面显示一致）
const expectLvmBsa = Math.round((158.2 / core.bsaDuBois(170, 65)) * 10) / 10;
(lvm['LVM/BSA'] === expectLvmBsa)
  ? ok('ef: LVM/BSA = ' + lvm['LVM/BSA'] + '（基于真实 BSA ' + core.bsaDuBois(170, 65).toFixed(3) + '）')
  : bad('ef: LVM/BSA 异常 ' + lvm['LVM/BSA'] + '，期望 ' + expectLvmBsa);
// 交叉验证：界面显示值手算应等于程序输出
const handCalc = Math.round((Number(lvm.LVM.toFixed(1)) / Number(profile.bsa.toFixed(3))) * 10) / 10;
(lvm['LVM/BSA'] === handCalc)
  ? ok('ef: 指数与「显示值手算」一致 (' + handCalc + ')')
  : bad('ef: 指数与手算不一致，程序 ' + lvm['LVM/BSA'] + ' vs 手算 ' + handCalc);

// --- reference 页：由测量值生成对照表 ---
const measurements = { lvedd, lvesd, ivsd, lvpwd, EF: fn.EF };
const dict = core.measurementsToRefDict({
  lvedd: measurements.lvedd, lvesd: measurements.lvesd,
  ivsd: measurements.ivsd, lvpwd: measurements.lvpwd,
  bsa: profile.bsa, height: profile.height,
});
const rows = core.buildReferenceList(profile.sex, dict, 'CN');
(rows.length === 64) ? ok('reference: CN 列表 64 项') : bad('reference: CN 列表 ' + rows.length + ' 项');
const efRow = rows.find(r => r.key === 'LVEF');
(efRow && efRow.status === 'normal') ? ok('reference: LVEF 65.4 → 正常') : bad('reference: LVEF 判定异常');
const lvmRow = rows.find(r => r.key === 'LVM');
(lvmRow && lvmRow.value === '158.2') ? ok('reference: LVM 联动显示 ' + lvmRow.value) : bad('reference: LVM 未联动');
const ivsRow = rows.find(r => r.key === 'IVSd');
(ivsRow && ivsRow.status === 'normal') ? ok('reference: IVSd 9 → 正常') : bad('reference: IVSd 判定异常');

// --- ASE 标准切换（用界面单位 mm）---
const aseF = core.buildReferenceList('female', { LVEDD: 50, EF: 60 }, 'ASE');
(aseF.length === core.ASE_FIELDS.length) ? ok('reference: ASE 列表 ' + aseF.length + ' 项') : bad('reference: ASE 列表 ' + aseF.length + ' 项');
const aseEf = aseF.find(r => r.key === 'EF');
(aseEf && aseEf.status === 'normal') ? ok('reference: ASE EF 60 → 正常') : bad('reference: ASE EF 判定异常');
const aseEddF = aseF.find(r => r.key === 'LVEDD');
(aseEddF && aseEddF.status === 'normal') ? ok('reference: ASE 女性 LVEDD 50mm → 正常') : bad('reference: ASE LVEDD 判定异常');

// --- 边界：女性 ASE LVEDD 54mm（对应指南 5.4cm）应判轻度 ---
const b1 = core.buildReferenceList('female', { LVEDD: 54 }, 'ASE').find(r => r.key === 'LVEDD');
(b1 && b1.status === 'mild') ? ok('reference: 边界 女性 LVEDD 54mm → 轻度') : bad('reference: 边界判定异常: ' + (b1 && b1.statusText));

// --- 异常输入不应崩溃 ---
const hostile = core.buildReferenceList('male', { LVEDD: 0, LVEF: null, LVESV: undefined }, 'CN');
(hostile.length === core.CN_FIELDS.length) ? ok('reference: 含空值/0 输入不崩溃') : bad('reference: 异常输入处理失败');
const hostileAse = core.buildReferenceList('male', { LVEDD: 0, EF: null }, 'ASE');
(hostileAse.length === core.ASE_FIELDS.length) ? ok('reference: ASE 含空值输入不崩溃') : bad('reference: ASE 异常输入处理失败');

console.log('\n=== 9. 儿童 Z 值页 —— 端到端 ===');

const peds = require(path.join(MP, 'utils', 'peds-zscore.js'));

// 9.1 儿科页已被 app.json 注册且四件套齐全（第 3 节已覆盖，这里确认 tab 顺序）
const pedsTab = appJson.tabBar.list.find(t => t.pagePath === 'pages/pediatric/pediatric');
pedsTab ? ok('tabBar 已注册「儿童 Z 值」') : bad('tabBar 未注册儿童页');
(appJson.tabBar.list.length === 4) ? ok('tabBar 共 4 个页签（EF 已并入参考值页）') : bad('tabBar 页签数异常: ' + appJson.tabBar.list.length);

// 9.2 儿科页 JS 必须引用 peds 引擎
const pedsJs = fs.readFileSync(path.join(MP, 'pages/pediatric/pediatric.js'), 'utf8');
/peds-zscore/.test(pedsJs)
  ? ok('儿童页已引入 peds-zscore 引擎') : bad('儿童页未引入 peds-zscore');

// 9.3 1 岁幼儿（75cm/9.5kg）：LVEDD 38mm 应判显著增大
const pBsa = peds.bsaHaycock(75, 9.5);
(pBsa > 0.4508 && pBsa < 0.4509) ? ok('Haycock BSA(75,9.5) = ' + pBsa.toFixed(6)) : bad('Haycock BSA 异常 ' + pBsa);

const pRows = peds.buildPedsList(pBsa, { LVEDD: 38, LVESD: 25, LVM: 20 });
(pRows.length === peds.PEDS_FIELDS.length)
  ? ok('儿童列表项数 = ' + pRows.length) : bad('儿童列表项数 ' + pRows.length);

const pLvedd = pRows.find(r => r.key === 'LVEDD');
(pLvedd.unit === 'mm') ? ok('LVEDD 显示单位 mm') : bad('LVEDD 单位异常: ' + pLvedd.unit);
(pLvedd.status === 'severe') ? ok('LVEDD 38mm（1 岁）→ 显著增大') : bad('LVEDD 判定异常: ' + pLvedd.statusText);
(pLvedd.z > 4 && pLvedd.z < 5) ? ok('LVEDD Z = ' + pLvedd.z + '（落在合理区间）') : bad('LVEDD Z 异常 ' + pLvedd.z);

// 9.4 长度类必须做 mm→cm 换算：若漏掉，Z 会飞到 ~100
(Math.abs(pLvedd.z) < 20) ? ok('长度类已换算 mm→cm（Z 未爆炸）') : bad('长度类未换算，Z = ' + pLvedd.z);

// 9.5 均值附近应判正常
const pNorm = peds.buildPedsList(pBsa, { LVEDD: 27.2 });  // 均值 2.718cm ≈ 27.2mm
const pNormRow = pNorm.find(r => r.key === 'LVEDD');
(pNormRow.status === 'normal') ? ok('LVEDD 均值处 → 正常 (Z=' + pNormRow.zText + ')')
  : bad('均值处判定异常: ' + pNormRow.statusText + ' Z=' + pNormRow.zText);

// 9.6 分组完整性：33 项 PHN + 4 项中国汉族儿童 + 3 项 Kampmann = 40 项、10 组
const pGrouped = peds.buildPedsGrouped(pBsa, { LVEDD: 38 });
(pGrouped.length === 10) ? ok('分组数 10') : bad('分组数异常 ' + pGrouped.length);
const pTotal = pGrouped.reduce((n, g) => n + g.rows.length, 0);
(pTotal === peds.PEDS_FIELDS.length) ? ok('分组打平 = ' + pTotal + ' 项') : bad('分组打平异常 ' + pTotal);

// 9.6b 「左房与右心」组必须存在（用户反馈：儿童页只有左室、没有房室大小）
const pKampGroup = pGrouped.find(g => /左房与右心/.test(g.title));
(pKampGroup && pKampGroup.rows.map(r => r.key).join(',') === 'LA4C,RA4C,RVIDd,RVIDs,LAAP,RVDD,RVAWd')
  ? ok('左房与右心组：4 项中国汉族儿童 + 3 项 M 型')
  : bad('左房与右心组异常');
(pKampGroup && !!pKampGroup.note) ? ok('该组带来源说明（不可与 PHN 混用）') : bad('该组缺来源说明');

// 9.7 跨年龄段连续性：成人 BSA 下 PHN 区间应贴近 ASE 成人正常值
const adultBsaP = peds.bsaHaycock(175, 70);
const adultR2P = peds.rangeFromZ('LVEDD', adultBsaP, 2);
(adultR2P.lower > 4.2 && adultR2P.lower < 4.3)
  ? ok('成人 LVEDD ±2SD 下界 = ' + adultR2P.lower.toFixed(2) + ' cm（≈ASE 4.2）')
  : bad('成人下界异常 ' + adultR2P.lower);
(adultR2P.upper > 5.9 && adultR2P.upper < 6.05)
  ? ok('成人 LVEDD ±2SD 上界 = ' + adultR2P.upper.toFixed(2) + ' cm（≈ASE 5.9）')
  : bad('成人上界异常 ' + adultR2P.upper);

// 9.8 非法输入不崩溃
const pHostile = peds.buildPedsList(0, { LVEDD: 38 });
(pHostile.length === peds.PEDS_FIELDS.length) ? ok('儿童页 BSA=0 不崩溃') : bad('儿童页 BSA=0 异常');
const pHostile2 = peds.buildPedsList(pBsa, { LVEDD: null, LVM: undefined, ROOT: 0 });
(pHostile2.length === peds.PEDS_FIELDS.length) ? ok('儿童页空值/0 输入不崩溃') : bad('儿童页异常输入处理失败');
const pRoot0 = pHostile2.find(r => r.key === 'ROOT');
(pRoot0.hasValue === true && typeof pRoot0.z === 'number')
  ? ok('ROOT = 0 作为合法测值参与计算') : bad('ROOT=0 处理异常');

// ── 10. 判读页 ↔ 计算器桥接（结构性解耦）──
{
  const bridged = [];
  EX.BRIEF_SECTIONS.forEach(function (sec) {
    (sec.items || []).forEach(function (it) {
      const last = (it.blocks || [])[it.blocks.length - 1];
      if (last && last.kind === 'note' && last.text.indexOf('相关计算（通用量）') !== -1) {
        bridged.push({ sec: sec.id, id: it.id, text: last.text });
      }
    });
  });
  (bridged.length === 70) ? ok('70 个判读条目全部挂上「相关计算」桥接')
    : bad('桥接条目数 ' + bridged.length + '（期望 70）');
  bridged.every(function (b) { return b.text.indexOf('公式集 → ') !== -1; })
    ? ok('桥接文案统一指向「公式集 → 组 · 计算器」')
    : bad('桥接文案格式不一致');

  // 桥接里点名的「组」必须是公式集里真实存在的 6 个计算组
  const GROUPS6 = ['血流动力学与心功能', '右心与肺循环', '舒张功能定量',
    '重构与心肌功能', '评分与室壁运动', '介入尺寸与先心', '瓣膜评估'];
  const body = function (t) {
    return t.replace(/^\*\*相关计算（通用量）\*\*：公式集 → /, '')
      .replace(/。本页给判读阈值.*$/, '');
  };
  // 分段规则：「组 · 计算器A；计算器B」——续段省略组名，需继承上一段的组
  const badGroup = [];
  const noSep = [];
  bridged.forEach(function (b) {
    let cur = '';
    body(b.text).split('；').forEach(function (seg) {
      const parts = seg.split(' · ');
      if (parts.length >= 2) {
        cur = parts[0].trim();
        if (GROUPS6.indexOf(cur) === -1) badGroup.push(cur);
      } else if (!cur) {
        noSep.push(seg);
      }
    });
  });
  (!badGroup.length) ? ok('桥接引用的计算组名称全部合法')
    : bad('桥接引用了不存在的计算组：' + badGroup.join(' / '));
  (!noSep.length) ? ok('桥接每段都能追溯到所属计算组')
    : bad('桥接首段缺组名：' + noSep.join(' / '));

  // 每个大组至少有一条桥接，避免只做了几个页面
  const secs = {};
  bridged.forEach(function (b) { secs[b.sec] = 1; });
  (Object.keys(secs).length >= 5) ? ok('桥接覆盖 5 个判读分组（' + Object.keys(secs).join('/') + '）')
    : bad('桥接只覆盖 ' + Object.keys(secs).length + ' 个判读分组');
}

// ── 11. 相关计算胶囊（CALC_LINKS）与 Wilkins 单一真相 ──
{
  const EC = require(path.join(MP, 'utils', 'echo-calc.js'));

  // 11.1 CALC_LINKS 的 id 必须真实存在于公式集（或两个评估页 brief 条目）
  const briefIds11 = EX.BRIEF_SECTIONS.reduce((a, s) => a.concat((s.items || []).map(i => i.id)), []);
  const allIds = CG.GROUPS.map(g => g.id).concat(briefIds11);
  const badId = [];
  Object.keys(EX.CALC_LINKS).forEach(function (k) {
    (EX.CALC_LINKS[k] || []).forEach(function (id) {
      if (allIds.indexOf(id) === -1) badId.push(k + '→' + id);
    });
  });
  (!badId.length) ? ok('胶囊引用的计算器 id 全部存在')
    : bad('胶囊引用了不存在的计算器：' + badId.join(' / '));

  // 11.2 CALC_LINKS 与 CALC_HINTS 必须是同一批条目（一个出文字、一个出胶囊）
  const linked = [], hinted = [];
  EX.BRIEF_SECTIONS.forEach(function (sec) {
    (sec.items || []).forEach(function (it) {
      const last = (it.blocks || [])[it.blocks.length - 1];
      if (last && last.links) linked.push(it.id);
      if (last && last.text && last.text.indexOf('相关计算（通用量）') !== -1) hinted.push(it.id);
    });
  });
  linked.join(',') === hinted.join(',') ? ok('胶囊条目与文字桥接条目一致（' + linked.length + ' 条）')
    : bad('胶囊与文字桥接条目不一致：' + linked.length + ' vs ' + hinted.length);

  // 11.3 每个挂胶囊的条目，id 数应为 1–4（太少没意义、太多挤成一排）
  const badCount = linked.filter(function (id) {
    const it = [];
    EX.BRIEF_SECTIONS.forEach(function (sec) {
      (sec.items || []).forEach(function (x) {
        if (x.id === id) it.push((x.blocks[x.blocks.length - 1].links || []).length);
      });
    });
    return it[0] < 1 || it[0] > 4;
  });
  (!badCount.length) ? ok('每条桥接挂 1–4 个胶囊')
    : bad('胶囊数量越界：' + badCount.join(', '));

  // 11.4 Wilkins 分项：4 项、每项 4 档、顺序为活动度→增厚→钙化→瓣下
  const WK = EC.WILKINS_ITEMS || [];
  (WK.length === 4) ? ok('Wilkins 分项 4 项')
    : bad('Wilkins 分项数 ' + WK.length);
  (WK.every(it => it.levels.length === 4)) ? ok('Wilkins 每项 4 个分档')
    : bad('Wilkins 分档数不齐');
  (WK.map(it => it.n).join('/') === '瓣叶活动度/瓣叶增厚/瓣叶钙化/瓣下增厚')
    ? ok('Wilkins 顺序与原始文献一致（活动度 → 增厚 → 钙化 → 瓣下）')
    : bad('Wilkins 顺序异常：' + WK.map(it => it.n).join('/'));

  // 11.5 二尖瓣页手写的评分表必须与引擎的分档描述逐字一致，防止两处漂移
  const mit = EX.BRIEF_SECTIONS.filter(s2 => s2.id === 'valve')[0]
    .items.filter(i => i.id === 'mitral')[0];
  const wkTables = (mit.blocks || []).filter(function (b) {
    return b.kind === 'table' && /瓣叶活动度|瓣叶增厚|瓣叶钙化|瓣下增厚/.test(b.heads.join(' '));
  });
  (wkTables.length === 4) ? ok('二尖瓣页含 4 张 Wilkins 分档表')
    : bad('二尖瓣页 Wilkins 表数 ' + wkTables.length);
  const mismatch = [];
  WK.forEach(function (it) {
    const tb = wkTables.filter(t => t.heads.join(' ').indexOf(it.n) !== -1)[0];
    if (!tb) { mismatch.push(it.n + '（缺表）'); return; }
    it.levels.forEach(function (d, j) {
      const row = tb.rows[j] || [];
      if (row[0] !== String(j + 1) || row[1] !== d) mismatch.push(it.n + ' ' + (j + 1) + ' 分');
    });
  });
  (!mismatch.length) ? ok('二尖瓣页评分表与引擎分档逐字一致')
    : bad('二尖瓣页评分表与引擎不一致：' + mismatch.join(' / '));

  // 11.6 二尖瓣页内嵌 Wilkins + MVA 三法 + MR 定量（v1.4.4 起 MS / MR 并入本页）
  const mitKeys = (mit.fields || []).filter(f => f.k).map(f => f.k);
  (['wk1', 'wk2', 'wk3', 'wk4'].every(k => mitKeys.indexOf(k) !== -1))
    ? ok('二尖瓣页内嵌 Wilkins 评分输入')
    : bad('二尖瓣页缺 Wilkins 输入');
  (mitKeys.length === 17) ? ok('二尖瓣页 17 个输入（Wilkins 4 + MS 7 + MR 6）')
    : bad('二尖瓣页输入 ' + mitKeys.length + ' 个（期望 17）');
  // 11.7 PMBV 适合度流程：三个指标必须都在输入里，且页面有串流程的小节
  const pmbvFields = ['mit_pht', 'mit_lvotD', 'mit_lvotVti', 'mit_mvVti',
    'mit_mgrad', 'mit_pasp', 'wk1', 'wk2', 'wk3', 'wk4'];
  const missF = pmbvFields.filter(k => !(mit.fields || []).some(f => f.k === k));
  (!missF.length) ? ok('PMBV 流程输入齐全（MVA 两法 + 平均压差 + PASP + Wilkins）')
    : bad('PMBV 流程缺输入：' + missF.join(','));
  const pmbvSec = (mit.blocks || []).some(b => /PMBV 适合度/.test(b.text || ''));
  pmbvSec ? ok('二尖瓣页含 PMBV 适合度流程小节') : bad('二尖瓣页缺 PMBV 适合度流程小节');

  // 11.8 报告标准化条目必须含危急值清单（心包填塞 / 主动脉夹层 / 人工瓣急性功能障碍等）
  const rs = EX.BRIEF_SECTIONS.filter(s2 => s2.id === 'views-atlas')[0]
    .items.filter(i => i.id === 'report-std')[0];
  const cvTb = (rs.blocks || []).filter(function (b) {
    return b.kind === 'table' && (b.heads || [])[0] === '危急值';
  })[0];
  const cvRows = (cvTb && cvTb.rows) || [];
  const cvNeed = ['心包填塞', '主动脉夹层', '人工瓣急性功能障碍'];
  const cvMiss = cvNeed.filter(function (n) {
    return !cvRows.some(function (r) { return (r[0] || '').indexOf(n) !== -1; });
  });
  (cvRows.length >= 5 && !cvMiss.length)
    ? ok('危急值清单 ' + cvRows.length + ' 条，含' + cvNeed.join(' / '))
    : bad('危急值清单异常（' + cvRows.length + ' 行，缺 ' + cvMiss.join(',') + '）');

  // 11.9 超声造影条目：适应证限定 LVO/EBD、MI 分级、剂量、EBD 三招、安全性数据
  const ce = EX.BRIEF_SECTIONS.filter(s2 => s2.id === 'views-atlas')[0]
    .items.filter(i => i.id === 'contrast-echo')[0];
  if (ce) {
    const ceText = JSON.stringify(ce.blocks || []);
    const ceNeed = [
      /LVO/, /EBD/, /0\.2/, /0\.3/, /0\.5/, /Definity/, /Optison/,
      /Valsalva/, /10 个心动周期/, /10,000/, /500,000/, /30 分钟/,
    ];
    const ceMiss = ceNeed.filter(re => !re.test(ceText));
    (!ceMiss.length)
      ? ok('超声造影条目含适应证 / MI 分级 / 剂量 / EBD 手法 / 安全性要点')
      : bad('超声造影条目缺：' + ceMiss.map(String).join(','));
    // 三招表：加血 / 咳嗽 Valsalva / 股静脉
    const ceTb = (ce.blocks || []).filter(b => b.kind === 'table' &&
      (b.heads || []).join('|') === '手法|具体做法|原理')[0];
    const ceRows = (ceTb && ceTb.rows) || [];
    (ceRows.length >= 3 && /加血/.test(ceRows[0][0]) && /股静脉/.test(ceRows[2][0]))
      ? ok('EBD 增敏三招齐全（加血 10% / 咳嗽 Valsalva / 股静脉）')
      : bad('EBD 增敏三招异常：' + JSON.stringify(ceRows.map(r => r[0])));
    // 引用必须是 R47 / R48
    (ce.source.join(',') === 'R47,R48')
      ? ok('超声造影条目引用 R47（共识声明）+ R48（技师指南）')
      : bad('超声造影条目引用异常：' + ce.source.join(','));
  } else {
    bad('超声造影条目 contrast-echo 缺失');
  }

  // 11.10 超声引导下有创操作条目：12 类操作对照表、心包穿刺数据、活检部位、ICE 风险
  const eiSec = EX.BRIEF_SECTIONS.filter(s2 => s2.id === 'views-atlas')[0];
  const ei = eiSec && eiSec.items.filter(i => i.id === 'echo-interv')[0];
  if (ei) {
    const eiText = JSON.stringify(ei.blocks || []);
    const eiNeed = [
      /房间隔穿刺/, /PMBV/, /LAA 封堵/, /心肌与血管内活检/, /心包穿刺/,
      /97%/, /1\.2%/, /3\.2%/, /25 mL/, /右室心尖/, /心脏穿孔/, /心包填塞/,
      /TEE 盲区/, /帐篷/, /穿支/,
    ];
    const eiMiss = eiNeed.filter(re => !re.test(eiText));
    (!eiMiss.length)
      ? ok('有创操作条目含操作对照表 / 心包穿刺数据 / 活检部位 / ICE 风险')
      : bad('有创操作条目缺：' + eiMiss.map(String).join(','));
    // 三模态 × 12 类操作的对照表
    const eiTb = (ei.blocks || []).filter(b => b.kind === 'table' &&
      (b.heads || []).join('|') === '操作|TTE|TEE|ICE')[0];
    const eiRows = (eiTb && eiTb.rows) || [];
    (eiRows.length === 12)
      ? ok('有创操作对照表 12 行（原文 Table 1）')
      : bad('有创操作对照表异常：' + eiRows.length + ' 行');
    // ICE 风险清单 5 类
    const riskTb = (ei.blocks || []).filter(b => b.kind === 'table' &&
      (b.heads || []).join('|') === '风险类别|具体风险')[0];
    const riskRows = (riskTb && riskTb.rows) || [];
    (riskRows.length === 5 && riskRows.some(r => /心脏穿孔/.test(r[1] || '')))
      ? ok('ICE 风险清单 5 类（含心脏穿孔与心包填塞）')
      : bad('ICE 风险清单异常：' + JSON.stringify(riskRows.map(r => r[0])));
    // 引用 R49
    (ei.source.join(',') === 'R49')
      ? ok('有创操作条目引用 R49（超声引导下有创操作指南）')
      : bad('有创操作条目引用异常：' + ei.source.join(','));
  } else {
    bad('有创操作条目 echo-interv 缺失');
  }
}

/* ---- 159. CSS 不得泄漏 style 闭标签字面量 ---- *
 * app.css 会被 build-www.js 原样内联进 <style> 元素。HTML 解析器在 style
 * 内容中一见到闭标签字符串就提前结束样式表，其后的注释会变成页面可见文字
 * （2026-10-22 因此泄漏了「跳转条退化成蓝色裸链接」那段说明）。
 */
console.log('\n=== 159. style 闭标签字面量（会被 HTML 解析器提前结束样式表）===');
{
  const cssPath = path.join(ROOT, 'android-app', 'app.css');
  const lines = fs.readFileSync(cssPath, 'utf8').split(/\r?\n/);
  const hits = [];
  lines.forEach(function (l, i) {
    if (l.indexOf('<' + '/style>') !== -1) hits.push((i + 1) + ' 行: ' + l.trim().slice(0, 50));
  });
  if (hits.length) bad('app.css 含 style 闭标签字面量（会被提前截断）→ ' + hits.join(' | '));
  else ok('app.css 不含 style 闭标签字面量（内联进页面不会被截断）');
}

/* ---- 160. 条目「相关内容」与页尾跳转 ---- *
 * 用户 2026-10-22：条目要给「相关联的内容」，页尾要给「跳转其他页面」。
 * 数据侧 rel 是唯一真相源（网页 + 小程序都读 extra-data），这里一并守住。
 */
console.log('\n=== 160. 相关内容交叉引用 + 页尾跳转其他页面 ===');
{
  const appJs160 = fs.readFileSync(path.join(ROOT, 'android-app', 'app.js'), 'utf8');
  const bwJs160 = fs.readFileSync(path.join(ROOT, 'build-www.js'), 'utf8');
  const EX160 = require('./miniprogram/utils/extra-data.js');
  const briefs160 = EX160.BRIEF_SECTIONS.reduce((a, s) => a.concat(s.items), []);
  const ids160 = briefs160.map(b => b.id);

  const withRel = briefs160.filter(b => Array.isArray(b.rel) && b.rel.length);
  if (withRel.length >= 60) ok('评估条目带相关内容 rel：' + withRel.length + ' / ' + briefs160.length);
  else bad('带 rel 的条目只有 ' + withRel.length + ' 条（应 ≥ 60）');

  const dangling = [];
  const selfRef = [];
  briefs160.forEach(b => {
    (b.rel || []).forEach(r => {
      if (ids160.indexOf(r) === -1) dangling.push(b.id + '->' + r);
      if (r === b.id) selfRef.push(b.id);
    });
  });
  if (!dangling.length) ok('rel 全部指向存在的条目');
  else bad('rel 悬空引用 → ' + dangling.join(' | '));
  if (!selfRef.length) ok('rel 不指向自身');
  else bad('rel 自我引用 → ' + selfRef.join(' | '));

  // 网页端渲染 + 点击跳转
  if (/function briefRelHtml\(ids\)/.test(appJs160) &&
      appJs160.indexOf("data-rel=\"' + esc(id)") !== -1) ok('网页端渲染「相关内容」胶囊（briefRelHtml）');
  else bad('网页端缺少 briefRelHtml 或 data-rel 输出');

  if (appJs160.indexOf('briefRelHtml(it.rel)') !== -1) ok('网页端把 rel 接进条目详情');
  else bad('网页端条目详情未调用 briefRelHtml');

  if (/querySelectorAll\('\.chip\[data-rel\]'\)/.test(appJs160)) ok('网页端「相关内容」可点击跳转');
  else bad('网页端「相关内容」未绑定点击');

  // ★ 2026-10-22 用户反馈：网页底部本来就有页签，页尾「继续看其他页面」多余 → 已移除
  ['www', 'docs'].forEach(function (d) {
    const f = path.join(ROOT, d, 'index.html');
    const h = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    if (h && h.indexOf('pagefoot') === -1) ok(d + ' 版本已移除页尾「继续看其他页面」（下方页签已够）');
    else bad(d + ' 版本仍残留页尾（先跑 node build-www.js）');
  });
  const css160 = fs.readFileSync(path.join(ROOT, 'android-app', 'app.css'), 'utf8');
  if (css160.indexOf('pagefoot') === -1) ok('app.css 已清掉页尾样式');
  else bad('app.css 仍残留 pagefoot 样式');
  if (css160.indexOf('.chip--rel') !== -1) ok('「相关内容」胶囊专用配色已定义');
  else bad('缺少 .chip--rel 配色');

  // 「相关计算」桥接：75 条判读全有，且目标计算器真实存在（brief 评估页也算合法目标）
  const CG160 = require(path.join(ROOT, 'miniprogram', 'utils', 'calc-groups.js'));
  const calcIds160 = CG160.GROUPS.map(g => g.id).concat(briefs160.map(b => b.id));
  const links160 = EX160.CALC_LINKS || {};
  const missingLinks = briefs160.filter(b => !(links160[b.id] || []).length).map(b => b.id);
  if (!missingLinks.length) ok('75 条判读全部带「相关计算」跳转目标');
  else bad('缺相关计算的条目：' + missingLinks.join(','));
  const badTarget = [];
  Object.keys(links160).forEach(function (k) {
    (links160[k] || []).forEach(function (t) {
      if (calcIds160.indexOf(t) === -1) badTarget.push(k + '->' + t);
    });
  });
  if (!badTarget.length) ok('相关计算的目标计算器全部存在');
  else bad('相关计算悬空目标：' + badTarget.join(' | '));

  // ★ 三端目录一致（v1.4.4）：AS / AR / MS / MR 并入两个评估页，公式集只剩 TR 独立
  const trG = CG160.GROUPS.filter(x => x.id === 'tr')[0];
  if (trG && trG.sec === 'valve' && (trG.fields || []).length) {
    ok('瓣膜计算器进公式集：tr（' + trG.title + '）');
  } else bad('公式集缺少瓣膜计算器：tr');
  ['as', 'ar', 'ms', 'mr', 'wilkins', 'mva', 'pisav', 'avav'].forEach(function (id) {
    if (!CG160.GROUPS.filter(x => x.id === id)[0]) ok('已并入评估页、公式集不再单列：' + id);
    else bad('仍在公式集单列：' + id);
  });
  // 瓣膜组只剩 2 条：TR 定量 + 人工瓣 EOAi/PPM（v1.4.9 把纯查表与重复的删掉）
  const valveRest = CG160.GROUPS.filter(g => g.sec === 'valve').map(g => g.id).join(',');
  (valveRest === 'tr,ppm,tavrsz,pvfu')
    ? ok('瓣膜组 4 条计算器（TR / PPM / TAVR 瓣环与 oversizing / 人工瓣术后），与原评估页无重复：' + valveRest)
    : bad('瓣膜组条目异常：' + valveRest);
  // 并入评估页的输入键必须带前缀，否则网页端全局 calcVal 会串值
  [['mitral', ['mit_', 'mr_', 'wk']], ['aortic', ['as_', 'ar_', 'lflg']]].forEach(function (pair) {
    const id = pair[0];
    const b = briefs160.filter(x => x.id === id)[0];
    if (!b) { bad('缺少评估条目：' + id); return; }
    const ks = (b.fields || []).filter(f => f.k).map(f => f.k);
    const badK = ks.filter(k => !pair[1].some(w => k.indexOf(w) === 0));
    if (ks.length && !badK.length) ok('评估页输入键带前缀：' + id + '（' + ks.length + ' 项）');
    else bad('评估页输入键前缀异常：' + id + ' ' + badK.join(','));
    const gs = (b.fields || []).filter(f => f.g);
    if (gs.length >= 2) ok('评估页输入框已分「狭窄 / 反流」段：' + id + '（' + gs.length + ' 段）');
    else bad('评估页输入框未分段：' + id);
  });

  // ★★ 加粗标记「渲染覆盖」断言（2026-10-22 第二次漏出后加的）
  //    真实事故：表格单元格 rows[][] 与条目 note 都是直接 esc() 输出，
  //    219 个单元格 + 19 条说明把字面量 ** 漏到屏幕上，而当时的奇偶断言查不出来
  //    （它只查配对，不查「这段文本到底有没有走解析器」）。
  //    思路：** 只允许出现在会被 mdInline / parseInline 处理的字段名里。
  const mdSafeKeys = { text: 1, note: 1, rows: 1, heads: 1 };
  const badMd = [];
  (function walkMd(o, key) {
    if (typeof o === 'string') {
      if (o.indexOf('**') !== -1 && !mdSafeKeys[key]) {
        badMd.push(key + ' → ' + o.slice(0, 26));
      }
      return;
    }
    if (Array.isArray(o)) { o.forEach(function (v) { walkMd(v, key); }); return; }
    if (o && typeof o === 'object') {
      Object.keys(o).forEach(function (k) { walkMd(o[k], k); });
    }
  })(EX160, '');
  if (!badMd.length) ok('** 只出现在会被解析的字段（正文 / 说明 / 表格单元格）');
  else bad('这些字段含 ** 但渲染时不解解析：' + badMd.slice(0, 6).join('  |  '));

  // 渲染侧兜底：三处曾经漏解析的代码位置必须保持解析
  const appMd = fs.readFileSync(path.join(ROOT, 'android-app', 'app.js'), 'utf8');
  if (!/r\.forEach\(function \(c\) \{ h \+= '<span class="fx-tbl__c">' \+ esc\(c\)/.test(appMd)) {
    ok('网页端表格单元格走 mdInline（不再 esc 直出）');
  } else bad('网页端表格单元格又改回 esc(c)，单元格里的 ** 会漏出');

  const fxJsMd = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/formula/formula.js'), 'utf8');
  const fxWxMd = fs.readFileSync(path.join(ROOT, 'miniprogram/pages/formula/formula.wxml'), 'utf8');
  const okTableJs = /kind: 'table'[\s\S]{0,400}MD\.parseInline/.test(fxJsMd);
  const okTableWx = fxWxMd.indexOf('wx:for="{{cell}}"') !== -1 &&
                    fxWxMd.indexOf('wx:for="{{cellSeg}}"') === -1;
  if (okTableJs && okTableWx) ok('小程序表格单元格拆成片段渲染');
  else bad('小程序表格单元格未按片段渲染（表格里的 ** 会漏出）');

  const okNoteWx = /class="note"><text wx:for="\{\{noteSegs\}\}"/.test(fxWxMd);
  const okNoteJs = fxJsMd.indexOf('noteSegs: MD.parseInline') !== -1;
  if (okNoteWx && okNoteJs) ok('小程序条目说明（note）按片段渲染');
  else bad('小程序 note 未按片段渲染（wilkins / mva / ppm 的 ** 会漏出）');
}

console.log('\n' + '='.repeat(50));
console.log(`结果： ${pass} 通过 / ${fail} 失败`);
if (problems.length) {
  console.log('\n问题列表：');
  problems.forEach(p => console.log('  - ' + p));
}
console.log('='.repeat(50) + '\n');
process.exit(fail > 0 ? 1 : 0);
