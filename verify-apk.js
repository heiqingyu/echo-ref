/**
 * APK 端到端一致性验证
 *
 * 核心目标：证明 **APK 里的引擎** 与 **小程序的引擎** 算出的数值完全一致。
 *
 * 做法：
 *   1. 从 www/index.html 中抽出内联的引擎代码，在沙箱里执行，得到 window.Core / window.Peds
 *   2. 直接 require 小程序的 utils/*.js
 *   3. 对同一批输入逐一比对输出（到浮点精度）
 *
 * 运行：node verify-apk.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const WWW = path.join(ROOT, 'www', 'index.html');
const DOCS = path.join(ROOT, 'docs', 'index.html');

let pass = 0, fail = 0;
const problems = [];

function check(label, actual, expected, tol) {
  const t = tol === undefined ? 1e-9 : tol;
  let ok;
  if (expected === null || expected === undefined) {
    ok = actual === expected || (typeof expected === 'number' && isNaN(actual) && isNaN(expected));
  } else if (typeof expected === 'number') {
    ok = typeof actual === 'number' && !isNaN(actual) && Math.abs(actual - expected) <= t;
  } else {
    ok = actual === expected;
  }
  if (ok) pass++;
  else {
    fail++;
    problems.push('  ✗ ' + label + '\n      期望 ' + JSON.stringify(expected) + '  实得 ' + JSON.stringify(actual));
  }
}

function section(t) {
  console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 56 - t.length)));
}

/* ══════════════════════════════════════════════════════════
   1. 从 index.html 抽出引擎代码并在沙箱执行
   ══════════════════════════════════════════════════════════ */

section('1. 构建产物完整性');

check('www/index.html 存在', fs.existsSync(WWW), true);

const html = fs.readFileSync(WWW, 'utf8');
// ★ APK 打包源 = docs/index.html（4 页签）。用户明确：不要「瓣膜评估」单独页，
//   它的判读条目本来就在公式集的「瓣膜评估」组里；只有 5 个瓣膜计算器依赖该页。
//   但「节段划分」（室壁划分）必须保留 —— 这是之前 app 内容比小程序少的原因。
check('www 完整版体积 < 1050 KB', Buffer.byteLength(html, 'utf8') < 1050 * 1024, true);
check('docs 发布版存在（APK 打包源）', fs.existsSync(DOCS), true);
if (fs.existsSync(DOCS)) {
  const dh = fs.readFileSync(DOCS, 'utf8');
  check('docs 发布版体积 < 1000 KB（6 组 77 条评估 + 79 条文献）', Buffer.byteLength(dh, 'utf8') < 1000 * 1024, true);
  check('docs 发布版不含瓣膜单独页', dh.indexOf('id="page-valves"') === -1, true);
  check('docs 发布版含节段划分页', dh.indexOf('id="page-segments"') !== -1, true);
  // v1.5.0：瓣膜解剖不再是页签，改成公式集里的一条
  check('docs 发布版不含独立瓣膜解剖页', dh.indexOf('id="page-valveana"') === -1, true);
  check('docs 发布版公式集里有瓣膜解剖条目', dh.indexOf('瓣膜解剖 · TEE 标准切面') !== -1, true);
  check('docs 发布版内联 ValveSvg 引擎', dh.indexOf('window.ValveSvg = {') !== -1, true);
  // 页尾「继续看其他页面」已于 2026-10-22 移除（底部页签已经够用）
  check('docs 发布版不再有页尾「继续看其他页面」', dh.indexOf('pagefoot') === -1, true);
  // v1.4.1：AS/AR/MS/MR/TR 进公式集，ValveCalc 引擎必须随包
  check('docs 发布版保留 ValveCalc 引擎（瓣膜计算条目要用）',
    dh.indexOf('window.ValveCalc = {') !== -1, true);
}
// APK 实际打包源：android-app/assets/index.html 必须与 docs 完全一致
const ASSET = path.join(ROOT, 'android-app', 'assets', 'index.html');
check('android-app/assets/index.html 存在', fs.existsSync(ASSET), true);
if (fs.existsSync(ASSET) && fs.existsSync(DOCS)) {
  const ah = fs.readFileSync(ASSET, 'utf8');
  const dh2 = fs.readFileSync(DOCS, 'utf8');
  check('APK 打包源与 docs 完全一致（字节数相等 + 内容相等）',
    Buffer.byteLength(ah, 'utf8') === Buffer.byteLength(dh2, 'utf8') && ah === dh2,
    true);
  check('APK 内不含瓣膜单独页（用户要求）', ah.indexOf('id="page-valves"') === -1, true);
  check('APK 内含节段划分页（室壁划分）', ah.indexOf('id="page-segments"') !== -1, true);
  check('APK 内不含独立瓣膜解剖页', ah.indexOf('id="page-valveana"') === -1, true);
  check('APK 公式集含瓣膜解剖条目', ah.indexOf('瓣膜解剖 · TEE 标准切面') !== -1, true);
  check('APK 内 4 个页签（与小程序一致）', (ah.match(/class="tab[ "][^>]*data-tab="/g) || []).length, 4);
  // 公式集里必须仍能查到瓣膜评估这一组（否则「公式集里有就行」就不成立）
  check('APK 公式集仍含「瓣膜评估」组', ah.indexOf("title: '瓣膜评估'") !== -1 ||
    ah.indexOf('瓣膜评估') !== -1, true);
}

// 抽取 <script> 里两个 IIFE 引擎块
const coreMatch = html.match(/\/\* ── 引擎：echo-core\.js[\s\S]*?\n\}\)\(\);/);
const pedsMatch = html.match(/\/\* ── 引擎：peds-zscore\.js[\s\S]*?\n\}\)\(\);/);
const calcMatch = html.match(/\/\* ── 引擎：echo-calc\.js[\s\S]*?\n\}\)\(\);/);
const valveMatch = html.match(/\/\* ── 引擎：valve-calc\.js[\s\S]*?\n\}\)\(\);/);

