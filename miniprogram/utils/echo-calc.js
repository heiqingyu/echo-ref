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
 * 二尖瓣面积：PHT 法与连续性方程同屏对照（MS 判读页 / 公式集共用一套）
 *
 * 两法结果不一致时**不给平均值**——差异本身就是信息（节律、AR、钙化、图像质量），
 * 所以这里只报差值与提示，让用户回到图像找原因。
 *
 * @param {number} phtMs    压力减半时间 PHT（ms），无则传 null
 * @param {number} lvotD    LVOT 直径（cm）
 * @param {number} lvotVti  LVOT VTI（cm）
 * @param {number} mvVti    二尖瓣 VTI（cm）
 * @returns {{pht?:number, phtText?:string, cont?:number, contText?:string,
 *            sv?:number, diff?:number, diffText?:string, method:string}}
 */
function mvaBoth(phtMs, lvotD, lvotVti, mvVti) {
  var ok = function (x) { return typeof x === 'number' && isFinite(x) && x > 0; };
  var r = { method: '' };
  var hasPht = ok(phtMs);
  var hasCont = ok(lvotD) && ok(lvotVti) && ok(mvVti);

  if (hasPht) {
    r.pht = mvaPht(phtMs);
    r.phtText = gradeMva(r.pht).text;
  }
  if (hasCont) {
    r.sv = strokeVolume(lvotD, lvotVti);
    r.cont = mvaContinuity(r.sv, mvVti);
    r.contText = gradeMva(r.cont).text;
  }
  if (hasPht && hasCont) {
    r.diff = Math.abs(r.pht - r.cont);
    r.method = 'both';
    // 两法差 >0.3 cm² 已超出测量误差范围，先怀疑前提（节律 / AR / 钙化）而不是取平均
    r.diffText = r.diff > 0.3
      ? '两法差 ' + r.diff.toFixed(2) + ' cm²（>0.3，超出测量误差）→ 回到图像找原因：节律是否窦性、有无主动脉瓣反流、瓣叶是否重度钙化，不要取平均'
      : '两法差 ' + r.diff.toFixed(2) + ' cm²（≤0.3，互相印证）';
  } else {
    r.method = hasPht ? 'pht' : (hasCont ? 'cont' : '');
  }
  return r;
}

/**
 * PMBV 适合度：把「平均压差 + PASP + Wilkins」串成一条流程（二尖瓣狭窄判读页用）
 *
 * 临床顺序不是先测面积，而是三步递进：
 *   ① 定严重度 —— MVA（PHT / 连续性方程，二选一或都算）+ 心率校正后的平均压差，两者互相印证
 *   ② 看后果   —— PASP >50 mmHg 说明狭窄已造成重度肺高压后果，是介入的最强理由
 *   ③ 看形态   —— Wilkins 评分回答「瓣膜能不能扩」：≤8 适合 PMBV、9–11 边缘、≥12 外科
 * 前两步决定「要不要做」，第三步决定「适合谁做」。
 * 超声报告还必须写明三项排除：TEE 排除左房血栓、反流 ≤轻度、无重度主动脉瓣病变。
 *
 * @param {object} o { mva, mvaHow, gra, pasp, wilkins }
 *   mva     面积 cm²（PHT 与连续方程不一致时由调用方择一传入，不取平均）
 *   mvaHow  面积测法标签（'PHT 法' / '连续方程'），仅用于文案
 *   gra     平均跨瓣压差 mmHg（应校正到心率 60–80 次/分）
 *   pasp    肺动脉收缩压 mmHg
 *   wilkins Wilkins 总分 4–16
 * @returns {{parts:string[], verdict:string, level:number, missing:string[]}}
 */
