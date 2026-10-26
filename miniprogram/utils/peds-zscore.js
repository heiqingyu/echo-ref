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

  // ── 左房 / 右房 / 右室腔径（中国汉族儿童，2D，CSMC 三次多项式）──
  // ★ 键名不用 LAD：LAD 已被「左前降支近段」占用（PHN 冠脉组），
  //   儿科文献里 LAD 既可指左房也可指前降支，键名必须区分开。
  LA4C:   { model: 'csmc', unit: 'mm', dec: 1, name: '左房左右径（心尖四腔）' },
  RA4C:   { model: 'csmc', unit: 'mm', dec: 1, name: '右房左右径（心尖四腔）' },
  RVIDd:  { model: 'csmc', unit: 'mm', dec: 1, name: '右室流入道内径（舒张末）' },
  RVIDs:  { model: 'csmc', unit: 'mm', dec: 1, name: '右室流入道内径（收缩末）' },

  // ── 左房前后径 / 右室前后径 / 右室前壁（M 型，Kampmann 分组表）──
  LAAP:   { model: 'kamp', unit: 'mm', dec: 1, name: '左房前后径（M 型）' },
  RVDD:   { model: 'kamp', unit: 'mm', dec: 1, name: '右室前后径（M 型）' },
  RVAWd:  { model: 'kamp', unit: 'mm', dec: 2, name: '右室前壁厚度' },
};

/* ------------------------------------------------------------------ *
 * 3b. Kampmann 2000 M 型分组参考表（补 PHN 没有的房 / 右心腔径）
 *
 * ── 为什么必须另起一套？ ────────────────────────────────────────────
 *  PHN 数据集（n=3566）测的是左室、主动脉、肺动脉、冠脉与房室瓣环，
 *  **没有左房、右房、右室的内径**。儿童左房/右室大小没有 PHN 级别的共识方程，
 *  国际文献里最常被引用的 M 型分组值来自：
 *
 *    Kampmann C, Wiethoff CM, Wenzel A, et al. Normal values of M mode
 *    echocardiographic measurements of more than 2000 healthy infants and
 *    children in central Europe. Heart. 2000;83(6):667-672.
 *    n = 2036，中欧白人儿童，1 天–18 岁，DuBois BSA，六名儿科心脏科医师测。
 *
 *  ★ 原文给的是「按 BSA 分组的 均值 ± 2SD」表格（Table 2），不是指数方程，
 *    所以这里直接存表格并做**线性插值**，不做二次拟合 —— 忠实原文，且
 *    SD 在不同 BSA 段的比例并不恒定，用指数模型套会失真。
 *
 *  下表每项为 [−2SD, 均值, +2SD]（单位 mm），与原文 Table 2 逐格对应。
 *  原文分组：BSA 0.25–0.70 每 0.05 一档、0.70–1.50 每 0.10、1.75 / 2.00。
 *  BSA < 0.25 m²（早产/低出生体重儿）按 0.25 档取值；> 2.0 按 2.0 档。
 *
 *  ⚠️ 与 PHN 区**不可混用**：两套的参照人群、测量方法（M 型 vs 2D/短轴）、
 *     BSA 公式（DuBois vs Haycock）都不同，同一患儿只用一套判读。
 * ------------------------------------------------------------------ */

