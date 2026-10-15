/**
 * verify-calc.js — echo-calc.js 引擎验证
 * 所有期望值均经手工独立计算核对（2026-10-15）
 */
const C = require('./miniprogram/utils/echo-calc.js');

let pass = 0, fail = 0;
function check(name, actual, expected, tol) {
  if (typeof expected === 'string' || typeof actual === 'string') {
    if (actual === expected) { pass++; console.log('  ✓ ' + name); return; }
    fail++; console.log('  ✗ ' + name + '  期望 ' + expected + '，实际 ' + actual);
    return;
  }
  const d = Math.abs(actual - expected);
  if (d <= (tol === undefined ? 1e-9 : tol)) { pass++; console.log('  ✓ ' + name); return; }
  fail++; console.log('  ✗ ' + name + '  期望 ' + expected + '，实际 ' + actual + ' (差 ' + d + ')');
}

console.log('=== 1. CSA / SV / CO / CI ===');
check('CSA d=2.0 = π', C.round(C.csaFromDiameter(2.0), 4), C.round(Math.PI, 4), 1e-9);
check('SV d=2.0 VTI=20 = 62.83', C.round(C.strokeVolume(2.0, 20), 2), 62.83, 0.01);
check('CO SV=62.83 HR=70 = 4.398', C.round(C.cardiacOutput(62.83, 70), 3), 4.398, 0.001);

console.log('=== 2. Qp/Qs ===');
// Qp: RVOT d=2.2 → CSA=π×1.21=3.8013, VTI=15 → 57.02; Qs: 62.83 → 0.9076
const sv0 = C.strokeVolume(2.0, 20);
check('Qp/Qs = 0.9076', C.round(C.strokeVolume(2.2, 15) / sv0, 4), 0.9076, 0.0005);

console.log('=== 3. 伯努利压差 ===');
check('4(V2²−V1²) v2=4 v1=1 = 60', C.bernoulli(4, 1), 60, 1e-9);
check('缺省 v1: v2=1 → 4', C.bernoulli(1), 4, 1e-9);
check('v2=2 v1=0 → 16', C.bernoulli(2, 0), 16, 1e-9);

console.log('=== 4. AVA ===');
check('连续方程 62.83/30 = 2.094', C.round(C.avaContinuity(62.83, 30), 3), 2.094, 0.001);
check('分级 2.094 轻度', C.gradeAva(2.094).level, 'normal');
check('分级 1.2 中度', C.gradeAva(1.2).level, 'moderate');
check('分级 0.8 重度', C.gradeAva(0.8).level, 'severe');
check('峰速法 2/1.0/4.0 = 0.785', C.round(C.avaPeak(2.0, 1.0, 4.0), 3), 0.785, 0.001);

console.log('=== 5. MVA ===');
check('PHT 100 → 2.2', C.mvaPht(100), 2.2, 1e-9);
check('PHT 220 → 1.0', C.mvaPht(220), 1.0, 1e-9);
check('PHT 300 → 0.7333', C.round(C.mvaPht(300), 4), 0.7333, 0.0001);
check('分级 0.73 重度', C.gradeMva(0.7333).level, 'severe');
check('分级 1.2 中度', C.gradeMva(1.2).level, 'moderate');
check('连续方程 62.83/25 = 2.513', C.round(C.mvaContinuity(62.83, 25), 3), 2.513, 0.001);

console.log('=== 6. PISA ===');
// r=0.8, Va=40 → flow = 2π×0.64×40 = 160.8495
const p = C.pisa(0.8, 40, 5.0, 150);
check('流量 160.85', C.round(p.flow, 2), 160.85, 0.01);
check('EROA 0.3217', C.round(p.eroa, 4), 0.3217, 0.0005);
check('RVol 48.26', C.round(p.rvol, 2), 48.26, 0.01);
check('EROA 分级 中度', C.gradeEroa(p.eroa).level, 'moderate');
check('RVol 分级 中度', C.gradeRvol(p.rvol).level, 'moderate');
check('EROA 0.45 重度', C.gradeEroa(0.45).level, 'severe');
check('RVol 70 重度', C.gradeRvol(70).level, 'severe');
check('EROA 0.15 轻度', C.gradeEroa(0.15).level, 'normal');
check('RVol 20 轻度', C.gradeRvol(20).level, 'normal');

console.log('=== 7. dP/dt ===');
check('32000/64 = 500', C.dpdt(64), 500, 1e-9);
check('分级 500 减低', C.gradeDpdt(500).level, 'severe');
check('分级 900 临界', C.gradeDpdt(900).level, 'moderate');
check('分级 1280 正常', C.gradeDpdt(1280).level, 'normal');

console.log('=== 8. 心房容积指数 ===');
check('LAVI 90/1.75 = 51.43', C.round(C.atrialIndex(90, 1.75), 2), 51.43, 0.01);

console.log('=== 9. RAP / PASP / PADP / PVR / PH 概率 ===');
check('IVC 15 塌陷>50% → RAP 3', C.rapFromIvc(15, 'yes'), 3, 0);
check('IVC 25 塌陷≤50% → RAP 15', C.rapFromIvc(25, 'no'), 15, 0);
check('IVC 25 塌陷>50% → RAP 8', C.rapFromIvc(25, 'yes'), 8, 0);
check('IVC 15 未评估 → RAP 8', C.rapFromIvc(15, ''), 8, 0);
check('PASP TR=3.0 RAP=8 = 44', C.pasp(3.0, 8), 44, 1e-9);
check('PADP PR末=1.2 RAP=8 = 13.76', C.round(C.padp(1.2, 8), 2), 13.76, 0.01);
check('PVR TR=3.0 VTI=15 = 2.16', C.round(C.pvrEstimate(3.0, 15), 4), 2.16, 0.0001);
check('PH 3.5 → 高', C.phProbability(3.5, null), '高');
check('PH 3.0 有征象 → 高', C.phProbability(3.0, true), '高');
check('PH 3.0 无征象 → 中', C.phProbability(3.0, false), '中');
check('PH 2.5 有征象 → 中', C.phProbability(2.5, true), '中');
check('PH 2.5 无征象 → 低', C.phProbability(2.5, false), '低');
check('PH 2.5 未评估 → 待补充', C.phProbability(2.5, null), '待补充支持征象');

console.log('=== 10. 右室 FAC ===');
check('FAC 20/13 = 35%', C.round(C.fac(20, 13), 2), 35, 0.01);
check('FAC 20/12 = 40%', C.round(C.fac(20, 12), 2), 40, 0.01);

console.log('=== 11. 舒张功能比值 ===');
const d1 = C.diastolicRatios(80, 60, 10, 14);
check('E/A 1.3333', C.round(d1.ea, 4), 1.3333, 0.0005);
check('平均 e′ = 12 → E/e′ 6.6667', C.round(d1.avgEe, 4), 6.6667, 0.0005);
check('E/e′ 15 升高', C.gradeEe(15).text, '左房压升高');
check('E/e′ 7 正常', C.gradeEe(7).text, '左房压正常');
check('E/e′ 10 灰区', C.gradeEe(10).text, '灰区');
const d2 = C.diastolicRatios(80, null, null, 14);
check('缺 A 不算 E/A', d2.ea === undefined ? 'skip' : 'bad', 'skip');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
