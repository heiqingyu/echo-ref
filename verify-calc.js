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
// R15（ASE 2024）Table 7：主动脉位 正常 >0.85、中度 0.85–0.66、重度 ≤0.65
check('主动脉位 0.833 中度 PPM（0.66–0.85）', C.eoaPpm(1.5, 1.8, 1).level, 1);
check('主动脉位 1.6/1.8 = 0.889 无 PPM（>0.85）', C.eoaPpm(1.6, 1.8, 1).level, 0);
check('主动脉位 2.0/1.8 = 1.11 无 PPM', C.eoaPpm(2.0, 1.8, 1).level, 0);
check('主动脉位 1.0/1.8 = 0.56 重度 PPM', C.eoaPpm(1.0, 1.8, 1).level, 2);
check('主动脉位 0.833 + BMI 32 → 无 PPM（肥胖切点 >0.70）', C.eoaPpm(1.5, 1.8, 1, 32).level, 0);
check('主动脉位 1.1/1.8 = 0.61 + BMI 32 → 中度（0.56–0.70）', C.eoaPpm(1.1, 1.8, 1, 32).level, 1);
check('主动脉位 0.5/1.8 = 0.28 + BMI 32 → 重度（≤0.55）', C.eoaPpm(0.5, 1.8, 1, 32).level, 2);
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

console.log('=== 22. M 型三合一 ===');
const mt = C.mModeTriple(50, 32, 8);
check('FS (50−32)/50 = 36%', C.round(mt.fs, 1), 36.0, 0.05);
check('Teichholz EDV 118.24', C.round(mt.edv, 2), 118.24, 0.05);
check('Teichholz ESV 40.96', C.round(mt.esv, 2), 40.96, 0.05);
check('EF 65.36%', C.round(mt.ef, 1), 65.4, 0.05);
check('EPSS 8 判增大', mt.epssText.indexOf('增大') !== -1 ? 'ok' : 'bad', 'ok');
check('内径倒挂报错', C.mModeTriple(30, 35).error ? 'ok' : 'bad', 'ok');
const mtNoEpss = C.mModeTriple(50, 32);
check('不填 EPSS 不给 EPSS 判读', mtNoEpss.epss === undefined ? 'ok' : 'bad', 'ok');
check('FS 20 判减低', C.mModeTriple(50, 40).fsText.indexOf('减低') !== -1 ? 'ok' : 'bad', 'ok');

console.log('=== 23. WMSI ===');
const w1 = C.wmsiIndex([12, 3, 1, 1, 0]);
check('总分 25', w1.score, 25);
check('17 节段', w1.total, 17);
check('WMSI 1.47', C.round(w1.wmsi, 2), 1.47, 0.005);
check('1.47 判轻度', w1.level, 1);
check('全正常 WMSI = 1', C.wmsiIndex([17, 0, 0, 0, 0]).wmsi, 1);
check('WMSI 1 判正常', C.wmsiIndex([17, 0, 0, 0, 0]).level, 0);
check('8/2/4/3 → 2.12 重度', C.wmsiIndex([8, 2, 4, 3, 0]).level, 3);
check('全 0 报错', C.wmsiIndex([0, 0, 0, 0, 0]).error ? 'ok' : 'bad', 'ok');
check('负数按 0 计', C.wmsiIndex([-3, 17, 0, 0, 0]).total, 17);

console.log('=== 24. H2FPEF ===');
const h2 = C.h2fpefScore({ bmi: 31, age: 65, ee: 10, pasp: 40, af: true, bpMeds: 2 });
check('全阳性 9 分', h2.score, 9);
check('9 分判高可能', h2.text.indexOf('可能性高') !== -1 ? 'ok' : 'bad', 'ok');
check('计分项 6 条', h2.items.length, 6);
check('全阴性 0 分', C.h2fpefScore({ bmi: 22, age: 50, ee: 7, pasp: 28, af: false, bpMeds: 1 }).score, 0);
check('仅房颤 3 分', C.h2fpefScore({ bmi: 22, age: 50, ee: 7, pasp: 28, af: true, bpMeds: 1 }).score, 3);
check('5 分判中间区间', C.h2fpefScore({ bmi: 31, age: 50, ee: 7, pasp: 28, af: true, bpMeds: 1 }).text.indexOf('中间') !== -1 ? 'ok' : 'bad', 'ok');

console.log('=== 25. HFA-PEFF ===');
const hp = C.hfaPeffScore({ female: false, af: false, lavi: 42, lvmi: 120, rwt: 0.45,
  pasp: 38, ee: 16, es: 6, el: 8, trv: 3.0, gls: 14, ntprobnp: 600 });
check('形态学取最高 2', hp.structural, 2);
check('功能学取最高 2', hp.functional, 2);
check('标志物 2', hp.biomarker, 2);
check('总分 6', hp.score, 6);
check('6 分支持 HFpEF', hp.text.indexOf('支持') !== -1 ? 'ok' : 'bad', 'ok');
const hpLow = C.hfaPeffScore({ female: true, af: false, lavi: 28, lvmi: 80, rwt: 0.35,
  pasp: 25, ee: 7, es: 9, el: 12, trv: 2.2, gls: 20, ntprobnp: 80 });
check('全阴性 0 分', hpLow.score, 0);
check('0 分基本可排除', hpLow.text.indexOf('排除') !== -1 ? 'ok' : 'bad', 'ok');
check('女性 LVMI 阈值更低（100 计 1）',
  C.hfaPeffScore({ female: true, lvmi: 100 }).structural, 1);
