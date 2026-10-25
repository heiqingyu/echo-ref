/**
 * 心脏超声计算引擎 —— 小程序版
 *
 * 数据来源：
 *  [CN]  中国成人超声心动图正常参考值（95% 参考范围），中华医学会超声医学分会，男 678 / 女 716
 *  [ASE] ASE/EACVI 2015 Recommendations for Cardiac Chamber Quantification in Adults
 *
 * 免责声明：本模块仅用于数值参考，不构成任何医疗诊断依据。
 */

/* ------------------------------------------------------------------ *
 * 1. 体表面积 BSA
 * ------------------------------------------------------------------ */

/** Du Bois 公式（推荐，临床试验通用） */
function bsaDuBois(heightCm, weightKg) {
  return 0.007184 * Math.pow(heightCm, 0.725) * Math.pow(weightKg, 0.425);
}

/** Mosteller 公式（简化，便于口算） */
function bsaMosteller(heightCm, weightKg) {
  return Math.sqrt((heightCm * weightKg) / 3600);
}

/**
 * 体重指数 BMI = 体重(kg) / 身高(m)²
 * @returns {number} kg/m²
 */
function bmi(heightCm, weightKg) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/**
 * BMI 判级 —— 中国成人标准（WS/T 428-2013）
 *   偏瘦 < 18.5 ≤ 正常 < 24 ≤ 超重 < 28 ≤ 肥胖
 * 注意：该标准仅适用于成人，儿童请用百分位曲线。
 */
function bmiClass(v) {
  if (v < 18.5) return { level: 'low',   text: '偏瘦' };
  if (v < 24)   return { level: 'normal', text: '正常' };
  if (v < 28)   return { level: 'over',  text: '超重' };
  return { level: 'obese', text: '肥胖' };
}

/* ------------------------------------------------------------------ *
 * 2. 参考值数据表
 *   区间为 [下限, 上限]
 *   长度 mm / 容积 mL / 分数 % / 质量 g
 * ------------------------------------------------------------------ */

