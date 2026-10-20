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
  round,
  fmt,
};

