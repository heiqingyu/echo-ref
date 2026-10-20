/**
 * echo-calc.js — 其他血流动力学与瓣膜计算引擎
 *
 * 公式来源（与 TTE 速查工具核对，2026-09 版）：
 *   CSA = π·d²/4                 标准几何公式
 *   SV  = CSA × VTI              连续方程（ASE）
 *   CO  = SV × HR / 1000
 *   Qp/Qs = (π·d_RVOT²/4 × VTI_RVOT) / SV
 *   ΔP  = 4 × (V₂² − V₁²)        简化伯努利方程
 *   AVA = SV / VTI_AV            连续方程法
 *   AVA(峰速法) = CSA_LVOT × Vmax_LVOT / Vmax_AV
 *   DVI = VTI_LVOT / VTI_AV
 *   MVA = 220 / PHT              Hatle 经验公式
 *   MVA(连续方程) = SV / VTI_MV
 *   PISA: 流量 = 2π·r²·Va；EROA = 流量 / V_reg(cm/s)；RVol = EROA × VTI_reg
 *   dP/dt = 32000 / Δt(ms)      （MR 频谱 1→3 m/s）
 *   LAVI / RAVI = 容积 / BSA
 *   RAP: IVC ≤21mm 且吸气塌陷>50% → 3；>21mm 且塌陷≤50% → 15；其余 → 8 mmHg（ASE）
 *   PASP = 4·V_TR² + RAP；PADP = 4·V_PR舒张末² + RAP
 *   PVR ≈ 10 × V_TR / VTI_RVOT + 0.16 （Abbas 经验公式，WU）
 *   FAC = (EDA − ESA) / EDA × 100%
 *
 * 分级阈值（ASE/EACVI 2015，ESC/ERS 2022）：
 *   AVA  重度≤1.0 中度1.0–1.5 轻度>1.5 cm²
 *   MVA  重度≤1.0 中度1.0–1.5 轻度>1.5 cm²
 *   EROA(MR) 重度≥0.40 中度0.20–0.39 轻度<0.20 cm²
 *   RVol(MR) 重度≥60 中度30–59 轻度<30 mL
 *   SVi 低<35 mL/m²；CI 正常 2.5–4.2 L/min/m²；CO 正常 4–8 L/min
 *   FAC 正常>35%；右室 S′ 正常>9.5 cm/s；dP/dt 正常>1000，<800 减低 mmHg/s
 *   LAVI 正常≤34 mL/m²；E/e′ <8 正常，>14 左房压升高
 */

/** 圆面积（瓣环横截面积）cm²，d 单位 cm */
function csaFromDiameter(dCm) {
  return Math.PI * dCm * dCm / 4;
}

/** 每搏量 mL：SV = CSA × VTI */
function strokeVolume(dCm, vtiCm) {
  return csaFromDiameter(dCm) * vtiCm;
}

/** 心排量 L/min */
function cardiacOutput(svMl, hr) {
  return svMl * hr / 1000;
}

/** 简化伯努利压差 mmHg；v1 缺省按 0 处理 */
function bernoulli(v2, v1) {
  const v1s = (v1 === undefined || v1 === null) ? 0 : v1;
  return 4 * (v2 * v2 - v1s * v1s);
}

/** 连续方程法 AVA cm² */
function avaContinuity(svMl, avVtiCm) {
  return svMl / avVtiCm;
}

/** 峰速法 AVA cm²（需 LVOT 内径、LVOT 峰速、AV 峰速） */
function avaPeak(lvotD, lvotVmax, avVmax) {
  return csaFromDiameter(lvotD) * lvotVmax / avVmax;
}

/** AVA 分级（cm²） */
function gradeAva(ava) {
  if (ava <= 1.0) return { level: 'severe', text: '重度狭窄' };
  if (ava <= 1.5) return { level: 'moderate', text: '中度狭窄' };
  return { level: 'normal', text: '轻度/无狭窄' };
}

/** PHT 法 MVA cm² */
function mvaPht(phtMs) {
  return 220 / phtMs;
}

/** 连续方程法 MVA cm² */
function mvaContinuity(svMl, mvVtiCm) {
  return svMl / mvVtiCm;
}

