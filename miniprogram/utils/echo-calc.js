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

/**
 * 主动脉瓣狭窄「低流量低压差（LF-LG）」专项判读
 *
 * 判定链路：先看流量（SVi ≤35 mL/m² 为低流量）→ 再看压差（mPG <40 mmHg 为低压差）
 * → 最后看 AVA 是否 ≤1.0 cm²（否则不满足重度形态学标准）。
 * 三者同时成立才是 LF-LG AS，再按 LVEF 分经典型（<50%）与反常型（≥50%）。
 * 若提供负荷后数据（SVi / AVA），按 SV 增幅与 AVA 变化区分真性 / 假性重度。
 *
 * @param {object} o {lvef, svi, mpg, ava, dsvi, dava} 可选项传 undefined
 */
function asLflg(o) {
  const r = {};
  const lvef = o.lvef, svi = o.svi, mpg = o.mpg, ava = o.ava;
  const dsvi = o.dsvi, dava = o.dava;

  if (svi > 0) r.lowFlow = svi <= 35;
  if (mpg > 0) r.lowGrad = mpg < 40;
  if (ava > 0) r.severeAva = ava <= 1.0;

  if (r.lowFlow && r.lowGrad && r.severeAva) {
    r.type = (lvef > 0 && lvef < 50) ? 'classic' : 'paradoxical';
    r.text = r.type === 'classic'
      ? '经典低流量低压差重度 AS（LVEF<50%）'
      : '反常低流量低压差重度 AS（LVEF≥50%）';
  } else if (r.severeAva) {
    r.text = r.lowGrad
      ? 'AVA 达重度但压差偏低：流量正常时先复核 SV 与 AVA 测量'
      : '重度 AS（流量与压差一致）';
  } else if (r.severeAva === false) {
    r.text = 'AVA >1.0 cm²，未达重度形态学标准';
  }

  // 负荷试验（多巴酚丁胺或流量负荷）
  if (dsvi > 0 && svi > 0) {
    r.flowReserve = dsvi / svi;
    r.hasReserve = r.flowReserve >= 1.2;
    if (dava > 0) {
      if (r.hasReserve && dava > 1.0) r.dse = '假性重度（负荷后 AVA >1.0 cm²）';
      else if (r.hasReserve) r.dse = '真性重度（负荷后 AVA 仍 ≤1.0 cm²，且有收缩储备）';
      else r.dse = '无收缩储备 + AVA 不增：真性重度可能性大，手术风险高';
    } else {
      r.dse = r.hasReserve
        ? '有收缩储备（SV 增幅 ≥20%），需结合负荷后 AVA 判断'
        : '无收缩储备（SV 增幅 <20%）：真性重度可能性大';
    }
  }
  return r;
}

/**
 * 右室功能分级（ASE 2015 六指标积分法）
 *
 * 每项异常记 1 分：RV 基底径 >41 mm、RV 长径 >83 mm、FAC <35%、
 * TAPSE <17 mm、S′ <9.5 cm/s、3D RVEF <45%。
 * 合计 0 分正常；1–2 分轻度；3–4 分中度；≥5 分重度。
 * 缺项不扣分，只按实际提供的项计分（n 为参与评估的项数）。
 */
function rvFuncScore(o) {
  const items = [];
  const add = (name, val, bad) => {
    if (val > 0) items.push({ name: name, bad: bad });
  };
  add('RV 基底径 >41 mm', o.rvbase, o.rvbase > 41);
  add('RV 长径 >83 mm', o.rvlen, o.rvlen > 83);
  add('FAC <35%', o.fac, o.fac < 35);
  add('TAPSE <17 mm', o.tapse, o.tapse < 17);
  add('S′ <9.5 cm/s', o.rvs, o.rvs < 9.5);
  add('3D RVEF <45%', o.rvef, o.rvef < 45);

  const bad = items.filter(function (i) { return i.bad; }).length;
  const r = { score: bad, n: items.length, items: items };
  if (items.length) {
    r.grade = bad === 0 ? 0 : bad <= 2 ? 1 : bad <= 4 ? 2 : 3;
    r.text = ['功能正常', '轻度功能障碍', '中度功能障碍', '重度功能障碍'][r.grade];
  }
  return r;
}

/**
 * 缩窄性心包炎 vs 限制型心肌病：呼吸变异量化
 *
 * 缩窄的核心是「心腔充盈受外部心包约束，随胸腔内压周期性改变」，
 * 因此血流速度的呼吸变异幅度远大于限制型心肌病（后者是心肌本身舒张受限，
 * 心腔间相互制约不明显）。三项阳性支持缩窄、零阳性支持限制型。
 *
 * 变异率定义（都要带符号看，方向反了说明取错了呼吸时相）：
 *   二尖瓣 E 变异 = (呼气 − 吸气) / 呼气 × 100%，正常吸气时轻度下降
 *   三尖瓣 E 变异 = (吸气 − 呼气) / 呼气 × 100%，正常吸气时上升
 *
 * @param {object} o {mvex, mvinsp, tvex, tvinsp, medee}
 */