const KAMP_TABLE = {
  bsa: [0.25, 0.275, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70,
        0.80, 0.90, 1.00, 1.10, 1.20, 1.30, 1.40, 1.50, 1.75, 2.00],
  cols: {
    // 右室前壁厚度
    RVAWd: [
      [1.4, 2.6, 3.8], [1.4, 2.6, 3.8], [1.6, 2.7, 3.8], [1.6, 2.7, 3.8],
      [1.6, 2.7, 3.8], [1.65, 2.75, 3.85], [1.65, 2.75, 3.85], [1.65, 2.75, 3.85],
      [1.7, 2.8, 3.9], [1.7, 2.8, 3.9], [1.7, 2.8, 3.9], [1.7, 2.8, 3.9],
      [1.7, 2.8, 3.9], [1.7, 2.8, 3.9], [1.8, 2.9, 4.0], [1.8, 2.9, 4.0],
      [1.9, 3.0, 4.1], [1.9, 3.0, 4.1], [1.9, 3.1, 4.3], [1.9, 3.1, 4.3],
      [1.9, 3.1, 4.3],
    ],
    // 右室舒张末期内径
    RVDD: [
      [4.2, 8.7, 13.2], [4.2, 8.7, 13.2], [4.2, 8.7, 13.2], [4.3, 8.8, 13.3],
      [4.4, 8.9, 13.4], [4.5, 9.0, 13.5], [4.8, 9.3, 13.8], [5.0, 9.5, 14.0],
      [5.2, 9.6, 14.0], [5.5, 9.9, 14.3], [5.7, 10.1, 14.5], [5.8, 10.5, 15.2],
      [6.4, 11.0, 15.6], [6.4, 11.2, 16.0], [7.4, 11.8, 16.2], [7.6, 12.4, 17.2],
      [8.5, 13.5, 18.5], [9.0, 14.0, 19.0], [10.0, 15.6, 21.2], [10.3, 16.5, 22.7],
      [11.5, 17.5, 23.5],
    ],
    // 左房前后径
    LAAP: [
      [10.5, 14.0, 17.5], [11.5, 15.1, 18.7], [11.5, 15.3, 19.1], [12.0, 16.3, 20.6],
      [13.0, 16.8, 20.6], [13.8, 17.8, 21.8], [14.5, 18.7, 22.9], [15.3, 19.7, 24.1],
      [16.1, 20.1, 24.1], [16.1, 20.8, 25.5], [16.2, 21.2, 26.2], [16.5, 22.5, 28.5],
      [17.0, 23.2, 29.4], [19.2, 25.0, 30.8], [19.5, 25.2, 30.9], [20.9, 26.0, 31.1],
      [21.7, 27.3, 32.9], [22.8, 28.2, 33.6], [23.7, 29.9, 36.1], [23.8, 30.4, 37.0],
      [23.7, 32.5, 41.3],
    ],
  },
};

/* ------------------------------------------------------------------ *
 * 3b-2. 中国汉族儿童三次多项式方程（CSMC · 上海儿童医学中心多中心）
 *
 *  PHN 无左房 / 右房 / 右室腔径，Kampmann 是中欧白人 M 型且无右房，
 *  故按「中国儿童 + 2D」判读房室大小用这两篇（同一多中心队列，Haycock BSA）：
 *    左心 Wang SS, et al. J Clin Ultrasound. 2018;46(5):328-333.  n=545  DOI 10.1002/jcu.22579
 *    右心 Wang SS, et al. J Clin Ultrasound. 2017;45(5):293-303.  n=515  DOI 10.1002/jcu.22436
 *
 *      M = β0 + β1·BSA + β2·BSA² + β3·BSA³      （cm）
 *      Z = ( 实测值 − M ) / SD                  SD 为固定常数，不随 BSA 变
 *
 *  ⚠️ 两篇 SD 定义不同，Z 刻度略有差异、跨篇不可比大小：
 *     左心用边际 SD（marginal），右心用残差 SD（residual，天然更小）。
 *
 *  ★ 抄录雷区：PDF 文本会把负号提取成数字 2（-0.79 → "20.79"）。
 *     已用两篇自带算例反推验证（见 verify-peds.js 第 13 节）：
 *       左心 AVA 1.60 / BSA 1.0 → Z +0.38；右心 TVA 1.70 / BSA 1.0 → Z −2.33
 * ------------------------------------------------------------------ */

const CSMC_Z = {
  // ── 左心篇（2018，SD = 边际 SD）──
  LA4C:  { b: [0.49, 3.83, -2.49,  0.56], sd: 0.18, r2: 0.78, paper: 'L' },

  // ── 右心篇（2017，SD = 残差 SD）──
  RA4C:  { b: [0.67, 3.49, -2.01,  0.41], sd: 0.19, r2: 0.79, paper: 'R' },
  RVIDd: { b: [0.59, 3.43, -2.02,  0.45], sd: 0.27, r2: 0.66, paper: 'R' },
  RVIDs: { b: [0.72, 2.00, -0.79,  0.13], sd: 0.26, r2: 0.63, paper: 'R' },
};

