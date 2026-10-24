/**
 * valve-calc.js — 瓣膜页计算引擎（AS / AR / MS / MR / TR）
 *
 * 与 echo-calc.js 同一套约定：本文件为独立引擎，所有函数必须定义在文件末尾的
 * 导出语句之前（build-www.js 抽取源码时会在导出处截断，注释里不要出现该语句原文）。
 *
 * 分级阈值来源：
 *   AS：ASE/EACVI 2017 定量（Vmax / 平均压差 / AVA / AVAi / DVI）
 *   AR：ASE 2017 原生瓣膜反流定量（VC / PHT / RVol / RF / EROA）
 *   MS：默认 ESC/EACTS 2021 口径（MVA >1.5 轻、1.0–1.5 中、<1.0 重），
 *       同时给出 ACC/AHA 2020 对照（MVA ≤1.5 即重度、≤1.0 为极重度）；
 *       Hatle MVA = 220 / PHT
 *   MR：ASE 2017（VC / EROA / RVol / RF）+ dP/dt = 32000 / Δt
 *   TR：ASE 2017（VC / EROA / RVol，重度 RVol ≥45 mL）
 *   PASP = 4·TRV² + RAP；RAP 用 IVC 三分级（自主呼吸）
 * 本工具仅供速查与学习，阈值不能替代指南原文与临床判断。
 */

/* ────────── 基础工具 ────────── */

function isNum(x) {
  return typeof x === 'number' && isFinite(x);
}

function f1(x) { return Math.round(x * 10) / 10; }
function f2(x) { return Math.round(x * 100) / 100; }
function txt(x, d) {
  if (!isNum(x)) return '—';
  return Number(x).toFixed(d === undefined ? 2 : d);
}

/** 圆面积（瓣环横截面）cm²，d 单位 cm */
function csaOf(dCm) { return Math.PI * dCm * dCm / 4; }

/** 每搏量 mL = 面积 × VTI */
function svOf(dCm, vtiCm) { return csaOf(dCm) * vtiCm; }

/** PISA 血流量 mL/s = 2πr² × Va */
function pisaFlow(radiusCm, aliasVaCms) { return 2 * Math.PI * radiusCm * radiusCm * aliasVaCms; }

/** PISA 有效反流口面积 cm² = 流量 ÷ 反流峰速（cm/s） */
function pisaEroa(radiusCm, aliasVaCms, regVmS) { return pisaFlow(radiusCm, aliasVaCms) / (regVmS * 100); }

/** 反流量 mL = EROA × 反流 VTI */
function rvolOf(eroaCm2, regVtiCm) { return eroaCm2 * regVtiCm; }

/** dP/dt（mmHg/s）= 32000 ÷ Δt(ms) */
function dpdtOf(dtMs) { return 32000 / dtMs; }

/** RAP 估算（自主呼吸）：IVC ≤21 mm 且吸气塌陷 >50% → 3；>21 mm 且 ≤50% → 15；其余 8 */
function rapOf(ivcMm, collapse) {
  if (ivcMm <= 21 && collapse === 'yes') return 3;
  if (ivcMm > 21 && collapse === 'no') return 15;
  return 8;
}

/** RVSP / PASP = 4·V_TR² + RAP */
function paspOf(trVmS, rap) { return 4 * trVmS * trVmS + rap; }

/* ────────── 单项分级 ────────── */

const LEVEL_RANK = { none: 0, mild: 1, moderate: 2, severe: 3 };
const LEVEL_TEXT = { none: '不显著', mild: '轻度', moderate: '中度', severe: '重度' };

function lv(level) { return { level: level, text: LEVEL_TEXT[level] }; }

/* AS */
function gVmax(v) {
  if (v < 2.6) return lv('none');
  if (v <= 2.9) return lv('mild');
  if (v <= 3.9) return lv('moderate');
  return lv('severe');
}
function gMeanGrad(m) {
  if (m < 20) return lv('mild');
  if (m <= 39) return lv('moderate');
  return lv('severe');
}
function gAva(a) {
  if (a > 1.5) return lv('mild');
  if (a >= 1.0) return lv('moderate');
  return lv('severe');
}
function gAvai(a) {
  if (a > 0.85) return lv('mild');
  if (a >= 0.60) return lv('moderate');
  return lv('severe');
}
function gDvi(d) {
  if (d > 0.50) return lv('mild');
  if (d >= 0.25) return lv('moderate');
  return lv('severe');
}

