/**
 * valve-data.js — 瓣膜页静态内容（小程序页与 build-www 共用）
 *
 * 内容来源：ASE 2017 原生瓣膜反流定量 / ASE-EACVI 2017 主动脉瓣狭窄定量 /
 *           ACC-AHA 2020 瓣膜病分期 / ESC-EACTS 2025 瓣膜病管理 / ASE 2024 人工瓣。
 * 每个瓣膜 = 分级参考表 + 判读要点 + 该瓣膜的计算器字段定义。
 *
 * block 类型：table | h | text | note | formula
 * field：k 键名 / n 名称 / u 单位 / opt 是否可选
 */

const VALVE_SECTIONS = [
  {
    id: 'as',
    tab: 'AS',
    short: '主动脉瓣',
    name: '主动脉瓣狭窄 AS',
    sub: 'Aortic Stenosis · 主动脉瓣',
    source: 'ASE/EACVI 2017 定量分级；ESC/EACTS 2025 管理更新',
    blocks: [
      {
        type: 'table',
        heads: ['指标', '轻度', '中度', '重度'],
        rows: [
          ['Vmax（m/s）', '2.6–2.9', '3.0–3.9', '≥4.0'],
          ['平均压差（mmHg）', '<20', '20–39', '≥40'],
          ['AVA（cm²）', '>1.5', '1.0–1.5', '<1.0'],
          ['AVAi（cm²/m²）', '>0.85', '0.60–0.85', '<0.60'],
          ['DVI', '>0.50', '0.25–0.50', '<0.25'],
        ],
      },
      {
        type: 'text',
        text: '上表为 ASE 定量分级；ACC/AHA 分期的轻度峰速下限为 2.0 m/s，不能把两套体系混写。正常 AVA 约 3–4 cm²。极重度线索：Vmax ≥5 m/s 或平均压差 ≥60 mmHg。',
      },
      { type: 'formula', text: 'AVA = (π × LVOT 直径² ÷ 4 × LVOT VTI) ÷ AV VTI　　DVI = LVOT VTI ÷ AV VTI' },
      {
        type: 'note',
        text: 'AVA 与压差不一致时，先检查 LVOT 内径、PW 取样位置、CW 声束对齐和血压 —— 直径误差会被平方放大。SVi ≤35 mL/m² 为低流量常用界值，边界应结合测量误差。',
      },
      {
        type: 'text',
        text: '低流量低压差：LVEF <50% 为经典型，LVEF ≥50% 为矛盾型。应结合低剂量多巴酚丁胺负荷、流量变化及 CT 瓣膜钙化判断，而非只凭静息 AVA。',
      },
      {
        type: 'text',
        text: 'ESC/EACTS 2025：无症状重度高压差 AS、LVEF ≥50%、低操作风险时可考虑早期干预（IIa A，可行时运动试验证实无症状）；LVEF <50% 且无其他原因则为 I 类推荐。',
      },
    ],
    calcTitle: 'AS 计算器 · 连续方程与峰速法',
    fields: [
      { k: 'lvotD', n: 'LVOT 直径', u: 'cm' },
      { k: 'lvotVti', n: 'LVOT VTI', u: 'cm' },
      { k: 'avVti', n: 'AV VTI（连续方程）', u: 'cm' },
      { k: 'avVmax', n: 'AV Vmax', u: 'm/s' },
      { k: 'lvotVmax', n: 'LVOT Vmax（峰速法，可选）', u: 'm/s', opt: true },
      { k: 'mg', n: '平均跨瓣压差（可选）', u: 'mmHg', opt: true },
    ],
  },

  {
    id: 'ar',
    tab: 'AR',
    short: '主动脉瓣',
    name: '主动脉瓣反流 AR',
    sub: 'Aortic Regurgitation · 主动脉瓣',
    source: 'ASE 2017 原生瓣膜反流定量；ESC/EACTS 2025 管理更新',
    blocks: [
      {
        type: 'table',
        heads: ['指标', '轻度', '中度', '重度'],
        rows: [
          ['缩流颈 VC（cm）', '<0.3', '0.3–0.6', '>0.6'],
          ['反流束宽 ÷ LVOT', '<25%', '25–64%', '≥65%'],
          ['PHT（ms）', '>500', '200–500', '<200'],
          ['反流量 RVol（mL）', '<30', '30–59', '≥60'],
          ['反流分数 RF', '<30%', '30–49%', '≥50%'],
          ['EROA（cm²）', '<0.10', '0.10–0.29', '≥0.30'],
          ['降主动脉反向血流', '短暂早期', '中间表现', '全舒张期；舒张末 ≥20 cm/s 为重要线索'],
        ],
      },
      { type: 'formula', text: 'EROA（cm²）= PISA 流量 ÷ 反流峰速　　RVol（mL）= EROA × 反流 VTI　　RF = RVol ÷ 前向每搏量' },
      {
        type: 'note',
        text: 'PHT 受主动脉 / 左室顺应性与血压影响。急性重度 AR 可以没有左室扩大。偏心束不能只按彩色面积判断，需结合 VC 与 CW 频谱形态。',
      },
      {
        type: 'text',
        text: '测量要点：VC 在主动脉瓣下 5–10 mm 的反流束最窄处测量，彩色标尺建议 50–60 cm/s；反流束宽度比在 PLAX 测量；CW 取样需与反流束平行，偏心束用多切面确认。',
      },
      {
        type: 'note',
        text: '支持重度 AR 的辅助征象：左室扩大（LVEDD >60–65 mm 或 LVESD >45–50 mm）、主动脉根部扩张、二尖瓣提前关闭；CW 频谱密集且陡降（PHT <200 ms）。',
      },
      {
        type: 'text',
        text: 'ESC/EACTS 2025：重度 AR 结合症状及左室尺寸 / 功能评估干预；低风险无症状患者的较早评估纳入 LVESDi >22 mm/m²、LVESVi >45 mL/m² 或 LVEF ≤55%（IIb，非一律手术）。',
      },
    ],
    calcTitle: 'AR 计算器 · PISA 定量与 VC / PHT',
    fields: [
      { k: 'radius', n: 'PISA 半径', u: 'cm' },
      { k: 'aliasVa', n: '混叠速度 Va', u: 'cm/s' },
      { k: 'regV', n: '反流峰速', u: 'm/s' },
      { k: 'regVti', n: '反流 VTI', u: 'cm' },
      { k: 'vc', n: '缩流颈 VC（可选）', u: 'cm', opt: true },
      { k: 'pht', n: '压力半降时间 PHT（可选）', u: 'ms', opt: true },
      { k: 'lvotD', n: 'LVOT 直径（算 RF 用，可选）', u: 'cm', opt: true },
      { k: 'lvotVti', n: 'LVOT VTI（算 RF 用，可选）', u: 'cm', opt: true },
    ],
  },

  {
    id: 'ms',
    tab: 'MS',
    short: '二尖瓣',
    name: '二尖瓣狭窄 MS',
    sub: 'Mitral Stenosis · 二尖瓣',
    source: 'ACC/AHA 2020 分期；ESC/EACTS 2025 临床管理',
    blocks: [
      {
        type: 'table',
        heads: ['项目', '参考与解释'],
        rows: [
          ['MVA · 瓣口面积', '≤1.5 cm² 为临床显著风湿性 MS；≤1.0 cm² 提示非常严重'],
          ['平均跨瓣压差', '受心率、节律、流量和 MR 影响，必须同时记录心率，不能单独代替瓣口面积'],
          ['直接描记', 'PSAX 瓣尖最小开口，注意切面与增益；必要时 3D 辅助，为最可靠的面积测量'],
          ['PHT 法', 'MVA = 220 ÷ PHT；球囊扩张后、顺应性异常、明显 AR 等不可靠'],
        ],
      },
      {
        type: 'table',
        heads: ['严重程度', 'MVA（cm²）', '平均压差（mmHg）', 'PASP（mmHg）'],
        rows: [
          ['轻度 / 不显著', '>1.5', '<5', '<30'],
          ['中度（临床显著）', '1.0–1.5', '5–10', '30–50'],
          ['重度', '<1.0', '>10', '>50'],
        ],
      },
      {
        type: 'note',
        text: '上表压差与肺动脉压阈值来自 ACC/AHA 分期，压差必须注明心率；心率快、心排量高时压差会被放大。',
      },
      {
        type: 'text',
        text: 'Wilkins 评分：瓣叶活动度、增厚、钙化与瓣下病变各 1–4 分；≤8 分通常较有利，但不能替代交界钙化、MR 及左房血栓评估。经皮交界切开还需排除左房血栓及超过轻度 MR 等禁忌。',
      },
      {
        type: 'note',
        text: '风湿性：交界融合、前叶穹隆样开放、腱索增厚。退行性 MAC 相关 MS 机制不同，不能直接套用风湿性 MS 的介入选择标准。',
      },
    ],
    calcTitle: 'MS 计算器 · 瓣口面积与压差',
    fields: [
      { k: 'mvaPlani', n: 'MVA 直接描记（首选）', u: 'cm²', opt: true },
      { k: 'pht', n: '压力半降时间 PHT', u: 'ms', opt: true },
      { k: 'mg', n: '平均跨瓣压差', u: 'mmHg', opt: true },
      { k: 'pasp', n: '估测 PASP（可选）', u: 'mmHg', opt: true },
      { k: 'lvotD', n: 'LVOT 直径（连续方程，可选）', u: 'cm', opt: true },
      { k: 'lvotVti', n: 'LVOT VTI（连续方程，可选）', u: 'cm', opt: true },
      { k: 'mvVti', n: '二尖瓣流入 VTI（连续方程，可选）', u: 'cm', opt: true },
    ],
  },

  {
    id: 'mr',
    tab: 'MR',
    short: '二尖瓣',
    name: '二尖瓣反流 MR',
    sub: 'Mitral Regurgitation · 二尖瓣',
    source: 'ASE 2017 定量；ESC/EACTS 2025 · 原发与继发分开评估',
    blocks: [
      {
        type: 'table',
        heads: ['指标', '轻度', '中度', '重度（原发 MR）'],
        rows: [
          ['VC（cm）', '<0.3', '0.3–0.69', '≥0.7'],
          ['EROA（cm²）', '<0.20', '0.20–0.39', '≥0.40'],
          ['RVol（mL）', '<30', '30–59', '≥60'],
          ['RF', '<30%', '30–49%', '≥50%'],
          ['肺静脉血流', 'S 占优', 'S 减低', '收缩期逆流'],
          ['CW 频谱', '淡 / 不完整', '致密', '致密；可呈早达峰三角形'],
          ['结构', '可正常', '依病因', '连枷瓣、腱索或乳头肌断裂、明显对合缺损'],
        ],
      },
      { type: 'formula', text: 'EROA = 2π × r² × Va ÷ 反流峰速　　RVol = EROA × 反流 VTI　　dP/dt = 32000 ÷ Δt（1→3 m/s 时间，ms）' },
      {
        type: 'text',
        text: 'Carpentier 分型：Ⅰ 型活动正常（瓣环扩大、穿孔）；Ⅱ 型活动过度（脱垂、连枷）；Ⅲa 型收缩和舒张均受限（如风湿）；Ⅲb 型收缩期受限（如缺血性牵拉）。',
      },
      {
        type: 'text',
        text: '瓣叶定位：A1/P1 位于外侧、靠左心耳；A2/P2 居中；A3/P3 位于内侧。脱垂反流束常指向病变瓣叶的对侧，但需多切面证实。',
      },
      {
        type: 'note',
        text: '继发 MR 存在低流量、椭圆 / 新月形反流口及动态变化，PISA 可能低估。ESC/EACTS 2025 强调 EROA ≥0.30 cm² 和/或 RVol ≥45 mL 已可具有重要预后及治疗意义，不能机械套用原发 MR 阈值排除严重病变。',
      },
      {
        type: 'text',
        text: '重度原发 MR：LVEF ≤60%、LVESD ≥40 mm 是重要左室受累标志；2025 ESC 另纳入 LVESDi ≥20 mm/m²。症状、房颤、肺动脉压力、左房扩大及修复可能性也影响干预时机。',
      },
    ],
    calcTitle: 'MR 计算器 · PISA 定量与 dP/dt',
    fields: [
      { k: 'radius', n: 'PISA 半径', u: 'cm' },
      { k: 'aliasVa', n: '混叠速度 Va', u: 'cm/s' },
      { k: 'regV', n: '反流峰速', u: 'm/s' },
      { k: 'regVti', n: '反流 VTI', u: 'cm' },
      { k: 'vc', n: '缩流颈 VC（可选）', u: 'cm', opt: true },
      { k: 'dt', n: 'dP/dt：1→3 m/s 时间（可选）', u: 'ms', opt: true },
      { k: 'lvotD', n: 'LVOT 直径（算 RF 用，可选）', u: 'cm', opt: true },
      { k: 'lvotVti', n: 'LVOT VTI（算 RF 用，可选）', u: 'cm', opt: true },
    ],
  },

  {
    id: 'tr',
    tab: 'TR',
    short: '三尖瓣',
    name: '三尖瓣 TR / TS',
    sub: 'Tricuspid Regurgitation · 三尖瓣',
    source: 'ASE 2017 定量；ASE 2025 右心；ESC/EACTS 2025 管理',
    blocks: [
      {
        type: 'table',
        heads: ['TR 指标', '轻度', '中度', '重度'],
        rows: [
          ['VC（cm）', '<0.3', '0.3–0.69', '≥0.7'],
          ['EROA（cm²）', '<0.20', '0.20–0.39', '≥0.40'],
          ['RVol（mL）', '<30', '30–44', '≥45'],
          ['肝静脉', 'S 占优', 'S 减低', '收缩期逆流'],
          ['CW 频谱', '较淡，抛物线', '致密', '致密、早达峰三角形'],
        ],
      },
      { type: 'formula', text: 'RVSP = 4 × TRV² + RAP　　PASP ≈ RVSP（无 RVOT / 肺动脉瓣梗阻时）　　PVR（WU）≈ 10 × TRV ÷ RVOT VTI + 0.16' },
      {
        type: 'text',
        text: '扩展五级法可将重度以上进一步分为 severe、massive、torrential，用于描述极重反流及介入疗效；不同量化方法的界值不能互换，本表采用常规三级法。',
      },
      {
        type: 'note',
        text: '显著 TR 可能低估 TR 压差；必须结合右室、右房、IVC 及肝静脉。ESC/EACTS 2025 强调在右室或终末器官损害进展前评估干预，合并左侧瓣膜手术时需同时评估三尖瓣。',
      },
      { type: 'h', text: '三尖瓣狭窄 TS' },
      {
        type: 'text',
        text: '平均跨瓣压差 ≥5 mmHg、PHT ≥190 ms、TVA ≤1.0 cm²、流入道 VTI ≥60 cm 支持显著狭窄；结合心率、呼吸及流量判读。',
      },
      {
        type: 'note',
        text: 'TR 峰速 <2.5 m/s 不能排除肺高压；房颤、心率快或右心功能差时 TR 频谱常不完整。RAP 用 IVC 估算仅适用于自主呼吸。',
      },
    ],
    calcTitle: 'TR 计算器 · 反流定量与右心压力',
    fields: [
      { k: 'radius', n: 'PISA 半径', u: 'cm' },
      { k: 'aliasVa', n: '混叠速度 Va', u: 'cm/s' },
      { k: 'regV', n: '反流峰速', u: 'm/s' },
      { k: 'regVti', n: '反流 VTI', u: 'cm' },
      { k: 'vc', n: '缩流颈 VC（可选）', u: 'cm', opt: true },
      { k: 'trV', n: 'TR 峰速（可选）', u: 'm/s', opt: true },
      { k: 'ivc', n: 'IVC 内径（可选）', u: 'mm', opt: true },
    ],
    collapse: true,
  },
];

const IVC_COLLAPSE = [
  { v: '', n: '未知' },
  { v: 'yes', n: '吸气塌陷 >50%' },
  { v: 'no', n: '吸气塌陷 ≤50%' },
];

module.exports = { VALVE_SECTIONS, IVC_COLLAPSE };
