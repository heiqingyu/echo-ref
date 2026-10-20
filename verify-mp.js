/**
 * 小程序版引擎（CommonJS）验证脚本
 * 确保与已验证的 ES Module 版 echo-core.js 结果一致
 * 运行： node verify-mp.js
 */
const C = require('./miniprogram/utils/echo-core.js');

let pass = 0, fail = 0;
function check(label, actual, expected, tol = 0.05) {
  const ok = Math.abs(actual - expected) <= tol;
  ok ? pass++ : fail++;
  console.log(`${ok ? '  OK  ' : ' FAIL '} ${label}: ${actual} (期望 ${expected})`);
}

console.log('\n=== 1. BSA ===');
check('Du Bois 170/65', C.round(C.bsaDuBois(170, 65), 3), 1.754, 0.005);
check('Du Bois 100/16', C.round(C.bsaDuBois(100, 16), 3), 0.658, 0.005);
check('Mosteller 170/65', C.round(C.bsaMosteller(170, 65), 3), 1.752, 0.005);

console.log('\n=== 2. Teichholz ===');
check('D=5.0cm', C.round(C.teichholzVolume(5.0), 2), 118.24, 0.05);
check('D=4.0cm', C.round(C.teichholzVolume(4.0), 2), 70.0, 0.05);
check('D=3.0cm', C.round(C.teichholzVolume(3.0), 2), 35.0, 0.05);

console.log('\n=== 3. 正常男性 EF ===');
const n = C.computeLVFunction(50, 32);
console.log(`  EDV=${n.EDV} ESV=${n.ESV} SV=${n.SV} EF=${n.EF}% FS=${n.FS}%`);
check('EDV', n.EDV, 118.2, 0.1);
check('ESV', n.ESV, 41.0, 0.1);
check('EF 在 52-76%', n.EF >= 52 && n.EF <= 76 ? 1 : 0, 1, 0);

console.log('\n=== 4. 扩张型心肌病 ===');
const d = C.computeLVFunction(72, 64);
console.log(`  EDV=${d.EDV} ESV=${d.ESV} EF=${d.EF}%`);
check('EF < 30%', d.EF < 30 ? 1 : 0, 1, 0);

console.log('\n=== 5. 左室质量 ===');
const l = C.computeLVM(50, 9, 9, 1.75);
console.log(`  LVM=${l.LVM}g  LVM/BSA=${l['LVM/BSA']}g/m²`);
check('LVM', l.LVM, 158.2, 0.2);

console.log('\n=== 6. RWT ===');
check('RWT 50/9', C.computeRWT(50, 9), 0.36, 0.005);

console.log('\n=== 7. EF 分级 ===');
check('EF 60 -> 正常', C.gradeEF(60).text === '正常' ? 1 : 0, 1, 0);
check('EF 50 -> 轻度', C.gradeEF(50).text === '轻度减低' ? 1 : 0, 1, 0);
check('EF 38 -> 中度', C.gradeEF(38).text === '中度减低' ? 1 : 0, 1, 0);
check('EF 25 -> 重度', C.gradeEF(25).text === '重度减低' ? 1 : 0, 1, 0);

console.log('\n=== 8. CN 参考值列表（男性，含实测）===');
const rows = C.buildReferenceList('male', {
  LVEDD: 52, LVESD: 34, LVEF: 62, 'LA-ap': 42, IVSd: 12,
}, 'CN');
console.log(`  共 ${rows.length} 项`);
for (const r of rows.slice(0, 8)) {
  const u = r.unit ? r.unit.padEnd(5, ' ') : '     ';
  console.log(`  ${r.name.padEnd(14, '　')} ${r.value.padStart(7)}${u} 参考 ${r.range.padEnd(13)} [${r.statusText}]`);
}
check('列表项数 = 37（2016 指南扩充后）', rows.length, 37, 0);
check('LA-ap 42 偏高', rows.find(r => r.key === 'LA-ap').status === 'high' ? 1 : 0, 1, 0);
check('IVSd 12 偏高', rows.find(r => r.key === 'IVSd').status === 'high' ? 1 : 0, 1, 0);
check('LVEF 62 正常', rows.find(r => r.key === 'LVEF').status === 'normal' ? 1 : 0, 1, 0);
check('LVEDD 52 正常', rows.find(r => r.key === 'LVEDD').status === 'normal' ? 1 : 0, 1, 0);

console.log('\n=== 9. 单位换算（关键修复）===');
// ASE 的 LVEDD 原生单位是 cm，界面单位是 mm，必须 ×10
check('cm->mm 换算 5.9', C.convertUnit(5.9, 'cm', 'mm'), 59, 0.01);
check('cm->mm 换算 4.2', C.convertUnit(4.2, 'cm', 'mm'), 42, 0.01);
check('mL 不换算', C.convertUnit(155, 'mL', 'mL'), 155, 0.01);
check('比值单位不换算', C.convertUnit(3.1, 'cm/m²', 'cm/m²'), 3.1, 0.01);
const convP = C.convertPartition(C.REFERENCE.ASE.male.LVEDD, 'cm', 'mm');
check('分区换算 normal 区间', convP.normal[0] === 42 && convP.normal[1] === 59 ? 1 : 0, 1, 0);
check('分区换算 severe 下界 69', convP.severe[0], 69, 0.01);

