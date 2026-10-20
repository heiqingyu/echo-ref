/**
 * 公式详情页：一页一个条目
 *
 * 路由：/pages/formula/formula?id=flow（计算公式）| ?id=crt（评估类内容）
 *   - 计算公式：utils/calc-groups.js 的 GROUPS
 *   - 评估内容：utils/extra-data.js 的 BRIEF_SECTIONS（带 blocks / fields / calc）
 *
 * 输入值按组缓存在 app.globalData.calcCache，返回目录再进来不丢。
 */
const CG = require('../../utils/calc-groups.js');
const EX = require('../../utils/extra-data.js');
const calc = require('../../utils/echo-calc.js');
const app = getApp();

/** 在评估类内容里按 id 找条目 */
function findBrief(id) {
  for (let i = 0; i < EX.BRIEF_SECTIONS.length; i += 1) {
    const hit = EX.BRIEF_SECTIONS[i].items.filter(function (it) { return it.id === id; })[0];
    if (hit) return hit;
  }
  return null;
}

/** blocks → 视图模型（表格列数由表头决定） */
function toBlocks(blocks) {
  return (blocks || []).map(function (b) {
    if (b.kind === 'table') {
      return { kind: 'table', heads: b.heads, rows: b.rows, cols: b.heads.length, warn: !!b.warn };
    }
    return { kind: b.kind, text: b.text, warn: !!b.warn };
  });
}