/* AR */
function gArVc(c) {
  if (c < 0.3) return lv('mild');
  if (c <= 0.6) return lv('moderate');
  return lv('severe');
}
function gArPht(p) {
  if (p > 500) return lv('mild');
  if (p >= 200) return lv('moderate');
  return lv('severe');
}
function gArEroa(e) {
  if (e < 0.10) return lv('mild');
  if (e < 0.30) return lv('moderate');
  return lv('severe');
}
function gArRvol(v) {
  if (v < 30) return lv('mild');
  if (v < 60) return lv('moderate');
  return lv('severe');
}
function gRf(r) {
  if (r < 30) return lv('mild');
  if (r < 50) return lv('moderate');
  return lv('severe');
}

/* MS */
function gMsMva(a) {
  if (a > 1.5) return lv('none');
  if (a >= 1.0) return lv('moderate');
  return lv('severe');
}
function gMsMg(m) {
  if (m < 5) return lv('mild');
  if (m <= 10) return lv('moderate');
  return lv('severe');
}
function gMsPasp(p) {
  if (p < 30) return lv('mild');
  if (p <= 50) return lv('moderate');
  return lv('severe');
}
/**
 * MVA 的 ACC/AHA 2020 口径：≤1.5 cm² 直接算重度（≤1.0 为极重度）。
 * ★ 与 gMsMva（ESC/EACTS 2021：1.0–1.5 中度）差一级，这是国内医院互相看不懂报告的常见原因。
 * 返回 level 一律用 'severe'（不新增枚举，避免影响配色与汇总），靠 text 区分极重度。
 */
function gMsMvaAha(a) {
  if (a > 1.5) return { level: 'none', text: '未达重度' };
  if (a > 1.0) return { level: 'severe', text: '重度' };
  return { level: 'severe', text: '极重度' };
}

/* MR */
function gMrVc(c) {
  if (c < 0.3) return lv('mild');
  if (c < 0.7) return lv('moderate');
  return lv('severe');
}
function gMrEroa(e) {
  if (e < 0.20) return lv('mild');
  if (e < 0.40) return lv('moderate');
  return lv('severe');
}
function gMrRvol(v) {
  if (v < 30) return lv('mild');
  if (v < 60) return lv('moderate');
  return lv('severe');
}

/* TR */
function gTrVc(c) {
  if (c < 0.3) return lv('mild');
  if (c < 0.7) return lv('moderate');
  return lv('severe');
}
function gTrEroa(e) {
  if (e < 0.20) return lv('mild');
  if (e < 0.40) return lv('moderate');
  return lv('severe');
}
function gTrRvol(v) {
  if (v < 30) return lv('mild');
  if (v < 45) return lv('moderate');
  return lv('severe');
}
function gDpdt(v) {
  if (v < 800) return lv('severe');
  if (v <= 1000) return lv('moderate');
  return lv('none');
}

/* ────────── 行构造 ────────── */

function row(k, v, g) {
  return { k: k, v: v, tag: g ? g.text : '', level: g ? g.level : 'none' };
}

/** 汇总：最重等级 + 各级计数 */
function summarize(rows) {
  let worst = 'none';
  let nSev = 0;
  let nMod = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    // noSum：同一数值的另一套标准判读，只作对照，不参与「综合提示」的计数与定级
    if (!r.tag || r.noSum) continue;
    if (LEVEL_RANK[r.level] > LEVEL_RANK[worst]) worst = r.level;
    if (r.level === 'severe') nSev++;
    if (r.level === 'moderate') nMod++;
  }
  let text;
  if (worst === 'severe') text = '综合提示：达到重度区间（' + nSev + ' 项）';
  else if (worst === 'moderate') text = '综合提示：达到中度区间（' + nMod + ' 项）';
  else if (worst === 'mild') text = '综合提示：位于轻度区间';
  else text = '综合提示：未达到显著狭窄 / 反流区间';
  return { level: worst, summary: text, nSev: nSev, nMod: nMod };
}

/* ────────── 各瓣膜计算 ────────── */

