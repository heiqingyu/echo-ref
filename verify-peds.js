/**
 * 儿童 Z 值引擎测试（verify-peds.js）
 *
 * 运行：node verify-peds.js
 *
 * ⚠️ 所有期望值均为**独立手算**得出（见文件末尾的推导注释），
 *    不得用引擎自身输出反向填充期望值。
 */

const peds = require('./miniprogram/utils/peds-zscore.js');

let pass = 0;
let fail = 0;
const failures = [];

function check(label, actual, expected, tol) {
  const t = tol === undefined ? 1e-6 : tol;
  let ok;
  if (expected === null) {
    ok = actual === null;
  } else if (typeof expected === 'number') {
    ok = typeof actual === 'number' && Math.abs(actual - expected) <= t;
  } else {
    ok = actual === expected;
  }
  if (ok) {
    pass++;
  } else {
    fail++;
    failures.push(
      '  ✗ ' + label + '\n      期望 ' + JSON.stringify(expected) +
      '  实得 ' + JSON.stringify(actual)
    );
  }
}

function section(t) {
  console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 56 - t.length)));
}

/* ================================================================== *
 * 1. Haycock BSA
 * ================================================================== */
section('1. Haycock BSA');

// 手算：0.024265 × 75^0.3964 × 9.5^0.5378
check('Haycock(75, 9.5)', peds.bsaHaycock(75, 9.5), 0.450894, 1e-5);
// 0.024265 × 175^0.3964 × 70^0.5378
check('Haycock(175, 70)', peds.bsaHaycock(175, 70), 1.846776, 1e-5);
// 0.024265 × 50^0.3964 × 3.4^0.5378
//   50^0.3964 = 4.71489157164734 ; 3.4^0.5378 = 1.9312093774766061
check('Haycock(50, 3.4) 新生儿', peds.bsaHaycock(50, 3.4), 0.220944, 1e-5);
// 单调性：同身高下体重越大 BSA 越大
check('BSA 随体重单调递增',
  peds.bsaHaycock(100, 20) > peds.bsaHaycock(100, 15), true);

/* ================================================================== *
 * 2. 指数化均值 / 标准差
 * ================================================================== */
section('2. 指数化均值与标准差');

// BSA=0.4506（1 岁），LVEDD α=0.45 Mean=3.89 SD=0.33
// BSA^0.45 = 0.698564
check('indexedMean(LVEDD, 0.4506)', peds.indexedMean('LVEDD', 0.4506), 3.89 * 0.698564, 1e-4);
check('indexedSD(LVEDD, 0.4506)', peds.indexedSD('LVEDD', 0.4506), 0.33 * 0.698564, 1e-4);

// LVEDV α=1.30 Mean=62.02 SD=11.94 ；BSA=0.45 → 0.45^1.3 = 0.354152...
check('indexedMean(LVEDV, 0.45)',
  peds.indexedMean('LVEDV', 0.45), 62.02 * Math.pow(0.45, 1.3), 1e-4);
check('indexedSD(LVEDV, 0.45)',
  peds.indexedSD('LVEDV', 0.45), 11.94 * Math.pow(0.45, 1.3), 1e-4);

// α = 0 的比例参数：与 BSA 无关
check('indexedMean(LVSI, 0.3) == 1.63', peds.indexedMean('LVSI', 0.3), 1.63, 1e-9);
check('indexedMean(LVSI, 1.8) == 1.63', peds.indexedMean('LVSI', 1.8), 1.63, 1e-9);
check('indexedSD(LVSI, 1.8) == 0.17', peds.indexedSD('LVSI', 1.8), 0.17, 1e-9);

// BSA 放大效应（α>0）
check('indexedMean(LVEDD, 2.0) == 3.89×2^0.45',
  peds.indexedMean('LVEDD', 2.0), 3.89 * Math.pow(2, 0.45), 1e-6);

/* ================================================================== *
 * 3. zScore 核心公式
 *    Z = (X / BSA^α − Mean) / SD
 * ================================================================== */
section('3. Z 值核心公式');

// BSA=0.4506, LVEDD=3.50cm
//   BSA^0.45 = 0.698564
//   指数化值 = 3.50 / 0.698564 = 5.010280
//   Z = (5.010280 − 3.89) / 0.33 = 3.394788
check('Z(LVEDD=3.50, bsa=0.4506)', peds.zScore(3.50, 'LVEDD', 0.4506), 3.394788, 1e-5);

