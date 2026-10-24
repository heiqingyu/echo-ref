/**
 * 构建脚本：把微信小程序的两套引擎 + 页面，合成为单文件 Web 应用
 *
 * 设计原则：
 *   ★ 引擎源码**直接从 miniprogram/utils/*.js 读取**，不手抄。
 *     做法是剥掉 `module.exports` 语句，加一层 window 挂载。
 *     这样小程序与 APK 永远共用同一份算法，从根上杜绝漂移。
 *
 * 两个产出：
 *   ① www/index.html            完整版（4 页签），供 APK 内嵌与本地预览
 *   ② docs/index.html           发布版（同样 4 页签），可作为 GitHub Pages 的发布源
 *
 * 用法：node build-www.js  [--full]
 *   --full   只生成完整版（跳过 docs 发布版）
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MP = path.join(ROOT, 'miniprogram');
const OUT = path.join(ROOT, 'www', 'index.html');

/**
 * 页签：v1.5.0 起完整版与发布版统一为 4 个（EF·参考值 / 儿童 Z 值 / 节段划分 / 公式集）。
 * ★ 用户 2026-10-24：「网页下面标签页怎么变成了 6 组，瓣膜评估、瓣膜解剖放入公式集里，
 *   变四组和小程序统一」。瓣膜评估与瓣膜解剖已作为公式集里的条目存在，
 *   底部不再单列页签，也不再分完整版 / 发布版两套页签。
 */
const PUBLIC_TABS = ['index', 'peds', 'segments', 'calc'];

/**
 * 版本号单一来源：android-app/VERSION 第一行
 * （第二行 versionCode 只给 APK 用；改功能时两个都要 +1）
 */
const APP_VERSION = (function () {
  try {
    return fs.readFileSync(path.join(ROOT, 'android-app', 'VERSION'), 'utf8')
      .split('\n')[0].trim() || '0.0.0';
  } catch (e) {
    return '0.0.0';
  }
})();


/* ---------- 1. 抽取引擎源码 ---------- */

/** 把 CommonJS 模块转成浏览器可用的 IIFE，挂到 window[globalName] */
function wrapEngine(file, globalName) {
  let src = fs.readFileSync(file, 'utf8');

  // 去掉导出语句整块（含多行）。用 lastIndexOf：引擎头部注释里可能出现同一串文字，
  // 只截最后一次真正的导出语句，避免注释把它带偏。
  const idx = src.lastIndexOf('module.exports');
  if (idx === -1) throw new Error(file + ' 未找到 module.exports');
  src = src.slice(0, idx).trimEnd();

  // 去掉结尾可能残留的注释尾部
  src = src.replace(/\/\*[\s\S]*?\*\/\s*$/, '').trimEnd();

  return [
    '/* ── 引擎：' + path.basename(file) + '（由小程序源码自动抽取，勿手改）── */',
    '(function () {',
    src,
    '',
    '  window.' + globalName + ' = {',
    // 自动列出所有顶层函数名，避免手写漏函数
    listTopLevelNames(src).map((n) => '    ' + n + ': ' + n + ',').join('\n'),
    '  };',
    '})();',
  ].join('\n');
}

/** 粗略提取顶层 function 名与顶层 const/let/var 名 */
function listTopLevelNames(src) {
  const names = [];
  const lines = src.split('\n');
  for (const line of lines) {
    if (/^\s/.test(line)) continue; // 只取顶格声明
    let m = line.match(/^function\s+([A-Za-z_$][\w$]*)/);
    if (m) { names.push(m[1]); continue; }
    m = line.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
    if (m) { names.push(m[1]); continue; }
  }
  // 去重并排除明显不是导出的
  return [...new Set(names)].filter((n) => n !== 'window' && n !== 'module');
}

const coreSrc = wrapEngine(path.join(MP, 'utils', 'echo-core.js'), 'Core');
const pedsSrc = wrapEngine(path.join(MP, 'utils', 'peds-zscore.js'), 'Peds');
const calcSrc = wrapEngine(path.join(MP, 'utils', 'echo-calc.js'), 'Calc');
const segSrc = wrapEngine(path.join(MP, 'utils', 'segment-svg.js'), 'SegSvg');
// 瓣膜解剖示意图（分区 / 分叶 / 分段），与小程序同源
const valveSvgSrc = wrapEngine(path.join(MP, 'utils', 'valve-svg.js'), 'ValveSvg');
const valveSrc = wrapEngine(path.join(MP, 'utils', 'valve-calc.js'), 'ValveCalc');
// 行内标记解析（**加粗**）—— 小程序与网页共用同一份，避免两端表现不一致
const mdSrc = wrapEngine(path.join(MP, 'utils', 'inline-md.js'), 'InlineMd');
// 公式集「评估类内容 + 参考文献」数据（纯数据，与小程序同源）
const extraSrc = wrapEngine(path.join(MP, 'utils', 'extra-data.js'), 'ExtraData');
// 计算器说明（临床意义 / 参考标准 / 判读要点），与小程序同源
const notesSrc = wrapEngine(path.join(MP, 'utils', 'calc-notes.js'), 'CalcNotes');
// 本地资料清单（docs/materials/ 扫描生成）：只存 URL，不影响体积
const materialsSrc = wrapEngine(path.join(MP, 'utils', 'materials.js'), 'Materials');

/* ---------- 1b. 节段划分页（构建时生成骨架，示意图由 SegSvg 运行时渲染） ---------- */