/* ------------------------------------------------------------------ *
 * 3b-3. 深圳 SZ 法（中国儿童冠状动脉 Z 值，2021 多中心）
 *
 * ── 为什么冠脉要并列两套？ ──────────────────────────────────────────
 *  川崎病冠脉判读主流用北美 Dallaire / PHN 一类方程，但中国儿童的冠脉
 *  基线内径与离散度都不同。深圳儿童医院牵头 6 省 9 中心建立了中国儿童
 *  自己的指数方程（文中自称 SZ 法，ShenZhen）：
 *
 *    Fan SM, Xia B, Liu WX, et al. Establishing an appropriate Z score
 *    regression equation for Chinese pediatric coronary artery
 *    echocardiography: a multicenter prospective cohort study.
 *    BMC Pediatr. 2021;21:429.  DOI 10.1186/s12887-021-02877-9
 *    n = 842（男 546 / 女 296），1 月龄–17 岁，Haycock BSA。
 *
 *      ln(y) = a + b · ln(BSA)        y = 冠脉内径 mm
 *      Z = [ ln(实测值) − ln(预测均值) ] / RSE
 *
 *  原文系数（Results 段落逐字，BSAhay 版，即最终采用的 SZ 法）：
 *      ln y LCA = 1.0084 + 0.3740 ln x   R² 0.682  RSE 0.115
 *      ln y LAD = 0.8063 + 0.3697 ln x   R² 0.650  RSE 0.119
 *      ln y RCA = 0.8040 + 0.3291 ln x   R² 0.482  RSE 0.150
 *
 *  ★ 原文只测 LCA（左冠主干）/ LAD / RCA 三段，**没有 LMCA 与 LCX**；
 *    本模块的 LMCA 行即对应原文 LCA，键名不改（PHN 行沿用 LMCA）。
 *  ★ 因为 Z 在对数尺度上算，±2SD 的原始值区间是**不对称**的：
 *      上限 = 均值 × e^(+2·RSE)，下限 = 均值 × e^(−2·RSE)
 *    直接写 均值 ± 2SD 会低估高值侧、高估低值侧，别那样算。
 *  ★ 与 PHN 行**不可互相比较**：人群、模型、离散度都不同，同一测值
 *    常给出相差 0.7–1.1 个 Z 的结论，判读以报告所依据的那一套为准。
 *  ★ 队列为 1 月龄–17 岁，**不含 0–28 天新生儿**；BSA < 0.23 时本行
 *    属外推（界面会标注），新生儿请以 PHN 或本单位参考值为准。
 * ------------------------------------------------------------------ */

const SZ_Z = {
  LMCA: { a: 1.0084, b: 0.3740, rse: 0.115, r2: 0.682, seg: 'LCA' },
  LAD:  { a: 0.8063, b: 0.3697, rse: 0.119, r2: 0.650, seg: 'LAD' },
  RCA:  { a: 0.8040, b: 0.3291, rse: 0.150, r2: 0.482, seg: 'RCA' },
};

/** SZ 队列的覆盖范围（用于界面标注「外推」） */
const SZ_RANGE = { ageMin: 1 / 12, ageMax: 17, bsaMin: 0.23, bsaMax: 1.85 };