check('已内联 echo-core 引擎', !!coreMatch, true);
check('已内联 peds-zscore 引擎', !!pedsMatch, true);
check('已内联 echo-calc 引擎', !!calcMatch, true);
check('已内联 valve-calc 引擎', !!valveMatch, true);

if (!coreMatch || !pedsMatch) {
  console.log('\n无法抽取引擎代码，终止。');
  process.exit(1);
}

// 在沙箱里跑，模拟 window
const sandbox = { window: {}, Math: Math, Number: Number, console: console };
vm.createContext(sandbox);
vm.runInContext(coreMatch[0], sandbox);
vm.runInContext(pedsMatch[0], sandbox);
vm.runInContext(calcMatch[0], sandbox);
vm.runInContext(valveMatch[0], sandbox);

const ApkCore = sandbox.window.Core;
const ApkPeds = sandbox.window.Peds;
const ApkCalc = sandbox.window.Calc;
const ApkValve = sandbox.window.ValveCalc;

check('APK Core 已挂载', !!ApkCore, true);
check('APK Peds 已挂载', !!ApkPeds, true);
check('APK Calc 已挂载', !!ApkCalc, true);
check('APK ValveCalc 已挂载', !!ApkValve, true);

// 页面结构自检
check('包含 4 个页面容器（EF / 节段 / 儿童 / 公式集）', (html.match(/class="page"/g) || []).length, 4);
// 注意：第一个页签的 class 是 "tab tab--on"，所以要用 \btab\b 而非 class="tab"
check('包含 4 个底部页签', (html.match(/class="tab(?:\s|")/g) || []).length, 4);
check('含 viewport meta（移动端适配）', /name="viewport"/.test(html), true);
check('含 safe-area 适配', /safe-area-inset/.test(html), true);

/* ══════════════════════════════════════════════════════════
   2. 与小程序引擎逐项比对
   ══════════════════════════════════════════════════════════ */

section('2. 与小程序的引擎比对（数值一致性）');

const MpCore = require(path.join(ROOT, 'miniprogram', 'utils', 'echo-core.js'));
const MpPeds = require(path.join(ROOT, 'miniprogram', 'utils', 'peds-zscore.js'));

// 2.1 BSA
const cases = [
  [170, 65], [175, 70], [160, 55], [180, 80], [100, 15], [50, 3.4], [110, 19],
];
cases.forEach(function (c, i) {
  check('bsaDuBois(' + c[0] + ',' + c[1] + ')',
    ApkCore.bsaDuBois(c[0], c[1]), MpCore.bsaDuBois(c[0], c[1]));
  check('bsaMosteller(' + c[0] + ',' + c[1] + ')',
    ApkCore.bsaMosteller(c[0], c[1]), MpCore.bsaMosteller(c[0], c[1]));
  check('bsaHaycock(' + c[0] + ',' + c[1] + ')',
    ApkPeds.bsaHaycock(c[0], c[1]), MpPeds.bsaHaycock(c[0], c[1]));
});

// 2.2 Teichholz / EF / LVM / RWT
const lvCases = [[50, 32], [46, 28], [60, 50], [72, 64], [38, 22]];
lvCases.forEach(function (c) {
  const a = ApkCore.computeLVFunction(c[0], c[1]);
  const m = MpCore.computeLVFunction(c[0], c[1]);
  ['EDV', 'ESV', 'SV', 'EF', 'FS'].forEach(function (k) {
    check('computeLVFunction(' + c + ').' + k, a[k], m[k]);
  });
});

const lvmCases = [[50, 9, 9, 1.7536], [60, 12, 11, 2.0], [45, 8, 8, 1.5]];
lvmCases.forEach(function (c) {
  const a = ApkCore.computeLVM(c[0], c[1], c[2], c[3]);
  const m = MpCore.computeLVM(c[0], c[1], c[2], c[3]);
  check('computeLVM(' + c + ').LVM', a.LVM, m.LVM);
  check('computeLVM(' + c + ').LVM/BSA', a['LVM/BSA'], m['LVM/BSA']);
});

check('computeRWT(50,9)', ApkCore.computeRWT(50, 9), MpCore.computeRWT(50, 9));
check('teichholzVolume(5.0)', ApkCore.teichholzVolume(5.0), MpCore.teichholzVolume(5.0));

// 2.3 参考值列表（CN + ASE，各性别，带 BSA）
['male', 'female'].forEach(function (sex) {
  ['CN', 'ASE'].forEach(function (std) {
    [1.5, 1.7536, 2.0].forEach(function (bsa) {
      const measured = {
        LVEDD: 50, LVESD: 32, IVSd: 9, LVPWd: 9, LVEDV: 118.2, LVESV: 41,
        EF: 65.4, LVEF: 65.4, FS: 34, LVM: 158.2, 'LVM/BSA': 90.2,
      };
      const a = ApkCore.buildReferenceList(sex, measured, std, bsa);
      const m = MpCore.buildReferenceList(sex, measured, std, bsa);

      check('buildReferenceList(' + sex + ',' + std + ',' + bsa + ') 长度', a.length, m.length);

      let diffRow = null;
      for (let i = 0; i < a.length; i++) {
        const keys = ['key', 'name', 'unit', 'value', 'range', 'status', 'statusText',
          'statusCls', 'hasValue', 'derivedText', 'derivedUnit', 'hasDerived'];
        for (const k of keys) {
          if (a[i][k] !== m[i][k]) { diffRow = a[i].key + '.' + k + ' (' + a[i][k] + ' vs ' + m[i][k] + ')'; break; }
        }
        if (diffRow) break;
      }
      check('buildReferenceList(' + sex + ',' + std + ',' + bsa + ') 逐字段一致', diffRow, null);
    });
  });
});