console.log('\n=== 10. ASE 实测值判定（修复前会误判）===');
// 男性 LVEDD = 50mm，ASE 正常区间换算后是 42–59mm → 应判正常
const aseMale = C.buildReferenceList('male', { LVEDD: 50 }, 'ASE');
const aseMaleRow = aseMale.find(r => r.key === 'LVEDD');
console.log(`  ASE 男性 LVEDD: 实测 50mm, 参考 ${aseMaleRow.range} ${aseMaleRow.unit} → ${aseMaleRow.statusText}`);
check('LVEDD 50mm 应判正常（修复前误判重度）', aseMaleRow.status === 'normal' ? 1 : 0, 1, 0);
check('参考区间显示为 42.0–59.0', aseMaleRow.range === '42.0–59.0' ? 1 : 0, 1, 0);
// 女性 LVEDD = 48mm，正常 39–53mm → 正常
const aseFemale = C.buildReferenceList('female', { LVEDD: 48 }, 'ASE').find(r => r.key === 'LVEDD');
check('女性 LVEDD 48mm 应判正常', aseFemale.status === 'normal' ? 1 : 0, 1, 0);
check('女性参考区间 39.0–53.0', aseFemale.range === '39.0–53.0' ? 1 : 0, 1, 0);
// 男性 LVEDD 65mm → 应判重度（>=69mm 才是重度；65 落在 64-68 = 中度）
const aseM65 = C.buildReferenceList('male', { LVEDD: 65 }, 'ASE').find(r => r.key === 'LVEDD');
check('男性 LVEDD 65mm 判中度', aseM65.status === 'moderate' ? 1 : 0, 1, 0);
const aseM70 = C.buildReferenceList('male', { LVEDD: 70 }, 'ASE').find(r => r.key === 'LVEDD');
check('男性 LVEDD 70mm 判重度', aseM70.status === 'severe' ? 1 : 0, 1, 0);

console.log('\n=== 11. ASE 参数扩充 ===');
check('ASE 字段数 ≥ 20', C.ASE_FIELDS.length >= 20 ? 1 : 0, 1, 0);
console.log('  ASE 参数清单: ' + C.ASE_FIELDS.join(', '));
const aseRows = C.buildReferenceList('male', {}, 'ASE');
check('ASE 列表渲染项数 = ' + C.ASE_FIELDS.length, aseRows.length, C.ASE_FIELDS.length, 0);
// 检查每个 ASE 字段都能正确渲染出参考区间
const badRange = aseRows.filter(r => !r.range || r.range.indexOf('—') === 0);
check('所有 ASE 项都有参考区间', badRange.length === 0 ? 1 : 0, 1, 0);
if (badRange.length) console.log('  缺失: ' + badRange.map(r => r.key).join(', '));

console.log('\n=== 12. ASE 厚度类单位换算（IVSd cm→mm）===');
const ivsRow = C.buildReferenceList('male', { IVSd: 9 }, 'ASE').find(r => r.key === 'IVSd');
console.log(`  IVSd: 实测 9mm, 参考 ${ivsRow.range} ${ivsRow.unit} → ${ivsRow.statusText}`);
check('IVSd 正常区间应为 6.0–10.0mm', ivsRow.range === '6.0–10.0' ? 1 : 0, 1, 0);
check('IVSd 9mm 判正常', ivsRow.status === 'normal' ? 1 : 0, 1, 0);

console.log('\n=== 13. ASE 容积类单位不变（mL）===');
const volRow = C.buildReferenceList('male', { LVEDV: 120 }, 'ASE').find(r => r.key === 'LVEDV');
console.log(`  LVEDV: 实测 120mL, 参考 ${volRow.range} → ${volRow.statusText}`);
check('LVEDV 区间应保持 mL 原值', volRow.range === '67.0–155.0' ? 1 : 0, 1, 0);
check('LVEDV 120mL 判正常', volRow.status === 'normal' ? 1 : 0, 1, 0);

console.log('\n=== 14. ASE 实测值列表（分区判定）===');
// 全部传界面单位 mm / mL / %
const ar = C.buildReferenceList('male', { LVEDD: 62, EF: 25, LVEDV: 190 }, 'ASE');
for (const r of ar.slice(0, 7)) {
  console.log(`  ${r.name.padEnd(16, '　')} ${r.value.padStart(7)}${(r.unit||'').padEnd(6,' ')} 参考 ${r.range.padEnd(14)} [${r.statusText}]`);
}
const ar62 = ar.find(r => r.key === 'LVEDD');
check('LVEDD 62mm → 轻度', ar62.status === 'mild' ? 1 : 0, 1, 0);
const arEf = ar.find(r => r.key === 'EF');
check('EF 25 → 重度', arEf.status === 'severe' ? 1 : 0, 1, 0);
const arVedv = ar.find(r => r.key === 'LVEDV');
check('LVEDV 190mL → 中度', arVedv.status === 'moderate' ? 1 : 0, 1, 0);
// 越界保护：极小值
const arTiny = C.buildReferenceList('male', { LVEDD: 5 }, 'ASE').find(r => r.key === 'LVEDD');
check('LVEDD 5mm（明显过小）不应崩溃', arTiny && arTiny.status ? 1 : 0, 1, 0);

console.log('\n=== 15. BSA 联动：指数参数反算绝对范围 ===');
// LVEDD/BSA 指数 2.2–3.1 cm/m²，按 BSA 反算内径
const bsaCases = [
  { bsa: 1.50, lo: 33, hi: 47 },
  { bsa: 1.75, lo: 39, hi: 54 },
  { bsa: 2.00, lo: 44, hi: 62 },
];
for (const c of bsaCases) {
  const row = C.buildReferenceList('male', {}, 'ASE', c.bsa).find(r => r.key === 'LVEDD/BSA');
  const expect = c.lo + '–' + c.hi;
  console.log(`  BSA=${c.bsa} → 指数 ${row.range} ${row.unit}，折算 ${row.derivedText} ${row.derivedUnit}`);
  check(`BSA=${c.bsa} 折算内径 = ${expect} mm`, row.hasDerived && row.derivedText === expect ? 1 : 0, 1, 0);
}
// 手算复核：2.2 × 1.75 × 10 = 38.5 → 四舍五入 39
const chk = C.buildReferenceList('male', {}, 'ASE', 1.75).find(r => r.key === 'LVEDD/BSA');
check('手算复核 2.2×1.75×10 = 39', Math.round(2.2 * 1.75 * 10), 39, 0);
check('手算复核 3.1×1.75×10 = 54', Math.round(3.1 * 1.75 * 10), 54, 0);
check('折算单位是 mm', chk.derivedUnit === 'mm' ? 1 : 0, 1, 0);

