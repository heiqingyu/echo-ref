/**
 * 公式集 · 评估类内容数据（器械支持 / 心腔与应变）
 *
 * 本文件是**纯数据**，被小程序与网页/APK 共用：
 *   - 小程序：pages/calculators（目录）、pages/formula（详情）
 *   - 网页/APK：build-www.js 通过 wrapEngine 抽取后挂到 window.ExtraData
 *
 * blocks 的 kind：
 *   h       小节标题
 *   table   表格（heads / rows，cols 取自 heads 长度）
 *   text    正文
 *   note    提示；warn: true 时渲染为醒目提示
 *   formula 公式行
 *
 * 每条内容的 source 指向 REFS 编号，展示在详情页底部，
 * 全部参考文献在公式集目录页底部统一列出。
 *
 * ★ 新增条目：往 BRIEF_SECTIONS 对应分组里加一条即可，
 *   目录会自动出现并可跳转；引用新文献往 REFS 加一条。
 */

/** 分组 → 条目（目录顺序即本文件顺序） */
const BRIEF_SECTIONS = [
  {
    id: 'device',
    title: '器械支持',
    items: [
      {
        id: 'crt',
        title: 'CRT 同步化',
        sub: 'CRT 起搏 · QRS 指征 · 超声随访',
        source: ['R6', 'R2'],
        blocks: [
          { kind: 'h', text: '适应证（核心看 LVEF、NYHA 心功能、QRS 形态与时限）' },
          {
            kind: 'table',
            heads: ['LVEF', 'QRS 形态', 'QRS 时限', '推荐等级'],
            rows: [
              ['≤35%', 'LBBB', '≥150 ms', '推荐（I 类）'],
              ['≤35%', 'LBBB', '130–149 ms', '应当考虑（IIa）'],
              ['≤35%', '非 LBBB', '≥150 ms', '应当考虑（IIa）'],
              ['≤35%', '非 LBBB', '130–149 ms', '可以考虑（IIb）'],
              ['≥50%（HFpEF）', 'LBBB', '≥130 ms', '可以考虑（IIb）'],
            ],
          },
          { kind: 'note', text: '房颤患者需保证接近 100% 的心室起搏率（常需房室结消融）才能获得与窦性心律相近的获益。', warn: true },
          { kind: 'h', text: '超声在 CRT 里的三个角色' },
          { kind: 'text', text: '① 术前排除假性失同步：房间隔缺损修补、先心病手术等造成室间隔变长者，室间隔提前收缩并非真失同步。' },
          { kind: 'text', text: '② 术后疗效随访：左室容积缩小、LVEF 上升、二尖瓣反流减少、术前隐匿性反流与室壁瘤样改变。' },
          { kind: 'text', text: '③ 心肌应变：CRT 后 GLS 绝对值改善 ≥15%（相对改善 ≥20%）是常用的有效反应指标。' },
          { kind: 'h', text: '机械不同步指标：仅作辅助描述' },
          {
            kind: 'table',
            heads: ['指标', '含义', '常见提示阈值'],
            rows: [
              ['室间隔延迟收缩（septal delay）', '主动脉瓣开放后室间隔到前壁运动的时间差', '≥75 ms 提示左室延迟'],
              ['左室射血前间期 LVPEP', '主动脉瓣开放后室间隔运动起始时间', '明显长于对照提示延迟'],
              ['左右室间期差 IVRT-R', '左右室心肌收缩起始时间差', '双室同时起搏无意义，仅作参照'],
              ['脉冲波 TDI 峰值差', '侧壁与间隔 S′ 波到达时间差', '变异大，可重复性有限'],
            ],
          },
          { kind: 'note', text: 'PROSPECT 研究已系统比较十余项超声不同步指标：没有任何单一指标能优于体表 ECG 来预测 CRT 反应。指标不应用于单独决定是否植入 CRT。', warn: true },
        ],
        fields: [
          { k: 'ld', n: 'LVOT 直径', u: 'cm' },
          { k: 'lvti', n: 'LVOT VTI', u: 'cm' },
          { k: 'hr', n: '心率', u: '次/min' },
          { k: 'qrs', n: 'QRS 时限（可选）', u: 'ms' },
        ],
        calc: 'crt',
        note: 'SV / SVi 用于识别低流量（隐性心衰），是 CRT 疗效随访与候选患者评估的必查项。',
      },
      {
        id: 'la',
        title: 'LAD 参数（左心房）',
        sub: '前后径 · 长径 · 横径 · 容积指数',
        source: ['R1', 'R2'],
        blocks: [
          { kind: 'h', text: '各切面与时相（中国 2016 指南）' },
          {
            kind: 'table',
            heads: ['参数', '切面 · 时相', '男性参考（mm）', '女性参考（mm）'],
            rows: [
              ['LA 前后径（LAD）', 'PLAX · 收缩末期', '23.3 – 38.9', '22.7 – 37.2'],
              ['LA 长径', 'A4C · 收缩末期', '35.0 – 58.6', '33.7 – 56.9'],
              ['LA 横径', 'A4C · 收缩末期', '26.7 – 44.7', '26.2 – 43.0'],
            ],
          },
          { kind: 'text', text: '以上为中国成人多年龄段合并的 95% 参考范围，与「EF·参考值」页的中国标准同源。' },
          { kind: 'h', text: '容积法（更推荐）' },
          {
            kind: 'table',
            heads: ['要点', '要求'],
            rows: [
              ['采集切面', '心尖四腔 + 两腔心，容积法（圆盘法 / Simpson）'],
              ['测量时相', '左室收缩末期二尖瓣环水平'],
              ['心动周期数', '窦性 ≥2 个周期取平均；房颤 ≥3 个周期取平均'],
              ['判读阈值', '左房最大容积指数 LAVi > 34 mL/m²（男女相同）视为增大'],
              ['临床关联', 'LAVi 增大与房颤、卒中、心衰、房速风险升高相关'],
            ],
          },
          { kind: 'note', text: '径线法与容积法不能互相换算；容积法对形态改变（巨大左房、房颤）更可靠，径线法仅作常规筛查。', warn: true },
        ],
        fields: [
          { k: 'lav', n: '左房最大容积', u: 'mL' },
        ],
        calc: 'la',
        note: 'LAVi = 左房最大容积 ÷ BSA。正常 ≤34 mL/m²（男女通用）。',
      },
    ],
  },
  {
    id: 'chamber',
    title: '心腔与应变',
    items: [
      {
        id: 'lv',
        title: '左心评估',
        sub: 'EF 分级 · 室壁厚度 · 质量指数 · 肥厚鉴别',
        source: ['R2', 'R1', 'R7'],
        blocks: [
          { kind: 'h', text: '左室收缩功能分级（2D 改良 Simpson）' },
          {
            kind: 'table',
            heads: ['LVEF', '分级', '提示'],
            rows: [
              ['≥55%', '正常', '中国成人参考下限男 52.4% / 女 51.5%'],
              ['50–54%', '轻度降低', '（原发或继发）'],
              ['40–49%', '中度降低', '射血分数降低性心衰区间'],
              ['≤39%', '重度降低', 'HFrEF 区间，评估 CRT / ICD / GDMT 指征'],
            ],
          },
          { kind: 'h', text: '室壁厚度与质量指数分级' },
          {
            kind: 'table',
            heads: ['指标', '正常', '轻度', '中度', '重度', '极重度'],
            rows: [
              ['LVMI 男（g/m²）', '≤95', '96–115', '116–131', '132–149', '≥150'],
              ['LVMI 女（g/m²）', '≤89', '90–107', '108–121', '122–137', '≥138'],
              ['室间隔（mm）', '≤11', '11–12', '12–13', '13–14', '≥15'],
            ],
          },
          { kind: 'text', text: '相对室壁厚度 RWT =（室间隔厚度 + 后壁厚度）÷ 2 ÷ 左室舒张末内径。RWT > 0.42 提示向心性肥厚，≤0.42 提示离心性重构。' },
          { kind: 'h', text: '左室充盈压与舒张功能要点' },
          { kind: 'text', text: 'E/A <0.8 且 E′<10 cm/s：充盈压低；E/A ≥2 且 E′<10 cm/s：充盈压升高；E/A 在 0.8–2 之间为灰区，需结合左房容积、纵向应变、肺静脉血流综合判断。' },
          { kind: 'text', text: '估算充盈压（左心房平均压）：E/e′ 平均 >14 mmHg 时提示充盈压升高（此阈值以平均 E/e′ 判读，勿用侧壁单独数值）。' },
          { kind: 'note', text: '上述分级来自欧美指南的体型校正式阈值，中国成人原始参考区间见「EF·参考值」页；体型差异大时建议同时看按身高（H^2.7）与体表面积（BSA）校准的指标。', warn: true },
        ],
        fields: [
          { k: 'lvmi', n: '左室质量指数', u: 'g/m²' },
          { k: 'rwt', n: '相对室壁厚度（可选）', u: '' },
        ],
        calc: 'lv',
        note: 'LVMI 需按性别对照分级；RWT 可判断肥厚类型（向心 vs 离心）。',
      },
      {
        id: 'rv',
        title: '右心评估',
        sub: 'TAPSE · RV S′ · FAC · 右房压 · PASP',
        source: ['R5', 'R7'],
        blocks: [
          { kind: 'h', text: '右室功能：超声三大核心指标' },
          {
            kind: 'table',
            heads: ['指标', '正常', '降低', '说明'],
            rows: [
              ['TAPSE（mm）', '>17', '<17', '高度依赖纵向运动，受前负荷与胸膜压力影响'],
              ['FAC（%）', '>35', '<35', '面积变化率，受整体形状改变影响较小'],
              ['RV S′（cm/s）', '>9.5', '<9.5', '右室侧壁瓣环 TDI 峰值速度'],
              ['右房面积（cm²）', '≤18', '>18', '四腔心收缩末面积'],
              ['右房面积/BSA（cm²/m²）', '≤9', '>9', '体型校正后判断右房扩大'],
            ],
          },
          { kind: 'h', text: '右房压（RAP）估算' },
          {
            kind: 'table',
            heads: ['IVC 直径', '吸气塌陷 ≥50%', '估计 RAP'],
            rows: [
              ['>21 mm', '否', '15 mmHg'],
              ['>21 mm', '是', '10 mmHg'],
              ['<21 mm', '否', '5 mmHg'],
              ['<21 mm', '是', '0 mmHg'],
            ],
          },
          { kind: 'note', text: 'RAP 估算仅适用自主呼吸且无显著三尖瓣狭窄；机械通气与容量状态会显著影响结果。', warn: true },
          { kind: 'h', text: '肺动脉压力（PASP）' },
          { kind: 'formula', text: 'TR 峰速 Vmax（m/s）→ 压差 ΔP = 4V² → PASP ≈ ΔP + RAP' },
          {
            kind: 'table',
            heads: ['TR Vmax（m/s）', 'ΔP（mmHg）', '含 RAP 5 mmHg 时 PASP'],
            rows: [
              ['≤2.8', '≤31', '≤36 mmHg（无肺高压）'],
              ['2.9–3.4', '34–46', '39–51 mmHg（轻度）'],
              ['≥3.4', '≥46', '≥51 mmHg（中重度）'],
            ],
          },
          { kind: 'text', text: '同样 2.8–3.4 m/s 的 TR 峰速，在活动、年轻、低流量人群中多属生理性；需结合是否存在右心扩大、功能下降等结构性改变再判定。' },
          { kind: 'h', text: '严重三尖瓣反流的超声预警组合' },
          { kind: 'text', text: 'TAPSE <14 mm、RV S′ <10 cm/s、PASP >50 mmHg、IVC >21 mm —— 四项中≥2 项提示预后不良，宜考虑瓣膜介入评估。' },
          { kind: 'text', text: '症状性重度 TR 需手术或介入治疗时，推荐术中同期三维超声或经食管超声确认反流机制与导管可操作性（ASE 2019 经导管瓣膜评估）。' },
        ],
        fields: [
          { k: 'tr', n: 'TR 峰速', u: 'm/s' },
          { k: 'ivc', n: 'IVC 内径', u: 'mm' },
        ],
        calc: 'rv',
        note: '与「右心压力与 PH 概率」同源算法：PASP = 4V² + RAP（RAP 由 IVC 内径与塌陷程度决定）。',
      },
      {
        id: 'strain',
        title: '心肌应变',
        sub: 'GLS · 分层应变 · 左房/右室应变',
        source: ['R3', 'R4'],
        blocks: [
          { kind: 'h', text: '采集规范（先规范，再看数值）' },
          {
            kind: 'table',
            heads: ['环节', '要求'],
            rows: [
              ['心率', '尽量稳定，窦性；房颤可测但重复性下降'],
              ['帧率', '≥60 帧/s（推荐 80–100），低帧率会低估应变'],
              ['心动周期', '采集 3 个连续完整周期'],
              ['切面', '心尖 3 腔 / 4 腔 / 2 腔，测全 6 段（必要时加右心）'],
              ['长度定义', '收缩期缩短量 ÷ 舒张末期长度（GLS 取负值表示缩短）'],
              ['追踪质量', '切勿自动追踪后直接取数，务必目视核对每段曲线'],
            ],
          },
          { kind: 'h', text: '常用应变指标与判读' },
          {
            kind: 'table',
            heads: ['指标', '正常参考', '意义'],
            rows: [
              ['左室整体纵向应变 GLS', '> −20%（|GLS| >18%）', '反映左室纵向收缩；敏感反映早期心肌受损'],
              ['分层应变（层间差）', '内层—外层差值越小越好', '差值增大提示心肌纤维化、浸润'],
              ['右室游离壁应变', '> −20%', '右室纵向收缩，受 RVOT 取样影响大'],
              ['左房储备应变 LASr', '≥39%', '左房充盈储备能力'],
              ['左房管道应变 LASa', '<20%', '左房被动排空'],
              ['左房收缩应变 LASc', '<15%', '左房主动泵功能'],
            ],
          },
          { kind: 'note', text: '应变数值高度依赖图像质量与软件平台，跨平台绝对值不宜直接比较；同一患者纵向随访应尽量使用同一平台。', warn: true },
          { kind: 'h', text: '临床落点' },
          { kind: 'text', text: '· 射血分数正常时，GLS 可提前发现心肌收缩受损（化疗、瓣膜病、心肌病早期）。' },
          { kind: 'text', text: '· CRT / 抗肿瘤治疗后 |GLS| 相对改善 ≥15%（绝对改善 ≥5%）提示治疗有效。' },
          { kind: 'text', text: '· 左房应变降低常先于左房容积增大出现，是房颤风险评估的补充指标。' },
        ],
        fields: [
          { k: 'gls', n: '左室整体纵向应变 GLS', u: '%（负值）' },
          { k: 'rvstrain', n: '右室游离壁应变（可选）', u: '%（负值）' },
        ],
        calc: 'strain',
        note: 'GLS 越接近 0（绝对值越小）提示纵向收缩越差；−18% 可作为多数成人的实用下限。',
      },
    ],
  },
];