// 2.4 儿童 Z 值
const pedsInputs = [
  { bsa: 0.450894, m: { LVEDD: 38, LVESD: 25, LVM: 20 } },
  { bsa: 0.761907, m: { LVEDD: 42, LVESD: 28, LVST: 6, LVPWT: 6, LVEDV: 48, LVESV: 18, LVM: 34, ROOT: 18, MPA: 14, ANN: 13 } },
  { bsa: 1.2, m: { LVEDD: 45, ROOT: 24, MPA: 20, LMCA: 3, LVSI: 1.6 } },
];
pedsInputs.forEach(function (c, i) {
  const a = ApkPeds.buildPedsList(c.bsa, c.m);
  const m = MpPeds.buildPedsList(c.bsa, c.m);

  check('buildPedsList#' + i + ' 长度', a.length, m.length);

  let diffRow = null;
  for (let j = 0; j < a.length; j++) {
    const keys = ['key', 'name', 'unit', 'value', 'z', 'zText', 'rangeText',
      'range3Text', 'meanText', 'status', 'statusText', 'statusCls', 'hasValue'];
    for (const k of keys) {
      const x = a[j][k], y = m[j][k];
      const same = (typeof x === 'number' && typeof y === 'number')
        ? Math.abs(x - y) < 1e-9
        : x === y;
      if (!same) { diffRow = a[j].key + '.' + k + ' (' + x + ' vs ' + y + ')'; break; }
    }
    if (diffRow) break;
  }
  check('buildPedsList#' + i + ' 逐字段一致', diffRow, null);
});

// 2.5 系数表必须完全相同
check('PEDS_Z 参数数一致',
  Object.keys(ApkPeds.PEDS_Z).length, Object.keys(MpPeds.PEDS_Z).length);
check('PEDS_FIELDS 顺序一致',
  ApkPeds.PEDS_FIELDS.join(','), MpPeds.PEDS_FIELDS.join(','));
check('PEDS_GROUPS 一致',
  JSON.stringify(ApkPeds.PEDS_GROUPS), JSON.stringify(MpPeds.PEDS_GROUPS));

let coefDiff = null;
Object.keys(MpPeds.PEDS_Z).forEach(function (k) {
  const a = ApkPeds.PEDS_Z[k], m = MpPeds.PEDS_Z[k];
  if (a.a !== m.a || a.mean !== m.mean || a.sd !== m.sd || a.unit !== m.unit || a.name !== m.name) {
    coefDiff = k;
  }
});
check('33 项系数逐项相同', coefDiff, null);

// 2.6 CN / ASE 参数清单一致
check('CN_FIELDS 一致', ApkCore.CN_FIELDS.join(','), MpCore.CN_FIELDS.join(','));
check('ASE_FIELDS 一致', ApkCore.ASE_FIELDS.join(','), MpCore.ASE_FIELDS.join(','));
check('BSA_INDEX_MAP 一致',
  JSON.stringify(ApkCore.BSA_INDEX_MAP), JSON.stringify(MpCore.BSA_INDEX_MAP));
check('STATUS_TEXT 一致',
  JSON.stringify(ApkCore.STATUS_TEXT), JSON.stringify(MpCore.STATUS_TEXT));

// 2.7 gradeEF / judgeRange / gradeZ 边界
[[60, 'normal'], [50, 'mild'], [40, 'moderate'], [20, 'severe']].forEach(function (c) {
  check('gradeEF(' + c[0] + ').level', ApkCore.gradeEF(c[0]).level, c[1]);
  check('gradeEF(' + c[0] + ') == 小程序',
    ApkCore.gradeEF(c[0]).level, MpCore.gradeEF(c[0]).level);
});

[[2.0, 'normal'], [2.01, 'mild'], [3.0, 'mild'], [3.01, 'severe'], [-4, 'severe'], [0, 'normal']]
  .forEach(function (c) {
    check('gradeZ(' + c[0] + ').level', ApkPeds.gradeZ(c[0]).level, c[1]);
  });

// ── Calc 引擎一致性（APK 内联 vs 小程序源码） ──
const MpCalc = require(path.join(ROOT, 'miniprogram', 'utils', 'echo-calc.js'));

check('Calc strokeVolume(2,20)', ApkCalc.round(ApkCalc.strokeVolume(2, 20), 4),
  MpCalc.round(MpCalc.strokeVolume(2, 20), 4));
check('Calc bernoulli(4,1)', ApkCalc.bernoulli(4, 1), MpCalc.bernoulli(4, 1));
check('Calc avaContinuity(62.83,30)', ApkCalc.round(ApkCalc.avaContinuity(62.83, 30), 6),
  MpCalc.round(MpCalc.avaContinuity(62.83, 30), 6));
check('Calc mvaPht(220)', ApkCalc.mvaPht(220), MpCalc.mvaPht(220));
check('Calc pisa(0.8,40,5,150).eroa', ApkCalc.round(ApkCalc.pisa(0.8, 40, 5, 150).eroa, 8),
  MpCalc.round(MpCalc.pisa(0.8, 40, 5, 150).eroa, 8));
check('Calc rapFromIvc(25,"no")', ApkCalc.rapFromIvc(25, 'no'), MpCalc.rapFromIvc(25, 'no'));
check('Calc pasp(3,8)', ApkCalc.pasp(3, 8), MpCalc.pasp(3, 8));
check('Calc pvrEstimate(3,15)', ApkCalc.round(ApkCalc.pvrEstimate(3, 15), 8),
  MpCalc.round(MpCalc.pvrEstimate(3, 15), 8));