function pmbvSuit(o) {
  o = o || {};
  var ok = function (x) { return typeof x === 'number' && isFinite(x) && x > 0; };
  var mva = ok(o.mva) ? o.mva : null;
  var how = o.mvaHow || '';
  var gra = ok(o.gra) ? o.gra : null;
  var pasp = ok(o.pasp) ? o.pasp : null;
  var wk = (o.wilkins >= 4 && o.wilkins <= 16) ? Math.round(o.wilkins) : null;

  var parts = [];
  var missing = [];

  // ── ① 严重度 ──
  var sev = null; // 0 轻 / 1 中 / 2 重
  var mismatch = false; // 压差与面积分级不一致（面积为准，压差复测）
  if (mva !== null) {
    var gm = gradeMva(mva);
    sev = gm.level === 'severe' ? 2 : (gm.level === 'moderate' ? 1 : 0);
    parts.push('① 严重度：MVA ' + mva.toFixed(2) + ' cm²' +
      (how ? '（' + how + '）' : '') + ' → ' + gm.text +
      (gm.level === 'severe' ? '（≤1.0 cm²）' : gm.level === 'moderate' ? '（1.0–1.5）' : '（>1.5）'));
  }
  if (gra !== null) {
    var gt = gra > 10 ? '重度（>10 mmHg）' : (gra >= 5 ? '中度（5–10 mmHg）' : '轻度（<5 mmHg）');
    var gsev = gra > 10 ? 2 : (gra >= 5 ? 1 : 0);
    parts.push('① 严重度：平均压差 ' + gra.toFixed(0) + ' mmHg → ' + gt);
    if (mva !== null && gsev !== sev) {
      // 两法/两指标打架：以面积为准，压差提示流量或测量问题
      mismatch = true;
      parts.push('⚠ 压差与面积分级不一致：压差随心率和流量变化，校正到 60–80 次/分复测，仍以面积为准');
    } else if (mva !== null) {
      sev = Math.max(sev, gsev);
    } else {
      sev = gsev;
    }
  }
  if (mva === null && gra === null) missing.push('MVA（PHT / 连续方程）或平均压差');

  // ── ② 后果 ──
  var conseq = 0;
  if (pasp !== null) {
    if (pasp > 50) {
      conseq = 2;
      parts.push('② 后果：PASP ' + pasp.toFixed(0) + ' mmHg >50 → 重度肺高压，介入理由强');
    } else if (pasp >= 30) {
      conseq = 1;
      parts.push('② 后果：PASP ' + pasp.toFixed(0) + ' mmHg 30–50 → 中度升高');
    } else {
      parts.push('② 后果：PASP ' + pasp.toFixed(0) + ' mmHg <30 → 无明显肺高压后果');
    }
  } else missing.push('PASP');

  // ── ③ 形态 ──
  if (wk !== null) {
    if (wk <= 8) parts.push('③ 形态：Wilkins ' + wk + '/16 ≤8 → 瓣膜形态适合 PMBV');
    else if (wk <= 11) parts.push('③ 形态：Wilkins ' + wk + '/16 9–11 → 边缘区，个体化');
    else parts.push('③ 形态：Wilkins ' + wk + '/16 ≥12 → 形态差，优先外科');
  } else missing.push('Wilkins 四项评分（各 1–4 分）');

  // ── 结论：前两步定「要不要做」，第三步定「适合谁做」 ──
  var verdict = '';
  var level = 0;
  var severeEnough = sev === 2 || (sev === 1 && conseq === 2);
  if (wk !== null) {
    if (wk >= 12) {
      verdict = 'PMBV 适合度：形态不适合（Wilkins ≥12），优先外科换瓣';
      level = 3;
    } else if (wk <= 8) {
      if (sev === 2) {
        verdict = 'PMBV 适合度：重度 MS + 形态适合 → 理想 PMBV 候选；术前 TEE 排除左房血栓，' +
          '确认 MR ≤轻度、无重度主动脉瓣病变' +
          (mva === null ? '；未测 MVA，补一项面积确认' : '');
        level = 1;
      } else if (sev === 1 && conseq === 2) {
        verdict = 'PMBV 适合度：MS 中度但 PASP >50 mmHg（后果重）+ 形态适合 → 有 PMBV 理由，建议与外科共同决策';
        level = 1;
      } else if (sev === null && conseq === 2) {
        verdict = 'PASP 已 >50 mmHg，存在介入理由；补 MVA 与平均压差确认严重度';
        level = 1;
      } else if (sev === null) {
        verdict = '形态适合 PMBV，但尚未确认 MS 严重度（补 MVA / 平均压差）';
        level = 0;
      } else if (sev === 1) {
        verdict = pasp !== null
          ? 'MS 中度（MVA 1.0–1.5）且 PASP ≤50 mmHg：以药物与随访为主，出现症状或 PASP 升高再评估介入'
          : 'MS 中度（MVA 1.0–1.5）；补平均压差与 PASP 判断后果，再定介入时机';
        level = 0;
      } else {
        verdict = '狭窄未达重度（MVA >1.5 cm²' +
          (mismatch ? '，压差 ' + gra.toFixed(0) + ' mmHg 与面积不符需复测' : '') +
          '），以随访与对症为主，暂不考虑 PMBV';
        level = 0;
      }
    } else {
      verdict = 'PMBV 适合度：边缘区（Wilkins 9–11），结合年龄、合并症与外科风险个体化决定';
      level = 2;
    }
  } else if (severeEnough || conseq === 2) {
    verdict = '已达中重度 MS（或 PASP >50 mmHg），有介入理由；补 Wilkins 四项评分判断能否 PMBV';
    level = 1;
  }

  return { parts: parts, verdict: verdict, level: level, missing: missing };
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

/**
 * Ebstein 畸形的三尖瓣隔瓣下移指数
 *
 * 下移指数 = 隔瓣下移距离（mm） ÷ 体表面积（m²）
 *
 * 判读（>8 mm/m² 为诊断 Ebstein 的常用界值）：
 *   ≤8   未达显著下移（正常 ≤8）
 *   8–15 显著下移，符合 Ebstein
 *   >15  重度下移，房化右室大、修复难度高
 * 注：8 为文献常用界值；15 为经验分层，用于提示重构程度，非指南硬切点。
 *
 * @param {number} disp 隔瓣下移距离 mm
 * @param {number} bsa  体表面积 m²
 */
function ebsteinIndex(disp, bsa) {
  if (!(disp > 0) || !(bsa > 0)) return {};
  const idx = disp / bsa;
  const r = { index: idx, disp: disp, bsa: bsa };
  if (idx <= 8) { r.level = 0; r.text = '未达显著下移（≤8 mm/m²）'; }
  else if (idx <= 15) { r.level = 1; r.text = '显著下移，符合 Ebstein（8–15 mm/m²）'; }
  else { r.level = 2; r.text = '重度下移（>15 mm/m²），房化右室大、修复难度高'; }
  return r;
}

/**
 * PASP 分级（mmHg）
 *
 * 切点取自 ASE 右心评估与 ESC/ERS 肺高压指南的常用分层：
 *   ≤36 正常（对应 TR Vmax ≤2.8 m/s）
 *   37–49 轻度升高
 *   50–69 中度升高
 *   ≥70 重度升高
 * 注意：PASP 依赖 TR 压差 + RAP 估算，TR 频谱不完整时误差大；
 * 肺动脉瓣狭窄 / RVOT 梗阻时 4V²+RAP 会高估。
 */
function paspGrade(v) {
  if (!(v > 0)) return {};
  if (v <= 36) return { level: 0, text: '正常（≤36 mmHg）' };
  if (v < 50) return { level: 1, text: '轻度升高（37–49 mmHg）' };
  if (v < 70) return { level: 2, text: '中度升高（50–69 mmHg）' };
  return { level: 3, text: '重度升高（≥70 mmHg）' };
}

/**
 * RAP 估算（IVC 法，ASE 2015 三分级）
 *
 *   IVC ≤21 mm 且吸气塌陷 >50%  → 3 mmHg（正常）
 *   IVC >21 mm 且吸气塌陷 ≤50%  → 15 mmHg（明显升高）
 *   其余组合                    → 8 mmHg（中间档）
 * 仅适用于自主呼吸；机械通气、心包积液、腹压增高时不可靠。
 *
 * @param {number} ivcMm IVC 内径 mm
 * @param {string} collapse 'yes' >50% | 'no' ≤50% | '' 未知
 */
function rapEstimate(ivcMm, collapse) {
  if (!(ivcMm > 0)) return {};
  const rap = rapFromIvc(ivcMm, collapse);
  let text;
  if (rap === 3) text = '右房压正常（IVC 不宽且塌陷充分）';
  else if (rap === 15) text = '右房压明显升高（IVC 增宽且塌陷减少）';
  else text = '右房压中间档（需结合 IVC 形态与其他右心指标）';
  return { rap: rap, text: text, ivc: ivcMm, collapse: collapse || '' };
}

/**
 * 肺血管阻力（血流动力学法，右心导管口径的超声替代）
 *
 *   PVR(WU) = (mPAP − PAWP) / CO
 *   PVR(dyn·s·cm⁻⁵) = (mPAP − PAWP) × 80 / CO
 * 分级（ESC/ERS 2022）：
 *   ≤2 WU 正常；2–3 轻度；3–5 中度；>5 重度。
 * 先心病可手术性常以 PVR <3 WU（PVRI <6 WU·m²）为界；
 * 移植评估中 >5 WU 属高危。超声估测值仅作筛查，确诊需右心导管。
 *
 * @param {number} mpap mmHg
 * @param {number} pawp mmHg（肺动脉楔压 / 左房压替代）
 * @param {number} co   L/min
 */
function pvrResistance(mpap, pawp, co) {
  if (!(mpap > 0) || !(co > 0)) return {};
  const pawpV = (pawp === undefined || pawp === null) ? 0 : pawp;
  const grad = mpap - pawpV;
  if (grad < 0) return { error: 'mPAP 小于 PAWP，请核对输入' };
  const wu = grad / co;
  const dyn = grad * 80 / co;
  let text;
  if (wu <= 2) text = '阻力正常（≤2 WU）';
  else if (wu < 3) text = '轻度升高（2–3 WU）';
  else if (wu <= 5) text = '中度升高（3–5 WU）：先心病关闭前需急性血管反应试验';
  else text = '重度升高（>5 WU）：手术 / 移植高危';
  return { wu: wu, dyn: dyn, grad: grad, text: text };
}

/**
 * 体循环血管阻力
 *
 *   SVR(dyn·s·cm⁻⁵) = (MAP − RAP) × 80 / CO
 *   参考 800–1200；<800 降低（分布性休克、肝硬化、分流），>1200 升高。
 * 有 BSA 时同出 SVRI = SVR × BSA（正常 1600–2400 dyn·s·cm⁻⁵·m²）。
 */
function svrResistance(map, rap, co, bsa) {
  if (!(map > 0) || !(co > 0)) return {};
  const rapV = (rap === undefined || rap === null) ? 0 : rap;
  const dyn = (map - rapV) * 80 / co;
  const r = { dyn: dyn, grad: map - rapV };
  if (bsa > 0) r.svri = dyn * bsa;
  if (dyn < 800) r.text = '阻力降低（<800）：注意分布性休克 / 分流';
  else if (dyn <= 1200) r.text = '阻力正常（800–1200）';
  else r.text = '阻力升高（>1200）：后负荷增加';
  return r;
}

/**
 * 人工瓣有效开口面积指数与患者-人工瓣不匹配（PPM）
 *
 *   EOAi = EOA / BSA
 * 阈值（VARC / ASE）：
 *   主动脉位：>1.0 无 PPM；0.85–1.0 中度；<0.85 重度
 *   二尖瓣位：>1.2 无 PPM；0.9–1.2 中度；<0.9 重度
 *
 * @param {number} eoa cm²
 * @param {number} bsa m²
 * @param {number} pos 1=主动脉位 2=二尖瓣位
 */
function eoaPpm(eoa, bsa, pos, bmi) {
  if (!(eoa > 0) || !(bsa > 0)) return {};
  const idx = eoa / bsa;
  const av = pos !== 2;
  // ★ R17（ASE 2024 人工瓣心血管影像指南）Table 7：BMI ≥30 kg/m² 时切点下调
  const obese = (typeof bmi === 'number' && isFinite(bmi) && bmi >= 30);
  const cut = av
    ? (obese ? { sev: 0.55, mod: 0.70 } : { sev: 0.65, mod: 0.85 })
    : (obese ? { sev: 0.75, mod: 1.00 } : { sev: 0.90, mod: 1.20 });
  const site = av ? '主动脉位' : '二尖瓣位';
  const r = { eoai: idx, pos: av ? 'av' : 'mv', obese: obese };
  if (idx <= cut.sev) {
    r.level = 2;
    r.text = '重度 PPM（' + site + ' EOAi ≤' + cut.sev + (obese ? '，BMI≥30 口径' : '') + '）';
  } else if (idx <= cut.mod) {
    r.level = 1;
    r.text = '中度 PPM（' + site + ' ' + cut.sev + '–' + cut.mod +
      (obese ? '，BMI≥30 口径' : '') + '）';
  } else {
    r.level = 0;
    r.text = '无明显 PPM（' + site + ' >' + cut.mod + (obese ? '，BMI≥30 口径' : '') + '）';
  }
  return r;
}

/**
 * 容积指数与重构分级（ASE 2015 正常值上限）
 *
 *   EDVi 上限：男 74 / 女 61 mL/m²
 *   ESVi 上限：男 31 / 女 24 mL/m²
 *   SVi  正常：男 32–58 / 女 29–47 mL/m²
 * ESVi >45 mL/m² 提示显著收缩功能减低（ICD / 预后评估常用阈值）。
 */
function volumeIndices(edv, esv, bsa, female) {
  if (!(edv > 0) || !(esv > 0)) return {};
  if (esv >= edv) return { error: 'ESV 不可大于或等于 EDV，请核对' };
  const sv = edv - esv;
  const ef = sv / edv * 100;
  const r = { sv: sv, ef: ef };
  if (!(bsa > 0)) return r;

  const hiEdv = female ? 61 : 74;
  const hiEsv = female ? 24 : 31;
  r.edvi = edv / bsa;
  r.esvi = esv / bsa;
  r.svi = sv / bsa;
  r.hiEdv = hiEdv;
  r.hiEsv = hiEsv;

  const band = function (v, hi) {
    if (v <= hi) return '正常';
    if (v <= hi * 1.2) return '轻度增大';
    if (v <= hi * 1.5) return '中度增大';
    return '重度增大';
  };
  r.edviText = band(r.edvi, hiEdv);
  r.esviText = band(r.esvi, hiEsv);
  r.notes = [];
  if (r.esvi > 45) r.notes.push('ESVi >45 mL/m²：收缩功能显著减低，注意 ICD / CRT 指征');
  if (r.svi < 35) r.notes.push('SVi <35 mL/m²：低流量状态，压差与面积判读需谨慎');
  return r;
}

/**
 * 相对室壁应力（RWS）
 *
 *   RWS = 0.334 × SBP × LVEDD / [PWT × (1 + PWT / LVEDD)]
 * 单位 10³ dyn/cm²（kdyne/cm²）。LVEDD、PWT 单位 cm。
 *   正常约 60–160；>160 提示后负荷偏高（向心性肥厚的代偿对象），
 *   <60 提示后负荷低（容量负荷 / 扩张型重构）。
 */
function relativeWallStress(sbp, lvidd, pwt) {
  if (!(sbp > 0) || !(lvidd > 0) || !(pwt > 0)) return {};
  const v = 0.334 * sbp * lvidd / (pwt * (1 + pwt / lvidd));
  let text;
  if (v > 160) text = '室壁应力升高（>160）：后负荷偏高，向心性重构的代偿表现';
  else if (v >= 60) text = '室壁应力在正常范围（60–160）';
  else text = '室壁应力偏低（<60）：容量负荷 / 扩张性重构';
  return { rws: v, text: text };
}

/**
 * 左室球形指数（舒张末，直径法）
 *
 *   SI = 左室短径 / 长径（同一时相）
 *   ≤0.65 形态正常；0.66–0.75 球形化；>0.75 显著球形化（重构、预后差）。
 */
function sphericityIndex(shortD, longL) {
  if (!(shortD > 0) || !(longL > 0)) return {};
  if (shortD >= longL) return { error: '短径不应大于或等于长径，请核对测量' };
  const si = shortD / longL;
  let text;
  if (si <= 0.65) text = '形态正常（≤0.65）';
  else if (si <= 0.75) text = '球形化（0.66–0.75）';
  else text = '显著球形化（>0.75）：重构明显，预后较差';
  return { si: si, text: text };
}

/**
 * 左房应变三值（储备 / 管道 / 泵）
 *
 * 参考范围（WASE 2022 正常值，随年龄性别有差异）：
 *   LASr（储备）正常约 23–62%，临床常用 >30% 为正常；
 *   LAScd（管道）约 10–25%；LASct（泵，取绝对值）约 10–20%。
 * 分级（以 LASr 为主，HFpEF 相关阈值 23%）：
 *   ≥30 正常；23–30 轻度减低；18–23 中度减低；<18 重度减低。
 * 一致性：LASr ≈ LAScd + |LASct|，偏差 >5 提示节段 / 时相勾画有问题。
 *
 * @param {number} sr 储备应变 %（正值）
 * @param {number} scd 管道应变 %（正值）
 * @param {number} sct 泵应变 %（负值或正值，取绝对值）
 */
function laStrainTri(sr, scd, sct) {
  if (!isFinite(sr) && !isFinite(scd) && !isFinite(sct)) return {};
  const r = {};
  const abs = function (x) { return (x === undefined || x === null) ? null : Math.abs(x); };
  if (sr !== undefined && sr !== null) r.sr = Math.abs(sr);
  if (scd !== undefined && scd !== null) r.scd = abs(scd);
  if (sct !== undefined && sct !== null) r.sct = abs(sct);

  if (r.sr !== undefined) {
    if (r.sr >= 30) { r.level = 0; r.srText = '储备功能正常（≥30%）'; }
    else if (r.sr >= 23) { r.level = 1; r.srText = '轻度减低（23–30%）'; }
    else if (r.sr >= 18) { r.level = 2; r.srText = '中度减低（18–23%）'; }
    else { r.level = 3; r.srText = '重度减低（<18%）：左房顺应性差、充盈压多已升高'; }
  }
  if (r.scd !== undefined) r.scdText = r.scd < 10 ? '管道功能减低（<10%）' : '管道功能可接受';
  if (r.sct !== undefined) r.sctText = r.sct < 10 ? '泵功能减低（<10%）' : '泵功能可接受';

  if (r.sr !== undefined && r.scd !== undefined && r.sct !== undefined) {
    const sum = r.scd + r.sct;
    r.sum = sum;
    r.diff = Math.abs(sum - r.sr);
    r.consistent = r.diff <= 5;
  }
  return r;
}

/**
 * 升主动脉直径指数
 *
 *   指数 = 内径(cm) / BSA(m²)
 *   ≤1.9 正常；1.9–2.1 边缘；>2.1 扩张；>2.6 显著扩张。
 * 另按 ASE 2015 绝对上限提示：男 3.6 cm、女 3.3 cm（升主动脉）。
 *
 * @param {number} dMm 升主动脉内径 mm
 * @param {number} bsa m²
 * @param {boolean} female
 */
function aortaIndex(dMm, bsa, female) {
  if (!(dMm > 0) || !(bsa > 0)) return {};
  const cm = dMm / 10;
  const idx = cm / bsa;
  const hiAbs = female ? 3.3 : 3.6;
  const r = { cm: cm, index: idx, hiAbs: hiAbs };
  if (idx <= 1.9) { r.level = 0; r.text = '指数正常（≤1.9 cm/m²）'; }
  else if (idx <= 2.1) { r.level = 1; r.text = '边缘增宽（1.9–2.1 cm/m²）'; }
  else if (idx <= 2.6) { r.level = 2; r.text = '扩张（>2.1 cm/m²）'; }
  else { r.level = 3; r.text = '显著扩张（>2.6 cm/m²），需密切随访 / 遗传性主动脉病筛查'; }
  r.absText = cm > hiAbs
    ? '绝对值亦超上限（' + (female ? '女' : '男') + ' ' + hiAbs + ' cm）'
    : '绝对值未超上限（' + (female ? '女' : '男') + ' ' + hiAbs + ' cm）';
  return r;
}

/**
 * 成人主动脉分节段参考区间（cm，舒张末，内缘到内缘）
 *
 * 与站内「主动脉」条目同一口径（中国成年人超声心动图检查测量指南）。
 * 四个标准测量位点：瓣环 / 窦部（Valsalva）/ 窦管交界 / 近段升主动脉。
 * 注意：不同指南与国内参考值有 1–2 mm 差异，随访必须用同一参考标准。
 */
const AORTIC_SEGS = [
  { k: 'annulus', n: '主动脉瓣环', sn: '瓣环', ref: { m: [2.3, 2.9], f: [2.1, 2.7] } },
  { k: 'sinus', n: '窦部（Valsalva）', sn: '窦部', ref: { m: [3.0, 3.8], f: [2.7, 3.5] } },
  { k: 'stj', n: '窦管交界', sn: '窦管交界', ref: { m: [2.6, 3.2], f: [2.4, 3.0] } },
  { k: 'asc', n: '近段升主动脉', sn: '升主动脉', ref: { m: [2.7, 3.5], f: [2.5, 3.3] } },
];

/**
 * 主动脉分节段 Z 值
 *
 * ★ 方法学说明（重要）：成人主动脉没有像儿童 PHN 那样的公开 SD 曲线可直接引用，
 *   本函数用「参考区间反推」的近似算法：
 *     均值 = (下限 + 上限) / 2，SD = (上限 − 均值) / 1.96
 *   即假定参考区间为 95% 参考范围（±1.96 SD）。这样得到的 Z 值与临床常用的
 *   「Z > 2 视为扩张」判断口径一致，但**不是人群实测 SD**，不能与儿童 Z 值
 *   或 CT 形态学 Z 值直接互换。界面必须如实标注。
 *
 *   判读：|Z| ≤ 2 参考范围内；2 < Z ≤ 3 轻度扩张；Z > 3 显著扩张；
 *        Z ≤ −2 小于参考下限（多数无临床意义，需结合体型）。
 *   另对近段升主动脉按 BSA 指数化：男 ≥2.1、女 ≥2.0 cm/m² 提示扩张。
 *
 * @param {number[]} mm  依次为 瓣环/窦部/窦管交界/近段升主动脉，单位 mm，可留空
 * @param {boolean} female 女性
 * @param {number} [bsa] 体表面积 m²，用于升主动脉指数
 */
function aorticZscore(mm, female, bsa) {
  const arr = mm || [];
  const out = { segs: [] };
  let any = false;
  AORTIC_SEGS.forEach(function (s, i) {
    const v = arr[i];
    if (!(v > 0)) return;
    any = true;
    const ref = female ? s.ref.f : s.ref.m;
    const mean = (ref[0] + ref[1]) / 2;
    const sd = (ref[1] - mean) / 1.96;
    const cm = v / 10;
    let z = sd > 0 ? (cm - mean) / sd : 0;
    if (Math.abs(z) < 1e-9) z = 0;  // 消掉浮点噪声，避免显示 -0.0
    const r = { k: s.k, n: s.n, sn: s.sn, mm: v, lo: ref[0], hi: ref[1], mean: mean, sd: sd, z: z };
    if (z > 3) { r.level = 3; r.text = '显著扩张（Z >3）'; }
    else if (z > 2) { r.level = 2; r.text = '轻度扩张（Z 2–3）'; }
    else if (z < -2) { r.level = 1; r.text = '小于参考下限（Z ≤ −2）'; }
    else { r.level = 0; r.text = '参考范围内（|Z| ≤ 2）'; }
    out.segs.push(r);
  });
  if (!any) return { error: '至少填写一个位点的内径' };

  let max = out.segs[0];
  out.segs.forEach(function (s) { if (s.z > max.z) max = s; });
  out.maxZ = max.z;
  out.maxName = max.n;
  out.maxSn = max.sn;
  out.level = max.level;
  if (max.level === 3) out.text = '最大 Z ' + max.z.toFixed(1) + '（' + max.sn + '）：显著扩张，评估外科 / 介入时机与遗传性主动脉病';
  else if (max.level === 2) out.text = '最大 Z ' + max.z.toFixed(1) + '（' + max.sn + '）：轻度扩张，缩短随访间隔';
  else if (max.level === 1) out.text = '各位点均未扩张；' + max.sn + '低于参考下限，需结合体型复核';
  else out.text = '各位点均未超参考上限（Z 均 ≤ 2，最大 ' + max.z.toFixed(1) + '）';

  // 升主动脉指数（近段升主动脉 cm / BSA）
  if (arr[3] > 0 && bsa > 0) {
    const idx = (arr[3] / 10) / bsa;
    const hi = female ? 2.0 : 2.1;
    out.ascIndex = idx;
    out.ascIndexHi = hi;
    out.ascIndexText = idx >= hi
      ? '升主动脉指数 ' + idx.toFixed(2) + ' cm/m²（≥' + hi + '）提示扩张'
      : '升主动脉指数 ' + idx.toFixed(2) + ' cm/m²（<' + hi + '）未达扩张';
  }
  return out;
}

/**
 * 应变离散度（MDS，6 壁峰值纵向应变的标准差）
 *
 * 逐壁输入峰值纵向应变（负值，或直接填绝对值均可），算均值与标准差。
 * 参考：健康人 6 壁离散度通常 <4–5%；≥5% 提示区域性收缩差异明显
 * （缺血、淀粉样变、节段性病变、失同步）。
 * 注意：这是「应变值离散度」，不是时间型机械离散度（MAD，需各节段达峰时间）。
 *
 * @param {number[]} vals 峰值纵向应变数组
 */
function strainDispersion(vals) {
  const arr = (vals || []).filter(function (x) { return isFinite(x); })
    .map(function (x) { return Math.abs(x); });
  if (arr.length < 3) return {};
  const n = arr.length;
  const mean = arr.reduce(function (a, b) { return a + b; }, 0) / n;
  const varSum = arr.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0);
  const sd = Math.sqrt(varSum / (n - 1));
  const r = { n: n, mean: mean, sd: sd, min: Math.min.apply(null, arr), max: Math.max.apply(null, arr) };
  if (sd < 4) r.text = '离散度小（<4%）：各壁收缩较均匀';
  else if (sd < 5) r.text = '离散度边缘（4–5%）';
  else r.text = '离散度增大（≥5%）：提示区域性收缩差异，结合节段应变图定位';
  return r;
}