/**
 * 切面学习与模拟器：**纯链接条目**（kind: 'link'）
 *
 * 不嵌图片、不嵌 iframe，点击由系统浏览器打开原站（省内存、零流量开销）。
 * 主要来源：多伦多大学 PIE（Perioperative Interactive Education）TEE/TTE 教学站，
 * 其余为公开的在线 TEE 模拟器。
 */
const LINK_SECTIONS = [
  {
    id: 'views',
    title: '切面学习（视频）',
    items: [
      {
        id: 'tee-sv',
        title: 'TEE 标准 20 视图（中文）',
        sub: 'ASE/SCA 标准切面 · 带过场视频',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/assets/applications/standardViewsHTML5/TEE-HTML5-SV-CH/',
      },
      {
        id: 'tee-av',
        title: 'TEE 备选 19 视图',
        sub: '非常用但实用的 2D 切面',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/assets/applications/alternateViewsHTML5/TEE-HTML5-AV/',
      },
      {
        id: 'tee-cd',
        title: 'TEE 彩色多普勒对比',
        sub: '哪些结构该用彩色看 · 对比演示',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/assets/applications/colourCompareHTML5/TEE-HTML5-CD/',
      },
      {
        id: 'tte-sv',
        title: 'TTE 经胸标准切面',
        sub: '胸骨旁 / 心尖 / 剑下标准窗',
        url: 'https://pie.med.utoronto.ca/TTE/TTE_content/standardViews.html',
      },
      {
        id: 'tee-spectral',
        title: 'TEE 频谱多普勒逐项讲解',
        sub: '主动脉瓣 / 二尖瓣 / 三尖瓣 / 肺静脉…',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/TEE_spectral.html',
      },
      {
        id: 'tee-valve',
        title: 'TEE 心脏瓣膜评估',
        sub: '术中瓣膜评估方法（TEER 基础）',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/TEE_assessment_cardiacValves.html',
      },
      {
        id: 'm-teer',
        title: 'M-TEER 二尖瓣边缘修复切面',
        sub: '二尖瓣夹持定位的超声基础',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/TEE_spectral_mitralValve.html',
      },
      {
        id: 't-teer',
        title: 'T-TEER 三尖瓣边缘修复切面',
        sub: '三尖瓣反流评估与夹持定位',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/TEE_spectral_tricuspidValve.html',
      },
      {
        id: 'tee-3d',
        title: 'TEE 三维与 MPR 测量',
        sub: '左室容积 / 二尖瓣 / 主动脉瓣 MPR',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/TEE_3DTEE.html',
      },
      {
        id: 'tee-path',
        title: 'TEE 病理实例',
        sub: '钙化性主动脉瓣狭窄 / 心房黏液瘤 / SOVA',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/TEE_synopses.html',
      },
      {
        id: 'tee-guide',
        title: 'TEE 标准视图速查表',
        sub: '探头角度 · 平面 · 对应结构（可打印）',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/TEE_guideSheet.html',
      },
      {
        id: 'tee-quiz',
        title: 'TEE 在线测验',
        sub: '切面识别与结构辨认自测',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/TEE_standardViews_quizzes.html',
      },
    ],
  },
  {
    id: 'sim',
    title: 'TEE 模拟器',
    items: [
      {
        id: 'sim-ct2tee',
        title: 'CT2TEE 在线模拟器',
        sub: 'CT 重建驱动 · 旋转 / 俯仰 / 成角操控',
        url: 'https://www.ct2tee.agh.edu.pl/',
      },
      {
        id: 'sim-virtual',
        title: 'Virtual TEE（3D 心模型）',
        sub: '视频与超声平面同步 · 隐藏组织看内部',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/TEE_virtualTEE.html',
      },
      {
        id: 'sim-probe',
        title: 'TEE 探针操控模拟',
        sub: '练旋转 / 前倾 / 推进 / 退出的手感',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/TEE_probeManipulation_intro.html',
      },
      {
        id: 'sim-atlas',
        title: 'TEE Simulator 图谱',
        sub: '交互式切面图谱（英文）',
        url: 'https://tee-simulator.anesthbeta.com/atlas?lang=en',
      },
      {
        id: 'sim-av',
        title: '备选视图应用（模拟版）',
        sub: '非常用切面交互演示',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/assets/applications/alternateViewsHTML5/TEE-HTML5-AV/',
      },
      {
        id: 'sim-cd',
        title: '彩色对比应用（模拟版）',
        sub: '彩色多普勒使用时机演示',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/assets/applications/colourCompareHTML5/TEE-HTML5-CD/',
      },
    ],
  },
];