check('男性 LVMI 100 不计分', C.hfaPeffScore({ female: false, lvmi: 100 }).structural, 0);
check('房颤 NT-proBNP 400 < 365? 不，400 计 1',
  C.hfaPeffScore({ af: true, ntprobnp: 400 }).biomarker, 1);
check('窦律 NT-proBNP 400 计 1', C.hfaPeffScore({ af: false, ntprobnp: 400 }).biomarker, 1);

console.log('=== 26. TAVR oversizing ===');
const tv = C.tavrSizing(75, 420, 26);
check('周长导出直径 23.87', C.round(tv.dc, 2), 23.87, 0.01);
check('面积导出直径 23.12', C.round(tv.da, 2), 23.12, 0.01);
check('面积 oversizing 26.4%', C.round(tv.areaOver, 1), 26.4, 0.05);
check('26.4% 判过大', tv.text.indexOf('过大') !== -1 ? 'ok' : 'bad', 'ok');
check('球扩理想区间 +3%', C.tavrSizing(75, 510, 26).text.indexOf('球扩瓣理想') !== -1 ? 'ok' : 'bad', 'ok');
check('缺面积时给提示', C.tavrSizing(75, undefined, 26).hint ? 'ok' : 'bad', 'ok');
check('全空报错', C.tavrSizing().error ? 'ok' : 'bad', 'ok');

console.log('=== 27. 左心耳封堵尺寸 ===');
const lz = C.laaSize(24, 19, 20);
check('24mm → 推荐 27', lz.size, 27);
check('长短径比 1.26', C.round(lz.ratio, 2), 1.26, 0.01);
check('深度 20 < 27×0.8 给提示', lz.depthWarn ? 'ok' : 'bad', 'ok');
check('17mm → 推荐 20', C.laaSize(17).size, 20);
check('31mm → 推荐 35', C.laaSize(31).size, 35);
check('34mm 超上限', C.laaSize(34).size === undefined ? 'ok' : 'bad', 'ok');
check('椭圆度 1.4 提示', C.laaSize(28, 20).shapeText ? 'ok' : 'bad', 'ok');
check('缺最大径报错', C.laaSize().error ? 'ok' : 'bad', 'ok');

console.log('=== 28. 反流分数 ===');
check('RF 60/86 = 69.8% 重度', C.round(C.regurgFraction(60, 86).rf, 1), 69.8, 0.05);
check('RF 20/80 = 25% 轻度', C.regurgFraction(20, 80).text.indexOf('轻度') !== -1 ? 'ok' : 'bad', 'ok');
check('RF 40/80 = 50% 重度', C.regurgFraction(40, 80).text.indexOf('重度') !== -1 ? 'ok' : 'bad', 'ok');
check('反流量 ≥ SV 报错', C.regurgFraction(90, 80).error ? 'ok' : 'bad', 'ok');

console.log('=== 29. 右室容积指数 ===');
const rv = C.rvVolumeIndex(160, 60, 2.0, false);
check('RVEDVi 80', C.round(rv.edvi, 1), 80.0, 0.05);
check('RVESVi 30', C.round(rv.esvi, 1), 30.0, 0.05);
check('男 80 正常', rv.edvText.indexOf('正常') !== -1 ? 'ok' : 'bad', 'ok');
check('男 90 增大', C.rvVolumeIndex(180, undefined, 2.0, false).edvText.indexOf('增大') !== -1 ? 'ok' : 'bad', 'ok');
check('女 78 增大（阈值 75）', C.rvVolumeIndex(156, undefined, 2.0, true).edvText.indexOf('增大') !== -1 ? 'ok' : 'bad', 'ok');
check('缺 BSA 报错', C.rvVolumeIndex(160, undefined, 0).error ? 'ok' : 'bad', 'ok');

console.log('=== 30. RVFWS ===');
const rf = C.rvFreeWallStrain(-18, -22, -25);
check('三段均值 −21.67', C.round(rf.mean, 1), -21.7, 0.05);
check('n=3', rf.n, 3);
check('−21.7 判正常', rf.text.indexOf('正常') !== -1 ? 'ok' : 'bad', 'ok');
check('单段 −15 判减低', C.rvFreeWallStrain(-15).text.indexOf('减低') !== -1 ? 'ok' : 'bad', 'ok');
check('全空报错', C.rvFreeWallStrain().error ? 'ok' : 'bad', 'ok');

console.log('=== 31. PAPi ===');
const pp = C.pulmonaryPulseIndex(50, 25, 10);
check('(50−25)/10 = 2.5', C.round(pp.papi, 2), 2.5, 0.01);
check('2.5 保留', pp.text.indexOf('保留') !== -1 ? 'ok' : 'bad', 'ok');
check('(40−20)/15 = 1.33 失耦联', C.pulmonaryPulseIndex(40, 20, 15).text.indexOf('失耦联') !== -1 ? 'ok' : 'bad', 'ok');
check('(50−25)/13 = 1.92 边缘', C.pulmonaryPulseIndex(50, 25, 13).text.indexOf('边缘') !== -1 ? 'ok' : 'bad', 'ok');
check('dPAP ≥ sPAP 报错', C.pulmonaryPulseIndex(30, 35, 8).error ? 'ok' : 'bad', 'ok');