const REFERENCE = {
  CN: {
    key: 'CN',
    label: '中国成人（中华医学会，n=1394）',
    note: '《中国成年人超声心动图检查测量指南》(2016) · 95% 参考范围（多年龄段合并）',
    /**
     * ★ 数值直接取自该指南表 2～表 5 的「总人群」列（男 678 / 女 716，95% 参考范围）。
     *   指南另给 6 个年龄段各自的界限，本表未展开 —— 展开会让每个指标多出 12 个数，
     *   界面放不下，故统一取多年龄段合并值；年龄偏移在「正常值」说明里提示。
     * ★ 男女差异是真实的，不要拿一个性别去套另一个：女 LVEDD 上限 49.7 mm，男 54.0 mm；
     *   女 LVM 上限 157.5 g，男 194.0 g。旧版把女性左心各项填成了接近男性的数值，已按原表校正。
     */
    male: {
      'LA-ap':    [23.5,  38.7],
      'LA-l':     [35.2,  58.4],
      'LVOT':     [13.6,  25.0],
      'IVSd':     [ 6.4,  11.4],
      'LVPWd':    [ 6.3,  11.1],
      'LVEDD':    [38.4,  54.0],
      'LVESD':    [22.6,  38.6],
      'LVEDV':    [45.9, 127.5],
      'LVESV':    [12.4,  50.0],
      'LVEF':     [52.6,  76.2],
      'LVM':      [77.6, 194.0],
      'LVM/BSA':  [44.0, 109.0],
      'LVM/H2.7': [17.1,  46.6],
      'LVEDD/H':  [2.22,  3.18],
      'LVRWT':    [0.25,  0.51],
      'RA-l':     [35.2,  53.6],
      'RA-t':     [26.4,  44.4],
      'RV-ap':    [14.7,  29.9],
      'RV-l':     [37.1,  75.1],
      'RVOT':     [15.0,  31.8],
      // ★ 以下 17 项来自同指南表 2～表 5（单位 mm）
      'LA-t':     [26.7,  44.7],
      'IVSs':     [ 9.0,  16.0],
      'IVSLd':    [ 6.3,  11.1],
      'IVSLs':    [ 8.8,  16.2],
      'RVAW':     [ 2.1,   6.1],
      'RVFW':     [ 2.2,   6.6],
      'RV-tb':    [22.2,  42.2],
      'RV-tm':    [16.5,  36.9],
      'ANN':      [16.4,  26.2],
      'ROOT':     [23.8,  36.4],
      'AAO':      [20.4,  35.0],
      'ARCH':     [17.1,  31.7],
      'DAO':      [12.8,  27.0],
      'PVANN':    [13.8,  26.4],
      'MPA':      [15.2,  26.2],
      'RPA':      [ 7.6,  17.4],
      'LPA':      [ 8.0,  17.4],
    },
    female: {
      'LA-ap':    [22.0,  36.8],
      'LA-l':     [33.7,  56.5],
      'LVOT':     [12.0,  23.0],
      'IVSd':     [ 5.6,  10.6],
      'LVPWd':    [ 5.5,  10.3],
      'LVEDD':    [36.7,  49.7],
      'LVESD':    [20.8,  35.4],
      'LVEDV':    [37.7, 106.7],
      'LVESV':    [ 8.4,  43.6],
      'LVEF':     [52.8,  77.2],
      'LVM':      [57.1, 157.5],
      'LVM/BSA':  [37.0,  99.0],
      'LVM/H2.7': [17.5,  41.8],
      'LVEDD/H':  [2.25,  3.13],
      'LVRWT':    [0.24,  0.49],
      'RA-l':     [32.3,  50.7],
      'RA-t':     [23.9,  40.7],
      'RV-ap':    [14.0,  28.2],
      'RV-l':     [34.8,  68.6],
      'RVOT':     [14.6,  29.8],
      // ★ 与男性同源
      'LA-t':     [26.2,  43.0],
      'IVSs':     [ 8.0,  15.0],
      'IVSLd':    [ 5.5,  10.3],
      'IVSLs':    [ 8.2,  15.2],
      'RVAW':     [ 2.2,   5.8],
      'RVFW':     [ 2.2,   6.2],
      'RV-tb':    [19.6,  39.2],
      'RV-tm':    [14.8,  33.6],
      'ANN':      [15.1,  24.1],
      'ROOT':     [21.3,  33.5],
      'AAO':      [19.0,  32.8],
      'ARCH':     [16.4,  29.8],
      'DAO':      [12.4,  25.0],
      'PVANN':    [13.1,  25.3],
      'MPA':      [14.3,  26.1],
      'RPA':      [ 7.0,  16.8],
      'LPA':      [ 7.5,  16.9],
    },
  },

  ASE: {
    key: 'ASE',
    label: 'ASE/EACVI 2015 国际标准',
    note: 'Reference limits for cardiac chamber quantification in adults',
    /**
     * ASE 采用分区值（正常 / 轻度 / 中度 / 重度异常）
     *
     * ⚠️ 单位注意：ASE 原始指南中内径类参数以 **cm** 表示，容积以 **mL**，
     *    质量以 **g**。本表通过 PARAM_UNIT_ASE 显式声明每个参数的单位，
     *    再由 buildReferenceList 统一换算到界面使用的 mm/mL/g，避免单位错配。
     *
     * 方向说明：EF 为"越大越好"，LVESV/LVEDD 为"越小越好"，
     *          分区顺序在数据中天然表达，判定时逐档匹配即可。
     */
    male: {
      // ---- LV 内径与容积（Table 5）----
      LVEDD:       { normal: [4.2, 5.9],  mild: [6.0, 6.3],  moderate: [6.4, 6.8],  severe: [6.9, 99] },
      'LVEDD/BSA': { normal: [2.2, 3.1],  mild: [3.2, 3.4],  moderate: [3.5, 3.6],  severe: [3.7, 99] },
      'LVEDD/H':   { normal: [2.4, 3.3],  mild: [3.4, 3.5],  moderate: [3.6, 3.7],  severe: [3.8, 99] },
      LVEDV:       { normal: [67, 155],   mild: [156, 178],  moderate: [179, 201],  severe: [202, 9999] },
      'LVEDV/BSA': { normal: [35, 75],    mild: [76, 86],    moderate: [87, 96],    severe: [97, 9999] },
      LVESV:       { normal: [22, 58],    mild: [59, 70],    moderate: [71, 82],    severe: [83, 9999] },
      'LVESV/BSA': { normal: [12, 30],    mild: [31, 36],    moderate: [37, 42],    severe: [43, 9999] },
      // ---- LV 室壁厚度与质量（Table 4）----
      IVSd:        { normal: [0.6, 1.0],  mild: [1.1, 1.3],  moderate: [1.4, 1.6],  severe: [1.7, 99] },
      LVPWd:       { normal: [0.6, 1.0],  mild: [1.1, 1.3],  moderate: [1.4, 1.6],  severe: [1.7, 99] },
      LVM:         { normal: [88, 224],   mild: [225, 258],  moderate: [259, 292],  severe: [293, 9999] },
      'LVM/BSA':   { normal: [49, 115],   mild: [116, 131],  moderate: [132, 148],  severe: [149, 9999] },
      // ---- LV 收缩功能（Table 6）----
      EF:          { normal: [55, 100],   mild: [45, 54],    moderate: [30, 44],    severe: [0, 29] },
      FS:          { normal: [25, 43],    mild: [20, 24],    moderate: [15, 19],    severe: [0, 14] },
      // ---- 左房（Table 2）----
      'LA-ap':     { normal: [3.0, 4.0],  mild: [4.1, 4.6],  moderate: [4.7, 5.2],  severe: [5.3, 99] },
      LAV:         { normal: [34, 76],    mild: [77, 92],    moderate: [93, 108],   severe: [109, 9999] },
      'LAV/BSA':   { normal: [16, 34],    mild: [35, 41],    moderate: [42, 48],    severe: [49, 9999] },
      // ---- 右心（Table 3）----
      'RV-ap':     { normal: [2.0, 3.5],  mild: [3.6, 4.0],  moderate: [4.1, 4.5],  severe: [4.6, 99] },
      'RVOT-plax': { normal: [2.0, 3.0],  mild: [3.1, 3.5],  moderate: [3.6, 4.0],  severe: [4.1, 99] },
      'RA-l':      { normal: [3.4, 5.3],  mild: [5.4, 6.0],  moderate: [6.1, 6.6],  severe: [6.7, 99] },
      'RA-t':      { normal: [2.6, 4.4],  mild: [4.5, 4.9],  moderate: [5.0, 5.4],  severe: [5.5, 99] },
      TAPSE:       { normal: [1.7, 3.0],  mild: [1.4, 1.6],  moderate: [1.0, 1.3],  severe: [0, 0.9] },
      // ---- 下腔静脉 ----
      'IVC-d':     { normal: [1.5, 2.1],  mild: [2.2, 2.4],  moderate: [2.5, 2.7],  severe: [2.8, 99] },
    },
    female: {
      LVEDD:       { normal: [3.9, 5.3],  mild: [5.4, 5.7],  moderate: [5.8, 6.1],  severe: [6.2, 99] },
      'LVEDD/BSA': { normal: [2.4, 3.2],  mild: [3.3, 3.4],  moderate: [3.5, 3.7],  severe: [3.8, 99] },
      'LVEDD/H':   { normal: [2.5, 3.2],  mild: [3.3, 3.4],  moderate: [3.5, 3.6],  severe: [3.7, 99] },
      LVEDV:       { normal: [56, 104],   mild: [105, 117],  moderate: [118, 130],  severe: [131, 9999] },
      'LVEDV/BSA': { normal: [35, 75],    mild: [76, 86],    moderate: [87, 96],    severe: [97, 9999] },
      LVESV:       { normal: [19, 49],    mild: [50, 59],    moderate: [60, 69],    severe: [70, 9999] },
      'LVESV/BSA': { normal: [12, 30],    mild: [31, 36],    moderate: [37, 42],    severe: [43, 9999] },
      IVSd:        { normal: [0.6, 0.9],  mild: [1.0, 1.2],  moderate: [1.3, 1.5],  severe: [1.6, 99] },
      LVPWd:       { normal: [0.6, 0.9],  mild: [1.0, 1.2],  moderate: [1.3, 1.5],  severe: [1.6, 99] },
      LVM:         { normal: [67, 162],   mild: [163, 186],  moderate: [187, 210],  severe: [211, 9999] },
      'LVM/BSA':   { normal: [43, 95],    mild: [96, 108],   moderate: [109, 121],  severe: [122, 9999] },
      EF:          { normal: [55, 100],   mild: [45, 54],    moderate: [30, 44],    severe: [0, 29] },
      FS:          { normal: [27, 45],    mild: [22, 26],    moderate: [17, 21],    severe: [0, 16] },
      'LA-ap':     { normal: [2.7, 3.8],  mild: [3.9, 4.2],  moderate: [4.3, 4.6],  severe: [4.7, 99] },
      LAV:         { normal: [22, 52],    mild: [53, 62],    moderate: [63, 72],    severe: [73, 9999] },
      'LAV/BSA':   { normal: [16, 34],    mild: [35, 41],    moderate: [42, 48],    severe: [49, 9999] },
      'RV-ap':     { normal: [2.0, 3.5],  mild: [3.6, 4.0],  moderate: [4.1, 4.5],  severe: [4.6, 99] },
      'RVOT-plax': { normal: [2.0, 3.0],  mild: [3.1, 3.5],  moderate: [3.6, 4.0],  severe: [4.1, 99] },
      'RA-l':      { normal: [3.4, 5.3],  mild: [5.4, 6.0],  moderate: [6.1, 6.6],  severe: [6.7, 99] },
      'RA-t':      { normal: [2.6, 4.4],  mild: [4.5, 4.9],  moderate: [5.0, 5.4],  severe: [5.5, 99] },
      TAPSE:       { normal: [1.7, 3.0],  mild: [1.4, 1.6],  moderate: [1.0, 1.3],  severe: [0, 0.9] },
      'IVC-d':     { normal: [1.5, 2.1],  mild: [2.2, 2.4],  moderate: [2.5, 2.7],  severe: [2.8, 99] },
    },
  },
};