/** 全部引用文献（公式集目录页底部统一列出） */
const REFS = [
  {
    id: 'R1',
    zh: '中国成年人超声心动图检查测量指南',
    en: 'Echocardiography Group, Chinese Society of Ultrasonography in Medicine. 中国成人超声心动图检查测量指南',
    where: '中华超声影像学杂志, 2016, 25(8): 645–666',
    use: '成人径线 / 面积 / 容积参考范围、瓣膜环与大动脉内径',
  },
  {
    id: 'R2',
    zh: '成人心腔超声心动图定量指南（2015）',
    en: 'Lang RM, Bierig SM, Devereux RB, et al. Recommendations for Cardiac Chamber Quantification by Echocardiography',
    where: 'J Am Soc Echocardiogr, 2015, 16(6): 309–343',
    use: 'EF、LVEDVi、LVMI、LAVi 的测量规范与分级',
  },
  {
    id: 'R3',
    zh: '超声心肌应变成像的标准化建议（2019）',
    en: 'Standardization of echocardiographic strain imaging（EACVI/ASE）',
    where: 'Eur Heart J Cardiovasc Imaging, 2019',
    use: '应变采集、追踪与报告规范',
  },
  {
    id: 'R4',
    zh: '左心房应变多腔室评估指南（2019）',
    en: 'Cameli S, et al. Multi-chamber assessment of left atrial function using strain imaging',
    where: 'Eur Heart J Cardiovasc Imaging, 2019, 20(4): 459–470',
    use: 'LASr / LASa / LASc 的阈值与临床意义',
  },
  {
    id: 'R5',
    zh: '成人右心超声心动图评估指南（ASE 2025）',
    en: 'ASE Guidelines for the Evaluation of the Right Heart',
    where: 'J Am Soc Echocardiogr, 2025',
    use: 'TAPSE、FAC、RV S′、右房面积等右心定量',
  },
  {
    id: 'R6',
    zh: '心脏再同步化治疗（CRT）共识与指南',
    en: 'HRS/ASA CRT consensus statement; 2023 HRS/LAHRS 等 CRT 适应证专家共识; PROSPECT 研究',
    where: 'Heart Rhythm / Circulation',
    use: 'CRT 适应证分级、超声不同步指标现状与疗效随访',
  },
  {
    id: 'R7',
    zh: '肺动脉高压诊断与治疗指南（2022）',
    en: 'ESC/ERS Guidelines for the diagnosis and treatment of pulmonary hypertension',
    where: 'Eur Respir J, 2022',
    use: 'PASP、右房压与 PH 超声概率',
  },
  {
    id: 'R8',
    zh: '成人超声心动图检查操作指南（2016 修订）',
    en: 'Eagle FA, et al. 2016 ASE/SCA Guidelines for the Performance of Adult Echocardiography',
    where: 'J Am Soc Echocardiogr, 2016, 27(10): 1–27',
    use: '切面选择、时相、测量与报告规范',
  },
  {
    id: 'R9',
    zh: '瓣膜性心脏病超声评估系列（AS / AR / MS / MR / TR）',
    en: 'ASE valve assessment guideline series（含经导管瓣膜术后反流评估）',
    where: 'J Am Soc Echocardiogr, 2017 / 2019',
    use: '瓣膜专项计算与分级（完整版瓣膜页）',
  },
  {
    id: 'R10',
    zh: '儿童心脏 Z 值（PHN 数据库）',
    en: 'Pediatric Heart Network normative data（Z 值标准化）',
    where: 'Pediatric Echocardiography',
    use: '儿童心脏尺寸按体表面积标准化（见儿童 Z 值页）',
  },
];

module.exports = {
  BRIEF_SECTIONS: BRIEF_SECTIONS,
  LINK_SECTIONS: LINK_SECTIONS,
  REFS: REFS,
};