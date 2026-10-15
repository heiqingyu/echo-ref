/**
 * 儿童（0–18 岁）超声心动图 Z 值计算引擎
 *
 * ── 为什么儿童要单独一套？ ──────────────────────────────────────────
 * 儿童心脏尺寸随生长剧烈变化，用「固定正常值区间」判断必然失真
 * （新生儿 LVEDD 2 cm 是正常，成人 2 cm 是严重缩小）。
 * 国际通行做法是把测值按体表面积 BSA 标准化后算 **Z 值**：
 *
 *      Z = ( 实测值 − Mean × BSA^α ) / ( SD × BSA^α )
 *        = ( 实测值 / BSA^α − Mean ) / SD      ← 本模块采用此式
 *
 * 即：先把测值除以 BSA^α 得到「指数化测值」，再与「指数化均值」比较。
 * Z = 0 对应人群均值，Z = ±1 / ±2 / ±3 对应 ±1 / ±2 / ±3 个标准差。
 *
 * 判定阈值（国际共识）：
 *   |Z| ≤ 2        正常
 *   2 < |Z| ≤ 3    轻度异常（轻度增大 / 轻度缩小）
 *   |Z| > 3        显著异常
 *
 * ── 数据来源 ───────────────────────────────────────────────────────
 *  Pediatric Heart Network（PHN）Normal Echocardiogram Database
 *  Lopez L, Colan S, et al. Circ Cardiovasc Imaging. 2017;10(11):e006979.
 *  n = 3566，0–18 岁健康非肥胖儿童，19 个中心，Core Lab 统一测量。
 *  系数表公开于 https://www.pediatricheartnetwork.org/forresearchers/echo-z-scores/
 *
 *  LVESD / LVESV 两项系数来自该数据库的后续补充发表：
 *  Cantinotti M, et al. / PHN 方法论扩展（PMC7870534）
 *  "Pediatric Heart Network Echocardiographic Z-Scores: Comparison to Other
 *   Published Models"  Table 3：
 *      LVESD (cm) α=0.5  Mean=2.675 SD=0.352
 *      LVESV (mL) α=1.3  Mean=25.76 SD=5.551
 *
 *  该研究最重要的结论：**Z 值不受年龄、性别、种族影响**
 *  （统计上显著，但差异 < 5%，低于测量者间变异，临床上可忽略）。
 *  因此本模块 **不区分性别**，一套系数通吃全部儿童。
 *
 *  同源前身：Pettersen MD, et al. JASE 2008;21(8):922-934（波士顿儿童医院
 *  Z 值评分系统即基于此），n=782，覆盖 21 个心脏结构。
 *
 * ── BSA 公式 ───────────────────────────────────────────────────────
 *  儿科推荐 **Haycock** 公式（PHN 原始研究所用）：
 *      BSA(m²) = 0.024265 × 身高(cm)^0.3964 × 体重(kg)^0.5378
 *
 * 免责声明：本模块仅用于数值参考，不构成任何医疗诊断依据。
 */

/* ------------------------------------------------------------------ *
 * 1. 体表面积 BSA —— 儿科专用
 * ------------------------------------------------------------------ */

/**
 * Haycock 公式（儿科首选，PHN 研究采用）
 * @param {number} heightCm 身高 cm
 * @param {number} weightKg 体重 kg
 * @returns {number} BSA m²
 */
function bsaHaycock(heightCm, weightKg) {
  return 0.024265 * Math.pow(heightCm, 0.3964) * Math.pow(weightKg, 0.5378);
}

/**
 * 按年龄估算儿童 BSA（仅用于缺身高体重时的粗估，不推荐）
 * 经验式：BSA ≈ 0.05 × 体重(kg) + 0.05（1–20 kg 区间近似）
 * @param {number} weightKg
 */
function bsaApproxByWeight(weightKg) {
  return 0.05 * weightKg + 0.05;
}

/* ------------------------------------------------------------------ *
 * 2. PHN 2023/Lopez 2017 回归系数表
 *
 * 每项为 [α, Mean, SD]：
 *   α    BSA 的指数（把非线性生长关系线性化）
 *   Mean 指数化均值，即 Mean(X / BSA^α)
 *   SD   指数化标准差
 *
 * ⚠️ 单位：本表沿用 PHN 原文单位 —— 内径 **cm**、容积 **cm³(mL)**、
 *    质量 **g**、面积 **cm²**、比例 **无量纲**。
 *    界面用 mm 输入的参数需由调用方先 ÷10，或由 zScore 的 unitIn 处理。
 * ------------------------------------------------------------------ */