/**
 * ASE 表内各参数的原生单位（来自指南原文）
 * 计算时会用 convertToDisplayUnit 换算到界面单位
 */
const PARAM_UNIT_ASE = {
  LVEDD: 'cm', 'LVEDD/BSA': 'cm/m²', 'LVEDD/H': 'cm/m',
  LVEDV: 'mL', 'LVEDV/BSA': 'mL/m²',
  LVESV: 'mL', 'LVESV/BSA': 'mL/m²',
  IVSd: 'cm', LVPWd: 'cm',
  LVM: 'g', 'LVM/BSA': 'g/m²',
  EF: '%', FS: '%',
  'LA-ap': 'cm', LAV: 'mL', 'LAV/BSA': 'mL/m²',
  'RV-ap': 'cm', 'RVOT-plax': 'cm',
  'RA-l': 'cm', 'RA-t': 'cm',
  TAPSE: 'cm', 'IVC-d': 'cm',
};

/** 参数元信息：中文名、界面显示单位、小数位 */
const PARAM_META = {
  'LA-ap':    { name: '左房前后径',             unit: 'mm',    dec: 1 },
  'LA-l':     { name: '左房长径',               unit: 'mm',    dec: 1 },
  'LVOT':     { name: '左室流出道内径',         unit: 'mm',    dec: 1 },
  'IVSd':     { name: '室间隔舒张末期厚度',      unit: 'mm',    dec: 1 },
  'LVPWd':    { name: '左室后壁舒张末期厚度',    unit: 'mm',    dec: 1 },
  'LVEDD':    { name: '左室舒张末期内径',        unit: 'mm',    dec: 1 },
  'LVESD':    { name: '左室收缩末期内径',        unit: 'mm',    dec: 1 },
  'LVEDV':    { name: '左室舒张末期容积',        unit: 'mL',    dec: 1 },
  'LVESV':    { name: '左室收缩末期容积',        unit: 'mL',    dec: 1 },
  'LVEF':     { name: '左室射血分数',           unit: '%',     dec: 1 },
  'EF':       { name: '左室射血分数',           unit: '%',     dec: 1 },
  'FS':       { name: '左室缩短分数',           unit: '%',     dec: 1 },
  'LVM':      { name: '左室质量',               unit: 'g',     dec: 1 },
  'LVM/BSA':  { name: '左室质量指数(BSA)',       unit: 'g/m²',  dec: 1 },
  'LVM/H2.7': { name: '左室质量指数(身高^2.7)',  unit: 'g/m²·⁷', dec: 1 },
  'LVEDD/H':  { name: '左室舒张末内径/身高',     unit: 'cm/m',  dec: 2 },
  'LVEDD/BSA':{ name: '左室舒张末内径/BSA',      unit: 'cm/m²', dec: 2 },
  'LVEDV/BSA':{ name: '左室舒张末容积指数',      unit: 'mL/m²', dec: 1 },
  'LVESV/BSA':{ name: '左室收缩末容积指数',      unit: 'mL/m²', dec: 1 },
  'LVRWT':    { name: '左室相对室壁厚度',        unit: '',      dec: 2 },
  'LAV':      { name: '左房容积',               unit: 'mL',    dec: 1 },
  'LAV/BSA':  { name: '左房容积指数',           unit: 'mL/m²', dec: 1 },
  'RA-l':     { name: '右房长径',               unit: 'mm',    dec: 1 },
  'RA-t':     { name: '右房横径',               unit: 'mm',    dec: 1 },
  'RV-ap':    { name: '右室前后径',             unit: 'mm',    dec: 1 },
  'RV-l':     { name: '右室长径',               unit: 'mm',    dec: 1 },
  'RVOT':     { name: '右室流出道内径',          unit: 'mm',    dec: 1 },
  'RVOT-plax':{ name: '右室流出道(胸骨旁长轴)',   unit: 'mm',    dec: 1 },
  'TAPSE':    { name: '三尖瓣环收缩期位移',      unit: 'mm',    dec: 1 },
  'IVC-d':    { name: '下腔静脉内径',           unit: 'mm',    dec: 1 },
  // ── 2016 中国指南新增参数 ──
  'LA-t':     { name: '左房横径',               unit: 'mm',    dec: 1 },
  'IVSs':     { name: '室间隔收缩末期厚度',      unit: 'mm',    dec: 1 },
  'IVSLd':    { name: '左室下侧壁舒张末期厚度',   unit: 'mm',    dec: 1 },
  'IVSLs':    { name: '左室下侧壁收缩末期厚度',   unit: 'mm',    dec: 1 },
  'RVAW':     { name: '右室前壁厚度',           unit: 'mm',    dec: 1 },
  'RVFW':     { name: '右室游离壁厚度',         unit: 'mm',    dec: 1 },
  'RV-tb':    { name: '右室基底横径',           unit: 'mm',    dec: 1 },
  'RV-tm':    { name: '右室中部横径',           unit: 'mm',    dec: 1 },
  'ANN':      { name: '主动脉瓣环内径',         unit: 'mm',    dec: 1 },
  'ROOT':     { name: '主动脉窦部内径',         unit: 'mm',    dec: 1 },
  'AAO':      { name: '近端升主动脉内径',        unit: 'mm',    dec: 1 },
  'ARCH':     { name: '主动脉弓内径',           unit: 'mm',    dec: 1 },
  'DAO':      { name: '降主动脉内径',           unit: 'mm',    dec: 1 },
  'PVANN':    { name: '肺动脉瓣环内径',         unit: 'mm',    dec: 1 },
  'MPA':      { name: '主肺动脉内径',           unit: 'mm',    dec: 1 },
  'RPA':      { name: '右肺动脉内径',           unit: 'mm',    dec: 1 },
  'LPA':      { name: '左肺动脉内径',           unit: 'mm',    dec: 1 },
};