function cpRm(o) {
  const r = { feats: [] };
  if (o.mvex > 0 && o.mvinsp >= 0) {
    r.mvVar = (o.mvex - o.mvinsp) / o.mvex * 100;
    if (Math.abs(r.mvVar) > 25) r.feats.push('二尖瓣 E 呼吸变异 >25%');
  }
  if (o.tvex > 0 && o.tvinsp >= 0) {
    r.tvVar = (o.tvinsp - o.tvex) / o.tvex * 100;
    if (Math.abs(r.tvVar) > 40) r.feats.push('三尖瓣 E 呼吸变异 >40%');
  }
  if (o.medee > 0) {
    if (o.medee < 8) r.feats.push('间隔 E/e′ <8（瓣环矛盾）');
    else if (o.medee > 14) r.feats.push('间隔 E/e′ >14（不支持缩窄）');
  }

  r.score = r.feats.filter(function (f) { return f.indexOf('不支持') < 0; }).length;
  const n = (r.mvVar !== undefined ? 1 : 0) + (r.tvVar !== undefined ? 1 : 0) +
    (o.medee > 0 ? 1 : 0);
  if (n) {
    if (r.score >= 2) r.text = '支持缩窄性心包炎';
    else if (r.score === 0) r.text = '支持限制型心肌病';
    else r.text = '证据不足：需结合心包厚度 / 钙化、室间隔抖动与右心导管';
  }
  return r;
}

/**
 * HFA-PEFF 诊断算法·超声部分计分（2019 ESC HFA）
 *
 * 分「形态学」「生物标志物」「功能」三大类，每类内部各项取最高分（不累加），
 * 三类分数相加得 0–6 分。负荷试验不在本函数内。
 *   形态学：LAVi、LVMI（按性别）、RWT
 *   生物标志物：NT-proBNP（窦性心律阈值；房颤阈值更高，见条目说明）
 *   功能：  平均 E/e′、TR Vmax、静息左房储备应变 LASr、GLS 绝对值
 *
 * 判读：≥5 确诊 HFpEF；2–4 需进一步（负荷试验）；≤1 可排除。
 *
 * @param {object} o {lavi, lvmi, female, rwt, ntp, ee, trv, lasr, gls}
 */
function hfaPeff(o) {
  const pick = (v, t1, t2, lowerIsBad) => {
    if (!(v > 0)) return 0;
    if (lowerIsBad) {
      if (v < t2) return 2;
      if (v < t1) return 1;
      return 0;
    }
    if (v >= t2) return 2;
    if (v >= t1) return 1;
    return 0;
  };

  // 形态学（取最高一项）
  const morCand = [];
  if (o.lavi > 0) morCand.push(['LAVi', pick(o.lavi, 34, 40)]);
  if (o.lvmi > 0) {
    morCand.push(['LVMI', o.female ? pick(o.lvmi, 95, 122) : pick(o.lvmi, 115, 149)]);
  }
  if (o.rwt > 0) morCand.push(['RWT', pick(o.rwt, 0.42, 0.55)]);

  // 功能（取最高一项）
  const funCand = [];
  if (o.ee > 0) funCand.push(['平均 E/e′', pick(o.ee, 9, 13)]);
  if (o.trv > 0) funCand.push(['TR Vmax', pick(o.trv, 2.8, 3.4)]);
  if (o.lasr > 0) funCand.push(['静息 LASr', pick(o.lasr, 29, 18, true)]);
  if (o.gls !== undefined && o.gls !== null && o.gls < 0) {
    funCand.push(['GLS', pick(Math.abs(o.gls), 16, 12, true)]);
  }

  // 生物标志物（NT-proBNP，窦性心律阈值）
  const bioCand = [];
  if (o.ntp > 0) bioCand.push(['NT-proBNP', pick(o.ntp, 125, 220)]);

  const top = (arr) => {
    let s = 0, n = '';
    arr.forEach(function (x) { if (x[1] > s) { s = x[1]; n = x[0]; } });
    return { score: s, name: n };
  };
  const m = top(morCand), b = top(bioCand), f = top(funCand);
  const r = {
    morph: m.score, bio: b.score, func: f.score,
    total: m.score + b.score + f.score,
    morphName: m.name, bioName: b.name, funcName: f.name,
    n: morCand.length + bioCand.length + funCand.length,
  };
  if (r.n) {
    r.text = r.total >= 5 ? '确诊 HFpEF'
      : r.total >= 2 ? '需进一步：负荷试验 / 侵入性血流动力学'
      : '可排除 HFpEF';
  }
  return r;
}

/**
 * Duke 运动平板评分（与负荷超声配合使用）
 *
 * 评分 = 运动时间（min）− 5 × ST 段偏移（mm）− 4 × 心绞痛指数
 * 心绞痛指数：0 无 / 1 非限制造胸痛 / 2 限制造胸痛
 *
 * 判读：≥5 低危；−10 至 4 中危；≤−11 高危。
 *
 * @param {object} o {time, stDev, angina}
 */
