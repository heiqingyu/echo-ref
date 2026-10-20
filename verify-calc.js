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

console.log('=== 12. PASP / RAP 分级 ===');
check('PASP 4×3²+8 = 44', C.pasp(3.0, 8), 44, 1e-9);
check('PASP 35 正常', C.paspGrade(35).level, 0);
check('PASP 45 轻度', C.paspGrade(45).level, 1);
check('PASP 60 中度', C.paspGrade(60).level, 2);
check('PASP 75 重度', C.paspGrade(75).level, 3);
check('IVC 18 + 塌陷充分 → RAP 3', C.rapEstimate(18, 'yes').rap, 3);
check('IVC 24 + 塌陷差 → RAP 15', C.rapEstimate(24, 'no').rap, 15);
check('IVC 18 + 塌陷差 → RAP 8', C.rapEstimate(18, 'no').rap, 8);
check('IVC 24 + 塌陷充分 → RAP 8', C.rapEstimate(24, 'yes').rap, 8);

console.log('=== 13. PVR / SVR ===');
// (45−12)/5 = 6.6 WU；dyn = 33×80/5 = 528
const pvr = C.pvrResistance(45, 12, 5);
check('PVR 6.6 WU', C.round(pvr.wu, 2), 6.6, 0.01);
check('PVR 528 dyn', C.round(pvr.dyn, 0), 528, 0.5);
check('PVR 6.6 重度', pvr.text.indexOf('重度') === 0 ? 'ok' : pvr.text, 'ok');
check('PVR 1.5 WU 正常', C.pvrResistance(27, 12, 10).wu === 1.5 ? 'ok' : 'bad', 'ok');
check('PVR mPAP<PAWP 报错', C.pvrResistance(10, 15, 5).error ? 'ok' : 'bad', 'ok');
// SVR (65−5)×80/5 = 960
const svr = C.svrResistance(65, 5, 5, 1.8);
check('SVR 960 dyn', C.round(svr.dyn, 0), 960, 0.5);
check('SVRI 1728', C.round(svr.svri, 0), 1728, 0.5);
check('SVR 960 正常', svr.text.indexOf('正常') !== -1 ? 'ok' : svr.text, 'ok');
check('SVR 700 偏低', C.svrResistance(40, 5, 4).text.indexOf('降低') !== -1 ? 'ok' : 'bad', 'ok');

console.log('=== 14. 人工瓣 EOAi / PPM ===');
check('EOAi 1.5/1.8 = 0.833', C.round(C.eoaPpm(1.5, 1.8, 1).eoai, 3), 0.833, 0.001);
check('主动脉位 0.833 重度 PPM', C.eoaPpm(1.5, 1.8, 1).level, 2);
check('主动脉位 1.6/1.8 = 0.889 中度', C.eoaPpm(1.6, 1.8, 1).level, 1);
check('主动脉位 2.0/1.8 = 1.11 无 PPM', C.eoaPpm(2.0, 1.8, 1).level, 0);
check('二尖瓣位 1.5/1.8 = 0.833 重度', C.eoaPpm(1.5, 1.8, 2).level, 2);
check('二尖瓣位 2.0/1.8 = 1.11 中度', C.eoaPpm(2.0, 1.8, 2).level, 1);
check('二尖瓣位 2.4/1.8 = 1.33 无 PPM', C.eoaPpm(2.4, 1.8, 2).level, 0);

console.log('=== 15. 容积指数 ===');
const vi = C.volumeIndices(150, 60, 1.8, false);
check('EF 60%', C.round(vi.ef, 1), 60, 0.05);
check('EDVi 83.3', C.round(vi.edvi, 1), 83.3, 0.05);
check('ESVi 33.3', C.round(vi.esvi, 1), 33.3, 0.05);
check('EDVi 83 男上限 74 → 轻度增大', vi.edviText, '轻度增大');
check('ESVi 33 男上限 31 → 轻度增大', vi.esviText, '轻度增大');
check('无 BSA 只出 EF/SV', C.volumeIndices(150, 60, 0, false).edvi === undefined ? 'ok' : 'bad', 'ok');
check('ESV≥EDV 报错', C.volumeIndices(60, 60, 1.8, false).error ? 'ok' : 'bad', 'ok');

