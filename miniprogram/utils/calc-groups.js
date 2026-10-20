/**
 * 公式集分组定义（小程序 / 网页 / APK 共用的唯一定义源）
 *
 * 结构说明：
 *   id     分组标识，也是详情页路由参数（/pages/formula/formula?id=flow）
 *   title  条目名（公式集目录里显示）
 *   sub    一句话说明（目录里的小字）
 *   note   计算页底部的公式与临床备注
 *   fields 输入项：k 键名 / n 名称 / u 单位
 *
 * ★ 新增公式的步骤（目录自动出现，无需改其它文件）：
 *     1) 在 GROUPS 里加一条（id 唯一、含 fields）
 *     2) 在 formula 页的 refresh() 里补该 id 的计算分支
 *     3) 若该公式不在本表（如瓣膜评估的 AS/MS），到 pages/calculators 的 EXTRA 里加
 */

const GROUPS = [
  {
    id: 'flow',
    title: 'LVOT · 每搏量与心排量',
    sub: 'SV · CO · SVi · CI',
    fields: [
      { k: 'ld', n: 'LVOT 直径', u: 'cm' },
      { k: 'lvti', n: 'LVOT VTI', u: 'cm' },
      { k: 'hr', n: '心率', u: '次/min' },
    ],
    note: 'SV = πd²/4 × VTI；CO = SV × HR ÷ 1000',
  },
  {
    id: 'ef',
    title: '左室容积与射血分数',
    sub: 'Simpson 双平面 · EF · SVi · ESVi',
    fields: [
      { k: 'edv', n: '舒张末容积 EDV', u: 'mL' },
      { k: 'esv', n: '收缩末容积 ESV', u: 'mL' },
    ],
    note: 'EF = (EDV − ESV) / EDV；SV = EDV − ESV。有 BSA 时同出 SVi 与 ESVi（ESVi 决定 ICD 指征）。',
  },
  {
    id: 'lvmass',
    title: '左室质量与几何构型',
    sub: 'LV Mass · LVMI · RWT · 四分法',
    fields: [
      { k: 'lvid', n: 'LVIDd（舒张末内径）', u: 'cm' },
      { k: 'ivs', n: 'IVSd（室间隔厚度）', u: 'cm' },
      { k: 'lvpw', n: 'LVPWd（后壁厚度）', u: 'cm' },
    ],
    note: 'LV Mass = 0.8 × 1.04 × [(LVIDd+IVSd+LVPWd)³ − LVIDd³] + 0.6；RWT = 2×LVPWd/LVIDd。LVMI 上限男 115 / 女 95 g/m²。',
  },
  {
    id: 'mapse',
    title: 'MAPSE 长轴收缩',
    sub: '二尖瓣环收缩期位移',
    fields: [
      { k: 'mapse', n: 'MAPSE', u: 'mm' },
    ],
    note: 'MAPSE 正常 ≥10–12 mm；长轴功能常早于 EF 下降，EF 正常而 MAPSE 减低提示早期收缩功能障碍。',
  },
  {
    id: 'dvi',
    title: '无量纲指数 DVI',
    sub: 'LVOT VTI ÷ 主动脉瓣 VTI',
    fields: [
      { k: 'dlvti', n: 'LVOT VTI', u: 'cm' },
      { k: 'davti', n: '主动脉瓣 VTI', u: 'cm' },
    ],
    note: 'DVI ≤0.25 支持重度 AS；不受体表面积与流量影响，低流量状态下比 AVA 更稳。',
  },
  {
    id: 'tei',
    title: 'Tei 指数（MPI）',
    sub: '等容时间之和 ÷ 射血时间',
    fields: [
      { k: 'ivct', n: '等容收缩时间 IVCT', u: 'ms' },
      { k: 'ivrt', n: '等容舒张时间 IVRT', u: 'ms' },
      { k: 'et', n: '射血时间 ET', u: 'ms' },
      { k: 'tside', n: '侧别（右室填 2，留空按左室）', u: '' },
    ],
    note: 'MPI = (IVCT + IVRT) / ET；左室 >0.40、右室 >0.55 为异常。心率与负荷会影响测值。',
  },
  {
    id: 'mpap',
    title: '平均肺动脉压',
    sub: '舒张期肺动脉反流法',
    fields: [
      { k: 'prv', n: '肺动脉反流峰速 Vmax', u: 'm/s' },
      { k: 'mrap', n: '右房压 RAP', u: 'mmHg' },
    ],
    note: 'mPAP = 4 × PR Vmax² + RAP；>25 mmHg 符合肺高压。也可用 Mahan 近似 0.61 × sPAP + 2。',
  },
  {
    id: 'shunt',
    title: 'Qp/Qs 肺体循环血流比',
    sub: '分流方向与分流量分级',
    fields: [
      { k: 'rd', n: 'RVOT 直径', u: 'cm' },
      { k: 'rvti', n: 'RVOT VTI', u: 'cm' },
      { k: 'ld', n: 'LVOT 直径（体循环）', u: 'cm' },
      { k: 'lvti', n: 'LVOT VTI（体循环）', u: 'cm' },
    ],
    note: 'Qp/Qs = (π·d_RVOT²/4 × VTI_RVOT) ÷ (π·d_LVOT²/4 × VTI_LVOT)；>2.0 大量分流、1.5–2.0 中等量、<1.0 提示净右向左。反流、多处梗阻会影响结果',
  },
  {
    id: 'bernoulli',
    title: '简化伯努利压差',
    sub: 'ΔP = 4(V₂² − V₁²)',
    fields: [
      { k: 'v2', n: '远端峰速 V₂', u: 'm/s' },
      { k: 'v1', n: '近端峰速 V₁（可选）', u: 'm/s' },
    ],
    note: 'ΔP = 4(V₂² − V₁²)；缺省 V₁ 按 0 处理。瓣膜狭窄 / 反流的定量计算见「瓣膜评估」页',
  },
  {
    id: 'atrial',
    title: '心房容积指数',
    sub: 'LAVI · RAVI',
    fields: [
      { k: 'lav', n: '左房容积', u: 'mL' },
      { k: 'rav', n: '右房容积', u: 'mL' },
    ],
    note: '容积 ÷ BSA；LAVI 正常 ≤34 mL/m²；右房正常值需匹配测量方法',
  },
  {
    id: 'dias',
    title: '舒张功能基础比值',
    sub: 'E/A · 平均 E/e′',
    fields: [
      { k: 'e', n: 'E 峰', u: 'cm/s' },
      { k: 'a', n: 'A 峰', u: 'cm/s' },
      { k: 'es', n: '间隔 e′', u: 'cm/s' },
      { k: 'el', n: '侧壁 e′', u: 'cm/s' },
    ],
    note: 'E/e′ <8 左房压正常，>14 升高，8–14 为灰区；完整分级需结合 LAVI、肺静脉等',
  },

  /* ══════════════════════════════════════════════════════════
     右心与肺循环（sec: 'right'）
     ══════════════════════════════════════════════════════════ */
  {
    id: 'paspv',
    sec: 'right',
    title: '肺动脉收缩压 PASP',
    sub: 'TR 压差 + 右房压 · 轻中重分级',
    fields: [
      { k: 'ptrv', n: 'TR 峰速 Vmax', u: 'm/s' },
      { k: 'prap', n: '右房压 RAP', u: 'mmHg' },
    ],
    note: 'PASP = 4 × Vmax² + RAP；≤36 正常 / 37–49 轻 / 50–69 中 / ≥70 重度。肺动脉瓣狭窄或 RVOT 梗阻时会高估',
  },
  {
    id: 'rapv',
    sec: 'right',
    title: '右房压（IVC 法）',
    sub: 'ASE 三分级 · 3 / 8 / 15 mmHg',
    fields: [
      { k: 'rivc', n: 'IVC 内径', u: 'mm' },
    ],
    note: 'IVC ≤21 mm 且塌陷 >50% → 3；>21 mm 且塌陷 ≤50% → 15；其余 → 8。仅限自主呼吸，机械通气时不可靠',
  },
  {
    id: 'rvfacv',
    sec: 'right',
    title: '右室面积变化分数 FAC',
    sub: '(RVEDA − RVESA) ÷ RVEDA',
    fields: [
      { k: 'feda', n: '舒张末面积 RVEDA', u: 'cm²' },
      { k: 'fesa', n: '收缩末面积 RVESA', u: 'cm²' },
    ],
    note: 'FAC <35% 提示右室收缩功能减低；<25% 为明显减低。与 TAPSE、S′、RVFWS 合看更可靠',
  },
  {
    id: 'rcratiov',
    sec: 'right',
    title: 'TAPSE/PASP 耦联比',
    sub: '右室收缩 ÷ 肺动脉负荷',
    fields: [
      { k: 'ctapse', n: 'TAPSE', u: 'mm' },
      { k: 'cpasp', n: 'PASP', u: 'mmHg' },
    ],
    note: '≥0.55 耦联保留；0.36–0.55 临界；<0.36 显著失耦联（预后差）。负荷升高而收缩未代偿时比值先下降',
  },
  {
    id: 'pvrv',
    sec: 'right',
    title: '肺血管阻力 PVR',
    sub: '(mPAP − PAWP) ÷ CO · WU',
    fields: [
      { k: 'hmmpap', n: '平均肺动脉压 mPAP', u: 'mmHg' },
      { k: 'hmpawp', n: '肺动脉楔压 PAWP', u: 'mmHg' },
      { k: 'hmco', n: '心输出量 CO', u: 'L/min' },
    ],
    note: 'PVR(WU) = (mPAP − PAWP) / CO；≤2 正常、2–3 轻、3–5 中、>5 重度。先心病可手术性常以 <3 WU 为界，确诊需右心导管',
  },
  {
    id: 'svrv',
    sec: 'right',
    title: '体循环血管阻力 SVR',
    sub: '(MAP − RAP) × 80 ÷ CO',
    fields: [
      { k: 'smap', n: '平均动脉压 MAP', u: 'mmHg' },
      { k: 'srap', n: '右房压 RAP', u: 'mmHg' },
      { k: 'sco', n: '心输出量 CO', u: 'L/min' },
    ],
    note: '正常 800–1200 dyn·s·cm⁻⁵；有 BSA 时同出 SVRI（1600–2400）。<800 见于分布性休克 / 分流，>1200 提示后负荷升高',
  },

  /* ══════════════════════════════════════════════════════════
     瓣膜与舒张定量（sec: 'vq'）
     ══════════════════════════════════════════════════════════ */
  {
    id: 'pisav',
    sec: 'vq',
    title: '反流定量（PISA）',
    sub: 'EROA · RVol · 反流分级',
    fields: [
      { k: 'prad', n: 'PISA 半球半径 r', u: 'cm' },
      { k: 'palias', n: 'Nyquist 速度（默认 40）', u: 'cm/s' },
      { k: 'pvmax', n: '反流峰速 Vmax', u: 'm/s' },
      { k: 'pvti', n: '反流 VTI', u: 'cm' },
    ],
    note: '流量 = 2πr²×Nyquist；EROA = 流量 ÷ Vmax(cm/s)；RVol = EROA × VTI。MR：EROA ≥0.4 / RVol ≥60 为重度。PISA 假设半球形，偏心束会低估',
  },
  {
    id: 'avav',
    sec: 'vq',
    title: '主动脉瓣面积（连续性方程）',
    sub: 'AVA · AVAi · DVI',
    fields: [
      { k: 'ald', n: 'LVOT 直径', u: 'cm' },
      { k: 'alvti', n: 'LVOT VTI', u: 'cm' },
      { k: 'aavti', n: '主动脉瓣 VTI', u: 'cm' },
    ],
    note: 'AVA = (πd²/4 × VTI_LVOT) ÷ VTI_AV；AVAi = AVA/BSA（≤0.6 重度）。DVI = VTI_LVOT/VTI_AV，≤0.25 支持重度 AS',
  },
  {
    id: 'mvav',
    sec: 'vq',
    title: '二尖瓣面积（PHT 法）',
    sub: 'MVA = 220 ÷ PHT',
    fields: [
      { k: 'mpht', n: '压力减半时间 PHT', u: 'ms' },
      { k: 'msv', n: '每搏量 SV（可选，作连续方程）', u: 'mL' },
      { k: 'mvvti', n: '二尖瓣 VTI（可选）', u: 'cm' },
    ],
    note: 'MVA = 220/PHT；>1.5 轻度、1.0–1.5 中度、<1.0 重度。房颤、合并反流或重度钙化时 PHT 不可靠，需连续方程或平面法校正',
  },
  {
    id: 'ppm',
    sec: 'vq',
    title: '人工瓣 EOAi 与 PPM',
    sub: '有效开口面积指数 · 患者-瓣膜不匹配',
    fields: [
      { k: 'peoa', n: '有效开口面积 EOA', u: 'cm²' },
      { k: 'ppos', n: '位置（1 主动脉 / 2 二尖瓣，留空按主动脉）', u: '' },
    ],
    note: 'EOAi = EOA/BSA。主动脉位 <0.85 重度、0.85–1.0 中度；二尖瓣位 <0.9 重度、0.9–1.2 中度。重度 PPM 影响症状与预后',
  },
  {
    id: 'dfun',
    sec: 'vq',
    title: '舒张功能分级（四步法）',
    sub: 'E/A · E/e′ · LAVi · TR Vmax',
    fields: [
      { k: 'dfe', n: 'E 峰', u: 'cm/s' },
      { k: 'dfa', n: 'A 峰', u: 'cm/s' },
      { k: 'dfes', n: '间隔 e′', u: 'cm/s' },
      { k: 'dfel', n: '侧壁 e′', u: 'cm/s' },
      { k: 'dflavi', n: 'LAVi（可选）', u: 'mL/m²' },
      { k: 'dftrv', n: 'TR Vmax（可选）', u: 'm/s' },
    ],
    note: '2016 ASE/EACVI 简化路径：E/A ≥2 或 E/A ≤0.8 结合三个升高指标（E/e′ >14、LAVi >34、TR Vmax >2.8）分为 Ⅰ/Ⅱ/Ⅲ 级。灰区需结合临床',
  },

  /* ══════════════════════════════════════════════════════════
     重构与心肌功能（sec: 'recon'）
     ══════════════════════════════════════════════════════════ */
  {
    id: 'volidx',
    sec: 'recon',
    title: '容积指数与重构分级',
    sub: 'EDVi · ESVi · SVi（按性别）',
    fields: [
      { k: 'vedv', n: '舒张末容积 EDV', u: 'mL' },
      { k: 'vesv', n: '收缩末容积 ESV', u: 'mL' },
    ],
    note: 'EDVi 上限男 74 / 女 61，ESVi 上限男 31 / 女 24 mL/m²；ESVi >45 提示收缩功能显著减低。需先填身高体重',
  },
  {
    id: 'rwsv',
    sec: 'recon',
    title: '相对室壁应力 RWS',
    sub: '后负荷与室壁厚度的匹配',
    fields: [
      { k: 'rsbp', n: '收缩压 SBP', u: 'mmHg' },
      { k: 'rlvedd', n: 'LVEDD', u: 'cm' },
      { k: 'rpwt', n: '后壁厚度 PWT', u: 'cm' },
    ],
    note: 'RWS = 0.334 × SBP × LVEDD / [PWT × (1 + PWT/LVEDD)]，单位 10³ dyn/cm²；正常 60–160，>160 后负荷偏高',
  },
  {
    id: 'spher',
    sec: 'recon',
    title: '左室球形指数',
    sub: '短径 ÷ 长径（舒张末）',
    fields: [
      { k: 'sdd', n: '左室短径', u: 'cm' },
      { k: 'sld', n: '左室长径', u: 'cm' },
    ],
    note: 'SI ≤0.65 形态正常；0.66–0.75 球形化；>0.75 显著球形化（重构、预后差）。需同一时相测量',
  },
  {
    id: 'lastrain',
    sec: 'recon',
    title: '左房应变三值',
    sub: '储备 LASr · 管道 LAScd · 泵 LASct',
    fields: [
      { k: 'lsr', n: '储备应变 LASr', u: '%' },
      { k: 'lscd', n: '管道应变 LAScd', u: '%' },
      { k: 'lsct', n: '泵应变 LASct（填绝对值）', u: '%' },
    ],
    note: 'LASr ≥30 正常、23–30 轻度、18–23 中度、<18 重度减低（HFpEF 相关阈值 23%）；LASr ≈ LAScd + |LASct|，偏差 >5 提示勾画有问题',
  },
  {
    id: 'aortaidx',
    sec: 'recon',
    title: '升主动脉直径指数',
    sub: '内径 ÷ BSA · 扩张分层',
    fields: [
      { k: 'aodim', n: '升主动脉内径', u: 'mm' },
    ],
    note: '≤1.9 正常、1.9–2.1 边缘、>2.1 扩张、>2.6 显著扩张 cm/m²；绝对值上限男 3.6 / 女 3.3 cm',
  },
  {
    id: 'mdsv',
    sec: 'recon',
    title: '应变离散度 MDS',
    sub: '六壁峰值应变的均值与标准差',
    fields: [
      { k: 'mds1', n: '前壁', u: '%' },
      { k: 'mds2', n: '下壁', u: '%' },
      { k: 'mds3', n: '侧壁', u: '%' },
      { k: 'mds4', n: '室间隔', u: '%' },
      { k: 'mds5', n: '后壁', u: '%' },
      { k: 'mds6', n: '前间隔', u: '%' },
    ],
    note: '六壁峰值纵向应变的标准差；健康人 <4–5%，≥5% 提示区域收缩差异（缺血 / 淀粉样变 / 失同步）。非时间型机械离散度 MAD',
  },
  {
    id: 'swv',
    sec: 'recon',
    title: '每搏功 SW / SWi',
    sub: 'SV × MAP × 0.0136',
    fields: [
      { k: 'ssv', n: '每搏量 SV', u: 'mL' },
      { k: 'wmap', n: '平均动脉压 MAP', u: 'mmHg' },
    ],
    note: 'SW(g·m) = SV × MAP × 0.0136，正常 60–110；SWi = SW/BSA。心肌做功 GWI/GCW/GWE 需压力-应变环与专有软件，无法由血压 + GLS 手算',
  },
];