function calcAs(v, bsa) {
  const rows = [];
  const notes = [];

  const hasLvot = isNum(v.lvotD) && v.lvotD > 0 && isNum(v.lvotVti);
  const sv = hasLvot ? svOf(v.lvotD, v.lvotVti) : null;
  if (sv !== null) rows.push(row('每搏量 SV（LVOT）', txt(sv, 1) + ' mL'));

  if (sv !== null && isNum(v.avVti) && v.avVti > 0) {
    const ava = sv / v.avVti;
    rows.push(row('AVA 连续方程', txt(ava, 2) + ' cm²', gAva(ava)));
    if (bsa > 0) rows.push(row('AVAi', txt(ava / bsa, 2) + ' cm²/m²', gAvai(ava / bsa)));
  }
  if (isNum(v.lvotVti) && isNum(v.avVti) && v.avVti > 0) {
    const dvi = v.lvotVti / v.avVti;
    rows.push(row('DVI（VTI 比值）', txt(dvi, 2), gDvi(dvi)));
  }
  if (isNum(v.lvotD) && isNum(v.lvotVmax) && isNum(v.avVmax) && v.avVmax > 0) {
    rows.push(row('AVA 峰速法', txt(csaOf(v.lvotD) * v.lvotVmax / v.avVmax, 2) + ' cm²'));
  }
  if (isNum(v.avVmax) && v.avVmax > 0) {
    rows.push(row('AV Vmax', txt(v.avVmax, 2) + ' m/s', gVmax(v.avVmax)));
    rows.push(row('峰值压差 4V²', txt(4 * v.avVmax * v.avVmax, 1) + ' mmHg'));
    if (v.avVmax >= 5) notes.push('Vmax ≥5 m/s：提示极重度狭窄。');
  }
  if (isNum(v.mg)) {
    rows.push(row('平均跨瓣压差', txt(v.mg, 1) + ' mmHg', gMeanGrad(v.mg)));
    if (v.mg >= 60) notes.push('平均压差 ≥60 mmHg：提示极重度狭窄。');
  }

  if (sv !== null && bsa > 0 && sv / bsa < 35) {
    notes.push('低流量：SVi ' + txt(sv / bsa, 1) + ' mL/m²（<35）—— AVA 可能低估，考虑低剂量多巴酚丁胺负荷与 CT 钙化评分。');
  }
  if (rows.length && !isNum(v.mg)) {
    notes.push('未填平均跨瓣压差：分级仅依据 AVA / AVAi / DVI / Vmax，建议补录压差并注明心率。');
  }
  return { rows: rows, notes: notes };
}

function calcAr(v, bsa) {
  const rows = [];
  const notes = [];
  let eroa = null;
  let rvol = null;

  if (isNum(v.radius) && isNum(v.aliasVa) && isNum(v.regV) && v.regV > 0) {
    rows.push(row('PISA 血流量', txt(pisaFlow(v.radius, v.aliasVa), 1) + ' mL/s'));
    eroa = pisaEroa(v.radius, v.aliasVa, v.regV);
    rows.push(row('EROA', txt(eroa, 2) + ' cm²', gArEroa(eroa)));
    if (isNum(v.regVti)) {
      rvol = rvolOf(eroa, v.regVti);
      rows.push(row('RVol', txt(rvol, 1) + ' mL', gArRvol(rvol)));
    } else {
      notes.push('未填反流 VTI：只得到 EROA，无法给出反流量与反流分数。');
    }
  }
  if (eroa !== null && rvol !== null && isNum(v.lvotD) && isNum(v.lvotVti)) {
    const sv = svOf(v.lvotD, v.lvotVti);
    if (sv > 0) {
      const rf = rvol / sv * 100;
      rows.push(row('反流分数 RF', txt(rf, 1) + '%', gRf(rf)));
    }
  }
  if (isNum(v.vc)) rows.push(row('缩流颈 VC', txt(v.vc, 2) + ' cm', gArVc(v.vc)));
  if (isNum(v.pht)) {
    rows.push(row('压力半降时间 PHT', txt(v.pht, 0) + ' ms', gArPht(v.pht)));
    notes.push('PHT 受主动脉 / 左室顺应性与血压影响，需结合 VC 与降主动脉反向血流。');
  }
  if (!rows.length) notes.push('填 PISA 半径 / 混叠速度 / 反流峰速即可得到 EROA；再填反流 VTI 得到 RVol。');
  return { rows: rows, notes: notes };
}