function dukeScore(o) {
  if (!(o.time > 0)) return {};
  const st = o.stDev > 0 ? o.stDev : 0;
  const ai = (o.angina >= 0 && o.angina <= 2) ? o.angina : 0;
  const score = o.time - 5 * st - 4 * ai;
  let level, text;
  if (score >= 5) { level = 'low'; text = '低危'; }
  else if (score > -11) { level = 'mid'; text = '中危'; }
  else { level = 'high'; text = '高危'; }
  return { score: score, level: level, text: text };
}

/**
 * 三尖瓣反流五级分级（Hahn / TVARC）
 *
 * 按 EROA 与 RVol 各自归档后取较重的一档：
 *   轻度 <20 mm² / <30 mL；中度 20–29 / 30–44；重度 30–39 / 45–59；
 *   极重（massive）40–59 / 60–89；瀑布型（torrential）≥60 / ≥90。
 *
 * @param {number} eroa 有效反流口面积，mm²
 * @param {number} rvol 反流量，mL
 */
function trGrade(eroa, rvol) {
  const band = (v, cuts) => {
    if (!(v > 0)) return -1;
    for (let i = 0; i < cuts.length; i += 1) if (v < cuts[i]) return i;
    return cuts.length;
  };
  const a = band(eroa, [20, 30, 40, 60]);
  const b = band(rvol, [30, 45, 60, 90]);
  const g = Math.max(a, b);
  if (g < 0) return {};
  const names = ['轻度', '中度', '重度', '极重（massive）', '瀑布型（torrential）'];
  return { grade: g, text: names[g], byEroa: a, byRvol: b };
}

/* ============================================================
 * 以下为 v1.0.9 新增：容积 / 质量 / 长轴 / MPI / DVI / mPAP / CTRCD
 * ============================================================ */

/**
 * 左室容积与射血分数（Simpson 双平面法）
 *
 * EF = (EDV − ESV) / EDV × 100%；SV = EDV − ESV。
 * 有 BSA 时同出 SVi 与 ESVi（ESVi 是 HFrEF 预后与 ICD 指征的关键量）。
 *
 * @param {number} edv 舒张末容积，mL
 * @param {number} esv 收缩末容积，mL
 * @param {number} bsa 体表面积，m²（可缺省）
 */
function lvEf(edv, esv, bsa) {
  if (!(edv > 0) || !(esv >= 0)) return {};
  if (esv >= edv) return { error: 'ESV 不能大于或等于 EDV，请核对描迹' };
  const sv = edv - esv;
  const ef = (sv / edv) * 100;
  const r = { ef: ef, sv: sv, edv: edv, esv: esv };
  if (bsa > 0) {
    r.svi = sv / bsa;
    r.esvi = esv / bsa;
  }
  if (ef >= 55) r.text = '收缩功能正常（HFpEF 区间需结合充盈压）';
  else if (ef >= 50) r.text = '轻度减低（50–54%，已属轻度异常）';
  else if (ef >= 40) r.text = '中度减低（HFmrEF 区间）';
  else if (ef >= 30) r.text = '重度减低（HFrEF）';
  else r.text = '极重度减低（<30%，ICD / CRT 评估指征）';
  return r;
}

/**
 * 左室质量与几何构型（ASE 校正公式）
 *
 * LV Mass = 0.8 × 1.04 × [(LVIDd + IVSd + LVPWd)³ − LVIDd³] + 0.6
 * RWT = 2 × LVPWd / LVIDd；RWT > 0.42 为向心性几何。
 *
 * 构型四分法（LVMI 升高 + RWT）：
 *   正常 / 向心性重构 / 向心性肥厚 / 离心性肥厚
 *
 * @param {object} o {lvid, ivs, lvpw, bsa, female}
 */
function lvMass(o) {
  const lvid = o.lvid, ivs = o.ivs, lvpw = o.lvpw;
  if (!(lvid > 0) || !(ivs > 0) || !(lvpw > 0)) return {};
  const sum = lvid + ivs + lvpw;
  const mass = 0.8 * 1.04 * (Math.pow(sum, 3) - Math.pow(lvid, 3)) + 0.6;
  const rwt = (2 * lvpw) / lvid;
  const r = { mass: mass, rwt: rwt, conc: rwt > 0.42 };

  if (o.bsa > 0) {
    const lvmi = mass / o.bsa;
    r.lvmi = lvmi;
    // ASE 2015 正常上限：男 115 / 女 95；重度：男 149 / 女 122 g/m²
    const hi = o.female ? 95 : 115;
    const severe = o.female ? 122 : 149;
    r.hi = hi;
    const massUp = lvmi > hi;
    if (!massUp && !r.conc) r.text = '正常构型';
    else if (!massUp && r.conc) r.text = '向心性重构（质量正常，RWT 升高）';
    else if (massUp && r.conc) r.text = '向心性肥厚';
    else r.text = '离心性肥厚';
    if (massUp) r.text += lvmi > severe ? ' · 重度（>' + severe + ' g/m²）' : ' · 轻度（>' + hi + ' g/m²）';
  } else {
    r.text = r.conc ? 'RWT 升高（向心性几何）' : 'RWT 正常';
  }
  return r;
}