check('Calc phProbability(3.0,false)', ApkCalc.phProbability(3.0, false),
  MpCalc.phProbability(3.0, false));
check('Calc gradeAva(1.2)', ApkCalc.gradeAva(1.2).level, MpCalc.gradeAva(1.2).level);
check('Calc gradeEe(10).text', ApkCalc.gradeEe(10).text, MpCalc.gradeEe(10).text);

// ── ValveCalc 引擎一致性（APK 内联 vs 小程序源码） ──
const MpValve = require(path.join(ROOT, 'miniprogram', 'utils', 'valve-calc.js'));

const VALVE_CASES = [
  ['as', { lvotD: 2.0, lvotVti: 22, avVti: 60, avVmax: 4.2, mg: 45 }, 1.8],
  ['as', { lvotD: 2.0, lvotVti: 18, avVti: 50, avVmax: 3.0 }, 1.7],
  ['ar', { radius: 0.6, aliasVa: 40, regV: 5, regVti: 180, vc: 0.7, pht: 300, lvotD: 2.0, lvotVti: 22 }, 1.8],
  ['ms', { mvaPlani: 1.1, pht: 210, mg: 8, pasp: 42 }, 1.8],
  ['mr', { radius: 0.8, aliasVa: 40, regV: 5, regVti: 150, vc: 0.8, dt: 30, lvotD: 2.0, lvotVti: 22 }, 1.8],
  ['tr', { radius: 0.7, aliasVa: 40, regV: 2.8, regVti: 120, vc: 0.75, trV: 3.5, ivc: 24, ivcCollapse: 'no' }, 1.8],
];
VALVE_CASES.forEach(function (c, i) {
  const a = ApkValve.valveCalc(c[0], c[1], c[2]);
  const m = MpValve.valveCalc(c[0], c[1], c[2]);
  check('ValveCalc #' + (i + 1) + ' (' + c[0] + ') 行数与小程序一致', a.rows.length, m.rows.length);
  check('ValveCalc #' + (i + 1) + ' 汇总等级一致', a.level, m.level);
  check('ValveCalc #' + (i + 1) + ' 逐行结果一致',
    JSON.stringify(a.rows), JSON.stringify(m.rows));
  check('ValveCalc #' + (i + 1) + ' 备注一致',
    JSON.stringify(a.notes), JSON.stringify(m.notes));
});
check('ValveCalc pisaEroa(0.8,40,5)', ApkValve.pisaEroa(0.8, 40, 5), MpValve.pisaEroa(0.8, 40, 5));
check('ValveCalc rapOf(25,"no")', ApkValve.rapOf(25, 'no'), MpValve.rapOf(25, 'no'));
check('ValveCalc gTrRvol(46).level', ApkValve.gTrRvol(46).level, MpValve.gTrRvol(46).level);
check('ValveCalc gAva(0.9).level', ApkValve.gAva(0.9).level, MpValve.gAva(0.9).level);
check('ValveCalc gMsMva(1.5).level', ApkValve.gMsMva(1.5).level, MpValve.gMsMva(1.5).level);

/* ══════════════════════════════════════════════════════════
   3. 与「期望值」的独立核对（防止两边一起错）
   ══════════════════════════════════════════════════════════ */

section('3. 独立期望值核对');

// 手算：Teichholz D=5.0cm → 7×125/7.4 = 118.243...
check('Teichholz(5.0) = 118.243', ApkCore.teichholzVolume(5.0), 118.2432, 1e-3);
// 手算：Du Bois 170/65 = 0.007184 × 170^0.725 × 65^0.425
check('Du Bois(170,65) ≈ 1.7536', ApkCore.bsaDuBois(170, 65), 1.7536, 1e-3);
// 手算：Haycock(110,19) = 0.024265 × 110^0.3964 × 19^0.5378
check('Haycock(110,19) ≈ 0.7619', ApkPeds.bsaHaycock(110, 19), 0.761907, 1e-5);
// 手算：Z(LVEDD=3.8cm, bsa=0.450894)
//   BSA^0.45 = 0.698769 ; 3.8/0.698769 = 5.438136
//   Z = (5.438136 − 3.89)/0.33 = 4.691322
check('Z(LVEDD 38mm @bsa .450894) ≈ 4.6913',
  ApkPeds.zScore(3.8, 'LVEDD', 0.450894), 4.691322, 1e-5);
// 同一测值在 bsa=0.4506 下应得 4.6962（BSA 微变即 Z 变，验证 BSA 真的参与计算）
check('Z(LVEDD 38mm @bsa .4506) ≈ 4.6962',
  ApkPeds.zScore(3.8, 'LVEDD', 0.4506), 4.696160, 1e-5);
check('Z 随 BSA 变化（两个 BSA 结果不同）',
  ApkPeds.zScore(3.8, 'LVEDD', 0.450894) !== ApkPeds.zScore(3.8, 'LVEDD', 0.4506), true);
// 手算：成人 BSA 下 LVEDD ±2SD 下界 ≈ 4.26 cm（对上 ASE 4.2）
const adultR2 = ApkPeds.rangeFromZ('LVEDD', ApkPeds.bsaHaycock(175, 70), 2);
check('成人 LVEDD ±2SD 下界 ≈ 4.26', adultR2.lower, 4.2569, 1e-3);
check('成人 LVEDD ±2SD 上界 ≈ 6.00', adultR2.upper, 5.9965, 1e-3);

/* ══════════════════════════════════════════════════════════
   4. 页面结构完整性
   ══════════════════════════════════════════════════════════ */

section('4. 页面元素完整性');

