/**
 * 参考值审计：逐项比对引擎 REFERENCE.CN 与《中国成年人超声心动图检查测量指南》
 * （中华医学会超声医学分会，2016）表 2～表 9 的「总人群」列。
 *
 * ★ 为什么要有这个文件：2026-10 曾出现两类错误——
 *   ① 女性整列被填成接近男性的数值（LVEDD 39.0–54.1，应为 36.7–49.7）；
 *   ② 出现指南里根本没有的 IVSLd / IVSLs（数值是 LVPWd / LVPWs 的副本）。
 *   两者都能过原有 6 个校验，因为那些脚本只查「项数」和「字段是否存在」。
 *   本脚本把指南原表的数字**冻结**下来做逐格比对，任何改动都必须与原文一致。
 *
 * 下表数值的来源：指南全文的 SSR JSON 里 <table> 被转义成 \u003Ctable，
 * 先反转义再按 <tr>/<td> 解析，取每行前两个数字（男/女「总数」列的下限、上限）。
 * 交叉核对：2024 版高血压心血管重构超声指南 表 1（中华超声影像学杂志 2024;33(7):555-575）
 * 的 EMINCA 列与本表总人群列逐格一致。
 *
 * 运行： node verify-ref.js
 */
const C = require('./miniprogram/utils/echo-core.js');

let pass = 0, fail = 0;
function ok(label, detail) {
  pass++;
  console.log('  OK   ' + label + (detail ? '：' + detail : ''));
}
function bad(label, detail) {
  fail++;
  console.log(' FAIL  ' + label + (detail ? '：' + detail : ''));
}
function eqNum(label, actual, expected) {
  if (typeof actual === 'number' && Math.abs(actual - expected) < 1e-9) ok(label);
  else bad(label, actual + ' ≠ ' + expected);
}
function is(label, cond, detail) {
  cond ? ok(label, detail) : bad(label, detail);
}