/**
 * MAPSE（二尖瓣环收缩期位移）
 *
 * 正常 ≥10 mm（部分标准 ≥12 mm）；<10 mm 提示纵向收缩功能减低。
 * 长轴功能往往早于 EF 下降，EF 正常而 MAPSE 减低提示早期收缩功能障碍。
 *
 * @param {number} mapse 二尖瓣环侧壁 / 间隔均值，mm
 */
function mapseIndex(mapse) {
  if (!(mapse > 0)) return {};
  const r = { value: mapse };
  if (mapse >= 12) r.text = '正常（≥12 mm）';
  else if (mapse >= 10) r.text = '临界偏低（10–11 mm）';
  else if (mapse >= 8) r.text = '减低（提示纵向收缩功能受损，EF 可仍正常）';
  else r.text = '显著减低（<8 mm，长轴功能明显受损）';
  r.low = mapse < 10;
  return r;
}

/**
 * Tei 指数（心肌功能指数 MPI）
 *
 * MPI = (IVCT + IVRT) / ET = (a − b) / b
 * 正常值：左室 <0.40、右室 <0.55（脉冲多普勒法）
 *
 * @param {number} ivct 等容收缩时间，ms
 * @param {number} irvt 等容舒张时间，ms
 * @param {number} et   射血时间，ms
 * @param {string} side 'lv' | 'rv'
 */
function teiIndex(ivct, irvt, et, side) {
  if (!(ivct >= 0) || !(irvt >= 0) || !(et > 0)) return {};
  const mpi = (ivct + irvt) / et;
  const cut = side === 'rv' ? 0.55 : 0.40;
  return {
    mpi: mpi,
    cut: cut,
    text: mpi > cut
      ? (side === 'rv' ? '右室 MPI 升高（>0.55）' : '左室 MPI 升高（>0.40）')
      : 'MPI 在正常范围',
  };
}

/**
 * 无量纲指数 DVI（Dimensionless Index）
 *
 * DVI = LVOT VTI / 主动脉瓣 VTI = AVA / LVOT 面积
 * ≤0.25 支持重度 AS；>0.25 一般不支持重度。
 * 优点：不受体表面积与流量影响，低流量状态下比 AVA 更稳。
 *
 * @param {number} lvti LVOT VTI，cm
 * @param {number} avti 主动脉瓣 VTI，cm
 */
function dviIndex(lvti, avti) {
  if (!(lvti > 0) || !(avti > 0)) return {};
  if (lvti >= avti) return { error: 'LVOT VTI 应小于主动脉瓣 VTI，请核对取样位置' };
  const dvi = lvti / avti;
  return {
    dvi: dvi,
    text: dvi <= 0.25 ? '≤0.25，支持重度 AS' : '>0.25，一般不支持重度 AS',
  };
}

/**
 * 平均肺动脉压（舒张期肺动脉反流法）
 *
 * mPAP = 4 × PR Vmax² + RAP（舒张早期压差法，较 PASP 更接近有创均值）
 * 也可用 Mahan 近似：mPAP = 0.61 × sPAP + 2
 *
 * @param {number} prv  舒张早期肺动脉反流峰值速度，m/s
 * @param {number} rap  右房压，mmHg
 */
function mpap(prv, rap) {
  if (!(prv > 0) || !(rap >= 0)) return {};
  const m = 4 * prv * prv + rap;
  return {
    mpap: m,
    text: m > 25 ? '升高（>25 mmHg，符合肺高压）'
      : m > 20 ? '轻度升高（20–25 mmHg，运动性肺高压区间）'
        : '正常（≤20 mmHg）',
  };
}

/**
 * 肿瘤治疗相关心功能不全（CTRCD）监测
 *
 * 相对 GLS 下降 = (|GLS₀| − |GLS₁|) / |GLS₀| × 100%
 * 轻度：GLS 相对下降 >15% 且 EF 保留
 * 中度：EF 降至 40–49%，或 EF 下降 ≥10 个百分点至 40–49%
 * 重度：EF <40%，或出现心衰症状
 *
 * @param {object} o {g0, g1, ef0, ef1}  g 为负值
 */