/**
 * 每搏功与功指数（LV stroke work）
 *
 *   SW(g·m) = SV(mL) × MAP(mmHg) × 0.0136
 *   SWi = SW / BSA
 * 正常 SW 约 60–110 g·m；SWi 约 40–60 g·m/m²。
 * 提示：真正的「心肌做功 GWI / GCW / GWE」需压力-应变环与专有软件
 * （GE AFI 等），无法由血压 + GLS 手算，故此处不提供估算值。
 */
function strokeWork(svMl, mapMmhg, bsa) {
  if (!(svMl > 0) || !(mapMmhg > 0)) return {};
  const sw = svMl * mapMmhg * 0.0136;
  const r = { sw: sw };
  if (bsa > 0) r.swi = sw / bsa;
  if (sw < 60) r.text = '每搏功偏低（<60 g·m）：收缩泵功能或前负荷不足';
  else if (sw <= 110) r.text = '每搏功正常（60–110 g·m）';
  else r.text = '每搏功偏高（>110 g·m）：压力或容量负荷增加';
  return r;
}

/** 保留小数（dec 缺省 2 位） */
function round(n, dec) {
  const p = Math.pow(10, dec === undefined ? 2 : dec);
  return Math.round(n * p) / p;
}

/** 格式化：非法值返回 '—' */
/* ════════════════════════════════════════════════════════════════
 * v1.2.8 新增：M 型 / 评分体系 / 介入尺寸
 * ════════════════════════════════════════════════════════════════ */