/** CN 标准下要展示的参数字段（按临床分组顺序，37 项） */
const CN_FIELDS = [
  // 左心房
  'LA-ap', 'LA-t', 'LA-l',
  // 左心室结构与功能
  'LVOT', 'IVSd', 'IVSs', 'LVPWd',
  'LVEDD', 'LVESD', 'LVEDV', 'LVESV', 'LVEF',
  'IVSLd', 'IVSLs',
  // 左室质量与指数
  'LVM', 'LVM/BSA', 'LVM/H2.7', 'LVEDD/H', 'LVRWT',
  // 右心
  'RA-l', 'RA-t', 'RV-ap', 'RV-tb', 'RV-tm', 'RV-l', 'RVOT',
  'RVAW', 'RVFW',
  // 主动脉
  'ANN', 'ROOT', 'AAO', 'ARCH', 'DAO',
  // 肺动脉
  'PVANN', 'MPA', 'RPA', 'LPA',
];

/** ASE 标准下要展示的参数字段（按临床分组顺序） */
const ASE_FIELDS = [
  // 左室结构
  'LVEDD', 'LVEDD/BSA', 'LVEDD/H', 'IVSd', 'LVPWd',
  // 左室容积与质量
  'LVEDV', 'LVEDV/BSA', 'LVESV', 'LVESV/BSA', 'LVM', 'LVM/BSA',
  // 左室收缩功能
  'EF', 'FS',
  // 左房
  'LA-ap', 'LAV', 'LAV/BSA',
  // 右心
  'RV-ap', 'RVOT-plax', 'RA-l', 'RA-t', 'TAPSE',
  // 下腔静脉
  'IVC-d',
];