const SEG_DATA = require(path.join(MP, 'utils', 'segment-data.js'));
const SEG_SVG = require(path.join(MP, 'utils', 'segment-svg.js'));

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSegPage() {
  const svg = SEG_SVG.bullseyeSvg({ hi: '' });
  const chips = SEG_DATA.TERRITORY_KEY.map((t) =>
    '<button class="terr-chip" data-terr="' + t.key + '" style="--c:' + t.color + '">' +
    escHtml(t.name) + '</button>').join('');
  const terrRows = SEG_DATA.TERRITORY_KEY.map((t) =>
    '<div class="tbl__row tbl--2"><span class="tbl__c1" style="color:' + t.color + ';font-weight:600">' +
    escHtml(t.full === '左前降支' ? 'LAD · 左前降支' : t.full === '右冠状动脉' ? 'RCA · 右冠状动脉' : 'LCx · 左回旋支') +
    '</span><span class="tbl__c2">' + escHtml(t.segs) + '</span></div>').join('');
  const layerRows = SEG_DATA.LAYER_ROWS.map((r) =>
    '<div class="tbl__row tbl--2"><span class="tbl__c1">' + escHtml(r[0]) +
    '</span><span class="tbl__c2">' + escHtml(r[1]) + '</span></div>').join('');


  // 7 张切面示意图卡片（SVG 由 SegSvg 运行时渲染进 wd-* 容器）
  const wallCards = SEG_SVG.WALL_VIEWS.map((w) => {
    const groups = w.groups.map((g) => {
      const chipBtns = g[1].map((i) => {
        const c = SEG_SVG.TERRITORY[SEG_SVG.territoryOf(i)].color;
        return '<button class="segchip" data-selseg="' + i + '" style="--c:' + c + '" aria-label="' + i + '号节段">' + i + '</button>';
      }).join('');
      return '<div class="wall-group"><span class="wall-group__l">' + escHtml(g[0]) +
        '</span><span class="wall-chips">' + chipBtns + '</span></div>';
    }).join('');
    return '<div class="wall-card"><div class="wall-card__t">' + escHtml(w.title) +
      '</div><div class="wall-card__s">' + escHtml(w.sub) +
      '</div><div class="wallsvg-box" id="wd-' + w.id + '"></div>' + groups +
      (w.note ? '<div class="wall-card__note">' + escHtml(w.note) + '</div>' : '') + '</div>';
  }).join('');

  return `  <!-- ───── Tab4 节段划分 ───── -->
  <section class="page" id="page-segments" hidden>
    <div class="card">
      <div class="card__t">17 节段模型与冠脉供血</div>
      <div class="card__d">ASE 17 节段模型 · 供血分区为典型分布，存在个体差异。点击下方分区可高亮对应节段；点击节段色块或数字可在所有切面中同步定位。</div>
      <div class="bull-wrap" id="bullseyeBox">${svg}</div>
      <div class="terr-key">${chips}</div>
      <div class="hi-line" id="segHiLine" hidden></div>
      <div class="hi-line hi-line--sel" id="segSelInfo" hidden></div>
      <div class="tbl">
        <div class="tbl__head tbl--2"><span>层面</span><span>节段名称</span></div>
        ${layerRows}
      </div>
      <div class="tbl">
        <div class="tbl__head tbl--2"><span>冠脉</span><span>典型供血节段</span></div>
        ${terrRows}
      </div>
      <div class="note">冠脉优势型、分支长度与个体解剖会改变供血范围。二维室壁运动评分通常采用 16 节段，不把难以可靠评价增厚的心尖帽纳入。</div>
      <div class="note">评分：1 正常或运动增强；2 运动减弱；3 无运动；4 反常运动（收缩期向外膨出）。WMSI = 已评分节段分数之和 ÷ 已评分节段数，正常为 1。</div>
      <div class="note">不符合单一冠脉分布的异常还应考虑 Takotsubo、心肌炎、结节病，以及左束支阻滞或起搏相关的室间隔运动异常。</div>
    </div>
    <div class="card">
      <div class="card__t">切面与室壁对应</div>
      <div class="card__d">按标准屏幕方位示意 · 实际以解剖标志确认。点击任一彩色节段（示意图中的色块或数字按钮），它会在所有对应切面及牛眼图中同步高亮；再次点击取消。</div>
      ${wallCards}
      <div class="note">记忆：四腔心看下间隔和前外侧壁；长轴看前间隔和下外侧壁；两腔心看下壁和前壁。传统“后壁”名称在标准节段模型中对应下外侧壁。</div>
      <div class="note">PSAX 钟面：12 点前壁，2 点前外侧壁，4 点下外侧壁，6 点下壁，8 点下间隔，10 点前间隔。探头方向与显示习惯不同，需用右室和瓣膜等标志核实。</div>
      <div class="note">常见旋转顺序：A4C → 约 60° 逆时针 → A2C → 再约 60° → A3C；角度只作操作参考。</div>
      <div class="note">前外侧乳头肌常有 LAD 对角支及 LCx 双重供血；后内侧乳头肌通常主要由后降支供血，来源随冠脉优势型改变。</div>
      <div class="note">LV 左室 · RV 右室 · LA 左房 · RA 右房 · Ao 主动脉 · MV 二尖瓣 · TV 三尖瓣 · LAA 左心耳 · LVOT 左室流出道</div>
    </div>
    <div class="note note--warn">本页为速查资料整理，内容依据 ASE 系列指南；具体应用请回看指南原文并结合临床判断。</div>
  </section>`;
}

const SEG_HTML = buildSegPage();



/* ---------- 2. 组装页面 ---------- */

const css = fs.readFileSync(path.join(ROOT, 'android-app', 'app.css'), 'utf8');
const js = fs.readFileSync(path.join(ROOT, 'android-app', 'app.js'), 'utf8');

// 网页图标：64px PNG 内嵌为 data URI，避免额外请求（也让 file:// 打开时能显示）
const FAVICON_DATA = 'data:image/png;base64,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';