/**
 * M 型三合一：缩短分数 FS + Teichholz 容积与 EF + EPSS 判读
 * 输入内径为 mm（超声机默认单位），内部换 cm 再套公式
 *   FS = (LVIDd − LVIDs) / LVIDd × 100%
 *   Teichholz：V = 7·D³ / (2.4 + D)（D 为 cm）
 *   EPSS：<7 mm 正常，7–12 可疑，>12 提示 EF 明显减低
 */
function mModeTriple(lviddMm, lvidsMm, epssMm) {
  if (!(lviddMm > 0) || !(lvidsMm > 0)) return { error: '需同时填写 LVIDd 与 LVIDs' };
  if (lvidsMm >= lviddMm) return { error: '收缩末内径应小于舒张末内径，请核对取值' };
  const dd = lviddMm / 10;
  const ds = lvidsMm / 10;
  const fs = (dd - ds) / dd * 100;
  const vol = function (d) { return 7 * Math.pow(d, 3) / (2.4 + d); };
  const edv = vol(dd);
  const esv = vol(ds);
  const ef = (edv - esv) / edv * 100;
  const r = { fs: fs, edv: edv, esv: esv, ef: ef };
  r.fsText = fs < 25 ? 'FS 减低（<25%）'
    : fs > 45 ? 'FS 高于常见区间（>45%），注意高动力状态'
    : 'FS 在常见区间（25–45%）';
  r.efText = ef >= 50 ? 'EF 保留（≥50%）'
    : ef >= 40 ? 'EF 轻度减低（40–49%）'
    : ef >= 30 ? 'EF 中度减低（30–39%）'
    : 'EF 重度减低（<30%）';
  if (epssMm > 0) {
    r.epss = epssMm;
    r.epssText = epssMm < 7 ? 'EPSS 正常（<7 mm）'
      : epssMm <= 12 ? 'EPSS 增大（7–12 mm），结合 EF 与其他指标判读'
      : 'EPSS 明显增大（>12 mm），提示射血分数显著减低';
    if (epssMm > 12 && ef >= 50) {
      r.mismatch = 'EPSS 明显增大而 Teichholz EF 正常：更可能是节段性室壁运动异常或 M 型取样线偏斜，建议以 Simpson 双平面复核';
    }
  }
  return r;
}

/**
 * WMSI 室壁运动积分指数
 * 按各分值节段的个数录入（比逐段填 17 个格子快，也避免漏段）
 *   WMSI = (1·n1 + 2·n2 + 3·n3 + 4·n4 + 5·n5) ÷ 节段总数
 *   1.0 正常；1.0–1.5 轻度；1.5–1.7 中度；≥1.7 重度（大面积缺血，预后差）
 */