/* ── 冻结的指南原值（m = 男 678，f = 女 716，95% 参考范围）── */
const REF = {
  'LA-ap': { m: [23.5, 38.7], f: [22, 36.8], t: '表2' },
  'LA-l': { m: [35.2, 58.4], f: [33.7, 56.5], t: '表2' },
  'LA-t': { m: [26.7, 44.7], f: [26.2, 43], t: '表2' },
  'LAA': { m: [8.4, 21], f: [8.4, 19.4], t: '表2' },
  'LAV': { m: [15.3, 60.7], f: [13.8, 55.8], t: '表2' },
  'LVOT': { m: [13.6, 25], f: [12, 23], t: '表3' },
  'IVSd': { m: [6.4, 11.4], f: [5.6, 10.6], t: '表3' },
  'IVSs': { m: [9, 16], f: [8, 15], t: '表3' },
  'LVPWd': { m: [6.3, 11.1], f: [5.5, 10.3], t: '表3' },
  'LVPWs': { m: [8.8, 16.2], f: [8.2, 15.2], t: '表3' },
  'LVEDD': { m: [38.4, 54], f: [36.7, 49.7], t: '表3' },
  'LVESD': { m: [22.6, 38.6], f: [20.8, 35.4], t: '表3' },
  'LVEDV': { m: [45.9, 127.5], f: [37.7, 106.7], t: '表3' },
  'LVESV': { m: [12.4, 50], f: [8.4, 43.6], t: '表3' },
  'LVEF': { m: [52.6, 76.2], f: [52.8, 77.2], t: '表3' },
  'LVM': { m: [77.6, 194], f: [57.1, 157.5], t: '表3' },
  'RA-l': { m: [35.2, 53.6], f: [32.3, 50.7], t: '表4' },
  'RA-t': { m: [26.4, 44.4], f: [23.9, 40.7], t: '表4' },
  'RVAW': { m: [2.1, 6.1], f: [2.2, 5.8], t: '表4' },
  'RVFW': { m: [2.2, 6.6], f: [2.2, 6.2], t: '表4' },
  'RVOT': { m: [15, 31.8], f: [14.6, 29.8], t: '表4' },
  'RV-ap': { m: [14.7, 29.9], f: [14, 28.2], t: '表4' },
  'RV-l': { m: [37.1, 75.1], f: [34.8, 68.6], t: '表4' },
  'RV-tm': { m: [16.5, 36.9], f: [14.8, 33.6], t: '表4' },
  'RV-tb': { m: [22.2, 42.2], f: [19.6, 39.2], t: '表4' },
  'ANN': { m: [16.4, 26.2], f: [15.1, 24.1], t: '表5' },
  'ROOT': { m: [23.8, 36.4], f: [21.3, 33.5], t: '表5' },
  'AAO': { m: [20.4, 35], f: [19, 32.8], t: '表5' },
  'ARCH': { m: [17.1, 31.7], f: [16.4, 29.8], t: '表5' },
  'DAO': { m: [12.8, 27], f: [12.4, 25], t: '表5' },
  'PVANN': { m: [13.8, 26.4], f: [13.1, 25.3], t: '表5' },
  'MPA': { m: [15.2, 26.2], f: [14.3, 26.1], t: '表5' },
  'RPA': { m: [7.6, 17.4], f: [7, 16.8], t: '表5' },
  'LPA': { m: [8, 17.4], f: [7.5, 16.9], t: '表5' },
  'MV-E': { m: [0.44, 1.18], f: [0.48, 1.3], t: '表6' },
  'MV-A': { m: [0.28, 1.06], f: [0.27, 1.17], t: '表6' },
  'MV-E/A': { m: [0.42, 2.22], f: [0.36, 2.36], t: '表6' },
  'MV-DT': { m: [79, 264], f: [81, 254], t: '表6' },
  'MV-Ad': { m: [61, 240], f: [49, 262], t: '表6' },
  'MV-Ard': { m: [60, 163], f: [64, 160], t: '表6' },
  'MV-ArA': { m: [-131, 52], f: [-151, 63], t: '表6' },
  'LVOT-v': { m: [0.56, 1.42], f: [0.57, 1.43], t: '表7' },
  'AV-v': { m: [0.79, 1.65], f: [0.84, 1.74], t: '表7' },
  'RVOT-v': { m: [0.41, 1.07], f: [0.43, 1.05], t: '表7' },
  'PV-v': { m: [0.63, 1.37], f: [0.62, 1.32], t: '表7' },
  'TV-E': { m: [0.31, 0.81], f: [0.32, 0.86], t: '表8' },
  'TV-A': { m: [0.2, 0.64], f: [0.19, 0.67], t: '表8' },
  'TV-E/A': { m: [0.6, 2.2], f: [0.5, 2.5], t: '表8' },
  'TDI-s-tv': { m: [8.1, 17.9], f: [8.1, 17.5], t: '表8' },
  'TDI-e-tv': { m: [5.4, 18.4], f: [5.4, 20], t: '表8' },
  'TDI-a-tv': { m: [5.3, 20.5], f: [5.7, 20.3], t: '表8' },
  'TDI-e/a-tv': { m: [0, 2], f: [0.1, 2.1], t: '表8' },
  'TDI-E/e-tv': { m: [1.9, 8.1], f: [1.9, 8.1], t: '表8' },
  'TDI-s-sept': { m: [5.5, 12.1], f: [5.1, 11.7], t: '表9' },
  'TDI-e-sept': { m: [4, 15.8], f: [3.8, 16.4], t: '表9' },
  'TDI-a-sept': { m: [5.3, 13.5], f: [4.8, 13], t: '表9' },
  'TDI-e/a-sept': { m: [0.1, 2.1], f: [0.2, 2.2], t: '表9' },
  'TDI-E/e-sept': { m: [3.2, 14.2], f: [3.2, 15.8], t: '表9' },
  'TDI-s-lat': { m: [5.7, 15.9], f: [5.5, 15.3], t: '表9' },
  'TDI-e-lat': { m: [5.4, 20.6], f: [5.2, 21.2], t: '表9' },
};