/** 展示分组（保持临床阅读顺序） */
const PEDS_GROUPS = [
  { title: '左心室结构', keys: ['LVEDD', 'LVESD', 'LVST', 'LVPWT'] },
  { title: '左心室容积与质量', keys: ['LVEDV', 'LVESV', 'LVM'] },
  { title: '左心室长径与面积', keys: ['LVEDL', 'LVEDA'] },
  { title: '主动脉', keys: ['ANN', 'ROOT', 'STJ', 'AAO', 'ARCHP', 'ARCHD', 'ISTH'] },
  {
    title: '冠状动脉',
    keys: ['LMCA', 'LAD', 'RCA'],
    note: '每项两行：上行 PHN（北美多中心，幂律模型），下行深圳 SZ 法（中国儿童多中心，' +
      'ln Y = a + b·ln BSA，n=842，1 月龄–17 岁）。两套的人群、模型与离散度都不同，' +
      '同一测值可差 0.7–1.1 个 Z（如 LAD 2.6 mm、BSA 1.0：PHN +2.06「轻度增大」/ SZ +1.25「正常」），' +
      '不可互相比较或混用，以报告所依据的那一套判读。SZ 队列不含 0–28 天新生儿，' +
      'BSA < 0.23 时该行属外推（会标注「外推」）。',
  },
  { title: '肺动脉', keys: ['PVSAX', 'PVLAX', 'MPA', 'RPA', 'LPA'] },
  { title: '二尖瓣', keys: ['MVAP', 'MVLAT', 'MVA'] },
  { title: '三尖瓣', keys: ['TVAP', 'TVLAT', 'TVA'] },
  {
    title: '左房与右心',
    keys: ['LA4C', 'RA4C', 'RVIDd', 'RVIDs', 'LAAP', 'RVDD', 'RVAWd'],
    note: '前 4 项＝中国汉族儿童（上海儿童医学中心多中心，2D，n=545 / 515）；' +
      '后 3 项＝中欧白人（Kampmann 2000，M 型，无右房）。同一房室有两种测法，' +
      '按报告实际切面选行：M 型右室前后径（胸骨旁）比四腔心右室流入道内径天然小一半，不可互比。',
  },
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
 * 3c. Kampmann 分组表查表（线性插值）
 * ------------------------------------------------------------------ */

/**
 * 按 BSA 在 Kampmann Table 2 上取该参数的 均值 / SD / ±2SD 区间
 *
 * 原文不是方程而是「按 BSA 分组的 均值 ± 2SD」，组内 SD 与 BSA 不呈幂函数关系，
 * 因此这里直接**线性插值**分组值，不做二次拟合。
 *
 * @param {string} key  LAAP / RVDD / RVAWd
 * @param {number} bsa  体表面积 m²
 * @returns {{mean:number, sd:number, lo2:number, hi2:number}|null}
 */
function kampAt(key, bsa) {
  const xs = KAMP_TABLE.bsa;
  const col = KAMP_TABLE.cols[key];
  if (!col || !bsa || bsa <= 0) return null;

  const n = xs.length;
  // 超出表的覆盖范围：贴边取值（原文只到 0.25–2.0 m²）
  if (bsa <= xs[0]) return kampRow(col[0]);
  if (bsa >= xs[n - 1]) return kampRow(col[n - 1]);

  let i = 0;
  while (i < n - 2 && bsa > xs[i + 1]) i++;

  const x0 = xs[i];
  const x1 = xs[i + 1];
  const w = (bsa - x0) / (x1 - x0);
  const a = col[i];
  const b = col[i + 1];
  const lerp = function (p, q) { return p + (q - p) * w; };

  const mean = lerp(a[1], b[1]);
  // 每格 hi − lo = 4 SD
  const sd = lerp((a[2] - a[0]) / 4, (b[2] - b[0]) / 4);

  return {
    mean: mean,
    sd: sd,
    lo2: lerp(a[0], b[0]),
    hi2: lerp(a[2], b[2]),
  };
}

/** 单格 [−2SD, 均值, +2SD] → 统一结构 */
function kampRow(cell) {
  return {
    mean: cell[1],
    sd: (cell[2] - cell[0]) / 4,
    lo2: cell[0],
    hi2: cell[2],
  };
}

/** 取实测值并判断是否可用（界面单位） */
function pickValue(measured, key) {
  const raw = measured ? measured[key] : undefined;
  const ok = raw !== undefined && raw !== null && raw !== '' && !isNaN(raw);
  return { raw: raw, hasValue: ok };
}

/**
 * 组装一条参照行（Kampmann / CSMC 共用），输出结构与 PHN 行一致，界面无需分支。
 * mean / sd 必须已是界面单位（mm），传 null 表示 BSA 不可用。
 */
function buildRefRow(key, def, src, srcText, alphaText, mean, sd, raw, hasValue, decOut) {
  let z = null;
  if (mean !== null && hasValue) z = (raw - mean) / sd;
  const g = gradeZ(z);
  const has = mean !== null;
  const u = ' ' + def.unit;
  const rng = function (k) {
    return has ? fmt(mean - k * sd, decOut) + ' – ' + fmt(mean + k * sd, decOut) : '—';
  };
  return {
    key: key, name: def.name, unit: def.unit,
    src: src, srcText: srcText, alphaText: alphaText,
    meanText: has ? fmt(mean, decOut) + u : '—',
    sdText: has ? 'SD ' + fmt(sd, decOut) + u : '—',
    subText: has ? fmt(mean, decOut) + ' ± ' + fmt(sd, decOut) + u : '—',
    rangeText: rng(2),
    range3Text: rng(3),
    value: hasValue ? fmt(raw, decOut) : '—',
    z: z === null ? null : round(z, 2),
    zText: z === null ? '—' : (z > 0 ? '+' : '') + fmt(z, 2),
    status: g.level, statusText: g.text, statusCls: g.cls, hasValue: hasValue,
  };
}

/** Kampmann 分组表行（原表即以 mm 给出，不换算） */
function buildKampRow(key, def, bsa, measured, hasBsa) {
  const v = pickValue(measured, key);
  const t = hasBsa ? kampAt(key, bsa) : null;
  return buildRefRow(key, def, 'kamp', 'Kampmann', 'M 型分组表',
    t ? t.mean : null, t ? t.sd : null, v.raw, v.hasValue,
    def.dec === undefined ? 1 : def.dec);
}

/* ------------------------------------------------------------------ *
 * 3e. SZ 法求值（对数线性）
 * ------------------------------------------------------------------ */

/**
 * 在给定 BSA 上算 SZ 法的预测均值与 ±2 / ±3 SD 的原始值界
 *
 * ⚠️ Z 建立在对数尺度，SD 换算回原始尺度后**两侧不对称**，
 *    所以区间必须用 exp(±k·RSE) 求，不能写 mean ± k·sd。
 *
 * @param {string} key LMCA / LAD / RCA
 * @param {number} bsa 体表面积 m²（Haycock，与原文一致）
 * @returns {{mean:number, sd:number, lo2:number, hi2:number, lo3:number, hi3:number}|null}
 */
function szAt(key, bsa) {
  const d = SZ_Z[key];
  if (!d || !bsa || bsa <= 0) return null;
  const mean = Math.exp(d.a + d.b * Math.log(bsa));
  return {
    mean: mean,
    // 均值处的等效线性 SD（仅用于显示「均值 ± SD」，Z 本身不经过它）
    sd: mean * d.rse,
    lo2: mean * Math.exp(-2 * d.rse),
    hi2: mean * Math.exp(2 * d.rse),
    lo3: mean * Math.exp(-3 * d.rse),
    hi3: mean * Math.exp(3 * d.rse),
  };
}

/** Z = [ ln(实测) − ln(预测均值) ] / RSE */
function szZ(value, key, bsa) {
  const d = SZ_Z[key];
  const t = szAt(key, bsa);
  if (!d || !t || !(value > 0)) return null;
  return (Math.log(value) - Math.log(t.mean)) / d.rse;
}

/** BSA 是否落在 SZ 队列的建模范围内（<0.23 基本就是新生儿） */
function szInRange(bsa) {
  return !!bsa && bsa >= SZ_RANGE.bsaMin && bsa <= SZ_RANGE.bsaMax;
}

/* ------------------------------------------------------------------ *
 * 3d. CSMC 三次多项式求值（中国汉族儿童）
 * ------------------------------------------------------------------ */

/**
 * 在给定 BSA 上算 CSMC 方程的预测值
 * @param {string} key
 * @param {number} bsa 体表面积 m²
 * @returns {{mean:number, sd:number}|null}  单位 cm
 */
function csmcAt(key, bsa) {
  const def = CSMC_Z[key];
  if (!def || !bsa || bsa <= 0) return null;
  const b = def.b;
  return {
    mean: b[0] + b[1] * bsa + b[2] * bsa * bsa + b[3] * bsa * bsa * bsa,
    sd: def.sd,
  };
}

/** CSMC 行：方程单位为 cm，界面用 mm → 预测值与 SD 一律 ×10 */
function buildCsmcRow(key, def, bsa, measured, hasBsa) {
  const v = pickValue(measured, key);
  const t = hasBsa ? csmcAt(key, bsa) : null;
  const meta = CSMC_Z[key];
  return buildRefRow(key, def, 'csmc',
    meta.paper === 'L' ? 'CSMC·左心' : 'CSMC·右心',
    '三次多项式 · R² ' + meta.r2.toFixed(2),
    t ? t.mean * 10 : null, t ? t.sd * 10 : null, v.raw, v.hasValue,
    def.dec === undefined ? 1 : def.dec);
}

/**
 * 冠脉行的「并列第二套」：深圳 SZ 法（2021 中国儿童多中心）
 *
 * 结构与主行同形，界面只需在同一行的下一行渲染即可，不必另写分支。
 * @returns {object|null} 非冠脉键返回 null
 */
function buildSzAlt(key, bsa, hasBsa, raw, hasValue) {
  const d = SZ_Z[key];
  if (!d) return null;
  const t = hasBsa ? szAt(key, bsa) : null;
  const z = (t && hasValue) ? (Math.log(raw) - Math.log(t.mean)) / d.rse : null;
  const g = gradeZ(z);
  const has = !!t;
  const rng = function (k) {
    if (!has) return '—';
    return fmt(k === 2 ? t.lo2 : t.lo3, 2) + ' – ' + fmt(k === 2 ? t.hi2 : t.hi3, 2);
  };
  return {
    src: 'sz',
    srcText: 'SZ 法',
    seg: d.seg,
    z: z === null ? null : round(z, 2),
    zText: z === null ? '—' : (z > 0 ? '+' : '') + fmt(z, 2),
    status: g.level,
    statusText: g.text,
    statusCls: g.cls,
    meanText: has ? fmt(t.mean, 2) + ' mm' : '—',
    sdText: has ? 'SD ' + fmt(t.sd, 2) + ' mm' : '—',
    subText: has ? fmt(t.mean, 2) + ' × e^±0.1' : '—',
    rangeText: rng(2),
    range3Text: rng(3),
    // 对数尺度：区间不是「均值 ± kSD」，这里给出乘性写法，避免被误当线性
    mulText: has ? '×e^±' + fmt(2 * d.rse, 2) : '—',
    r2Text: 'R² ' + d.r2.toFixed(2),
    extrap: hasBsa ? !szInRange(bsa) : false,
    hasValue: hasValue,
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

    // Kampmann 分组表参数（M 型房 / 右室前后径）走另一条路径
    if (def.model === 'kamp') {
      rows.push(buildKampRow(key, def, bsa, measured, hasBsa));
      continue;
    }

    // CSMC 三次多项式参数（中国汉族儿童 2D 房室腔径）
    if (def.model === 'csmc') {
      rows.push(buildCsmcRow(key, def, bsa, measured, hasBsa));
      continue;
    }

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
    // ★ 界面单位换算必须同步到「均值」：内径原生单位是 cm，界面是 mm。
    //   v1.6.8 之前这里漏了 ×10，导致同一行里「均值 2.0 mm」与
    //   「±2SD 16.4–23.1 mm」相差 10 倍 —— 用户看到的「不同地方不一样」即此。
    const uiScale = isLength ? 10 : 1;
    const meanUi = hasBsa ? def.mean * Math.pow(bsa, def.a) * uiScale : null;
    const sdUi = hasBsa ? def.sd * Math.pow(bsa, def.a) * uiScale : null;

    // ★ 冠脉三项并列深圳 SZ 法（v1.8.0）：同一测值、两套方程、两个 Z
    const alt = (hasBsa || hasValue) ? buildSzAlt(key, bsa, hasBsa, raw, hasValue) : null;

    rows.push({
      key: key,
      name: def.name,
      unit: uiUnit,
      src: 'phn',
      srcText: 'PHN',
      alt: alt,
      // 指数化后的均值（界面单位），用于解释
      alphaText: 'α=' + def.a.toFixed(2),
      meanText: hasBsa ? fmt(meanUi, decOut) + ' ' + uiUnit : '—',
      sdText: hasBsa ? 'SD ' + fmt(sdUi, decOut) + ' ' + uiUnit : '—',
      // 紧凑显示「均值 ± SD」：窄屏一行放得下，不必换行
      subText: hasBsa
        ? fmt(meanUi, decOut) + ' ± ' + fmt(sdUi, decOut) + ' ' + uiUnit
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
      note: g.note || '',
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
  KAMP_TABLE,
  CSMC_Z,
  SZ_Z,
  SZ_RANGE,
  // 计算
  indexedMean,
  indexedSD,
  zScore,
  gradeZ,
  rangeFromZ,
  kampAt,
  csmcAt,
  szAt,
  szZ,
  szInRange,
  describeZ,
  // 主接口
  buildPedsList,
  buildPedsGrouped,
  // 工具
  round,
  fmt,
};