console.log('\n=== 16. BSA 联动：5 个指数参数全覆盖 ===');
const idxRows = C.buildReferenceList('male', {}, 'ASE', 1.75).filter(r => r.hasDerived);
console.log('  联动参数: ' + idxRows.map(r => r.key).join(', '));
check('联动参数数 = 5', idxRows.length, 5, 0);
for (const k of ['LVEDD/BSA', 'LVEDV/BSA', 'LVESV/BSA', 'LVM/BSA', 'LAV/BSA']) {
  const r = idxRows.find(x => x.key === k);
  check(`${k} 已联动（${r ? r.derivedText + ' ' + r.derivedUnit : '缺失'}）`,
    r && r.derivedText && r.derivedText.indexOf('–') > 0 ? 1 : 0, 1, 0);
}
// 容积/质量类折算不应带 mm
const volIdx = idxRows.find(r => r.key === 'LVEDV/BSA');
check('LVEDV/BSA 折算单位为 mL', volIdx.derivedUnit === 'mL' ? 1 : 0, 1, 0);
const lvmIdx = idxRows.find(r => r.key === 'LVM/BSA');
check('LVM/BSA 折算单位为 g', lvmIdx.derivedUnit === 'g' ? 1 : 0, 1, 0);

console.log('\n=== 17. 非指数参数不应联动（回归保护）===');
const noIdx = ['LVEDD', 'IVSd', 'EF', 'FS', 'LVEDV', 'LVM', 'LA-ap', 'TAPSE', 'LVEDD/H'];
const wrongly = C.buildReferenceList('male', {}, 'ASE', 1.75)
  .filter(r => noIdx.indexOf(r.key) >= 0 && r.hasDerived);
check('绝对值/比值类参数均未联动', wrongly.length === 0 ? 1 : 0, 1, 0);
if (wrongly.length) console.log('  被错误联动: ' + wrongly.map(r => r.key).join(', '));

console.log('\n=== 18. BSA 缺失时不应崩溃 ===');
const noBsa = C.buildReferenceList('male', {}, 'ASE', 0);
check('BSA=0 时列表仍完整', noBsa.length === C.ASE_FIELDS.length ? 1 : 0, 1, 0);
check('BSA=0 时不产生折算值', noBsa.filter(r => r.hasDerived).length === 0 ? 1 : 0, 1, 0);
const undefBsa = C.buildReferenceList('male', {}, 'ASE', undefined);
check('BSA 未传时列表仍完整', undefBsa.length === C.ASE_FIELDS.length ? 1 : 0, 1, 0);

console.log('\n=== 19. CN 标准的指数参数联动（LVM/BSA）===');
const cnIdx = C.buildReferenceList('male', {}, 'CN', 1.75).filter(r => r.hasDerived);
console.log('  CN 联动参数: ' + (cnIdx.map(r => r.key).join(', ') || '(无)'));
const cnLvm = cnIdx.find(r => r.key === 'LVM/BSA');
if (cnLvm) {
  console.log(`  LVM/BSA 指数 ${cnLvm.range} ${cnLvm.unit} → 折算 ${cnLvm.derivedText} ${cnLvm.derivedUnit}`);
  // CN 男性 LVM/BSA 正常 44.3–108.5 g/m²，BSA=1.75 → 77.5–189.9 g
  check('CN LVM/BSA 折算正确', cnLvm.derivedText === '77.5–189.9' ? 1 : 0, 1, 0);
  check('CN LVM/BSA 折算单位 g', cnLvm.derivedUnit === 'g' ? 1 : 0, 1, 0);
} else {
  check('CN 标准的 LVM/BSA 未联动', 0, 1, 0);
}
const empty = C.buildReferenceList('female', {}, 'CN');
check('空值项数 = 37', empty.length, 37, 0);
check('全部为 none 状态', empty.every(r => r.status === 'none') ? 1 : 0, 1, 0);

console.log('\n=== 10b. BMI（WS/T 428-2013）===');
check('BMI 170/65', C.round(C.bmi(170, 65), 2), 22.49, 0.01);
console.log('  bmiClass(22.5) =', C.bmiClass(22.5).text, '| 17 =', C.bmiClass(17).text,
  '| 25 =', C.bmiClass(25).text, '| 30 =', C.bmiClass(30).text);
check('BMI 判级 22.5 正常', C.bmiClass(22.5).text === '正常' ? 1 : 0, 1, 0);
check('BMI 判级 17 偏瘦', C.bmiClass(17).text === '偏瘦' ? 1 : 0, 1, 0);
check('BMI 判级 25 超重', C.bmiClass(25).text === '超重' ? 1 : 0, 1, 0);
check('BMI 判级 30 肥胖', C.bmiClass(30).text === '肥胖' ? 1 : 0, 1, 0);

console.log('\n=== 10c. 2016 指南新增参数抽查 ===');
const newRows = C.buildReferenceList('male', { ROOT: 30, MPA: 28, RVAW: 7 }, 'CN');
console.log('  男 ROOT 30 →', newRows.find(r => r.key === 'ROOT').statusText, '(23.8–36.4)');
check('ROOT 30 正常(23.8-36.4)', newRows.find(r => r.key === 'ROOT').status === 'normal' ? 1 : 0, 1, 0);
check('MPA 28 偏高(15.2-26.2)', newRows.find(r => r.key === 'MPA').status === 'high' ? 1 : 0, 1, 0);
check('RVAW 7 偏高(2.1-6.1)', newRows.find(r => r.key === 'RVAW').status === 'high' ? 1 : 0, 1, 0);
const fRoot = C.buildReferenceList('female', { ROOT: 20 }, 'CN').find(r => r.key === 'ROOT');
check('女 ROOT 20 偏低(21.3-33.5)', fRoot.status === 'low' ? 1 : 0, 1, 0);
console.log('  女 ROOT 20 →', fRoot.statusText, '(21.3–33.5)');

console.log('\n=== 11. measurementsToRefDict 联动 ===');
const dict = C.measurementsToRefDict({
  lvedd: 50, lvesd: 32, ivsd: 9, lvpwd: 9, bsa: 1.75, height: 170,
});
console.log(`  LVEF=${dict.LVEF}%  LVM/BSA=${dict['LVM/BSA']}  RWT=${dict.LVRWT}  LVEDD/BSA=${dict['LVEDD/BSA']}  LVEDD/H=${dict['LVEDD/H']}`);
check('dict.LVEF', dict.LVEF, 65.4, 0.2);
check('dict.LVRWT', dict.LVRWT, 0.36, 0.01);
check('dict.LVEDD/H', dict['LVEDD/H'], 2.94, 0.02);