function calcMs(v) {
  const rows = [];
  const notes = [];
  let mvaLevelRow = null;
  let mvaVal = null;

  if (isNum(v.mvaPlani) && v.mvaPlani > 0) {
    mvaVal = v.mvaPlani;
    mvaLevelRow = row('MVA 直接描记（ESC/EACTS 2021）', txt(v.mvaPlani, 2) + ' cm²', gMsMva(v.mvaPlani));
    rows.push(mvaLevelRow);
  }
  if (isNum(v.pht) && v.pht > 0) {
    const mva = 220 / v.pht;
    const r = row('MVA · PHT 法（220÷PHT）', txt(mva, 2) + ' cm²', gMsMva(mva));
    rows.push(r);
    if (!mvaLevelRow) { mvaLevelRow = r; mvaVal = mva; }
    notes.push('PHT 法在球囊扩张后、顺应性异常、明显 AR 或高流量状态下不可靠。');
  }
  if (isNum(v.lvotD) && isNum(v.lvotVti) && isNum(v.mvVti) && v.mvVti > 0) {
    const mva = svOf(v.lvotD, v.lvotVti) / v.mvVti;
    const r = row('MVA 连续方程', txt(mva, 2) + ' cm²', gMsMva(mva));
    rows.push(r);
    if (!mvaLevelRow) { mvaLevelRow = r; mvaVal = mva; }
  }
  if (isNum(v.mg)) {
    rows.push(row('平均跨瓣压差', txt(v.mg, 1) + ' mmHg', gMsMg(v.mg)));
    notes.push('压差随心率与流量变化，报告需同时记录心率与心律。');
  }
  if (isNum(v.pasp)) rows.push(row('估测 PASP', txt(v.pasp, 1) + ' mmHg', gMsPasp(v.pasp)));
  if (isNum(mvaVal)) {
    const aha = gMsMvaAha(mvaVal);
    rows.push({
      k: '　↳ 同一 MVA · ACC/AHA 2020 判读',
      v: txt(mvaVal, 2) + ' cm²',
      tag: aha.text,
      level: aha.level,
      noSum: true,
    });
    notes.push('**两套标准差一级**：上表按 ESC/EACTS 2021 —— MVA 1.0–1.5 为中度、<1.0 为重度；'
      + 'ACC/AHA 2020 则把 **MVA ≤1.5 直接判为重度**（≤1.0 为极重度）。'
      + '国内医院两者都有人用，这就是「同一份报告，一家写中度、一家写重度」的来源。'
      + '报告里最好注明采用的是哪一套。');
  }
  if (!rows.length) notes.push('优先填 MVA 直接描记；无描记时可用 PHT（MVA = 220 ÷ PHT）或连续方程估算。');
  return { rows: rows, notes: notes };
}

function calcMr(v) {
  const rows = [];
  const notes = [];
  let eroa = null;
  let rvol = null;

  if (isNum(v.radius) && isNum(v.aliasVa) && isNum(v.regV) && v.regV > 0) {
    rows.push(row('PISA 血流量', txt(pisaFlow(v.radius, v.aliasVa), 1) + ' mL/s'));
    eroa = pisaEroa(v.radius, v.aliasVa, v.regV);
    rows.push(row('EROA', txt(eroa, 2) + ' cm²', gMrEroa(eroa)));
    if (isNum(v.regVti)) {
      rvol = rvolOf(eroa, v.regVti);
      rows.push(row('RVol', txt(rvol, 1) + ' mL', gMrRvol(rvol)));
    } else {
      notes.push('未填反流 VTI：无法给出反流量与反流分数。');
    }
  }
  if (eroa !== null && rvol !== null && isNum(v.lvotD) && isNum(v.lvotVti)) {
    const sv = svOf(v.lvotD, v.lvotVti);
    if (sv > 0) rows.push(row('反流分数 RF', txt(rvol / sv * 100, 1) + '%', gRf(rvol / sv * 100)));
  }
  if (isNum(v.vc)) rows.push(row('缩流颈 VC', txt(v.vc, 2) + ' cm', gMrVc(v.vc)));
  if (isNum(v.dt) && v.dt > 0) {
    const d = dpdtOf(v.dt);
    rows.push(row('dP/dt（1→3 m/s）', txt(d, 0) + ' mmHg/s', gDpdt(d)));
    notes.push('dP/dt >1000 提示左室收缩功能尚可，<800 mmHg/s 提示收缩功能受损；受负荷与频谱质量影响。');
  }
  if (eroa !== null && (eroa >= 0.30 || (rvol !== null && rvol >= 45))) {
    notes.push('EROA / RVol 已进入继发 MR 也具有预后意义的区间（EROA ≥0.30 cm² 和/或 RVol ≥45 mL），需与心衰治疗、CRT 评估及团队决策结合。');
  }
  notes.push('继发 MR 反流口常呈椭圆形且随负荷变化，PISA 可能低估，应结合肺静脉血流与 CW 频谱形态。');
  if (!rows.length) notes.push('填 PISA 半径 / 混叠速度 / 反流峰速即可得到 EROA。');
  return { rows: rows, notes: notes };
}