/* 表外派生值（指南未给，由本工具按指南的总人群值换算/派生，保留但标注） */
const DERIVED = {
  'LVM/BSA':  { m: [44.0, 109.0], f: [37.0, 99.0] },
  'LVM/H2.7': { m: [17.1, 46.6],  f: [17.5, 41.8] },
  'LVEDD/H':  { m: [2.22, 3.18],  f: [2.25, 3.13] },
  'LVRWT':    { m: [0.25, 0.51],  f: [0.24, 0.49] },
};

const CN = C.REFERENCE.CN;

console.log('\n=== 1. 项数与分组 ===');
is('CN_FIELDS = 64 项（指南表 2～表 9 共 60 项 + 4 项派生）',
  C.CN_FIELDS.length === 64, C.CN_FIELDS.length + ' 项');
is('分组 = 9 组', C.CN_GROUPS.length === 9, C.CN_GROUPS.length + ' 组');
is('分组拼接结果 == CN_FIELDS',
  C.CN_GROUPS.reduce(function (a, g) { return a.concat(g.keys); }, []).join(',') === C.CN_FIELDS.join(','));
is('分组内无重复键', new Set(C.CN_FIELDS).size === C.CN_FIELDS.length);
is('buildReferenceList 行数 = 64',
  C.buildReferenceList('male', {}, 'CN').length === 64);

console.log('\n=== 2. 指南原值逐项比对（60 项 × 男女）===');
let tOk = 0, tBad = 0;
Object.keys(REF).forEach(function (k) {
  const exp = REF[k];
  ['m', 'f'].forEach(function (s) {
    const got = (s === 'm' ? CN.male : CN.female)[k];
    if (!got) {
      tBad++;
      bad(exp.t + ' ' + k + ' (' + s + ')', '引擎缺该项');
      return;
    }
    if (Math.abs(got[0] - exp[s][0]) < 1e-9 && Math.abs(got[1] - exp[s][1]) < 1e-9) {
      tOk++;
    } else {
      tBad++;
      bad(exp.t + ' ' + k + ' (' + s + ')',
        '引擎 ' + got[0] + '–' + got[1] + '，指南 ' + exp[s][0] + '–' + exp[s][1]);
    }
  });
});
is('60 项 × 男女全部与指南一致', tBad === 0, tOk + ' 项通过 / ' + tBad + ' 项不符');

console.log('\n=== 3. 无多余项（引擎里不该有指南没有的参数）===');
const extra = C.CN_FIELDS.filter(function (k) {
  return !REF[k] && !DERIVED[k];
});
is('CN_FIELDS 无指南外参数', extra.length === 0, extra.join(',') || '无');

console.log('\n=== 4. 派生值 4 项 ===');
Object.keys(DERIVED).forEach(function (k) {
  const d = DERIVED[k];
  eqNum(k + ' 男下限', CN.male[k][0], d.m[0]);
  eqNum(k + ' 男上限', CN.male[k][1], d.m[1]);
  eqNum(k + ' 女下限', CN.female[k][0], d.f[0]);
  eqNum(k + ' 女上限', CN.female[k][1], d.f[1]);
});

console.log('\n=== 5. 区间自洽 ===');
let lo = 0;
C.CN_FIELDS.forEach(function (k) {
  ['male', 'female'].forEach(function (s) {
    const r = CN[s][k];
    if (!r || r[0] > r[1]) { lo++; bad(s + ' ' + k, r ? r.join('–') : '缺'); }
  });
});
is('64 项 × 男女下限 ≤ 上限', lo === 0, lo ? lo + ' 处异常' : '全部成立');