// BSA=0.4506, LVM=30g
//   BSA^1.25 = 0.369181 ; 30/0.369181 = 81.261020
//   Z = (81.261020 − 53.02) / 9.06 = 3.117110
check('Z(LVM=30, bsa=0.4506)', peds.zScore(30, 'LVM', 0.4506), 3.117110, 1e-5);

// 均值处 Z = 0
//   BSA=0.4506 时 LVEDD 均值 = 3.89 × 0.698564 = 2.71742 cm
check('Z(均值处) == 0', peds.zScore(2.717414, 'LVEDD', 0.4506), 0, 1e-5);

// +2SD 处 Z = 2
//   均值 + 2SD = (3.89 + 2×0.33) × 0.698564 = 4.55 × 0.698564 = 3.178467
check('Z(+2SD 处) == 2', peds.zScore(3.178467, 'LVEDD', 0.4506), 2, 1e-5);

// −3SD 处 Z = −3
//   (3.89 − 3×0.33) × 0.698564 = 2.90 × 0.698564 = 2.025836
check('Z(−3SD 处) == -3', peds.zScore(2.025836, 'LVEDD', 0.4506), -3, 1e-5);

// 非法入参 → null
check('Z 空值 → null', peds.zScore(null, 'LVEDD', 0.45), null);
check('Z 空串 → null', peds.zScore('', 'LVEDD', 0.45), null);
check('Z NaN → null', peds.zScore(NaN, 'LVEDD', 0.45), null);
check('Z bsa=0 → null', peds.zScore(3.5, 'LVEDD', 0), null);
check('Z bsa 负 → null', peds.zScore(3.5, 'LVEDD', -1), null);
check('Z 未知参数 → null', peds.zScore(3.5, 'NOT_A_PARAM', 0.45), null);

// 0 是合法测量值，不能当空值
check('Z 值 0 合法', typeof peds.zScore(0, 'LVEDD', 0.45), 'number');

/* ================================================================== *
 * 4. gradeZ 判定
 * ================================================================== */
section('4. Z 值判定分级');

check('Z=0 → normal', peds.gradeZ(0).level, 'normal');
check('Z=2.00 → normal（含边界）', peds.gradeZ(2.00).level, 'normal');
check('Z=−2.00 → normal（含边界）', peds.gradeZ(-2.00).level, 'normal');
check('Z=2.01 → mild', peds.gradeZ(2.01).level, 'mild');
check('Z=−2.01 → mild', peds.gradeZ(-2.01).level, 'mild');
check('Z=3.00 → mild（含边界）', peds.gradeZ(3.00).level, 'mild');
check('Z=3.01 → severe', peds.gradeZ(3.01).level, 'severe');
check('Z=−3.01 → severe', peds.gradeZ(-3.01).level, 'severe');
check('Z=5 → severe', peds.gradeZ(5).level, 'severe');
check('Z=−5 → severe', peds.gradeZ(-5).level, 'severe');

// 方向文案
check('Z=+2.5 文案', peds.gradeZ(2.5).text, '轻度增大');
check('Z=−2.5 文案', peds.gradeZ(-2.5).text, '轻度缩小');
check('Z=+4 文案', peds.gradeZ(4).text, '显著增大');
check('Z=−4 文案', peds.gradeZ(-4).text, '显著缩小');
check('Z=1 文案', peds.gradeZ(1).text, '正常');
check('Z=null 文案', peds.gradeZ(null).text, '—');

/* ================================================================== *
 * 5. rangeFromZ 反算
 * ================================================================== */
section('5. 由 Z 阈值反算实测区间');

// BSA=0.4506, LVEDD, Z=2
//   lower = (3.89 − 0.66) × 0.698564 = 3.23 × 0.698564 = 2.256361
//   upper = (3.89 + 0.66) × 0.698564 = 4.55 × 0.698564 = 3.178466
const r2 = peds.rangeFromZ('LVEDD', 0.4506, 2);
check('rangeFromZ(LVEDD,±2).lower', r2.lower, 2.256361, 1e-5);
check('rangeFromZ(LVEDD,±2).upper', r2.upper, 3.178466, 1e-5);
check('rangeFromZ(LVEDD,±2).mean', r2.mean, 2.717414, 1e-5);