/* ══════════════════════════════════════════════════════════
   发布版：仅保留 PUBLIC_TABS 三个页签 + 对应引擎，去掉转载内容
   ══════════════════════════════════════════════════════════ */

/**
 * 「关于本页」说明块
 *
 * ★ 2026-10-21：用户反馈它原来出现在每个页签顶部（点击哪里都有），
 *   严重影响阅读体验。改为**只在公式集页最后放一处**，其余页签一律不显示。
 *   www 完整版与 docs 发布版共用这一份，保证两端一致。
 */
const PUBNOTE_HTML = `<div class="pubnote">
    <b>关于本页</b><br>
    本页为个人整理的心脏超声（TTE）参考速查工具，四个页签：<b>EF·参考值</b>（M 型 / 二维 EF 计算、
    成人正常参考值：中国 2016 指南 37 项 / ASE-EACVI 2015）、<b>节段划分</b>（ASE 17 节段模型与冠脉供血）、
    <b>儿童 Z 值</b>（PHN 数据库）、<b>公式集</b>（52 个计算器 + 77 条评估清单，按 10 个主题分组，
    含二尖瓣狭窄 PMBV 适合度流程、人工瓣、超声造影、危急值清单与报告标准化）。
    公式集目录顶部有组名跳转条，点一下直接定位到对应分组；长条目详情页顶部另有小节导航。
    切面学习视频为第三方站点的文字链接，本工具不加载其任何内容。
    「切面指南」已并入参考文献（78 条：<b>67 条可免费获取</b>——ASE 官方 PDF / 中文 PDF /
    PMC 全文 / 出版社免费 PDF，以及「免费页面」（进页面点 PDF 即可下载，不用登录）；
    只有 7 条标<b>需订阅</b>，即确实需要机构订阅的期刊。各详情页底部标注该条目使用的文献编号）。
    <b>本页内容为自行整理，非任何学会或机构的官方产品</b>，仅供医学教育与速查使用；
    参考值需结合患者体型、血流状态及测量方法，<b>不能单凭一个指标作出诊断</b>。
  </div>`;

/**
 * 把「关于本页」插到公式集页（#page-calc）末尾
 * 锚点是公式集页最后的「公式来源」说明块 —— 插在它之后即为整页最末。
 */
function insertPubnote(src) {
  const anchor = 'Abbas（PVR 经验公式）。仅供速查与学习，不构成诊断依据。\n      </div>\n    </div>';
  if (src.indexOf(anchor) === -1) throw new Error('未找到公式集末尾锚点');
  return src.replace(anchor, anchor.replace(
    '      </div>\n    </div>',
    '      </div>\n\n      ' + PUBNOTE_HTML + '\n    </div>'
  ));
}

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="theme-color" content="#2563eb">
<meta name="format-detection" content="telephone=no">
<meta name="robots" content="index,follow,noai,noimageai">
<title>心脏超声参考值</title>
<link rel="icon" type="image/png" href="${FAVICON_DATA}">
<link rel="apple-touch-icon" href="${FAVICON_DATA}">
<style>${css}</style>
</head>
<body>

<!-- ══════════ 顶栏 ══════════ -->
<header class="appbar">
  <h1 class="appbar__t" id="appbarTitle">EF·参考值</h1>
  <button class="appbar__r" id="resetBtn" title="重置">重置</button>
</header>