const PEDS_Z = {
  // ── 左心室结构（M 型 / 二维短轴）────────────────────────────
  LVEDD:  { a: 0.45, mean: 3.89,  sd: 0.33,  unit: 'cm', name: '左室舒张末期内径' },
  LVESD:  { a: 0.50, mean: 2.675, sd: 0.352, unit: 'cm', name: '左室收缩末期内径' },
  LVST:   { a: 0.40, mean: 0.58,  sd: 0.09,  unit: 'cm', name: '室间隔舒张末期厚度' },
  LVPWT:  { a: 0.40, mean: 0.57,  sd: 0.09,  unit: 'cm', name: '左室后壁舒张末期厚度' },

  // ── 左心室容积与质量 ────────────────────────────────────────
  LVEDV:  { a: 1.30, mean: 62.02, sd: 11.94, unit: 'mL', name: '左室舒张末期容积' },
  LVESV:  { a: 1.30, mean: 25.76, sd: 5.551, unit: 'mL', name: '左室收缩末期容积' },
  LVM:    { a: 1.25, mean: 53.02, sd: 9.06,  unit: 'g',  name: '左室质量' },

  // ── 左心室长轴长度 / 面积 ───────────────────────────────────
  LVEDL:  { a: 0.45, mean: 6.31,  sd: 0.46,  unit: 'cm', name: '左室舒张末期长径' },
  LVEDA:  { a: 0.90, mean: 11.91, sd: 1.89,  unit: 'cm²', name: '左室舒张末期面积(心内膜)' },

  // ── 主动脉 ─────────────────────────────────────────────────
  ANN:    { a: 0.50, mean: 1.48,  sd: 0.14,  unit: 'cm', name: '主动脉瓣环内径' },
  ROOT:   { a: 0.50, mean: 2.06,  sd: 0.18,  unit: 'cm', name: '主动脉窦部内径' },
  STJ:    { a: 0.50, mean: 1.69,  sd: 0.16,  unit: 'cm', name: '主动脉窦管交界内径' },
  AAO:    { a: 0.50, mean: 1.79,  sd: 0.18,  unit: 'cm', name: '升主动脉内径' },
  ARCHP:  { a: 0.50, mean: 1.53,  sd: 0.23,  unit: 'cm', name: '主动脉弓近端内径' },
  ARCHD:  { a: 0.50, mean: 1.36,  sd: 0.19,  unit: 'cm', name: '主动脉弓远端内径' },
  ISTH:   { a: 0.50, mean: 1.25,  sd: 0.18,  unit: 'cm', name: '主动脉峡部内径' },

  // ── 冠状动脉 ───────────────────────────────────────────────
  LMCA:   { a: 0.45, mean: 2.95,  sd: 0.57,  unit: 'mm', name: '左主干内径' },
  LAD:    { a: 0.45, mean: 1.90,  sd: 0.34,  unit: 'mm', name: '左前降支近段内径' },
  RCA:    { a: 0.45, mean: 2.32,  sd: 0.55,  unit: 'mm', name: '右冠状动脉近段内径' },

  // ── 肺动脉 ─────────────────────────────────────────────────
  PVSAX:  { a: 0.50, mean: 1.91,  sd: 0.24,  unit: 'cm', name: '肺动脉瓣环短轴内径' },
  PVLAX:  { a: 0.50, mean: 2.01,  sd: 0.28,  unit: 'cm', name: '肺动脉瓣环长轴内径' },
  MPA:    { a: 0.50, mean: 1.82,  sd: 0.24,  unit: 'cm', name: '主肺动脉内径' },
  RPA:    { a: 0.50, mean: 1.07,  sd: 0.18,  unit: 'cm', name: '右肺动脉内径' },
  LPA:    { a: 0.50, mean: 1.10,  sd: 0.18,  unit: 'cm', name: '左肺动脉内径' },

  // ── 二尖瓣 ─────────────────────────────────────────────────
  MVAP:   { a: 0.50, mean: 2.31,  sd: 0.24,  unit: 'cm',  name: '二尖瓣环前后径' },
  MVLAT:  { a: 0.50, mean: 2.23,  sd: 0.22,  unit: 'cm',  name: '二尖瓣环侧径' },
  MVA:    { a: 1.00, mean: 4.06,  sd: 0.68,  unit: 'cm²', name: '二尖瓣环面积' },

  // ── 三尖瓣 ─────────────────────────────────────────────────
  TVAP:   { a: 0.50, mean: 2.36,  sd: 0.28,  unit: 'cm',  name: '三尖瓣环前后径' },
  TVLAT:  { a: 0.50, mean: 2.36,  sd: 0.29,  unit: 'cm',  name: '三尖瓣环侧径' },
  TVA:    { a: 1.00, mean: 4.39,  sd: 0.83,  unit: 'cm²', name: '三尖瓣环面积' },

  // ── 形态比例指标（α = 0，不随 BSA 变化）────────────────────
  LVMTV:  { a: 0,    mean: 0.88,  sd: 0.16,  unit: '',    name: '左室质量/容积比' },
  LVTTD:  { a: 0,    mean: 0.15,  sd: 0.03,  unit: '',    name: '左室壁厚/内径比' },
  LVSI:   { a: 0,    mean: 1.63,  sd: 0.17,  unit: '',    name: '左室球形指数' },
};