function ctrcd(o) {
  const g0 = Math.abs(o.g0), g1 = Math.abs(o.g1);
  const hasG = g0 > 0 && g1 > 0;
  const rel = hasG ? ((g0 - g1) / g0) * 100 : undefined;
  const drop = (o.ef0 > 0 && o.ef1 > 0) ? (o.ef0 - o.ef1) : undefined;
  const r = { relDrop: rel, efDrop: drop };
  if (!hasG && drop === undefined) return r;

  const ef = o.ef1;
  if (ef > 0 && ef < 40) { r.grade = 3; r.text = '重度 CTRCD（EF <40%）'; return r; }
  if (ef > 0 && ef < 50 && drop !== undefined && drop >= 10) {
    r.grade = 2;
    r.text = '中度 CTRCD（EF 下降 ≥10 个百分点至 40–49%）';
    return r;
  }
  if (hasG && rel > 15) {
    if (ef > 0 && ef < 50) { r.grade = 2; r.text = '中度 CTRCD（GLS 相对下降 >15% 且 EF 40–49%）'; }
    else { r.grade = 1; r.text = '轻度 CTRCD（GLS 相对下降 >15%，EF 保留）'; }
    return r;
  }
  r.grade = 0;
  r.text = '未达 CTRCD 标准';
  return r;
}

/* ============================================================
 * 以下为 v1.1.0 新增：右室应变 / 心尖保留 / 负荷 PASP / 分流分级 / LVAD
 * ============================================================ */

/**
 * 右室游离壁应变（RVFWS）细化判读
 *
 * 三段平均 = (基底 + 中段 + 心尖) / 3，正常 ≤ −20%（绝对值 ≥20%）。
 * 右室整体应变 RVGLS 需并入院间隔三段，正常约 ≤ −17%。
 *
 * 基底-心尖梯度：正常右室游离壁应变绝对值呈「基底 ≥ 中段 ≥ 心尖」的轻微递减；
 * 若心尖绝对值反而明显大于基底（apex − base > 5，均为负值时即 apex 更负），
 * 属「反向梯度 / 心尖保留」，见于 ARVC 与慢性右室压力负荷。
 *
 * RVFWS/PASP 耦联（%/mmHg）：≥0.35 保留；0.31–0.35 临界；<0.31 失耦联。
 * 与 TAPSE/PASP（mm/mmHg，切点 0.55 / 0.36）不是同一量纲，切勿混用。
 *
 * @param {object} o {base, mid, apex, sep, pasp} 应变均为负值
 */
function rvStrain(o) {
  const b = o.base, m = o.mid, a = o.apex;
  if (!(b < 0) || !(m < 0) || !(a < 0)) return {};
  const avg = (b + m + a) / 3;
  const r = { base: b, mid: m, apex: a, avg: avg };

  // 分级（取绝对值比较更直观）
  const ab = Math.abs(avg);
  if (ab >= 20) { r.grade = 0; r.gradeText = '正常'; }
  else if (ab >= 15) { r.grade = 1; r.gradeText = '轻度减低'; }
  else if (ab >= 10) { r.grade = 2; r.gradeText = '中度减低'; }
  else { r.grade = 3; r.gradeText = '重度减低'; }

  // 基底-心尖梯度：apex − base（负值越多表示心尖越强）
  r.gradient = a - b;
  r.apicalSparing = (a - b) <= -5;
  if (r.apicalSparing) r.gradText = '反向梯度：心尖相对保留（基底段受累为主）';
  else if ((a - b) >= 5) r.gradText = '心尖段受累更重（少见，需核对节段归属）';
  else r.gradText = '基底-心尖梯度正常';

  // 右室整体应变（含室间隔）
  if (o.sep < 0) {
    r.rvgls = (b + m + a + o.sep * 3) / 6;
    r.sepLower = Math.abs(o.sep) < Math.abs(avg);
  }

  // RVFWS / PASP 耦联
  if (o.pasp > 0) {
    r.ratio = ab / o.pasp;
    if (r.ratio >= 0.35) r.coupling = '耦联保留';
    else if (r.ratio >= 0.31) r.coupling = '临界';
    else r.coupling = '失耦联（右室收缩功能跟不上后负荷）';
  }
  return r;
}

/**
 * 心尖保留比值（relative apical sparing, RAR）
 *
 * RAR = |心尖段平均 GLS| ÷ (|基底段平均 GLS| + |中段平均 GLS|)
 *   >0.94 高度提示心脏淀粉样变（Phelan 2012：敏感度 88%、特异度 85%）
 *   0.70–0.94 灰区，需结合分层应变与临床
 *   <0.70 不支持心尖保留
 *
 * 另算心内膜/心外膜梯度：正常 >1.5，淀粉样变梯度消失（趋近 1）。
 *
 * @param {object} o {base, mid, apex, endo, epi} 应变均为负值
 */
function rcmStrain(o) {
  const b = Math.abs(o.base), m = Math.abs(o.mid), a = Math.abs(o.apex);
  if (!(b > 0) || !(m > 0) || !(a > 0)) return {};
  const r = { rar: a / (b + m), gls: (b + m + a) / 3 };
  if (r.rar > 0.94) { r.level = 2; r.text = '心尖保留阳性：高度提示心脏淀粉样变'; }
  else if (r.rar >= 0.70) { r.level = 1; r.text = '灰区：需结合分层应变、ECG 与 CMR'; }
  else { r.level = 0; r.text = '不支持心尖保留（考虑 HCM / 其他限制型心肌病）'; }

  if (o.endo > 0 && o.epi > 0) {
    r.transGrad = o.endo / o.epi;
    r.gradLost = r.transGrad < 1.2;
  }
  return r;
}