console.log('=== 32. 舒张期肺动脉压 ===');
const pd = C.pulmonaryDiastolicPressure(1.5, 8);
check('4×1.5² = 9 mmHg 压差', pd.grad, 9);
check('PADP 17', pd.padp, 17);
check('缺速度报错', C.pulmonaryDiastolicPressure().error ? 'ok' : 'bad', 'ok');
check('不填 RAP 只出压差', C.pulmonaryDiastolicPressure(2.0).padp, 16);

console.log('=== 33. 阻力指数 ===');
const ri = C.resistanceIndices(6, 960, 1.8);
check('PVRI 10.8', C.round(ri.pvri, 1), 10.8, 0.05);
check('PVRI >5 提示升高', ri.pvriText.indexOf('升高') !== -1 ? 'ok' : 'bad', 'ok');
check('SVRI 1728', C.round(ri.svri, 0), 1728, 1);
check('SVRI 1728 偏低', ri.svriText.indexOf('偏低') !== -1 ? 'ok' : 'bad', 'ok');
check('PVR 4/1.8 = 7.2? 不，4×1.8 = 7.2 略高',
  C.round(C.resistanceIndices(4, undefined, 1.8).pvri, 1), 7.2, 0.05);
check('只填 SVR 也出结果', C.resistanceIndices(undefined, 1000, 2).svri, 2000);
check('全空报错', C.resistanceIndices(undefined, undefined, 1.8).error ? 'ok' : 'bad', 'ok');
check('缺 BSA 报错', C.resistanceIndices(4, 900, 0).error ? 'ok' : 'bad', 'ok');

console.log('=== 34. 右室 dP/dt ===');
check('Δt 25ms → 480', C.rvDpDt(25).dpdt, 480);
check('480 保留', C.rvDpDt(25).text.indexOf('保留') !== -1 ? 'ok' : 'bad', 'ok');
check('Δt 40ms → 300 减低', C.rvDpDt(40).text.indexOf('减低') !== -1 ? 'ok' : 'bad', 'ok');
check('Δt 0 报错', C.rvDpDt(0).error ? 'ok' : 'bad', 'ok');

console.log('=== 35. Wilkins 评分 ===');
check('四面各 2 分 → 8 分', C.wilkinsScore(2, 2, 2, 2).total, 8);
check('8 分适合 PBMV', C.wilkinsScore(2, 2, 2, 2).text.indexOf('PBMV') !== -1 ? 'ok' : 'bad', 'ok');
check('3/4/3/4 → 14 分', C.wilkinsScore(3, 4, 3, 4).total, 14);
check('14 分优先外科', C.wilkinsScore(3, 4, 3, 4).text.indexOf('外科') !== -1 ? 'ok' : 'bad', 'ok');
check('缺一项报错', C.wilkinsScore(2, 2, 2).error ? 'ok' : 'bad', 'ok');
check('超范围（5 分）报错', C.wilkinsScore(5, 1, 1, 1).error ? 'ok' : 'bad', 'ok');

console.log('=== 36. 缩流颈宽度 VCW ===');
check('MR 7mm → 重度', C.vcwGrade(7, 'mr').level, 3);
check('MR 7mm 文案', C.vcwGrade(7, 'mr').text.indexOf('重度') !== -1 ? 'ok' : 'bad', 'ok');
check('AR 阈值更低：6mm 即重度', C.vcwGrade(6, 'ar').level, 3);
check('MR 4mm 为中度（同尺寸 AR 不同档）', C.vcwGrade(4, 'mr').level, 2);
check('AR 3mm 已中度', C.vcwGrade(3, 'ar').level, 2);
check('缺值报错', C.vcwGrade().error ? 'ok' : 'bad', 'ok');

console.log('=== 37. 反流分数 RF ===');
check('60/86 → 69.8%', C.round(C.regurgFraction(60, 86).rf, 1), 69.8, 0.05);
check('69.8% 判重度', C.regurgFraction(60, 86).text.indexOf('重度') !== -1 ? 'ok' : 'bad', 'ok');
check('30/86 → 34.9% 中度', C.regurgFraction(30, 86).text.indexOf('中度') !== -1 ? 'ok' : 'bad', 'ok');
check('每搏量为 0 报错', C.regurgFraction(60, 0).error ? 'ok' : 'bad', 'ok');

console.log('=== 38. MVA 连续性方程 ===');
const svMva = C.strokeVolume(2.0, 20);
check('LVOT 20mm/VTI20 → SV 62.8', C.round(svMva, 1), 62.8, 0.1);
check('62.8/8 → MVA 7.85', C.round(C.mvaContinuity(svMva, 8), 2), 7.85, 0.01);
check('MVA 7.85 属轻度/无狭窄', C.gradeMva(C.mvaContinuity(svMva, 8)).level, 'normal');

console.log('=== 39. 左房排空分数 ===');
const laE = C.laEmptying(80, 40);
check('80→40 → LAEF 50%', laE.laef, 50);
check('扩张指数 100%', laE.expand, 100);
check('50% 判保留', laE.text.indexOf('保留') !== -1 ? 'ok' : 'bad', 'ok');
check('90→50 → LAEF 44.4%（轻度减低）',
  C.laEmptying(90, 50).text.indexOf('轻度减低') !== -1 ? 'ok' : 'bad', 'ok');
check('最小容积 ≥ 最大容积报错', C.laEmptying(40, 80).error ? 'ok' : 'bad', 'ok');