/** 展示分组（保持临床阅读顺序） */
const PEDS_GROUPS = [
  { title: '左心室结构', keys: ['LVEDD', 'LVESD', 'LVST', 'LVPWT'] },
  { title: '左心室容积与质量', keys: ['LVEDV', 'LVESV', 'LVM'] },
  { title: '左心室长径与面积', keys: ['LVEDL', 'LVEDA'] },
  { title: '主动脉', keys: ['ANN', 'ROOT', 'STJ', 'AAO', 'ARCHP', 'ARCHD', 'ISTH'] },
  { title: '冠状动脉', keys: ['LMCA', 'LAD', 'RCA'] },
  { title: '肺动脉', keys: ['PVSAX', 'PVLAX', 'MPA', 'RPA', 'LPA'] },
  { title: '二尖瓣', keys: ['MVAP', 'MVLAT', 'MVA'] },
  { title: '三尖瓣', keys: ['TVAP', 'TVLAT', 'TVA'] },
  { title: '形态比例', keys: ['LVMTV', 'LVTTD', 'LVSI'] },
];

/** 所有参数键（按分组顺序打平） */
const PEDS_FIELDS = PEDS_GROUPS.reduce(function (acc, g) {
  return acc.concat(g.keys);
}, []);

/* ------------------------------------------------------------------ *
 * 3. Z 值计算
 * ------------------------------------------------------------------ */

/**
 * 计算指数化均值：Mean(BSA) = Mean × BSA^α
 * @param {string} key   参数键
 * @param {number} bsa   体表面积 m²
 * @returns {number}
 */
function indexedMean(key, bsa) {
  const def = PEDS_Z[key];
  if (!def) return NaN;
  return def.mean * Math.pow(bsa, def.a);
}

/**
 * 计算指数化标准差：SD(BSA) = SD × BSA^α
 */
function indexedSD(key, bsa) {
  const def = PEDS_Z[key];
  if (!def) return NaN;
  return def.sd * Math.pow(bsa, def.a);
}

/**
 * 核心：Z = (X / BSA^α − Mean) / SD
 *
 * @param {number} value 实测值（单位须与 PEDS_Z[key].unit 一致）
 * @param {string} key   参数键，如 'LVEDD'
 * @param {number} bsa   体表面积 m²（Haycock）
 * @returns {number|null} Z 值；参数缺失或输入非法时返回 null
 */
function zScore(value, key, bsa) {
  const def = PEDS_Z[key];
  if (!def) return null;
  if (value === null || value === undefined || value === '' || isNaN(value)) return null;
  if (!bsa || bsa <= 0) return null;

  const idx = value / Math.pow(bsa, def.a);
  const z = (idx - def.mean) / def.sd;
  return z;
}

/**
 * Z 值 → 判定等级
 *   |Z| ≤ 2        正常
 *   2 < |Z| ≤ 3    轻度异常
 *   |Z| > 3        显著异常
 */
function gradeZ(z) {
  if (z === null || z === undefined || isNaN(z)) {
    return { level: 'none', text: '—', cls: 'tag--none' };
  }
  const abs = Math.abs(z);
  if (abs <= 2) return { level: 'normal',   text: '正常',     cls: 'tag--normal' };
  if (abs <= 3) {
    return {
      level: 'mild',
      text: z > 0 ? '轻度增大' : '轻度缩小',
      cls: z > 0 ? 'tag--mild-high' : 'tag--mild-low',
    };
  }
  return {
    level: 'severe',
    text: z > 0 ? '显著增大' : '显著缩小',
    cls: z > 0 ? 'tag--severe-high' : 'tag--severe-low',
  };
}

/**
 * 由 Z 阈值反算「实测值」区间（用于展示 Z = ±2 / ±3 对应的原始数值）
 *
 *   Z 边界 → X = (Mean + Z × SD) × BSA^α
 *
 * @param {string} key
 * @param {number} bsa
 * @param {number} zLevel 例如 2 或 3
 * @returns {{lower:number, upper:number, mean:number}}
 */
function rangeFromZ(key, bsa, zLevel) {
  const def = PEDS_Z[key];
  if (!def || !bsa || bsa <= 0) return null;
  const scale = Math.pow(bsa, def.a);
  return {
    mean:  def.mean * scale,
    lower: (def.mean - zLevel * def.sd) * scale,
    upper: (def.mean + zLevel * def.sd) * scale,
  };
}