function wmsiIndex(counts) {
  const n = counts.map(function (x) { return x > 0 ? x : 0; });
  const total = n.reduce(function (a, b) { return a + b; }, 0);
  if (!total) return { error: '请至少填写一个分值对应的节段个数' };
  let score = 0;
  n.forEach(function (c, i) { score += (i + 1) * c; });
  const w = score / total;
  const r = { total: total, score: score, wmsi: w };
  if (w <= 1.0) { r.level = 0; r.text = '室壁运动正常（WMSI = 1.0）'; }
  else if (w < 1.5) { r.level = 1; r.text = '轻度异常（1.0–1.5）：局限性运动减弱'; }
  else if (w < 1.7) { r.level = 2; r.text = '中度异常（1.5–1.7）：提示较大范围缺血'; }
  else { r.level = 3; r.text = '重度异常（≥1.7）：大面积缺血/梗死，预后差'; }
  return r;
}

/**
 * H2FPEF 评分（心衰杂志 2018，Reddy 等）
 *   BMI >30 → 2；心房颤动 → 3；年龄 >60 → 1；
 *   ≥2 种降压药 → 1；E/e′ >9 → 1；PASP >35 → 1
 *   总分 0–9：≥6 高可能，≤1 低可能，2–5 中间
 */
function h2fpefScore(o) {
  const s = o || {};
  let score = 0;
  const items = [];
  if (s.bmi > 30) { score += 2; items.push(['BMI >30 kg/m²', 2]); }
  if (s.af) { score += 3; items.push(['心房颤动', 3]); }
  if (s.age > 60) { score += 1; items.push(['年龄 >60 岁', 1]); }
  if (s.bpMeds >= 2) { score += 1; items.push(['≥2 种降压药', 1]); }
  if (s.ee > 9) { score += 1; items.push(['E/e′ >9', 1]); }
  if (s.pasp > 35) { score += 1; items.push(['PASP >35 mmHg', 1]); }
  const r = { score: score, items: items };
  r.text = score >= 6 ? 'HFpEF 可能性高（≥6 分），可按 HFpEF 管理'
    : score <= 1 ? 'HFpEF 可能性低（≤1 分），优先排查其他病因'
    : '中间区间（2–5 分）：需负荷超声或侵入性血流动力学进一步评估';
  return r;
}

/**
 * HFA-PEFF 评分（2019 ESC HFA）
 * 形态学 / 功能学 / 生物标志物三类，每类内部取最高分，三类相加（0–6）
 *   ≥5 确诊 HFpEF；2–4 需负荷/侵入性；≤1 基本排除
 */
function hfaPeffScore(o) {
  const s = o || {};
  const female = !!s.female;
  const af = !!s.af;
  // ① 形态学
  let st = 0;
  if (s.lavi >= 40) st = Math.max(st, 2); else if (s.lavi >= 34) st = Math.max(st, 1);
  const lvmiHi = female ? 122 : 149;
  const lvmiLo = female ? 95 : 115;
  if (s.lvmi > lvmiHi) st = Math.max(st, 2); else if (s.lvmi > lvmiLo) st = Math.max(st, 1);
  if (s.rwt > 0.42) st = Math.max(st, 1);
  if (s.pasp > 35) st = Math.max(st, 1);
  // ② 功能学
  let fn = 0;
  if (s.ee >= 15) fn = Math.max(fn, 2); else if (s.ee >= 9) fn = Math.max(fn, 1);
  if ((s.es > 0 && s.es < 7) || (s.el > 0 && s.el < 10)) fn = Math.max(fn, 1);
  if (s.trv > 2.8) fn = Math.max(fn, 1);
  if (s.gls > 0 && s.gls < 16) fn = Math.max(fn, 1);
  // ③ 生物标志物（NT-proBNP，房颤阈值更高）
  let bm = 0;
  const hi = af ? 1500 : 500;
  const lo = af ? 365 : 125;
  if (s.ntprobnp > hi) bm = 2; else if (s.ntprobnp >= lo) bm = 1;
  const total = st + fn + bm;
  const r = { structural: st, functional: fn, biomarker: bm, score: total };
  r.text = total >= 5 ? '支持 HFpEF（≥5 分）'
    : total >= 2 ? '可疑（2–4 分）：需负荷超声或侵入性血流动力学'
    : '基本可排除 HFpEF（≤1 分）';
  return r;
}

/**
 * TAVR 瓣环尺寸与 oversizing
 *   周长导出直径 Dc = C / π
 *   面积导出直径 Da = 2√(A/π)
 *   面积 oversizing = (标称瓣环面积 / 实测瓣环面积 − 1) × 100%
 *   经验区间：自膨胀瓣 10–20%；球囊扩张瓣 −10% ~ +5%
 */
function tavrSizing(circMm, areaMm2, nominalMm) {
  if (!(circMm > 0) && !(areaMm2 > 0)) return { error: '需填写瓣环周长或面积（至少一项）' };
  const r = {};
  if (circMm > 0) r.dc = circMm / Math.PI;
  if (areaMm2 > 0) r.da = 2 * Math.sqrt(areaMm2 / Math.PI);
  if (nominalMm > 0 && areaMm2 > 0) {
    const nominalArea = Math.PI * Math.pow(nominalMm / 2, 2);
    r.areaOver = (nominalArea / areaMm2 - 1) * 100;
    r.nominalArea = nominalArea;
    if (nominalMm > 0 && circMm > 0) r.circOver = (Math.PI * nominalMm / circMm - 1) * 100;
    const o = r.areaOver;
    r.text = o < -10 ? '面积 oversizing 偏小（<−10%），瓣周漏风险升高'
      : o < 0 ? '轻度偏小（−10% ~ 0）：球扩瓣可接受区间'
      : o <= 5 ? '球扩瓣理想区间（0 ~ +5%）'
      : o <= 20 ? '自膨胀瓣理想区间（+5% ~ +20%）'
      : 'oversizing 过大（>20%），注意瓣环破裂与传导阻滞风险';
  } else if (nominalMm > 0) {
    r.hint = '填了标称型号但缺瓣环面积，无法算 oversizing';
  }
  return r;
}

/**
 * 左心耳封堵（Watchman FLX 类）尺寸推荐
 *   着陆区最大径 × 1.08 ~ 1.20 落到常规型号（17/20/24/27/31/35 mm）
 *   深度不足或椭圆度过大时提示复核
 */
function laaSize(lzMax, lzMin, depth) {
  const SIZES = [17, 20, 24, 27, 31, 35];
  if (!(lzMax > 0)) return { error: '需填写着陆区最大径' };
  const r = { lzMax: lzMax };
  if (lzMin > 0) {
    r.ratio = lzMax / lzMin;
    if (r.ratio > 1.3) r.shapeText = '着陆区椭圆度大（长短径比 >1.3），按最大径选型并注意封堵器贴合';
  }
  const need = lzMax * 1.08;
  const pick = SIZES.filter(function (s) { return s >= need; })[0];
  if (!pick) {
    r.text = '着陆区最大径 ' + fmt(lzMax, 1) + ' mm 超出常规型号上限，需按具体产品说明书复核';
  } else {
    r.size = pick;
    r.text = '建议选用 ' + pick + ' mm（按着陆区最大径 ' + fmt(lzMax, 1) +
      ' mm × 1.08 = ' + fmt(need, 1) + ' mm 上取整）';
    if (depth > 0 && depth < pick * 0.8) {
      r.depthWarn = '深度 ' + fmt(depth, 1) + ' mm 小于所选型号的 0.8 倍，可能压缩不足，考虑选小一号或换型';
    }
  }
  return r;
}

/** 反流分数 RF = RVol / SV × 100%（轻 <30，中 30–49，重 ≥50） */
function regurgFraction(rvol, sv) {
  if (!(rvol > 0) || !(sv > 0)) return { error: '需填写反流量与每搏量' };
  if (rvol >= sv) return { error: '反流量不应大于或等于每搏量，请核对' };
  const rf = rvol / sv * 100;
  return {
    rf: rf,
    text: rf < 30 ? '轻度反流（RF <30%）'
      : rf < 50 ? '中度反流（RF 30–49%）'
      : '重度反流（RF ≥50%）',
  };
}

/* ════════════════════════════════════════════════════════════════
 * v1.2.9 第二批：右心与肺循环补全
 * ════════════════════════════════════════════════════════════════ */

/**
 * 右室容积指数（ASE 右心指南，按性别分档）
 *   RVEDVi 上限 男 87 / 女 75 mL/m²；RVESVi 上限 男 44 / 女 35 mL/m²
 */
