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

// Wilkins 分项的 1–4 分描述放在引擎里（WILKINS_ITEMS），这里只负责渲染，
// 避免同一套评分标准在数据层与计算层各写一遍、改了一处漏另一处
const EC = require('./echo-calc.js');

/** 把 WILKINS_ITEMS 转成 blocks（每项一个小表：分值 → 形态） */
function wilkinsBlocks() {
  const out = [];
  (EC.WILKINS_ITEMS || []).forEach(function (it, i) {
    out.push({ kind: 'h', text: '①②③④'.charAt(i) + ' ' + it.n + ' ' + it.en });
    out.push({
      kind: 'table',
      heads: ['分', '形态学标准'],
      rows: it.levels.map(function (d, j) { return [String(j + 1), d]; }),
    });
  });
  out.push({ kind: 'note', text: '**按描述对号入座，不要先想总分再倒推打分**。四项各 1–4 分：≤8 适合 PBMV；9–11 为边缘区需个体化；≥12 优先外科。评分主观性较大，报告应写明哪一项扣分最多。', warn: true });
  return out;
}

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
    sec: 'right',
    title: '肺动脉压 · 肺高压评估',
    sub: 'IVC 估 RAP · sPAP / dPAP / mPAP · ESC/ERS 可能性',
    fields: [
      { k: 'pp_ivc', n: 'IVC 内径（估 RAP）', u: 'mm', opt: true },
      { k: 'pp_rap', n: '右房压 RAP（可选，填了优先）', u: 'mmHg', opt: true },
      { k: 'pp_tr', n: 'TR 峰速 Vmax', u: 'm/s' },
      { k: 'pp_pr', n: 'PR 舒张末期流速（可选）', u: 'm/s', opt: true },
      { k: 'pp_rvotat', n: 'RVOT 加速时间（可选）', u: 'ms', opt: true },
    ],
    note: 'RAP：IVC ≤21 mm 且吸气塌陷 >50% → 3；IVC >21 mm 且塌陷 ≤50% → 15；其余 8 mmHg（正常 0–5，>10 提示升高）。sPAP = 4 × TR Vmax² + RAP（≤36 正常 / 37–49 轻 / 50–69 中 / ≥70 重度）；dPAP = 4 × PR 舒张末 V² + RAP（正常 8–15）；mPAP = (sPAP + 2 × dPAP) / 3，只有 TR 时退回 Mahan 0.61 × sPAP + 2（正常 ≤20）。可能性按 ESC/ERS 2022：TR ≤2.8 无征象低、2.9–3.4 或伴征象中、>3.4 或 2.9–3.4 伴征象高。超声只给「可能性」，确诊要右心导管（mPAP >20 mmHg、PVR >2 WU）',
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
  /* ══════════════════════════════════════════════════════════
     右心与肺循环（sec: 'right'）
     ══════════════════════════════════════════════════════════ */
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

  /* ══ v1.2.9 第二批：右心与肺循环补全 ══ */
  {
    id: 'rvvol',
    sec: 'right',
    title: '右室容积指数 RVEDVi / RVESVi',
    sub: '按性别分档 · 右室扩大与 ARVC 随访',
    fields: [
      { k: 'rvedv', n: 'RV 舒张末容积', u: 'mL' },
      { k: 'rvesv', n: 'RV 收缩末容积（可选）', u: 'mL' },
    ],
    note: 'RVEDVi 上限男 87 / 女 75 mL/m²；RVESVi 上限男 44 / 女 35 mL/m²（ASE 右心指南）。右室扩大而左室正常时注意 ARVC、房间隔缺损、肺高压；随访必须同一方法（3D 或 2D 面积长度法）',
  },
  {
    id: 'rvfws',
    sec: 'right',
    title: '右室游离壁应变 RVFWS',
    sub: '三节段均值 · |均值| <20% 提示减低',
    fields: [
      { k: 'rfb', n: '基底段', u: '%' },
      { k: 'rfm', n: '中间段', u: '%' },
      { k: 'rfa', n: '心尖段', u: '%' },
    ],
    note: 'RVFWS 正常 |均值| ≥20%（即 ≤ −20%）。右室纵向功能常先于 TAPSE、FAC 下降；填负数更符合习惯（如 −24）。仅填一到两段也能算，但三段齐全更可靠',
  },
  {
    id: 'papi',
    sec: 'right',
    title: 'PAPi 肺动脉搏动指数',
    sub: '(sPAP − dPAP) ÷ RAP · <1.85 失耦联',
    fields: [
      { k: 'pispap', n: '肺动脉收缩压 sPAP', u: 'mmHg' },
      { k: 'pidpap', n: '肺动脉舒张压 dPAP', u: 'mmHg' },
      { k: 'pirap', n: '右房压 RAP', u: 'mmHg' },
    ],
    note: 'PAPi = (sPAP − dPAP) / RAP，反映右室与肺循环的耦联。<1.85 提示失耦联，肺高压与心衰患者预后差；>2.0 相对保留。RAP 必须先由 IVC 估出',
  },
  {
    id: 'residx',
    sec: 'right',
    title: '阻力指数 PVRI / SVRI',
    sub: 'PVR、SVR 按 BSA 指数化',
    fields: [
      { k: 'ripvr', n: 'PVR（可选）', u: 'WU' },
      { k: 'risvr', n: 'SVR（可选）', u: 'dyn·s·cm⁻⁵' },
    ],
    note: 'PVRI = PVR × BSA，正常 3–5 WU·m²，>5 提示肺血管阻力显著升高（先心手术决策关键）；SVRI = SVR × BSA，正常 1970–2390 dyn·s·cm⁻⁵·m²。体型差异大时必须指数化',
  },
  {
    id: 'rvdvdt',
    sec: 'right',
    title: '右室 dP/dt',
    sub: 'TR 反流谱 1→2 m/s 的 Δt · <400 减低',
    fields: [
      { k: 'rdt', n: '1→2 m/s 时间差 Δt', u: 'ms' },
    ],
    note: '两点的压差差为 4×2² − 4×1² = 12 mmHg，故 dP/dt = 12 ÷ Δt(s)，单位 mmHg/s。<400 提示右室收缩功能减低（同左心 dP/dt 需 >1000）',
  },

  /* ══ 瓣膜专用定量（v1.4.1：从小程序瓣膜页搬进公式集，三端条目一致） ══
   * 字段与 miniprogram/utils/valve-data.js 的 VALVE_SECTIONS 一一对应，
   * 计算统一走 valve-calc.js 的 valveCalc(id, v, bsa)，不另写一套公式。
   */
  /* ★ v1.4.4：AS / AR / MS / MR 四条并入「二尖瓣疾病评估」「主动脉瓣疾病评估」两个评估页，
   *   输入与结果都在评估页内完成，公式集目录不再单列；TR 仍为独立计算条目。 */
  {
    id: 'tr',
    sec: 'valve',
    title: 'TR 三尖瓣反流定量',
    sub: 'EROA · RVol · TR 峰速 · IVC',
    fields: [
      { k: 'tr_radius', n: 'PISA 半径', u: 'cm' },
      { k: 'tr_aliasVa', n: '混叠速度 Va', u: 'cm/s' },
      { k: 'tr_regV', n: '反流峰速', u: 'm/s' },
      { k: 'tr_regVti', n: '反流 VTI', u: 'cm' },
      { k: 'tr_vc', n: '缩流颈 VC（可选）', u: 'cm', opt: true },
      { k: 'tr_trV', n: 'TR 峰速（可选）', u: 'm/s', opt: true },
      { k: 'tr_ivc', n: 'IVC 内径（可选）', u: 'mm', opt: true },
    ],
    note: 'PISA：EROA = 2πr²Va ÷ Vmax，RVol = EROA × VTI_TR；TR 峰速按 4V² 得压差，配合 IVC 内径估右房压算出 PASP。填了 VC 会给缩流颈分级',
  },

  /* ══ v1.3.0 第三批：瓣膜与舒张细节 ══ */
  {
    id: 'laef',
    sec: 'recon',
    title: '左房排空分数 LAEF',
    sub: 'LAEF 与 LA 扩张指数',
    fields: [
      { k: 'lavmax', n: 'LA 最大容积', u: 'mL' },
      { k: 'lavmin', n: 'LA 最小容积', u: 'mL' },
    ],
    note: 'LAEF = (LAVmax − LAVmin) / LAVmax，正常 ≥50%；扩张指数 = (LAVmax − LAVmin) / LAVmin。LAEF 减低提示左房机械功能受损，房颤消融前后与 HFpEF 评估常用',
  },
  {
    id: 'quickratio',
    sec: 'hemo',
    title: '快速比值：LA/Ao · RV/LV',
    sub: '床头最常用的两个半定量比值',
    fields: [
      { k: 'qla', n: '左房内径 LA', u: 'mm' },
      { k: 'qao', n: '主动脉根部 Ao', u: 'mm' },
      { k: 'qrv', n: '右室舒张末内径 RV', u: 'mm' },
      { k: 'qlv', n: '左室舒张末内径 LV', u: 'mm' },
    ],
    note: 'LA/Ao ≤1.1 正常，>1.1 提示左房增大；RV/LV >0.6 提示右室扩大（>1.0 高度提示右心负荷过重）。两单位同组一致即可，不必换算',
  },
  {
    id: 'lvmih',
    sec: 'recon',
    title: 'LVMI 身高^2.7（肥胖适用）',
    sub: 'de Simone 指数 · 男 >50 女 >47',
    fields: [
      { k: 'lhmass', n: '左室质量 LV Mass', u: 'g' },
      { k: 'lhheight', n: '身高', u: 'cm' },
    ],
    note: 'LVMI = Mass / 身高(m)^2.7，男 >50、女 >47 g/m^2.7 提示左室肥厚。肥胖患者按 BSA 指数化会低估肥厚程度，此时应改用身高^2.7',
  },

  /* ══ v1.3.0 第四批：先心 / 心肌 / 耦联 ══ */
  {
    id: 'paidx',
    sec: 'chd',
    title: 'McGoon 比值与 Nakata 指数',
    sub: '肺动脉发育 · 先心根治可行性',
    fields: [
      { k: 'prpa', n: '右肺动脉 RPA', u: 'mm' },
      { k: 'plpa', n: '左肺动脉 LPA', u: 'mm' },
      { k: 'pdao', n: '膈肌水平降主动脉（可选）', u: 'mm' },
    ],
    note: 'McGoon = (RPA + LPA) ÷ 降主动脉，≥1.8 可考虑根治（>2.0 更理想）；Nakata = 左右肺动脉截面积之和 ÷ BSA（需身高体重），≥150 mm²/m² 可考虑根治。新生儿与术后随访必须用同一口径',
  },
  {
    id: 'ras',
    sec: 'recon',
    title: '心尖保留比值 RAS',
    sub: '心尖段 ÷ 基底段 · ≥1 提示淀粉样变',
    fields: [
      { k: 'rasap', n: '心尖段平均应变', u: '%' },
      { k: 'rasba', n: '基底段平均应变', u: '%' },
    ],
    note: 'RAS = |心尖段均值| ÷ |基底段均值|。≥1 提示相对心尖保留，是心肌淀粉样变的典型表现（需结合左室壁增厚、心电图低电压、其他征象）；典型淀粉样变多为 2.0 以上',
  },
  {
    id: 'ea',
    sec: 'hemo',
    title: '有效动脉弹性 Ea / Ees-Ea 耦联',
    sub: 'ESP ÷ SV · Ees/Ea ≈ SV ÷ ESV',
    fields: [
      { k: 'eaesp', n: '收缩末压 ESP', u: 'mmHg' },
      { k: 'easv', n: '每搏量 SV', u: 'mL' },
      { k: 'eaesv', n: '收缩末容积 ESV', u: 'mL' },
    ],
    note: 'Ea = ESP / SV（mmHg/mL）；单点 Ees ≈ ESP / ESV，故 Ees/Ea = SV / ESV。常见区间 0.8–1.5，心衰时降低。单点法仅作趋势参考，不能替代压力-容积环',
  },
  {
    id: 'coa',
    sec: 'chd',
    title: '主动脉缩窄压差与拖尾',
    sub: '峰值压差 · 舒张末期持续血流',
    fields: [
      { k: 'coav', n: '缩窄处峰值流速', u: 'm/s' },
      { k: 'coaved', n: '舒张末期流速（可选）', u: 'm/s' },
    ],
    note: '压差 = 4 × Vmax²。峰值压差 ≥20 mmHg 提示有血流动力学意义；舒张末期仍有 ≥5 mmHg 压差说明存在持续跨缩窄血流（拖尾征）。新生儿期压差可能不高，需结合形态与左室肥厚',
  },
  {
    id: 'aortaz',
    sec: 'chd',
    title: '主动脉分节段 Z 值',
    sub: '瓣环 / 窦部 / 窦管交界 / 升主动脉 · 成人参考区间',
    opts: [
      { k: 'azsex', n: '性别', list: [['m', '男'], ['f', '女']] },
    ],
    fields: [
      { k: 'azann', n: '主动脉瓣环', u: 'mm' },
      { k: 'azsin', n: '窦部（Valsalva）', u: 'mm' },
      { k: 'azstj', n: '窦管交界', u: 'mm' },
      { k: 'azasc', n: '近段升主动脉', u: 'mm' },
    ],
    note: '四个位点可只填测到的。Z 值由站内成人参考区间反推（均值 = 区间中点，SD = 半径 ÷ 1.96），口径与「Z > 2 视为扩张」一致，但不是人群实测 SD，不能与儿童 Z 值或 CT 的 Z 值互换。近段升主动脉另按 BSA 指数化：男 ≥2.1、女 ≥2.0 cm/m² 提示扩张。测量须舒张末、垂直于长轴、内缘到内缘，随访用同一标准',
  },

  /* ══════════════════════════════════════════════════════════
     v1.3.2 跨指标派生量（补的是「两项凑一个判读量」的空白）
     ══════════════════════════════════════════════════════════ */
  {
    id: 'lastiff',
    sec: 'recon',
    title: '左房僵硬度',
    sub: 'E/e′ ÷ LARS',
    fields: [
      { k: 'lsee', n: 'E/e′', u: '' },
      { k: 'lslars', n: 'LARS（填正数）', u: '%' },
    ],
    note: 'LA stiffness = E/e′ ÷ LARS，LARS 填正数百分值（如 25 表示 25%）。≤0.47 正常，>0.47 支持 HFpEF，>0.60 明显僵硬。E/e′ 只反映压力，除以泵血效能才反映「心房壁有多硬」——所以 LARS 已明显减低（<18%）时比值会被分母放小或放大，要结合 LA 容积一起看',
  },
  {
    id: 'vtir',
    sec: 'hemo',
    title: 'RVOT / LVOT VTI 比',
    sub: '不测直径的分流替代量',
    fields: [
      { k: 'vtrvo', n: 'RVOT VTI', u: 'cm' },
      { k: 'vtrlo', n: 'LVOT VTI', u: 'cm' },
    ],
    note: '正常 0.7–1.05；>1.2 提示左向右分流（可近似当 Qp/Qs），<0.6 提示肺血流减少（右向左分流或肺动脉血流受限）。优点是不用测两处直径——直径平方的误差会被放大两次，VTI 比只依赖两次多普勒包络',
  },
  {
    id: 'lvnc',
    sec: 'recon',
    title: '致密化不全 NC/C 比',
    sub: '非致密层 ÷ 致密层',
    fields: [
      { k: 'lnvnc', n: '非致密层厚度', u: 'mm' },
      { k: 'lnvc', n: '致密层厚度', u: 'mm' },
    ],
    note: 'Jenni（超声，收缩末期短轴）>2.0；Petersen（CMR，舒张末期）>2.3。★ 比值只是三条标准之一，还必须有：两层结构分明、深陷隐窝与左室腔血流相通（彩色多普勒见穿入血流）。把乳头肌与小梁误当非致密层是假阳性最常见原因，必须同部位同时相测量',
  },

  /* ══════════════════════════════════════════════════════════
     瓣膜与舒张定量（sec: 'vq'）
     ══════════════════════════════════════════════════════════ */
  {
    id: 'ppm',
    sec: 'valve',
    title: '人工瓣 EOAi 与 PPM',
    sub: '有效开口面积指数 · 患者-瓣膜不匹配',
    fields: [
      { k: 'peoa', n: '有效开口面积 EOA', u: 'cm²' },
      { k: 'ppos', n: '位置（1 主动脉 / 2 二尖瓣，留空按主动脉）', u: '' },
      { k: 'pbmi', n: 'BMI（可选；≥30 用肥胖切点）', u: 'kg/m²' },
    ],
    note: 'EOAi = EOA/BSA。**按 R15（ASE 2024）Table 7**：主动脉位 正常 >0.85、中度 0.85–0.66、重度 ≤0.65；二尖瓣位 正常 >1.2、中度 1.2–0.91、重度 ≤0.90（cm²/m²）。**BMI ≥30 时整体下调**：主动脉位 0.70 / 0.56，二尖瓣位 1.0 / 0.75。判读前提：瓣膜结构与活动正常、实测 EOA 在参考 EOA 的 1 SD 内',
  },
  {
    id: 'dfun',
    sec: 'hemo',
    title: '左室舒张功能（E/A · E/e′ · E/Vp · 分级）',
    sub: '四步法分级 · 左房压估测 · 2022 更新',
    fields: [
      { k: 'dfe', n: 'E 峰', u: 'cm/s' },
      { k: 'dfa', n: 'A 峰', u: 'cm/s' },
      { k: 'dfes', n: '间隔 e′', u: 'cm/s' },
      { k: 'dfel', n: '侧壁 e′', u: 'cm/s' },
      { k: 'dflavi', n: 'LAVi（可选）', u: 'mL/m²' },
      { k: 'dftrv', n: 'TR Vmax（可选）', u: 'm/s' },
      { k: 'dfvp', n: 'Vp 血流传播速度（可选）', u: 'cm/s' },
    ],
    note: '2016 ASE/EACVI 简化路径：E/A ≥2，或 E/A ≤0.8 结合三个升高指标（平均 E/e′ >14、LAVi >34、TR Vmax >2.8），分 Ⅰ/Ⅱ/Ⅲ 级（Ⅰ 松弛受损 · Ⅱ 假性正常化 · Ⅲ 限制性）。同屏给出平均 E/e′（<8 正常、>14 升高、8–14 灰区）与 E/Vp（≤1.5 正常，>2.5 约 PCWP >18 mmHg）；Vp 用彩色 M 型四腔切面测（正常 ≥45 cm/s），与 E 同单位。灰区一律结合临床',
  },

  /* ══════════════════════════════════════════════════════════
     重构与心肌功能（sec: 'recon'）
     ══════════════════════════════════════════════════════════ */
  {
    id: 'sync',
    sec: 'recon',
    title: '心脏同步化（机械不同步）',
    sub: 'SPWMD · IVMD · Ts-SD · 闪动 / 摇摆 · CRT 术前旁证',
    opts: [
      { k: 'sy_flash', n: '室间隔闪动', list: [['n', '无'], ['y', '有']] },
      { k: 'sy_rock', n: '心尖摇摆', list: [['n', '无'], ['y', '有']] },
    ],
    fields: [
      { k: 'sy_spwmd', n: 'SPWMD 室间隔-后壁延迟', u: 'ms' },
      { k: 'sy_ivmd', n: 'IVMD 主-肺动脉射血前间期差', u: 'ms' },
      { k: 'sy_tssd', n: 'Ts-SD-12 应变达峰时间标准差', u: 'ms' },
    ],
    note: '阈值：SPWMD ≥130 ms、IVMD ≥40 ms、Ts-SD-12 ≥33 ms；室间隔闪动与心尖摇摆为肉眼征象，出现即记阳性。三项数值可只填测到的，**≥2 项阳性才算证据较充分**。★ PROSPECT 研究：没有任何单项超声不同步指标能优于体表 ECG 预测 CRT 反应，本条目只作旁证描述，不能单独决定是否植入；术前仍以 LVEF、QRS 形态与时限为主',
  },
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

  /* ══ v1.2.8 第一批：M 型 / 评分体系 / 介入尺寸 ══ */
  {
    id: 'mtype',
    sec: 'hemo',
    title: 'M 型三合一：FS · Teichholz EF · EPSS',
    sub: '缩短分数 · 立方公式 EF · 二尖瓣 EPSS',
    fields: [
      { k: 'mtdd', n: 'LVIDd（舒张末内径）', u: 'mm' },
      { k: 'mtds', n: 'LVIDs（收缩末内径）', u: 'mm' },
      { k: 'mtepss', n: 'EPSS（可选）', u: 'mm' },
    ],
    note: 'FS = (LVIDd − LVIDs)/LVIDd；Teichholz：V = 7D³/(2.4+D)（D 取 cm），EF = (EDV−ESV)/EDV。EPSS <7 mm 正常，>12 mm 提示 EF 显著减低。M 型受取样线偏斜与节段性室壁运动异常影响，图像条件允许时以 Simpson 双平面为准',
  },
  {
    id: 'wmsi',
    sec: 'recon',
    title: 'WMSI 室壁运动积分',
    sub: '按分值节段个数录入 · 1.0 正常 · ≥1.7 提示大面积缺血',
    opts: [
      { k: 'wseg', n: '节段总数', list: [['17', '17 节段（推荐）'], ['16', '16 节段']] },
    ],
    fields: [
      { k: 'wn1', n: '正常（1 分）节段数', u: '个' },
      { k: 'wn2', n: '运动减弱（2 分）', u: '个' },
      { k: 'wn3', n: '无运动（3 分）', u: '个' },
      { k: 'wn4', n: '反常运动（4 分）', u: '个' },
      { k: 'wn5', n: '室壁瘤（5 分）', u: '个' },
    ],
    note: 'WMSI = (1·n1 + 2·n2 + 3·n3 + 4·n4 + 5·n5) ÷ 节段总数。按各类节段的个数录入，比逐段填 17 个格子快且不易漏段；与「切面学习」页的节段划分对照定位。1.0 正常，1.0–1.5 轻度，1.5–1.7 中度，≥1.7 提示大面积缺血且预后差',
  },
  {
    id: 'h2fpef',
    sec: 'recon',
    title: 'H2FPEF 评分',
    sub: 'BMI · 房颤 · 年龄 · 降压药 · E/e′ · PASP → 0–9 分',
    opts: [
      { k: 'haf', n: '心房颤动', list: [['0', '无'], ['1', '有']] },
      { k: 'hbp', n: '降压药种数', list: [['0', '0–1 种'], ['1', '≥2 种']] },
    ],
    fields: [
      { k: 'hbmi', n: 'BMI', u: 'kg/m²' },
      { k: 'hage', n: '年龄', u: '岁' },
      { k: 'hee', n: 'E/e′', u: '' },
      { k: 'hpasp', n: 'PASP', u: 'mmHg' },
    ],
    note: '加权评分：BMI >30 计 2 分，心房颤动 3 分，年龄 >60 岁 1 分，≥2 种降压药 1 分，E/e′ >9 计 1 分，PASP >35 mmHg 计 1 分。≥6 分 HFpEF 可能性高，≤1 分可能性低，2–5 分需负荷超声或侵入性血流动力学',
  },
  {
    id: 'hfapeff',
    sec: 'recon',
    title: 'HFA-PEFF 评分',
    sub: '形态学 / 功能学 / 生物标志物 三类取最高后相加',
    opts: [
      { k: 'hsex', n: '性别', list: [['m', '男性'], ['f', '女性']] },
      { k: 'haf2', n: '心律', list: [['0', '窦性心律'], ['1', '心房颤动']] },
    ],
    fields: [
      { k: 'hlavi', n: 'LAVi', u: 'mL/m²' },
      { k: 'hlvmi', n: 'LVMI', u: 'g/m²' },
      { k: 'hrwt', n: 'RWT', u: '' },
      { k: 'hpasp2', n: 'PASP', u: 'mmHg' },
      { k: 'hee2', n: 'E/e′', u: '' },
      { k: 'hes', n: '间隔 e′', u: 'cm/s' },
      { k: 'hel', n: '侧壁 e′', u: 'cm/s' },
      { k: 'htrv', n: 'TR Vmax', u: 'm/s' },
      { k: 'hgls', n: 'GLS（绝对值）', u: '%' },
      { k: 'hbnp', n: 'NT-proBNP', u: 'pg/mL' },
    ],
    note: '三类各取最高分后相加（0–6）。形态学：LAVi ≥34 计 1、≥40 计 2；LVMI 男 >115/149、女 >95/122 计 1/2；RWT >0.42 计 1；PASP >35 计 1。功能学：E/e′ 9–14 计 1、≥15 计 2；e′ 减低计 1；TR Vmax >2.8 计 1；GLS <16% 计 1。标志物按窦律/房颤分档。≥5 分支持 HFpEF，2–4 分需进一步检查',
  },
  {
    id: 'tavrsz',
    sec: 'valve',
    title: 'TAVR 瓣环尺寸与 oversizing',
    sub: '周长/面积导出直径 · 面积 oversizing 判读',
    fields: [
      { k: 'tcirc', n: '瓣环周长', u: 'mm' },
      { k: 'tarea', n: '瓣环面积', u: 'mm²' },
      { k: 'tnom', n: '拟用标称直径', u: 'mm' },
    ],
    note: '周长导出直径 = C/π；面积导出直径 = 2√(A/π)；面积 oversizing = (标称面积/实测面积 − 1)×100%。自膨胀瓣常见目标 10–20%，球囊扩张瓣 −10% ~ +5%。具体型号按厂商说明书与术者经验核定',
  },
  {
    id: 'laasz',
    sec: 'chamber',
    title: '左心耳封堵尺寸推荐',
    sub: '着陆区最大径 → 推荐型号 · 深度与椭圆度提示',
    fields: [
      { k: 'lzmax', n: '着陆区最大径', u: 'mm' },
      { k: 'lzmin', n: '着陆区最小径（可选）', u: 'mm' },
      { k: 'lzdepth', n: '着陆区深度（可选）', u: 'mm' },
    ],
    note: '按着陆区最大径 × 1.08 上取整落到常规型号（17/20/24/27/31/35 mm）。长短径比 >1.3 提示椭圆度大；深度不足时考虑小一号。常用于 Watchman FLX 类器械，其他产品按各自说明书',
  },
  {
    id: 'aortagrow',
    sec: 'chd',
    title: '主动脉扩张增长率',
    sub: '两次测量之差 ÷ 间隔年数',
    fields: [
      { k: 'd1', n: '上次直径', u: 'cm' },
      { k: 'd2', n: '本次直径', u: 'cm' },
      { k: 'yrs', n: '间隔时间', u: '年' },
    ],
    note: '增长率 = (本次 − 上次) × 10 ÷ 间隔年数（mm/年）。<3 低危；3–5 缩短随访间隔；≥5 倾向尽快干预。必须同切面同方法测量',
  },
  {
    id: 'pvfu',
    sec: 'valve',
    title: '人工瓣术后跨瓣血流',
    sub: 'TAVR / 换瓣后 EOA 与压差',
    fields: [
      { k: 'lvotD', n: 'LVOT 直径', u: 'cm' },
      { k: 'lvotVti', n: 'LVOT VTI', u: 'cm' },
      { k: 'valveVti', n: '人工瓣 VTI', u: 'cm' },
      { k: 'fupvmax', n: '跨瓣峰值流速', u: 'm/s' },
      { k: 'fupmean', n: '跨瓣平均压差', u: 'mmHg' },
    ],
    note: 'EOA = (π×LVOT 直径²÷4 × LVOT VTI) ÷ 人工瓣 VTI。术后平均压差 <20 mmHg、EOA ≥1.2 cm²（EOAi ≥0.8）为佳。压差高不等于故障：先排 undersizing、瓣周漏、LVOT 梗阻、压降恢复与高流量',
  },
  {
    id: 'cfr',
    sec: 'chamber',
    title: '冠脉血流储备 CFR',
    sub: '远端 ÷ 近端冠脉舒张期流速',
    fields: [
      { k: 'distal', n: '远端冠脉舒张期流速', u: 'cm/s' },
      { k: 'proximal', n: '近端冠脉舒张期流速', u: 'cm/s' },
    ],
    note: 'CFR = 远端 ÷ 近端。>2.0 正常；1.6–2.0 可疑；<1.6 明显受限（缺血）。要求同一支冠脉、同一角度、同一心率与同一负荷状态下测量',
  },
];

/**
 * 计算类条目的目录分组（按顺序渲染）
 *
 * GROUPS 里每条用 sec 指定归属，缺省 'hemo'。
 * v1.4.8 起压到 4 组：舒张并入 hemo、评分并入 recon、随访并入 ivs。
 */
const CALC_SECTIONS = [
  { id: 'hemo', title: '血流动力学、舒张与心功能' },
  { id: 'right', title: '右心与肺循环' },
  { id: 'recon', title: '重构、室壁运动与心肌功能' },
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