/**
 * 负荷超声的肺动脉收缩压运动反应
 *
 * 静息 PASP 与峰值 PASP 之差 ΔPASP；若同时给出静息/峰值心排量，
 * 可算 ΔPASP/ΔCO 斜率（2022 ESC/ERS：运动 mPAP/CO 斜率 >3 WU 为异常，
 * 超声以 ΔPASP/ΔCO >3 mmHg/(L/min) 近似）。
 *
 * 判读（超声替代标准）：
 *   峰值 PASP ≤ 50 且 ΔPASP ≤ 20 → 反应正常
 *   峰值 PASP 51–60 或 ΔPASP 21–30 → 边缘 / 需结合 E/e′
 *   峰值 PASP > 60 或 ΔPASP > 30 → 运动诱发肺高压，支持 HFpEF
 *
 * @param {object} o {rest, peak, co0, co1}
 */
function paspStress(o) {
  if (!(o.rest > 0) || !(o.peak > 0)) return {};
  const r = { rest: o.rest, peak: o.peak, delta: o.peak - o.rest };
  if (o.co0 > 0 && o.co1 > o.co0) {
    r.slope = r.delta / (o.co1 - o.co0);
  }
  const hi = o.peak > 60 || r.delta > 30;
  const mid = !hi && (o.peak > 50 || r.delta > 20);
  if (hi) { r.level = 2; r.text = '运动诱发肺高压（支持 HFpEF / 左心疾病相关）'; }
  else if (mid) { r.level = 1; r.text = '边缘反应：结合负荷 E/e′ 与症状判断'; }
  else { r.level = 0; r.text = 'PASP 运动反应正常'; }
  if (r.slope !== undefined && r.slope > 3) {
    r.level = 2;
    r.text = 'ΔPASP/ΔCO >3 mmHg/(L/min)，符合运动诱发肺高压';
  }
  return r;
}

/**
 * 左向右分流（Qp/Qs）分级与干预提示
 *
 * Qp/Qs 分级（成人先心病通用）：
 *   <1.0      右向左净分流 → 提示不可逆肺血管病（艾森曼格方向），禁忌关闭
 *   1.0–1.5   无显著分流 / 少量
 *   1.5–2.0   中等量 → 有症状或心腔扩大者可考虑干预
 *   >2.0      大量 → 通常具备干预指征
 *   >2.5      极大 → 尽快评估，须先排除重度肺高压
 *
 * 注意：Qp/Qs 只说明「分流量」，不能单独决定手术；需叠加分流方向、
 * 肺血管阻力（PVR）、症状与心腔大小。
 *
 * @param {number} qp 肺循环每搏量 mL
 * @param {number} qs 体循环每搏量 mL
 * @param {number} pvr 肺血管阻力 WU（可缺省）
 */
function shuntGrade(qp, qs, pvr) {
  if (!(qp > 0) || !(qs > 0)) return {};
  const ratio = qp / qs;
  const r = { ratio: ratio };
  if (ratio < 1.0) { r.grade = -1; r.text = '净右向左分流：警惕艾森曼格，禁忌关闭'; }
  else if (ratio < 1.5) { r.grade = 0; r.text = '无显著分流（或微量），随访观察'; }
  else if (ratio < 2.0) { r.grade = 1; r.text = '中等量分流：有症状或心腔扩大者考虑干预'; }
  else if (ratio < 2.5) { r.grade = 2; r.text = '大量分流：通常具备干预指征'; }
  else { r.grade = 3; r.text = '极大分流：尽快评估，须先排除重度肺高压'; }

  if (pvr > 0) {
    r.operable = (ratio >= 1.5 && pvr < 5);
    if (pvr >= 8) { r.operable = false; r.pvrText = 'PVR ≥8 WU：多属不可逆，关闭风险高'; }
    else if (pvr >= 5) { r.pvrText = 'PVR 5–8 WU：需急性血管反应试验或靶向治疗后复评'; }
    else { r.pvrText = 'PVR <5 WU：肺血管阻力尚可'; }
  }
  return r;
}

/**
 * LVAD（连续流左心室辅助装置）超声要点判读
 *
 * 三个核心量：
 *   ① 出血道每搏量 = πd²/4 × VTI，CO = SV × HR（LVOT VTI 不能用于 LVAD 患者）
 *   ② LV 舒张末内径：持续缩小（常 <30 mm）提示抽吸；持续增大提示泵效不足
 *   ③ 主动脉瓣开放状态：1 = 每次开放 / 2 = 间断开放 / 3 = 持续关闭
 *
 * 判读要点：主动脉瓣持续关闭 → 根部淤滞、血栓与反流风险升高，宜降低泵速；
 * 室间隔左移 + LVEDD 骤降 → 抽吸事件；TAPSE <7.5 mm 提示右心衰高危。
 *
 * @param {object} o {d, vti, hr, lvedd, avOpen, tapse}
 */
