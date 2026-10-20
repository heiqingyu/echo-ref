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
    opts: [],
    optsV: {},
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
      // 选项组（性别 / 心律 / 节段总数 …）：缺省取第一项，选择结果另存 optsV
      const opts = (g.opts || []).map(function (o) {
        return { k: o.k, n: o.n, list: o.list, v: cache[o.k] !== undefined ? cache[o.k] : o.list[0][0] };
      });
      const optsV = {};
      opts.forEach(function (o) { optsV[o.k] = o.v; });
      this.setData({
        gid: g.id,
        mode: 'calc',
        title: g.title,
        note: g.note,
        blocks: [],
        refs: [],
        inputs: inputs,
        opts: opts,
        optsV: optsV,
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

  /** 选项组（性别 / 心律 / 节段总数 …） */
  onOpt(e) {
    const d = e.currentTarget.dataset;
    const patch = {};
    patch['optsV.' + d.k] = d.v;
    this.setData(patch);
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
    const ov = this.data.optsV || {};
    Object.keys(ov).forEach(function (k) { if (ov[k] !== '') c[k] = ov[k]; });
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
    const ov = this.data.optsV || {};
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
      // —— shunt：Qp/Qs + 分级判读 ——
      if (valid(v.rd, v.rvti) && valid(v.ld, v.lvti)) {
        const qs = calc.strokeVolume(v.ld, v.lvti);
        const qp = calc.strokeVolume(v.rd, v.rvti);
        if (qs > 0) {
          const g = calc.shuntGrade(qp, qs);
          out = 'Qp/Qs = ' + calc.fmt(g.ratio) + ' · ' + g.text;
        }
      } else if (valid(v.rd, v.rvti)) {
        out = '还需填写 LVOT 直径与 VTI（体循环流量）才能算 Qp/Qs';
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
      // 肺动脉收缩压运动反应
      if (valid(v.dksp0, v.dksp1)) {
        const p = calc.paspStress({ rest: v.dksp0, peak: v.dksp1 });
        if (p.text) {
          parts.push('PASP ' + calc.fmt(v.dksp0, 0) + '→' + calc.fmt(v.dksp1, 0) +
            ' mmHg（Δ' + calc.fmt(p.delta, 0) + '）· ' + p.text);
        }
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
    } else if (gid === 'rv-strain') {
      // —— 右室应变与 RVFWS 细化 ——
      const r = calc.rvStrain({
        base: v.rvsb, mid: v.rvsm, apex: v.rvsa, sep: v.rvssep, pasp: v.rvspasp,
      });
      const parts = [];
      if (r.avg !== undefined) {
        parts.push('RVFWS ' + calc.fmt(r.avg, 1) + '% → ' + r.gradeText);
        parts.push(r.gradText);
      }
      if (r.rvgls !== undefined) {
        parts.push('RVGLS ' + calc.fmt(r.rvgls, 1) + '%' +
          (r.sepLower ? '（室间隔受累更重，提示双室受累）' : ''));
      }
      if (r.ratio !== undefined) {
        parts.push('RVFWS/PASP ' + calc.fmt(r.ratio, 2) + ' · ' + r.coupling);
      }
      // 右室收缩储备（低剂量多巴酚丁胺负荷）
      if (valid(v.rvr0, v.rvr1)) {
        const rs = calc.rvReserve({
          rest: v.rvr0, peak: v.rvr1,
          tapse0: v.rvt0, tapse1: v.rvt1,
          pasp0: v.rvspasp, pasp1: v.rvp1,
        });
        if (rs.text) {
          parts.push('收缩储备：RVFWS ' + calc.fmt(rs.rest, 1) + '%→' + calc.fmt(rs.peak, 1) +
            '%（Δ' + (rs.delta >= 0 ? '+' : '') + calc.fmt(rs.delta, 1) + '）· ' + rs.text);
        }
        if (rs.tapseDelta !== undefined) {
          parts.push('TAPSE ' + (rs.tapseDelta >= 0 ? '+' : '') + calc.fmt(rs.tapseDelta, 1) + ' mm（' +
            (rs.tapseChange >= 0 ? '+' : '') + calc.fmt(rs.tapseChange, 0) + '%）' +
            (rs.tapseOk ? ' · 支持储备保留' : ' · 未见明显增加'));
        }
        if (rs.couplingDelta !== undefined) {
          parts.push('负荷后耦联 ' + calc.fmt(rs.ratio0, 2) + '→' + calc.fmt(rs.ratio1, 2) +
            (rs.couplingDelta > 0 ? '（改善）' : rs.couplingDelta < 0 ? '（恶化）' : '（不变）'));
        }
        if (rs.afterloadOnly) {
          parts.push('注意：PASP 升 ' + calc.fmt(rs.dpasp, 0) + ' mmHg 而 RVFWS 未涨，更像后负荷效应而非储备耗竭');
        }
      }
      out = parts.join('；');
    } else if (gid === 'rcm-strain') {
      // —— 限制型心肌病 vs 淀粉样变：心尖保留比值 ——
      const r = calc.rcmStrain({
        base: v.rcmb, mid: v.rcmm, apex: v.rcma,
        endo: v.rcmendo, epi: v.rcmepi,
      });
      const parts = [];
      if (r.rar !== undefined) {
        parts.push('RAR ' + calc.fmt(r.rar, 2) + '（GLS ' + calc.fmt(-r.gls, 1) + '%）→ ' + r.text);
      }
      if (r.transGrad !== undefined) {
        parts.push('心内膜/心外膜 ' + calc.fmt(r.transGrad, 2) +
          (r.gradLost ? ' · 梯度消失（支持浸润性病变）' : ' · 梯度保留'));
      }
      out = parts.join('；');
    } else if (gid === 'shd') {
      // —— 先心病分流：Qp/Qs 分级 ——
      if (valid(v.shqp, v.shqs)) {
        const r = calc.shuntGrade(v.shqp, v.shqs);
        out = r.text ? 'Qp/Qs = ' + calc.fmt(r.ratio) + ' · ' + r.text : '';
      }
    } else if (gid === 'pht-rev') {
      // —— 分流性肺高压的可手术性 ——
      const parts = [];
      if (valid(v.pvrv)) {
        const pvr = v.pvrv;
        const qp = valid(v.pvrqp) ? v.pvrqp : null;
        if (qp !== null && qp < 1.0) {
          parts.push('Qp/Qs ' + calc.fmt(qp) + '：净右向左分流，倾向禁忌关闭');
        }
        if (pvr > 8) parts.push('PVR ' + calc.fmt(pvr) + ' WU：多属不可逆，禁忌关闭');
        else if (pvr >= 5) parts.push('PVR ' + calc.fmt(pvr) + ' WU：灰区，需急性血管反应试验或靶向治疗后复评');
        else parts.push('PVR ' + calc.fmt(pvr) + ' WU：阻力尚可，可考虑关闭');
      }
      if (valid(v.pvrvi)) {
        parts.push('PVRI ' + calc.fmt(v.pvrvi) + ' WU·m² · ' +
          (v.pvrvi > 8 ? '显著升高' : v.pvrvi >= 6 ? '灰区' : '可接受'));
      }
      out = parts.join('；');
    } else if (gid === 'tof-pr') {
      // —— 法洛四联症术后 PR：严重度 + PVR 指征 ——
      const r = calc.tofPr({
        pridx: v.pridx, prw: v.prw,
        rvedvi: v.rvedvi, rvesvi: v.rvesvi, rvef: v.rvef, rvotpg: v.rvotpg,
      });
      const parts = [];
      if (r.severityText) {
        parts.push(r.severityText + (r.discordant ? '（PR 指数与宽度比不一致，取较重档）' : ''));
      }
      if (r.pvrIndication) {
        parts.push('已达 PVR 评估指征');
      } else if (r.rvesvi !== undefined || r.rvedvi !== undefined || r.rvef !== undefined) {
        parts.push('尚未达 PVR 容量阈值');
      }
      if (r.notes && r.notes.length) parts.push(r.notes.join('；'));
      out = parts.join('；');
    } else if (gid === 'ebstein') {
      // —— Ebstein：三尖瓣隔瓣下移指数 ——
      if (valid(v.ebdisp, v.ebbsa)) {
        const r = calc.ebsteinIndex(v.ebdisp, v.ebbsa);
        out = '下移指数 ' + calc.fmt(r.index, 1) + ' mm/m²（' + calc.fmt(r.disp, 1) + ' mm ÷ ' +
          calc.fmt(r.bsa, 2) + ' m²）· ' + r.text;
      }
    } else if (gid === 'mustard') {
      // —— Mustard / Senning：两套挡板压差 ——
      const baffle = function (x) {
        if (x > 8) return '狭窄明显，建议干预评估';
        if (x > 4) return '有血流动力学意义的狭窄';
        return '可接受';
      };
      const parts = [];
      if (valid(v.mvsvc)) parts.push('体静脉挡板 ' + calc.fmt(v.mvsvc, 1) + ' mmHg · ' + baffle(v.mvsvc));
      if (valid(v.mvpv)) parts.push('肺静脉挡板 ' + calc.fmt(v.mvpv, 1) + ' mmHg · ' + baffle(v.mvpv));
      out = parts.join('；');
    } else if (gid === 'fontan') {
      // —— Fontan：管道压差 + 开窗宽度 ——
      const parts = [];
      if (valid(v.fnpg)) {
        const g = v.fnpg;
        parts.push('管道压差 ' + calc.fmt(g, 1) + ' mmHg · ' +
          (g > 4 ? '明显梗阻，需进一步评估' : g > 2 ? '轻度升高，密切随访' : '通畅'));
      }
      if (valid(v.fnfen)) {
        const w = v.fnfen;
        parts.push('开窗 ' + calc.fmt(w, 1) + ' mm' +
          (w < 3 ? '（偏小，注意是否已闭合）'
            : w > 6 ? '（偏大，注意右向左分流量）' : '（常规范围 3–6 mm）'));
      }
      out = parts.join('；');
    } else if (gid === 'lvad') {
      // —— LVAD：出血道 SV/CO + 泵速判读 ——
      const r = calc.lvadEcho({
        d: v.lvadd, vti: v.lvadvti, hr: v.lvadhr,
        lvedd: v.lvadlv, avOpen: v.lvadav, tapse: v.lvadtp,
      });
      const parts = [];
      if (r.sv !== undefined) {
        parts.push('出血道 SV ' + calc.fmt(r.sv, 1) + ' mL');
        if (r.co !== undefined) parts.push('CO ' + calc.fmt(r.co) + ' L/min');
      }
      if (r.notes && r.notes.length) parts.push(r.notes.join('；'));
      out = parts.join('；');
    } else if (gid === 'paspv') {
      // —— 肺动脉收缩压 PASP ——
      if (valid(v.ptrv, v.prap)) {
        const val = calc.pasp(v.ptrv, v.prap);
        out = 'PASP ≈ ' + calc.fmt(val, 1) + ' mmHg（4×' + calc.fmt(v.ptrv, 2) +
          '² + ' + calc.fmt(v.prap, 0) + '）→ ' + calc.paspGrade(val).text;
      }
    } else if (gid === 'rapv') {
      // —— 右房压（IVC 法）——
      const r = calc.rapEstimate(v.rivc, this.data.collapseV);
      if (r.rap !== undefined) {
        out = 'RAP ≈ ' + r.rap + ' mmHg · IVC ' + calc.fmt(r.ivc, 0) + ' mm · ' + r.text;
      }
    } else if (gid === 'rvfacv') {
      // —— 右室面积变化分数 ——
      if (valid(v.feda, v.fesa)) {
        if (v.fesa >= v.feda) out = 'RVESA 不可大于或等于 RVEDA，请核对';
        else {
          const f = calc.fac(v.feda, v.fesa);
          out = 'FAC ' + calc.fmt(f, 1) + '% · ' +
            (f >= 35 ? '正常（≥35%）' : f >= 25 ? '轻度减低（25–35%）' : '明显减低（<25%）');
        }
      }
    } else if (gid === 'rcratiov') {
      // —— TAPSE/PASP 耦联比 ——
      if (valid(v.ctapse, v.cpasp)) {
        const r = calc.tapsePasp(v.ctapse, v.cpasp);
        out = 'TAPSE/PASP = ' + calc.fmt(r.ratio, 2) + ' mm/mmHg · ' + r.text;
      }
    } else if (gid === 'pvrv') {
      // —— 肺血管阻力 PVR ——
      const r = calc.pvrResistance(v.hmmpap, v.hmpawp, v.hmco);
      if (r.error) out = r.error;
      else if (r.wu !== undefined) {
        out = 'PVR ' + calc.fmt(r.wu) + ' WU（' + calc.fmt(r.dyn, 0) +
          ' dyn·s·cm⁻⁵，跨瓣压差 ' + calc.fmt(r.grad, 1) + ' mmHg）· ' + r.text;
      }
    } else if (gid === 'svrv') {
      // —— 体循环血管阻力 SVR ——
      const r = calc.svrResistance(v.smap, v.srap, v.sco, bsa);
      if (r.dyn !== undefined) {
        const parts = ['SVR ' + calc.fmt(r.dyn, 0) + ' dyn·s·cm⁻⁵'];
        if (r.svri !== undefined) parts.push('SVRI ' + calc.fmt(r.svri, 0));
        parts.push('· ' + r.text);
        out = parts.join('；');
      }
    } else if (gid === 'pisav') {
      // —— PISA 反流定量 ——
      if (valid(v.prad, v.pvmax)) {
        const alias = valid(v.palias) ? v.palias : 40;
        const r = calc.pisa(v.prad, alias, v.pvmax, valid(v.pvti) ? v.pvti : undefined);
        const ge = calc.gradeEroa(r.eroa);
        const parts = ['流量 ' + calc.fmt(r.flow, 1) + ' mL/s', 'EROA ' + calc.fmt(r.eroa, 2) + ' cm²'];
        let worst = ge.text;
        if (r.rvol !== undefined) {
          parts.push('RVol ' + calc.fmt(r.rvol, 0) + ' mL');
          const gr = calc.gradeRvol(r.rvol);
          if (gr.level === 'severe') worst = '重度反流';
          else if (gr.level === 'moderate' && ge.level !== 'severe') worst = '中度反流';
        }
        parts.push('→ ' + worst);
        out = parts.join('；');
      }
    } else if (gid === 'avav') {
      // —— 主动脉瓣面积（连续性方程）——
      if (valid(v.ald, v.alvti, v.aavti)) {
        const sv = calc.strokeVolume(v.ald, v.alvti);
        const ava = calc.avaContinuity(sv, v.aavti);
        const g = calc.gradeAva(ava);
        const parts = ['SV ' + calc.fmt(sv, 1) + ' mL', 'AVA ' + calc.fmt(ava, 2) + ' cm²（' + g.text + '）'];
        if (bsa > 0) {
          const idx = ava / bsa;
          parts.push('AVAi ' + calc.fmt(idx, 2) + ' cm²/m²' + (idx <= 0.6 ? '（≤0.6 支持重度）' : ''));
        }
        const dvi = calc.dviIndex(v.alvti, v.aavti);
        if (!dvi.error) parts.push('DVI ' + calc.fmt(dvi.dvi, 2));
        out = parts.join('；');
      }
    } else if (gid === 'mvav') {
      // —— 二尖瓣面积（PHT 法 / 连续方程）——
      const parts = [];
      if (valid(v.mpht)) {
        const mva = calc.mvaPht(v.mpht);
        parts.push('MVA ' + calc.fmt(mva, 2) + ' cm²（PHT 法）→ ' + calc.gradeMva(mva).text);
      }
      if (valid(v.msv, v.mvvti)) {
        const m2 = calc.mvaContinuity(v.msv, v.mvvti);
        parts.push('MVA ' + calc.fmt(m2, 2) + ' cm²（连续方程）→ ' + calc.gradeMva(m2).text);
      }
      out = parts.join('；');
    } else if (gid === 'ppm') {
      // —— 人工瓣 EOAi 与 PPM ——
      const r = calc.eoaPpm(v.peoa, bsa, v.ppos);
      if (r.eoai !== undefined) {
        out = 'EOAi ' + calc.fmt(r.eoai, 2) + ' cm²/m²（' +
          (r.pos === 'av' ? '主动脉位' : '二尖瓣位') + '）→ ' + r.text;
      } else if (valid(v.peoa) && bsa <= 0) {
        out = '需先在「EF·参考值」页填写身高体重（BSA 为 0 时无法算 EOAi）';
      }
    } else if (gid === 'dfun') {
      // —— 舒张功能分级（四步法）——
      const f = calc.lvFilling({
        e: v.dfe === undefined ? null : v.dfe,
        a: v.dfa === undefined ? null : v.dfa,
        es: v.dfes === undefined ? null : v.dfes,
        el: v.dfel === undefined ? null : v.dfel,
        lavi: v.dflavi === undefined ? null : v.dflavi,
        trv: v.dftrv === undefined ? null : v.dftrv,
      });
      const parts = [];
      if (f.ea !== undefined) parts.push('E/A ' + calc.fmt(f.ea));
      if (f.avgEe !== undefined) parts.push('平均 E/e′ ' + calc.fmt(f.avgEe));
      if (f.count > 0) parts.push('升高指标 ' + f.count + ' 项（' + f.crit.join('、') + '）');
      else parts.push('升高指标 0 项');
      if (f.text) parts.push('→ ' + f.text);
      out = parts.join('；');
    } else if (gid === 'volidx') {
      // —— 容积指数与重构分级 ——
      const r = calc.volumeIndices(v.vedv, v.vesv, bsa, female);
      if (r.error) out = r.error;
      else if (r.sv !== undefined) {
        const parts = ['EF ' + calc.fmt(r.ef, 1) + '%', 'SV ' + calc.fmt(r.sv, 1) + ' mL'];
        if (r.edvi !== undefined) {
          parts.push('EDVi ' + calc.fmt(r.edvi, 1) + '（' + r.edviText + '）');
          parts.push('ESVi ' + calc.fmt(r.esvi, 1) + '（' + r.esviText + '）');
          parts.push('SVi ' + calc.fmt(r.svi, 1));
        } else {
          parts.push('填身高体重后给出 EDVi / ESVi（上限 ' + (female ? '女 61 / 24' : '男 74 / 31') + '）');
        }
        if (r.notes && r.notes.length) parts.push(r.notes.join('；'));
        out = parts.join('；');
      }
    } else if (gid === 'rwsv') {
      // —— 相对室壁应力 ——
      if (valid(v.rsbp, v.rlvedd, v.rpwt)) {
        const r = calc.relativeWallStress(v.rsbp, v.rlvedd, v.rpwt);
        out = 'RWS ' + calc.fmt(r.rws, 0) + ' ×10³ dyn/cm² · ' + r.text;
      }
    } else if (gid === 'spher') {
      // —— 左室球形指数 ——
      if (valid(v.sdd, v.sld)) {
        const r = calc.sphericityIndex(v.sdd, v.sld);
        out = r.error ? r.error : 'SI ' + calc.fmt(r.si, 2) + '（' + calc.fmt(v.sdd, 2) +
          ' ÷ ' + calc.fmt(v.sld, 2) + '）· ' + r.text;
      }
    } else if (gid === 'lastrain') {
      // —— 左房应变三值 ——
      const r = calc.laStrainTri(v.lsr, v.lscd, v.lsct);
      const parts = [];
      if (r.sr !== undefined) parts.push('LASr ' + calc.fmt(r.sr, 1) + '% · ' + r.srText);
      if (r.scd !== undefined) parts.push('LAScd ' + calc.fmt(r.scd, 1) + '% · ' + r.scdText);
      if (r.sct !== undefined) parts.push('LASct ' + calc.fmt(r.sct, 1) + '% · ' + r.sctText);
      if (r.consistent !== undefined) {
        parts.push(r.consistent
          ? '三值自洽（LAScd+|LASct| 偏差 ' + calc.fmt(r.diff, 1) + '）'
          : '偏差 ' + calc.fmt(r.diff, 1) + '：LASr 与 LAScd+|LASct| 不符，检查勾画与时相');
      }
      out = parts.join('；');
    } else if (gid === 'aortaidx') {
      // —— 升主动脉直径指数 ——
      const r = calc.aortaIndex(v.aodim, bsa, female);
      if (r.index !== undefined) {
        out = '内径 ' + calc.fmt(r.cm, 1) + ' cm · 指数 ' + calc.fmt(r.index, 2) +
          ' cm/m² → ' + r.text + '；' + r.absText;
      } else if (valid(v.aodim) && bsa <= 0) {
        out = '需先在「EF·参考值」页填写身高体重（BSA 为 0 时无法算指数）';
      }
    } else if (gid === 'mdsv') {
      // —— 应变离散度 MDS ——
      const r = calc.strainDispersion([v.mds1, v.mds2, v.mds3, v.mds4, v.mds5, v.mds6]);
      if (r.n) {
        out = '均值 ' + calc.fmt(r.mean, 1) + '% · SD ' + calc.fmt(r.sd, 1) +
          '%（范围 ' + calc.fmt(r.min, 1) + '–' + calc.fmt(r.max, 1) + '，n=' + r.n + '）· ' + r.text;
      }
    } else if (gid === 'swv') {
      // —— 每搏功 / 功指数 ——
      if (valid(v.ssv, v.wmap)) {
        const r = calc.strokeWork(v.ssv, v.wmap, bsa);
        const parts = ['SW ' + calc.fmt(r.sw, 1) + ' g·m'];
        if (r.swi !== undefined) parts.push('SWi ' + calc.fmt(r.swi, 1) + ' g·m/m²');
        parts.push('· ' + r.text);
        out = parts.join('；');
      }
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
    } else if (gid === 'mtype') {
      // —— M 型三合一：FS / Teichholz EF / EPSS ——
      const r = calc.mModeTriple(v.mtdd, v.mtds, v.mtepss);
      if (r.error) out = r.error;
      else {
        const parts = [
          'FS ' + calc.fmt(r.fs, 1) + '% · ' + r.fsText,
          'Teichholz EDV ' + calc.fmt(r.edv, 1) + ' mL / ESV ' + calc.fmt(r.esv, 1) +
            ' mL / EF ' + calc.fmt(r.ef, 1) + '% · ' + r.efText,
        ];
        if (r.epss !== undefined) parts.push(r.epssText);
        if (r.mismatch) parts.push(r.mismatch);
        out = parts.join('；');
      }
    } else if (gid === 'wmsi') {
      // —— WMSI 室壁运动积分 ——
      const r = calc.wmsiIndex([v.wn1, v.wn2, v.wn3, v.wn4, v.wn5]);
      const want = parseInt(ov.wseg || '17', 10);
      if (r.error) out = r.error;
      else {
        const parts = ['WMSI = ' + calc.fmt(r.wmsi, 2) + '（' + r.total + ' 节段，总分 ' + r.score + '）'];
        if (r.total !== want) {
          parts.push('注意：录入节段数 ' + r.total + ' 与所选的 ' + want + ' 节段不一致，请补齐未填的分值');
        }
        parts.push(r.text);
        out = parts.join('；');
      }
    } else if (gid === 'h2fpef') {
      // —— H2FPEF 评分 ——
      if (valid(v.hbmi, v.hage, v.hee, v.hpasp)) {
        const r = calc.h2fpefScore({
          bmi: v.hbmi, age: v.hage, ee: v.hee, pasp: v.hpasp,
          af: ov.haf === '1', bpMeds: ov.hbp === '1' ? 2 : 1,
        });
        const parts = ['H2FPEF ' + r.score + ' 分 · ' + r.text];
        if (r.items.length) {
          parts.push('计分项：' + r.items.map(function (it) {
            return it[0] + ' +' + it[1];
          }).join('、'));
        }
        out = parts.join('；');
      }
    } else if (gid === 'hfapeff') {
      // —— HFA-PEFF 评分 ——
      if (valid(v.hlavi) || valid(v.hee2) || valid(v.hbnp)) {
        const r = calc.hfaPeffScore({
          female: ov.hsex === 'f', af: ov.haf2 === '1',
          lavi: v.hlavi, lvmi: v.hlvmi, rwt: v.hrwt, pasp: v.hpasp2,
          ee: v.hee2, es: v.hes, el: v.hel, trv: v.htrv,
          gls: v.hgls, ntprobnp: v.hbnp,
        });
        out = 'HFA-PEFF ' + r.score + ' 分（形态 ' + r.structural +
          ' + 功能 ' + r.functional + ' + 标志物 ' + r.biomarker + '）· ' + r.text;
      }
    } else if (gid === 'tavrsz') {
      // —— TAVR 瓣环与 oversizing ——
      const r = calc.tavrSizing(v.tcirc, v.tarea, v.tnom);
      if (r.error) out = r.error;
      else {
        const parts = [];
        if (r.dc !== undefined) parts.push('周长导出直径 ' + calc.fmt(r.dc, 1) + ' mm');
        if (r.da !== undefined) parts.push('面积导出直径 ' + calc.fmt(r.da, 1) + ' mm');
        if (r.areaOver !== undefined) {
          parts.push('面积 oversizing ' + calc.fmt(r.areaOver, 1) + '%');
          if (r.circOver !== undefined) parts.push('周长 oversizing ' + calc.fmt(r.circOver, 1) + '%');
          parts.push(r.text);
        } else if (r.hint) parts.push(r.hint);
        out = parts.join('；');
      }
    } else if (gid === 'laasz') {
      // —— 左心耳封堵尺寸 ——
      const r = calc.laaSize(v.lzmax, v.lzmin, v.lzdepth);
      if (r.error) out = r.error;
      else {
        const parts = [];
        if (r.ratio !== undefined) parts.push('长短径比 ' + calc.fmt(r.ratio, 2));
        parts.push(r.text);
        if (r.shapeText) parts.push(r.shapeText);
        if (r.depthWarn) parts.push(r.depthWarn);
        out = parts.join('；');
      }
    } else if (gid === 'rvvol') {
      // —— 右室容积指数 ——
      if (valid(v.rvedv)) {
        const r = calc.rvVolumeIndex(v.rvedv, v.rvesv, bsa, female);
        if (r.error) out = r.error;
        else {
          const parts = ['RVEDVi ' + calc.fmt(r.edvi, 1) + ' mL/m² · ' + r.edvText];
          if (r.esvi !== undefined) {
            parts.push('RVESVi ' + calc.fmt(r.esvi, 1) + ' mL/m² · ' + r.esvText);
          }
          out = parts.join('；');
        }
      }
    } else if (gid === 'rvfws') {
      // —— 右室游离壁应变 ——
      if (valid(v.rfb) || valid(v.rfm) || valid(v.rfa)) {
        const r = calc.rvFreeWallStrain(v.rfb, v.rfm, v.rfa);
        if (r.error) out = r.error;
        else out = 'RVFWS 均值 ' + calc.fmt(r.mean, 1) + '%（' + r.n + ' 段）· ' + r.text;
      }
    } else if (gid === 'papi') {
      // —— 肺动脉搏动指数 ——
      if (valid(v.pispap, v.pidpap, v.pirap)) {
        const r = calc.pulmonaryPulseIndex(v.pispap, v.pidpap, v.pirap);
        out = r.error ? r.error : 'PAPi = ' + calc.fmt(r.papi, 2) + ' · ' + r.text;
      }
    } else if (gid === 'pdap') {
      // —— 舒张期肺动脉压 ——
      if (valid(v.pdprv)) {
        const r = calc.pulmonaryDiastolicPressure(v.pdprv, v.pdrap);
        out = r.error ? r.error
          : 'PADP ≈ ' + calc.fmt(r.padp, 1) + ' mmHg（压差 ' + calc.fmt(r.grad, 1) + ' + RAP）';
      }
    } else if (gid === 'residx') {
      // —— 阻力指数 ——
      if (valid(v.ripvr) || valid(v.risvr)) {
        const r = calc.resistanceIndices(v.ripvr, v.risvr, bsa);
        if (r.error) out = r.error;
        else {
          const parts = [];
          if (r.pvri !== undefined) parts.push('PVRI ' + calc.fmt(r.pvri, 1) + ' WU·m² · ' + r.pvriText);
          if (r.svri !== undefined) parts.push('SVRI ' + calc.fmt(r.svri, 0) + ' · ' + r.svriText);
          out = parts.join('；');
        }
      }
    } else if (gid === 'rvdvdt') {
      // —— 右室 dP/dt ——
      if (valid(v.rdt)) {
        const r = calc.rvDpDt(v.rdt);
        out = r.error ? r.error : 'RV dP/dt ≈ ' + calc.fmt(r.dpdt, 0) + ' mmHg/s · ' + r.text;
      }
    } else if (gid === 'wilkins') {
      // —— Wilkins 形态评分 ——
      if (valid(v.wk1) || valid(v.wk2) || valid(v.wk3) || valid(v.wk4)) {
        const r = calc.wilkinsScore(v.wk1, v.wk2, v.wk3, v.wk4);
        out = r.error ? r.error
          : 'Wilkins 总分 ' + r.total + ' / 16 · ' + r.text;
      }
    } else if (gid === 'vcw') {
      // —— 缩流颈宽度 ——
      if (valid(v.vcwv)) {
        const r = calc.vcwGrade(v.vcwv, ov.vsite || 'mr');
        out = r.error ? r.error : r.text;
      }
    } else if (gid === 'rf') {
      // —— 反流分数 ——
      if (valid(v.rfvol, v.rfsv)) {
        const r = calc.regurgFraction(v.rfvol, v.rfsv);
        out = r.error ? r.error : 'RF = ' + calc.fmt(r.rf, 1) + '% · ' + r.text;
      }
    } else if (gid === 'mvac') {
      // —— MVA 连续性方程 ——
      if (valid(v.mvd, v.mvlvti, v.mvmvti)) {
        const sv = calc.strokeVolume(v.mvd, v.mvlvti);
        const mva = calc.mvaContinuity(sv, v.mvmvti);
        const g = calc.gradeMva(mva);
        out = 'SV ' + calc.fmt(sv, 1) + ' mL · MVA ' + calc.fmt(mva) + ' cm² · ' + g.text;
      }
    } else if (gid === 'laef') {
      // —— 左房排空分数 ——
      if (valid(v.lavmax, v.lavmin)) {
        const r = calc.laEmptying(v.lavmax, v.lavmin);
        out = r.error ? r.error
          : 'LAEF ' + calc.fmt(r.laef, 1) + '% · 扩张指数 ' + calc.fmt(r.expand, 1) + '% · ' + r.text;
      }
    } else if (gid === 'quickratio') {
      // —— LA/Ao · RV/LV ——
      if (valid(v.qla, v.qao) || valid(v.qrv, v.qlv)) {
        const r = calc.quickRatios(v.qla, v.qao, v.qrv, v.qlv);
        if (r.error) out = r.error;
        else {
          const parts = [];
          if (r.laAo !== undefined) parts.push('LA/Ao = ' + calc.fmt(r.laAo) + ' · ' + r.laAoText);
          if (r.rvLv !== undefined) parts.push('RV/LV = ' + calc.fmt(r.rvLv) + ' · ' + r.rvLvText);
          out = parts.join('；');
        }
      }
    } else if (gid === 'lvmih') {
      // —— LVMI 身高^2.7 ——
      if (valid(v.lhmass, v.lhheight)) {
        const r = calc.lvmHeightIndex(v.lhmass, v.lhheight, female);
        out = r.error ? r.error
          : 'LVMI ' + calc.fmt(r.index, 1) + ' g/m^2.7 · ' + r.text;
      }
    } else if (gid === 'paidx') {
      // —— McGoon / Nakata ——
      if (valid(v.prpa, v.plpa)) {
        const r = calc.paIndex(v.prpa, v.plpa, v.pdao, bsa);
        if (r.error) out = r.error;
        else {
          const parts = [];
          if (r.mcgoon !== undefined) parts.push('McGoon ' + calc.fmt(r.mcgoon) + ' · ' + r.mcgoonText);
          if (r.nakata !== undefined) parts.push('Nakata ' + calc.fmt(r.nakata, 0) + ' mm²/m² · ' + r.nakataText);
          out = parts.join('；');
        }
      }
    } else if (gid === 'ras') {
      // —— 心尖保留比值 ——
      if (valid(v.rasap, v.rasba)) {
        const r = calc.apicalSparing(v.rasap, v.rasba);
        out = r.error ? r.error : 'RAS = ' + calc.fmt(r.ras) + ' · ' + r.text;
      }
    } else if (gid === 'ea') {
      // —— Ea / Ees-Ea ——
      if (valid(v.eaesp, v.easv, v.eaesv)) {
        const r = calc.ventriculoArterial(v.eaesp, v.easv, v.eaesv);
        if (r.error) out = r.error;
        else {
          out = 'Ea ' + calc.fmt(r.ea) + ' mmHg/mL · Ees(单点) ' + calc.fmt(r.ees, 2) +
            ' · Ees/Ea ' + calc.fmt(r.ratio) + ' · ' + r.text;
        }
      }
    } else if (gid === 'coa') {
      // —— 主动脉缩窄 ——
      if (valid(v.coav)) {
        const r = calc.coarctationEcho(v.coav, v.coaved);
        if (r.error) out = r.error;
        else {
          const parts = ['峰值压差 ' + calc.fmt(r.grad, 0) + ' mmHg · ' + r.text];
          if (r.continuum) parts.push(r.continuum);
          out = parts.join('；');
        }
      }
    } else if (gid === 'aortaz') {
      // —— 主动脉分节段 Z 值 ——
      if (valid(v.azann) || valid(v.azsin) || valid(v.azstj) || valid(v.azasc)) {
        const r = calc.aorticZscore(
          [v.azann, v.azsin, v.azstj, v.azasc], ov.azsex === 'f', bsa);
        if (r.error) out = r.error;
        else {
          const segTxt = r.segs.map(function (s) {
            return s.sn + ' Z ' + calc.fmt(s.z, 1) + '（参考 ' + s.lo + '–' + s.hi + ' cm）';
          }).join(' / ');
          const parts = [segTxt, r.text];
          if (r.ascIndexText) parts.push(r.ascIndexText);
          out = parts.join('；');
        }
      }
    }

    this.setData({ out: out, hasOut: !!out });
  },
});