<!-- ══════════ 内容区 ══════════ -->
<main class="main" id="main">

  <!-- ───── Tab1 EF·参考值 ───── -->
  <section class="page" id="page-index">

    <!-- ══ EF 计算（合并自原「EF 计算」页，置于最上） ══ -->
    <div class="card">
      <div class="card__t">M 型 / 二维内径测量</div>
      <div class="card__d">输入内径与室壁厚度，自动推算容积、收缩功能与左室质量</div>
      <div class="row">
        <div class="field">
          <label class="field__l">LVIDd 舒张末内径 / mm</label>
          <input class="field__i" type="number" inputmode="decimal" id="efLvedd" placeholder="如 50" step="0.1">
        </div>
        <div class="field">
          <label class="field__l">LVIDs 收缩末内径 / mm</label>
          <input class="field__i" type="number" inputmode="decimal" id="efLvesd" placeholder="如 32" step="0.1">
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label class="field__l">IVSd 室间隔厚度 / mm</label>
          <input class="field__i" type="number" inputmode="decimal" id="efIvsd" placeholder="如 9" step="0.1">
        </div>
        <div class="field">
          <label class="field__l">LVPWd 后壁厚度 / mm</label>
          <input class="field__i" type="number" inputmode="decimal" id="efLvpwd" placeholder="如 9" step="0.1">
        </div>
      </div>
      <div class="hint" id="efHint"></div>
    </div>

    <div class="card" id="efResult" hidden>
      <div class="card__t">计算结果</div>
      <div class="kv" id="efKv"></div>
      <div class="efbar-wrap">
        <div class="efbar"><div class="efbar__m" id="efMark"></div></div>
        <div class="efbar-lg">
          <span>0%</span><span>30%</span><span>45%</span><span>55%</span><span>100%</span>
        </div>
      </div>
      <div class="note" id="efGrade"></div>
      <div class="note" id="efFormula"></div>
      <button class="btn btn--ghost" id="jumpRef" style="margin-top:10px">↓ 与下方参考值对照</button>
    </div>

    <!-- ══ 受检者基本信息 ══ -->
    <div class="card">
      <div class="card__t">受检者基本信息</div>
      <div class="card__d">身高体重用于计算体表面积（BSA），性别决定参考值区间</div>
      <div class="row">
        <div class="field">
          <label class="field__l">身高 / cm</label>
          <input class="field__i" type="number" inputmode="decimal" id="inHeight" value="170" step="0.1">
        </div>
        <div class="field">
          <label class="field__l">体重 / kg</label>
          <input class="field__i" type="number" inputmode="decimal" id="inWeight" value="65" step="0.1">
        </div>
      </div>
      <div class="field">
        <label class="field__l">性别</label>
        <div class="seg" data-seg="sex">
          <div class="seg__i seg__i--on" data-v="male">男</div>
          <div class="seg__i" data-v="female">女</div>
        </div>
      </div>
      <div class="field">
        <label class="field__l">体表面积公式</label>
        <div class="seg" data-seg="formula">
          <div class="seg__i seg__i--on" data-v="dubois">Du Bois</div>
          <div class="seg__i" data-v="mosteller">Mosteller</div>
        </div>
      </div>
      <div class="stat-row">
        <div class="stat">
          <div class="stat__main">
            <span class="stat__v" id="outBsa">—</span>
            <span class="stat__u">m²</span>
          </div>
          <span class="stat__l" id="outBsaLbl">体表面积</span>
        </div>
        <div class="stat">
          <div class="stat__main">
            <span class="stat__v" id="outBmi">—</span>
            <span class="stat__u">kg/m²</span>
          </div>
          <span class="stat__l">BMI <span class="bmi-tag" id="outBmiTag"></span></span>
        </div>
      </div>
      <div class="hint" id="bsaHint"></div>
    </div>

    <!-- ══ 参考值标准 ══ -->
    <div class="card">
      <div class="card__t">参考值标准</div>
      <div class="seg" data-seg="standard">
        <div class="seg__i seg__i--on" data-v="CN">中国成人标准</div>
        <div class="seg__i" data-v="ASE">ASE 国际标准</div>
      </div>
      <div class="note" id="stdNote">《中国成年人超声心动图检查测量指南》(2016) · 95% 参考范围</div>
    </div>

    <!-- ══ 参考值列表 ══ -->
    <div id="refBlock">
      <div class="note note--warn" id="aseUnitNote" hidden>
        ASE 指南原文以 <b>cm</b> 表示内径。本表已统一换算为 <b>mm</b> 显示，可直接与你的测量值对照。
      </div>
      <div class="card">
        <div class="card__t" id="refTitle">正常参考范围</div>
        <div class="card__d" id="refDesc"></div>
        <div id="refList"></div>
      </div>
      <div class="note" id="refSource"></div>
    </div>

    <!-- ══ 计算公式说明（合并原 EF 页公式 + 体表面积公式） ══ -->
    <div class="card">
      <div class="card__t">计算公式说明</div>
      <div class="note">
        <b>Teichholz 法</b>（M 型单平面）<br>
        V = 7 × D³ ÷ (2.4 + D)　　D 单位 cm，V 单位 mL<br>
        EF = (EDV − ESV) ÷ EDV × 100%<br>
        FS = (LVIDd − LVIDs) ÷ LVIDd × 100%<br>
        RWT = 2 × LVPWd ÷ LVEDD
      </div>
      <div class="note">
        <b>左室质量 Devereux 公式</b><br>
        LVM(g) = 0.8 × 1.04 × [(LVIDd + IVSd + LVPWd)³ − LVIDd³] + 0.6<br>
        LVM/BSA = 左室质量 ÷ 体表面积
      </div>
      <div class="note">
        <b>体表面积 BSA</b><br>
        Du Bois：BSA = 0.007184 × 身高<sup>0.725</sup> × 体重<sup>0.425</sup>（临床试验通用）<br>
        Mosteller：BSA = √(身高 × 体重 ÷ 3600)（口算便捷）<br>
        儿童页另有 <b>Haycock</b> 公式（儿科首选，PHN 研究采用）
      </div>
      <div class="note note--warn">
        Teichholz 法假设左室为对称椭球体，在室壁瘤、显著扩大等形态异常时准确性下降，建议改用双平面 Simpson 法。
      </div>
    </div>
    <div class="verline">心脏超声参考值 · v${APP_VERSION}</div>
  </section>

  <!-- ───── Tab3 其他计算（公式集） ───── -->
  <section class="page" id="page-calc" hidden>

    <!-- 视图一：公式集目录（点条目进对应公式） -->
    <div id="calcIndex">
      <div class="card">
        <div class="card__t">公式集</div>
        <div class="card__d" id="calcBsaNote">按主题分组，点击条目进入对应公式 · BSA — m²（来自「EF·参考值」页上方）</div>
      </div>

      <!-- 搜索：条目较多，顶部常驻过滤（输入即筛，不再往下翻长列表） -->
      <div class="fx-search">
        <input id="fxSearch" class="fx-search__i" type="search" autocomplete="off"
               placeholder="搜索公式 / 评估 / 视频，如 EF、TAPSE、房间隔">
        <button class="fx-search__x" id="fxSearchClear" hidden>✕</button>
      </div>

      <div id="calcList"></div>

      <!-- 参考文献（列表由 app.js 渲染；默认折叠，点标题才展开全部） -->
      <div class="card" id="calcRefs">
        <div class="card__t refs-hd" id="refsToggle" role="button" tabindex="0"
             aria-expanded="false" aria-controls="calcRefList">
          <span>参考文献</span>
          <span class="refs-hd__n" id="refsCount"></span>
          <span class="refs-hd__a" aria-hidden="true">›</span>
        </div>
        <div class="card__d">本工具全部数据与分级标准的来源，详情页会标注该条目使用的文献编号。点标题展开全部。
          多数条目可免费获取：「ASE PDF / 中文 PDF / 免费全文 PDF / PMC 全文」点开直接下载，
          「免费页面」进去点 PDF 下载即可、不用登录；只有少数标「需订阅」的需要机构订阅。
          「官网」为 ASE 指南总目录或 PHN 数据库主页。</div>
        <div id="calcRefList" hidden></div>
        <div class="refs-copy">
          带「中文 PDF」标记的条目为本站收录的公开指南 / 专家共识原文；「中文全文」为指向中华医学知识库
          免费在线全文的链接（本站不存储）。著作权均归原作者与发布机构所有，
          仅供个人学习参考，不作商业用途；若权利人认为不宜转载，请联系删除。
        </div>
      </div>

      <div class="verline">心脏超声参考值 · v${APP_VERSION}</div>
      <div class="note note--warn">
        公式来源：ASE/EACVI 2015 定量指南、ESC/ERS 2022 肺高压指南、Hatle（MVA = 220/PHT）、
        Abbas（PVR 经验公式）。仅供速查与学习，不构成诊断依据。
      </div>
    </div>

    <!-- 视图二：单个公式详情 -->
    <div id="calcDetail" hidden>
      <button class="fx-back" id="calcBack">‹ 返回公式集</button>
      <div id="calcGroups"></div>
      <button class="btn btn--ghost" id="calcClear">清空本组输入</button>
    </div>

    <!-- 视图三：专辑（整本书 / 整套视频的切面列表） -->
    <div id="calcAlbum" hidden>
      <button class="fx-back" id="albumBack">‹ 返回公式集</button>
      <div class="card">
        <div class="card__t" id="albumTitle"></div>
        <div class="card__d" id="albumDesc"></div>
        <div class="fx-gnote" id="albumNote" hidden></div>
      </div>
      <div id="albumList"></div>
    </div>
  </section>

