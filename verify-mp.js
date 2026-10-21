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
  const calcJs = fsW.readFileSync(
    pathW.join(__dirname, 'miniprogram', 'pages', 'calculators', 'calculators.js'), 'utf8');

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

  // 参考文献区（默认折叠：49 条平铺会把页面拉得极长）
  check('公式集页含参考文献区（折叠头）',
    calcWxml.indexOf('refs-hd') !== -1 && calcWxml.indexOf('参考文献') !== -1 ? 1 : 0, 1, 0);
  check('参考文献默认折叠（refsOpen 初值 false）',
    /refsOpen:\s*false/.test(calcJs) ? 1 : 0, 1, 0);
  check('折叠头点开绑定 onToggleRefs',
    calcWxml.indexOf('bindtap="onToggleRefs"') !== -1 &&
    /onToggleRefs\s*\(\s*\)/.test(calcJs) ? 1 : 0, 1, 0);
  check('折叠头显示条数（refsCount）',
    calcWxml.indexOf('{{refsCount}}') !== -1 &&
    /refsCount:\s*EX\.REFS\.length/.test(calcJs) ? 1 : 0, 1, 0);
  check('参考文献列表受 refsOpen 控制',
    calcWxml.indexOf('wx:if="{{refsOpen}}"') !== -1 ? 1 : 0, 1, 0);
  check('参考文献列表绑定 refs', calcWxml.indexOf('wx:for="{{refs}}"') !== -1 ? 1 : 0, 1, 0);
  const EXD = require(pathW.join(__dirname, 'miniprogram', 'utils', 'extra-data.js'));
  check('参考文献 62 条', EXD.REFS.length, 62, 0);
  const refIds = EXD.REFS.map(r => r.id).join(',');
  // 期望序列程序化生成：新增文献时只要编号连续即可，不必再手改这行
  const expRefIds = Array.from({ length: EXD.REFS.length }, (_, i) => 'R' + (i + 1)).join(',');
  check('文献编号连续 R1–R' + EXD.REFS.length,
    refIds === expRefIds ? 1 : 0, 1, 0);
  const allHave = EXD.REFS.every(r => r.zh && r.where && r.use);
  check('每条文献含名称/出处/用途', allHave ? 1 : 0, 1, 0);
  // 文献直链：只放「点开就能看」的官方/免费 PDF，需要登录的一律不挂
  const allDl = EXD.REFS.reduce((a, r) => a.concat(r.dl || []), []);
  check('文献直链均为 https 地址', allDl.every(d => String(d.u).indexOf('https://') === 0) ? 1 : 0, 1, 0);
  check('文献直链均标注类型（PDF / 中文 PDF / 免费全文 / PMC）',
    allDl.every(d => /PDF|全文/.test(d.t)) ? 1 : 0, 1, 0);
  check('带直链的文献 ≥ 35 条', EXD.REFS.filter(r => (r.dl || []).length).length >= 35 ? 1 : 0, 1, 0);
  check('ASE 官方 PDF 直链 ≥ 20 条',
    allDl.filter(d => /asecho\.org\/wp-content\/uploads\/.+\.pdf$/.test(d.u)).length >= 20 ? 1 : 0, 1, 0);
  check('折叠头显示可直连条数（refsPdf）',
    calcWxml.indexOf('{{refsPdf}}') !== -1 &&
    /refsPdf:\s*EX\.REFS\.filter/.test(calcJs) ? 1 : 0, 1, 0);
  check('文献直链渲染成可点胶囊（data-url + catchtap）',
    calcWxml.indexOf('class="ref-dl__i"') !== -1 &&
    calcWxml.indexOf('catchtap="onCopyLink"') !== -1 ? 1 : 0, 1, 0);

  // ── 组名跳转条（目录 113 条，页面很长） ──
  check('目录页有组名跳转条（fx-nav）', calcWxml.indexOf('class="fx-nav"') !== -1 ? 1 : 0, 1, 0);
  check('每个分组带锚点 id="g-{{sec.id}}"',
    calcWxml.indexOf('id="g-{{sec.id}}"') !== -1 ? 1 : 0, 1, 0);
  check('跳转条数据来自目录（navGroups）',
    /navGroups:\s*buildSections\(\)/.test(calcJs) ? 1 : 0, 1, 0);
  check('点组名走 onJumpGroup（选择器定位 + pageScrollTo）',
    calcWxml.indexOf('bindtap="onJumpGroup"') !== -1 &&
    /onJumpGroup\s*\(/.test(calcJs) &&
    calcJs.indexOf('createSelectorQuery') !== -1 &&
    calcJs.indexOf('pageScrollTo') !== -1 ? 1 : 0, 1, 0);
  check('跳转条样式存在（.fx-nav__c--on 高亮）',
    calcWxss.indexOf('.fx-nav__c--on') !== -1 ? 1 : 0, 1, 0);

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
  // 用户 2026-10-21：儿童 Z 值调到「节段划分」之前
  check('tabBar 顺序 index,pediatric,segments,calculators',
    tabList.map(function (t) { return t.pagePath; }).join(',') ===
    'pages/index/index,pages/pediatric/pediatric,pages/segments/segments,pages/calculators/calculators' ? 1 : 0, 1, 0);
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
  check('公式集分 24 个大组（… + 随访与术中评估 + 妊娠与特殊人群 + 特殊临床场景 + 报告与质控）', dirs.length, 24, 0);
  check('组标题顺序',
    dirs.map(d => d.title).join('|') ===
      '血流动力学与心功能|右心与肺循环|舒张功能定量|重构与心肌功能|评分与室壁运动|介入尺寸与先心|随访与术中评估|瓣膜评估|器械支持|心腔与应变|心肌病变|大血管与急症|先天性心脏病|先心病术后残余病变|负荷与功能试验|介入 TEE 评估|造影与特殊检查|有创操作与介入超声|伪影识别与规避|妊娠与特殊人群|特殊临床场景|报告与质控|切面学习（视频）|TEE 模拟器' ? 1 : 0, 1, 0);
  // ★ 按 id 定位分组，不用硬编码下标：以后新增分组不会让后面的断言错位
  const dirById = function (id) { return dirs.filter(function (d) { return d.id === id; })[0]; };
  const dirViews = dirById('views');
  const dirSim = dirById('sim');
  const nItems = dirs.reduce((n, s) => n + s.items.length, 0);
  check('目录共 128 条（62 计算 + 11 瓣膜 + 51 评估 + 9 外链 - 5 合并进瓣膜组）', nItems, 128, 0);
  check('切面学习 6 条（专辑入口 + 5 个外链）', dirViews.items.length, 6, 0);
  check('TEE 模拟器 3 条', dirSim.items.length, 3, 0);
  check('操作规范专辑排在切面学习第一条',
    dirViews.items[0] && dirViews.items[0].kind === 'album' && dirViews.items[0].id === 'bookvid' ? 1 : 0, 1, 0);
  check('专辑标题为「实用超声规范化检查与操作（视频）」',
    dirViews.items[0].title === '实用超声规范化检查与操作（视频）' ? 1 : 0, 1, 0);
  check('外链条目为 link 类型（专辑除外）',
    dirViews.items.slice(1).every(i => i.kind === 'link' && String(i.url).indexOf('https://') === 0) ? 1 : 0, 1, 0);
  check('书籍视频条目为 album 且标注 25 段',
    dirViews.items[0] && dirViews.items[0].count === 25 ? 1 : 0, 1, 0);
  check('专辑条目不把 children 塞进目录数据（省 setData）',
    dirViews.items[0] && dirViews.items[0].children === undefined ? 1 : 0, 1, 0);
  check('专辑条目带书籍出处说明',
    (function () {
      const EXv = require('./miniprogram/utils/extra-data.js');
      const it = EXv.LINK_SECTIONS.filter(s => s.id === 'views')[0].items[0];
      return /王辉/.test(it.note || '') && /978-7-5189-8028-4/.test(it.note || '') ? 1 : 0;
    })(), 1, 0);
  check('TTE 经胸切面为直达交互链接',
    dirViews.items.some(i => i.id === 'tte-sv' && /TTE-HTML5-SV\/index\.html$/.test(i.url)) ? 1 : 0, 1, 0);
  check('外链条目含 TEE 速查表',
    dirViews.items.some(i => i.id === 'tee-cheat') ? 1 : 0, 1, 0);
  // 原「切面指南」4 条 ASE 官方 PDF 已并入参考文献（R11 中/英、R12、R41）
  check('切面指南已并入参考文献（不在目录里单列）',
    dirs.every(d => d.title !== '切面指南') ? 1 : 0, 1, 0);
  const EXL = require(pathW.join(__dirname, 'miniprogram', 'utils', 'extra-data.js'));
  check('R11 含 TTE 官方中英文 PDF 直链',
    (function () {
      const r = EXL.REFS.filter(x => x.id === 'R11')[0];
      return (r.dl || []).length === 2 &&
        (r.dl || []).some(d => /2019_Comprehensive-TTE\.pdf$/.test(d.u)) &&
        (r.dl || []).some(d => /Adult-CompTTE_Chinese\.pdf$/.test(d.u)) ? 1 : 0;
    })(), 1, 0);
  check('R12 含 TEE 2013 官方 PDF 直链',
    EXL.REFS.filter(x => x.id === 'R12')[0].dl.some(d => /2013_Performing-Comprehensive-TEE\.pdf$/.test(d.u)) ? 1 : 0, 1, 0);
  check('R41 含 TEE 介入筛查官方 PDF 直链',
    EXL.REFS.filter(x => x.id === 'R41')[0].dl.some(d => /PIIS0894731721005940\.pdf$/.test(d.u)) ? 1 : 0, 1, 0);
  check('模拟器含 CT2TEE / TEE Simulator 图谱',
    dirSim.items.some(i => /ct2tee/.test(i.url)) &&
    dirSim.items.some(i => /anesthbeta/.test(i.url)) ? 1 : 0, 1, 0);
  // ── v1.2.4 新增的三个计算组 ──
  check('血流动力学与心功能 14 条（含 M 型三合一、快速比值、Ea、VTI 比；dias 已移至舒张功能定量）', dirById('hemo').items.length, 14, 0);
  check('右心与肺循环 13 条（PASP / RAP / FAC / TAPSE-PASP / PVR / SVR + 第二批 6 条 + 肺高压可能性）',
    dirById('right').items.length, 13, 0);
  check('右心第二批条目齐全（rvvol / rvfws / papi / pdap / residx / rvdvdt）',
    ['rvvol', 'rvfws', 'papi', 'pdap', 'residx', 'rvdvdt']
      .every(id => dirById('right').items.some(i => i.id === id && i.kind === 'calc')) ? 1 : 0, 1, 0);
  check('右心组条目齐全',
    ['paspv', 'rapv', 'rvfacv', 'rcratiov', 'pvrv', 'svrv']
      .every(id => dirById('right').items.some(i => i.id === id && i.kind === 'calc')) ? 1 : 0, 1, 0);
  check('舒张功能定量 3 条（基础比值 dias + E/Vp + 四步法分级）',
    dirById('vq').items.length, 3, 0);
  check('舒张功能定量组条目齐全（dias / evp / dfun）',
    ['dias', 'evp', 'dfun']
      .every(id => dirById('vq').items.some(i => i.id === id && i.kind === 'calc')) ? 1 : 0, 1, 0);
  check('重构与心肌功能 12 条（容积 / RWS / 球形 / 左房应变 / 主动脉 / MDS / 每搏功 + LAEF / LVMI 身高^2.7 / RAS + 左房僵硬 / NC/C）',
    dirById('recon').items.length, 12, 0);
  check('重构组条目齐全',
    ['volidx', 'rwsv', 'spher', 'lastrain', 'aortaidx', 'mdsv', 'swv']
      .every(id => dirById('recon').items.some(i => i.id === id && i.kind === 'calc')) ? 1 : 0, 1, 0);
  check('计算类条目合计 50 条（6 个计算组；另 7 条瓣膜通用计算在瓣膜评估组，合计仍 57）',
    dirs.slice(0, 6).reduce((n, d) => n + d.items.length, 0), 50, 0);
  check('评分与室壁运动 3 条（WMSI / H2FPEF / HFA-PEFF）', dirById('score').items.length, 3, 0);
  check('评分组条目齐全',
    ['wmsi', 'h2fpef', 'hfapeff']
      .every(id => dirById('score').items.some(i => i.id === id && i.kind === 'calc')) ? 1 : 0, 1, 0);
  check('介入尺寸与先心 5 条（TAVR / LAA / McGoon / CoA / 主动脉 Z 值）', dirById('ivs').items.length, 5, 0);
  check('介入组条目齐全',
    ['tavrsz', 'laasz', 'paidx', 'coa']
      .every(id => dirById('ivs').items.some(i => i.id === id && i.kind === 'calc')) ? 1 : 0, 1, 0);
  check('第三四批条目齐全',
    ['wilkins', 'vcw', 'rf', 'mva', 'laef', 'quickratio', 'lvmih', 'paidx', 'ras', 'ea', 'coa']
      .every(id => ['hemo', 'right', 'vq', 'recon', 'score', 'ivs', 'valve'].some(g => dirById(g).items.some(i => i.id === id)))
      ? 1 : 0, 1, 0);
  check('器械支持 3 条（CRT / LAD / LVAD）', dirById('device').items.length, 3, 0);
  check('器械支持含 CRT 同步化',
    dirById('device').items.some(i => i.id === 'crt') ? 1 : 0, 1, 0);
  check('器械支持含 LAD 参数',
    dirById('device').items.some(i => i.id === 'la') ? 1 : 0, 1, 0);
  check('器械支持含 LVAD 超声评估',
    dirById('device').items.some(i => i.id === 'lvad') ? 1 : 0, 1, 0);
  check('心腔与应变 12 条（含舒张功能分级）', dirById('chamber').items.length, 12, 0);
  ['lv', 'rv', 'rcoupling', 'rvfail', 'rv-strain', 'strain', 'la-strain', 'peri', 'cp-rm', 'prosthetic', 'ctrcd'].forEach(id => {
    check('心腔与应变含 ' + id,
      dirById('chamber').items.some(i => i.id === id) ? 1 : 0, 1, 0);
  });
  // 瓣膜评估组 = 5 个瓣膜计算器 + 4 条判读（合并为一组，不再有「瓣膜疾病评估」）
  check('瓣膜评估组合并为 21 条（5 专用计算器 + 9 通用计算 + 6 判读 + 1 解剖示意图）', dirById('valve').items.length, 21, 0);
  check('瓣膜评估组含 7 条瓣膜通用计算（wilkins / vcw / rf / mva / pisav / avav / ppm）',
    ['wilkins', 'vcw', 'rf', 'mva', 'pisav', 'avav', 'ppm']
      .every(id => dirById('valve').items.some(i => i.id === id && i.kind === 'calc')) ? 1 : 0, 1, 0);
  check('瓣膜通用计算不再出现在舒张功能定量组',
    ['wilkins', 'vcw', 'rf', 'mva', 'pisav', 'avav', 'ppm']
      .every(id => !dirById('vq').items.some(i => i.id === id)) ? 1 : 0, 1, 0);
  check('瓣膜评估组含 5 个瓣膜计算器入口',
    ['as', 'ar', 'ms', 'mr', 'tr'].every(id => dirById('valve').items.some(i => i.id === id && i.kind === 'valve')) ? 1 : 0, 1, 0);
  ['mitral', 'aortic', 'lf-lg', 'ie'].forEach(id => {
    check('瓣膜评估组含判读条目 ' + id,
      dirById('valve').items.some(i => i.id === id && i.kind === 'brief') ? 1 : 0, 1, 0);
  });
  check('不存在重复的「瓣膜疾病评估」分组',
    dirs.filter(s => s.title.indexOf('瓣膜疾病') !== -1).length === 0 ? 1 : 0, 1, 0);
  check('心肌病变 5 条（HCM / 淀粉样变 / 应变鉴别 / DCM / 运动员心脏）', dirById('myopathy').items.length, 5, 0);
  ['hcm', 'amyloid', 'rcm-strain'].forEach(id => {
    check('心肌病变含 ' + id,
      dirById('myopathy').items.some(i => i.id === id) ? 1 : 0, 1, 0);
  });
  check('大血管与急症 4 条（主动脉 / 肺栓塞 / 肺高压 / 心腔占位）', dirById('vascular').items.length, 4, 0);
  ['aorta', 'pe', 'thrombus'].forEach(id => {
    check('大血管与急症含 ' + id,
      dirById('vascular').items.some(i => i.id === id) ? 1 : 0, 1, 0);
  });
  check('先天性心脏病 5 条（分流判读 / 可手术性 / TOF 术后 PR / Ebstein / DORV）', dirById('chd').items.length, 5, 0);
  ['shd', 'pht-rev', 'tof-pr', 'ebstein', 'dorv'].forEach(id => {
    check('先天性心脏病含 ' + id,
      dirById('chd').items.some(i => i.id === id) ? 1 : 0, 1, 0);
  });
  check('先心病术后残余病变 3 条（Mustard / Fontan / ASO）', dirById('chd-post').items.length, 3, 0);
  ['mustard', 'fontan', 'as-switch'].forEach(id => {
    check('先心术后含 ' + id,
      dirById('chd-post').items.some(i => i.id === id) ? 1 : 0, 1, 0);
  });
  check('负荷与功能试验 1 条（运动负荷超声）', dirById('stress').items.length, 1, 0);
  check('负荷试验含 stress-echo',
    dirById('stress').items.some(i => i.id === 'stress-echo') ? 1 : 0, 1, 0);
  check('介入 TEE 评估 3 条（三尖瓣 / 二尖瓣 / TAVR）', dirById('tee-interv').items.length, 3, 0);
  ['tr-interv', 'mv-interv', 'tavr'].forEach(id => {
    check('介入 TEE 评估含 ' + id,
      dirById('tee-interv').items.some(i => i.id === id) ? 1 : 0, 1, 0);
  });
  check('造影与特殊检查 1 条（超声造影 CEUS）', dirById('contrast').items.length, 1, 0);
  check('造影与特殊检查含 contrast-echo',
    dirById('contrast').items.some(i => i.id === 'contrast-echo' && i.kind === 'brief') ? 1 : 0, 1, 0);
  check('有创操作与介入超声 1 条（超声引导有创操作）', dirById('intervention').items.length, 1, 0);
  check('伪影识别与规避 1 条（超声伪影指南）', dirById('artifact').items.length, 1, 0);
  check('伪影识别与规避含 artifact-guide',
    dirById('artifact').items.some(i => i.id === 'artifact-guide' && i.kind === 'brief') ? 1 : 0, 1, 0);

  check('有创操作与介入超声含 echo-interv',
    dirById('intervention').items.some(i => i.id === 'echo-interv' && i.kind === 'brief') ? 1 : 0, 1, 0);
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

  // —— v1.2.4 新增的 18 个计算器（小程序端分支逐个跑）——
  const mpCalc = function (gid, vals, re, label, collapse) {
    pgF.onLoad({ id: gid });
    pgF.onShow();
    pgF.data.inputs.forEach(function (r) {
      r.value = (vals[r.key] === undefined ? '' : String(vals[r.key]));
    });
    pgF.data.collapseV = collapse || '';
    pgF.refresh();
    check('小程序 ' + label, re.test(pgF.data.out) ? 1 : 0, 1, 0);
  };
  mpCalc('paspv', { ptrv: 3.0, prap: 8 }, /PASP ≈ 44.*轻度/, 'PASP 3.0+8 = 44 轻度');
  mpCalc('rapv', { rivc: 18 }, /RAP ≈ 3/, 'RAP IVC 18 + 塌陷充分 = 3', 'yes');
  mpCalc('rvfacv', { feda: 20, fesa: 13 }, /FAC 35\.0%/, 'RV FAC 20/13 = 35%');
  mpCalc('rcratiov', { ctapse: 17, cpasp: 60 }, /0\.28.*失耦联/, 'TAPSE/PASP 0.28 失耦联');
  mpCalc('pvrv', { hmmpap: 45, hmpawp: 12, hmco: 5 }, /6\.60 WU.*重度/, 'PVR 6.6 WU 重度');
  mpCalc('svrv', { smap: 65, srap: 5, sco: 5 }, /960.*正常/, 'SVR 960 正常');
  mpCalc('pisav', { prad: 0.8, palias: 40, pvmax: 5.0, pvti: 150 },
    /EROA 0\.32/, 'PISA EROA 0.32');
  mpCalc('avav', { ald: 2.0, alvti: 20, aavti: 30 }, /AVA 2\.09/, 'AVA 2.09');
  mpCalc('mva', { mpht: 100 }, /MVA 2\.20 cm²（PHT 法）.*轻度/, 'MVA PHT 100 → 2.2');
  mpCalc('ppm', { peoa: 1.4, ppos: 1 }, /0\.80.*中度 PPM/, 'EOAi 0.78 中度 PPM（R17 切点）');
  mpCalc('dfun', { dfe: 80, dfa: 60, dfes: 10, dfel: 14 },
    /E\/A 1\.33.*正常充盈/, '舒张四步法 正常充盈');
  mpCalc('volidx', { vedv: 150, vesv: 60 }, /EDVi 85\.7.*轻度增大/, 'EDVi 85.7 轻度增大');
  mpCalc('rwsv', { rsbp: 140, rlvedd: 5.5, rpwt: 1.1 }, /RWS 195/, 'RWS 195');
  mpCalc('spher', { sdd: 5.5, sld: 8.5 }, /SI 0\.65/, '球形指数 0.65');
  mpCalc('lastrain', { lsr: 30, lscd: 18, lsct: 12 }, /LASr 30\.0%.*自洽/, '左房应变三值自洽');
  mpCalc('aortaidx', { aodim: 36 }, /指数 2\.06.*边缘/, '升主动脉指数 2.06 边缘');
  mpCalc('mdsv', { mds1: -18, mds2: -20, mds3: -16, mds4: -19, mds5: -15, mds6: -17 },
    /SD 1\.9/, '应变离散度 SD 1.9');
  mpCalc('swv', { ssv: 70, wmap: 90 }, /SW 85\.7.*正常/, '每搏功 85.7 正常');

  // —— v1.2.8 第一批：M 型 / 评分体系 / 介入尺寸（含选项组）——
  const mpCalc2 = function (gid, vals, re, label, opts) {
    pgF.onLoad({ id: gid });
    pgF.onShow();
    pgF.data.inputs.forEach(function (r) {
      r.value = (vals[r.key] === undefined ? '' : String(vals[r.key]));
    });
    // 每条用例都从默认值起步，避免上一条用例残留的 optsV 影响判断
    (pgF.data.opts || []).forEach(function (o) {
      pgF.data.optsV[o.k] = o.list[0][0];
    });
    if (opts) Object.keys(opts).forEach(function (k) { pgF.data.optsV[k] = opts[k]; });
    pgF.refresh();
    check('小程序 ' + label, re.test(pgF.data.out) ? 1 : 0, 1, 0);
  };
  mpCalc2('mtype', { mtdd: 50, mtds: 32, mtepss: 8 },
    /FS 36\.0%.*EF 65\.4%.*EPSS 增大/, 'M 型三合一 FS36/EF65/EPSS 增大');
  mpCalc2('mtype', { mtdd: 30, mtds: 35 }, /收缩末内径应小于/, 'M 型内径倒挂报错');
  mpCalc2('wmsi', { wn1: 12, wn2: 3, wn3: 1, wn4: 1, wn5: 0 },
    /WMSI = 1\.47.*17 节段.*轻度异常/, 'WMSI 1.47 轻度');
  mpCalc2('wmsi', { wn1: 8, wn2: 2, wn3: 4, wn4: 3, wn5: 0 },
    /WMSI = 2\.12.*重度异常/, 'WMSI 2.12 重度（8/2/4/3 = 36÷17）');
  mpCalc2('h2fpef', { hbmi: 31, hage: 65, hee: 10, hpasp: 40 },
    /H2FPEF 9 分.*可能性高/, 'H2FPEF 9 分高可能', { haf: '1', hbp: '1' });
  mpCalc2('h2fpef', { hbmi: 22, hage: 50, hee: 7, hpasp: 28 },
    /H2FPEF 0 分.*可能性低/, 'H2FPEF 0 分低可能', { haf: '0', hbp: '0' });
  mpCalc2('hfapeff', { hlavi: 42, hlvmi: 120, hrwt: 0.45, hpasp2: 38, hee2: 16,
    hes: 6, hel: 8, htrv: 3.0, hgls: 14, hbnp: 600 },
    /HFA-PEFF 6 分（形态 2 \+ 功能 2 \+ 标志物 2）.*支持 HFpEF/,
    'HFA-PEFF 6 分支持 HFpEF', { hsex: 'm', haf2: '0' });
  mpCalc2('tavrsz', { tcirc: 75, tarea: 420, tnom: 26 },
    /周长导出直径 23\.9.*面积导出直径 23\.1.*26\.4%.*过大/,
    'TAVR 周长23.9/面积23.1/oversizing 26.4%');
  mpCalc2('laasz', { lzmax: 24, lzmin: 19, lzdepth: 20 },
    /长短径比 1\.26.*建议选用 27 mm.*深度/, 'LAA 24mm → 推荐 27mm 并提示深度');
  mpCalc2('laasz', { lzmax: 34 }, /超出常规型号上限/, 'LAA 34mm 超上限');
  // —— v1.3.12：随访与术中评估 ——
  mpCalc2('aortagrow', { d1: 3.0, d2: 3.6, yrs: 2 },
    /年增长 3\.00 mm\/年.*中危/, '主动脉 3.0→3.6cm/2年 → 3.00 mm/年 中危');
  mpCalc2('aortagrow', { d1: 4.0, d2: 4.8, yrs: 1 },
    /年增长 8\.00 mm\/年.*高危/, '主动脉 4.0→4.8cm/1年 → 8.00 mm/年 高危');
  mpCalc2('pvfu', { lvotD: 2.0, lvotVti: 20, valveVti: 20, fupvmax: 2.6, fupmean: 12 },
    /EOA 3\.14 cm².*开放良好.*峰值流速 2\.60 m\/s.*平均压差 12\.0 mmHg.*正常/,
    '人工瓣 EOA 3.14 cm² 开放良好');
  mpCalc2('pvfu', { lvotD: 2.0, lvotVti: 20, valveVti: 16, fupvmax: 3.4, fupmean: 32 },
    /20–40 mmHg.*需鉴别/, '人工瓣术后 32 mmHg 提示需鉴别');
  mpCalc2('cfr', { distal: 60, proximal: 25 },
    /CFR 2\.40.*正常/, 'CFR 2.40 正常');
  mpCalc2('cfr', { distal: 35, proximal: 25 },
    /CFR 1\.40.*明显受限/, 'CFR 1.40 明显受限');

  // —— v1.2.9 第二批：右心与肺循环 ——
  mpCalc2('rvvol', { rvedv: 150, rvesv: 60 }, /RVEDVi 85\.7.*正常.*RVESVi 34\.3.*正常/,
    'RV 容积指数 85.7/34.3 正常');
  mpCalc2('rvvol', { rvedv: 200 }, /RVEDVi 114\.3.*增大/, 'RVEDVi 114 增大');
  mpCalc2('rvfws', { rfb: -18, rfm: -22, rfa: -25 },
    /RVFWS 均值 -21\.7%.*3 段.*正常/, 'RVFWS −21.7 正常');
  mpCalc2('rvfws', { rfb: -12, rfm: -14, rfa: -15 },
    /RVFWS 均值 -13\.7%.*减低/, 'RVFWS −13.7 减低');
  mpCalc2('papi', { pispap: 40, pidpap: 20, pirap: 15 },
    /PAPi = 1\.33.*失耦联/, 'PAPi 1.33 失耦联');
  mpCalc2('pdap', { pdprv: 1.5, pdrap: 8 }, /PADP ≈ 17\.0 mmHg.*9\.0/, 'PADP 1.5 → 17');
  mpCalc2('residx', { ripvr: 6, risvr: 960 }, /PVRI 10\.5.*升高.*SVRI 1680/,
    'PVRI 10.5 升高 / SVRI 1680');
  mpCalc2('rvdvdt', { rdt: 25 }, /dP\/dt ≈ 480.*保留/, 'RV dP/dt Δt25 = 480');
  mpCalc2('rvdvdt', { rdt: 40 }, /dP\/dt ≈ 300.*减低/, 'RV dP/dt Δt40 = 300 减低');

  // —— v1.3.0 第三批：瓣膜与舒张细节 ——
  mpCalc2('wilkins', { wk1: 2, wk2: 2, wk3: 2, wk4: 2 },
    /Wilkins 8 \/ 16（活动度 2 · 增厚 2 · 钙化 2 · 瓣下增厚 2）.*PBMV/,
    'Wilkins 8 分逐项列出且适合 PBMV');
  mpCalc2('wilkins', { wk1: 3, wk2: 4, wk3: 3, wk4: 4 },
    /Wilkins 14 \/ 16.*≥12.*外科/, 'Wilkins 14 分优先外科');
  mpCalc2('wilkins', { wk1: 4, wk2: 3, wk3: 3, wk4: 2 },
    /扣分最多的是「瓣叶活动度」（4 分：瓣叶无活动，全部僵硬）/,
    'Wilkins 指出扣分最重项及其形态描述');

  mpCalc2('vcw', { vcwv: 7 }, /MR 重度（≥7 mm）/, 'VCW 7mm MR 重度');
  mpCalc2('vcw', { vcwv: 6 }, /AR 重度（≥6 mm）/, 'VCW 6mm AR 重度', { vsite: 'ar' });
  mpCalc2('vcw', { vcwv: 4 }, /MR 中度/, 'VCW 4mm MR 中度');
  mpCalc2('rf', { rfvol: 60, rfsv: 86 }, /RF = 69\.8%.*重度/, 'RF 69.8% 重度');
  mpCalc2('mva', { mvd: 2.0, mvlvti: 20, mvmvti: 8 },
    /MVA 7\.85 cm²（连续方程.*轻度/, 'MVA 连续性方程 7.85');
  mpCalc2('laef', { lavmax: 80, lavmin: 40 },
    /LAEF 50\.0%.*扩张指数 100\.0%.*保留/, 'LAEF 50% 扩张指数 100%');
  mpCalc2('quickratio', { qla: 40, qao: 32, qrv: 40, qlv: 50 },
    /LA\/Ao = 1\.25.*增大.*RV\/LV = 0\.80.*右室扩大/, 'LA/Ao 1.25 / RV/LV 0.80');
  mpCalc2('lvmih', { lhmass: 200, lhheight: 170 },
    /LVMI 47\.7.*正常/, 'LVMI 身高^2.7 = 47.7 正常');

  // —— v1.3.0 第四批：先心 / 心肌 / 耦联 ——
  // Nakata 走 fmt(x, 0) 取整显示，故期望 90（引擎值为 89.76）
  mpCalc2('paidx', { prpa: 10, plpa: 10, pdao: 12 },
    /McGoon 1\.67.*不足.*Nakata 90 mm²\/m².*不足/, 'McGoon 1.67 不足 / Nakata 90');
  mpCalc2('ras', { rasap: -18, rasba: -9 },
    /RAS = 2\.00.*心尖保留/, 'RAS 2.0 心尖保留');
  mpCalc2('ea', { eaesp: 100, easv: 70, eaesv: 50 },
    /Ea 1\.43.*Ees\/Ea 1\.40.*常见区间/, 'Ea 1.43 / Ees-Ea 1.40');
  mpCalc2('coa', { coav: 3.2, coaved: 1.2 },
    /峰值压差 41.*拖尾征/, 'CoA 峰值 41mmHg + 拖尾征');

  // —— v1.3.1 成人主动脉分节段 Z 值 ——
  mpCalc2('aortaz', { azann: 26, azsin: 34, azstj: 29, azasc: 31 },
    /瓣环 Z 0\.0.*窦部 Z 0\.0.*均在?未超参考上限/, '主动脉四段 Z 0 未超上限');
  mpCalc2('aortaz', { azsin: 42 },
    /窦部 Z 3\.9.*显著扩张/, '窦部 42mm → Z 3.9 显著扩张');
  mpCalc2('aortaz', { azann: 26, azasc: 38 },
    /升主动脉 Z 3\.4.*升主动脉指数 2\.17.*≥2\.1.*扩张/,
    '升主动脉 38mm → Z 3.4 + 指数 2.17 扩张');
  mpCalc2('aortaz', { azann: 24 }, /瓣环 Z 0\.0/, '女性 24mm 瓣环 → Z 0', { azsex: 'f' });

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

  // —— 判读页 ↔ 计算器桥接（结构性解耦）——
  pgF.onLoad({ id: 'mitral' });
  pgF.onShow();
  const lastM = pgF.data.blocks[pgF.data.blocks.length - 1];
  check('二尖瓣判读页末块为「相关计算（通用量）」',
    lastM && lastM.text.indexOf('相关计算（通用量）') !== -1 ? 1 : 0, 1, 0);
  check('桥接指向公式集的瓣膜评估组',
    lastM && lastM.text.indexOf('瓣膜评估') !== -1 ? 1 : 0, 1, 0);
  pgF.onLoad({ id: 'amyloid' });
  pgF.onShow();
  const lastA = pgF.data.blocks[pgF.data.blocks.length - 1];
  check('淀粉样变判读页指向 RAS 与 MDS',
    lastA && /RAS/.test(lastA.text) && /应变离散度/.test(lastA.text) ? 1 : 0, 1, 0);
  pgF.onLoad({ id: 'ie' });
  pgF.onShow();
  const lastIe = pgF.data.blocks[pgF.data.blocks.length - 1];
  check('无对应算法的判读页（感染性心内膜炎）不挂桥接',
    lastIe && lastIe.text.indexOf('相关计算') === -1 ? 1 : 0, 1, 0);

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

  // —— v1.1.0 新增：右室应变 / 心尖保留 / 分流 / 可手术性 / LVAD / 负荷 PASP ——
  check('右室应变条目已注册',
    !!require(pathW.join(__dirname, 'miniprogram', 'utils', 'extra-data.js'))
      .BRIEF_SECTIONS.reduce((a, s) => a.concat(s.items.map(i => i.id)), []).includes('rv-strain') ? 1 : 0, 1, 0);

  pgF.onLoad({ id: 'rv-strain' });
  pgF.onShow();
  pgF.data.inputs[0].value = '-12';
  pgF.data.inputs[1].value = '-14';
  pgF.data.inputs[2].value = '-19';
  pgF.refresh();
  check('RVFWS 三段平均 -15% 判轻度减低',
    /RVFWS -15\.0%/.test(pgF.data.out) && /轻度减低/.test(pgF.data.out) ? 1 : 0, 1, 0);
  check('基底-心尖反向梯度被识别',
    /反向梯度/.test(pgF.data.out) ? 1 : 0, 1, 0);
  pgF.data.inputs[4].value = '45';   // PASP
  pgF.refresh();
  check('RVFWS/PASP 比值 0.33 判临界',
    /0\.33/.test(pgF.data.out) && /临界/.test(pgF.data.out) ? 1 : 0, 1, 0);

  // —— v1.1.1 新增：右室收缩储备（多巴酚丁胺）/ TOF 术后 PR ——
  check('右室应变条目含收缩储备输入项 10 个', pgF.data.inputs.length, 10, 0);
  pgF.data.inputs[5].value = '-14';   // 负荷前 RVFWS
  pgF.data.inputs[6].value = '-21';   // 峰值 RVFWS
  pgF.refresh();
  check('ΔRVFWS +7 → 收缩储备保留',
    /Δ\+7\.0/.test(pgF.data.out) && /储备保留/.test(pgF.data.out) ? 1 : 0, 1, 0);
  pgF.data.inputs[6].value = '-13';
  pgF.refresh();
  check('ΔRVFWS +1 → 收缩储备耗竭',
    /储备耗竭/.test(pgF.data.out) ? 1 : 0, 1, 0);

  pgF.onLoad({ id: 'rcm-strain' });
  pgF.onShow();
  pgF.data.inputs[0].value = '-8';
  pgF.data.inputs[1].value = '-8';
  pgF.data.inputs[2].value = '-16';
  pgF.refresh();
  check('RAR 1.00 → 心尖保留阳性',
    /RAR 1\.00/.test(pgF.data.out) && /淀粉样变/.test(pgF.data.out) ? 1 : 0, 1, 0);
  pgF.data.inputs[0].value = '-16';
  pgF.data.inputs[1].value = '-17';
  pgF.refresh();
  check('RAR 0.48 → 不支持心尖保留',
    /不支持心尖保留/.test(pgF.data.out) ? 1 : 0, 1, 0);

  pgF.onLoad({ id: 'shd' });
  pgF.onShow();
  pgF.data.inputs[0].value = '6.0';
  pgF.data.inputs[1].value = '3.0';
  pgF.refresh();
  check('Qp/Qs 2.0 → 大量分流',
    /Qp\/Qs = 2\.00/.test(pgF.data.out) && /大量分流/.test(pgF.data.out) ? 1 : 0, 1, 0);
  pgF.data.inputs[0].value = '2.4';
  pgF.refresh();
  check('Qp/Qs 0.8 → 警惕艾森曼格',
    /艾森曼格/.test(pgF.data.out) ? 1 : 0, 1, 0);

  pgF.onLoad({ id: 'pht-rev' });
  pgF.onShow();
  pgF.data.inputs[1].value = '9';
  pgF.refresh();
  check('PVR 9 WU → 禁忌关闭',
    /不可逆/.test(pgF.data.out) ? 1 : 0, 1, 0);
  pgF.data.inputs[1].value = '6';
  pgF.refresh();
  check('PVR 6 WU → 灰区需复评',
    /灰区/.test(pgF.data.out) ? 1 : 0, 1, 0);

  // —— v1.2.1：Ebstein / Mustard / Fontan ——
  pgF.onLoad({ id: 'ebstein' });
  pgF.onShow();
  pgF.data.inputs[0].value = '16';
  pgF.data.inputs[1].value = '1.6';
  pgF.refresh();
  check('下移指数 10 mm/m² → 符合 Ebstein',
    /10\.0 mm\/m²/.test(pgF.data.out) && /符合 Ebstein/.test(pgF.data.out) ? 1 : 0, 1, 0);
  pgF.data.inputs[0].value = '6';
  pgF.refresh();
  check('下移指数 3.8 mm/m² → 未达显著下移',
    /未达显著下移/.test(pgF.data.out) ? 1 : 0, 1, 0);

  pgF.onLoad({ id: 'mustard' });
  pgF.onShow();
  pgF.data.inputs[0].value = '9';
  pgF.data.inputs[1].value = '2';
  pgF.refresh();
  check('体静脉挡板 9 mmHg → 建议干预评估',
    /建议干预评估/.test(pgF.data.out) ? 1 : 0, 1, 0);
  check('肺静脉挡板 2 mmHg → 可接受',
    /可接受/.test(pgF.data.out) ? 1 : 0, 1, 0);

  pgF.onLoad({ id: 'fontan' });
  pgF.onShow();
  pgF.data.inputs[0].value = '5';
  pgF.data.inputs[1].value = '2';
  pgF.refresh();
  check('管道压差 5 mmHg → 明显梗阻',
    /明显梗阻/.test(pgF.data.out) ? 1 : 0, 1, 0);
  check('开窗 2 mm → 偏小提示',
    /偏小/.test(pgF.data.out) ? 1 : 0, 1, 0);

  pgF.onLoad({ id: 'lvad' });
  pgF.onShow();
  pgF.data.inputs[0].value = '1.6';
  pgF.data.inputs[1].value = '22';
  pgF.data.inputs[2].value = '80';
  pgF.data.inputs[3].value = '28';
  pgF.data.inputs[4].value = '3';
  pgF.refresh();
  check('LVAD 出血道 SV 44.2 mL / CO 3.54',
    /44\.2 mL/.test(pgF.data.out) && /3\.54/.test(pgF.data.out) ? 1 : 0, 1, 0);
  check('LVAD LVEDD 28 → 抽吸高危',
    /抽吸高危/.test(pgF.data.out) ? 1 : 0, 1, 0);
  check('LVAD 主动脉瓣持续关闭 → 淤滞风险',
    /持续关闭/.test(pgF.data.out) && /血栓/.test(pgF.data.out) ? 1 : 0, 1, 0);

  pgF.onLoad({ id: 'tof-pr' });
  pgF.onShow();
  pgF.data.inputs[0].value = '0.75';  // PR 指数
  pgF.data.inputs[1].value = '55';    // 反流束 / RVOT
  pgF.data.inputs[2].value = '172';   // RVEDVi
  pgF.data.inputs[3].value = '92';    // RVESVi
  pgF.data.inputs[4].value = '46';    // RVEF
  pgF.refresh();
  check('PR 指数 0.75 + 宽度比 55% → 重度 PR',
    /重度 PR/.test(pgF.data.out) ? 1 : 0, 1, 0);
  check('RVESVi 92 / RVEDVi 172 / RVEF 46 → 达 PVR 指征',
    /已达 PVR 评估指征/.test(pgF.data.out) ? 1 : 0, 1, 0);
  pgF.data.inputs[0].value = '0.4';
  pgF.data.inputs[1].value = '25';
  pgF.data.inputs[2].value = '140';
  pgF.data.inputs[3].value = '66';
  pgF.data.inputs[4].value = '56';
  pgF.refresh();
  check('PR 轻度 + RVESVi 66 → 未达阈值',
    /轻度 PR/.test(pgF.data.out) && /尚未达 PVR 容量阈值/.test(pgF.data.out) ? 1 : 0, 1, 0);

  pgF.onLoad({ id: 'stress-echo' });
  pgF.onShow();
  check('负荷超声输入项 7 个（含两个 PASP）', pgF.data.inputs.length, 7, 0);
  pgF.data.inputs[5].value = '30';
  pgF.data.inputs[6].value = '62';
  pgF.refresh();
  check('PASP 30→62 判运动诱发肺高压',
    /运动诱发肺高压/.test(pgF.data.out) ? 1 : 0, 1, 0);

  // —— v1.3.2 Wilkins 细化 + 二尖瓣内嵌 + 相关计算胶囊 ——
  const CG2 = require(pathW.join(__dirname, 'miniprogram', 'utils', 'calc-groups.js'));
  const wkG = CG2.GROUPS.filter(function (g) { return g.id === 'wilkins'; })[0];
  check('Wilkins 计算器带分项评分表（4 项 × 2 块 + 1 条提示）', (wkG.blocks || []).length, 9, 0);
  check('Wilkins 字段按原始顺序（活动度 → 增厚 → 钙化 → 瓣下）',
    wkG.fields.map(function (f) { return f.n.replace(/^[①②③④] /, ''); }).join('/') ===
      '瓣叶活动度/瓣叶增厚/瓣叶钙化/瓣下增厚' ? 1 : 0, 1, 0);

  pgF.onLoad({ id: 'wilkins' });
  pgF.onShow();
  check('Wilkins 页渲染出 15 个说明块（9 条评分细则 + 6 条临床意义/参考标准/判读要点）', pgF.data.blocks.length, 15, 0);
  check('Wilkins 页说明块以「这个指标是干什么用的」开头',
    pgF.data.blocks[0].text.indexOf('这个指标是干什么用的') !== -1 ? 1 : 0, 1, 0);
  check('Wilkins 页含「参考标准 / 正常值」小节',
    pgF.data.blocks.some(function (b) { return b.text.indexOf('参考标准') !== -1; }) ? 1 : 0, 1, 0);
  check('Wilkins 页评分细则仍在说明之后',
    pgF.data.blocks.some(function (b) { return b.text.indexOf('① 瓣叶活动度') !== -1; }) ? 1 : 0, 1, 0);
  check('Wilkins 页末块提示不要倒推打分',
    pgF.data.blocks[pgF.data.blocks.length - 1].text.indexOf('倒推') !== -1 ? 1 : 0, 1, 0);

  // 二尖瓣页内嵌同一套评分
  pgF.onLoad({ id: 'mitral' });
  pgF.onShow();
  check('二尖瓣页内嵌 10 个输入（Wilkins 4 + MVA 4 + 压差/PASP 2）', pgF.data.inputs.length, 10, 0);
  check('二尖瓣页输入名带序号',
    pgF.data.inputs[0].name.indexOf('① 瓣叶活动度') !== -1 ? 1 : 0, 1, 0);
  check('二尖瓣页内含 4 张 Wilkins 分档表',
    pgF.data.blocks.filter(function (b) { return b.kind === 'table'; }).length >= 6 ? 1 : 0, 1, 0);
  pgF.data.inputs.forEach(function (r, i) { r.value = String(i === 0 ? 4 : 3); });
  pgF.refresh();
  check('二尖瓣页算 Wilkins：4+3+3+3 = 13 → 优先外科',
    /Wilkins 13\/16.*≥12.*外科/.test(pgF.data.out) ? 1 : 0, 1, 0);

  // PMBV 适合度流程：平均压差 + PASP + Wilkins 串成一条（v1.3.4）
  // 注意：每次显式给齐全部相关字段——早前测试往缓存里写过 mvd/mvlvti/mvmvti，
  // 不显式清掉会让连续性方程掺进来（SV = π×1.5²×3 ≈ 21 mL，MVA ≈ 7 cm²）。
  const setMit = function (kv) {
    pgF.onLoad({ id: 'mitral' });
    pgF.onShow();
    pgF.data.inputs.forEach(function (r) {
      r.value = kv[r.key] !== undefined ? String(kv[r.key]) : '';
    });
    pgF.refresh();
  };
  setMit({ wk1: 1, wk2: 2, wk3: 2, wk4: 2, mpht: 220, mgrad: 12, pasp: 55 });
  check('PMBV 流程：重度 MS + PASP >50 + Wilkins ≤8 → 理想候选',
    /PMBV 适合度：重度 MS \+ 形态适合/.test(pgF.data.out) ? 1 : 0, 1, 0);
  check('PMBV 流程：串出 ①严重度 ②后果 ③形态 与 TEE 排除项',
    /② 后果：PASP 55/.test(pgF.data.out) &&
      pgF.data.out.indexOf('TEE 排除左房血栓') !== -1 ? 1 : 0, 1, 0);
  setMit({ wk1: 4, wk2: 4, wk3: 4, wk4: 4, mpht: 220, mgrad: 12, pasp: 55 });
  check('PMBV 流程：Wilkins ≥12 → 优先外科',
    /形态不适合（Wilkins ≥12），优先外科换瓣/.test(pgF.data.out) ? 1 : 0, 1, 0);
  setMit({ wk1: 1, wk2: 1, wk3: 1, wk4: 1, mpht: 120, mgrad: 4, pasp: 28 });
  check('PMBV 流程：轻度 MS → 暂不考虑 PMBV',
    /暂不考虑 PMBV/.test(pgF.data.out) ? 1 : 0, 1, 0);
  setMit({ wk1: 2, wk2: 2, wk3: 2, wk4: 2, mgrad: 11, pasp: 52 });
  check('PMBV 流程：缺 MVA 时按压差定重度、并提示补面积',
    /重度 MS \+ 形态适合/.test(pgF.data.out) &&
      pgF.data.out.indexOf('未测 MVA，补一项面积确认') !== -1 ? 1 : 0, 1, 0);

  // 相关计算胶囊
  pgF.onLoad({ id: 'mitral' });
  pgF.onShow();
  const lastBlk = pgF.data.blocks[pgF.data.blocks.length - 1];
  check('二尖瓣页末块挂 2 个计算器胶囊（MVA 已合并）', (lastBlk.links || []).length, 2, 0);
  check('胶囊名称取自 calc-groups 标题',
    (lastBlk.links || []).some(function (l) { return l.n.indexOf('二尖瓣面积 MVA（两法对照）') !== -1; }) ? 1 : 0, 1, 0);
  check('胶囊 id 与标题一一对应（无 fallback 原名）',
    (lastBlk.links || []).every(function (l) { return l.n !== l.id; }) ? 1 : 0, 1, 0);
  navTo = null;
  pgF.onJump({ currentTarget: { dataset: { id: 'mva' } } });
  check('点胶囊 → navigateTo formula?id=mvav',
    navTo === '/pages/formula/formula?id=mva' ? 1 : 0, 1, 0);

  // —— v1.3.2 新增判读条目（舒张 / 肺高压 / BAV / DCM / 运动员）——
  const briefText = function (id) {
    pgF.onLoad({ id: id });
    pgF.onShow();
    return (pgF.data.blocks || []).map(function (b) {
      return (b.text || '') + (b.rows ? JSON.stringify(b.rows) : '');
    }).join(' ');
  };
  const dTxt = briefText('diastolic');
  check('舒张功能分级：六个基本量齐全',
    ['间隔 e′', '侧壁 e′', '平均 E/e′', 'LAVi', 'TR Vmax', 'LARS']
      .every(function (k) { return dTxt.indexOf(k) !== -1; }) ? 1 : 0, 1, 0);
  check('舒张功能分级：写明灰区不能定级', dTxt.indexOf('不能定级') !== -1 ? 1 : 0, 1, 0);
  check('舒张功能分级：覆盖房颤与二尖瓣病变的特殊处理',
    dTxt.indexOf('房颤') !== -1 && dTxt.indexOf('E/A 不可用') !== -1 ? 1 : 0, 1, 0);

  const phTxt = briefText('ph');
  check('肺高压：2022 新定义 mPAP >20', phTxt.indexOf('mPAP') !== -1 && phTxt.indexOf('>20') !== -1 ? 1 : 0, 1, 0);
  check('肺高压：三步法五档可能性', phTxt.indexOf('2.9–3.4') !== -1 && phTxt.indexOf('>3.4') !== -1 ? 1 : 0, 1, 0);
  check('肺高压：强调超声只给可能性、确诊需右心导管',
    phTxt.indexOf('右心导管') !== -1 ? 1 : 0, 1, 0);

  const bavTxt = briefText('bav');
  check('BAV：Sievers 0/1/2 型', ['0 型', '1 型', '2 型'].every(function (k) {
    return bavTxt.indexOf(k) !== -1;
  }) ? 1 : 0, 1, 0);
  check('BAV：强调短轴收缩期确认瓣叶数', bavTxt.indexOf('短轴收缩期') !== -1 ? 1 : 0, 1, 0);
  check('BAV：升主动脉手术阈值 ≥50 mm', bavTxt.indexOf('50 mm') !== -1 ? 1 : 0, 1, 0);
  check('BAV：一级亲属筛查', bavTxt.indexOf('一级亲属') !== -1 ? 1 : 0, 1, 0);

  const dcmTxt = briefText('dcm');
  check('DCM：缺血性 vs 非缺血性对照表', dcmTxt.indexOf('区域性') !== -1 && dcmTxt.indexOf('弥漫') !== -1 ? 1 : 0, 1, 0);
  check('DCM：列出六类可逆病因', dcmTxt.indexOf('心动过速性心肌病') !== -1 ? 1 : 0, 1, 0);
  check('DCM：与 LVNC 的三条标准区分', dcmTxt.indexOf('NC/C') !== -1 ? 1 : 0, 1, 0);

  const athTxt = briefText('athlete');
  check('运动员心脏：生理性三特征（可逆）', athTxt.indexOf('可逆') !== -1 ? 1 : 0, 1, 0);
  check('运动员心脏：13–16 mm 灰区声明', athTxt.indexOf('13–16 mm') !== -1 ? 1 : 0, 1, 0);
  check('运动员心脏：超声正常不能排除离子通道病',
    athTxt.indexOf('离子通道病') !== -1 ? 1 : 0, 1, 0);

  // 感染性心内膜炎：Duke-ISCVID 2023 标准（R49，v1.3.5 新增）
  const ieTxt = briefText('ie');
  check('IE：Duke-ISCVID 2023 主要标准 + 「新发」口径',
    ieTxt.indexOf('Duke-ISCVID 2023') !== -1 && ieTxt.indexOf('新发的瓣膜反流') !== -1 ? 1 : 0, 1, 0);
  check('IE：PET/CT 植入 >3 个月才算主要标准',
    ieTxt.indexOf('>3 个月才算') !== -1 ? 1 : 0, 1, 0);
  check('IE：确诊 / 可能 / 排除三档齐全',
    ['确诊 IE', '可能 IE', '排除 IE'].every(function (k) { return ieTxt.indexOf(k) !== -1; }) ? 1 : 0, 1, 0);
  check('IE：术中直视为 2023 新增主要标准',
    ieTxt.indexOf('术中直视（2023 新增）') !== -1 ? 1 : 0, 1, 0);

  // 超声造影 CEUS（R50 共识 + R51 技师指南，v1.3.6 新增）
  const ceTxt = briefText('contrast-echo');
  check('造影页：适应证限定 LVO / EBD',
    ceTxt.indexOf('LVO') !== -1 && ceTxt.indexOf('EBD') !== -1 ? 1 : 0, 1, 0);
  check('造影页：MI 分级齐全（<0.2 / <0.3 / 0.3–0.5 / >0.5）',
    ['< 0.2', '< 0.3', '0.3 – 0.5', '> 0.5'].every(function (k) { return ceTxt.indexOf(k) !== -1; }) ? 1 : 0, 1, 0);
  check('造影页：团注剂量（Definity 0.5 mL / Optison 0.3 mL）',
    ceTxt.indexOf('0.5 mL') !== -1 && ceTxt.indexOf('0.3 mL') !== -1 ? 1 : 0, 1, 0);
  check('造影页：EBD 增敏三招（加血 10% / 咳嗽 Valsalva / 股静脉）',
    ceTxt.indexOf('加血 10%') !== -1 && ceTxt.indexOf('股静脉') !== -1 ? 1 : 0, 1, 0);
  check('造影页：TEE 采集至少 10 个心动周期',
    ceTxt.indexOf('10 个心动周期') !== -1 ? 1 : 0, 1, 0);
  check('造影页：安全性数据（1/10,000 与 1/500,000）',
    ceTxt.indexOf('10,000') !== -1 && ceTxt.indexOf('500,000') !== -1 ? 1 : 0, 1, 0);
  check('造影页：肺动脉高压者需监护 30 分钟',
    ceTxt.indexOf('30 分钟') !== -1 ? 1 : 0, 1, 0);
  check('造影页：右向左分流为绝对禁忌（除非本次目的就是 EBD）',
    ceTxt.indexOf('右向左分流') !== -1 && ceTxt.indexOf('动脉内注射') !== -1 ? 1 : 0, 1, 0);
  // 参考文献挂 R50 / R51
  pgF.onLoad({ id: 'contrast-echo' });
  pgF.onShow();
  check('造影页：参考文献挂 R50 + R51',
    (pgF.data.refs || []).map(function (r) { return r.id; }).join(',') === 'R50,R51' ? 1 : 0, 1, 0);
  // 文献直链：R51 含中文 PDF
  const EXDCE = require(pathW.join(__dirname, 'miniprogram', 'utils', 'extra-data.js'));
  const R51dl = (EXDCE.REFS.filter(function (r) { return r.id === 'R51'; })[0].dl || []);
  check('R51 含 ASE 官方 PDF 与中文版 PDF 直链',
    R51dl.length === 2 && R51dl.some(function (d) { return /2014_Contrast-Sonography\.pdf$/.test(d.u); }) &&
      R51dl.some(function (d) { return /Chinese\.pdf$/.test(d.u) && d.t === '中文 PDF'; }) ? 1 : 0, 1, 0);
  check('R50 含 ASE 共识声明官方 PDF 直链',
    EXDCE.REFS.filter(function (r) { return r.id === 'R50'; })[0].dl.some(function (d) { return /Ultrasonic-Contrast-Agents/.test(d.u); }) ? 1 : 0, 1, 0);

  // 超声引导下有创操作（R52 指南，v1.3.7 新增）
  const eiTxt = briefText('echo-interv');
  check('介入页：12 类操作对照表含房间隔穿刺 / PMBV / 房间隔封堵 / LAA 封堵 / 活检',
    ['房间隔穿刺', 'PMBV', '房间隔封堵', 'LAA 封堵', '心肌与血管内活检'].every(function (k) { return eiTxt.indexOf(k) !== -1; }) ? 1 : 0, 1, 0);
  check('介入页：心包穿刺成功率 97% 与并发症率 1.2% / 3.2%',
    eiTxt.indexOf('97%') !== -1 && eiTxt.indexOf('1.2%') !== -1 && eiTxt.indexOf('3.2%') !== -1 ? 1 : 0, 1, 0);
  check('介入页：心包穿刺拔管标准 24 小时内 <25 mL',
    eiTxt.indexOf('25 mL') !== -1 ? 1 : 0, 1, 0);
  check('介入页：心肌活检可取右室心尖与游离壁',
    eiTxt.indexOf('右室心尖') !== -1 && eiTxt.indexOf('游离壁') !== -1 ? 1 : 0, 1, 0);
  check('介入页：ICE 风险含心包填塞与心脏穿孔',
    eiTxt.indexOf('心脏穿孔') !== -1 && eiTxt.indexOf('心包填塞') !== -1 ? 1 : 0, 1, 0);
  check('介入页：TEE 盲区（升主动脉 / 气管声影）',
    eiTxt.indexOf('TEE 盲区') !== -1 ? 1 : 0, 1, 0);
  check('介入页：酒精消融需术中超声造影定位穿支',
    eiTxt.indexOf('超声造影') !== -1 && eiTxt.indexOf('穿支') !== -1 ? 1 : 0, 1, 0);
  check('介入页：ICE 引导房间隔穿刺的帐篷征（tenting）',
    eiTxt.indexOf('帐篷') !== -1 ? 1 : 0, 1, 0);
  // 参考文献挂 R52
  pgF.onLoad({ id: 'echo-interv' });
  pgF.onShow();
  check('介入页：参考文献挂 R52',
    (pgF.data.refs || []).map(function (r) { return r.id; }).join(',') === 'R52' ? 1 : 0, 1, 0);
  const R52dl = (EXDCE.REFS.filter(function (r) { return r.id === 'R52'; })[0].dl || []);
  check('R52 含 ASE 官方 PDF 与中文版 PDF 直链',
    R52dl.length === 2 && R52dl.some(function (d) { return /2009_Echo-Guided-Interventions\.pdf$/.test(d.u); }) &&
      R52dl.some(function (d) { return /Chinese\.pdf$/.test(d.u) && d.t === '中文 PDF'; }) ? 1 : 0, 1, 0);

  // 超声伪影指南（R53，v1.3.9 新增）
  const agTxt = briefText('artifact-guide');
  check('伪影页：按机器假设分类的框架',
    ['混响', '镜像', '声影', '侧瓣', '混叠'].every(function (k) { return agTxt.indexOf(k) !== -1; }) ? 1 : 0, 1, 0);
  check('伪影页：升主动脉混响 44–55% 的发生率',
    agTxt.indexOf('44%') !== -1 && agTxt.indexOf('55%') !== -1 ? 1 : 0, 1, 0);
  check('伪影页：壁滤波 150 Hz / 350 Hz 参考值',
    agTxt.indexOf('150 Hz') !== -1 && agTxt.indexOf('350 Hz') !== -1 ? 1 : 0, 1, 0);
  check('伪影页：Nyquist 极限与 PW 混叠阈值',
    agTxt.indexOf('Nyquist') !== -1 && agTxt.indexOf('1.5') !== -1 ? 1 : 0, 1, 0);
  check('伪影页：侧瓣伪影的三条识别特征',
    agTxt.indexOf('对称') !== -1 && agTxt.indexOf('跨越解剖边界') !== -1 ? 1 : 0, 1, 0);
  check('伪影页：3D 单心动周期采集消除拼接伪影',
    agTxt.indexOf('单心动周期') !== -1 && agTxt.indexOf('拼接') !== -1 ? 1 : 0, 1, 0);
  check('伪影页：B 线来自 ring-down 而非混响',
    agTxt.indexOf('ring-down') !== -1 ? 1 : 0, 1, 0);
  pgF.onLoad({ id: 'artifact-guide' });
  pgF.onShow();
  check('伪影页：参考文献挂 R53',
    (pgF.data.refs || []).map(function (r) { return r.id; }).join(',') === 'R53' ? 1 : 0, 1, 0);
  check('R53 含 ASE 官方免费全文 PDF 直链',
    EXDCE.REFS.filter(function (r) { return r.id === 'R53'; })[0].dl.some(function (d) { return /PIIS0894731726000386\.pdf$/.test(d.u); }) ? 1 : 0, 1, 0);

  // 性别按 profile 预填（避免每次手点）
  gData23.profile.sex = 'female';
  delete gData23.calcCache.aortaz;
  pgF.onLoad({ id: 'aortaz' });
  pgF.onShow();
  check('女性 profile → Z 值页性别默认「女」', pgF.data.optsV.azsex === 'f' ? 1 : 0, 1, 0);
  gData23.profile.sex = 'male';
  delete gData23.calcCache.aortaz;
  pgF.onLoad({ id: 'aortaz' });
  pgF.onShow();
  check('男性 profile → Z 值页性别默认「男」', pgF.data.optsV.azsex === 'm' ? 1 : 0, 1, 0);
}