/* ------------------------------------------------------------------ *
 * 3. Teichholz 法：由 M 型内径计算容积与 EF
 * ------------------------------------------------------------------ */

/**
 * Teichholz 单平面公式：V = 7 * D³ / (2.4 + D)
 * @param {number} dCm 内径，单位 cm
 * @returns {number} 容积，单位 mL
 */
function teichholzVolume(dCm) {
  return (7 * Math.pow(dCm, 3)) / (2.4 + dCm);
}

/**
 * 由 LV 舒张末内径 / 收缩末内径计算全套收缩功能指标
 * @param {number} lviddMm 左室舒张末期内径（mm）
 * @param {number} lvidsMm 左室收缩末期内径（mm）
 */
function computeLVFunction(lviddMm, lvidsMm) {
  const lvidd = lviddMm / 10; // mm -> cm
  const lvids = lvidsMm / 10;

  const edv = teichholzVolume(lvidd);
  const esv = teichholzVolume(lvids);

  const ef = edv > 0 ? ((edv - esv) / edv) * 100 : 0;
  const fs = lvidd > 0 ? ((lvidd - lvids) / lvidd) * 100 : 0;
  const sv = edv - esv;

  return {
    EDV: round(edv, 1),
    ESV: round(esv, 1),
    SV:  round(sv, 1),
    EF:  round(ef, 1),
    FS:  round(fs, 1),
  };
}