${SEG_HTML}

  <!-- ───── Tab5 儿童 Z 值 ───── -->
  <section class="page" id="page-peds" hidden>
    <div class="card">
      <div class="card__t">受检者信息</div>
      <div class="card__d">儿童心脏尺寸随生长变化，Z 值按体表面积（BSA）标准化，与年龄、性别无临床显著关系</div>
      <div class="row">
        <div class="field">
          <label class="field__l">身高 / cm</label>
          <input class="field__i" type="number" inputmode="decimal" id="pdHeight" placeholder="如 110" step="0.1">
        </div>
        <div class="field">
          <label class="field__l">体重 / kg</label>
          <input class="field__i" type="number" inputmode="decimal" id="pdWeight" placeholder="如 19" step="0.1">
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label class="field__l">年龄 / 岁（选填）</label>
          <input class="field__i" type="number" inputmode="decimal" id="pdAge" placeholder="如 5" step="1">
        </div>
        <div class="field">
          <label class="field__l">性别（选填）</label>
          <div class="seg" data-seg="pdsex">
            <div class="seg__i seg__i--on" data-v="male">男</div>
            <div class="seg__i" data-v="female">女</div>
          </div>
        </div>
      </div>
      <div class="stat-row">
        <div class="stat">
          <div class="stat__main">
            <span class="stat__v" id="pdBsa">—</span>
            <span class="stat__u">m²</span>
          </div>
          <span class="stat__l">体表面积（Haycock）</span>
        </div>
        <div class="stat">
          <div class="stat__main">
            <span class="stat__v" id="pdBmi">—</span>
            <span class="stat__u">kg/m²</span>
          </div>
          <span class="stat__l">BMI（儿童请对照百分位）</span>
        </div>
      </div>
      <div class="hint" id="pdWarn"></div>
    </div>

    <div class="card">
      <div class="card__t">测量值输入</div>
      <div class="card__d">内径 mm · 容积 mL · 质量 g · 面积 cm² · 留空跳过</div>
      <div id="pdInputs"></div>
      <button class="btn btn--ghost" id="pdMore">展开其他参数（共 33 项）</button>
      <button class="btn" id="pdClear">清空全部测量值</button>
    </div>

    <div class="card" id="pdFuncCard" hidden>
      <div class="card__t">收缩功能（自动推算）</div>
      <div class="card__d" id="pdFuncDesc"></div>
      <div class="funcef">
        <span class="funcef__v" id="pdFuncEf">—</span>
        <span class="funcef__side">
          <span>左室射血分数 EF</span>
          <span class="tag" id="pdFuncEfTag"></span>
        </span>
      </div>
      <div class="kv" id="pdFuncKv"></div>
      <div class="note" id="pdFuncNote"></div>
    </div>

    <div class="card" id="pdSumCard" hidden>
      <div class="card__t">结果摘要</div>
      <div class="zbig" id="pdSumBig">
        <span class="zbig__v" id="pdSumV">0</span>
        <span class="zbig__l" id="pdSumLbl"></span>
      </div>
      <div class="note" id="pdWorst"></div>
      <div class="key">
        <div class="key__i key__i--n">|Z| ≤ 2<br>正常</div>
        <div class="key__i key__i--m">2 &lt; |Z| ≤ 3<br>轻度异常</div>
        <div class="key__i key__i--s">|Z| &gt; 3<br>显著异常</div>
      </div>
    </div>

    <div class="card">
      <div class="card__t">Z 值对照</div>
      <div class="card__d" id="pdDesc"></div>
      <div id="pdList"></div>
    </div>

    <div class="card">
      <div class="card__t">完整数值区间（±2SD / ±3SD）</div>
      <div class="card__d">±2SD 为异常判定线，±3SD 为显著异常判定线</div>
      <div id="pdRanges"></div>
    </div>

    <div class="card">
      <div class="card__t">计算原理</div>
      <div class="note">
        <b>① 体表面积（Haycock）</b><br>
        BSA(m²) = 0.024265 × 身高(cm)<sup>0.3964</sup> × 体重(kg)<sup>0.5378</sup>
      </div>
      <div class="note">
        <b>② Z 值</b><br>
        Z = ( 实测值 ÷ BSA<sup>α</sup> − Mean ) ÷ SD<br>
        α / Mean / SD 为每项参数各自的回归系数
      </div>
      <div class="note">
        <b>③ 为什么儿童不看固定区间</b><br>
        新生儿 LVEDD 2 cm 属正常，成人 2 cm 属严重缩小。Z 值把测值按体型标准化，
        Z = 0 即人群均值，|Z| ≤ 2 覆盖约 95% 健康儿童。
      </div>
      <div class="note note--warn">
        <b>数据来源</b>　Pediatric Heart Network Normal Echocardiogram Database，
        n = 3566，0–18 岁健康非肥胖儿童，19 个中心。<br>
        Lopez L, Colan S, et al. <i>Circ Cardiovasc Imaging.</i> 2017;10(11):e006979.<br>
        LVESD / LVESV 系数来自 PHN 后续补充发表（PMC7870534）。
      </div>
    </div>
  </section>