console.log('\n=== 24. 瓣膜解剖页（分区 / 分叶 / 分段示意图 + 教学资源）===');
{
  let navTo = null, clip = null;
  global.wx = {
    navigateTo(o) { navTo = o.url; },
    setNavigationBarTitle() {},
    setClipboardData(o) { clip = o.data; if (o.success) o.success(); },
    showToast() {},
  };
  global.getApp = () => ({ globalData: {} });
  let pgV = null;
  global.Page = (c) => { pgV = c; };
  const VS = require(pathW.join(__dirname, 'miniprogram', 'utils', 'valve-svg.js'));
  require(pathW.join(__dirname, 'miniprogram', 'pages', 'valveana', 'valveana.js'));
  pgV.setData = function (patch) {
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

  check('视图数 = 8（主动脉瓣 2 / 二尖瓣 3 / 三尖瓣 2 / 肺动脉瓣 1）', VS.VALVE_VIEWS.length, 8, 0);
  check('视图 id 齐全',
    VS.VALVE_VIEWS.map(function (v) { return v.id; }).join(',') ===
    'avTteSax,avTeeSax,mvArea,mvTteA4c,mvTeeCommissural,tvTte,tvSax,pv' ? 1 : 0, 1, 0);
  check('主动脉瓣 3 分区（rcc/lcc/ncc）', VS.AV_CUSPS.length, 3, 0);
  check('二尖瓣 6 分段（p1–p3/a1–a3）', VS.MV_SEGMENTS.length, 6, 0);
  check('三尖瓣 3 瓣叶', VS.TV_LEAFLETS.length, 3, 0);
  check('每个视图都绑定了渲染函数',
    VS.VALVE_VIEWS.every(function (v) { return typeof v.fn === 'function'; }) ? 1 : 0, 1, 0);
  check('8 张 SVG 全部无 NaN',
    VS.VALVE_VIEWS.every(function (v) { return v.fn({ sel: null }).indexOf('NaN') === -1; }) ? 1 : 0, 1, 0);
  check('每张 SVG 都含可点击分区标记',
    VS.VALVE_VIEWS.every(function (v) { return v.fn({ sel: null }).indexOf('data-part=') !== -1; }) ? 1 : 0, 1, 0);
  check('base64 编码无 NaN',
    VS.utf8ToBase64('<svg>').indexOf('NaN') === -1 ? 1 : 0, 1, 0);
  check('分区说明含名称与出现视图',
    VS.partInfoText('a2').indexOf('A2') !== -1 && VS.partInfoText('a2').indexOf('见于') !== -1 ? 1 : 0, 1, 0);

  // —— 页面 ——
  pgV.onLoad();
  check('页面按瓣膜分组（4 组）', pgV.data.groups.length, 4, 0);
  check('瓣膜解剖页不再单列教学资源（与切面学习/模拟器重复）',
    pgV.data.lessons === undefined ? 1 : 0, 1, 0);
  const allImgs = pgV.data.groups.reduce(function (n, g) { return n + g.views.length; }, 0);
  check('示意图条目 = 8', allImgs, 8, 0);
  check('示意图为 base64 data URI',
    pgV.data.groups[0].views[0].src.indexOf('data:image/svg+xml;base64,') === 0 ? 1 : 0, 1, 0);
  pgV.onPart({ currentTarget: { dataset: { p: 'rcc' } } });
  check('点击分区后选中', pgV.data.sel === 'rcc' ? 1 : 0, 1, 0);
  check('选中后有说明文字', pgV.data.selInfo.length > 0 ? 1 : 0, 1, 0);
  pgV.onPart({ currentTarget: { dataset: { p: 'rcc' } } });
  check('再次点击取消选中', pgV.data.sel === null ? 1 : 0, 1, 0);
  check('页面已移除教学资源点击处理', pgV.onLesson === undefined ? 1 : 0, 1, 0);
}

console.log(`\n${'='.repeat(46)}`);
console.log(`结果： ${pass} 通过 / ${fail} 失败`);
console.log('='.repeat(46) + '\n');
process.exit(fail > 0 ? 1 : 0);