function rvVolumeIndex(redv, resv, bsa, female) {
  if (!(redv > 0)) return { error: '需填写 RV 舒张末容积' };
  if (!(bsa > 0)) return { error: '需先填写身高体重得到 BSA' };
  const hiEdv = female ? 75 : 87;
  const hiEsv = female ? 35 : 44;
  const edvi = redv / bsa;
  const r = { edvi: edvi, hiEdv: hiEdv };
  r.edvText = edvi > hiEdv ? 'RVEDVi 增大（>' + hiEdv + '）' : 'RVEDVi 正常';
  if (resv > 0) {
    const esvi = resv / bsa;
    r.esvi = esvi;
    r.hiEsv = hiEsv;
    r.esvText = esvi > hiEsv ? 'RVESVi 增大（>' + hiEsv + '）' : 'RVESVi 正常';
  }
  return r;
}

/**
 * 右室游离壁纵向应变 RVFWS：基底、中间、心尖三节段取均值
 * 正常 |均值| ≥20%（即 ≤ −20%）；绝对值 <20% 提示右室纵向收缩减低
 */
function rvFreeWallStrain(b, m, a) {
  const vals = [b, m, a].filter(function (x) {
    return x !== undefined && x !== null && isFinite(x) && x !== 0;
  });
  if (!vals.length) return { error: '需填写至少一个节段的峰值应变' };
  const mean = vals.reduce(function (s, x) { return s + x; }, 0) / vals.length;
  const abs = Math.abs(mean);
  return {
    mean: mean,
    n: vals.length,
    text: abs < 20 ? 'RVFWS 减低（|均值| <20%）' : 'RVFWS 在正常范围（|均值| ≥20%）',
  };
}

/**
 * PAPi 肺动脉搏动指数 = (sPAP − dPAP) / RAP
 * <1.85 提示右室-肺循环失耦联（肺高压 / 心衰预后差）
 */
function pulmonaryPulseIndex(spap, dpap, rap) {
  if (!(spap > 0) || !(dpap > 0) || !(rap > 0)) {
    return { error: '需填写 sPAP、dPAP 与 RAP' };
  }
  if (dpap >= spap) return { error: '舒张压不应高于收缩压，请核对' };
  const v = (spap - dpap) / rap;
  return {
    papi: v,
    text: v < 1.85 ? 'PAPi 减低（<1.85）：右室-肺循环失耦联，预后差'
      : v < 2.0 ? 'PAPi 边缘（1.85–2.0）'
      : 'PAPi 保留（≥2.0）',
  };
}

/** 舒张期肺动脉压 PADP = 4 × V(PR 舒张末)² + RAP */
function pulmonaryDiastolicPressure(prVmax, rap) {
  if (!(prVmax > 0)) return { error: '需填写 PR 舒张末期反流速度' };
  const padp = 4 * prVmax * prVmax + (rap > 0 ? rap : 0);
  return { padp: padp, grad: 4 * prVmax * prVmax };
}

/**
 * 阻力指数化
 *   PVRI = PVR(WU) × BSA，正常 3–5 WU·m²，>5 显著升高
 *   SVRI = SVR(dyn·s·cm⁻⁵) × BSA，正常约 1970–2390 dyn·s·cm⁻⁵·m²
 */
function resistanceIndices(pvrWu, svrDyn, bsa) {
  if (!(bsa > 0)) return { error: '需先填写身高体重得到 BSA' };
  const r = {};
  if (pvrWu > 0) {
    r.pvri = pvrWu * bsa;
    r.pvriText = r.pvri > 5
      ? 'PVRI >5 WU·m²：肺血管阻力显著升高，注意右心失代偿'
      : 'PVRI ≤5 WU·m²（正常 3–5）';
  }
  if (svrDyn > 0) {
    r.svri = svrDyn * bsa;
    r.svriText = r.svri > 2390 ? 'SVRI 升高（>2390）：体循环阻力偏高'
      : r.svri < 1970 ? 'SVRI 偏低（<1970）：注意血管扩张状态 / 脓毒症'
      : 'SVRI 正常（1970–2390）';
  }
  if (r.pvri === undefined && r.svri === undefined) {
    return { error: '需填写 PVR 或 SVR' };
  }
  return r;
}

/**
 * 右室压力上升速率 dP/dt（TR 反流谱 1→2 m/s）
 *   ΔP = 4×2² − 4×1² = 12 mmHg，dP/dt = 12 / Δt(s)
 *   <400 mmHg/s 提示右室收缩功能减低
 */
function rvDpDt(dtMs) {
  if (!(dtMs > 0)) return { error: '需填写 1→2 m/s 的时间差' };
  const v = 12 / (dtMs / 1000);
  return {
    dpdt: v,
    text: v < 400 ? 'RV dP/dt 减低（<400 mmHg/s）' : 'RV dP/dt 保留（≥400 mmHg/s）',
  };
}

/* ════════════════════════════════════════════════════════════════
 * v1.3.0 第三批：瓣膜与舒张细节
 * ════════════════════════════════════════════════════════════════ */

/**
 * Wilkins 二尖瓣形态评分：四项 × 1–4 分，总分 4–16
 *
 *   按原始文献顺序：① 瓣叶活动度 ② 瓣叶增厚 ③ 瓣叶钙化 ④ 瓣下增厚
 *   每一项的 1/2/3/4 分都有明确的形态学定义（见 WILKINS_ITEMS），
 *   评分靠对照描述打，不是凭感觉给个数字——这也是它主观性大的根源，
 *   建议由有经验的医师复核，并在报告里写明哪一项扣分最多。
 *
 *   ≤8 适合 PBMV；9–11 边缘区需个体化；≥12 优先外科
 */
const WILKINS_ITEMS = [
  {
    k: 'wk1', n: '瓣叶活动度', en: 'Mobility',
    levels: [
      '瓣叶活动良好，仅瓣尖部受限',
      '瓣叶中部与基底部活动正常，瓣尖及部分中部受限',
      '瓣叶仅基底部有活动',
      '瓣叶无活动，全部僵硬',
    ],
  },
  {
    k: 'wk2', n: '瓣叶增厚', en: 'Thickening',
    levels: [
      '接近正常（≤3 mm）',
      '边缘增厚 4–5 mm，中部正常',
      '中部增厚 5–8 mm，边缘正常',
      '全部增厚 >8 mm',
    ],
  },
  {
    k: 'wk3', n: '瓣叶钙化', en: 'Calcification',
    levels: [
      '无钙化，或仅单个小钙化点',
      '散在钙化，局限于瓣叶边缘',
      '钙化延伸至瓣叶中部',
      '大部分瓣叶钙化',
    ],
  },
  {
    k: 'wk4', n: '瓣下增厚', en: 'Subvalvular',
    levels: [
      '瓣下腱索轻度增厚，长度正常',
      '腱索增厚累及近端 1/3',
      '腱索增厚累及远端 1/3',
      '全部腱索增厚缩短，并累及乳头肌',
    ],
  },
];

function wilkinsScore(mobility, thick, calc, subvalv) {
  const arr = [mobility, thick, calc, subvalv];
  const ok = arr.every(function (x) { return x >= 1 && x <= 4; });
  if (!ok) return { error: '四项均需填 1–4 分（1 最轻、4 最重）' };
  const total = arr.reduce(function (a, b) { return a + b; }, 0);
  const items = WILKINS_ITEMS.map(function (it, i) {
    return {
      k: it.k,
      n: it.n,
      score: arr[i],
      desc: it.levels[arr[i] - 1],
    };
  });
  // 扣分最多的那一项：PBMV 前最该关注的形态限制
  let worst = items[0];
  items.forEach(function (it) { if (it.score > worst.score) worst = it; });
  let text;
  let level;
  if (total <= 8) {
    level = 1;
    text = 'Wilkins ≤8：瓣膜形态适合经皮球囊二尖瓣成形（PBMV）';
  } else if (total <= 11) {
    level = 2;
    text = 'Wilkins 9–11：边缘区，需结合年龄、合并症与外科风险个体化决定';
  } else {
    level = 3;
    text = 'Wilkins ≥12：形态差，优先外科';
  }
  return {
    total: total,
    items: items,
    level: level,
    worst: worst.n,
    worstText: '扣分最多的是「' + worst.n + '」（' + worst.score + ' 分：' + worst.desc + '）',
    text: text,
  };
}

/**
 * 缩流颈宽度 VCW 分级（MR / TR 与 AR 阈值不同）
 *   MR / TR：<3 轻度，3–6.9 中度，≥7 重度（mm）
 *   AR：    <3 轻度，3–5.9 中度，≥6 重度
 */
function vcwGrade(vcwMm, site) {
  if (!(vcwMm > 0)) return { error: '需填写缩流颈宽度' };
  const ar = site === 'ar';
  const tr = site === 'tr';
  const hiCut = ar ? 6 : 7;
  const name = ar ? 'AR' : tr ? 'TR' : 'MR';
  let level = 1;
  let text = '轻度（<3 mm）';
  if (vcwMm >= hiCut) { level = 3; text = '重度（≥' + hiCut + ' mm）'; }
  else if (vcwMm >= 3) { level = 2; text = '中度（3–' + (hiCut === 6 ? '5.9' : '6.9') + ' mm）'; }
  return { vcw: vcwMm, site: name, level: level, text: name + ' ' + text };
}