console.log('\n=== 12. 瓣膜页引擎（valve-calc.js）===');
const VE = require('./miniprogram/utils/valve-calc.js');
const VData = require('./miniprogram/utils/valve-data.js');

// 12.1 内容完整性
check('瓣膜分区数 = 5', VData.VALVE_SECTIONS.length, 5, 0);
check('分区顺序 as,ar,ms,mr,tr',
  VData.VALVE_SECTIONS.map(s => s.id).join(',') === 'as,ar,ms,mr,tr' ? 1 : 0, 1, 0);
check('每节 block 数 >= 5',
  Math.min(...VData.VALVE_SECTIONS.map(s => s.blocks.length)) >= 5 ? 1 : 0, 1, 0);
check('每节均含分级表',
  VData.VALVE_SECTIONS.every(s => s.blocks.some(b => b.type === 'table')) ? 1 : 0, 1, 0);
check('每节均含计算字段',
  VData.VALVE_SECTIONS.every(s => s.fields.length >= 6) ? 1 : 0, 1, 0);

// 12.2 AS：AVA = SV / AV VTI，DVI，AVAi
const vAs = VE.valveCalc('as', { lvotD: 2.0, lvotVti: 22, avVti: 60, avVmax: 4.2, mg: 45 }, 1.8);
const vAsAva = vAs.rows.find(r => r.k === 'AVA 连续方程');
console.log('  AS →', vAsAva.v, vAsAva.tag, '| SV', vAs.rows[0].v, '| 汇总', vAs.level);
check('AS SV = 69.1 mL', parseFloat(vAs.rows[0].v), 69.1, 0.1);
check('AS AVA = 1.15 cm²', parseFloat(vAsAva.v), 1.15, 0.01);
check('AS AVA 分级 中度', vAsAva.level === 'moderate' ? 1 : 0, 1, 0);
check('AS DVI 分级 中度',
  vAs.rows.find(r => r.k.indexOf('DVI') === 0).level === 'moderate' ? 1 : 0, 1, 0);
check('AS AVAi = 0.64 cm²/m²', parseFloat(vAs.rows.find(r => r.k === 'AVAi').v), 0.64, 0.01);
check('AS Vmax 4.2 重度',
  vAs.rows.find(r => r.k === 'AV Vmax').level === 'severe' ? 1 : 0, 1, 0);
check('AS 汇总 = severe', vAs.level === 'severe' ? 1 : 0, 1, 0);

// 12.3 AR：EROA / RVol / RF，阈值与 ASE 表一致
const vAr = VE.valveCalc('ar', { radius: 0.6, aliasVa: 40, regV: 5, regVti: 180, vc: 0.7, pht: 300, lvotD: 2.0, lvotVti: 22 }, 1.8);
const vArEroa = vAr.rows.find(r => r.k === 'EROA');
console.log('  AR →', vArEroa.v, vArEroa.tag, '| RVol', vAr.rows.find(r => r.k === 'RVol').v, '| RF', vAr.rows.find(r => r.k === '反流分数 RF').v);
check('AR EROA = 0.18 cm²', parseFloat(vArEroa.v), 0.18, 0.01);
check('AR EROA 分级 中度', vArEroa.level === 'moderate' ? 1 : 0, 1, 0);
check('AR VC 0.7 重度',
  vAr.rows.find(r => r.k === '缩流颈 VC').level === 'severe' ? 1 : 0, 1, 0);
check('AR PHT 300 中度',
  vAr.rows.find(r => r.k.indexOf('压力半降') === 0).level === 'moderate' ? 1 : 0, 1, 0);
check('AR RF = 47.1%', parseFloat(vAr.rows.find(r => r.k === '反流分数 RF').v), 47.1, 0.2);

// 12.4 MS：220 / PHT 与描记优先
const vMs = VE.valveCalc('ms', { mvaPlani: 1.3, pht: 220, mg: 6, pasp: 35 }, 1.8);
check('MS PHT 法 MVA = 1.00 cm²',
  parseFloat(vMs.rows.find(r => r.k.indexOf('MVA · PHT') === 0).v), 1.00, 0.01);
check('MS PHT 法 1.00 → 中度',
  vMs.rows.find(r => r.k.indexOf('MVA · PHT') === 0).level === 'moderate' ? 1 : 0, 1, 0);
check('MS 描记 1.3 → 中度',
  vMs.rows.find(r => r.k.indexOf('MVA 直接描记') === 0).level === 'moderate' ? 1 : 0, 1, 0);
check('MS PASP 35 → 中度',
  vMs.rows.find(r => r.k.indexOf('估测 PASP') === 0).level === 'moderate' ? 1 : 0, 1, 0);
check('MS 汇总 = moderate', vMs.level === 'moderate' ? 1 : 0, 1, 0);
check('MS MVA 1.6 不显著', VE.gMsMva(1.6).level === 'none' ? 1 : 0, 1, 0);
check('MS MVA 1.0 → 中度（表中重度为 <1.0）', VE.gMsMva(1.0).level === 'moderate' ? 1 : 0, 1, 0);
check('MS MVA 0.9 → 重度', VE.gMsMva(0.9).level === 'severe' ? 1 : 0, 1, 0);
check('MS MVA 1.5 → 中度', VE.gMsMva(1.5).level === 'moderate' ? 1 : 0, 1, 0);

// 12.5 MR：dP/dt 与继发 MR 提示
const vMr = VE.valveCalc('mr', { radius: 0.8, aliasVa: 40, regV: 5, regVti: 150, vc: 0.8, dt: 25, lvotD: 2.0, lvotVti: 22 }, 1.8);
console.log('  MR dP/dt =', vMr.rows.find(r => r.k.indexOf('dP/dt') === 0).v);
check('MR dP/dt = 1280 mmHg/s',
  parseFloat(vMr.rows.find(r => r.k.indexOf('dP/dt') === 0).v), 1280, 1);
check('MR dP/dt 正常区间',
  vMr.rows.find(r => r.k.indexOf('dP/dt') === 0).level === 'none' ? 1 : 0, 1, 0);
check('MR EROA 0.32 → 中度',
  vMr.rows.find(r => r.k === 'EROA').level === 'moderate' ? 1 : 0, 1, 0);