/**
 * 由内径 + 室壁厚度估算左室质量（Devereux 公式，ASE 推荐）
 * LVM(g) = 0.8 × 1.04 × [(LVEDD+IVSd+LVPWd)³ − LVEDD³] + 0.6
 */
function computeLVM(lveddMm, ivsdMm, lvpwdMm, bsa) {
  const d  = lveddMm / 10;
  const iv = ivsdMm  / 10;
  const pw = lvpwdMm / 10;

  const lvmRaw = 0.8 * 1.04 * (Math.pow(d + iv + pw, 3) - Math.pow(d, 3)) + 0.6;
  // 先舍入到显示精度，再计算指数，保证「用户拿界面数字手算 = 程序输出」
  const lvm = round(lvmRaw, 1);

  return {
    LVM: lvm,
    'LVM/BSA': bsa ? round(lvm / bsa, 1) : null,
  };
}

/**
 * 左室相对室壁厚度 RWT = (2 × LVPWd) / LVEDD
 */
function computeRWT(lveddMm, lvpwdMm) {
  if (!lveddMm) return null;
  return round((2 * lvpwdMm) / lveddMm, 2);
}

/* ------------------------------------------------------------------ *
 * 4. 结果判定
 * ------------------------------------------------------------------ */

/** 依据 [下限, 上限] 判定单值 → 'low' | 'normal' | 'high' */
function judgeRange(value, range) {
  if (value < range[0]) return 'low';
  if (value > range[1]) return 'high';
  return 'normal';
}

function inRange(v, range) {
  return v >= range[0] && v <= range[1];
}

/** 依据 ASE 分区值判定等级 → 'normal' | 'mild' | 'moderate' | 'severe' */
function judgePartition(value, p) {
  if (inRange(value, p.normal))   return 'normal';
  if (inRange(value, p.mild))     return 'mild';
  if (inRange(value, p.moderate)) return 'moderate';
  return 'severe';
}

/** EF 分级（ASE 2015 通用阈值，不区分性别） */
function gradeEF(ef) {
  if (ef >= 55) return { level: 'normal',   text: '正常' };
  if (ef >= 45) return { level: 'mild',     text: '轻度减低' };
  if (ef >= 30) return { level: 'moderate', text: '中度减低' };
  return { level: 'severe', text: '重度减低' };
}

/** 状态 → 中文标签与样式类 */
const STATUS_TEXT = {
  normal:   { text: '正常',   cls: 'tag--normal' },
  high:     { text: '↑ 偏高', cls: 'tag--high' },
  low:      { text: '↓ 偏低', cls: 'tag--low' },
  mild:     { text: '轻度异常', cls: 'tag--mild' },
  moderate: { text: '中度异常', cls: 'tag--moderate' },
  severe:   { text: '重度异常', cls: 'tag--severe' },
  none:     { text: '—',      cls: 'tag--none' },
};

/* ------------------------------------------------------------------ *
 * 5. 单位换算
 * ------------------------------------------------------------------ */

/**
 * BSA 索引参数定义
 *
 * 这些参数是把绝对测量值除以 BSA 得到的「指数」，其参考值本身与 BSA 无关。
 * 但临床上用户更关心：「以我的体型，内径多大算正常？」
 * 因此按 指数 × BSA 反算出绝对范围一并显示。
 *
 * 字段说明：
 *   base    指数对应的绝对参数键
 *   unitIn  指数单位中「分子」的单位（cm / mL / g）
 *   toMm    反算结果是否要换算成 mm 显示（长度类为 true）
 */