// ±3 区间应比 ±2 更宽
const r3 = peds.rangeFromZ('LVEDD', 0.4506, 3);
check('±3 区间更宽', (r3.lower < r2.lower) && (r3.upper > r2.upper), true);

// bsa 非法 → null
check('rangeFromZ bsa=0 → null', peds.rangeFromZ('LVEDD', 0, 2), null);
check('rangeFromZ 未知参数 → null', peds.rangeFromZ('XX', 0.45, 2), null);

/* ================================================================== *
 * 6. 系数表完整性
 * ================================================================== */
section('6. 系数表完整性');

check('PEDS_Z 参数数 == 40', Object.keys(peds.PEDS_Z).length, 40);
check('PEDS_FIELDS 数 == 40', peds.PEDS_FIELDS.length, 40);
// 33 项来自 PHN 指数方程 + 3 项来自 Kampmann M 型分组表
check('PHN 参数数 == 33', peds.PEDS_FIELDS.filter(function (k) {
  return !peds.PEDS_Z[k].model;
}).length, 33);
check('Kampmann 参数数 == 3', peds.PEDS_FIELDS.filter(function (k) {
  return peds.PEDS_Z[k].model === 'kamp';
}).length, 3);
check('CSMC 参数数 == 4', peds.PEDS_FIELDS.filter(function (k) {
  return peds.PEDS_Z[k].model === 'csmc';
}).length, 4);
check('分组全部有参数', peds.PEDS_GROUPS.every(function (g) { return g.keys.length > 0; }), true);

// 分组打平 == PEDS_FIELDS，且无重复
const flat = [];
peds.PEDS_GROUPS.forEach(function (g) { flat.push.apply(flat, g.keys); });
check('分组打平 == PEDS_FIELDS', flat.join(',') === peds.PEDS_FIELDS.join(','), true);
check('无重复参数键', new Set(flat).size, flat.length);

// 每个键都有完整定义：PHN 项查 a/mean/sd，Kampmann 项查分组表列
let allComplete = true;
Object.keys(peds.PEDS_Z).forEach(function (k) {
  const d = peds.PEDS_Z[k];
  if (!d.name || !d.unit === undefined) allComplete = false;
  if (d.model === 'kamp') {
    const col = peds.KAMP_TABLE.cols[k];
    if (!col || col.length !== peds.KAMP_TABLE.bsa.length) allComplete = false;
    // 每格必须是 [−2SD, 均值, +2SD] 且严格递增
    (col || []).forEach(function (cell) {
      if (cell.length !== 3) allComplete = false;
      if (!(cell[0] < cell[1] && cell[1] < cell[2])) allComplete = false;
      // 上下对称：hi − mean == mean − lo
      if (Math.abs((cell[2] - cell[1]) - (cell[1] - cell[0])) > 0.051) allComplete = false;
    });
    return;
  }
  // CSMC 项查三次多项式系数表
  if (d.model === 'csmc') {
    const z = peds.CSMC_Z[k];
    if (!z) { allComplete = false; return; }
    if (!Array.isArray(z.b) || z.b.length !== 4) allComplete = false;
    if (!(z.sd > 0)) allComplete = false;
    if (!(z.r2 > 0 && z.r2 <= 1)) allComplete = false;
    if (z.paper !== 'L' && z.paper !== 'R') allComplete = false;
    return;
  }
  if (typeof d.a !== 'number' || typeof d.mean !== 'number' ||
      typeof d.sd !== 'number' || !d.name) {
    allComplete = false;
  }
  if (!(d.sd > 0)) allComplete = false;
});
check('所有系数完整（PHN a/mean/sd，Kampmann 分组表，CSMC 三项式）', allComplete, true);

// ★ 关键回归：LVESD / LVESV 必须来自 Cantinotti/PHN 补充表（曾误填 2.36/25.07）
check('LVESD mean == 2.675', peds.PEDS_Z.LVESD.mean, 2.675);
check('LVESD sd == 0.352', peds.PEDS_Z.LVESD.sd, 0.352);
check('LVESV mean == 25.76', peds.PEDS_Z.LVESV.mean, 25.76);
check('LVESV sd == 5.551', peds.PEDS_Z.LVESV.sd, 5.551);