function lvadEcho(o) {
  const r = { notes: [] };
  if (o.d > 0 && o.vti > 0) {
    r.sv = Math.PI * o.d * o.d / 4 * o.vti;
    if (o.hr > 0) r.co = r.sv * o.hr / 1000;
  }
  if (o.lvedd > 0) {
    if (o.lvedd < 30) {
      r.suction = true;
      r.notes.push('LVEDD <30 mm：抽吸高危（室间隔左移、泵入口贴近心肌）');
    } else if (o.lvedd > 65) {
      r.unloading = true;
      r.notes.push('LVEDD >65 mm：卸载不足，评估泵速与容量');
    } else {
      r.notes.push('LVEDD 处于可接受区间（30–65 mm）');
    }
  }
  if (o.avOpen === 3) {
    r.notes.push('主动脉瓣持续关闭：根部淤滞 → 血栓 / 主动脉瓣反流 / 瓣叶融合风险，宜降速使瓣膜间断开放');
  } else if (o.avOpen === 2) {
    r.notes.push('主动脉瓣间断开放：泵速基本合适，注意随访反流');
  } else if (o.avOpen === 1) {
    r.notes.push('主动脉瓣每次开放：泵速偏低或自身心功能恢复，注意卸载是否充分');
  }
  if (o.tapse > 0 && o.tapse < 7.5) {
    r.rvFail = true;
    r.notes.push('TAPSE <7.5 mm：右心衰高危，术后需临时右心辅助的准备');
  }
  return r;
}

/**
 * 右室收缩储备（低剂量多巴酚丁胺负荷下的 RVFWS 反应）
 *
 * 方案：多巴酚丁胺 5 → 10 → 20 μg/kg/min，每级 3–5 min；低剂量方案不追求
 * 目标心率，只要求心率较基线上升 10–20 次/分即可判读（不是缺血负荷试验）。
 *
 * 判读（RVFWS 取绝对值比较）：
 *   ΔRVFWS ≥5 个百分点      → 收缩储备保留
 *   ΔRVFWS 2–5 个百分点      → 储备边缘（灰区，结合 TAPSE 与 PASP 反应）
 *   ΔRVFWS <2 或下降         → 收缩储备耗竭（右室已用尽收缩储备）
 *
 * 参考：低剂量多巴酚丁胺下 RVFWS 无改善的肺高压 / 右心衰患者预后显著更差；
 * RVFWS 联合 PASP 的耦联比值变化比单看 RVFWS 更稳。
 *
 * 注意：负荷中 PASP 同步上升 >20 mmHg 时，RVFWS 不涨可能只是后负荷效应，
 * 需看 RVFWS/PASP 比值是否同步改善（couplingDelta）。
 *
 * @param {object} o {rest, peak, tapse0, tapse1, pasp0, pasp1} 应变均为负值
 */
function rvReserve(o) {
  // 应变必须是负值（纵向缩短）；正值多为符号习惯不同，不能直接算
  if (!(o.rest < 0) || !(o.peak < 0)) return {};
  const s0 = Math.abs(o.rest);
  const s1 = Math.abs(o.peak);
  const r = { rest: s0, peak: s1, delta: s1 - s0 };
  r.relChange = s0 > 0 ? (r.delta / s0) * 100 : undefined;

  if (r.delta >= 5) { r.level = 0; r.text = '收缩储备保留'; }
  else if (r.delta >= 2) { r.level = 1; r.text = '收缩储备边缘（灰区）'; }
  else { r.level = 2; r.text = '收缩储备耗竭'; }

  // TAPSE 参照：增加 ≥5 mm 或 ≥20% 支持储备保留
  if (o.tapse0 > 0 && o.tapse1 > 0) {
    r.tapseDelta = o.tapse1 - o.tapse0;
    r.tapseChange = (r.tapseDelta / o.tapse0) * 100;
    r.tapseOk = r.tapseDelta >= 5 || r.tapseChange >= 20;
  }

  // PASP 反应与耦联比值变化
  if (o.pasp0 > 0 && o.pasp1 > 0) {
    r.dpasp = o.pasp1 - o.pasp0;
    r.ratio0 = s0 / o.pasp0;
    r.ratio1 = s1 / o.pasp1;
    r.couplingDelta = r.ratio1 - r.ratio0;
    // 后负荷上升明显而应变不涨 → 提示「纯后负荷效应」而非储备不足
    if (r.dpasp > 20 && r.delta < 5) r.afterloadOnly = true;
  }
  return r;
}