/** MVA 分级（cm²） */
function gradeMva(mva) {
  if (mva <= 1.0) return { level: 'severe', text: '重度狭窄' };
  if (mva <= 1.5) return { level: 'moderate', text: '中度狭窄' };
  return { level: 'normal', text: '轻度/无狭窄' };
}

/**
 * PISA 法二尖瓣反流：流量、EROA、RVol
 * radius cm；aliasVa cm/s；regV m/s（内部转 cm/s）；regVti cm
 */
function pisa(radiusCm, aliasVa, regV, regVtiCm) {
  const flow = 2 * Math.PI * radiusCm * radiusCm * aliasVa; // mL/s
  const eroa = flow / (regV * 100);                          // cm²
  const out = { flow, eroa };
  if (regVtiCm !== undefined && regVtiCm !== null) out.rvol = eroa * regVtiCm;
  return out;
}

/** EROA 分级（孤立 MR，cm²） */
function gradeEroa(eroa) {
  if (eroa >= 0.40) return { level: 'severe', text: '重度反流' };
  if (eroa >= 0.20) return { level: 'moderate', text: '中度反流' };
  return { level: 'normal', text: '轻度反流' };
}

/** 反流量分级（孤立 MR，mL） */
function gradeRvol(rvol) {
  if (rvol >= 60) return { level: 'severe', text: '重度反流' };
  if (rvol >= 30) return { level: 'moderate', text: '中度反流' };
  return { level: 'normal', text: '轻度反流' };
}

/** MR 频谱 dP/dt：32000 / Δt(ms)，单位 mmHg/s */
function dpdt(dtMs) {
  return 32000 / dtMs;
}

function gradeDpdt(v) {
  if (v < 800) return { level: 'severe', text: '减低' };
  if (v <= 1000) return { level: 'moderate', text: '临界' };
  return { level: 'normal', text: '正常' };
}

/** 心房容积指数 mL/m² */
function atrialIndex(volMl, bsa) {
  return volMl / bsa;
}

/**
 * RAP 估算（ASE 三分级，仅自主呼吸）
 * ivcMm：IVC 内径 mm；collapse：'yes'(>50%) | 'no'(≤50%) | ''(未知)
 */
function rapFromIvc(ivcMm, collapse) {
  if (ivcMm <= 21 && collapse === 'yes') return 3;
  if (ivcMm > 21 && collapse === 'no') return 15;
  return 8;
}

/** PASP = 4·V_TR² + RAP（无 RVOT/肺动脉瓣梗阻前提） */
function pasp(trV, rap) {
  return 4 * trV * trV + rap;
}

/** PADP = 4·V_PR舒张末² + RAP */
function padp(prEndV, rap) {
  return 4 * prEndV * prEndV + rap;
}

/** PVR 经验估算（Abbas）：10 × V_TR / VTI_RVOT + 0.16，单位 Wood */
function pvrEstimate(trV, rvotVti) {
  return 10 * trV / rvotVti + 0.16;
}

/** PH 超声概率（ESC/ERS 2022 三联策略简化） */
function phProbability(trV, hasSigns) {
  // hasSigns：true 有至少两类支持征象 / false 无 / null 未评估
  if (trV > 3.4) return '高';
  if (hasSigns === true) {
    return trV > 2.8 ? '高' : '中';
  }
  if (hasSigns === false) {
    return trV > 2.8 ? '中' : '低';
  }
  return '待补充支持征象';
}

/** 右室面积变化分数 FAC % */
function fac(eda, esa) {
  return (eda - esa) / eda * 100;
}

/**
 * 舒张功能基础比值
 * e/a：E/A；avgEe：平均 E/e′ = E / ((间隔e′+侧壁e′)/2)
 */
function diastolicRatios(e, a, eSep, eLat) {
  const out = {};
  if (e !== null && a !== null && a > 0) out.ea = e / a;
  if (e !== null && eSep !== null && eLat !== null) {
    const avg = (eSep + eLat) / 2;
    if (avg > 0) out.avgEe = e / avg;
  }
  return out;
}

function gradeEe(v) {
  if (v > 14) return { level: 'severe', text: '左房压升高' };
  if (v < 8) return { level: 'normal', text: '左房压正常' };
  return { level: 'moderate', text: '灰区' };
}