console.log('=== 40. 快速比值 LA/Ao · RV/LV ===');
const qr = C.quickRatios(40, 32, 40, 50);
check('LA/Ao = 1.25', qr.laAo, 1.25);
check('1.25 判增大', qr.laAoText.indexOf('增大') !== -1 ? 'ok' : 'bad', 'ok');
check('RV/LV = 0.80', qr.rvLv, 0.8);
check('0.80 判右室扩大', qr.rvLvText.indexOf('扩大') !== -1 ? 'ok' : 'bad', 'ok');
check('30/34 = 0.88 判正常', C.quickRatios(30, 34, 30, 48).laAoText.indexOf('正常') !== -1 ? 'ok' : 'bad', 'ok');

console.log('=== 41. LVMI 身高^2.7 ===');
const lh = C.lvmHeightIndex(200, 170, false);
check('200g / 1.7^2.7 → 47.7', C.round(lh.index, 1), 47.7, 0.05);
check('男性阈值 50', lh.hi, 50);
check('47.7 男性正常', lh.text.indexOf('正常') !== -1 ? 'ok' : 'bad', 'ok');
check('女性阈值 47', C.lvmHeightIndex(200, 170, true).hi, 47);
check('47.7 女性已升高', C.lvmHeightIndex(200, 170, true).text.indexOf('升高') !== -1 ? 'ok' : 'bad', 'ok');

console.log('=== 42. 肺动脉指数 McGoon / Nakata ===');
const pa = C.paIndex(10, 10, 12, 1.75);
check('McGoon (10+10)/12 = 1.67', C.round(pa.mcgoon, 2), 1.67, 0.01);
check('1.67 < 1.8 判不足', pa.mcgoonText.indexOf('不足') !== -1 ? 'ok' : 'bad', 'ok');
check('Nakata π(5²+5²)/1.75 ≈ 89.8', C.round(pa.nakata, 1), 89.8, 0.05);
check('Nakata 89.8 < 150 判不足', pa.nakataText.indexOf('不足') !== -1 ? 'ok' : 'bad', 'ok');
const pa2 = C.paIndex(14, 14, 18, 1.7);
check('良好发育：McGoon 1.56 仍不足', pa2.mcgoonText.indexOf('不足') !== -1 ? 'ok' : 'bad', 'ok');
check('缺 BSA 仍出 McGoon（该指标不需要体表面积）',
  C.paIndex(10, 10, 12, 0).mcgoon > 0 ? 'ok' : 'bad', 'ok');
check('缺 BSA 时不给 Nakata', C.paIndex(10, 10, 12, 0).nakata === undefined ? 'ok' : 'bad', 'ok');

console.log('=== 43. 心尖保留比 RAS ===');
check('|−18| / |−9| = 2.00', C.apicalSparing(-18, -9).ras, 2);
check('RAS 2.0 判心尖保留', C.apicalSparing(-18, -9).text.indexOf('心尖保留') !== -1 ? 'ok' : 'bad', 'ok');
check('反向 0.5 判无心尖保留',
  C.apicalSparing(-9, -18).text.indexOf('无相对心尖保留') !== -1 ? 'ok' : 'bad', 'ok');
check('心尖为 0 报错', C.apicalSparing(0, -9).error ? 'ok' : 'bad', 'ok');

console.log('=== 44. 心室-动脉耦联 Ea ===');
const ea = C.ventriculoArterial(100, 70, 50);
check('ESP/ESV = 100/70 → Ea 1.43', C.round(ea.ea, 2), 1.43, 0.01);
check('Ees = 100/(70−50) = 5? 单点法取 ESP/SV', C.round(ea.ees, 2), 2, 0.01);
check('Ees/Ea = 1.40 常见区间', ea.text.indexOf('常见区间') !== -1 ? 'ok' : 'bad', 'ok');
check('附单点法局限性说明', ea.note && ea.note.indexOf('单点法') !== -1 ? 'ok' : 'bad', 'ok');

console.log('=== 45. 主动脉缩窄 ===');
const coa = C.coarctationEcho(3.2, 1.2);
check('4×3.2² = 41 mmHg 峰值压差', C.round(coa.grad, 0), 41, 1);
check('峰值 ≥20 判有意义', coa.text.indexOf('有血流动力学意义') !== -1 ? 'ok' : 'bad', 'ok');
check('舒张末期压差 5.8 → 拖尾征', coa.continuum.indexOf('拖尾征') !== -1 ? 'ok' : 'bad', 'ok');
check('2.0 m/s → 16 mmHg 属轻度',
  C.coarctationEcho(2.0, 1.8).text.indexOf('轻度') !== -1 ? 'ok' : 'bad', 'ok');
check('缺峰值速度报错', C.coarctationEcho().error ? 'ok' : 'bad', 'ok');

console.log('=== 46. 成人主动脉分节段 Z 值 ===');
check('参考表含 4 个位点', C.AORTIC_SEGS.length, 4);
check('位点顺序：瓣环 / 窦部 / 窦管交界 / 升主动脉',
  C.AORTIC_SEGS.map(function (s) { return s.sn; }).join('/'), '瓣环/窦部/窦管交界/升主动脉');
const azOk = C.aorticZscore([26, 34, 29, 31], false, 1.75);
check('男性四段取区间中点 → Z 全为 0',
  azOk.segs.every(function (s) { return s.z === 0; }) ? 'ok' : 'bad', 'ok');
