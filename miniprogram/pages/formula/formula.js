/**
 * 公式详情页：一页一个公式组
 *
 * 路由：/pages/formula/formula?id=flow
 * 分组定义来自 utils/calc-groups.js（与公式集目录同源，新增公式只改那一处）
 *
 * 输入值按组缓存在 app.globalData.calcCache，返回目录再进来不丢。
 */
const CG = require('../../utils/calc-groups.js');
const calc = require('../../utils/echo-calc.js');
const app = getApp();

Page({
  data: {
    gid: '',
    title: '',
    note: '',
    collapse: CG.COLLAPSE,
    signs: CG.SIGNS,
    inputs: [],
    collapseV: '',
    signsV: '',
    bsaText: '—',
    out: '',
    hasOut: false,
  },

  onLoad(query) {
    const id = (query && query.id) || (CG.GROUPS[0] && CG.GROUPS[0].id);
    const g = CG.groupOf(id) || CG.GROUPS[0];

    // 按组缓存输入值，返回目录再进来仍在
    if (!app.globalData.calcCache) app.globalData.calcCache = {};
    const cache = app.globalData.calcCache[g.id] || {};

    const inputs = g.fields.map(function (f) {
      return { key: f.k, name: f.n, unit: f.u, value: cache[f.k] || '' };
    });

    this.setData({
      gid: g.id,
      title: g.title,
      note: g.note,
      inputs: inputs,
      collapseV: cache.__collapse || '',
      signsV: cache.__signs || '',
    });

    wx.setNavigationBarTitle({ title: g.title });
  },

  onShow() {
    const p = app.globalData.profile;
    this.setData({ bsaText: p && p.bsa ? p.bsa.toFixed(2) : '—' });
    this.refresh();
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

  onClear() {
    const inputs = this.data.inputs.map(function (r) {
      return Object.assign({}, r, { value: '' });
    });
    this.setData({ inputs: inputs, collapseV: '', signsV: '', out: '', hasOut: false });
    this.saveCache();
  },

  /** 把当前输入写回缓存 */
  saveCache() {
    if (!app.globalData.calcCache) app.globalData.calcCache = {};
    const c = {};
    this.data.inputs.forEach(function (r) {
      if (r.value !== '') c[r.key] = r.value;
    });
    if (this.data.collapseV) c.__collapse = this.data.collapseV;
    if (this.data.signsV) c.__signs = this.data.signsV;
    app.globalData.calcCache[this.data.gid] = c;
  },

  /** 计算当前组 */
  refresh() {
    this.saveCache();

    const v = {};
    this.data.inputs.forEach(function (r) {
      const n = parseFloat(r.value);
      if (r.value !== '' && !isNaN(n)) v[r.key] = n;
    });

    const bsa = (app.globalData.profile && app.globalData.profile.bsa) || 0;
    const valid = (...xs) => xs.every((x) => x !== undefined && isFinite(x));

    let out = '';
    const gid = this.data.gid;

    if (gid === 'flow') {
      // —— flow：SV / CO / CI ——
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
        out = parts.join('；');
      }
    } else if (gid === 'shunt') {
      // —— shunt：Qp/Qs ——
      if (valid(v.rd, v.rvti) && valid(v.ld, v.lvti)) {
        const qs = calc.strokeVolume(v.ld, v.lvti);
        if (qs > 0) out = 'Qp/Qs = ' + calc.fmt(calc.strokeVolume(v.rd, v.rvti) / qs);
      } else if (valid(v.rd, v.rvti) && !valid(v.ld, v.lvti)) {
        out = '需先在「LVOT · 每搏量与心排量」填写 LVOT 直径与 VTI（体循环流量）';
      }
    } else if (gid === 'bernoulli') {
      // —— bernoulli ——
      if (valid(v.v2)) {
        out = (valid(v.v1) && v.v1 > v.v2)
          ? '近端速度不能大于远端速度，请核对取样位置'
          : 'ΔP = ' + calc.fmt(calc.bernoulli(v.v2, v.v1), 1) + ' mmHg';
      }
    } else if (gid === 'atrial') {
      // —— atrial ——
      if (bsa > 0) {
        const parts = [];
        if (valid(v.lav)) parts.push('LAVI ' + calc.fmt(v.lav / bsa) + ' mL/m²');
        if (valid(v.rav)) parts.push('RAVI ' + calc.fmt(v.rav / bsa) + ' mL/m²');
        out = parts.join('；');
      } else if (valid(v.lav) || valid(v.rav)) {
        out = '请先在「EF·参考值」页填写身高体重（BSA 为 0 时无法计算指数）';
      }
    } else if (gid === 'pressure') {
      // —— pressure ——
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
      out = parts.join('；');
    } else if (gid === 'rvcalc') {
      // —— rvcalc ——
      let s = '';
      if (valid(v.eda, v.esa)) {
        s = v.esa > v.eda
          ? 'ESA 不可大于 EDA'
          : 'FAC ' + calc.fmt(calc.fac(v.eda, v.esa), 1) + '%（正常 >35%）';
      }
      if (valid(v.rvs)) {
        s += (s ? '；' : '') + 'S′ ' + calc.fmt(v.rvs, 1) + ' cm/s（正常 >9.5）';
      }
      out = s;
    } else if (gid === 'dias') {
      // —— dias ——
      const r = calc.diastolicRatios(
        v.e === undefined ? null : v.e,
        v.a === undefined ? null : v.a,
        v.es === undefined ? null : v.es,
        v.el === undefined ? null : v.el
      );
      const parts = [];
      if (r.ea !== undefined) parts.push('E/A = ' + calc.fmt(r.ea));
      if (r.avgEe !== undefined) parts.push('平均 E/e′ = ' + calc.fmt(r.avgEe) + '（' + calc.gradeEe(r.avgEe).text + '）');
      out = parts.join('；');
    }

    this.setData({ out: out, hasOut: !!out });
  },
});