function calcTr(v, collapse) {
  const rows = [];
  const notes = [];
  let eroa = null;
  let rvol = null;

  if (isNum(v.radius) && isNum(v.aliasVa) && isNum(v.regV) && v.regV > 0) {
    rows.push(row('PISA 血流量', txt(pisaFlow(v.radius, v.aliasVa), 1) + ' mL/s'));
    eroa = pisaEroa(v.radius, v.aliasVa, v.regV);
    rows.push(row('EROA', txt(eroa, 2) + ' cm²', gTrEroa(eroa)));
    if (isNum(v.regVti)) {
      rvol = rvolOf(eroa, v.regVti);
      rows.push(row('RVol', txt(rvol, 1) + ' mL', gTrRvol(rvol)));
    } else {
      notes.push('未填反流 VTI：TR 分级需要 RVol（重度界值 ≥45 mL）。');
    }
  }
  if (isNum(v.vc)) rows.push(row('缩流颈 VC', txt(v.vc, 2) + ' cm', gTrVc(v.vc)));

  let rap = null;
  if (isNum(v.ivc)) {
    rap = rapOf(v.ivc, collapse);
    rows.push(row('RAP 估测（IVC 法）', rap + ' mmHg'));
    if (collapse === '') notes.push('未选择 IVC 吸气塌陷：RAP 按 8 mmHg 估算；机械通气时不可套用。');
  }
  if (isNum(v.trV) && v.trV > 0) {
    rows.push(row('TR 峰值压差 4V²', txt(4 * v.trV * v.trV, 1) + ' mmHg'));
    if (rap !== null) rows.push(row('PASP ≈ 4V² + RAP', txt(paspOf(v.trV, rap), 1) + ' mmHg'));
    else notes.push('填 IVC 内径可得 RAP，从而估算 PASP。');
  }
  notes.push('显著 TR 可能低估 TR 压差，需结合右室大小与功能、右房面积、IVC 及肝静脉血流。');
  if (!rows.length) notes.push('填 PISA 参数可做 TR 定量；TR 峰速 + IVC 可估算 PASP。');
  return { rows: rows, notes: notes };
}

/* ────────── 统一入口 ────────── */

/**
 * @param {string} id  as | ar | ms | mr | tr
 * @param {object} v   输入值字典（数值，ivcCollapse 为 'yes'|'no'|''）
 * @param {number} bsa 体表面积，可为 0
 * @returns {{rows:Array, notes:Array, level:string, summary:string}}
 */
function valveCalc(id, v, bsa) {
  const inputs = v || {};
  const area = bsa > 0 ? bsa : 0;
  let out;
  if (id === 'as') out = calcAs(inputs, area);
  else if (id === 'ar') out = calcAr(inputs, area);
  else if (id === 'ms') out = calcMs(inputs, area);
  else if (id === 'mr') out = calcMr(inputs, area);
  else if (id === 'tr') out = calcTr(inputs, inputs.ivcCollapse || '');
  else return { rows: [], notes: [], level: 'none', summary: '' };

  const s = summarize(out.rows);
  return {
    rows: out.rows,
    notes: out.notes,
    level: s.level,
    summary: out.rows.length ? s.summary : '等待输入',
  };
}

module.exports = {
  valveCalc,
  csaOf,
  svOf,
  pisaFlow,
  pisaEroa,
  rvolOf,
  dpdtOf,
  rapOf,
  paspOf,
  gVmax,
  gMeanGrad,
  gAva,
  gAvai,
  gDvi,
  gArVc,
  gArPht,
  gArEroa,
  gArRvol,
  gRf,
  gMsMva,
  gMsMg,
  gMsPasp,
  gMrVc,
  gMrEroa,
  gMrRvol,
  gTrVc,
  gTrEroa,
  gTrRvol,
  gDpdt,
  LEVEL_TEXT,
  LEVEL_RANK,
};