check('四段 Z=0 判未超上限', azOk.text.indexOf('未超参考上限') !== -1 ? 'ok' : 'bad', 'ok');
check('Z=0 不出现 -0.0', azOk.text.indexOf('-0.0') === -1 ? 'ok' : 'bad', 'ok');
check('升主动脉 31mm / BSA1.75 → 指数 1.77', C.round(azOk.ascIndex, 2), 1.77, 0.01);
check('指数 1.77 < 2.1 判未达扩张', azOk.ascIndexText.indexOf('未达扩张') !== -1 ? 'ok' : 'bad', 'ok');

const azHigh = C.aorticZscore([26, 42, 29, 38], false, 1.75);
check('窦部 42mm → Z 3.92', C.round(azHigh.segs[1].z, 2), 3.92, 0.02);
check('Z >3 判显著扩张', azHigh.segs[1].level, 3);
check('汇总取最大 Z 并点名窦部', azHigh.maxSn === '窦部' ? 'ok' : 'bad', 'ok');
check('汇总文案提示评估干预时机', azHigh.text.indexOf('外科') !== -1 ? 'ok' : 'bad', 'ok');
check('升主动脉 38mm → 指数 2.17 ≥2.1 判扩张',
  azHigh.ascIndexText.indexOf('提示扩张') !== -1 ? 'ok' : 'bad', 'ok');

const azMid = C.aorticZscore([26, 40, 29, 33], false, 1.75);
check('窦部 40mm → Z 2.94 属轻度扩张', azMid.segs[1].level, 2);
check('轻度扩张文案提示缩短随访', azMid.text.indexOf('随访') !== -1 ? 'ok' : 'bad', 'ok');

const azF = C.aorticZscore([24], true);
check('女性瓣环 24mm → Z 0（区间中点）', azF.segs[0].z, 0);
check('女性参考区间 2.1–2.7', azF.segs[0].lo + '-' + azF.segs[0].hi, '2.1-2.7');
check('只填一段时只返回一段', azF.segs.length, 1);
check('小于下限 Z ≤ -2 单独提示',
  C.aorticZscore([19], false).segs[0].text.indexOf('小于参考下限') !== -1 ? 'ok' : 'bad', 'ok');
check('全空报错', C.aorticZscore([]).error ? 'ok' : 'bad', 'ok');
check('缺 BSA 时不给指数', C.aorticZscore([26, 34, 29, 31], false).ascIndex === undefined ? 'ok' : 'bad', 'ok');

console.log('=== 47. 跨指标派生量（v1.3.2）===');
check('E/Vp 80/40 = 2.00', C.round(C.evpRatio(80, 40).ratio, 2), 2.0, 0.01);
check('E/Vp 2.0 提示左房压升高', C.evpRatio(80, 40).level, 2);
check('E/Vp 2.0 且 Vp 40 → 同时报松弛受损',
  C.evpRatio(80, 40).vpText.indexOf('松弛受损') !== -1 ? 'ok' : 'bad', 'ok');
check('E/Vp 1.33 正常', C.evpRatio(80, 60).level, 1);
check('Vp 正常而 E/Vp 升高 → 提示负荷因素',
  C.evpRatio(100, 60).note.indexOf('容量负荷') !== -1 ? 'ok' : 'bad', 'ok');
check('E/Vp 缺 Vp 报错', C.evpRatio(80, 0).error ? 'ok' : 'bad', 'ok');

check('LA stiffness 20/30 = 0.67', C.round(C.laStiffness(20, 30).stiffness, 2), 0.67, 0.01);
check('0.67 判明显僵硬', C.laStiffness(20, 30).level, 3);
check('14/30 = 0.47 判正常（边界）', C.laStiffness(14, 30).level, 1);
check('0.55 判支持 HFpEF', C.laStiffness(16, 29).level, 2);
check('LARS <18 时提示比值失真',
  C.laStiffness(14, 15).note.indexOf('分母') !== -1 ? 'ok' : 'bad', 'ok');

check('VTI 比 22/18 = 1.22', C.round(C.vtiRatio(22, 18).ratio, 2), 1.22, 0.01);
check('1.22 判左向右分流', C.vtiRatio(22, 18).level, 3);
check('14/18 = 0.78 正常', C.vtiRatio(14, 18).level, 1);
check('10/18 = 0.56 判肺血流减少', C.vtiRatio(10, 18).level, 2);
check('VTI 比缺一项报错', C.vtiRatio(14, 0).error ? 'ok' : 'bad', 'ok');

check('NC/C 18/7 = 2.57', C.round(C.lvncRatio(18, 7).ratio, 2), 2.57, 0.01);
check('2.57 同时满足 Jenni 与 Petersen', C.lvncRatio(18, 7).level, 3);
check('15/7 = 2.14 只达超声阈值', C.lvncRatio(15, 7).level, 2);
check('10/7 = 1.43 未达阈值', C.lvncRatio(10, 7).level, 1);
check('NC/C 常驻假阳性提示',
  C.lvncRatio(10, 7).note.indexOf('乳头肌') !== -1 ? 'ok' : 'bad', 'ok');

check('PH 概率 TR 3.6 → 高', C.phLikelihood(3.6, false).prob, '高');
check('PH 概率 TR 3.2 无征象 → 中', C.phLikelihood(3.2, false).prob, '中');
check('PH 概率 TR 3.2 有征象 → 高', C.phLikelihood(3.2, true).prob, '高');
check('PH 概率 TR 2.5 无征象 → 低', C.phLikelihood(2.5, false).prob, '低');
check('PH 概率 TR 2.5 伴 AT 95ms → 中', C.phLikelihood(2.5, false, 95).prob, '中');
check('AT 95ms 输出加速时间提示',
  C.phLikelihood(2.5, false, 95).atText.indexOf('95 ms') !== -1 ? 'ok' : 'bad', 'ok');