// ★ 关键回归：PHN 已发表索引表的原始数值不得被"优化"
check('LVEDD 0.45/3.89/0.33', [peds.PEDS_Z.LVEDD.a, peds.PEDS_Z.LVEDD.mean, peds.PEDS_Z.LVEDD.sd].join('/'), '0.45/3.89/0.33');
check('LVEDV 1.3/62.02/11.94', [peds.PEDS_Z.LVEDV.a, peds.PEDS_Z.LVEDV.mean, peds.PEDS_Z.LVEDV.sd].join('/'), '1.3/62.02/11.94');
check('LVM 1.25/53.02/9.06', [peds.PEDS_Z.LVM.a, peds.PEDS_Z.LVM.mean, peds.PEDS_Z.LVM.sd].join('/'), '1.25/53.02/9.06');
check('LVPWT 0.4/0.57/0.09', [peds.PEDS_Z.LVPWT.a, peds.PEDS_Z.LVPWT.mean, peds.PEDS_Z.LVPWT.sd].join('/'), '0.4/0.57/0.09');
check('LVST 0.4/0.58/0.09', [peds.PEDS_Z.LVST.a, peds.PEDS_Z.LVST.mean, peds.PEDS_Z.LVST.sd].join('/'), '0.4/0.58/0.09');

/* ================================================================== *
 * 7. buildPedsList —— 界面单位转换与渲染
 * ================================================================== */
section('7. buildPedsList 主接口');

// 1 岁儿童：BSA=0.4506，界面输入 mm
//   LVEDD 界面 mm 38 → 原生 cm 3.8
//   BSA^0.45=0.698564 ; 3.8/0.698564=5.439 ; Z=(5.439−3.89)/0.33=4.694
const rows = peds.buildPedsList(0.4506, { LVEDD: 38, LVESD: 25, LVM: 20 });
check('buildPedsList 行数', rows.length, 40);

const lvedd = rows.find(function (r) { return r.key === 'LVEDD'; });
check('LVEDD 显示单位 mm', lvedd.unit, 'mm');
check('LVEDD 实测文案', lvedd.value, '38.0');
// 手算 Z：3.8/0.698564 = 5.439733 ; (5.439733−3.89)/0.33 = 4.696161
check('LVEDD Z 值（mm→cm 换算后）', lvedd.z, 4.7, 0.05);
check('LVEDD 显著增大', lvedd.status, 'severe');
check('LVEDD 状态文案', lvedd.statusText, '显著增大');
// ±2 区间 mm：lower=2.256361×10=22.56 ; upper=3.178466×10=31.78
check('LVEDD ±2 下界(mm)', parseFloat(lvedd.rangeText.split(' – ')[0]), 22.6, 0.05);
check('LVEDD ±2 上界(mm)', parseFloat(lvedd.rangeText.split(' – ')[1]), 31.8, 0.05);

// 未测参数：z 为 null、状态 none
const mpa = rows.find(function (r) { return r.key === 'MPA'; });
check('未测参数 hasValue=false', mpa.hasValue, false);
check('未测参数 z=null', mpa.z, null);
check('未测参数 zText —', mpa.zText, '—');
check('未测参数状态 none', mpa.status, 'none');

// measured 缺失整体（只查参考区间）
const noMeas = peds.buildPedsList(0.4506, null);
check('无实测值仍出 40 行', noMeas.length, 40);
check('无实测值时区间仍算出',
  noMeas.find(function (r) { return r.key === 'LVEDD'; }).rangeText !== '—', true);

// ★ 关键回归：长度类必须 ÷10 后再算 Z，不得直接用界面 mm
//   若忘记换算，38mm 会被当成 38cm，Z 会变成 ~101，明显异常
check('长度类已做 mm→cm 换算（Z 未爆炸）', Math.abs(lvedd.z) < 20, true);

// 容积类不做换算：LVEDV 界面 mL == 原生 mL
//   BSA=0.4506 → BSA^1.3=0.354152 ; 均值=62.02×0.354152=21.965
//   实测 22 mL → Z=(22/0.354152 − 62.02)/11.94 = (62.121−62.02)/11.94 = 0.0085
const volRows = peds.buildPedsList(0.4506, { LVEDV: 22 });
const lvedv = volRows.find(function (r) { return r.key === 'LVEDV'; });
check('LVEDV 单位 mL', lvedv.unit, 'mL');
check('LVEDV 均值附近 Z≈0', Math.abs(lvedv.z) < 0.05, true);