/* ------------------------------------------------------------------ *
 * 4. 对外主接口
 * ------------------------------------------------------------------ */

/**
 * 构建儿童 Z 值对照列表
 *
 * @param {number}  bsa      体表面积 m²（Haycock）
 * @param {object}  measured 实测值字典，**单位与界面一致**：
 *                           内径 mm、容积 mL、质量 g、面积 cm²
 *                           例：{ LVEDD: 38, LVESD: 25, LVEDV: 60 }
 * @returns {Array} 可直接渲染的列表项
 */
function buildPedsList(bsa, measured) {
  const rows = [];
  const hasBsa = !!bsa && bsa > 0;

  for (let i = 0; i < PEDS_FIELDS.length; i++) {
    const key = PEDS_FIELDS[i];
    const def = PEDS_Z[key];
    if (!def) continue;

    // 界面单位 → PHN 原生单位
    // 内径：界面 mm，PHN cm → ÷10
    // 容积：界面 mL = cm³，一致
    // 质量：g，一致
    // 面积：cm²，一致
    // 比例：无量纲，一致
    const isLength = def.unit === 'cm';
    const uiUnit = isLength ? 'mm' : def.unit;

    const raw = measured ? measured[key] : undefined;
    const hasValue = raw !== undefined && raw !== null && raw !== '' && !isNaN(raw);

    // 换算到 PHN 原生单位后算 Z
    const nativeValue = hasValue ? (isLength ? raw / 10 : raw) : null;
    const z = hasBsa && hasValue ? zScore(nativeValue, key, bsa) : null;
    const g = gradeZ(z);

    // Z = ±2 / ±3 对应的实测值区间（界面单位）
    let r2 = null;
    let r3 = null;
    if (hasBsa) {
      r2 = rangeFromZ(key, bsa, 2);
      r3 = rangeFromZ(key, bsa, 3);
      if (isLength) {
        r2 = scaleObj(r2, 10);
        r3 = scaleObj(r3, 10);
      }
    }

    const dec = isLength ? 1 : (def.unit === 'g' || def.unit === 'mL' ? 1 : 2);
    const decOut = def.unit === '' ? 2 : dec;

    rows.push({
      key: key,
      name: def.name,
      unit: uiUnit,
      // 指数化后的均值（原生单位），用于解释
      alphaText: 'α=' + def.a.toFixed(2),
      meanText: hasBsa
        ? fmt(def.mean * Math.pow(bsa, def.a), decOut) + ' ' + uiUnit
        : '—',
      // ±2 区间 —— 临床主要判读依据
      rangeText: (hasBsa && r2)
        ? fmt(r2.lower, decOut) + ' – ' + fmt(r2.upper, decOut)
        : '—',
      // ±3 区间 —— 显著异常阈值
      range3Text: (hasBsa && r3)
        ? fmt(r3.lower, decOut) + ' – ' + fmt(r3.upper, decOut)
        : '—',
      value: hasValue ? fmt(raw, decOut) : '—',
      z: z === null ? null : round(z, 2),
      zText: z === null ? '—' : (z > 0 ? '+' : '') + fmt(z, 2),
      status: g.level,
      statusText: g.text,
      statusCls: g.cls,
      hasValue: hasValue,
    });
  }
  return rows;
}

/**
 * 按分组返回儿童 Z 值列表（带 group 标题），便于界面分段渲染
 * @returns {Array<{title:string, rows:Array}>}
 */
function buildPedsGrouped(bsa, measured) {
  const all = buildPedsList(bsa, measured);
  const map = {};
  all.forEach(function (r) { map[r.key] = r; });

  return PEDS_GROUPS.map(function (g) {
    return {
      title: g.title,
      rows: g.keys.map(function (k) { return map[k]; }).filter(Boolean),
    };
  });
}

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

function scaleObj(o, k) {
  if (!o) return o;
  return { mean: o.mean * k, lower: o.lower * k, upper: o.upper * k };
}

function round(n, digits) {
  const d = digits === undefined ? 2 : digits;
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

function fmt(n, dec) {
  if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
  return Number(n).toFixed(dec);
}

/** Z 值 → 中文描述（用于结果摘要） */
function describeZ(z) {
  if (z === null || z === undefined || isNaN(z)) return '未测';
  const g = gradeZ(z);
  const sign = z > 0 ? '+' : '';
  return sign + round(z, 2) + '（' + g.text + '）';
}

module.exports = {
  // BSA
  bsaHaycock,
  bsaApproxByWeight,
  // 数据
  PEDS_Z,
  PEDS_GROUPS,
  PEDS_FIELDS,
  // 计算
  indexedMean,
  indexedSD,
  zScore,
  gradeZ,
  rangeFromZ,
  describeZ,
  // 主接口
  buildPedsList,
  buildPedsGrouped,
  // 工具
  round,
  fmt,
};