Page({
  data: {
    gid: '',
    mode: 'calc',
    title: '',
    note: '',
    blocks: [],
    refs: [],
    collapse: CG.COLLAPSE,
    signs: CG.SIGNS,
    inputs: [],
    collapseV: '',
    signsV: '',
    bsaText: '—',
    sexLabel: '男性',
    out: '',
    hasOut: false,
  },

  onLoad(query) {
    const id = (query && query.id) || (CG.GROUPS[0] && CG.GROUPS[0].id);
    const brief = findBrief(id);

    if (brief) {
      const cache = (app.globalData.calcCache || {})[brief.id] || {};
      const inputs = (brief.fields || []).map(function (f) {
        return { key: f.k, name: f.n, unit: f.u, value: cache[f.k] || '' };
      });
      this.setData({
        gid: brief.id,
        mode: 'brief',
        title: brief.title,
        note: brief.note || '',
        blocks: toBlocks(brief.blocks),
        refs: (brief.source || []).map(function (rid) {
          const r = EX.REFS.filter(function (x) { return x.id === rid; })[0];
          return r ? { id: r.id, zh: r.zh, where: r.where } : null;
        }).filter(Boolean),
        inputs: inputs,
        collapseV: cache.__collapse || '',
        signsV: cache.__signs || '',
      });
    } else {
      const g = CG.groupOf(id) || CG.GROUPS[0];
      const cache = (app.globalData.calcCache || {})[g.id] || {};
      const inputs = g.fields.map(function (f) {
        return { key: f.k, name: f.n, unit: f.u, value: cache[f.k] || '' };
      });
      this.setData({
        gid: g.id,
        mode: 'calc',
        title: g.title,
        note: g.note,
        blocks: [],
        refs: [],
        inputs: inputs,
        collapseV: cache.__collapse || '',
        signsV: cache.__signs || '',
      });
    }

    wx.setNavigationBarTitle({ title: this.data.title });
  },

  onShow() {
    const p = app.globalData.profile;
    this.setData({
      bsaText: p && p.bsa ? p.bsa.toFixed(2) : '—',
      sexLabel: (p && p.sex === 'female') ? '女性' : '男性',
    });
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

  /** 计算当前条目 */
  refresh() {
    this.saveCache();

    const v = {};
    this.data.inputs.forEach(function (r) {
      const n = parseFloat(r.value);
      if (r.value !== '' && !isNaN(n)) v[r.key] = n;
    });

    const prof = app.globalData.profile || {};
    const bsa = prof.bsa || 0;
    const female = prof.sex === 'female';
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
    } else if (gid === 'crt') {
      // —— CRT：SV / SVi + QRS 时限提示 ——
      const parts = [];
      if (valid(v.ld, v.lvti)) {
        const sv = calc.strokeVolume(v.ld, v.lvti);
        parts.push('SV ' + calc.fmt(sv, 1) + ' mL');
        if (bsa > 0) {
          const svi = sv / bsa;
          parts.push('SVi ' + calc.fmt(svi, 1) + ' mL/m²');
          if (svi < 35) parts.push('（低流量）');
        }
      }
      if (valid(v.qrs)) {
        parts.push('QRS ' + calc.fmt(v.qrs, 0) + ' ms → ' +
          (v.qrs >= 150 ? '≥150 ms，CRT 指征最强（LBBB 为 I 类、非 LBBB 为 IIa）'
            : v.qrs >= 130 ? '130–149 ms，LBBB 为 IIa、非 LBBB 为 IIb'
              : '＜130 ms，通常不满足 CRT 指征'));
      }
      out = parts.join('；');
    } else if (gid === 'la') {
      // —— 左心房容积指数 ——
      if (valid(v.lav) && bsa > 0) {
        const lavi = v.lav / bsa;
        out = 'LAVi ' + calc.fmt(lavi) + ' mL/m² · ' +
          (lavi > 34 ? '增大（>34 mL/m²，男女同阈值）' : '正常（≤34 mL/m²）');
      } else if (valid(v.lav)) {
        out = '需先在「EF·参考值」页填写身高体重（BSA 为 0 时无法计算指数）';
      }
    } else if (gid === 'lv') {
      // —— 左室质量指数分级 + RWT ——
      const parts = [];
      if (valid(v.lvmi)) {
        const bands = female
          ? [[0, 89, '正常'], [90, 107, '轻度增高'], [108, 121, '中度增高'], [122, 137, '重度增高'], [138, Infinity, '极重度增高']]
          : [[0, 95, '正常'], [96, 115, '轻度增高'], [116, 131, '中度增高'], [132, 149, '重度增高'], [150, Infinity, '极重度增高']];
        let lvl = '';
        for (let i = 0; i < bands.length; i += 1) {
          if (v.lvmi >= bands[i][0] && v.lvmi <= bands[i][1]) lvl = bands[i][2];
        }
        parts.push('LVMI ' + calc.fmt(v.lvmi, 1) + ' g/m²（' +
          (female ? '女性' : '男性') + '）→ ' + lvl);
      }
      if (valid(v.rwt)) {
        parts.push('RWT ' + calc.fmt(v.rwt, 2) + ' · ' +
          (v.rwt > 0.42 ? '升高：向心性肥厚' : '正常或偏低：离心性重构'));
      }
      out = parts.join('；');
    } else if (gid === 'rv') {
      // —— 右心：RAP + PASP + PVR + PADP + PH 概率 + 右室功能 ——
      const parts = [];
      let rap = null;
      if (valid(v.ivc)) {
        rap = calc.rapFromIvc(v.ivc, this.data.collapseV);
        parts.push('RAP 估计 ' + rap + ' mmHg');
      }
      if (valid(v.tr) && rap !== null) {
        parts.push('PASP ≈ ' + calc.fmt(calc.pasp(v.tr, rap), 1) + ' mmHg · ' +
          (v.tr <= 2.8 ? '无肺高压' : v.tr < 3.4 ? '轻度升高' : '中重度升高'));
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
      if (valid(v.eda, v.esa)) {
        parts.push(v.esa > v.eda ? 'RV EDA/ESA 不匹配（ESA 不可大于 EDA）'
          : 'FAC ' + calc.fmt(calc.fac(v.eda, v.esa), 1) + '%（正常 >35%）');
      }
      if (valid(v.rvs)) {
        parts.push('RV S′ ' + calc.fmt(v.rvs, 1) + ' cm/s（正常 >9.5）');
      }
      out = parts.join('；');
    } else if (gid === 'strain') {
      // —— 应变判读 ——
      const parts = [];
      if (valid(v.gls)) {
        parts.push('GLS ' + calc.fmt(v.gls, 1) + '% · ' +
          (v.gls <= -20 ? '正常' : v.gls < -18 ? '边缘（缩短减弱）' : '异常（缩短明显减低）'));
      }
      if (valid(v.rvstrain)) {
        parts.push('右室游离壁应变 ' + calc.fmt(v.rvstrain, 1) + '% · ' +
          (v.rvstrain <= -20 ? '正常' : '缩短减低'));
      }
      out = parts.join('；');
    }

    this.setData({ out: out, hasOut: !!out });
  },
});