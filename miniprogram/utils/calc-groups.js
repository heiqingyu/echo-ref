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
  COLLAPSE: COLLAPSE,
  SIGNS: SIGNS,
  groupOf: groupOf,
};