// 比例类 α=0：不同 BSA 下均值恒为 1.63
const s1 = peds.buildPedsList(0.3, { LVSI: 1.63 }).find(function (r) { return r.key === 'LVSI'; });
const s2 = peds.buildPedsList(1.8, { LVSI: 1.63 }).find(function (r) { return r.key === 'LVSI'; });
check('LVSI 均值不随 BSA 变', s1.meanText, s2.meanText);
check('LVSI Z 不随 BSA 变', s1.z, s2.z);

/* ================================================================== *
 * 8. buildPedsGrouped
 * ================================================================== */
section('8. buildPedsGrouped 分组');

const grouped = peds.buildPedsGrouped(0.4506, { LVEDD: 38, LVM: 20 });
check('分组数 == 10', grouped.length, 10);
const totalRows = grouped.reduce(function (n, g) { return n + g.rows.length; }, 0);
check('分组行数合计 == 40', totalRows, 40);
check('第一组标题', grouped[0].title, '左心室结构');
check('第一组行数 == 4', grouped[0].rows.length, 4);
check('分组内无 undefined', grouped.every(function (g) {
  return g.rows.every(function (r) { return !!r && !!r.key; });
}), true);

/* ================================================================== *
 * 9. describeZ
 * ================================================================== */
section('9. describeZ');

check('describeZ(2.34)', peds.describeZ(2.34), '+2.34（轻度增大）');
check('describeZ(-2.34)', peds.describeZ(-2.34), '-2.34（轻度缩小）');
check('describeZ(0)', peds.describeZ(0), '0（正常）');
check('describeZ(null)', peds.describeZ(null), '未测');

/* ================================================================== *
 * 10. 跨年龄段合理性（独立交叉验证）
 *
 *  BSA=1.8468（175cm/70kg 成人体型）
 *  LVEDD 均值 = 3.89 × 1.8468^0.45 = 5.1267 cm
 *  ±2SD = 5.1267 ± 2×0.4349 → 4.2569 – 5.9965 cm
 *  对照 ASE 成人正常范围 4.2–5.9 cm —— 高度吻合，
 *  说明系数与公式在儿科范围外推时仍然自洽。
 * ================================================================== */
section('10. 跨年龄段交叉验证');

const adultBsa = peds.bsaHaycock(175, 70);
check('成人 Haycock BSA', adultBsa, 1.846776, 1e-5);
const adultR2 = peds.rangeFromZ('LVEDD', adultBsa, 2);
check('成人 LVEDD ±2 下界 ≈ ASE 4.2', adultR2.lower, 4.2569, 0.005);
check('成人 LVEDD ±2 上界 ≈ ASE 5.9', adultR2.upper, 5.9965, 0.005);

/* ================================================================== *
 * 11. Kampmann 2000 M 型分组表（左房 / 右心）
 *
 *  原文 Heart 2000;83(6):667-672 Table 2 抽查（mm）：
 *    BSA 0.25 → LAD 10.5 / 14.0 / 17.5，RVDD 4.2 / 8.7 / 13.2
 *    BSA 1.00 → LAD 19.2 / 25.0 / 30.8，RVDD 6.4 / 11.2 / 16.0
 *    BSA 2.00 → LAD 23.7 / 32.5 / 41.3，RVDD 11.5 / 17.5 / 23.5
 * ================================================================== */
section('11. Kampmann M 型分组表');

check('分组表 BSA 档位数', peds.KAMP_TABLE.bsa.length, 21);
check('三列齐全', Object.keys(peds.KAMP_TABLE.cols).join(','), 'RVAWd,RVDD,LAAP');

const k25 = peds.kampAt('LAAP', 0.25);
check('LAAP 0.25 均值 == 14.0', k25.mean, 14.0);
check('LAAP 0.25 −2SD == 10.5', k25.lo2, 10.5);
check('LAAP 0.25 +2SD == 17.5', k25.hi2, 17.5);
check('LAAP 0.25 SD == 1.75', k25.sd, 1.75, 1e-9);

const k100 = peds.kampAt('LAAP', 1.0);
check('LAAP 1.0 均值 == 25.0', k100.mean, 25.0);
check('LAAP 1.0 +2SD == 30.8', k100.hi2, 30.8);