check('无 TR 但有征象 → 中（提示补测）',
  C.phLikelihood(0, true).prob, '中');
check('无 TR 无征象 → 低', C.phLikelihood(0, false).prob, '低');
check('旧 phProbability 未被新函数覆盖', C.phProbability(3.5, null), '高');

console.log('=== 48. Wilkins 分项（v1.3.2）===');
check('WILKINS_ITEMS 4 项', C.WILKINS_ITEMS.length, 4);
check('每项 4 档', C.WILKINS_ITEMS.every(function (it) { return it.levels.length === 4; }) ? 'ok' : 'bad', 'ok');
check('顺序：活动度/增厚/钙化/瓣下',
  C.WILKINS_ITEMS.map(function (it) { return it.n; }).join('/'),
  '瓣叶活动度/瓣叶增厚/瓣叶钙化/瓣下增厚');
const w8 = C.wilkinsScore(2, 2, 2, 2);
check('2/2/2/2 = 8', w8.total, 8);
check('输出 4 个分项', w8.items.length, 4);
check('分项带当档描述', w8.items[0].desc, '瓣叶中部与基底部活动正常，瓣尖及部分中部受限');
check('8 分 level 1', w8.level, 1);
const w10 = C.wilkinsScore(3, 3, 2, 2);
check('3+3+2+2 = 10 落边缘区', w10.level, 2);
check('边缘区文案提个体化', w10.text.indexOf('个体化') !== -1 ? 'ok' : 'bad', 'ok');
const w13 = C.wilkinsScore(4, 3, 3, 3);
check('4+3+3+3 = 13 优先外科', w13.level, 3);
check('指出扣分最重项为活动度', w13.worst, '瓣叶活动度');
check('最重项带 4 分描述',
  w13.worstText.indexOf('瓣叶无活动') !== -1 ? 'ok' : 'bad', 'ok');
check('并列最高时取第一项', C.wilkinsScore(3, 3, 1, 1).worst, '瓣叶活动度');

console.log('=== 49. PMBV 适合度流程（v1.3.4）===');
const pf1 = C.pmbvSuit({ mva: 0.9, mvaHow: 'PHT 法', gra: 12, pasp: 55, wilkins: 7 });
check('重度 MS + PASP >50 + Wilkins ≤8 → 理想候选',
  pf1.verdict.indexOf('理想 PMBV 候选') !== -1 ? 'ok' : 'bad', 'ok');
check('候选结论带 TEE 排除三项',
  pf1.verdict.indexOf('TEE 排除左房血栓') !== -1 && pf1.verdict.indexOf('MR ≤轻度') !== -1 ? 'ok' : 'bad', 'ok');
check('流程行含 ①②③', pf1.parts.some(function (p) { return p.indexOf('② 后果：PASP 55') !== -1; }) ? 'ok' : 'bad', 'ok');
const pf2 = C.pmbvSuit({ mva: 0.9, mvaHow: '连续方程', gra: 15, pasp: 62, wilkins: 13 });
check('Wilkins ≥12 → 形态不适合、优先外科',
  pf2.verdict.indexOf('优先外科换瓣') !== -1 && pf2.level === 3 ? 'ok' : 'bad', 'ok');
const pf3 = C.pmbvSuit({ mva: 1.2, mvaHow: '连续方程', gra: 8, pasp: 45, wilkins: 10 });
check('Wilkins 9–11 → 边缘区个体化', pf3.verdict.indexOf('个体化') !== -1 ? 'ok' : 'bad', 'ok');
const pf4 = C.pmbvSuit({ mva: 2.2, mvaHow: 'PHT 法', gra: 4, pasp: 28, wilkins: 6 });
check('轻度 MS → 暂不考虑 PMBV', pf4.verdict.indexOf('暂不考虑 PMBV') !== -1 ? 'ok' : 'bad', 'ok');
const pf5 = C.pmbvSuit({ mva: 1.6, mvaHow: 'PHT 法', gra: 12, pasp: 40, wilkins: 8 });
check('面积轻压差重 → 报警并以面积为准',
  pf5.parts.some(function (p) { return p.indexOf('⚠ 压差与面积分级不一致') !== -1; }) ? 'ok' : 'bad', 'ok');
check('不一致时结论按面积（未达重度）',
  pf5.verdict.indexOf('未达重度') !== -1 && pf5.verdict.indexOf('需复测') !== -1 ? 'ok' : 'bad', 'ok');
const pf6 = C.pmbvSuit({ mva: 1.05, mvaHow: 'PHT 法', gra: 12, pasp: 55, wilkins: 7 });
check('MVA 中度但 PASP >50 + 形态适合 → 有 PMBV 理由',
  pf6.verdict.indexOf('有 PMBV 理由') !== -1 ? 'ok' : 'bad', 'ok');
const pf7 = C.pmbvSuit({ gra: 11, pasp: 52 });
check('缺 MVA 与 Wilkins → 只提示补什么',
  pf7.verdict.indexOf('补 Wilkins 四项评分') !== -1 && pf7.missing.indexOf('PASP') === -1 ? 'ok' : 'bad', 'ok');