check('MR RVol 48 → 中度',
  vMr.rows.find(r => r.k === 'RVol').level === 'moderate' ? 1 : 0, 1, 0);
check('MR 出现继发 MR 提示',
  vMr.notes.some(t => t.indexOf('继发 MR') >= 0) ? 1 : 0, 1, 0);
check('MR dP/dt 700 → 减低', VE.gDpdt(700).level === 'severe' ? 1 : 0, 1, 0);

// 12.6 TR：RVol 重度界值 45 mL 与 PASP
const vTr = VE.valveCalc('tr', { radius: 0.7, aliasVa: 40, regV: 2.8, regVti: 140, vc: 0.75, trV: 3.5, ivc: 24, ivcCollapse: 'no' }, 1.8);
const vTrRvol = vTr.rows.find(r => r.k === 'RVol');
console.log('  TR RVol =', vTrRvol.v, vTrRvol.tag, '| PASP', vTr.rows.find(r => r.k.indexOf('PASP') === 0).v);
check('TR RVol 重度界值 45', VE.gTrRvol(45).level === 'severe' ? 1 : 0, 1, 0);
check('TR RVol 44.9 中度', VE.gTrRvol(44.9).level === 'moderate' ? 1 : 0, 1, 0);
check('TR RVol 45.5 → 重度', vTrRvol.level === 'severe' ? 1 : 0, 1, 0);
check('TR RAP = 15 mmHg（IVC 24 无塌陷）', VE.rapOf(24, 'no'), 15, 0);
check('TR RAP = 3 mmHg（IVC 18 有塌陷）', VE.rapOf(18, 'yes'), 3, 0);
check('TR RAP = 8 mmHg（未知）', VE.rapOf(18, ''), 8, 0);
check('TR PASP = 64 mmHg', parseFloat(vTr.rows.find(r => r.k.indexOf('PASP') === 0).v), 64, 0.1);
check('TR 汇总 = severe', vTr.level === 'severe' ? 1 : 0, 1, 0);

// 12.7 空输入不崩溃
['as', 'ar', 'ms', 'mr', 'tr'].forEach(id => {
  const r = VE.valveCalc(id, {}, 0);
  check(id + ' 空输入行数 0 且无异常', r.rows.length === 0 && r.summary === '等待输入' ? 1 : 0, 1, 0);
});
check('未知分区返回空', VE.valveCalc('xx', {}, 1.8).rows.length, 0, 0);

console.log('\n=== 20. 界面显示英文缩写（中文名（缩写））===');
const fsW = require('fs');
const pathW = require('path');
const wxmlIndex = fsW.readFileSync(
  pathW.join(__dirname, 'miniprogram', 'pages', 'index', 'index.wxml'), 'utf8');
const wxmlPeds = fsW.readFileSync(
  pathW.join(__dirname, 'miniprogram', 'pages', 'pediatric', 'pediatric.wxml'), 'utf8');
check('index.wxml 参考值行 2 处带缩写',
  (wxmlIndex.match(/\{\{item\.name\}\}（\{\{item\.key\}\}）/g) || []).length, 2, 0);
check('pediatric.wxml Z 值行 2 处带缩写',
  (wxmlPeds.match(/\{\{row\.name\}\}（\{\{row\.key\}\}）/g) || []).length, 2, 0);
check('pediatric.wxml 输入标签保持原样（不加缩写）',
  (wxmlPeds.match(/\{\{inputs\[index\]\.name\}\} \/ /g) || []).length, 1, 0);
check('pediatric.wxml 更多参数标签保持原样',
  (wxmlPeds.match(/\{\{moreInputs\[index\]\.name\}\} \/ /g) || []).length, 1, 0);
check('行数据均带 key（成人）', C.buildReferenceList('male', null, 'CN', 1.75)
  .every(r => !!r.key) ? 1 : 0, 1, 0);

console.log('\n=== 21. 合并后首页（EF 计算 + 参考值同页）===');
{
  // mock 小程序运行时，直接驱动 Page 逻辑（含 doCalc / rebuildRef）
  const gData = {
    profile: { sex: 'male', height: 170, weight: 65, bsa: 1.75 },
    measurements: null,
    standard: 'CN',
  };
  global.getApp = () => ({ globalData: gData });
  global.wx = { pageScrollTo() {}, switchTab() {} };
  let pgCfg = null;
  global.Page = (c) => { pgCfg = c; };

  require(pathW.join(__dirname, 'miniprogram', 'pages', 'index', 'index.js'));
  const pg = Object.assign({}, pgCfg);
  pg.data = JSON.parse(JSON.stringify(pgCfg.data));
  pg.setData = function (patch) { Object.assign(this.data, patch); };
  pg.onLoad();

  check('首屏默认值即出 EF 结果', pg.data.hasResult ? 1 : 0, 1, 0);
  check('EF = 65.4%', parseFloat(pg.data.r.EF), 65.4, 0.05);
  check('参考值列表切到实测值对照', pg.data.hasMeasurements ? 1 : 0, 1, 0);
  check('成人 CN 参考值 37 行', pg.data.rows.length, 37, 0);

  const appJsonRaw = fsW.readFileSync(
    pathW.join(__dirname, 'miniprogram', 'app.json'), 'utf8');
  const appJson = JSON.parse(appJsonRaw);
  check('独立 EF 页已移除', appJson.pages.indexOf('pages/ef/ef'), -1, 0);
  check('tabBar 共 4 个页签', appJson.tabBar.list.length, 4, 0);
  check('首页页签名 = EF·参考值', appJson.tabBar.list[0].text === 'EF·参考值' ? 1 : 0, 1, 0);

  // 非法输入：结果隐藏、实测对照退回正常参考范围
  pg.data.lvedd = '30'; pg.data.lvesd = '40';
  pg.doCalc();
  check('非法输入隐藏结果卡片', pg.data.hasResult ? 0 : 1, 1, 0);
  check('非法输入清空实测对照', pg.data.hasMeasurements ? 0 : 1, 1, 0);
  check('内径大小颠倒有提示',
    /舒张末内径应大于收缩末内径/.test(pg.data.efHint) ? 1 : 0, 1, 0);

  // 恢复有效输入
  pg.data.lvedd = '50'; pg.data.lvesd = '32';
  pg.doCalc();
  check('恢复有效输入后重新出结果', pg.data.hasResult ? 1 : 0, 1, 0);
  check('参考值列表恢复实测对照', pg.data.hasMeasurements ? 1 : 0, 1, 0);
}

