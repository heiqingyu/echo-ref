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
        sub: 'RAP · PASP · PVR · PADP · PH 概率 · 右室功能',
        source: ['R5', 'R7', 'R13', 'R14'],
        blocks: [
          { kind: 'h', text: '一、右房压 RAP 估算' },
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

          { kind: 'h', text: '二、肺动脉收缩压 PASP' },
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

          { kind: 'h', text: '三、肺动脉阻力 PVR 与舒张压 PADP（超声估测）' },
          { kind: 'text', text: 'PVR 经验估测：PVR ≈ (TR 峰速 / RVOT VTI) × 10 + 0.16（WU）；或 PVR ≈ TR 峰速² / RVOT VTI。PVR >3 WU 提示肺血管阻力升高，>5 WU 提示中重度升高。' },
          { kind: 'text', text: 'PADP = PR 舒张末压差 + RAP。PR 舒张末速度 ≤2.2 m/s 时 PADP 多正常（<15 mmHg）；2.3–2.7 m/s 提示升高可能；≥2.8 m/s 多 ≥25 mmHg（需 PR 无显著反流、无肺动脉瓣狭窄）。' },
          { kind: 'note', text: '以上为经验公式，不能替代右心导管；心衰、左心疾病、容量状态会显著影响估测值。', warn: true },

          { kind: 'h', text: '四、肺动脉高压 PH 的超声概率（双征象法）' },
          {
            kind: 'table',
            heads: ['PH 支持征象', '判读'],
            rows: [
              ['TR 峰速 >2.8–3.4 m/s', '压力增高最直接证据'],
              ['右室 / 左室基底径比 >1.0', '右室扩大、室间隔左移'],
              ['左室偏心指数 >1.0', '右心压力负荷致左室受压'],
              ['McConnell 征（右室游离壁运动减低、心尖保留）', '急性肺栓塞 / 右心应激特征'],
              ['60/60 征（肺动脉加速时间 <60 ms 且 TR 峰速 <3.6 m/s）', '中重度 PH 早期表现'],
              ['下腔静脉固定扩张（>21 mm 且不塌陷）', '右房压持续升高'],
              ['肺动脉瓣舒张期提前关闭切迹', '肺动脉舒张压升高'],
            ],
          },
          { kind: 'text', text: '同时满足「TR 峰速升高」与「≥2 类支持征象」→ 高概率 PH；仅一项或无可疑，需结合临床与右心导管。' },

          { kind: 'h', text: '五、右室功能：三大核心指标' },
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

          { kind: 'h', text: '六、右室功能进阶指标（三维 / 应变）' },
          {
            kind: 'table',
            heads: ['指标', '参考', '说明'],
            rows: [
              ['3D RVEF（%）', '45–60', '<35 提示右室收缩功能减低'],
              ['右室游离壁应变 RVFWS（%）', '≤ −20', '绝对值减小提示右室纵向应变受损'],
              ['RV FAC（EDA−ESA）/EDA', '见上', '需完整标准心尖四腔切面'],
              ['三尖瓣环收缩期位移 TAPSE', '见上', '床旁首选指标'],
            ],
          },
          { kind: 'text', text: '右室几何复杂，单一指标易误判：TAPSE 受前负荷与负荷影响大，FAC 依赖标准心尖四腔切面，3D RVEF 与 RV 应变对形状改变不敏感但需专用软件与良好心内膜追踪。' },

          { kind: 'h', text: '七、严重三尖瓣反流的超声预警组合' },
          { kind: 'text', text: 'TAPSE <14 mm、RV S′ <10 cm/s、PASP >50 mmHg、IVC >21 mm —— 四项中≥2 项提示预后不良，宜考虑瓣膜介入评估。' },
          { kind: 'text', text: '症状性重度 TR 需手术或介入治疗时，推荐术中同期三维超声或经食管超声确认反流机制与导管可操作性（ASE 2019 经导管瓣膜评估）。' },
        ],
        fields: [
          { k: 'tr', n: 'TR 峰速', u: 'm/s' },
          { k: 'ivc', n: 'IVC 内径', u: 'mm' },
          { k: 'prend', n: 'PR 舒张末速度（可选）', u: 'm/s' },
          { k: 'rvti2', n: 'RVOT VTI（PVR 用，可选）', u: 'cm' },
          { k: 'eda', n: 'RV 舒张末面积（可选）', u: 'cm²' },
          { k: 'esa', n: 'RV 收缩末面积（可选）', u: 'cm²' },
          { k: 'rvs', n: '右室 S′（可选）', u: 'cm/s' },
        ],
        calc: 'rv',
        note: '已合并右心压力、PH 概率与右室功能：PASP = 4V² + RAP（RAP 由 IVC 内径与塌陷程度决定），PVR/PADP 由 PR 速度估测。',
      },
      {
        id: 'rcoupling',
        title: '右室-肺动脉耦联',
        sub: 'TAPSE / PASP 比值 · 右室储备与预后',
        source: ['R18', 'R14'],
        blocks: [
          { kind: 'h', text: '一、这个比值解决什么问题' },
          { kind: 'text', text: 'TAPSE 单独看只回答「右室收缩好不好」，PASP 单独看只回答「肺动脉压高不高」。但临床上真正决定症状与预后的是**右室能不能扛住当前的负荷**——两者放进同一个比值才看得出来。' },
          { kind: 'formula', text: '右室-肺动脉耦联 = TAPSE（mm）÷ PASP（mmHg），单位 mm/mmHg' },
          { kind: 'text', text: '负荷升高时 TAPSE 若能代偿性维持，比值不降（耦联保留）；一旦 TAPSE 开始随负荷上升而下降，比值迅速塌陷，这就是「失耦联」，代表右室收缩储备耗竭。' },

          { kind: 'h', text: '二、判读切点' },
          {
            kind: 'table',
            heads: ['比值（mm/mmHg）', '判读', '临床含义'],
            rows: [
              ['≥0.55', '耦联保留', '右室功能与后负荷匹配'],
              ['0.36–0.55', '临界 / 早期失耦联', '运动耐量下降、需密切随访'],
              ['<0.36', '显著失耦联', '右心衰风险与死亡风险明显升高'],
            ],
          },
          { kind: 'note', text: '0.55 与 0.36 两个切点来自心衰与肺动脉高压队列，跨病种使用时只能作为提示，不能替代右心导管与临床分级。', warn: true },

          { kind: 'h', text: '三、比单看 TAPSE 强在哪' },
          { kind: 'text', text: '同样 TAPSE 17 mm：PASP 30 mmHg 时比值 0.57（耦联良好）；PASP 70 mmHg 时比值 0.24（已显著失耦联）。单看 TAPSE 会把后者误判为「正常」，这是床旁最容易犯的错。' },
          {
            kind: 'table',
            heads: ['TAPSE', 'PASP 30', 'PASP 50', 'PASP 70'],
            rows: [
              ['15 mm', '0.50 临界', '0.30 失耦联', '0.21 失耦联'],
              ['17 mm', '0.57 保留', '0.34 失耦联', '0.24 失耦联'],
              ['20 mm', '0.67 保留', '0.40 临界', '0.29 失耦联'],
            ],
          },

          { kind: 'h', text: '四、典型场景怎么用' },
          { kind: 'text', text: '① **HFrEF 合并继发性 MR/TR**：比值 <0.36 提示右室已到极限，此时单纯加药可能加重低血压，应优先考虑右心支持或器械评估。' },
          { kind: 'text', text: '② **肺动脉高压随访**：比值较基线下降 >20% 往往早于 6MWD 与 NT-proBNP 恶化，可作为升级治疗的触发点。' },
          { kind: 'text', text: '③ **重度 TR 术前评估**：TAPSE 尚可但比值已 <0.36，提示术后右心衰风险高，需权衡介入时机。' },
          { kind: 'note', text: '测量要求：TAPSE 取心尖四腔 M 型，取样线尽量平行右室游离壁；PASP 需有可测 TR 频谱。房颤、大量 TR、机械通气会显著影响两者，比值同样不可靠。', warn: true },
        ],
        fields: [
          { k: 'tapse', n: 'TAPSE', u: 'mm' },
          { k: 'paspv', n: 'PASP', u: 'mmHg' },
        ],
        note: 'PASP 可由「右心评估」由 TR 峰速 + RAP 算出（PASP = 4V² + RAP）后填入此。',
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
      {
        id: 'dias-grade',
        title: '左室充盈压综合判读',
        sub: 'E/A · 平均 E/e′ · LAVi · TR Vmax → 四级判定',
        source: ['R16'],
        blocks: [
          { kind: 'h', text: '为什么不能只看 E/e′' },
          { kind: 'text', text: 'E/e′ 单点值受节段性室壁运动异常、二尖瓣环钙化、心包疾病、机械通气影响；E/A 又会随年龄「假性正常化」。2016 ASE/EACVI 因此改为**多指标综合**：先看 E/A 决定路径，再用三个「升高指标」计数定级。' },

          { kind: 'h', text: '三个升高指标（各自独立计数 1 分）' },
          {
            kind: 'table',
            heads: ['指标', '正常阈值', '升高阈值', '备注'],
            rows: [
              ['平均 E/e′（间隔+侧壁 ÷2）', '≤14', '>14', '间隔 e′<7 cm/s 或侧壁 e′<10 cm/s 即提示松弛受损'],
              ['左房容积指数 LAVi', '≤34 mL/m²', '>34 mL/m²', '比左房内径可靠，房颤者不可用'],
              ['三尖瓣反流峰速 TR Vmax', '≤2.8 m/s', '>2.8 m/s', '反映收缩期肺动脉压，间接反映左房压'],
            ],
          },

          { kind: 'h', text: '判读路径（简化三步）' },
          { kind: 'text', text: '① E/A ≥2 → 直接判 Ⅲ 级（限制性充盈）。' },
          { kind: 'text', text: '② E/A ≤0.8 → 基础为 Ⅰ 级；若平均 E/e′ >8 或升高指标 ≥2 项，升级为 Ⅱ 级。' },
          { kind: 'text', text: '③ E/A 0.8–2（灰区）→ 按升高指标计数：0 项正常、1 项 Ⅰ 级、2 项 Ⅱ 级、3 项 Ⅲ 级。' },

          {
            kind: 'table',
            heads: ['等级', '充盈模式', '左房压', '临床提示'],
            rows: [
              ['正常', 'E/A 0.8–2，指标 0 项', '正常', '—'],
              ['Ⅰ级', '松弛受损，E/A<0.8', '正常或轻度升高', '高血压、衰老、肥厚型心肌病早期'],
              ['Ⅱ级', '假性正常化，E/A 0.8–2', '升高', 'HFpEF 常见；Valsalva 后 E/A 下降可证实'],
              ['Ⅲ级', '限制性，E/A≥2', '明显升高', '预后差，需限钠/利尿并查找病因'],
            ],
          },

          { kind: 'h', text: '三个最常见的踩坑点' },
          { kind: 'text', text: '① **房颤患者**：E/A 无法测量，改用 E/e′ + LAVi + TR Vmax 三项计数，≥2 项升高提示左房压高。' },
          { kind: 'text', text: '② **缩窄性心包炎**：会出现「限制性充盈」，但 E/e′ 通常不高（室间隔反常在吸气时右移），需结合呼吸变异与室间隔抖动鉴别。' },
          { kind: 'text', text: '③ **重度二尖瓣反流 / 狭窄**：跨瓣血流本身异常，充盈压判读可靠性下降，应以右心、PASP 与临床为主。' },
          { kind: 'note', text: '本计算器为简化版（未纳入 E 波减速时间、肺静脉 A 波时限、L 波），仅用于快速分级；灰区与临床不符时以完整评估为准。', warn: true },
        ],
        fields: [
          { k: 'dge', n: 'E 峰', u: 'cm/s' },
          { k: 'dga', n: 'A 峰', u: 'cm/s' },
          { k: 'dges', n: '间隔 e′', u: 'cm/s' },
          { k: 'dgel', n: '侧壁 e′', u: 'cm/s' },
          { k: 'dglavi', n: 'LAVi（可选）', u: 'mL/m²' },
          { k: 'dgtrv', n: 'TR Vmax（可选）', u: 'm/s' },
        ],
        note: 'E/A 决定路径，三个升高指标决定分级；填得越全，判定越可靠。',
      },
      {
        id: 'peri',
        title: '心包积液与心脏压塞',
        sub: '半定量 · 压塞征象 · 缩窄鉴别',
        source: ['R15'],
        fields: [],
        blocks: [
          { kind: 'h', text: '积液量半定量（胸骨旁长轴）' },
          {
            kind: 'table',
            heads: ['程度', '表现'],
            rows: [
              ['微量', '<50 mL，仅心尖 / 后壁小无回声'],
              ['少量', '50–100 mL，环形 <10 mm'],
              ['中量', '100–500 mL，10–20 mm'],
              ['大量', '>500 mL，>20 mm，可伴心脏摆动'],
            ],
          },
          { kind: 'h', text: '心脏压塞征象' },
          { kind: 'text', text: '① 右房塌陷（舒张晚期 / 收缩期）；② 右室游离壁塌陷（舒张早期）；③ 吸气时三尖瓣 E 峰增高 >40%、二尖瓣 E 峰下降 >25%（呼吸变异）；④ 下腔静脉固定扩张（>21 mm 且不塌陷）。' },
          { kind: 'note', text: '心包填塞是临床—超声综合诊断：少量积液亦可在快速增加时致填塞；结合颈静脉怒张、低血压、奇脉。', warn: true },
          { kind: 'text', text: '心包增厚（>3–4 mm）伴钙化提示缩窄性心包炎可能，需与限制性心肌病鉴别（呼吸变异、室间隔摆动、充盈模式随呼吸变化）。' },
        ],
        note: '心包穿刺引流前需评估积液量、定位（剑下 / 心尖）、有无包裹及凝血状态。',
      },
      {
        id: 'prosthetic',
        title: '人工瓣膜评估',
        sub: '正常压差 · PPM · 瓣周漏',
        source: ['R17'],
        fields: [],
        blocks: [
          { kind: 'h', text: '正常跨瓣流速 / 压差（因型号与尺寸而异，需对照基线）' },
          {
            kind: 'table',
            heads: ['瓣膜', '正常峰值流速', '正常平均压差'],
            rows: [
              ['二尖瓣机械 / 生物瓣', '1.5–2.5 m/s', '<5 mmHg'],
              ['主动脉瓣机械 / 生物瓣', '1.5–3.0 m/s', '<20 mmHg'],
            ],
          },
          { kind: 'text', text: '数值随瓣环尺寸增大而降低；小号瓣（19–21 mm）正常压差更高，判读需对照该型号基线。' },
          { kind: 'h', text: '患者—瓣膜不匹配（PPM）' },
          { kind: 'text', text: '主动脉瓣 PPM：有效开口面积指数 EOAI <0.85 cm²/m² 为轻度、<0.65 为重度；重度 PPM 与小瓣环女性预后不良相关。' },
          { kind: 'note', text: '人工瓣膜少量中心性反流多为生理性；瓣周漏（PAR）为异常，常因缝合问题，需结合溶血与血流动力学。', warn: true },
          { kind: 'text', text: '评估必须对比术后基线（6–12 周复查）；随访中压差升高或新发反流提示结构衰败或血栓 / 血管翳。' },
        ],
        note: '人工瓣膜功能判读以“与基线比较”为核心，单次绝对值易误判。',
      },
    ],
  },
  {
    id: 'valve',
    title: '瓣膜评估',
    // 完整版与本组「瓣膜评估」（5 个瓣膜计算器）合并，避免出现两个同名组；
    // 发布版（APK / 静态站）没有瓣膜页，本组独立显示，成为瓣膜判读的唯一入口。
    mergeInto: 'valve',
    items: [
      {
        id: 'mitral',
        title: '二尖瓣疾病评估',
        sub: '狭窄 MS · 反流 MR（定性 + 定量）',
        source: ['R9'],
        fields: [],
        blocks: [
          { kind: 'h', text: '二尖瓣狭窄 MS（定性 + 定量）' },
          {
            kind: 'table',
            heads: ['参数', '轻度', '中度', '重度'],
            rows: [
              ['MVA（压力减半时间）', '>1.5', '1.0–1.5', '<1.0 cm²'],
              ['平均跨瓣压差', '<5', '5–10', '>10 mmHg'],
              ['肺动脉收缩压', '<30', '30–50', '>50 mmHg'],
            ],
          },
          { kind: 'text', text: '二尖瓣口面积正常 4–6 cm²；平面法（二维）测 MVA 更直观，PISA 法用于反流程度评估而非狭窄面积。' },
          { kind: 'h', text: '二尖瓣反流 MR（定性 + 定量）' },
          {
            kind: 'table',
            heads: ['参数', '轻度', '中度', '重度'],
            rows: [
              ['EROA', '<20', '20–39', '≥40 mm²'],
              ['反流容积 RVol', '<30', '30–59', '≥60 mL'],
              ['反流分数 RF', '<30', '30–49', '≥50%'],
              ['缩流颈 VC', '<3', '3–6.9', '≥7 mm'],
            ],
          },
          { kind: 'note', text: '原发病因决定随访策略：风湿性、退行性（脱垂 / 腱索断裂）、继发性（乳头肌缺血 / DCM）。偏心性射流易低估，需多切面确认。', warn: true },
        ],
        note: '反流程度需结合定性（彩色面积、频谱密度）与定量（PISA 法 EROA / RVol）。',
      },
      {
        id: 'aortic',
        title: '主动脉瓣疾病评估',
        sub: '狭窄 AS（三联） · 反流 AR',
        source: ['R9'],
        fields: [],
        blocks: [
          { kind: 'h', text: '主动脉瓣狭窄 AS（三联定量）' },
          {
            kind: 'table',
            heads: ['参数', '轻度', '中度', '重度'],
            rows: [
              ['峰值流速 Vmax', '<3', '3–4', '≥4 m/s'],
              ['平均跨瓣压差', '<20', '20–40', '≥40 mmHg'],
              ['主动脉瓣口面积 AVA', '>1.5', '1.0–1.5', '≤1.0 cm²'],
              ['AV 流速比值 DVI', '>0.5', '0.25–0.5', '<0.25'],
            ],
          },
          { kind: 'note', text: '三者需一致；不一致时按最严重一级，并考虑低流量低压差（LF-LG）型，需多巴酚丁胺负荷或 CT 钙化评分辅助。', warn: true },
          { kind: 'text', text: '重度 AS 分期：B 期（进展风险高，每年随访）；C 期（无症状但 Vmax≥4 或 AVA≤1.0）；D 期（有症状）。' },
          { kind: 'h', text: '主动脉瓣反流 AR' },
          {
            kind: 'table',
            heads: ['参数', '轻度', '重度'],
            rows: [
              ['缩流颈宽度', '<3 mm', '≥6 mm'],
              ['反流束宽 / LVOT 直径', '<25%', '>65%'],
              ['PISA 半径（舒张期）', '—', '≥9 mm'],
              ['EROA', '<10', '≥30 mm²'],
              ['RVol', '<30', '≥60 mL'],
            ],
          },
          { kind: 'text', text: '急性 AR（夹层、感染性心内膜炎）与慢性 AR 表现不同；慢性者左室可长期耐受，一旦出现症状或 LVEF<50% 应考虑手术。' },
        ],
        note: 'AS 与 AR 定量均应先在「瓣膜评估」页用连续性方程 / PISA 法精算。',
      },
      {
        id: 'ie',
        title: '感染性心内膜炎赘生物评估',
        sub: '赘生物特征 · 大小与栓塞风险 · TEE 指征',
        source: ['R19'],
        blocks: [
          { kind: 'h', text: '一、赘生物的超声特征（支持诊断的形态学证据）' },
          {
            kind: 'table',
            heads: ['特征', '超声表现', '意义'],
            rows: [
              ['位置', '多附着于瓣叶心房侧（二尖瓣）或心室侧（主动脉瓣）', '与血流冲击面一致'],
              ['形态', '不规则、活动度大、可随心动周期摆动', '活动度大者栓塞风险高'],
              ['回声', '与心肌等回声或略强，无钙化', '钙化多为陈旧病变'],
              ['附着方式', '独立于瓣叶、有蒂或宽基底', '需与瓣叶增厚、脱垂鉴别'],
              ['数量', '可单发或多发，可累及两处以上瓣膜', '多瓣受累提示预后更差'],
            ],
          },
          { kind: 'text', text: '还需记录：瓣膜穿孔 / 腱索断裂（连枷瓣叶）、瓣周脓肿（瓣环区无回声区）、人工瓣膜瓣周漏、心包积液新发或增多。这些属于「破坏性病变」，是早期手术的重要指征。' },

          { kind: 'h', text: '二、赘生物大小与栓塞风险' },
          {
            kind: 'table',
            heads: ['最大长度', '栓塞风险', '处理提示'],
            rows: [
              ['<10 mm', '相对较低', '规范抗感染，按计划复查'],
              ['10–15 mm', '升高', '密切监测，评估早期手术'],
              ['>15 mm', '显著升高', '即使无并发症也应讨论早期手术'],
            ],
          },
          { kind: 'note', text: '栓塞风险还取决于赘生物活动度、位置（二尖瓣前叶最高）、病原（金葡菌、真菌、HACEK）与抗感染是否已起效；单看大小会低估风险。', warn: true },

          { kind: 'h', text: '三、什么时候必须做 TEE' },
          { kind: 'text', text: '① 经胸超声阴性但临床高度怀疑（持续菌血症 + 新发杂音）；② 人工瓣膜可疑心内膜炎；③ 怀疑瓣周脓肿 / 瘘道；④ 需在术前精确评估破坏范围与瓣膜可修复性。' },
          { kind: 'text', text: '经胸超声首次阴性不能排除诊断，指南建议在临床高度怀疑时于 5–7 天内重复经胸或改做 TEE。' },

          { kind: 'h', text: '四、最容易漏诊的四类情况' },
          { kind: 'text', text: '① 已开始抗感染——赘生物会缩小、回声减低，容易看成「瓣叶增厚」；② 人工瓣膜——金属伪影遮挡，必须 TEE；③ 起搏导线 / 导管相关——沿导线走行逐段看；④ 小赘生物（<5 mm）——帧率与增益不当极易漏，需多切面反复扫查。' },
          { kind: 'note', text: '超声只提供形态学证据，确诊需结合血培养。血培养阴性但超声典型者仍应按「可能心内膜炎」处理。', warn: true },
        ],
        note: '超声报告应写明：赘生物位置、最大长度、活动度、有无瓣膜破坏 / 脓肿 / 新发反流，以及是否累及人工瓣膜。',
      },
    ],
  },
  {
    id: 'myopathy',
    title: '心肌病变',
    items: [
      {
        id: 'hcm',
        title: '肥厚型心肌病评估',
        sub: '最大壁厚 · SAM · LVOT 压差 · 心尖型',
        source: ['R20'],
        blocks: [
          { kind: 'h', text: '一、诊断阈值（舒张末最大壁厚）' },
          {
            kind: 'table',
            heads: ['人群', '阈值', '说明'],
            rows: [
              ['成人（无家族史）', '≥15 mm', '不能用心肌负荷增高解释（如高血压、主动脉瓣狭窄）'],
              ['成人（一级亲属确诊）', '≥13 mm', '家族筛查中即可诊断'],
              ['儿童', '≥ 同龄均值 +2 SD', '需结合生长曲线判断'],
            ],
          },
          { kind: 'text', text: '测量取短轴或长轴舒张末，避开乳头肌与调节束；厚度的分布（基底段 / 中段 / 心尖）决定分型与压差位置。' },

          { kind: 'h', text: '二、梗阻分级（LVOT 压差）' },
          {
            kind: 'table',
            heads: ['静息 / 激发后 LVOT 压差', '分级', '处理方向'],
            rows: [
              ['<30 mmHg', '非梗阻', '随访 + 症状治疗'],
              ['30–49 mmHg', '轻度（激发后）', '避免脱水、剧烈运动'],
              ['≥50 mmHg（静息或激发）', '梗阻性', '有症状者考虑药物（β 阻滞剂 / 丙吡胺）或室间隔减容'],
            ],
          },
          { kind: 'text', text: '激发试验用 Valsalva 动作或运动（不推荐药物激发替代生理激发）；压差 ≥50 mmHg 且有症状是室间隔减容术（外科切除 / 酒精消融）的主要指征。' },

          { kind: 'h', text: '三、SAM 与二尖瓣' },
          { kind: 'text', text: 'SAM（二尖瓣收缩期前向运动）：收缩期二尖瓣前叶被拉向室间隔，造成 LVOT 梗阻 + 偏心性二尖瓣反流（后向）。反流束方向是鉴别关键——SAM 相关 MR 朝后方，原发性 MR 多朝前方。' },
          { kind: 'note', text: '不要把 SAM 引起的 MR 当成原发性二尖瓣病变去做瓣膜修复；解除梗阻后 MR 多可明显减轻。', warn: true },

          { kind: 'h', text: '四、心尖肥厚型（易漏诊）' },
          { kind: 'text', text: '心尖部壁厚 ≥15 mm、左室腔呈「铲形」，心电图常见巨大倒置 T 波（胸前导联 >10 mm）。心尖部易形成室壁瘤，需关注血栓与室性心律失常。' },

          { kind: 'h', text: '五、猝死风险因素（满足即需评估 ICD）' },
          { kind: 'text', text: '① 最大壁厚 ≥30 mm；② 一级亲属猝死史；③ 不明原因近期晕厥；④ 非持续性室速（Holter）；⑤ 左室心尖室壁瘤；⑥ LVEF <50%。' },
          { kind: 'note', text: 'HCM 患者 LVEF 常保留甚至偏高，不能以 EF 正常排除风险；应变与 LGE（CMR）对危险分层更有价值。', warn: true },
        ],
        note: '评估顺序：最大壁厚与分布 → 有无 SAM / 梗阻 → 二尖瓣反流机制 → 猝死风险因素。',
      },
      {
        id: 'amyloid',
        title: '心脏淀粉样变超声提示',
        sub: '室壁增厚 +「苹果核」应变 · 心尖保留',
        source: ['R21'],
        blocks: [
          { kind: 'h', text: '一、结构线索（不止是「壁厚」）' },
          {
            kind: 'table',
            heads: ['征象', '表现', '提示强度'],
            rows: [
              ['双心房扩大', '左右房均明显扩大而心室腔偏小', '强'],
              ['房间隔 / 瓣膜增厚', '房间隔 >6 mm、瓣叶普遍增厚', '中'],
              ['心肌「颗粒样」回声', '增益合适时可见细颗粒闪烁', '中（受机器影响大）'],
              ['少量心包积液', '常为双侧、反复出现', '中'],
              ['右室游离壁增厚', '≥7 mm', '中'],
            ],
          },
          { kind: 'text', text: '心电图与超声「不匹配」是本病的经典矛盾：室壁显著增厚但心电图低电压或电压-质量比降低。发现这个矛盾就应主动查淀粉样变。' },

          { kind: 'h', text: '二、应变特征（最有价值的一项）' },
          { kind: 'text', text: '纵向应变的基底段严重减低、心尖段相对保留，形成「苹果核（apical sparing）」图形。定量表达为**心尖/基底应变比值**：' },
          { kind: 'formula', text: '心尖保留比值 = 心尖段平均纵向应变 ÷（基底段 + 中间段平均纵向应变）；>2.1 高度提示淀粉样变' },
          { kind: 'note', text: '该征象在重度主动脉瓣狭窄、长期高血压中也可见到减弱版，比值需 >2.1 且结合临床；单看 GLS 绝对值（常为 −10% 至 −15%）不足以鉴别。', warn: true },

          { kind: 'h', text: '三、与肥厚型心肌病、高血压心脏病的鉴别' },
          {
            kind: 'table',
            heads: ['项目', '心脏淀粉样变', '肥厚型心肌病', '高血压心脏病'],
            rows: [
              ['壁厚分布', '对称性增厚为主', '不对称（多为室间隔）', '对称，程度轻'],
              ['心电图电压', '低电压 / 电压-质量比低', '电压常增高', '可增高'],
              ['应变图形', '心尖保留（比值 >2.1）', '病变段局灶减低', '整体均匀轻度减低'],
              ['心房', '双房显著扩大', '左房扩大', '左房轻中度扩大'],
              ['心包积液', '常见（少量）', '少见', '少见'],
            ],
          },

          { kind: 'h', text: '四、超声之后的下一步' },
          { kind: 'text', text: '超声只能「提示」，确诊依赖：① 血 / 尿轻链与免疫固定电泳（排除 AL 型）；② ⁹⁹ᵐTc-DPD/PYP/HMDP 核素显像（ATTR 型 2–3 级摄取可免活检确诊）；③ 必要时心内膜心肌活检。' },
          { kind: 'note', text: '一旦怀疑 AL 型淀粉样变，必须尽快转诊血液科——延误数周即可显著影响生存；不要停在「壁厚原因待查」。', warn: true },
        ],
        note: '看到「室壁厚 + 心房大 + 低电压 + 心尖保留」四联征，就应主动启动淀粉样变筛查流程。',
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
        sub: '胸骨旁 / 心尖 / 剑下 · 直达交互应用',
        url: 'https://pie.med.utoronto.ca/TTE/TTE_content/assets/applications/TTE-HTML5-SV/index.html',
      },
      {
        id: 'tee-cheat',
        title: 'TEE 标准视图速查表',
        sub: '探头角度 · 平面 · 对应结构 · 可打印（360 极速浏览器打开）',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/assets/applications/TEE-cheat-sheet/index.htm',
      },
    ],
  },
  {
    id: 'guides',
    title: '切面指南',
    items: [
      {
        id: 'guide-tte-cn',
        title: '经胸切面指南（中文版）',
        sub: 'ASE 成人完整 TTE 检查操作指南 · 官方中文翻译 PDF',
        url: 'https://www.asecho.org/wp-content/uploads/2025/04/Adult-CompTTE_Chinese.pdf',
      },
      {
        id: 'guide-tte-en',
        title: '经胸切面指南（英文原版）',
        sub: 'ASE 成人完整 TTE 检查操作指南（2019）· 官方 PDF',
        url: 'https://www.asecho.org/wp-content/uploads/2025/07/Guidelines-for-Performing-a-Comprehensive-Transthoracic-Echocardiographic-Examination-in-Adults.pdf',
      },
      {
        id: 'guide-tee-28',
        title: '经食道切面指南（28 标准切面）',
        sub: 'ASE/SCA 成人 TEE 完整检查指南（2013）· 官方 PDF 直链',
        url: 'https://www.asecho.org/wp-content/uploads/2014/05/2013_Performing-Comprehensive-TEE.pdf',
      },
      {
        id: 'guide-tee-shd',
        title: '经食道切面指南（介入筛查）',
        sub: 'ASE 2021 结构性心脏病介入 TEE 筛查标准 · 官方 PDF',
        url: 'https://www.asecho.org/wp-content/uploads/2025/04/PIIS0894731721005940.pdf',
      },
    ],
  },
  {
    id: 'sim',
    title: 'TEE 模拟器',
    items: [
      {
        id: 'sim-toronto',
        title: '多伦多 TEE 交互模拟器',
        sub: '标准切面全流程交互演示 · 360 极速浏览器兼容模式打开',
        url: 'https://pie.med.utoronto.ca/tee/TEE_content/assets/applications/teeSimulation/index.html',
      },
      {
        id: 'sim-ct2tee',
        title: 'CT2TEE 在线模拟器',
        sub: 'CT 重建驱动 · 旋转 / 俯仰 / 成角操控',
        url: 'https://www.ct2tee.agh.edu.pl/',
      },
      {
        id: 'sim-atlas',
        title: 'TEE Simulator 图谱',
        sub: '交互式切面图谱（英文）· 需科学上网',
        url: 'https://tee-simulator.anesthbeta.com/atlas?lang=en',
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
  {
    id: 'R11',
    zh: '成人完整经胸超声心动图操作指南（ASE 2019）',
    en: 'Mitchell C, Rahko PS, Blauwet LAB, et al. Guidelines for Performing a Comprehensive Transthoracic Echocardiographic Examination in Adults',
    where: 'J Am Soc Echocardiogr, 2019, 32(1): 1–64（ASE 官网提供官方中文翻译版）',
    use: '经胸标准切面命名、采集顺序与测量规范（见「切面指南」）',
  },
  {
    id: 'R12',
    zh: '成人经食管超声心动图完整检查指南（ASE/SCA）',
    en: 'Hahn RT, Abraham T, Adams MS, et al. Guidelines for Performing a Comprehensive Transesophageal Echocardiographic Examination',
    where: 'J Am Soc Echocardiogr, 2013, 26(12): 921–964（28 个标准切面）',
    use: 'TEE 28 标准切面命名与采集规范（见「切面指南」）',
  },
  {
    id: 'R13',
    zh: '肺动脉高压诊断与治疗指南（ESC/ERS 2022）',
    en: 'Humbert M, et al. 2022 ESC/ERS Guidelines for the diagnosis and treatment of pulmonary hypertension',
    where: 'Eur Respir J, 2022, 60(1): 2200879',
    use: 'PH 血流动力学分型、超声概率与右心导管定义',
  },
  {
    id: 'R14',
    zh: '成人右心超声评估指南（ASE 2010）',
    en: 'Rudski LG, et al. Guidelines for the Echocardiographic Assessment of the Right Heart in Adults',
    where: 'J Am Soc Echocardiogr, 2010, 23(7): 685–713',
    use: '右室功能、右房压与 PH 超声评估的金标准参考',
  },
  {
    id: 'R15',
    zh: '心包疾病超声心动图评估指南（2013）',
    en: 'Klein AL, et al. ASE/EACVI Guidelines for Echocardiographic Evaluation of Pericardial Disease',
    where: 'J Am Soc Echocardiogr, 2013, 26(9): 965–1012',
    use: '心包积液半定量、心脏压塞与缩窄性心包炎征象',
  },
  {
    id: 'R16',
    zh: '左心室舒张功能评估指南（2016）',
    en: 'Nagueh SF, et al. Recommendations for the Evaluation of Left Ventricular Diastolic Function by Echocardiography (2016 ASE/EACVI)',
    where: 'J Am Soc Echocardiogr, 2016, 29(4): 277–314',
    use: '舒张功能分级四步法与灰区处理',
  },
  {
    id: 'R17',
    zh: '人工心脏瓣膜超声评估指南（2017）',
    en: 'Zoghbi WA, et al. Recommendations for Evaluation of Prosthetic Valves with Echocardiography (2017 ASE)',
    where: 'J Am Soc Echocardiogr, 2017, 30(4): 372–428',
    use: '人工瓣膜正常压差、PPM 与瓣周漏判读',
  },
  {
    id: 'R18',
    zh: 'TAPSE/PASP 比值：右室-肺动脉耦联指标',
    en: 'Guazzi M, et al. Tricuspid annular plane systolic excursion and pulmonary arterial systolic pressure relationship in heart failure: an index of right ventricular contractile function and prognosis',
    where: 'Am J Physiol Heart Circ Physiol, 2013, 305(9): H1373–H1381',
    use: '右室-肺动脉耦联比值 0.55 / 0.36 切点与预后意义',
  },
  {
    id: 'R19',
    zh: '感染性心内膜炎管理指南（2023 ESC）',
    en: 'Delgado V, et al. 2023 ESC Guidelines for the management of endocarditis',
    where: 'Eur Heart J, 2023, 44(39): 3948–4042',
    use: '赘生物大小与栓塞风险、TEE 指征、重复超声时机',
  },
  {
    id: 'R20',
    zh: '肥厚型心肌病诊断与治疗指南（2020 AHA/ACC）',
    en: 'Ommen SR, et al. 2020 AHA/ACC Guideline for the Diagnosis and Treatment of Patients With Hypertrophic Cardiomyopathy',
    where: 'Circulation, 2020, 142(25): e558–e631',
    use: '最大壁厚诊断阈值、LVOT 梗阻分级与猝死风险因素',
  },
  {
    id: 'R21',
    zh: '心脏淀粉样变诊断与治疗立场声明（2021 ESC）',
    en: 'Garcia-Pavia P, et al. Diagnosis and Treatment of Cardiac Amyloidosis: A Position Statement of the ESC Working Group on Myocardial and Pericardial Diseases',
    where: 'Eur Heart J, 2021, 42(16): 1554–1568',
    use: '心肌「苹果核」应变、心尖保留比值与确诊路径',
  },
];

module.exports = {
  BRIEF_SECTIONS: BRIEF_SECTIONS,
  LINK_SECTIONS: LINK_SECTIONS,
  REFS: REFS,
};