const REQUIRED_IDS = [
  'appbarTitle', 'resetBtn', 'main', 'tabbar',
  'page-index', 'page-calc', 'page-segments', 'page-peds',
  'inHeight', 'inWeight', 'outBsa', 'bsaHint', 'stdNote',
  'jumpRef', 'refBlock', 'refList', 'refDesc', 'refSource', 'aseUnitNote',
  'calcGroups', 'calcClear', 'calcBsaNote', 'calcIndex', 'calcList', 'calcDetail', 'calcBack',
  'calcRefs', 'calcRefList',
  'efLvedd', 'efLvesd', 'efIvsd', 'efLvpwd', 'efResult', 'efKv', 'efMark', 'efGrade',
  'pdHeight', 'pdWeight', 'pdAge', 'pdBsa', 'pdWarn', 'pdInputs', 'pdMore',
  'pdClear', 'pdSumCard', 'pdSumV', 'pdList', 'pdRanges',
];
REQUIRED_IDS.forEach(function (id) {
  check('元素 #' + id + ' 存在', new RegExp('id="' + id + '"').test(html), true);
});

// ── 瓣膜评估：v1.5.0 起并入 aortic / mitral / tr-interv 三个判读条目，不再有独立页 ──
check('不再有瓣膜切换按钮 .vchip', html.indexOf('class="vchip') === -1, true);
check('不再有瓣膜页输入字段 data-vk', (html.match(/data-vk="/g) || []).length, 0);
check('不再有瓣膜页 IVC 选择器', /data-seg="valveivc"/.test(html), false);
['主动脉瓣疾病评估', '二尖瓣疾病评估', '三尖瓣介入（TTVI）'].forEach(function (t) {
  check('判读条目「' + t + '」在包内', html.includes(t), true);
});
// 五个瓣膜的定量分级表与关键指标必须仍在（原瓣膜页的核心内容）
['AVAi', 'DVI', '缩流颈', 'EROA', 'RVol', 'Wilkins', 'massive', 'PASP'].forEach(function (t) {
  check('瓣膜定量要点「' + t + '」仍保留', html.includes(t), true);
});
check('瓣膜判读页带「不作为诊断依据」类提示', /不构成诊断依据|不替代/.test(html), true);
// 瓣膜解剖：13 个 TEE 切面 + 探头小图
check('瓣膜解剖 13 个 TEE 切面全部内联',
  (html.match(/id: '(avTeeSax|avTeeLax|avTgDeepLax|mvTee4c|mvTee2c|mvTeeLax|mvTeeCommissural|mvTee3d|mvTgSax|tvTee4c|tvTeeRvin|tvTeeTgsax|pvTeeSax)'/g) || []).length, 13);
check('探头位置小图渲染函数已内联', html.indexOf('function probeSvg') !== -1, true);
check('探头小图容器样式 .va-probe 已内联', html.indexOf('.va-probe') !== -1, true);

// ── 节段划分页 ──
check('SegSvg 引擎已内联', /wallDiagramSvg/.test(html), true);
check('牛眼图容器 #bullseyeBox', /id="bullseyeBox"/.test(html), true);
check('选中信息行 #segSelInfo', /id="segSelInfo"/.test(html), true);
['PLAX', 'PSAX-B', 'PSAX-M', 'PSAX-A', 'A4C', 'A2C', 'A3C'].forEach(function (v) {
  check('示意图容器 #wd-' + v, new RegExp('id="wd-' + v + '"').test(html), true);
});
check('节段数字按钮 data-selseg（36 个，跨切面重复计数）', (html.match(/data-selseg=/g) || []).length, 36);
check('页签 data-tab="segments" 存在', /data-tab="segments"/.test(html), true);
const segSvgInline = html.match(/<svg[^>]*aria-label="左室17节段牛眼图"[^>]*>[\s\S]*?<\/svg>/);
check('牛眼图 SVG 已内联', !!segSvgInline, true);
check('牛眼图含 17 个节段', segSvgInline ? (segSvgInline[0].match(/data-seg=/g) || []).length : 0, 17);
['LAD · 前降支', 'RCA · 右冠', 'LCx · 回旋支'].forEach(function (t) {
  check('分区色块「' + t + '」', html.includes(t), true);
});
['胸骨旁长轴', '心尖四腔心', '剑突下', '胸骨上窝', 'PSAX 钟面', 'WMSI', '下外侧壁'].forEach(function (t) {
  check('节段页内容「' + t + '」', html.includes(t), true);
});

// 合并后不应再有独立参考值页
check('旧 page-reference 已移除', /id="page-reference"/.test(html), false);
check('旧 refBsa 已移除', /id="refBsa"/.test(html), false);
check('旧快捷跳转按钮已移除', /data-go="reference"/.test(html), false);

// data-seg 分组齐全（calccollapse/calcsigns 为 JS 动态生成，检查组名字面量）
['sex', 'formula', 'standard', 'pdsex'].forEach(function (g) {
  check('分段选择器 data-seg="' + g + '"', new RegExp('data-seg="' + g + '"').test(html), true);
});
['calccollapse', 'calcsigns'].forEach(function (g) {
  check('动态分段选择器组 "' + g + '" 已定义', html.indexOf("'" + g + "'") !== -1, true);
});

// app.js 里引用的 id 必须在 HTML 中存在
const appJs = fs.readFileSync(path.join(ROOT, 'android-app', 'app.js'), 'utf8');
const idRefs = [...new Set((appJs.match(/\$\('([A-Za-z][\w]*)'\)/g) || [])
  .map(function (s) { return s.slice(3, -2); }))];
const missingIds = idRefs.filter(function (id) { return !new RegExp('id="' + id + '"').test(html); });
check('app.js 引用的 ' + idRefs.length + ' 个 id 都存在', missingIds.join(',') || null, null);

/* ── 9. 新增功能：BMI 与儿童收缩功能卡 ───────────────────── */
check('Core.bmi 已导出', typeof ApkCore.bmi, 'function');
check('Core.bmiClass 已导出', typeof ApkCore.bmiClass, 'function');
check('BMI 170/65 = 22.5', ApkCore.round(ApkCore.bmi(170, 65), 1), 22.5, 0.05);
check('bmiClass 22.5 正常', ApkCore.bmiClass(22.5).text, '正常');
check('bmiClass 30 肥胖', ApkCore.bmiClass(30).text, '肥胖');
check('HTML 含 stat-row', /class="stat-row"/.test(html) ? 1 : 0, 1, 0);
check('HTML 含 BMI 展示位 outBmi', /id="outBmi"/.test(html) ? 1 : 0, 1, 0);
check('HTML 含儿童 BMI 展示位 pdBmi', /id="pdBmi"/.test(html) ? 1 : 0, 1, 0);
check('HTML 含儿童收缩功能卡 pdFuncCard', /id="pdFuncCard"/.test(html) ? 1 : 0, 1, 0);
check('app.js 含儿童 EF 推算逻辑', /computeLVFunction\(measured\.LVEDD, measured\.LVESD\)/.test(appJs) ? 1 : 0, 1, 0);
check('app.js 含推算容积代入 Z 值', /zMeasured\.LVEDV === undefined\) zMeasured\.LVEDV = func\.EDV/.test(appJs) ? 1 : 0, 1, 0);

// 引擎数据同步：CN 37 项 / 新参数抽查（与小程序引擎逐字段比对）
const cnM = ApkCore.buildReferenceList('male', { ROOT: 30, MPA: 28, RVAW: 7 }, 'CN');
const cnMmp = MpCore.buildReferenceList('male', { ROOT: 30, MPA: 28, RVAW: 7 }, 'CN');
check('APK CN 列表 37 项（与小程序一致）', cnM.length, MpCore.buildReferenceList('male', {}, 'CN').length, 0);
check('APK ROOT 30 判定一致', cnM.find(function (r) { return r.key === 'ROOT'; }).status,
  cnMmp.find(function (r) { return r.key === 'ROOT'; }).status, 0);
check('APK MPA 28 判定一致', cnM.find(function (r) { return r.key === 'MPA'; }).status,
  cnMmp.find(function (r) { return r.key === 'MPA'; }).status, 0);

/* ══════════════════════════════════════════════════════════ */

/* 公式集：目录 + 单个公式详情 */
check('页签名 = 公式集', /data-tab="calc"[^\n]*>[^\n]*<span class="tab__i">[^<]*<\/span><span class="tab__t">公式集<\/span>/.test(html) || (html.indexOf('data-tab="calc"') !== -1 && html.indexOf('>公式集</span>') !== -1), true);
check('目录容器 #calcList 存在', html.indexOf('id="calcList"') !== -1, true);
check('详情容器 #calcDetail 存在（初始隐藏）', /id="calcDetail" hidden/.test(html), true);
check('返回按钮 #calcBack 存在', html.indexOf('id="calcBack"') !== -1, true);
check('返回按钮文案', html.indexOf('返回公式集') !== -1, true);
check('公式集目录样式已内联', html.indexOf('.fx-item {') !== -1, true);
check('清空按钮改为「清空本组输入」', html.indexOf('清空本组输入') !== -1, true);

/* ══════════════════════════════════════════════════════════ */

/* 公式集扩展：评估类内容 / 参考文献 / 版本号 / 页签顺序 */
// 用户 2026-10-21：儿童 Z 值调到节段划分之前；新增瓣膜解剖页
check('页签顺序 = EF·参考值|儿童 Z 值|节段划分|公式集（v1.5.0 起与小程序一致）',
  (html.match(/class="tab__t">([^<]+)</g) || []).map(function (x) {
    return x.replace(/^class="tab__t">/, '').replace(/<$/, '');
  }).join('|') === 'EF·参考值|儿童 Z 值|节段划分|公式集', true);
check('含评估内容数据 ExtraData', html.indexOf('window.ExtraData') !== -1, true);
check('完整版也移除了页尾「继续看其他页面」', html.indexOf('pagefoot') === -1, true);
check('含评估分组（切面、图像与质控 / 心腔、心肌与应变 / 先心含术后 / 急症与特殊场景）',
  ['切面、图像与质控', '心腔、心肌与应变', '先天性心脏病（含术后）', '急症与特殊场景'].every(function (t) {
    return html.indexOf("title: '" + t + "'") !== -1;
  }), true);
check('含 5 个评估条目（crt/la/lv/rv/strain）',
  ['crt', 'la', 'lv', 'rv', 'strain'].every(function (id) {
    return html.indexOf("id: '" + id + "'") !== -1;
  }), true);
check('含参考文献数据 REFS', html.indexOf('REFS') !== -1, true);
check('含 v1.1.1 新增条目 tof-pr 与右室收缩储备字段',
  html.indexOf("id: 'tof-pr'") !== -1 &&
  html.indexOf("k: 'pridx'") !== -1 &&
  html.indexOf("k: 'rvr0'") !== -1, true);
check('含 v1.2.1 新增条目（ebstein / mustard / fontan / dorv / as-switch）',
  ['ebstein', 'mustard', 'fontan', 'dorv', 'as-switch'].every(function (id) {
    return html.indexOf("id: '" + id + "'") !== -1;
  }), true);
check('参考文献区容器 #calcRefs 存在', html.indexOf('id="calcRefs"') !== -1, true);
check('参考文献列表容器 #calcRefList 存在', html.indexOf('id="calcRefList"') !== -1, true);
/* 参考文献默认折叠：40 条平铺会把目录拉得极长，点标题才展开 */
check('参考文献折叠头存在（#refsToggle + .refs-hd）',
  html.indexOf('id="refsToggle"') !== -1 && html.indexOf('class="card__t refs-hd"') !== -1, true);
check('参考文献列表初始折叠（#calcRefList 带 hidden）',
  /<div id="calcRefList"[^>]*hidden/.test(html), true);
check('折叠态样式已内联（.refs-hd--open 箭头旋转）',
  html.indexOf('.refs-hd--open .refs-hd__a') !== -1, true);
check('折叠开关逻辑已内联（toggleRefs）', html.indexOf('function toggleRefs') !== -1, true);
/* v1.2.8 第一批：M 型 / 评分体系 / 介入尺寸 */
check('含 6 个新计算器（mtype / wmsi / h2fpef / hfapeff / tavrsz / laasz）',
  ['mtype', 'wmsi', 'h2fpef', 'hfapeff', 'tavrsz', 'laasz'].every(function (id) {
    return html.indexOf("id: '" + id + "'") !== -1;
  }), true);
check('计算组 3 个（血流动力学·舒张 / 右心 / 重构·室壁运动）；「介入尺寸」组 v1.5.3 已拆散',
  html.indexOf("id: 'hemo', title: '血流动力学、舒张与心功能'") !== -1 &&
  html.indexOf("id: 'recon', title: '重构、室壁运动与心肌功能'") !== -1 &&
  html.indexOf("id: 'ivs', title: '介入尺寸、先心与随访'") === -1, true);
check('引擎函数已内联（mModeTriple / wmsiIndex / h2fpefScore / hfaPeffScore / tavrSizing / laaSize）',
  ['function mModeTriple', 'function wmsiIndex', 'function h2fpefScore',
   'function hfaPeffScore', 'function tavrSizing', 'function laaSize']
    .every(function (k) { return html.indexOf(k) !== -1; }), true);
check('选项组渲染已内联（optsHtml + .seg[data-opt]）',
  html.indexOf('function optsHtml') !== -1 &&
  html.indexOf("querySelectorAll('.seg[data-opt]')") !== -1, true);
check('评分条目带选项组（H2FPEF 房颤 / 降压药）',
  html.indexOf("{ k: 'haf', n: '心房颤动'") !== -1 &&
  html.indexOf("{ k: 'hbp', n: '降压药种数'") !== -1, true);
/* v1.2.9 第二批：右心与肺循环 */
check('含 6 个右心新计算器（rvvol / rvfws / papi / pdap / residx / rvdvdt）',
  ['rvvol', 'rvfws', 'papi', 'pdap', 'residx', 'rvdvdt'].every(function (id) {
    return html.indexOf("id: '" + id + "'") !== -1;
  }), true);
check('右心引擎函数已内联（rvVolumeIndex / rvFreeWallStrain / pulmonaryPulseIndex / resistanceIndices / rvDpDt）',
  ['function rvVolumeIndex', 'function rvFreeWallStrain', 'function pulmonaryPulseIndex',
   'function pulmonaryDiastolicPressure', 'function resistanceIndices', 'function rvDpDt']
    .every(function (k) { return html.indexOf(k) !== -1; }), true);
/* v1.3.0 第三批：瓣膜与舒张细节 */
/* v1.4.9：vcw / rf 两个纯查表计算器已删，只剩 3 条 */
check('含 3 个新计算器（laef / quickratio / lvmih；wilkins 与 mva 已并入评估页，vcw 与 rf 已删）',
  ['laef', 'quickratio', 'lvmih'].every(function (id) {
    return html.indexOf("id: '" + id + "'") !== -1;
  }), true);
check('第三批引擎函数已内联（wilkinsScore / vcwGrade / regurgFraction / laEmptying / quickRatios / lvmHeightIndex）',
  ['function wilkinsScore', 'function vcwGrade', 'function regurgFraction',
   'function laEmptying', 'function quickRatios', 'function lvmHeightIndex']
    .every(function (k) { return html.indexOf(k) !== -1; }), true);
/* v1.3.0 第四批：先心 / 心肌 / 耦联 */
check('含 4 个新计算器（paidx / ras / ea / coa）',
  ['paidx', 'ras', 'ea', 'coa'].every(function (id) {
    return html.indexOf("id: '" + id + "'") !== -1;
  }), true);
check('第四批引擎函数已内联（paIndex / apicalSparing / ventriculoArterial / coarctationEcho）',
  ['function paIndex', 'function apicalSparing', 'function ventriculoArterial',
   'function coarctationEcho']
    .every(function (k) { return html.indexOf(k) !== -1; }), true);
/* v1.3.1 成人主动脉分节段 Z 值 */
check('含主动脉分节段 Z 值计算器 aortaz', html.indexOf("id: 'aortaz'") !== -1, true);
check('Z 值引擎与成人参考区间已内联（aorticZscore / AORTIC_SEGS）',
  html.indexOf('function aorticZscore') !== -1 && html.indexOf('const AORTIC_SEGS') !== -1, true);
check('aortaz 带性别选项组', html.indexOf("{ k: 'azsex', n: '性别'") !== -1, true);
check('主动脉判读页已挂公式集跳转提示', html.indexOf('主动脉分节段 Z 值') !== -1, true);
check('判读页桥接文案已内联（相关计算（通用量））',
  html.indexOf('相关计算（通用量）') !== -1, true);
/* 桥接是运行时挂到 blocks 上的，静态 HTML 里只应出现机制本身，不指望 23 份文案 */
check('桥接机制已内联（CALC_HINTS + attachCalcHints）',
  html.indexOf('var CALC_HINTS') !== -1 && html.indexOf('attachCalcHints') !== -1, true);
check('已删除延展阅读卡片（三端一致）',
  html.indexOf('延展阅读') === -1 && html.indexOf('id="extLinks"') === -1, true);
check('评估内容块样式已内联', html.indexOf('.fx-tbl__c {') !== -1, true);
check('参考文献样式已内联', html.indexOf('.ref-item__zh {') !== -1, true);
check('版本行样式已内联', html.indexOf('.verline {') !== -1, true);
check('版本号已注入（非 1.0.0）', /v\d+\.\d+\.\d+/.test(html) && html.indexOf('v1.0.0') === -1, true);

/* 切面学习 / TEE 切面在线演示：纯外链条目（不嵌图片与 iframe，省内存） */
check('含 LINK_SECTIONS 外链数据', html.indexOf('LINK_SECTIONS') !== -1, true);
check('含切面学习分组', (html.match(/title: '切面学习（视频）'/g) || []).length === 1, true);
check('含书籍视频分组（25 段 mp4）',
  html.match(/title: '实用超声规范化检查与操作（视频）'/g) &&
  (html.match(/image\.medonhand\.com/g) || []).length >= 1 &&
  html.indexOf('978-7-5189-8028-4') !== -1, true);
check('含 TEE 切面在线演示分组', (html.match(/title: 'TEE 切面在线演示'/g) || []).length === 1, true);
check('切面指南已并入参考文献（不再有该分组）', (html.match(/title: '切面指南'/g) || []).length === 0, true);
check('含 CT2TEE 在线演示链接', html.indexOf('ct2tee.agh.edu.pl') !== -1, true);
check('含 TEE 切面交互图谱链接', html.indexOf('tee-simulator.anesthbeta.com') !== -1, true);
check('含 utoronto 标准视图链接',
  html.indexOf('TEE-HTML5-SV-CH') !== -1, true);
check('含 TEE 交互演示直达链接',
  html.indexOf('teeSimulation/index.html') !== -1, true);
/* ── 版权防护（v1.5.7）：提示条 / 淡水印 / 页脚版权行，且水印不挡点击 ── */
check('含首次进入的版权提示条',
  html.indexOf('guardbar') !== -1 && html.indexOf('echoref.guard') !== -1, true);
const wmStart = html.indexOf('.wmark {');
const wmBlock = wmStart === -1 ? '' : html.slice(wmStart, wmStart + 420);
check('含固定淡水印，且 pointer-events:none 不挡点击',
  wmBlock.indexOf('pointer-events: none') !== -1, true);
check('水印落在底部 tabbar 之上的空白区',
  wmBlock.indexOf('var(--tabbar-h)') !== -1, true);
check('水印不是竖排（避免压正文）',
  wmBlock.indexOf('writing-mode') === -1, true);
// v1.6.0：页脚只留「品牌行 + 禁止去除署名后转载」，
// 用户 2026-10-24 明确「不需要包含其他端的地址」（各端不用互相导流）
check('含页脚品牌行（EchoRef · 心脏超声参考工具）',
  html.indexOf('copyfoot') !== -1 && html.indexOf('EchoRef · 心脏超声参考工具') !== -1, true);
check('含页脚版权声明（禁止去除署名后转载）',
  html.indexOf('禁止去除署名后转载') !== -1, true);
check('页脚不出现其他端的引导地址',
  html.indexOf('手机端小程序') === -1 && html.indexOf('安卓 APK') === -1, true);
check('head 含 noai 抓取声明', html.indexOf('noai,noimageai') !== -1, true);
check('含 TEE 速查表直达链接',
  html.indexOf('TEE-cheat-sheet/index.htm') !== -1, true);
check('含 TTE 经胸直达交互链接',
  html.indexOf('TTE-HTML5-SV/index.html') !== -1, true);
check('含 ASE 经胸/经食道指南链接',
  html.indexOf('Adult-CompTTE_Chinese.pdf') !== -1 &&
  html.indexOf('PIIS0894731721005940.pdf') !== -1, true);
check('不再含旧跳转页条目',
  html.indexOf("id: 'm-teer'") === -1 && html.indexOf("id: 't-teer'") === -1 &&
  html.indexOf('TEE_spectral.html') === -1, true);
check('外链渲染为 a[target=_blank]',
  html.indexOf("' target=\"_blank\" rel=\"noopener noreferrer\'") !== -1 ||
  html.indexOf('target=\"_blank\" rel=\"noopener noreferrer\"') !== -1 ||
  html.indexOf('target="_blank" rel="noopener noreferrer"') !== -1, true);
check('页签含公式集（完整版 5 页签之一）',
  html.indexOf('data-tab="calc"') !== -1, true);

/* ★ v1.3.18：延展阅读整块删除，三端都不应再出现 */
check('APK 页面已无延展阅读卡片',
  html.indexOf('延展阅读') === -1 ? 1 : 0, 1, 0);
check('APK 页面已无外链卡片',
  (html.match(/class="extlink"/g) || []).length, 0, 0);
check('APK 页面不再出现第三方工具站',
  html.indexOf('zs-echo.com') === -1 && html.indexOf('tte-quickref') === -1 ? 1 : 0, 1, 0);

/* ══════════════════════════════════════════════════════════ */

console.log('\n' + '═'.repeat(60));
if (fail === 0) {
  console.log('✅ 全部通过：' + pass + ' 项断言');
} else {
  console.log('❌ ' + fail + ' 项失败 / 共 ' + (pass + fail) + ' 项\n');
  console.log(problems.join('\n\n'));
}
console.log('═'.repeat(60));

process.exit(fail === 0 ? 0 : 1);
