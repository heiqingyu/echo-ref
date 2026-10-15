const calc = require('../../utils/echo-calc.js');
const core = require('../../utils/echo-core.js');
const app = getApp();

/** 每组字段定义：key/名称/单位 */
const GROUPS = [
  {
    id: 'flow', title: 'LVOT · 每搏量与心排量',
    fields: [
      { k: 'ld', n: 'LVOT 直径', u: 'cm' },
      { k: 'lvti', n: 'LVOT VTI', u: 'cm' },
      { k: 'hr', n: '心率', u: '次/min' },
    ],
    note: 'SV = πd²/4 × VTI；CO = SV × HR ÷ 1000',
  },
  {
    id: 'shunt', title: 'Qp/Qs 肺体循环血流比',
    fields: [
      { k: 'rd', n: 'RVOT 直径', u: 'cm' },
      { k: 'rvti', n: 'RVOT VTI', u: 'cm' },
    ],
    note: '使用上方 LVOT 的 SV 作为体循环流量；反流、多处梗阻会影响结果',
  },
  {
    id: 'bernoulli', title: '简化伯努利压差',
    fields: [
      { k: 'v2', n: '远端峰速 V₂', u: 'm/s' },
      { k: 'v1', n: '近端峰速 V₁（可选）', u: 'm/s' },
    ],
    note: 'ΔP = 4(V₂² − V₁²)；缺省 V₁ 按 0 处理。瓣膜狭窄 / 反流的定量计算见「瓣膜评估」页',
  },
  {
    id: 'atrial', title: '心房容积指数',
    fields: [
      { k: 'lav', n: '左房容积', u: 'mL' },
      { k: 'rav', n: '右房容积', u: 'mL' },
    ],
    note: '容积 ÷ BSA；LAVI 正常 ≤34 mL/m²；右房正常值需匹配测量方法',
  },
  {
    id: 'pressure', title: '右心压力与 PH 概率',
    fields: [
      { k: 'tr', n: 'TR 峰速', u: 'm/s' },
      { k: 'ivc', n: 'IVC 内径', u: 'mm' },
      { k: 'prend', n: 'PR 舒张末速度（可选）', u: 'm/s' },
      { k: 'rvti2', n: 'RVOT VTI（PVR 用，可选）', u: 'cm' },
    ],
    note: 'RAP 估算仅适用自主呼吸；PASP 估算要求无 RVOT/肺动脉瓣梗阻',
  },
  {
    id: 'rvcalc', title: '右室功能',
    fields: [
      { k: 'eda', n: 'RV 舒张末面积', u: 'cm²' },
      { k: 'esa', n: 'RV 收缩末面积', u: 'cm²' },
      { k: 'rvs', n: '右室 S′（可选）', u: 'cm/s' },
    ],
    note: 'FAC 正常 >35%；右室 S′ 正常 >9.5 cm/s',
  },
  {
    id: 'dias', title: '舒张功能基础比值',
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

Page({
  data: {
    groups: GROUPS,
    collapse: COLLAPSE,
    signs: SIGNS,
    inputs: [],
    collapseV: '',
    signsV: '',
    bsaText: '—',
    outputs: {},
  },

  onLoad() {
    this.initInputs();
  },

  onShow() {
    const p = app.globalData.profile;
    this.setData({ bsaText: p.bsa ? p.bsa.toFixed(2) : '—' });
    this.refresh();
  },

  initInputs() {
    const inputs = [];
    GROUPS.forEach(function (g) {
      g.fields.forEach(function (f) {
        inputs.push({ key: f.k, group: g.id, name: f.n, unit: f.u, value: '' });
      });
    });
    this.setData({ inputs });
  },

  onInput(e) {
    const idx = e.currentTarget.dataset.idx;
    const patch = {};
    patch['inputs[' + idx + '].value'] = e.detail.value;
    this.setData(patch);
    this.refresh();
  },

  onCollapse(e) {
    this.setData({ collapseV: e.currentTarget.dataset.v });
    this.refresh();
  },

  onSigns(e) {
    this.setData({ signsV: e.currentTarget.dataset.v });
    this.refresh();
  },

  /** 跳转到瓣膜评估页（AS / AR / MS / MR / TR） */
  onGoValves() {
    wx.navigateTo({ url: '/pages/valves/valves' });
  },

  onClear() {    const inputs = this.data.inputs.map(function (r) {
      return Object.assign({}, r, { value: '' });
    });
    this.setData({ inputs, collapseV: '', signsV: '', outputs: {} });
  },

  /** 汇总数值并计算全部结果 */
  refresh() {
    const v = {};
    this.data.inputs.forEach(function (r) {
      const n = parseFloat(r.value);
      if (r.value !== '' && !isNaN(n)) v[r.key] = n;
    });

    const bsa = app.globalData.profile.bsa || 0;
    const valid = (...xs) => xs.every((x) => x !== undefined && isFinite(x));

    // —— flow：SV / CO / CI ——
    const out = {};
    if (valid(v.ld, v.lvti)) {
      const csa = calc.csaFromDiameter(v.ld);
      const sv = calc.strokeVolume(v.ld, v.lvti);
      const parts = ['CSA ' + calc.fmt(csa) + ' cm²', 'SV ' + calc.fmt(sv, 1) + ' mL'];
      if (valid(v.hr)) {
        const co = calc.cardiacOutput(sv, v.hr);
        parts.push('CO ' + calc.fmt(co) + ' L/min');
        if (bsa > 0) {
          parts.push('SVi ' + calc.fmt(sv / bsa, 1) + ' mL/m²');
          parts.push('CI ' + calc.fmt(co / bsa) + ' L/min/m²');
        }
      }
      out.flow = parts.join('；');
    }

    // —— shunt：Qp/Qs ——
    if (valid(v.rd, v.rvti) && valid(v.ld, v.lvti)) {
      const qs = calc.strokeVolume(v.ld, v.lvti);
      if (qs > 0) out.shunt = 'Qp/Qs = ' + calc.fmt(calc.strokeVolume(v.rd, v.rvti) / qs);
    }

    // —— bernoulli ——
    if (valid(v.v2)) {
      if (valid(v.v1) && v.v1 > v.v2) {
        out.bernoulli = '近端速度不能大于远端速度，请核对取样位置';
      } else {
        out.bernoulli = 'ΔP = ' + calc.fmt(calc.bernoulli(v.v2, v.v1), 1) + ' mmHg';
      }
    }

    // —— atrial ——
    if (bsa > 0) {
      const parts = [];
      if (valid(v.lav)) parts.push('LAVI ' + calc.fmt(v.lav / bsa) + ' mL/m²');
      if (valid(v.rav)) parts.push('RAVI ' + calc.fmt(v.rav / bsa) + ' mL/m²');
      if (parts.length) out.atrial = parts.join('；');
    }

    // —— pressure ——
    {
      const parts = [];
      let rap = null;
      if (valid(v.ivc)) {
        rap = calc.rapFromIvc(v.ivc, this.data.collapseV);
        parts.push('RAP 估计 ' + rap + ' mmHg');
      }
      if (valid(v.tr) && rap !== null) {
        parts.push('PASP ≈ ' + calc.fmt(calc.pasp(v.tr, rap), 1) + ' mmHg');
      }
      if (valid(v.tr, v.rvti2)) {
        parts.push('PVR ≈ ' + calc.fmt(calc.pvrEstimate(v.tr, v.rvti2)) + ' WU');
      }
      if (valid(v.prend) && rap !== null) {
        parts.push('PADP ≈ ' + calc.fmt(calc.padp(v.prend, rap), 1) + ' mmHg');
      }
      if (valid(v.tr)) {
        const signs = this.data.signsV === '' ? null : this.data.signsV === 'yes';
        parts.push('PH 超声概率：' + calc.phProbability(v.tr, signs));
      }
      if (parts.length) out.pressure = parts.join('；');
    }

    // —— rvcalc ——
    {
      let s = '';
      if (valid(v.eda, v.esa)) {
        if (v.esa > v.eda) {
          s = 'ESA 不可大于 EDA';
        } else {
          s = 'FAC ' + calc.fmt(calc.fac(v.eda, v.esa), 1) + '%（正常 >35%）';
        }
      }
      if (valid(v.rvs)) {
        s += (s ? '；' : '') + 'S′ ' + calc.fmt(v.rvs, 1) + ' cm/s（正常 >9.5）';
      }
      if (s) out.rvcalc = s;
    }

    // —— dias ——
    {
      const r = calc.diastolicRatios(
        v.e === undefined ? null : v.e,
        v.a === undefined ? null : v.a,
        v.es === undefined ? null : v.es,
        v.el === undefined ? null : v.el
      );
      const parts = [];
      if (r.ea !== undefined) parts.push('E/A = ' + calc.fmt(r.ea));
      if (r.avgEe !== undefined) parts.push('平均 E/e′ = ' + calc.fmt(r.avgEe) + '（' + calc.gradeEe(r.avgEe).text + '）');
      if (parts.length) out.dias = parts.join('；');
    }

    this.setData({ outputs: out });
  },
});