<footer class="copyfoot">
  <b>EchoRef · 心脏超声参考工具</b><br>
  手机端小程序：<b>心超参数助手</b>（备案中，上线后开通）<br>
  内容为原创整理与公开指南摘编，仅供专业医务人员学习参考，不作为诊断依据。<br>
  禁止去除署名后转载、镜像或用于商业用途。© 2026 heiqingyu
</footer>

</main>

<!-- ══════════ 底部页签 ══════════ -->
<nav class="tabbar" id="tabbar">
  <div class="tab tab--on" data-tab="index">
    <span class="tab__i">◧</span><span class="tab__t">EF·参考值</span>
  </div>
  <div class="tab" data-tab="peds">
    <span class="tab__i">◎</span><span class="tab__t">儿童 Z 值</span>
  </div>
  <div class="tab" data-tab="segments">
    <span class="tab__i">◭</span><span class="tab__t">节段划分</span>
  </div>
  <div class="tab" data-tab="calc">
    <span class="tab__i">∑</span><span class="tab__t">公式集</span>
  </div>
</nav>

<script>
${coreSrc}

${pedsSrc}

${calcSrc}

${segSrc}

${valveSvgSrc}

${valveSrc}

${mdSrc}

${extraSrc}

${notesSrc}
${materialsSrc}