const BSA_INDEX_MAP = {
  'LVEDD/BSA': { base: 'LVEDD', unitIn: 'cm', toMm: true },
  'LVEDV/BSA': { base: 'LVEDV', unitIn: 'mL', toMm: false },
  'LVESV/BSA': { base: 'LVESV', unitIn: 'mL', toMm: false },
  'LVM/BSA':   { base: 'LVM',   unitIn: 'g',  toMm: false },
  'LAV/BSA':   { base: 'LAV',   unitIn: 'mL', toMm: false },
};

/** 判断某参数是否为 BSA 索引参数 */
function isBsaIndex(key) {
  return Object.prototype.hasOwnProperty.call(BSA_INDEX_MAP, key);
}

/**
 * 由指数范围反算绝对范围
 * @param {Array} range  指数区间 [lo, hi]
 * @param {string} key   参数键（如 'LVEDD/BSA'）
 * @param {number} bsa   体表面积 m²
 * @returns {object|null} { text, unit } 或 null（不适用）
 */
function deriveAbsoluteRange(range, key, bsa) {
  const def = BSA_INDEX_MAP[key];
  if (!def || !bsa || bsa <= 0) return null;

  // 指数 × BSA = 绝对值（cm / mL / g）
  let lo = range[0] * bsa;
  let hi = range[1] * bsa;

  // 长度类换算成 mm 显示，与界面输入单位一致
  if (def.toMm) {
    lo *= 10;
    hi *= 10;
  }

  const dec = def.toMm ? 0 : 1;
  const meta = PARAM_META[def.base] || { unit: '' };

  return {
    text: fmt(lo, dec) + '–' + fmt(hi, dec),
    unit: meta.unit,
    base: def.base,
  };
}


/**
 * 单位换算因子：把「ASE 指南原生单位」换算到「界面单位」
 * 界面上长度统一用 mm、容积用 mL、质量用 g。
 *
 * 例：ASE 的 LVEDD 是 cm（正常 4.2–5.9），需 ×10 变成 42–59 mm
 *     这样才和界面上用户输入的 50 mm 可比。
 */
const UNIT_SCALE = {
  'cm->mm': 10,
  'mm->cm': 0.1,
  'mL->mL': 1,
  'g->g': 1,
  '%->%': 1,
  'cm/m->cm/m': 1,       // 比值类不换算
  'cm/m²->cm/m²': 1,
  'mL/m²->mL/m²': 1,
  'g/m²->g/m²': 1,
  'g/m²·⁷->g/m²·⁷': 1,
};

/** 换算单个数值 */
function convertUnit(value, fromUnit, toUnit) {
  if (value === null || value === undefined || value === '') return value;
  const key = fromUnit + '->' + toUnit;
  const scale = UNIT_SCALE[key];
  if (scale === undefined) {
    // 未登记的换算组合，原样返回（比值类单位走的都是这里）
    if (fromUnit === toUnit) return value;
    return value;
  }
  return value * scale;
}

/** 换算一个区间 [lo, hi] */
function convertRange(range, fromUnit, toUnit) {
  return [convertUnit(range[0], fromUnit, toUnit), convertUnit(range[1], fromUnit, toUnit)];
}

/** 换算分区值对象 */
function convertPartition(p, fromUnit, toUnit) {
  return {
    normal:   convertRange(p.normal, fromUnit, toUnit),
    mild:     convertRange(p.mild, fromUnit, toUnit),
    moderate: convertRange(p.moderate, fromUnit, toUnit),
    severe:   convertRange(p.severe, fromUnit, toUnit),
  };
}

/** 取某参数在指定标准下的原生单位 */
function nativeUnit(key, standard) {
  if (standard === 'ASE') return PARAM_UNIT_ASE[key] || null;
  return null; // CN 表本身就是界面单位（mm / mL / g / %）
}

/* ------------------------------------------------------------------ *
 * 6. 对外主接口
 * ------------------------------------------------------------------ */

/**
 * 构建参考值对照列表
 * @param {string} sex      'male' | 'female'
 * @param {object} measured 实测值字典，如 { LVEDD: 52, LVEF: 62 }
 * @param {string} standard 'CN' | 'ASE'
 * @returns {Array} 可直接渲染的列表项
 */