console.log('\n=== 22. 延展阅读 + 参考文献（公式集页底部）===');
{
  const calcWxml = fsW.readFileSync(
    pathW.join(__dirname, 'miniprogram', 'pages', 'calculators', 'calculators.wxml'), 'utf8');
  const calcWxss = fsW.readFileSync(
    pathW.join(__dirname, 'miniprogram', 'pages', 'calculators', 'calculators.wxss'), 'utf8');
  const idxWxml = fsW.readFileSync(
    pathW.join(__dirname, 'miniprogram', 'pages', 'index', 'index.wxml'), 'utf8');

  // 延展阅读已从首页搬到公式集页
  check('首页不再含延展阅读卡片', idxWxml.indexOf('延展阅读') === -1 ? 1 : 0, 1, 0);
  check('公式集页含延展阅读卡片',
    calcWxml.indexOf('card__title">延展阅读') !== -1 ? 1 : 0, 1, 0);
  check('外链条目 2 条（bindtap onCopyLink）',
    (calcWxml.match(/bindtap="onCopyLink"/g) || []).length, 1, 0);
  const calcJsSrc = fsW.readFileSync(
    pathW.join(__dirname, 'miniprogram', 'pages', 'calculators', 'calculators.js'), 'utf8');
  check('条目 1 链接 zs-echo.com',
    calcJsSrc.indexOf('https://zs-echo.com') !== -1 ? 1 : 0, 1, 0);
  check('条目 2 链接 tte-quickref',
    calcJsSrc.indexOf('https://bdrwss.github.io/tte-quickref/dist/') !== -1 ? 1 : 0, 1, 0);
  check('calculators.wxss 含 .extlink 样式',
    calcWxss.indexOf('.extlink {') !== -1 ? 1 : 0, 1, 0);

  // 参考文献区
  check('公式集页含参考文献区',
    calcWxml.indexOf('card__title">参考文献') !== -1 ? 1 : 0, 1, 0);
  check('参考文献列表绑定 refs', calcWxml.indexOf('wx:for="{{refs}}"') !== -1 ? 1 : 0, 1, 0);
  const EXD = require(pathW.join(__dirname, 'miniprogram', 'utils', 'extra-data.js'));
  check('参考文献 33 条', EXD.REFS.length, 33, 0);
  const refIds = EXD.REFS.map(r => r.id).join(',');
  check('文献编号连续 R1–R33',
    refIds === 'R1,R2,R3,R4,R5,R6,R7,R8,R9,R10,R11,R12,R13,R14,R15,R16,R17,R18,R19,R20,R21,R22,R23,R24,R25,R26,R27,R28,R29,R30,R31,R32,R33' ? 1 : 0, 1, 0);
  const allHave = EXD.REFS.every(r => r.zh && r.where && r.use);
  check('每条文献含名称/出处/用途', allHave ? 1 : 0, 1, 0);

  // 目录顺序：延展阅读与参考文献都在分组之后
  const lastGroupEnd = calcWxml.lastIndexOf('fx-item__a');
  check('延展阅读位于所有条目之后',
    calcWxml.indexOf('card__title">延展阅读') > lastGroupEnd ? 1 : 0, 1, 0);
  check('参考文献位于延展阅读之前或紧邻上方',
    calcWxml.indexOf('card__title">参考文献') < calcWxml.indexOf('card__title">延展阅读') ? 1 : 0, 1, 0);

  // 版本号：三处一致
  const VD = require(pathW.join(__dirname, 'miniprogram', 'utils', 'version.js'));
  const vfRaw = fsW.readFileSync(pathW.join(__dirname, 'android-app', 'VERSION'), 'utf8');
  const vApk = vfRaw.split('\n')[0].trim();
  const vCode = vfRaw.split('\n')[1].trim();
  check('小程序版本 = APK versionName', VD.APP_VERSION === vApk ? 1 : 0, 1, 0);
  check('APK versionCode 已递增（>1）', parseInt(vCode, 10) > 1 ? 1 : 0, 1, 0);
  check('首页显示版本行', idxWxml.indexOf('appVersion') !== -1 ? 1 : 0, 1, 0);
  check('公式集页显示版本行', calcWxml.indexOf('appVersion') !== -1 ? 1 : 0, 1, 0);

  // tabBar 顺序：公式集在最后
  const appJson = JSON.parse(fsW.readFileSync(
    pathW.join(__dirname, 'miniprogram', 'app.json'), 'utf8'));
  const tabList = appJson.tabBar.list;
  check('tabBar 共 4 个', tabList.length, 4, 0);
  check('公式集排在最后一位',
    tabList[tabList.length - 1].pagePath === 'pages/calculators/calculators' ? 1 : 0, 1, 0);
  check('首页仍是 EF·参考值', tabList[0].text === 'EF·参考值' ? 1 : 0, 1, 0);
}