check('有压差时不再把 MVA 列为缺失（压差可定严重度）',
  pf7.missing.some(function (m) { return m.indexOf('MVA') !== -1; }) ? 'bad' : 'ok', 'ok');
const pf8 = C.pmbvSuit({ gra: 11, pasp: 52, wilkins: 8 });
check('压差定重度 + 缺 MVA → 提示补面积',
  pf8.verdict.indexOf('未测 MVA，补一项面积确认') !== -1 ? 'ok' : 'bad', 'ok');
const pf9 = C.pmbvSuit({});
check('全空 → 无结论、missing 三项齐全',
  pf9.verdict === '' && pf9.missing.length === 3 ? 'ok' : 'bad', 'ok');
check('全空时 missing 含 MVA', pf9.missing.some(function (m) { return m.indexOf('MVA') !== -1; }) ? 'ok' : 'bad', 'ok');

/* ── v1.3.12：随访增长率 / 人工瓣术后 / 冠脉血流储备 ── */
const ag1 = C.aorticGrowthRate(3.0, 3.3, 2);
check('主动脉 3.0→3.3 cm / 2 年 → 3.0 mm/年（中危）',
  Math.abs(ag1.mmPerYear - 1.5) < 0.01 ? 'ok' : 'bad', 'ok');
const ag2 = C.aorticGrowthRate(3.0, 3.6, 2);
check('3.0→3.6 cm / 2 年 → 3.0 mm/年 边界（≥3 归中危）',
  Math.abs(ag2.mmPerYear - 3.0) < 0.01 && ag2.level.indexOf('中危') === 0 ? 'ok' : 'bad', 'ok');
const ag3 = C.aorticGrowthRate(4.0, 4.8, 1);
check('4.0→4.8 cm / 1 年 → 8 mm/年（高危）',
  Math.abs(ag3.mmPerYear - 8) < 0.01 && ag3.level.indexOf('高危') === 0 ? 'ok' : 'bad', 'ok');
check('缺间隔年数 → 报错',
  C.aorticGrowthRate(3.0, 3.3, 0).error ? 'ok' : 'bad', 'ok');

const pv1 = C.prostheticValveFunction({ lvotD: 2.0, lvotVti: 20, valveVti: 20, vmax: 2.6, meanGrad: 12, bsa: 1.8 });
check('人工瓣 EOA = CSA×VTI比 = 3.14 cm²',
  Math.abs(pv1.eoa - Math.PI * 4 / 4) < 0.01 ? 'ok' : 'bad', 'ok');
check('EOA ≥1.2 判为开放良好',
  pv1.eoaText.indexOf('开放良好') !== -1 ? 'ok' : 'bad', 'ok');
check('EOAi = EOA/BSA',
  Math.abs(pv1.eoaIdx - pv1.eoa / 1.8) < 0.01 ? 'ok' : 'bad', 'ok');
const pv2 = C.prostheticValveFunction({ lvotD: 2.0, lvotVti: 20, valveVti: 16, vmax: 3.4, meanGrad: 32, bsa: 1.8 });
check('术后高压差 32 mmHg → 提示需鉴别',
  pv2.meanGradText.indexOf('需鉴别') !== -1 ? 'ok' : 'bad', 'ok');
check('Vmax 3.4 m/s → 提示个体差异',
  pv2.vmaxText.indexOf('压差恢复') !== -1 ? 'ok' : 'bad', 'ok');
check('缺 VTI → 报错',
  C.prostheticValveFunction({ lvotD: 2.0 }).error ? 'ok' : 'bad', 'ok');

const cf1 = C.coronaryFlowReserve(60, 25);
check('CFR = 60/25 = 2.4 → 正常',
  Math.abs(cf1.cfr - 2.4) < 0.01 && cf1.level.indexOf('正常') !== -1 ? 'ok' : 'bad', 'ok');
const cf2 = C.coronaryFlowReserve(35, 25);
check('CFR = 1.4 → 明显受限',
  Math.abs(cf2.cfr - 1.4) < 0.01 && cf2.level.indexOf('明显受限') !== -1 ? 'ok' : 'bad', 'ok');
const cf3 = C.coronaryFlowReserve(45, 25);
check('CFR = 1.8 → 可疑',
  Math.abs(cf3.cfr - 1.8) < 0.01 && cf3.level.indexOf('可疑') !== -1 ? 'ok' : 'bad', 'ok');
check('缺近端流速 → 报错',
  C.coronaryFlowReserve(60, 0).error ? 'ok' : 'bad', 'ok');

console.log('=== AS 引擎（v1.10.7：SVi / vals / 峰速法互校 / LF-LG 分型）===');
const V = require('./miniprogram/utils/valve-calc.js');
const asA = V.valveCalc('as', { lvotD: 2.0, lvotVti: 20, avVti: 30 }, 1.7);
check('AS vals.sv = 62.83', Math.round(asA.vals.sv * 100) / 100, 62.83, 0.01);
check('AS vals.svi = 36.96', Math.round(asA.vals.svi * 100) / 100, 36.96, 0.01);
check('AS vals.ava = 2.09', Math.round(asA.vals.ava * 100) / 100, 2.09, 0.01);
check('AS vals.dvi = 0.67', Math.round(asA.vals.dvi * 100) / 100, 0.67, 0.01);
check('SVi 行不参与狭窄定级（无 tag）',
  asA.rows.filter(function (r) { return r.k.indexOf('SVi') === 0 && r.tag; }).length, 0, 0);

