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
    isReference: false,
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
        isReference: !(brief.fields && brief.fields.length),
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
        isReference: false,
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
    } else if (gid === 'ef') {
      // —— 左室容积与射血分数 ——
      if (valid(v.edv, v.esv)) {
        const r = calc.lvEf(v.edv, v.esv, bsa);
        if (r.error) out = r.error;
        else {
          const parts = ['EF ' + calc.fmt(r.ef, 1) + '%', 'SV ' + calc.fmt(r.sv, 1) + ' mL'];
          if (r.svi !== undefined) {
            parts.push('SVi ' + calc.fmt(r.svi, 1) + ' mL/m²');
            parts.push('ESVi ' + calc.fmt(r.esvi, 1) + ' mL/m²');
          }
          if (r.text) parts.push('→ ' + r.text);
          out = parts.join('；');
        }
      }
    } else if (gid === 'lvmass') {
      // —— 左室质量与几何构型 ——
      if (valid(v.lvid, v.ivs, v.lvpw)) {
        const r = calc.lvMass({ lvid: v.lvid, ivs: v.ivs, lvpw: v.lvpw, bsa: bsa, female: female });
        const parts = ['LV Mass ' + calc.fmt(r.mass, 1) + ' g', 'RWT ' + calc.fmt(r.rwt, 2)];
        if (r.lvmi !== undefined) {
          parts.push('LVMI ' + calc.fmt(r.lvmi, 1) + ' g/m²（' + (female ? '女' : '男') + ' 上限 ' + r.hi + '）');
        }
        if (r.text) parts.push('→ ' + r.text);
        out = parts.join('；');
      }
    } else if (gid === 'mapse') {
      // —— MAPSE ——
      if (valid(v.mapse)) {
        const r = calc.mapseIndex(v.mapse);
        out = 'MAPSE ' + calc.fmt(v.mapse, 0) + ' mm → ' + r.text;
      }
    } else if (gid === 'dvi') {
      // —— 无量纲指数 DVI ——
      if (valid(v.dlvti, v.davti)) {
        const r = calc.dviIndex(v.dlvti, v.davti);
        out = r.error ? r.error : 'DVI = ' + calc.fmt(r.dvi, 2) + ' → ' + r.text;
      }
    } else if (gid === 'tei') {
      // —— Tei 指数 MPI ——
      if (valid(v.ivct, v.ivrt, v.et)) {
        const side = v.tside === 2 ? 'rv' : 'lv';
        const r = calc.teiIndex(v.ivct, v.ivrt, v.et, side);
        out = 'MPI = ' + calc.fmt(r.mpi, 2) + '（' + (side === 'rv' ? '右室' : '左室') +
          ' 上限 ' + calc.fmt(r.cut, 2) + '）→ ' + r.text;
      }
    } else if (gid === 'mpap') {
      // —— 平均肺动脉压 ——
      if (valid(v.prv, v.mrap)) {
        const r = calc.mpap(v.prv, v.mrap);
        out = 'mPAP ≈ ' + calc.fmt(r.mpap, 1) + ' mmHg → ' + r.text;
      }
    } else if (gid === 'ctrcd') {
      // —— CTRCD 监测 ——
      const r = calc.ctrcd({
        g0: v.g0, g1: v.g1, ef0: v.ef0, ef1: v.ef1,
      });
      const parts = [];
      if (r.relDrop !== undefined) {
        parts.push('GLS 相对下降 ' + calc.fmt(r.relDrop, 1) + '%');
      }
      if (r.efDrop !== undefined && r.efDrop !== 0) {
        parts.push('EF 变化 ' + calc.fmt(-r.efDrop, 1) + ' 个百分点');
      }
      if (r.text) parts.push('→ ' + r.text);
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
      // —— 左室充盈压（原独立条目已并入本组）——
      const f = calc.lvFilling({
        e: v.dge === undefined ? null : v.dge,
        a: v.dga === undefined ? null : v.dga,
        es: v.dges === undefined ? null : v.dges,
        el: v.dgel === undefined ? null : v.dgel,
        lavi: v.dglavi === undefined ? null : v.dglavi,
        trv: v.dgtrv === undefined ? null : v.dgtrv,
      });
      if (f.ea !== undefined) parts.push('E/A ' + calc.fmt(f.ea));
      if (f.avgEe !== undefined) parts.push('平均 E/e′ ' + calc.fmt(f.avgEe));
      if (f.count > 0) parts.push('充盈压升高指标 ' + f.count + ' 项（' + f.crit.join('、') + '）');
      else if (v.dglavi !== undefined || v.dgtrv !== undefined) {
        parts.push('充盈压升高指标 0 项');
      }
      if (f.text) parts.push('→ ' + f.text);
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
    } else if (gid === 'rcoupling') {
      // —— 右室-肺动脉耦联：TAPSE / PASP ——
      if (valid(v.tapse, v.paspv)) {
        const rc = calc.tapsePasp(v.tapse, v.paspv);
        out = 'TAPSE/PASP = ' + calc.fmt(rc.ratio, 2) + ' mm/mmHg · ' + rc.text;
      }
    } else if (gid === 'lf-lg') {
      // —— 主动脉瓣狭窄 LF-LG 判读 ——
      const r = calc.asLflg({
        lvef: v.lflgef, svi: v.lflgsvi, mpg: v.lflgmpg, ava: v.lflgava,
        dsvi: v.lflgdsvi, dava: v.lflgdava,
      });
      const parts = [];
      if (r.text) parts.push(r.text);
      if (r.flowReserve !== undefined) {
        parts.push('SV 增幅 ' + calc.fmt((r.flowReserve - 1) * 100, 1) + '%（' +
          (r.hasReserve ? '有收缩储备' : '无收缩储备') + '）');
      }
      if (r.dse) parts.push(r.dse);
      out = parts.join('；');
    } else if (gid === 'rvfail') {
      // —— 右室功能分级（ASE 六指标积分）+ 应变 ——
      const r = calc.rvFuncScore({
        rvbase: v.rvfbase, fac: v.rvffac, tapse: v.rvftapse,
        rvs: v.rvfs, rvef: v.rvfe,
      });
      const parts = [];
      if (r.n) {
        const bad = r.items.filter(function (i) { return i.bad; })
          .map(function (i) { return i.name; });
        parts.push(r.score + '/' + r.n + ' 项异常 → ' + r.text);
        if (bad.length) parts.push('异常项：' + bad.join('、'));
      }
      if (valid(v.rvfws)) {
        parts.push('RVFWS ' + calc.fmt(v.rvfws, 1) + '% · ' +
          (v.rvfws <= -20 ? '正常' : v.rvfws <= -15 ? '轻度减低' : '明显减低（预后不良）'));
      }
      out = parts.join('；');
    } else if (gid === 'cp-rm') {
      // —— 缩窄性心包炎 vs 限制型心肌病：呼吸变异 ——
      const r = calc.cpRm({
        mvex: v.cpmex, mvinsp: v.cpmix, tvex: v.cptex, tvinsp: v.cptix,
        medee: v.cpmee,
      });
      const parts = [];
      if (r.mvVar !== undefined) parts.push('二尖瓣 E 变异 ' + calc.fmt(Math.abs(r.mvVar), 1) + '%');
      if (r.tvVar !== undefined) parts.push('三尖瓣 E 变异 ' + calc.fmt(Math.abs(r.tvVar), 1) + '%');
      if (r.feats.length) parts.push(r.feats.join('、'));
      if (r.text) parts.push('→ ' + r.text);
      out = parts.join('；');
    } else if (gid === 'la-strain') {
      // —— 左房应变与 HFA-PEFF 三大类计分 ——
      const r = calc.hfaPeff({
        lavi: v.hplavi, lvmi: v.hplvmi, female: female, rwt: v.hprwt,
        ntp: v.hpntp, ee: v.hpee, trv: v.hptrv, lasr: v.hplasr, gls: v.hpgls,
      });
      const parts = [];
      if (r.n) {
        parts.push('形态学 ' + r.morph + ' 分' + (r.morphName ? '（' + r.morphName + '）' : ''));
        parts.push('标志物 ' + r.bio + ' 分' + (r.bioName ? '（' + r.bioName + '）' : ''));
        parts.push('功能 ' + r.func + ' 分' + (r.funcName ? '（' + r.funcName + '）' : ''));
        parts.push('合计 ' + r.total + '/6 → ' + r.text);
      }
      out = parts.join('；');
    } else if (gid === 'stress-echo') {
      // —— Duke 评分 + 收缩储备 ——
      const parts = [];
      const dk = calc.dukeScore({ time: v.dktime, stDev: v.dkst, angina: v.dkang });
      if (dk.score !== undefined) {
        parts.push('Duke ' + calc.fmt(dk.score, 1) + ' 分 · ' + dk.text);
      }
      if (valid(v.dkefr, v.dkefp)) {
        const d = v.dkefp - v.dkefr;
        parts.push('EF 变化 ' + (d >= 0 ? '+' : '') + calc.fmt(d, 1) + '% · ' +
          (d >= 5 ? '收缩储备正常' : '收缩储备不足（提示多支病变 / 预后不良）'));
      }
      out = parts.join('；');
    } else if (gid === 'tr-interv') {
      // —— TR 五级严重度 ——
      const g = calc.trGrade(v.treroa, v.trrvol);
      const parts = [];
      if (g.text) {
        parts.push('TR ' + g.text);
        if (g.byEroa !== g.byRvol) parts.push('EROA 与 RVol 不一致，取较重档');
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