/**
 * 左房排空分数 LAEF 与扩张指数
 *   LAEF = (LAVmax − LAVmin) / LAVmax × 100%，正常 ≥50%
 *   扩张指数 = (LAVmax − LAVmin) / LAVmin × 100%
 */
function laEmptying(lavMax, lavMin) {
  if (!(lavMax > 0) || !(lavMin > 0)) return { error: '需填写 LA 最大与最小容积' };
  if (lavMin >= lavMax) return { error: '最小容积应小于最大容积，请核对' };
  const laef = (lavMax - lavMin) / lavMax * 100;
  const expand = (lavMax - lavMin) / lavMin * 100;
  return {
    laef: laef,
    expand: expand,
    text: laef >= 50 ? 'LAEF 保留（≥50%）'
      : laef >= 35 ? 'LAEF 轻度减低（35–49%）'
      : 'LAEF 明显减低（<35%），提示左房机械功能受损',
  };
}

/**
 * 快速比值：LA/Ao（正常 ≤1.1）、RV/LV 舒张末内径比（>0.6 提示右室扩大）
 * 单位任意但需同组一致
 */
function quickRatios(la, ao, rv, lv) {
  const r = {};
  if (la > 0 && ao > 0) {
    r.laAo = la / ao;
    r.laAoText = r.laAo > 1.1 ? 'LA/Ao 增大（>1.1）' : 'LA/Ao 正常（≤1.1）';
  }
  if (rv > 0 && lv > 0) {
    r.rvLv = rv / lv;
    r.rvLvText = r.rvLv > 0.6 ? 'RV/LV >0.6：右室扩大' : 'RV/LV 正常（≤0.6）';
  }
  if (r.laAo === undefined && r.rvLv === undefined) {
    return { error: '需至少填一组数值（LA 与 Ao，或 RV 与 LV）' };
  }
  return r;
}

/**
 * 左室质量按身高^2.7 指数化（de Simone）
 *   男 >50、女 >47 g/m^2.7 提示左室肥厚；肥胖患者比 BSA 指数更可靠
 */
function lvmHeightIndex(massG, heightCm, female) {
  if (!(massG > 0) || !(heightCm > 0)) return { error: '需填写左室质量与身高' };
  const h = heightCm / 100;
  const idx = massG / Math.pow(h, 2.7);
  const hi = female ? 47 : 50;
  return {
    index: idx,
    hi: hi,
    text: idx > hi ? 'LVMI/height^2.7 升高（> ' + hi + '）' : '正常（≤ ' + hi + '）',
  };
}

/* ════════════════════════════════════════════════════════════════
 * v1.3.0 第四批：先心 / 心肌 / 心室-动脉耦联
 * ════════════════════════════════════════════════════════════════ */

/**
 * McGoon 比值与 Nakata 肺动脉指数（先心根治可行性）
 *   McGoon = (RPA + LPA) ÷ 膈肌水平降主动脉，≥1.8 可考虑根治
 *   Nakata = π(RPA/2)² + π(LPA/2)² 之和 ÷ BSA，≥150 mm²/m² 可考虑根治
 */
function paIndex(rpa, lpa, dao, bsa) {
  if (!(rpa > 0) || !(lpa > 0)) return { error: '需填写左右肺动脉直径' };
  const total = rpa + lpa;
  const r = { total: total };
  if (dao > 0) {
    r.mcgoon = total / dao;
    r.mcgoonText = r.mcgoon >= 1.8
      ? 'McGoon ≥1.8：肺动脉发育可，考虑根治'
      : 'McGoon <1.8：肺动脉发育不足，需评估分期手术';
  }
  if (bsa > 0) {
    const area = Math.PI * (Math.pow(rpa / 2, 2) + Math.pow(lpa / 2, 2));
    r.nakata = area / bsa;
    r.nakataText = r.nakata >= 150
      ? 'Nakata ≥150 mm²/m²：可考虑根治'
      : 'Nakata <150 mm²/m²：肺动脉发育不足';
  }
  if (r.mcgoon === undefined && r.nakata === undefined) {
    return { error: '还需填写降主动脉内径或身高体重（BSA）' };
  }
  return r;
}

/**
 * 心尖保留比值 RAS = |心尖段平均应变| ÷ |基底段平均应变|
 * ≥1 提示心尖相对保留（心肌淀粉样变的典型表现）
 */
function apicalSparing(apicalAvg, basalAvg) {
  const a = Math.abs(apicalAvg || 0);
  const b = Math.abs(basalAvg || 0);
  if (!(a > 0)) return { error: '需填写心尖段平均应变' };
  if (!(b > 0)) return { error: '基底段应变不能为 0' };
  const ras = a / b;
  return {
    ras: ras,
    text: ras >= 1
      ? 'RAS ≥1：存在相对心尖保留（提示心肌淀粉样变，需结合其他征象）'
      : 'RAS <1：无相对心尖保留',
  };
}

/**
 * 有效动脉弹性 Ea 与单点 Ees/Ea（心室-动脉耦联）
 *   Ea = ESP / SV（mmHg/mL）
 *   单点 Ees ≈ ESP / ESV（V0 取 0），故 Ees/Ea = SV / ESV
 *   常见区间 0.8–1.5；心衰时下降
 */
function ventriculoArterial(esp, sv, esv) {
  if (!(esp > 0) || !(sv > 0) || !(esv > 0)) {
    return { error: '需填写收缩末压、每搏量与收缩末容积' };
  }
  const ea = esp / sv;
  const ees = esp / esv;
  const ratio = sv / esv;
  return {
    ea: ea,
    ees: ees,
    ratio: ratio,
    text: ratio < 0.8 ? 'Ees/Ea <0.8：耦联不足（收缩力相对后负荷偏低）'
      : ratio > 1.5 ? 'Ees/Ea >1.5：耦联偏向后负荷（收缩力相对充足）'
      : 'Ees/Ea 在常见区间（0.8–1.5）',
    note: '单点法估算（V0 取 0），仅作趋势参考，不能替代压力-容积环',
  };
}

/**
 * 主动脉缩窄 CoA：峰值压差与舒张期拖尾
 *   压差 = 4 × Vmax²；舒张末期仍有明显压差说明存在持续跨缩窄血流（拖尾征）
 */
function coarctationEcho(vmax, vEndDiastolic) {
  if (!(vmax > 0)) return { error: '需填写缩窄处峰值流速' };
  const grad = 4 * vmax * vmax;
  const r = { grad: grad };
  if (vEndDiastolic > 0) {
    r.endGrad = 4 * vEndDiastolic * vEndDiastolic;
    r.continuum = r.endGrad >= 5
      ? '舒张末期仍有 ' + fmt(r.endGrad, 0) + ' mmHg 压差：舒张期持续血流（拖尾征），提示有血流动力学意义'
      : '舒张末期压差小，拖尾征不明显';
  }
  r.text = grad >= 20 ? '峰值压差 ≥20 mmHg：提示有血流动力学意义的缩窄'
    : grad >= 10 ? '压差 10–19 mmHg：轻度，需结合形态与舒张期拖尾综合判断'
    : '压差 <10 mmHg：无明显狭窄';
  return r;
}

function fmt(n, dec) {
  if (n === undefined || n === null || !isFinite(n)) return '—';
  return Number(n).toFixed(dec === undefined ? 2 : dec);
}

/* ════════════════════════════════════════════════════════════════
 * v1.3.2 新增：E/Vp · 左房僵硬度 · VTI 比 · 致密化比 · 肺高压概率
 *   补的是「跨指标派生量」——现有 53 项里每个单项都能算，
 *   但把两项凑成一个判读量的算法一直缺，而报告里恰恰要写这个结论。
 * ════════════════════════════════════════════════════════════════ */

/**
 * E/Vp（E 峰流速 / 血流传播速度）
 *   Vp 用彩色 M 型在四腔切面测（cm/s）；E 峰也用 cm/s，同单位相除
 *   正常 E/Vp ≤1.5；>1.5 提示 PCWP >15 mmHg；>2.5 提示 >18 mmHg
 *   Vp 本身 <45 cm/s 即提示左室松弛受损
 *   Vp 正常而 E/Vp 升高时，E 峰是被容量负荷或 MR 抬起来的，不是松弛问题
 */