/**
 * 法洛四联症术后肺动脉瓣反流（PR）：严重度与肺动脉瓣置换（PVR）指征
 *
 * TOF 根治（尤其跨瓣环补片）后几乎都存在 PR。超声对 PR 只能半定量，
 * 真正的容量与功能阈值来自 CMR——所以本函数要求的 RVEDVi / RVESVi / RVEF
 * 应按 CMR 填报；仅有超声时只作筛查，不下「达到指征」的结论。
 *
 * PR 严重度（取两项中较重档）：
 *   PR 指数（舒张期反流时限 ÷ 舒张期总时限）：≥0.7 重度 / 0.5–0.7 中度 / <0.5 轻度
 *   反流束宽度 ÷ RVOT 径：≥50% 重度 / 30–50% 中度 / <30% 轻度
 *
 * PVR 参考指征（任一条成立）：
 *   RVESVi >80 mL/m² / RVEDVi >160 mL/m² / RVEF <50%
 *   + 症状或新发房性心律失常（临床条件，不在本函数内）
 *
 * @param {object} o {pridx, prw, rvedvi, rvesvi, rvef, rvotpg}
 */
function tofPr(o) {
  const r = { notes: [] };

  // —— PR 严重度 ——
  let sev = -1;
  if (o.pridx > 0) {
    r.pridx = o.pridx;
    if (o.pridx >= 0.7) { r.byIdx = 2; r.idxText = 'PR 指数 ≥0.7：重度'; }
    else if (o.pridx >= 0.5) { r.byIdx = 1; r.idxText = 'PR 指数 0.5–0.7：中度'; }
    else { r.byIdx = 0; r.idxText = 'PR 指数 <0.5：轻度'; }
    sev = r.byIdx;
  }
  if (o.prw > 0) {
    r.prw = o.prw;
    if (o.prw >= 50) { r.byWidth = 2; r.widthText = '反流束/RVOT ≥50%：重度'; }
    else if (o.prw >= 30) { r.byWidth = 1; r.widthText = '反流束/RVOT 30–50%：中度'; }
    else { r.byWidth = 0; r.widthText = '反流束/RVOT <30%：轻度'; }
    sev = sev > r.byWidth ? sev : r.byWidth;
  }
  if (sev >= 0) {
    r.severity = sev;
    r.severityText = ['轻度 PR', '中度 PR', '重度 PR'][sev];
    if (r.byIdx !== undefined && r.byWidth !== undefined && r.byIdx !== r.byWidth) {
      r.discordant = true;
    }
  }

  // —— PVR 指征（CMR 阈值）——
  let ind = 0;
  if (o.rvesvi > 0) {
    r.rvesvi = o.rvesvi;
    if (o.rvesvi > 80) { ind += 1; r.notes.push('RVESVi ' + round(o.rvesvi, 0) + ' >80 mL/m²：达到 PVR 主要容量阈值'); }
    else if (o.rvesvi >= 70) r.notes.push('RVESVi ' + round(o.rvesvi, 0) + ' mL/m²：接近阈值（70–80），3–6 个月复查');
  }
  if (o.rvedvi > 0) {
    r.rvedvi = o.rvedvi;
    if (o.rvedvi > 160) { ind += 1; r.notes.push('RVEDVi ' + round(o.rvedvi, 0) + ' >160 mL/m²：支持 PVR'); }
    else if (o.rvedvi >= 150) r.notes.push('RVEDVi ' + round(o.rvedvi, 0) + ' mL/m²：接近阈值（150–160）');
  }
  if (o.rvef > 0) {
    r.rvef = o.rvef;
    if (o.rvef < 50) { ind += 1; r.notes.push('RVEF ' + round(o.rvef, 0) + '% <50%：右室收缩功能受损，支持 PVR 评估'); }
    if (o.rvef < 45 && o.rvesvi > 80) {
      r.notes.push('RVEF <45% 叠加 RVESVi >80：术后右室功能恢复可能有限，时机已偏晚，需与外科共同决策');
    }
  }
  r.pvrIndication = ind > 0;

  // —— 残余梗阻（补片 / 分支狭窄），跨瓣压差 >40 mmHg 有意义 ——
  if (o.rvotpg > 0) {
    r.rvotpg = o.rvotpg;
    if (o.rvotpg >= 40) { r.notes.push('RVOT 压差 ≥40 mmHg：存在残余梗阻，PVR 前须先处理梗阻'); }
    else if (o.rvotpg >= 25) r.notes.push('RVOT 压差 25–40 mmHg：轻度残余梗阻，随访');
  }

  // 重度 PR 但容量未达阈值 → 提示 CMR 随访而非立即干预
  if (r.severity === 2 && ind === 0 && o.rvesvi > 0) {
    r.notes.push('重度 PR 而 RV 容量尚未达阈值：可 CMR 每 12–24 个月随访，不必急于 PVR');
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
  asLflg,
  rvFuncScore,
  cpRm,
  hfaPeff,
  dukeScore,
  trGrade,
  lvEf,
  lvMass,
  mapseIndex,
  teiIndex,
  dviIndex,
  mpap,
  ctrcd,
  rvStrain,
  rcmStrain,
  paspStress,
  shuntGrade,
  lvadEcho,
  rvReserve,
  tofPr,
  round,
  fmt,
};