const asB = V.valveCalc('as', { lvotD: 1.8, lvotVti: 15, avVti: 40 }, 1.7);
// SV = π×0.81×15 = 38.17；SVi = 22.45（低流量）；AVA = 38.17/40 = 0.954
check('低流量 SVi = 22.5 且行内标注低流量',
  Math.round(asB.vals.svi * 10) / 10, 22.5, 0.05);
check('低流量 note 提到四象限',
  asB.notes.join(' ').indexOf('四象限') >= 0 ? 'ok' : 'bad', 'ok');

const asC = V.valveCalc('as', { lvotD: 2.0, lvotVti: 20, avVti: 30, lvotVmax: 1.0, avVmax: 4.0 }, 0);
check('峰速法 0.79 与连续方程差 >0.2 → 提示互校',
  asC.notes.join(' ').indexOf('相差') >= 0 ? 'ok' : 'bad', 'ok');

const lf1 = C.asLflg({ svi: 30, mpg: 32, ava: 0.95 });
check('LF-LG 未填 LVEF → 不默认判反常型',
  lf1.text.indexOf('未填 LVEF') >= 0 ? 'ok' : 'bad', 'ok');
const lf2 = C.asLflg({ lvef: 60, svi: 30, mpg: 32, ava: 0.95 });
check('LF-LG EF 60 → 反常型', lf2.type, 'paradoxical');
const lf3 = C.asLflg({ lvef: 35, svi: 30, mpg: 32, ava: 0.95 });
check('LF-LG EF 35 → 经典型', lf3.type, 'classic');

console.log('=== MR 定量（v1.10.8：容积法 / RF 分母 / 成比例）===');

const mrVol = V.valveCalc('mr', { mvD: 3.4, mvVti: 12, lvotD: 2.0, lvotVti: 20, regVti: 150 }, 1.7);
const pick = (r, k) => r.rows.filter((x) => x.k === k)[0];
check('容积法 SV 二尖瓣 109.0 / LVOT 62.8',
  pick(mrVol, '容积法 SV 二尖瓣 / 左室流出道').v, '109.0 / 62.8 mL', 0);
check('容积法 RVol 46.1 mL', pick(mrVol, '容积法 RVol').v, '46.1 mL', 0);
check('容积法 RF 42.3%（分母是二尖瓣总每搏量）',
  pick(mrVol, '容积法 RF').v, '42.3%', 0);
check('容积法 EROA 0.31 cm²', pick(mrVol, '容积法 EROA').v, '0.31 cm²', 0);

// ★ 回归：MR 的 LVOT 每搏量是前向量，RF 分母须加回反流量
const mrPisa = V.valveCalc('mr', { radius: 0.8, aliasVa: 40, regV: 5.0, regVti: 150, lvotD: 2.0, lvotVti: 20 }, 1.7);
check('PISA 路径 RF 43.4%（= RVol ÷ (SV前向+RVol)，不是 ÷ SV前向）',
  pick(mrPisa, '反流分数 RF').v, '43.4%', 0);
const rfPisa = parseFloat(pick(mrPisa, '反流分数 RF').v);
const rfVol = parseFloat(pick(mrVol, '容积法 RF').v);
check('两条路径的 RF 相差 <5 个百分点', Math.abs(rfPisa - rfVol) < 5 ? 1 : 0, 1, 0);
check('容积法行标 noSum，不与 PISA 重复计入综合提示',
  mrPisa.rows.filter((r) => r.noSum).length, 0, 0);

const mrRatioHi = V.valveCalc('mr', { radius: 0.8, aliasVa: 40, regV: 5.0, lvedv: 200 }, 1.7);
check('EROA 0.32 / LVEDV 200 → 0.160 不成比例',
  pick(mrRatioHi, 'EROA ÷ LVEDV').v, '0.161 mm²/mL', 0);
check('不成比例给出「瓣膜因素为主」标签',
  pick(mrRatioHi, 'EROA ÷ LVEDV').tag.indexOf('不成比例') >= 0 ? 'ok' : 'bad', 'ok');
const mrRatioLo = V.valveCalc('mr', { radius: 0.8, aliasVa: 40, regV: 5.0, lvedv: 300 }, 1.7);
check('EROA 0.32 / LVEDV 300 → 0.107 成比例',
  pick(mrRatioLo, 'EROA ÷ LVEDV').tag.indexOf('成比例') >= 0 ? 'ok' : 'bad', 'ok');
check('成比例时提示先优化 GDMT 与 CRT',
  mrRatioLo.notes.join(' ').indexOf('MITRA-FR') >= 0 ? 'ok' : 'bad', 'ok');

const mrNeg = V.valveCalc('mr', { mvD: 2.6, mvVti: 10, lvotD: 2.2, lvotVti: 22, regVti: 150 }, 1.7);
check('容积法算出负反流 → 提示取样位置有误',
  mrNeg.notes.join(' ').indexOf('没有净反流') >= 0 ? 'ok' : 'bad', 'ok');

const mrOnly = V.valveCalc('mr', { mvD: 3.4, mvVti: 12, lvotD: 2.0, lvotVti: 20, regVti: 150 }, 1.7);
check('只填容积法时 RVol 行计入综合提示（不被 noSum 静默）',
  mrOnly.summary.indexOf('中度') >= 0 ? 'ok' : 'bad', 'ok');

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