console.log('\n=== 6. 元信息与单位 ===');
const noMeta = C.CN_FIELDS.filter(function (k) { return !C.PARAM_META[k]; });
is('PARAM_META 覆盖全部 64 项', noMeta.length === 0, noMeta.join(',') || '全覆盖');
const UNITS = ['mm', 'mL', 'g', '%', 'g/m²', 'g/m²·⁷', 'cm/m', 'cm/m²', 'mL/m²', '', 'cm²', 'm/s', 'ms', 'cm/s'];
const badUnit = C.CN_FIELDS.filter(function (k) {
  const u = C.PARAM_META[k] && C.PARAM_META[k].unit;
  return UNITS.indexOf(u) < 0;
});
is('单位取值在白名单内', badUnit.length === 0, badUnit.join(',') || '全部合法');

console.log('\n=== 7. 分组标题只标每组第一行 ===');
const rowM = C.buildReferenceList('male', {}, 'CN');
const titled = rowM.filter(function (r) { return r.groupTitle; });
is('带标题的行数 = 组数 9', titled.length === 9, titled.length + ' 行');
is('标题与分组定义一一对应',
  titled.map(function (r) { return r.groupTitle; }).join('|') ===
  C.CN_GROUPS.map(function (g) { return g.t; }).join('|'));
is('每组首行确实是该组第一个键',
  C.CN_GROUPS.every(function (g) {
    const first = rowM.find(function (r) { return r.key === g.keys[0]; });
    return first && first.groupTitle === g.t;
  }));
const aseRow = C.buildReferenceList('male', {}, 'ASE').filter(function (r) { return r.groupTitle; });
is('ASE 表不带分组标题', aseRow.length === 0, aseRow.length + ' 行');

console.log('\n=== 8. 判定边界（用界面单位）===');
const j = C.judgeRange;
is('LVEDD 54.0（男上限）→ 正常', j(54.0, CN.male.LVEDD) === 'normal', j(54.0, CN.male.LVEDD));
is('LVEDD 54.1（男上限 +0.1）→ 偏高', j(54.1, CN.male.LVEDD) === 'high', j(54.1, CN.male.LVEDD));
is('LVEDD 49.7（女上限）→ 正常', j(49.7, CN.female.LVEDD) === 'normal', j(49.7, CN.female.LVEDD));
is('LVEDD 49.8（女上限 +0.1）→ 偏高', j(49.8, CN.female.LVEDD) === 'high', j(49.8, CN.female.LVEDD));
is('MV-ArA −140（低于 −131）→ 偏低', j(-140, CN.male['MV-ArA']) === 'low', j(-140, CN.male['MV-ArA']));
is('MV-ArA 0 → 正常', j(0, CN.male['MV-ArA']) === 'normal', j(0, CN.male['MV-ArA']));
is('MV-E 1.18（男上限）→ 正常', j(1.18, CN.male['MV-E']) === 'normal', j(1.18, CN.male['MV-E']));
is('MV-E 1.19（男上限 +0.01）→ 偏高', j(1.19, CN.male['MV-E']) === 'high', j(1.19, CN.male['MV-E']));

console.log('\n=== 9. 男女差异（防止再出现「女列被填成男值」）===');
const same = [];
Object.keys(REF).forEach(function (k) {
  const m = CN.male[k], f = CN.female[k];
  // 上限完全相等的两项在三尖瓣 E/e′ 上确实存在（男女均为 8.1），单独放行
  if (k === 'TDI-E/e-tv') return;
  if (m[1] === f[1] && m[0] === f[0]) same.push(k);
});
is('除三尖瓣 E/e′ 外，男女区间不完全相同', same.length === 0, same.join(',') || '全部有差异');

console.log('\n' + '='.repeat(46));
console.log('结果： ' + pass + ' 通过 / ' + fail + ' 失败');
console.log('='.repeat(46) + '\n');
process.exit(fail > 0 ? 1 : 0);