${js}
</script>
</body>
</html>
`;

const wwwHtml = insertPubnote(html);
fs.writeFileSync(OUT, wwwHtml, 'utf8');
const kb = (Buffer.byteLength(wwwHtml, 'utf8') / 1024).toFixed(1);
console.log('✅ 已生成 ' + path.relative(ROOT, OUT) + '  (' + kb + ' KB)');

/* ══════════════════════════════════════════════════════════
   发布版：仅保留 PUBLIC_TABS 三个页签 + 对应引擎，去掉转载内容
   ══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   发布版：仅保留 PUBLIC_TABS 三个页签 + 对应引擎，去掉转载内容
   ══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   发布版：仅保留 PUBLIC_TABS 三个页签 + 对应引擎，去掉转载内容
   ══════════════════════════════════════════════════════════ */


/**
 * 按 section 的开闭标签配对，删掉指定 id 的整段（含其后紧跟的换行）。
 *
 * 为什么不用非贪婪正则：section 内部还会出现 <section>，
 * 正则会在第一个 </section> 处提前截断，导致内容残留。
 */
function removeSectionById(out, id) {
  const open = new RegExp('^[ \\t]*<section class="page" id="' + id + '"', 'm');
  const m = open.exec(out);
  if (!m) throw new Error('发布版：未找到页面容器 ' + id);

  let depth = 0;
  const tagRe = /<\/?section\b/g;
  tagRe.lastIndex = m.index;
  let t;
  while ((t = tagRe.exec(out)) !== null) {
    if (t[0][1] === '/') {
      depth -= 1;
      if (depth === 0) {
        let end = t.index + t[0].length;
        // ★ 正则只吃到 '</section'，尾巴的 '>' 不消费掉会在页面上漏出一个可见字符
        //   （2026-10-22 实测：发布版节段页前多了一行「>」）
        if (out[end] === '>') end += 1;
        while (end < out.length && (out[end] === '\n' || out[end] === '\r')) end += 1;
        return out.slice(0, m.index) + out.slice(end);
      }
    } else {
      depth += 1;
    }
  }
  throw new Error('发布版：页面容器 ' + id + ' 未闭合');
}

/**
 * 按"整段"删除 CSS 块。
 * 从含 startMark 的那一行（含其上方的 /* 开头行）开始，删到 endMark 所在行之前；
 * endMark 为 null 时删到 </style> 之前。
 * 用行索引定位，避免正则 [\s\S]*? 反向吞掉后面的结构。
 */
function stripCssBlock(src, startMark, endMark) {
  const lines = src.split('\n');
  const i = lines.findIndex(function (l) { return l.indexOf(startMark) !== -1; });
  if (i === -1) throw new Error('发布版：未找到 CSS 块 ' + startMark);

  // 若上一行是块注释开头 "/*"，一并从那里开始删
  let from = i;
  if (from > 0 && lines[from - 1].trim().indexOf('/*') === 0) from -= 1;

  // 结束行
  let to = -1;
  for (let j = i + 1; j < lines.length; j += 1) {
    if (endMark === null) {
      if (lines[j].indexOf('</style>') !== -1) { to = j; break; }
    } else if (lines[j].indexOf(endMark) !== -1) {
      to = j; break;
    }
  }
  if (to === -1) throw new Error('发布版：未找到 CSS 块结束标记 ' + (endMark || '</style>'));

  lines.splice(from, to - from);
  return lines.join('\n');
}

/**
 * 把完整版精简成发布版。三件事：
 *   1) 去掉不发布的 <section class="page" id="page-X"> 整段（目前只有瓣膜评估）
 *   2) 去掉对应的 <div class="tab" data-tab="X"> 页签
 *   3) 去掉用不到的引擎块（ValveCalc）；Calc / SegSvg 保留
 * 另外给页面加上发布版提示与免责声明。
 */
function buildPublicHtml() {
  // 统一换行符：app.js / 部分数据文件是 CRLF，行级正则与 split('\n') 都会带尾巴 '\r'，
  // 导致 trim 之外的精确比较全部失配。先归一成 LF 再做切块清理。
  let out = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1) v1.5.0：瓣膜评估 / 瓣膜解剖两页已从 HTML 模板里彻底移除（不再是页签），
  //    发布版与完整版页签一致，这里不再需要按页签裁剪。
  //    （保留本函数其余「依赖自检」步骤，防止后续改坏）

  // 3) ValveCalc 引擎保留：v1.4.1 起 AS/AR/MS/MR/TR 是公式集里的普通计算条目，
  //    渲染时直接调 valveCalc()，不能像以前那样整块删掉。
  //    SegSvg 供节段页使用，Calc 供其它公式条目使用。

  // 3b) 删掉 app.js 里被标记为 PUBLIC-CUT 的整块逻辑（v1.5.0 起已无 valve 块，
  //     calc / seg 块里的标记直接由 3c 清掉、内容保留）

  // 3c) 公式集页已发布，calc 段内容保留；清掉残留的切块标记行（只删标记，不删内容）
  out = out.replace(/^[ \t]*\/\*<<<PUBLIC-CUT:[^>]*>>>\*\/[ \t]*\n/gm, '');
  out = out.replace(/^[ \t]*\/\*<<<END-CUT:[^>]*>>>\*\/[ \t]*\n?/gm, '');

  // 4) 清理残留（按「先整行删除、后统一替换」顺序，避免行粘连）
  // 4a) 整行删除：引用已切块内容的语句、指向被删页面的条目
  const DROP_LINES = [
    /^[ \t]*valveivc: function[^\n]*\n/m,
    /^[ \t]*valves: '瓣膜评估',[^\n]*\n/m,
    // 已切块的引擎/页面，其顶部声明与页签分派也要摘掉（Calc / SegSvg 引擎均保留）
    /^[ \t]*if \(name === 'valves'\) renderValves\(\);[^\n]*\n/m,
    /^[ \t]*<!--[^\n]*瓣膜评估[^\n]*-->[^\n]*\n/m,
    /^[ \t]*\/\/[^\n]*瓣膜评估[^\n]*\n/m,
  ];
  DROP_LINES.forEach((re) => { out = out.replace(re, ''); });

  // 4b) 发布版没有 valves 页，凡是对它的调用都是死代码，整行删掉。
  //     —— 节段划分页已回归发布版，renderSegAll() / clearSeg 相关调用必须保留。
  //     注意：必须先删「裸调用」，再删「带守卫的调用」—— 顺序反了的话，
  //     第一步刚生成的 if (window.__HAS_*) 行在同一趟里匹配不到，会漏进产物。
  const DEAD_CALLS = [
    // 裸调用（app.js 原始形态）——公式集页已发布，其调用必须保留
    'renderValves();',
    'clearValves();',
    "if (name === 'valves') renderValves();",
    // 带守卫的调用（上一步包裹后可能出现）
    'if (window.__HAS_VALVE) renderValves();',
    'if (window.__HAS_VALVE) clearValves();',
  ];
  out = out.split('\n')
    .filter(function (line) { return DEAD_CALLS.indexOf(line.trim()) === -1; })
    .join('\n');

  // 4c) 注释与文案清理
  out = out
    .replace(/\/\* ────────── 其他计算页：结果行 ────────── \*\//, '/* ────────── 计算结果行样式 ────────── */');

  // 4d) 公式集页已进入发布版，其样式（.fx-* / 表格 / 参考文献）一并保留

  // 4e) 剥掉被删页面的专属样式块（按「起止注释行」整段去掉，不用贪婪正则）
  //     —— .calc-out 保留（EF / 儿童 Z 值页也在用）；节段划分页已回归，其 CSS 必须保留。
  out = stripCssBlock(out,
    '   瓣膜评估页（AS / AR / MS / MR / TR）',
    null   // 一直删到 <style> 结束
  );

  // 5) 兜底自检：被移除的页面 id / 入口 / 样式不得残留  //    ★ 节段划分页已回归发布版，故 'id="page-segments"' / '.bull-wrap' / '.vswitch'
  //      等节段相关标记不再是「残留」，已移到 5b 的「必须存在」清单。
  ['id="page-valves"', 'data-go="valves"',
   'PUBLIC-CUT', 'END-CUT',
   '瓣膜评估页', '.vchip', '.lvl--severe', '.vsum',
   // 「肝静脉」不再作为残留标记：公式集「右心功能分级与右心衰」「缩窄 vs 限制型」
   // 两条判读合法引用肝静脉血流频谱，不能再据此判定瓣膜页残留。
   // 「Wilkins」也不再是残留标记：v1.3.0 起公式集有 Wilkins 形态评分计算器。
   // PISA / EROA 属于 echo-calc.js 的通用公式注释，发布版保留 Calc 引擎，故不禁止
   'renderValves', 'clearValves', '__HAS_']
    .forEach((s) => {
      if (out.indexOf(s) !== -1) {
        const at = out.indexOf(s);
        const ctx = out.slice(Math.max(0, at - 140), at + 60).replace(/\s+/g, ' ');
        throw new Error('发布版：仍残留 ' + s + '  >>  ' + ctx);
      }
    });

  // 5a2) 不许出现「整行只有一个尖括号」的碎片（切块边界没吃干净会漏成页面可见文字）
  out.split('\n').forEach((l, i) => {
    if (/^[ \t]*[<>][ \t]*$/.test(l)) {
      throw new Error('发布版：第 ' + (i + 1) + ' 行是孤立的尖括号碎片 ' + JSON.stringify(l));
    }
  });

  // 5b2) 公式集页已发布：其依赖必须齐全（引擎 / 数据 / 目录容器 / 样式）
  ['id="calcIndex"', 'id="calcList"', 'id="calcDetail"', 'id="calcBack"',
   'id="calcRefs"', 'id="calcRefList"',
   'window.Calc', 'window.ExtraData', 'BRIEF_SECTIONS', 'LINK_SECTIONS', 'REFS',
   'buildCalcInputs', 'renderCalc', 'openCalcGroup', '.fx-item', '.fx-tbl__c', '.ref-item__zh',
   // ★ 2026-10-21：.fx-nav / .ref-dl / .chip 的 CSS 块必须留在 app.css 的
   //   「瓣膜专页」注释之前——stripCssBlock 会把该注释到 </style> 整段删掉。
   //   曾经把 .fx-nav 追加到文件末尾，发布版跳转条退化成无样式蓝色裸链接。
   '.fx-nav {', '.fx-nav__c {', '.ref-dl__i {', '.chip {',
   // 瓣膜专用定量进公式集后，引擎必须留在发布版
   'window.ValveCalc', 'valveCalc']
    .forEach((s) => {
      if (out.indexOf(s) === -1) throw new Error('发布版：公式集依赖缺失 ' + s);
    });

  // 5b2b) 节段划分页必须存在（APK 打的也是本发布版，用户需能在手机上看到室壁划分）
  ['id="page-segments"', 'data-tab="segments"',
   'window.SegSvg', 'renderSegAll', 'SegSvg.bullseyeSvg', 'data-seg',
   '.bull-wrap', '.terr-chip', '.segchip', '.wall-card', '.wallsvg-box',
   '17 节段模型与冠脉供血']
    .forEach((s) => {
      if (out.indexOf(s) === -1) throw new Error('发布版：节段划分页依赖缺失 ' + s);
    });

  // 5b2c) 瓣膜解剖已并入公式集：引擎、渲染函数、分区按钮必须齐全，
  //       但不能再有独立的 page-valveana 页面与页签
  ['window.ValveSvg', 'renderValveAna', 'ValveSvg.VALVE_VIEWS', 'data-vap', 'data-part',
   '瓣膜解剖 · TEE 标准切面', 'va-probe']
    .forEach((s) => {
      if (out.indexOf(s) === -1) throw new Error('发布版：公式集内瓣膜解剖依赖缺失 ' + s);
    });
  ['id="page-valveana"', 'data-tab="valveana"', 'id="page-valves"', 'data-tab="valves"']
    .forEach((s) => {
      if (out.indexOf(s) !== -1) throw new Error('发布版：仍残留独立瓣膜页 ' + s);
    });

  // 5b) 结构完整性自检：切块/删行容易把 HTML 骨架带掉，必须逐项确认
  ['</style>', '</head>', '<body', '</body>', '</html>', '<nav class="tabbar" id="tabbar"',
   'id="page-index"', 'id="page-segments"', 'id="page-peds"', 'id="page-calc"']
    .forEach((s) => {
      if (out.indexOf(s) === -1) throw new Error('发布版：结构缺失 ' + s);
    });
  // 页签数量必须等于 PUBLIC_TABS
  const nTab = (out.match(/class="tab[ "][^>]*data-tab="/g) || []).length;
  if (nTab !== PUBLIC_TABS.length) {
    throw new Error('发布版：页签数 ' + nTab + ' ≠ ' + PUBLIC_TABS.length);
  }

  // 6) 「关于本页」说明块：只在公式集页末尾放一处（用户 2026-10-21 反馈）
  out = insertPubnote(out);

  return out;
}

if (process.argv.indexOf('--full') === -1) {
  const publicHtml = buildPublicHtml();
  fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'docs', 'index.html'), publicHtml, 'utf8');
  fs.writeFileSync(path.join(ROOT, 'docs', '.nojekyll'), '', 'utf8');
  console.log('✅ 已生成 ' + path.join('docs', 'index.html') +
    '  (' + (Buffer.byteLength(publicHtml, 'utf8') / 1024).toFixed(1) + ' KB，仅 ' +
    PUBLIC_TABS.length + ' 个页签)');
}

// 自检：确认引擎函数都挂上了
const missing = [];
['bsaDuBois', 'bsaMosteller', 'computeLVFunction', 'computeLVM', 'buildReferenceList'].forEach((n) => {
  if (!new RegExp('\\b' + n + ':').test(coreSrc)) missing.push('Core.' + n);
});
['bsaHaycock', 'zScore', 'buildPedsList'].forEach((n) => {
  if (!new RegExp('\\b' + n + ':').test(pedsSrc)) missing.push('Peds.' + n);
});
['csaFromDiameter', 'pisa', 'rapFromIvc', 'phProbability', 'diastolicRatios'].forEach((n) => {
  if (!new RegExp('\\b' + n + ':').test(calcSrc)) missing.push('Calc.' + n);
});
['valveCalc', 'pisaEroa', 'rapOf', 'gTrRvol', 'gAva'].forEach((n) => {
  if (!new RegExp('\\b' + n + ':').test(valveSrc)) missing.push('ValveCalc.' + n);
});
if (missing.length) {
  console.log('⚠️  以下引擎函数未被导出：' + missing.join(', '));
  process.exit(1);
}
console.log('✅ 引擎函数导出自检通过（Core 5 项 + Peds 3 项 + ValveCalc 5 项）');