console.log('=== 16. 相对室壁应力 ===');
check('RWS 140/5.5/1.1 = 194.8', C.round(C.relativeWallStress(140, 5.5, 1.1).rws, 1), 194.8, 0.05);
// 0.334×100×5.0 / (1.2×(1+1.2/5)) = 167/1.488 = 112.2
check('RWS 100/5.0/1.2 = 112.2', C.round(C.relativeWallStress(100, 5.0, 1.2).rws, 1), 112.2, 0.1);
check('RWS 110/5/1.2 → 正常', C.relativeWallStress(110, 5.0, 1.2).text.indexOf('正常') !== -1 ? 'ok' : 'bad', 'ok');
check('RWS 高值 → 升高', C.relativeWallStress(160, 5.5, 1.0).text.indexOf('升高') !== -1 ? 'ok' : 'bad', 'ok');

console.log('=== 17. 球形指数 ===');
check('SI 5.5/8.5 = 0.647', C.round(C.sphericityIndex(5.5, 8.5).si, 3), 0.647, 0.001);
check('SI 0.647 正常', C.sphericityIndex(5.5, 8.5).text, '形态正常（≤0.65）');
check('SI 6.0/8.0 边界归 0.66–0.75', C.sphericityIndex(6.0, 8.0).text, '球形化（0.66–0.75）');
check('SI 7.0/8.0 = 0.875 显著', C.sphericityIndex(7.0, 8.0).text.indexOf('显著') === 0 ? 'ok' : 'bad', 'ok');
check('短径≥长径 报错', C.sphericityIndex(8, 8).error ? 'ok' : 'bad', 'ok');

console.log('=== 18. 左房应变三值 ===');
const la = C.laStrainTri(30, 18, 12);
check('LASr 30 正常', la.srText.indexOf('正常') !== -1 ? 'ok' : 'bad', 'ok');
check('三值自洽', la.consistent, true);
check('LASr 25 轻度', C.laStrainTri(25, 15, 10).level, 1);
check('LASr 20 中度', C.laStrainTri(20, 12, 8).level, 2);
check('LASr 15 重度', C.laStrainTri(15, 9, 6).level, 3);
const laBad = C.laStrainTri(30, 10, 8);
check('偏差 12 判不自洽', laBad.consistent, false);
check('取绝对值（负数输入）', C.laStrainTri(30, 18, -12).sct, 12);

console.log('=== 19. 升主动脉指数 ===');
const ao = C.aortaIndex(36, 1.8, false);
check('指数 3.6cm/1.8 = 2.0', C.round(ao.index, 2), 2.0, 0.001);
check('2.0 边缘', ao.level, 1);
check('42mm/1.8 = 2.33 扩张', C.aortaIndex(42, 1.8, false).level, 2);
check('50mm/1.8 = 2.78 显著', C.aortaIndex(50, 1.8, false).level, 3);
check('34mm/1.8 = 1.89 正常', C.aortaIndex(34, 1.8, false).level, 0);

console.log('=== 20. 应变离散度 ===');
const mds = C.strainDispersion([-18, -20, -16, -19, -15, -17]);
check('均值 17.5', C.round(mds.mean, 1), 17.5, 0.05);
check('SD 1.87', C.round(mds.sd, 2), 1.87, 0.01);
check('n=6', mds.n, 6);
check('少于 3 值不给结果', C.strainDispersion([-18, -20]).sd === undefined ? 'ok' : 'bad', 'ok');
check('SD 6 判离散增大', C.strainDispersion([-10, -22, -12, -20, -11, -21]).text.indexOf('增大') !== -1 ? 'ok' : 'bad', 'ok');

console.log('=== 21. 每搏功 ===');
// 70×90×0.0136 = 85.68
const sw = C.strokeWork(70, 90, 1.8);
check('SW 85.68 g·m', C.round(sw.sw, 2), 85.68, 0.01);
check('SWi 47.6', C.round(sw.swi, 1), 47.6, 0.05);
check('SW 85 正常', sw.text.indexOf('正常') !== -1 ? 'ok' : 'bad', 'ok');
check('SW 40/90 = 48.96 偏低', C.strokeWork(40, 90, 1.8).text.indexOf('偏低') !== -1 ? 'ok' : 'bad', 'ok');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