console.log('\n=== 23. 公式集（目录 + 公式详情页 + 评估类内容）===');
{
  let navTo = null, navBarTitle = null, clip = null;
  global.wx = {
    navigateTo(o) { navTo = o.url; },
    setNavigationBarTitle(o) { navBarTitle = o.title; },
    setClipboardData(o) { clip = o.data; if (o.success) o.success(); },
    showToast() {},
  };
  const gData23 = {
    profile: { sex: 'male', height: 170, weight: 65, bsa: 1.75 },
    measurements: null,
    standard: 'CN',
    calcCache: {},
  };
  global.getApp = () => ({ globalData: gData23 });
  let pgA = null, pgF = null;
  global.Page = (c) => { if (!pgA) pgA = c; else pgF = c; };
  require(pathW.join(__dirname, 'miniprogram', 'pages', 'calculators', 'calculators.js'));
  require(pathW.join(__dirname, 'miniprogram', 'pages', 'formula', 'formula.js'));

  [pgA, pgF].forEach(function (pg) {
    pg.setData = function (patch) {
      const self = this;
      Object.keys(patch).forEach(function (k) {
        const m = k.match(/^(\w+)\[(\d+)\]\.?(.*)$/);
        if (m) {
          const arr = self.data[m[1]] || (self.data[m[1]] = []);
          if (m[3]) arr[+m[2]][m[3]] = patch[k];
          else arr[+m[2]] = patch[k];
        } else self.data[k] = patch[k];
      });
    };
  });

  // —— 目录页 ——
  const dirs = pgA.data.sections;
  check('公式集分 11 个大组', dirs.length, 11, 0);
  check('组标题顺序',
    dirs.map(d => d.title).join('|') ===
      '血流动力学与心功能|瓣膜评估|器械支持|心腔与应变|心肌病变|大血管与急症|负荷与功能试验|介入 TEE 评估|切面学习（视频）|切面指南|TEE 模拟器' ? 1 : 0, 1, 0);
  const nItems = dirs.reduce((n, s) => n + s.items.length, 0);
  check('目录共 53 条（11 血流动力学 + 9 瓣膜 + 21 评估 + 12 外链）', nItems, 53, 0);
  check('切面学习 5 条', dirs[8].items.length, 5, 0);
  check('切面指南 4 条', dirs[9].items.length, 4, 0);
  check('TEE 模拟器 3 条', dirs[10].items.length, 3, 0);
  check('外链条目为 link 类型',
    dirs[8].items.every(i => i.kind === 'link' && String(i.url).indexOf('https://') === 0) ? 1 : 0, 1, 0);
  check('TTE 经胸切面为直达交互链接',
    dirs[8].items.some(i => i.id === 'tte-sv' && /TTE-HTML5-SV\/index\.html$/.test(i.url)) ? 1 : 0, 1, 0);
  check('外链条目含速查表 / 指南条目',
    dirs[8].items.some(i => i.id === 'tee-cheat') &&
    dirs[9].items.some(i => i.id === 'guide-tte-cn') &&
    dirs[9].items.some(i => i.id === 'guide-tee-28') ? 1 : 0, 1, 0);
  check('模拟器含 CT2TEE / TEE Simulator 图谱',
    dirs[10].items.some(i => /ct2tee/.test(i.url)) &&
    dirs[10].items.some(i => /anesthbeta/.test(i.url)) ? 1 : 0, 1, 0);
  check('器械支持 2 条（CRT / LAD）', dirs[2].items.length, 2, 0);
  check('器械支持含 CRT 同步化',
    dirs[2].items.some(i => i.id === 'crt') ? 1 : 0, 1, 0);
  check('器械支持含 LAD 参数',
    dirs[2].items.some(i => i.id === 'la') ? 1 : 0, 1, 0);
  check('心腔与应变 10 条', dirs[3].items.length, 10, 0);
  ['lv', 'rv', 'rcoupling', 'rvfail', 'strain', 'la-strain', 'peri', 'cp-rm', 'prosthetic', 'ctrcd'].forEach(id => {
    check('心腔与应变含 ' + id,
      dirs[3].items.some(i => i.id === id) ? 1 : 0, 1, 0);
  });
  // 瓣膜评估组 = 5 个瓣膜计算器 + 4 条判读（合并为一组，不再有「瓣膜疾病评估」）
  check('瓣膜评估组合并为 9 条（5 计算器 + 4 判读）', dirs[1].items.length, 9, 0);
  check('瓣膜评估组含 5 个瓣膜计算器入口',
    ['as', 'ar', 'ms', 'mr', 'tr'].every(id => dirs[1].items.some(i => i.id === id && i.kind === 'valve')) ? 1 : 0, 1, 0);
  ['mitral', 'aortic', 'lf-lg', 'ie'].forEach(id => {
    check('瓣膜评估组含判读条目 ' + id,
      dirs[1].items.some(i => i.id === id && i.kind === 'brief') ? 1 : 0, 1, 0);
  });
  check('不存在重复的「瓣膜疾病评估」分组',
    dirs.filter(s => s.title.indexOf('瓣膜疾病') !== -1).length === 0 ? 1 : 0, 1, 0);
  check('心肌病变 2 条（HCM / 淀粉样变）', dirs[4].items.length, 2, 0);
  ['hcm', 'amyloid'].forEach(id => {
    check('心肌病变含 ' + id,
      dirs[4].items.some(i => i.id === id) ? 1 : 0, 1, 0);
  });
  check('大血管与急症 3 条（主动脉 / 肺栓塞 / 心腔占位）', dirs[5].items.length, 3, 0);
  ['aorta', 'pe', 'thrombus'].forEach(id => {
    check('大血管与急症含 ' + id,
      dirs[5].items.some(i => i.id === id) ? 1 : 0, 1, 0);
  });
  check('负荷与功能试验 1 条（运动负荷超声）', dirs[6].items.length, 1, 0);
  check('负荷试验含 stress-echo',
    dirs[6].items.some(i => i.id === 'stress-echo') ? 1 : 0, 1, 0);
  check('介入 TEE 评估 3 条（三尖瓣 / 二尖瓣 / TAVR）', dirs[7].items.length, 3, 0);
  ['tr-interv', 'mv-interv', 'tavr'].forEach(id => {
    check('介入 TEE 评估含 ' + id,
      dirs[7].items.some(i => i.id === id) ? 1 : 0, 1, 0);
  });
  check('条目均带一句话说明', dirs.every(s => s.items.every(i => i.sub)) ? 1 : 0, 1, 0);

  // 跳转
  pgA.onOpen({ currentTarget: { dataset: { kind: 'calc', id: 'bernoulli' } } });
  check('点击公式条目 → navigateTo formula?id=…',
    navTo === '/pages/formula/formula?id=bernoulli' ? 1 : 0, 1, 0);
  pgA.onOpen({ currentTarget: { dataset: { kind: 'valve', id: 'ms' } } });
  check('点击瓣膜条目 → navigateTo valves?tab=ms',
    navTo === '/pages/valves/valves?tab=ms' ? 1 : 0, 1, 0);
  pgA.onOpen({ currentTarget: { dataset: { kind: 'brief', id: 'crt' } } });
  check('点击评估条目 → navigateTo formula?id=crt',
    navTo === '/pages/formula/formula?id=crt' ? 1 : 0, 1, 0);
  const EXD23 = require(pathW.join(__dirname, 'miniprogram', 'utils', 'extra-data.js'));
  const teeSvUrl = EXD23.LINK_SECTIONS[0].items.filter(i => i.id === 'tee-sv')[0].url;
  pgA.onOpen({ currentTarget: { dataset: { kind: 'link', id: 'tee-sv', url: teeSvUrl } } });
  check('点击切面条目 → 复制链接到剪贴板', clip === teeSvUrl ? 1 : 0, 1, 0);
  pgA.onCopyLink({ currentTarget: { dataset: { url: 'https://zs-echo.com' } } });
  check('延展阅读点击 → 复制链接', clip === 'https://zs-echo.com' ? 1 : 0, 1, 0);

  // —— 计算公式详情：flow ——
  pgF.onLoad({ id: 'flow' });
  check('详情页标题 = LVOT · 每搏量与心排量',
    pgF.data.title === 'LVOT · 每搏量与心排量' ? 1 : 0, 1, 0);
  check('导航栏标题已同步', navBarTitle === 'LVOT · 每搏量与心排量' ? 1 : 0, 1, 0);
  check('flow 输入项 3 个', pgF.data.inputs.length, 3, 0);
  pgF.onShow();
  check('未填写时等待输入', pgF.data.hasOut ? 0 : 1, 1, 0);
  pgF.data.inputs[0].value = '2';
  pgF.data.inputs[1].value = '20';
  pgF.data.inputs[2].value = '70';
  pgF.refresh();
  check('flow 结果含 SV 与 CO',
    /SV/.test(pgF.data.out) && /CO/.test(pgF.data.out) ? 1 : 0, 1, 0);
  check('结果写入输入缓存',
    gData23.calcCache.flow && gData23.calcCache.flow.ld === '2' ? 1 : 0, 1, 0);

  // —— 右心评估详情（已合并右心压力 / PH 概率 / 右室功能）——
  pgF.onLoad({ id: 'rv' });
  check('右心评估为 brief 模式', pgF.data.mode === 'brief' ? 1 : 0, 1, 0);
  check('右心评估输入项 7 个（tr/ivc/prend/rvti2/eda/esa/rvs）', pgF.data.inputs.length, 7, 0);
  check('右心评估含 IVC 塌陷选项', pgF.data.collapse.length, 3, 0);
  check('右心评估含 PH 征象选项', pgF.data.signs.length, 3, 0);
  // 设 TR=3.0, IVC=22 不塌陷 → RAP 15, PASP≈51 中重度
  pgF.data.inputs[0].value = '3.0';
  pgF.data.inputs[1].value = '22';
  pgF.data.collapseV = 'no';
  pgF.onShow();
  check('右心结果含 RAP 与 PASP',
    /RAP/.test(pgF.data.out) && /PASP/.test(pgF.data.out) ? 1 : 0, 1, 0);
  check('右心结果含 PH 超声概率', /PH 超声概率/.test(pgF.data.out) ? 1 : 0, 1, 0);

  // —— 未知 id 回退 ——
  pgF.onLoad({ id: 'nope' });
  check('未知 id 回退到第一组', pgF.data.gid === 'flow' ? 1 : 0, 1, 0);

  // —— 评估类内容（brief 模式）——
  pgF.onLoad({ id: 'crt' });
  pgF.onShow();
  check('CRT 条目为 brief 模式', pgF.data.mode === 'brief' ? 1 : 0, 1, 0);
  check('CRT 有内容块', pgF.data.blocks.length >= 8 ? 1 : 0, 1, 0);
  check('CRT 含表格块', pgF.data.blocks.some(b => b.kind === 'table') ? 1 : 0, 1, 0);
  check('CRT 标注引用文献', pgF.data.refs.length >= 1 ? 1 : 0, 1, 0);
  check('CRT 导航栏标题同步', navBarTitle === 'CRT 同步化' ? 1 : 0, 1, 0);
  pgF.data.inputs[0].value = '2';    // LVOT d
  pgF.data.inputs[1].value = '20';   // VTI
  pgF.data.inputs[3].value = '160';  // QRS
  pgF.refresh();
  check('CRT 结果含 SVi 与 QRS 提示',
    /SVi/.test(pgF.data.out) && /QRS/.test(pgF.data.out) ? 1 : 0, 1, 0);

  pgF.onLoad({ id: 'la' });
  pgF.onShow();
  pgF.data.inputs[0].value = '70';   // 左房容积
  pgF.refresh();
  check('LAVi 计算与判读', /LAVi 40/.test(pgF.data.out) && /增大/.test(pgF.data.out) ? 1 : 0, 1, 0);

  pgF.onLoad({ id: 'lv' });
  pgF.onShow();
  pgF.data.inputs[0].value = '120';  // LVMI 男
  pgF.data.inputs[1].value = '0.45'; // RWT
  pgF.refresh();
  check('LVMI 男性分级 = 中度增高',
    /中度增高/.test(pgF.data.out) ? 1 : 0, 1, 0);
  check('RWT > 0.42 判为向心性肥厚',
    /向心性肥厚/.test(pgF.data.out) ? 1 : 0, 1, 0);
  gData23.profile.sex = 'female';
  pgF.data.inputs[0].value = '110';
  pgF.onShow();
  check('LVMI 女性分级 = 中度增高（同一数值不同分级）',
    /中度增高/.test(pgF.data.out) ? 1 : 0, 1, 0);
  gData23.profile.sex = 'male';

  pgF.onLoad({ id: 'strain' });
  pgF.onShow();
  pgF.data.inputs[0].value = '-16';
  pgF.refresh();
  check('GLS -16% 判为异常', /异常/.test(pgF.data.out) ? 1 : 0, 1, 0);
  pgF.data.inputs[0].value = '-22';
  pgF.refresh();
  check('GLS -22% 判为正常', /正常/.test(pgF.data.out) ? 1 : 0, 1, 0);
}

console.log(`\n${'='.repeat(46)}`);
console.log(`结果： ${pass} 通过 / ${fail} 失败`);
console.log('='.repeat(46) + '\n');
process.exit(fail > 0 ? 1 : 0);