function evpRatio(eCm, vpCm) {
  if (!(eCm > 0) || !(vpCm > 0)) return { error: '需填写 E 峰速度与 Vp（都用 cm/s）' };
  const r = eCm / vpCm;
  const out = {
    ratio: r,
    vp: vpCm,
    vpText: vpCm < 45 ? 'Vp <45 cm/s：左室松弛受损' : 'Vp 正常（≥45 cm/s）',
  };
  if (r > 2.5) { out.level = 3; out.text = 'E/Vp >2.5（约 PCWP >18 mmHg）：左房压明显升高'; }
  else if (r > 1.5) { out.level = 2; out.text = 'E/Vp >1.5（约 PCWP >15 mmHg）：左房压升高'; }
  else { out.level = 1; out.text = 'E/Vp 正常（≤1.5）'; }
  if (vpCm >= 45 && r > 1.5) {
    out.note = 'Vp 正常而 E/Vp 仍高：E 峰多半被容量负荷或二尖瓣反流抬高，别直接判「松弛受损」，先看 LA 容积与 TR 速度';
  }
  return out;
}

/**
 * 左房僵硬度 LA stiffness = E/e′ ÷ LARS
 *   LARS 填正数百分值（如 25 表示 25%），不再额外乘 100
 *   ≤0.47 正常；>0.47 提示左房僵硬（HFpEF 的独立预测因子）；>0.60 明显升高
 *   意义：E/e′ 只反映压力，除以泵血效能才反映「心房壁有多硬」
 */
function laStiffness(ee, larsPct) {
  if (!(ee > 0) || !(larsPct > 0)) return { error: '需填写 E/e′ 与 LARS（LARS 填正数百分值）' };
  const st = ee / larsPct;
  const out = { ee: ee, lars: larsPct, stiffness: st };
  if (st > 0.6) { out.level = 3; out.text = 'LA stiffness >0.60：左房明显僵硬，HFpEF 可能性高'; }
  else if (st > 0.47) { out.level = 2; out.text = 'LA stiffness >0.47：左房僵硬，支持 HFpEF'; }
  else { out.level = 1; out.text = 'LA stiffness 正常（≤0.47）'; }
  if (larsPct < 18) out.note = 'LARS 本身已明显减低（<18%），比值可能被「分母小」放大，需结合 LA 容积确认';
  return out;
}

/**
 * RVOT / LVOT 的 VTI 比（无分流时的 Qp/Qs 替代）
 *   正常 0.7–1.05；>1.2 提示左向右分流；<0.6 提示肺血流减少
 *   比直接算 Qp/Qs 稳：不需要测两处直径（直径平方误差被放大两次）
 */
function vtiRatio(rvotVti, lvotVti) {
  if (!(rvotVti > 0) || !(lvotVti > 0)) return { error: '需填写 RVOT 与 LVOT 的 VTI（同单位）' };
  const r = rvotVti / lvotVti;
  const out = { ratio: r };
  if (r > 1.2) { out.level = 3; out.text = 'RVOT/LVOT VTI >1.2：提示左向右分流，可近似当作 Qp/Qs'; }
  else if (r > 1.05) { out.level = 2; out.text = 'VTI 比 1.05–1.2：临界，小量左向右分流可能'; }
  else if (r < 0.6) { out.level = 2; out.text = 'VTI 比 <0.6：肺血流低于体循环，考虑右向左分流或肺动脉血流受限'; }
  else { out.level = 1; out.text = 'VTI 比正常（0.7–1.05）'; }
  return out;
}

/**
 * 左室心肌致密化不全：非致密层 / 致密层厚度比
 *   Jenni（超声，收缩末期短轴）>2.0；Petersen（CMR，舒张末期）>2.3
 *   ★ 单靠比值不能确诊——三个条件缺一不可：
 *     ① 两层结构分明（致密薄层 + 非致密厚层）
 *     ② NC/C 超阈值
 *     ③ 深陷隐窝与左室腔血流相通（彩色多普勒可见穿入血流）
 */
function lvncRatio(ncMm, compMm) {
  if (!(ncMm > 0) || !(compMm > 0)) return { error: '需填写非致密层与致密层厚度（同一部位、同一时相）' };
  const r = ncMm / compMm;
  const out = { ratio: r, nc: ncMm, comp: compMm };
  if (r > 2.3) { out.level = 3; out.text = 'NC/C >2.3：同时满足 Jenni 与 Petersen 阈值，符合致密化不全的形态标准'; }
  else if (r > 2.0) { out.level = 2; out.text = 'NC/C 2.0–2.3：满足超声（Jenni）阈值，未达 CMR 阈值，需结合隐窝血流确认'; }
  else { out.level = 1; out.text = 'NC/C ≤2.0：未达致密化不全的形态阈值'; }
  out.note = '比值必须同部位同时相；把乳头肌与小梁误当非致密层是假阳性最常见的原因';
  return out;
}

/**
 * 超声肺高压可能性（2022 ESC/ERS 三步法）
 *   trVmax ≤2.8 且无右心征象 → 低
 *   trVmax ≤2.8 有征象 / 2.9–3.4 无征象 → 中
 *   2.9–3.4 有征象 / >3.4（无论有无）→ 高
 *   右心征象：RV/LV >1、室间隔变平或矛盾运动、RVOT 加速时间 <105 ms、
 *             右房面积 >18 cm²、IVC >21 mm 不塌陷、收缩期切迹
 *   ★ 这只是「可能性」，确诊必须右心导管（mPAP >20 mmHg）
 */
function phLikelihood(trVmax, hasSigns, rvotAt) {
  const signs = !!hasSigns;
  const atLow = rvotAt > 0 && rvotAt < 105;
  const out = { vmax: trVmax, signs: signs };
  if (!(trVmax > 0)) {
    if (signs || atLow) {
      out.level = 2;
      out.prob = '中';
      out.text = '无可用 TR 流速，但存在右心负荷征象：肺高压可能性中等，需设法测 TR / 肺动脉反流速度';
    } else {
      out.level = 1;
      out.prob = '低';
      out.text = '无可用 TR 流速且无右心征象：暂不能评估，建议多切面试 TR';
    }
    return out;
  }
  if (trVmax > 3.4) {
    out.level = 3; out.prob = '高';
    out.text = 'TR Vmax ' + trVmax.toFixed(1) + ' m/s >3.4：肺高压可能性高';
  } else if (trVmax > 2.8) {
    if (signs || atLow) { out.level = 3; out.prob = '高'; out.text = 'TR Vmax 2.9–3.4 伴右心征象：肺高压可能性高'; }
    else { out.level = 2; out.prob = '中'; out.text = 'TR Vmax 2.9–3.4 无右心征象：肺高压可能性中等'; }
  } else {
    if (signs || atLow) { out.level = 2; out.prob = '中'; out.text = 'TR Vmax ≤2.8 但存在右心征象：肺高压可能性中等'; }
    else { out.level = 1; out.prob = '低'; out.text = 'TR Vmax ≤2.8 且无右心征象：肺高压可能性低'; }
  }
  if (atLow) out.atText = 'RVOT 加速时间 ' + Math.round(rvotAt) + ' ms（<105 ms）：支持肺血管阻力升高';
  out.note = '超声只给「可能性」，确诊需右心导管（mPAP >20 mmHg）；TR 速度受血容量、心律、右室流出道形态影响，别单指标定论';
  return out;
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
  mvaBoth,
  gradeMva,
  pmbvSuit,
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
  ebsteinIndex,
  // —— v1.2.4 新增：右心 / 阻力 / 瓣膜定量 / 重构 / 做功 ——
  paspGrade,
  rapEstimate,
  pvrResistance,
  svrResistance,
  eoaPpm,
  volumeIndices,
  relativeWallStress,
  sphericityIndex,
  laStrainTri,
  aortaIndex,
  AORTIC_SEGS,
  aorticZscore,
  strainDispersion,
  strokeWork,
  // —— v1.2.8 新增：M 型 / 评分体系 / 介入尺寸 ——
  mModeTriple,
  wmsiIndex,
  h2fpefScore,
  hfaPeffScore,
  tavrSizing,
  laaSize,
  regurgFraction,
  // —— v1.2.9 第二批：右心与肺循环 ——
  rvVolumeIndex,
  rvFreeWallStrain,
  pulmonaryPulseIndex,
  pulmonaryDiastolicPressure,
  resistanceIndices,
  rvDpDt,
  // —— v1.3.0 第三批：瓣膜与舒张细节 ——
  WILKINS_ITEMS,
  wilkinsScore,
  vcwGrade,
  laEmptying,
  quickRatios,
  lvmHeightIndex,
  // —— v1.3.2 新增：跨指标派生量 ——
  evpRatio,
  laStiffness,
  vtiRatio,
  lvncRatio,
  phLikelihood,
  // —— v1.3.0 第四批：先心 / 心肌 / 耦联 ——
  paIndex,
  apicalSparing,
  ventriculoArterial,
  coarctationEcho,
  round,
  fmt,
};