/**
 * 右室-肺动脉耦联：TAPSE / PASP（mm/mmHg）
 *
 * 把「右室收缩功能」与「右室面对的肺动脉负荷」放进同一个比值：
 * 负荷升高但收缩功能代偿时比值可维持；一旦失耦联即提示右室储备耗竭。
 * 常用切点（Guazzi 2013；Tello 等在 PAH 队列中的验证）：
 *   ≥0.55 保留耦联；0.36–0.55 临界（早期失耦联）；<0.36 显著失耦联、预后差。
 *
 * @param {number} tapseMm TAPSE，单位 mm
 * @param {number} paspMmhg PASP，单位 mmHg
 */
function tapsePasp(tapseMm, paspMmhg) {
  if (!(tapseMm > 0) || !(paspMmhg > 0)) return {};
  const ratio = tapseMm / paspMmhg;
  let level, text;
  if (ratio >= 0.55) { level = 'normal'; text = '耦联保留'; }
  else if (ratio >= 0.36) { level = 'moderate'; text = '临界 / 早期失耦联'; }
  else { level = 'severe'; text = '显著失耦联（预后差）'; }
  return { ratio: ratio, level: level, text: text };
}

/**
 * 左室充盈压综合判读（2016 ASE/EACVI 简化路径）
 *
 * 只用「E/A + 三个升高指标（平均 E/e′、LAVi、TR Vmax）」给出分级，
 * 不输入 E 波减速时间与肺静脉频谱，故为简化版，灰区必须结合临床。
 *
 * @param {object} o {e,a,es,el,lavi,trv} 缺省项传 null / undefined
 */
function lvFilling(o) {
  const r = { crit: [] };
  const e = o.e, a = o.a, es = o.es, el = o.el;
  if (e !== null && e !== undefined && a !== null && a !== undefined && a > 0) r.ea = e / a;
  if (e !== null && e !== undefined && es !== null && es !== undefined &&
      el !== null && el !== undefined) {
    const avg = (es + el) / 2;
    if (avg > 0) r.avgEe = e / avg;
  }
  if (r.avgEe !== undefined && r.avgEe > 14) r.crit.push('平均 E/e′ >14');
  if (o.lavi !== null && o.lavi !== undefined && o.lavi > 34) r.crit.push('LAVi >34');
  if (o.trv !== null && o.trv !== undefined && o.trv > 2.8) r.crit.push('TR Vmax >2.8');
  r.count = r.crit.length;

  let grade = null;
  if (r.ea !== undefined) {
    if (r.ea >= 2) grade = 3;
    else if (r.ea <= 0.8) {
      const eeR = r.avgEe !== undefined && r.avgEe > 8;
      grade = (eeR || r.count >= 2) ? 2 : 1;
    } else {
      grade = r.count === 0 ? 0 : r.count === 1 ? 1 : r.count === 2 ? 2 : 3;
    }
  } else if (r.avgEe !== undefined) {
    grade = r.avgEe > 14 ? 2 : 0;
  }
  r.grade = grade;
  if (grade !== null) {
    r.text = ['正常充盈', 'Ⅰ级（松弛受损）', 'Ⅱ级（假性正常化）', 'Ⅲ级（限制性）'][grade];
  }
  return r;
}

/** 保留小数（dec 缺省 2 位） */
function round(n, dec) {
  const p = Math.pow(10, dec === undefined ? 2 : dec);
  return Math.round(n * p) / p;
}

/** 格式化：非法值返回 '—' */
function fmt(n, dec) {
  if (n === undefined || n === null || !isFinite(n)) return '—';
  return Number(n).toFixed(dec === undefined ? 2 : dec);
}

module.exports = {
  csaFromDiameter,
  strokeVolume,
  cardiacOutput,
  bernoulli,
  avaContinuity,
  avaPeak,
  gradeAva,
  mvaPht,
  mvaContinuity,
  gradeMva,
  pisa,
  gradeEroa,
  gradeRvol,
  dpdt,
  gradeDpdt,
  atrialIndex,
  rapFromIvc,
  pasp,
  padp,
  pvrEstimate,
  phProbability,
  fac,
  diastolicRatios,
  gradeEe,
  tapsePasp,
  lvFilling,
  round,
  fmt,
};