function buildReferenceList(sex, measured, standard, bsa) {
  const std = REFERENCE[standard] || REFERENCE.CN;
  const table = std[sex] || std.male;
  const fields = standard === 'ASE' ? ASE_FIELDS : CN_FIELDS;
  const rows = [];

  for (let i = 0; i < fields.length; i++) {
    const key = fields[i];
    const ref = table[key];
    if (!ref) continue;

    const meta = PARAM_META[key] || { name: key, unit: '', dec: 1 };
    const v = measured ? measured[key] : undefined;
    const hasValue = v !== undefined && v !== null && v !== '' && !isNaN(v);

    // ★ 关键修复：ASE 表的原生单位与界面单位可能不同，需换算后再比较
    const fromUnit = nativeUnit(key, standard);
    const toUnit = meta.unit;

    let status = 'none';
    let valText = '—';
    let rangeText = '';
    let normalRange = null; // 用于反算绝对值的「指数正常区间」

    if (standard === 'ASE') {
      // 分区值：换算到界面单位
      const p = fromUnit ? convertPartition(ref, fromUnit, toUnit) : ref;
      // 正常区间若是闭区间端点，换算后保持连续（如 5.9→59，下一档 6.0→60）
      rangeText = fmt(p.normal[0], meta.dec) + '–' + fmt(p.normal[1], meta.dec);
      normalRange = p.normal;
      if (hasValue) {
        status = judgePartition(v, p);
        valText = fmt(v, meta.dec);
      }
    } else {
      // CN 表：数值已是界面单位，直接用
      rangeText = fmt(ref[0], meta.dec) + '–' + fmt(ref[1], meta.dec);
      normalRange = ref;
      if (hasValue) {
        status = judgeRange(v, ref);
        valText = fmt(v, meta.dec);
      }
    }

    // ★ 新增：BSA 索引参数反算绝对范围
    // 如 LVEDD/BSA 指数 2.2–3.1 cm/m²，BSA=1.75 → 折算内径 39–54 mm
    let derived = null;
    if (isBsaIndex(key) && normalRange && bsa > 0) {
      derived = deriveAbsoluteRange(normalRange, key, bsa);
    }

    const st = STATUS_TEXT[status] || STATUS_TEXT.none;
    rows.push({
      key: key,
      name: meta.name,
      unit: meta.unit,
      value: valText,
      range: rangeText,
      status: status,
      statusText: st.text,
      statusCls: st.cls,
      hasValue: hasValue,
      // 反算出的绝对范围（仅 BSA 索引参数有）
      derivedText: derived ? derived.text : '',
      derivedUnit: derived ? derived.unit : '',
      hasDerived: !!derived,
    });
  }
  return rows;
}

/** 由 EF 计算页的测量值组装用于参考值对照的字典 */
function measurementsToRefDict(m) {
  if (!m) return {};
  const fn = computeLVFunction(m.lvedd, m.lvesd);
  const lvm = computeLVM(m.lvedd, m.ivsd, m.lvpwd, m.bsa);
  return {
    LVEDD: m.lvedd,
    LVESD: m.lvesd,
    LVEDV: fn.EDV,
    LVESV: fn.ESV,
    LVEF: fn.EF,
    EF: fn.EF,
    FS: fn.FS,
    LVM: lvm.LVM,
    'LVM/BSA': lvm['LVM/BSA'],
    IVSd: m.ivsd,
    LVPWd: m.lvpwd,
    LVRWT: computeRWT(m.lvedd, m.lvpwd),
    'LVEDD/BSA': m.bsa ? round(m.lvedd / 10 / m.bsa, 2) : null,
    'LVEDD/H': m.height ? round(m.lvedd / 10 / (m.height / 100), 2) : null,
    'LVEDV/BSA': m.bsa ? round(fn.EDV / m.bsa, 1) : null,
    'LVESV/BSA': m.bsa ? round(fn.ESV / m.bsa, 1) : null,
  };
}

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

function round(n, digits) {
  const d = digits === undefined ? 2 : digits;
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

function fmt(n, dec) {
  if (n === null || n === undefined || n === '') return '—';
  return Number(n).toFixed(dec);
}

module.exports = {
  // 计算
  bsaDuBois,
  bsaMosteller,
  bmi,
  bmiClass,
  teichholzVolume,
  computeLVFunction,
  computeLVM,
  computeRWT,
  // 判定
  judgeRange,
  judgePartition,
  gradeEF,
  // 数据
  REFERENCE,
  PARAM_META,
  PARAM_UNIT_ASE,
  CN_FIELDS,
  ASE_FIELDS,
  STATUS_TEXT,
  // 单位换算
  UNIT_SCALE,
  convertUnit,
  convertRange,
  convertPartition,
  nativeUnit,
  // BSA 索引
  BSA_INDEX_MAP,
  isBsaIndex,
  deriveAbsoluteRange,
  // 主接口
  buildReferenceList,
  measurementsToRefDict,
  // 工具
  round,
  fmt,
};