const kv20 = peds.kampAt('RVDD', 2.0);
check('RVDD 2.0 均值 == 17.5', kv20.mean, 17.5);
check('RVDD 2.0 −2SD == 11.5', kv20.lo2, 11.5);

// 插值抽查：0.762 落在 0.70–0.80 之间
//   w = (0.762 − 0.70) / 0.10 = 0.62
//   mean = 21.2 + (22.5 − 21.2) × 0.62 = 22.006
check('LAAP 0.762 线性插值', peds.kampAt('LAAP', 0.762).mean, 22.006, 1e-3);

// 越界贴边（原文只覆盖 0.25–2.0 m²）
check('LAAP BSA 0.1 贴 0.25 档', peds.kampAt('LAAP', 0.1).mean, 14.0);
check('LAAP BSA 3.0 贴 2.0 档', peds.kampAt('LAAP', 3.0).mean, 32.5);
check('BSA 非法 → null', peds.kampAt('LAAP', 0), null);
check('未知键 → null', peds.kampAt('XX', 1.0), null);

// 端到端：BSA 1.0 时 LAAP 25 mm 正好是均值
const klRow = peds.buildPedsList(1.0, { LAAP: 25 })
  .filter(function (r) { return r.key === 'LAAP'; })[0];
check('LAAP 25mm @BSA1.0 → Z 0', klRow.z, 0);
check('LAAP 行标了来源', klRow.src, 'kamp');
check('LAAP 单位 mm', klRow.unit, 'mm');
// 30.8 mm 恰为 +2SD → 仍在正常界内；(30.8−25)/2.9 = 2.0
check('LAAP +2SD 边界 == normal',
  peds.buildPedsList(1.0, { LAAP: 30.8 })
    .filter(function (r) { return r.key === 'LAAP'; })[0].status, 'normal');
check('LAAP 超 +2SD 判轻度',
  peds.buildPedsList(1.0, { LAAP: 31.2 })
    .filter(function (r) { return r.key === 'LAAP'; })[0].status, 'mild');

/* ================================================================== *
 * 12. 回归：内径「均值」与「±2SD 区间」必须同单位
 *
 *  v1.6.8 之前 meanText 漏了 cm→mm 的 ×10，同一行显示
 *  「均值 2.0 mm」与「±2SD 16.4 – 23.1 mm」，看起来像两套正常值 ——
 *  这是用户「正常值的范围不同地方不一样」的直接原因。
 * ================================================================== */
section('12. 均值与区间同单位（回归）');

const pvRows = peds.buildPedsList(peds.bsaHaycock(50, 3.4), {});
const lveddRow = pvRows.filter(function (r) { return r.key === 'LVEDD'; })[0];
const lveddMean = parseFloat(lveddRow.meanText);
const lveddBounds = lveddRow.rangeText.split('–');
check('LVEDD 均值 > 10（已换算成 mm）', lveddMean > 10, true);
check('LVEDD 均值落在 ±2SD 区间内',
  lveddMean > parseFloat(lveddBounds[0]) && lveddMean < parseFloat(lveddBounds[1]), true);

const rootRow = pvRows.filter(function (r) { return r.key === 'ROOT'; })[0];
const rootMean = parseFloat(rootRow.meanText);
const rootBounds = rootRow.rangeText.split('–');
check('ROOT 均值落在 ±2SD 区间内',
  rootMean > parseFloat(rootBounds[0]) && rootMean < parseFloat(rootBounds[1]), true);

// 每一行都该满足：均值 = (下界 + 上界) / 2（±2SD 对称）
// 容差 0.06：显示时最多四舍五入到 0.01，两端各留 0.005 的双倍余量
let allMid = true;
const midOffenders = [];
pvRows.forEach(function (r) {
  if (r.rangeText === '—' || !r.meanText || r.meanText === '—') return;
  const b = r.rangeText.split('–');
  const lo = parseFloat(b[0]);
  const hi = parseFloat(b[1]);
  const mid = parseFloat(r.meanText);
  if (Math.abs((lo + hi) / 2 - mid) > 0.06) {
    allMid = false;
    midOffenders.push(r.key);
  }
});
check('全部参数：均值 == ±2SD 中点', allMid ? true : midOffenders.join(','), true);