/**
 * 计算类条目的目录分组（按顺序渲染）
 *
 * GROUPS 里每条用 sec 指定归属，缺省 'hemo'。
 * 拆成 4 组是为了别把 29 个公式堆在一个组里（目录太长）。
 */
const CALC_SECTIONS = [
  { id: 'hemo', title: '血流动力学与心功能' },
  { id: 'right', title: '右心与肺循环' },
  { id: 'vq', title: '瓣膜与舒张定量' },
  { id: 'recon', title: '重构与心肌功能' },
];

/** IVC 塌陷选项 */
const COLLAPSE = [
  { v: '', n: '未知' },
  { v: 'yes', n: '吸气塌陷 >50%' },
  { v: 'no', n: '吸气塌陷 ≤50%' },
];

/** PH 支持征象选项 */
const SIGNS = [
  { v: '', n: '未评估' },
  { v: 'yes', n: '有（≥2 类）' },
  { v: 'no', n: '无' },
];

/** 按 id 取分组 */
function groupOf(id) {
  for (let i = 0; i < GROUPS.length; i += 1) {
    if (GROUPS[i].id === id) return GROUPS[i];
  }
  return null;
}

module.exports = {
  GROUPS: GROUPS,
  CALC_SECTIONS: CALC_SECTIONS,
  COLLAPSE: COLLAPSE,
  SIGNS: SIGNS,
  groupOf: groupOf,
};