/* ================================================================== *
 * 13. CSMC 中国汉族儿童三次多项式（左房 / 右房 / 右室）
 *
 *  ★ 系数抄录最容易错的是 β2 / β3 的负号 —— PDF 文本里「-0.79」常被
 *    提取成「20.79」。这里用两篇原文自带的算例反推验证：
 *      · 左心篇 4.3 节：AVA 1.60 cm、BSA 1.0 → Z = +0.38
 *      · 右心篇 4.3 节：TVA 1.70 cm、BSA 1.0 → Z = −2.33
 * ================================================================== */
section('13. CSMC 中国汉族儿童方程');

// 原文算例复算（就地用 Table 2 的系数，验证方程实现与负号处理）
function csmcZ(b, sd, mv, bsa) {
  const p = b[0] + b[1] * bsa + b[2] * bsa * bsa + b[3] * bsa * bsa * bsa;
  return (mv - p) / sd;
}
// 左心篇 AVA：β0 0.37 / β1 1.82 / β2 −0.79 / β3 0.15，SD 0.13
check('左心篇算例 AVA 1.60 / BSA 1.0 → Z +0.38',
  csmcZ([0.37, 1.82, -0.79, 0.15], 0.13, 1.60, 1.0), 0.38, 0.01);
// 右心篇 TVA：β0 0.45 / β1 3.22 / β2 −2.15 / β3 0.53，SD 0.15
check('右心篇算例 TVA 1.70 / BSA 1.0 → Z −2.33',
  csmcZ([0.45, 3.22, -2.15, 0.53], 0.15, 1.70, 1.0), -2.33, 0.01);

// 两端外推合理性（新生儿 / 接近成人）
check('LA4C BSA 0.20 → 约 11.6 mm', peds.csmcAt('LA4C', 0.20).mean * 10, 11.6, 0.5);
check('LA4C BSA 1.90 → 约 26.2 mm', peds.csmcAt('LA4C', 1.90).mean * 10, 26.2, 0.8);

// 四项均须随 BSA 单调递增（三次项在儿科区间不应出现回落）
let mono = true;
['LA4C', 'RA4C', 'RVIDd', 'RVIDs'].forEach(function (k) {
  let last = -1;
  for (let b = 0.20; b <= 1.9001; b += 0.05) {
    const t = peds.csmcAt(k, b);
    if (t.mean <= last) mono = false;
    last = t.mean;
  }
});
check('4 项均随 BSA 单调递增', mono, true);

// 与 Kampmann 同类测量交叉验证：左房两种测法（2D 横径 / M 型前后径）应接近
const laCsmc = peds.csmcAt('LA4C', 0.85).mean * 10;
const laKamp = peds.kampAt('LAAP', 0.85).mean;
check('左房 2D 与 M 型在 BSA 0.85 相差 < 15%',
  Math.abs(laCsmc - laKamp) / laKamp < 0.15, true);

// 分组顺序：4 项中国数据在前、3 项 M 型在后
const csmcGroup = peds.PEDS_GROUPS.filter(function (g) {
  return g.title === '左房与右心';
})[0];
check('「左房与右心」组共 7 项', csmcGroup.keys.length, 7);
check('组内前 4 项为中国数据',
  csmcGroup.keys.slice(0, 4).join(','), 'LA4C,RA4C,RVIDd,RVIDs');

// 右心篇 SD 是残差 SD、左心篇是边际 SD —— 代码里两篇各自独立取值，不可互相顶替
check('CSMC 左心篇 SD（LA4C）', peds.CSMC_Z.LA4C.sd, 0.18);
check('CSMC 右心篇 SD（RA4C）', peds.CSMC_Z.RA4C.sd, 0.19);
check('CSMC 来源标记（LA4C=L / RA4C=R）',
  peds.CSMC_Z.LA4C.paper + peds.CSMC_Z.RA4C.paper, 'LR');

/* ================================================================== */

console.log('\n' + '═'.repeat(60));
if (fail === 0) {
  console.log('✅ 全部通过：' + pass + ' 项断言');
} else {
  console.log('❌ ' + fail + ' 项失败 / 共 ' + (pass + fail) + ' 项\n');
  console.log(failures.join('\n\n'));
}
console.log('═'.repeat(60));

process.exit(fail === 0 ? 0 : 1);
