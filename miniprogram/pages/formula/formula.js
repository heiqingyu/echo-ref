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
const VC = require('../../utils/valve-calc.js');
const MD = require('../../utils/inline-md.js');
const CN = require('../../utils/calc-notes.js');
const app = getApp();

/** 在评估类内容里按 id 找条目 */
function findBrief(id) {
  for (let i = 0; i < EX.BRIEF_SECTIONS.length; i += 1) {
    const hit = EX.BRIEF_SECTIONS[i].items.filter(function (it) { return it.id === id; })[0];
    if (hit) return hit;
  }
  return null;
}

/**
 * valve-calc 的 rows → 一行文本：`k v（分级）`，用 · 连接
 * 评估页把「狭窄 / 反流」并进同一条目后，结果行按段拼接，段内统一用这个格式
 */
function rowsText(rows) {
  return (rows || []).map(function (r) {
    return r.k + ' ' + r.v + (r.tag ? '（' + r.tag + '）' : '');
  }).join(' · ');
}

/** blocks → 视图模型（表格列数由表头决定） */
function toBlocks(blocks) {
  let secIdx = -1;
  return (blocks || []).map(function (b) {
    if (b.kind === 'table') {
      // ★ 表格单元格也要拆行内标记：以前直接 {{c}} 输出，219 个格子会把
      //   字面量 ** 漏到屏幕上（用户 2026-10-22 第二次反馈）
      return {
        kind: 'table',
        heads: (b.heads || []).map(function (t) { return MD.parseInline(t); }),
        rows: (b.rows || []).map(function (r) {
          return (r || []).map(function (c) { return MD.parseInline(c); });
        }),
        cols: b.heads.length,
        warn: !!b.warn,
      };
    }
    const o = { kind: b.kind, text: b.text, warn: !!b.warn };
    // 行内标记：**加粗** 拆成片段，渲染时用 <text class="fx-b"> 包裹
    o.segs = MD.parseInline(b.text);
    // 小节标题带锚点序号，供小节导航跳转（id="sec-N"）
    if (b.kind === 'h') {
      secIdx += 1;
      o.secIdx = secIdx;
    }
    // 桥接块带的计算器 id → 标题，渲染成可点胶囊
    // 目标可能是计算器（GROUPS）也可能是评估条目（BRIEF_SECTIONS，如 mitral / aortic），
    // 两边都查一遍，否则评估条目会直接把英文 id 显示给用户
    if (b.links && b.links.length) {
      o.links = b.links.map(function (id) {
        const g = CG.groupOf(id);
        if (g) return { id: id, n: g.title };
        const bf = findBrief(id);
        return { id: id, n: (bf && bf.title) ? bf.title : id };
      });
    }
    return o;
  });
}

/**
 * 条目内小节导航
 *
 * 长条目（判读类）动辄几十屏，滚到中间就找不到北了。
 * 这里从 blocks 里抽出所有 kind:'h' 的小标题，做成一排胶囊，
 * 点一下直接滚到那一节（与目录页的组名跳转条同一套交互）。
 *
 * 只在有 2 个以上小节时才出，避免短条目多一行无用胶囊。
 */
function buildToc(blocks) {
  const hs = (blocks || []).filter(function (b) { return b.kind === 'h'; });
  if (hs.length < 2) return [];
  return hs.map(function (b, i) {
    return { id: 'sec-' + i, t: String(b.text || '').replace(/\*\*/g, '') };
  });
}

Page({
  data: {
    gid: '',
    mode: 'calc',
    title: '',
    note: '',
    noteSegs: [],
    blocks: [],
    refs: [],
    rels: [],
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
    toc: [],
    curSec: '',
  },

  onLoad(query) {
    const id = (query && query.id) || (CG.GROUPS[0] && CG.GROUPS[0].id);
    const brief = findBrief(id);

    if (brief) {
      const cache = (app.globalData.calcCache || {})[brief.id] || {};
      // ★ 字段里可以混入 { g: '① …' } 分段标题（评估页把「狭窄 / 反流」并进同一条目），
      //   渲染成小标题，后面的输入框归入该段
      const inputs = [];
      (brief.fields || []).forEach(function (f, i) {
        if (f.g) {
          inputs.push({ key: '__g' + i, head: f.g });
          return;
        }
        inputs.push({ key: f.k, name: f.n, unit: f.u, value: cache[f.k] || '' });
      });
      this.setData({
        gid: brief.id,
        mode: 'brief',
        title: brief.title,
        note: brief.note || '',
        noteSegs: MD.parseInline(brief.note || ''),
        blocks: toBlocks(brief.blocks),
        toc: buildToc(brief.blocks),
        refs: (brief.source || []).map(function (rid) {
          const r = EX.REFS.filter(function (x) { return x.id === rid; })[0];
          return r ? { id: r.id, zh: r.zh, where: r.where } : null;
        }).filter(Boolean),
        // 相关内容：条目间的交叉引用（同组或跨组），点一下换到那条
        rels: (brief.rel || []).map(function (rid) {
          const r = findBrief(rid);
          return r ? { id: r.id, t: r.title } : null;
        }).filter(Boolean),
        inputs: inputs,
        isReference: !(brief.fields && brief.fields.length),
        collapseV: cache.__collapse || '',
        signsV: cache.__signs || '',
      });
    } else {
      const g = CG.groupOf(id) || CG.GROUPS[0];
      const cache = (app.globalData.calcCache || {})[g.id] || {};
      // ★ v1.9.6：合并页（resist / rvsyst / lvgeom）的 fields 里混有 { g: '① …' } 分段标题。
      //   brief 分支早就转了 head，calc 分支漏转 → {g} 被当成普通字段，标签渲染成「 / 」，
      //   小节标题全丢（v1.8.3 起就存在）。
      const inputs = [];
      (g.fields || []).forEach(function (f, i) {
        if (f.g) {
          inputs.push({ key: '__g' + i, head: f.g });
          return;
        }
        inputs.push({ key: f.k, name: f.n, unit: f.u, value: cache[f.k] || '' });
      });
      // 选项组（性别 / 心律 / 节段总数 …）：缺省取第一项，选择结果另存 optsV
      // ★ 性别类按「EF·参考值」页录入的性别预填，避免每次都要手点
      const prof0 = app.globalData.profile || {};
      const opts = (g.opts || []).map(function (o) {
        if (cache[o.k] !== undefined) {
          return { k: o.k, n: o.n, list: o.list, v: cache[o.k] };
        }
        const isSex = o.list.some(function (c) { return c[0] === 'm' && c[1] === '男'; }) &&
          o.list.some(function (c) { return c[0] === 'f' && c[1] === '女'; });
        return {
          k: o.k, n: o.n, list: o.list,
          v: isSex ? (prof0.sex === 'female' ? 'f' : 'm') : o.list[0][0],
        };
      });
      const optsV = {};
      opts.forEach(function (o) { optsV[o.k] = o.v; });
      // 说明块（临床意义 / 参考标准 / 判读要点）放在最前，后面跟本条目自带的小节
      const calcBlocks = CN.notesBlocks(g.id).concat(g.blocks || []);
      this.setData({
        gid: g.id,
        mode: 'calc',
        title: g.title,
        note: g.note,
        noteSegs: MD.parseInline(g.note || ''),
        blocks: toBlocks(calcBlocks),
        toc: buildToc(calcBlocks),
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

  /** 相关内容胶囊：跳到另一条目（同目录页点击同一路径） */
  onRel(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/formula/formula?id=' + id });
  },

  /** 页尾「其他页面」：tabBar 页用 switchTab，其余用 navigateTo */
  onGo(e) {
    const p = e.currentTarget.dataset.go;
    if (!p) return;
    const url = '/pages/' + p + '/' + p;
    if (['index', 'pediatric', 'segments', 'calculators'].indexOf(p) !== -1) {
      wx.switchTab({ url: url });
    } else {
      wx.navigateTo({ url: url });
    }
  },

  onClear() {
    const inputs = this.data.inputs.map(function (r) {
      return Object.assign({}, r, { value: '' });
    });
    this.setData({ inputs: inputs, collapseV: '', signsV: '', out: '', hasOut: false });
    this.saveCache();
  },

  /** 点「相关计算」胶囊：跳到公式集里对应的计算器（性别 / BSA 由 profile 自动带入） */
  onJump(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset
      ? e.currentTarget.dataset.id : '';
    if (!id) return;
    wx.navigateTo({ url: '/pages/formula/formula?id=' + id });
  },

  /**
   * 点小节导航胶囊 → 滚到该小节
   * 用选择查询拿元素相对视口的位置 + 当前滚动量，算出目标 scrollTop
   * （与目录页 onJumpGroup 同一套算法：wx.pageScrollTo 的 selector 分支不稳）
   */
  onJumpSec(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset
      ? e.currentTarget.dataset.id : '';
    if (!id) return;
    this.setData({ curSec: id });
    const q = wx.createSelectorQuery().in(this);
    q.select('#' + id).boundingClientRect();
    q.selectViewport().scrollOffset();
    q.exec(function (res) {
      const rect = res && res[0];
      if (!rect) return;
      const cur = (res[1] && res[1].scrollTop) || 0;
      const top = Math.max(0, cur + rect.top - 8);
      wx.pageScrollTo({ scrollTop: top, duration: 220 });
    });
  },

  /** 把当前输入写回缓存 */
  saveCache() {
    if (!app.globalData.calcCache) app.globalData.calcCache = {};
    const c = {};
    this.data.inputs.forEach(function (r) {
      if (!r.head && r.value !== '') c[r.key] = r.value;
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
      if (r.head) return;
      const n = parseFloat(r.value);
      if (r.value !== '' && !isNaN(n)) v[r.key] = n;
    });

    const prof = app.globalData.profile || {};
    const bsa = prof.bsa || 0;
    const female = prof.sex === 'female';
    const ov = this.data.optsV || {};
    const valid = (...xs) => xs.every((x) => x !== undefined && isFinite(x));

    let out = '';
    const outsArr = [];   // ★ v1.8.3：合并页多行结果，每项 {l: 小节名, t: 结果文本}
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
      // —— 肺动脉压 · 肺高压评估：IVC→RAP，再出 sPAP / dPAP / mPAP 与可能性 ——
      const signs = this.data.signsV === '' ? null : this.data.signsV === 'yes';
      const r = calc.pulmonaryScreen({
        ivc: v.pp_ivc, collapse: this.data.collapseV, rap: v.pp_rap,
        trv: v.pp_tr, prv: v.pp_pr, rvotAt: v.pp_rvotat, signs: signs,
      });
      // 只有 RVOT AT / 征象、没有任何压力输入时不给压力结论，但仍报可能性
      const parts = [];
      if (r.hasResult) {
        parts.push(r.rapText);
        if (r.spap !== undefined) {
          parts.push('sPAP ' + calc.fmt(r.spap, 1) + ' mmHg（' + r.spapText + '）');
        }
        if (r.dpap !== undefined) {
          parts.push('dPAP ' + calc.fmt(r.dpap, 1) + ' mmHg');
        }
        if (r.mpap !== undefined) {
          parts.push('mPAP ' + calc.fmt(r.mpap, 1) + ' mmHg（' + r.mpapText +
            (r.mode === 'mahan' ? '，Mahan 近似' : '') + '）');
        }
      }
      if (valid(v.pp_tr) || valid(v.pp_rvotat) || signs === true) {
        parts.push('超声 PH 可能性 ' + r.prob + (r.atText ? '（' + r.atText + '）' : ''));
      }
      out = parts.join('；');
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
      // —— CRT 适应证分层（2021 ESC / 2022 AHA）——
      const r = calc.crtIndication({
        lvef: v.cr_lvef,
        qrs: v.cr_qrs,
        lbbb: v.cr_lbbb === 1,
        nyha: v.cr_nyha,
      });
      if (r.error) out = r.error;
      else {
        const parts = ['推荐 ' + r.grade, '依据 ' + r.why];
        out = parts.join('；') + '。机械不同步旁证见「心脏同步化」条目';
      }
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
      // ★ v1.8.4：耦联并入本条（原 rcoupling 条目已删除），PASP 直接用上面的 TR + RAP 结果
      if (valid(v.tapse)) {
        const paspVal = (valid(v.tr) && rap !== null) ? calc.pasp(v.tr, rap) : null;
        if (paspVal) {
          const rc = calc.tapsePasp(v.tapse, paspVal);
          parts.push('TAPSE/PASP ' + calc.fmt(rc.ratio, 2) + ' mm/mmHg（PASP ' +
            calc.fmt(paspVal, 0) + '）· ' + rc.text);
        } else {
          parts.push('TAPSE ' + calc.fmt(v.tapse, 1) + ' mm（再填 TR 峰速 + IVC 即可算 TAPSE/PASP 耦联）');
        }
      }
      out = parts.join('；');
    } else if (gid === 'rvfun') {
      // —— 右室功能：六指标积分 + 分段应变 + 收缩储备（v1.8.4 合并原 rvfail 与 rv-strain）——
      const parts = [];
      const r = calc.rvFuncScore({
        rvbase: v.rvfbase, fac: v.rvffac, tapse: v.rvftapse,
        rvs: v.rvfs, rvef: v.rvfe,
      });
      if (r.n) {
        const bad = r.items.filter(function (i) { return i.bad; })
          .map(function (i) { return i.name; });
        parts.push(r.score + '/' + r.n + ' 项异常 → ' + r.text);
        if (bad.length) parts.push('异常项：' + bad.join('、'));
      }
      // 应变：填了三段就用分段平均，否则用手填的 RVFWS，避免同一数值报两次
      const rs = calc.rvStrain({
        base: v.rvsb, mid: v.rvsm, apex: v.rvsa, sep: v.rvssep, pasp: v.rvfpasp,
      });
      const fws = (rs.avg !== undefined) ? rs.avg : v.rvfws;
      if (valid(fws)) {
        parts.push('RVFWS ' + calc.fmt(fws, 1) + '% · ' +
          (fws <= -20 ? '正常' : fws <= -15 ? '轻度减低' : fws <= -10 ? '中度减低' : '重度减低（预后不良）'));
      }
      if (rs.rvgls !== undefined) {
        parts.push('RVGLS ' + calc.fmt(rs.rvgls, 1) + '%' +
          (rs.sepLower ? '（室间隔受累更重，提示双室受累）' : ''));
      }
      // 反向梯度 / 心尖保留（ARVC 与慢性右室压力负荷的典型形态，v1.8.4 合并时补回）
      if (rs.gradText) parts.push(rs.gradText);
      if (rs.ratio !== undefined) {
        parts.push('RVFWS/PASP ' + calc.fmt(rs.ratio, 2) + ' · ' + rs.coupling);
      }
      // 右室收缩储备（低剂量多巴酚丁胺负荷）
      if (valid(v.rvr0, v.rvr1)) {
        const rr = calc.rvReserve({
          rest: v.rvr0, peak: v.rvr1,
          tapse0: v.rvt0, tapse1: v.rvt1,
          pasp0: v.rvfpasp, pasp1: v.rvp1,
        });
        if (rr.text) {
          parts.push('收缩储备：RVFWS ' + calc.fmt(rr.rest, 1) + '%→' + calc.fmt(rr.peak, 1) +
            '%（Δ' + (rr.delta >= 0 ? '+' : '') + calc.fmt(rr.delta, 1) + '）· ' + rr.text);
        }
        if (rr.tapseDelta !== undefined) {
          parts.push('TAPSE ' + (rr.tapseDelta >= 0 ? '+' : '') + calc.fmt(rr.tapseDelta, 1) + ' mm（' +
            (rr.tapseChange >= 0 ? '+' : '') + calc.fmt(rr.tapseChange, 0) + '%）' +
            (rr.tapseOk ? ' · 支持储备保留' : ' · 未见明显增加'));
        }
        if (rr.couplingDelta !== undefined) {
          parts.push('负荷后耦联 ' + calc.fmt(rr.ratio0, 2) + '→' + calc.fmt(rr.ratio1, 2) +
            (rr.couplingDelta > 0 ? '（改善）' : rr.couplingDelta < 0 ? '（恶化）' : '（不变）'));
        }
        if (rr.tRatioChange !== undefined) {
          parts.push('TAPSE/PASP ' + calc.fmt(rr.tRatio0, 2) + '→' + calc.fmt(rr.tRatio1, 2) +
            '（' + (rr.tRatioChange >= 0 ? '+' : '') + calc.fmt(rr.tRatioChange, 0) + '%）· ' + rr.tRatioText);
        }
        if (rr.afterloadOnly) {
          parts.push('注意：PASP 升 ' + calc.fmt(rr.dpasp, 0) + ' mmHg 而 RVFWS 未涨，更像后负荷效应而非储备耗竭');
        }
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
    } else if (gid === 'infiltr') {
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
    } else if (gid === 'asload') {
      // —— AS 负荷量化（ELI · Zva · SWL）——
      const sum = calc.asLoadSummary({
        vmax: v.alvmax, meanGrad: v.almean, eoa: v.alava,
        ascAo: v.alao, sbp: v.alsbp, sv: v.alsv, bsa: bsa,
      });
      const parts = [];
      if (sum.eli) parts.push(sum.eli.text);
      if (sum.zva) parts.push(sum.zva.text);
      if (sum.swl) parts.push(sum.swl.text);
      if (sum.pr) parts.push(sum.pr.text);
      if (parts.length) {
        out = parts.join('；');
        const notes = [];
        if (sum.eli) notes.push(sum.eli.note);
        if (sum.zva) notes.push(sum.zva.note);
        if (sum.swl) notes.push(sum.swl.note);
        if (notes.length) out += '｜' + notes.join('｜');
      } else {
        out = '请至少填写：EOA + 升主动脉直径（算 ELI）、收缩压 + 每搏量 + 身高体重（算 Zva）、平均压差（算 SWL）';
      }
    } else if (gid === 'pr') {
      // —— 压力恢复校正 ——
      const r = calc.pressureRecovery(v.prvmax, v.preoa, v.prao);
      if (r.error) {
        out = r.error;
      } else {
        out = r.text + '｜' + r.note;
      }
    } else if (gid === 'ppm') {
      // —— 人工瓣 EOAi 与 PPM（R17 / ASE 2024 切点，BMI≥30 时下调）——
      const r = calc.eoaPpm(v.peoa, bsa, v.ppos, v.pbmi);
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
      if (valid(v.dfvp) && valid(v.dfe)) {
        const ev = calc.evpRatio(v.dfe, v.dfvp);
        if (!ev.error) parts.push('E/Vp ' + calc.fmt(ev.ratio, 2) + '（' + ev.text + '）');
      }
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
      // —— 应变判读（R43 · ASE/EACVI 2025：正常 <−18%、灰区 −16~−18%、异常 >−16%）——
      const parts = [];
      if (valid(v.gls)) {
        let t;
        if (v.gls > -16) t = '异常（R43：绝对值 <16）';
        else if (v.gls > -18) t = '灰区（−16 ~ −18%，需合并其他异常）';
        else t = '正常（R43：＜ −18%）';
        parts.push('GLS ' + calc.fmt(v.gls, 1) + '% · ' + t);
      }
      if (valid(v.rvstrain)) {
        parts.push('右室游离壁应变 ' + calc.fmt(v.rvstrain, 1) + '% · ' +
          (v.rvstrain <= -20 ? '正常（男 ≤−20 / 女 ≤−21）' : '缩短减低'));
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
    } else if (gid === 'aortagrow') {
      // —— 主动脉扩张增长率 ——
      const r = calc.aorticGrowthRate(v.d1, v.d2, v.yrs);
      if (r.error) out = r.error;
      else out = r.text + '｜' + r.note;
    } else if (gid === 'pvfu') {
      // —— 人工瓣术后跨瓣血流 ——
      const r = calc.prostheticValveFunction({
        lvotD: v.lvotD, lvotVti: v.lvotVti, valveVti: v.valveVti,
        vmax: v.fupvmax, meanGrad: v.fupmean, bsa: bsa,
      });
      if (r.error) out = r.error;
      else out = r.text + '｜' + r.note;
    } else if (gid === 'cfr') {
      // —— 冠脉血流储备 ——
      const r = calc.coronaryFlowReserve(v.distal, v.proximal);
      if (r.error) out = r.error;
      else out = r.text + '｜' + r.note;
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
    } else if (gid === 'sync') {
      // —— 心脏同步化：机械不同步综合评估 ——
      const r = calc.mechDyssynchrony({
        spwmd: v.sy_spwmd,
        ivmd: v.sy_ivmd,
        tssd: v.sy_tssd,
        flash: ov.sy_flash === 'y',
        rock: ov.sy_rock === 'y',
      });
      if (r.text) out = r.detail + ' → ' + r.text;
    } else if (gid === 'wilkins') {
      // —— Wilkins 形态评分（独立计算器）——
      if (valid(v.wk1) || valid(v.wk2) || valid(v.wk3) || valid(v.wk4)) {
        const r = calc.wilkinsScore(v.wk1, v.wk2, v.wk3, v.wk4);
        if (r.error) out = r.error;
        else {
          const detail = r.items.map(function (it) {
            return it.n.replace('瓣叶', '') + ' ' + it.score;
          }).join(' · ');
          out = 'Wilkins ' + r.total + ' / 16（' + detail + '）；' + r.text + '；' + r.worstText;
        }
      }
    } else if (gid === 'tr') {
      // —— 瓣膜专用定量（v1.4.1 起进公式集，与瓣膜页共用 valve-calc 引擎）——
      //    ★ v1.4.4：AS / AR / MS / MR 四条已并入「主动脉瓣疾病评估」「二尖瓣疾病评估」，
      //      公式集里只剩 TR 还走这条分支；输入键带条目前缀（tr_radius），这里去前缀还原
      const vv = {};
      Object.keys(v).forEach(function (k) {
        if (k.indexOf('tr_') === 0) vv[k.slice(3)] = v[k];
      });
      const rv = VC.valveCalc('tr', vv, bsa);
      if (rv.rows && rv.rows.length) {
        out = rowsText(rv.rows) + '｜' + rv.summary;
      } else {
        out = '';
      }
    } else if (gid === 'mva') {
      // —— 二尖瓣面积：PHT + 连续方程同屏对照 ——
      const parts = [];
      const m = calc.mvaBoth(
        valid(v.mpht) ? v.mpht : null,
        valid(v.mvd) ? v.mvd : null,
        valid(v.mvlvti) ? v.mvlvti : null,
        valid(v.mvmvti) ? v.mvmvti : null
      );
      if (m.pht !== undefined) {
        parts.push('MVA ' + calc.fmt(m.pht, 2) + ' cm²（PHT 法）→ ' + m.phtText);
      }
      if (m.cont !== undefined) {
        parts.push('MVA ' + calc.fmt(m.cont, 2) + ' cm²（连续方程，SV ' +
          calc.fmt(m.sv, 1) + ' mL）→ ' + m.contText);
      }
      if (m.diffText) parts.push(m.diffText);
      out = parts.join('；');
    } else if (gid === 'mitral') {
      // —— 二尖瓣疾病评估（v1.4.4：原「MS 狭窄定量」「MR 反流定量」两条并入本页）——
      //    ① 形态（Wilkins）→ ② 狭窄（MVA 三法 + 压差 + PASP）→ ③ 反流（PISA / VC / dP/dt / RF）
      //    → ④ PMBV 适合度。四段各自独立，只填关心的部分也能出结论。
      const parts = [];
      let wkTotal = null;

      // ① 形态
      if (valid(v.wk1) || valid(v.wk2) || valid(v.wk3) || valid(v.wk4)) {
        const w = calc.wilkinsScore(v.wk1, v.wk2, v.wk3, v.wk4);
        if (w.error) parts.push(w.error);
        else {
          wkTotal = w.total;
          const detail = w.items.map(function (it) {
            return it.n.replace('瓣叶', '') + ' ' + it.score;
          }).join(' · ');
          parts.push('形态 Wilkins ' + w.total + '/16（' + detail + '）· ' + w.text + '；' + w.worstText);
        }
      }

      // ② 狭窄：mit_ 前缀还原成引擎认的键名
      const msv = {};
      Object.keys(v).forEach(function (k) {
        if (k.indexOf('mit_') === 0) msv[k.slice(4)] = v[k];
      });
      const msr = VC.valveCalc('ms', msv, bsa);
      if (msr.rows.length) {
        parts.push('狭窄 ' + rowsText(msr.rows) + ' → ' + msr.summary);
      }

      // ③ 反流：mr_ 前缀；LVOT 直径与 VTI 与狭窄段共用（同一次测量的 SV 用来算 RF）
      const mrv = {};
      Object.keys(v).forEach(function (k) {
        if (k.indexOf('mr_') === 0) mrv[k.slice(3)] = v[k];
      });
      if (!valid(mrv.lvotD) && valid(v.mit_lvotD)) mrv.lvotD = v.mit_lvotD;
      if (!valid(mrv.lvotVti) && valid(v.mit_lvotVti)) mrv.lvotVti = v.mit_lvotVti;
      const mrr = VC.valveCalc('mr', mrv, bsa);
      if (mrr.rows.length) {
        parts.push('反流 ' + rowsText(mrr.rows) + ' → ' + mrr.summary);
      }

      // ④ PMBV 适合度：面积优先取描记，其次连续方程，最后 PHT
      let mvaUsed = null;
      let mvaHow = '';
      if (valid(v.mit_mvaPlani) && v.mit_mvaPlani > 0) {
        mvaUsed = v.mit_mvaPlani;
        mvaHow = '直接描记';
      } else if (valid(v.mit_lvotD, v.mit_lvotVti, v.mit_mvVti) && v.mit_mvVti > 0) {
        mvaUsed = (Math.PI * v.mit_lvotD * v.mit_lvotD / 4 * v.mit_lvotVti) / v.mit_mvVti;
        mvaHow = '连续方程';
      } else if (valid(v.mit_pht) && v.mit_pht > 0) {
        mvaUsed = 220 / v.mit_pht;
        mvaHow = 'PHT 法';
      }
      if (mvaUsed !== null || wkTotal !== null || valid(v.mit_pasp)) {
        const s = calc.pmbvSuit({
          mva: mvaUsed,
          mvaHow: mvaHow,
          gra: valid(v.mit_mgrad) ? v.mit_mgrad : null,
          pasp: valid(v.mit_pasp) ? v.mit_pasp : null,
          wilkins: wkTotal,
        });
        // 已经单独成段展示过的不重复（MVA 三法在「狭窄」段、Wilkins 在「形态」段）
        const ps = s.parts.filter(function (p) {
          if (p.indexOf('① 严重度：MVA') === 0 && mvaUsed !== null) return false;
          if (p.indexOf('③ 形态：Wilkins') === 0 && wkTotal !== null) return false;
          return true;
        });
        const flow = ps.join('；');
        if (flow) parts.push('PMBV 适合度 ' + flow);
        // verdict 自带「PMBV 适合度：」前缀，单独一段，避免与前缀重复
        if (s.verdict) parts.push(s.verdict);
      }
      out = parts.join('\n');
    } else if (gid === 'aortic') {
      // —— 主动脉瓣疾病评估（v1.4.4：原「AS 狭窄定量」「AR 反流定量」两条并入本页）——
      //    ① 狭窄（AVA / DVI / 峰速法 + 压差）→ ② 反流（PISA / VC / PHT / RF）
      const parts = [];
      const asv = {};
      const arv = {};
      Object.keys(v).forEach(function (k) {
        if (k.indexOf('as_') === 0) asv[k.slice(3)] = v[k];
        else if (k.indexOf('ar_') === 0) arv[k.slice(3)] = v[k];
      });
      const asr = VC.valveCalc('as', asv, bsa);
      if (asr.rows.length) {
        parts.push('狭窄 ' + rowsText(asr.rows) + ' → ' + asr.summary);
      }
      const arr = VC.valveCalc('ar', arv, bsa);
      if (arr.rows.length) {
        parts.push('反流 ' + rowsText(arr.rows) + ' → ' + arr.summary);
      }
      // 三联不一致时补一句低流量低压差的提示（引擎只在 AS 内部给分级，不给这条路径）
      if (valid(v.as_mg) && valid(v.as_avVti, v.as_lvotD, v.as_lvotVti)) {
        const ava = Math.PI * v.as_lvotD * v.as_lvotD / 4 * v.as_lvotVti / v.as_avVti;
        if (ava <= 1.0 && v.as_mg < 40) {
          parts.push('⚠ AVA ≤1.0 而平均压差 <40 mmHg：属低流量低压差档，先查 SVi 是否 ≤35 mL/m²，' +
            '再决定低剂量多巴酚丁胺或 CT 钙化评分');
        }
      }
      if (valid(v.as_avVmax) && v.as_avVmax >= 5) {
        parts.push('⚠ Vmax ≥5 m/s，属极重度线索');
      }
      // ③ 低流量低压差（v1.8.4：原「主动脉瓣狭窄 LF-LG 判读」条目并入本页）
      if (valid(v.lflgef) || valid(v.lflgsvi) || valid(v.lflgmpg) || valid(v.lflgava)) {
        const lf = calc.asLflg({
          lvef: v.lflgef, svi: v.lflgsvi, mpg: v.lflgmpg, ava: v.lflgava,
          dsvi: v.lflgdsvi, dava: v.lflgdava,
        });
        const lp = [];
        if (lf.text) lp.push(lf.text);
        if (lf.flowReserve !== undefined) {
          lp.push('SV 增幅 ' + calc.fmt((lf.flowReserve - 1) * 100, 1) + '%（' +
            (lf.hasReserve ? '有收缩储备' : '无收缩储备') + '）');
        }
        if (lf.dse) lp.push(lf.dse);
        if (lp.length) parts.push('LF-LG ' + lp.join('；'));
      }
      out = parts.join('\n');
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
    } else if (gid === 'lastiff') {
      // —— 左房僵硬度 = E/e′ ÷ LARS ——
      if (valid(v.lsee) && valid(v.lslars)) {
        const r = calc.laStiffness(v.lsee, v.lslars);
        if (r.error) out = r.error;
        else {
          const parts = ['LA stiffness ' + calc.fmt(r.stiffness, 2), r.text];
          if (r.note) parts.push(r.note);
          out = parts.join('；');
        }
      }
    } else if (gid === 'vtir') {
      // —— RVOT / LVOT VTI 比 ——
      if (valid(v.vtrvo) && valid(v.vtrlo)) {
        const r = calc.vtiRatio(v.vtrvo, v.vtrlo);
        out = r.error ? r.error : 'VTI 比 ' + calc.fmt(r.ratio, 2) + '；' + r.text;
      }
    } else if (gid === 'lvnc') {
      // —— 致密化不全 NC/C 比 ——
      if (valid(v.lnvnc) && valid(v.lnvc)) {
        const r = calc.lvncRatio(v.lnvnc, v.lnvc);
        if (r.error) out = r.error;
        else {
          const parts = ['NC/C ' + calc.fmt(r.ratio, 2), r.text];
          if (r.note) parts.push(r.note);
          out = parts.join('；');
        }
      }
    } else if (gid === 'resist') {
      // —— ★ v1.8.3 合并页：血管阻力（PVR / SVR / 指数化）——
      const row = function (l, t) { outsArr.push({ l: l, t: t || '等待输入' }); };
      let pvrWu = null;
      let svrDyn = null;

      // ① 肺血管阻力
      if (valid(v.hmmpap, v.hmpawp, v.hmco)) {
        const r = calc.pvrResistance(v.hmmpap, v.hmpawp, v.hmco);
        if (r.error) row('① 肺血管阻力 PVR', r.error);
        else if (r.wu !== undefined) {
          pvrWu = r.wu;
          row('① 肺血管阻力 PVR', 'PVR ' + calc.fmt(r.wu) + ' WU（' +
            calc.fmt(r.dyn, 0) + ' dyn·s·cm⁻⁵，跨瓣压差 ' +
            calc.fmt(r.grad, 1) + ' mmHg）· ' + r.text);
        }
      } else row('① 肺血管阻力 PVR');

      // ② 体循环阻力
      if (valid(v.smap, v.srap, v.sco)) {
        const r = calc.svrResistance(v.smap, v.srap, v.sco, bsa);
        if (r.dyn !== undefined) {
          svrDyn = r.dyn;
          const parts = ['SVR ' + calc.fmt(r.dyn, 0) + ' dyn·s·cm⁻⁵'];
          if (r.svri !== undefined) parts.push('SVRI ' + calc.fmt(r.svri, 0));
          // '·' 是正文分隔符，不能当数组元素塞进 '；' 连接里（会出「；·」）
          row('② 体循环血管阻力 SVR', parts.join('；') + ' · ' + r.text);
        }
      } else row('② 体循环血管阻力 SVR');

      // ③ 指数化：优先用上面算出来的 PVR / SVR，没有再取手填值
      const inPvr = (pvrWu !== null) ? pvrWu : v.ripvr;
      const inSvr = (svrDyn !== null) ? svrDyn : v.risvr;
      if (valid(inPvr) || valid(inSvr)) {
        const r = calc.resistanceIndices(inPvr, inSvr, bsa);
        if (r.error) row('③ 阻力指数 PVRI / SVRI', r.error);
        else {
          const parts = [];
          if (r.pvri !== undefined) parts.push('PVRI ' + calc.fmt(r.pvri, 1) + ' WU·m² · ' + r.pvriText);
          if (r.svri !== undefined) parts.push('SVRI ' + calc.fmt(r.svri, 0) + ' · ' + r.svriText);
          row('③ 阻力指数 PVRI / SVRI', parts.join('；') ||
            '需先填身高体重才能指数化');
        }
      } else {
        row('③ 阻力指数 PVRI / SVRI',
          (bsa > 0 && (valid(v.ripvr) || valid(v.risvr))) ? '' :
            '填上面①②或直接填 PVR / SVR 后自动指数化（需身高体重）');
      }

    } else if (gid === 'rvsyst') {
      // —— ★ v1.8.3 合并页：右室收缩功能（FAC / RVFWS / dP/dt）——
      const row = function (l, t) { outsArr.push({ l: l, t: t || '等待输入' }); };

      if (valid(v.feda, v.fesa)) {
        if (v.fesa >= v.feda) row('① 面积变化分数 FAC', 'RVESA 不可大于或等于 RVEDA，请核对');
        else {
          const f = calc.fac(v.feda, v.fesa);
          row('① 面积变化分数 FAC', 'FAC ' + calc.fmt(f, 1) + '% · ' +
            (f >= 35 ? '正常（≥35%）' : f >= 25 ? '轻度减低（25–35%）' : '明显减低（<25%）'));
        }
      } else row('① 面积变化分数 FAC');

      if (valid(v.rfb) || valid(v.rfm) || valid(v.rfa)) {
        const r = calc.rvFreeWallStrain(v.rfb, v.rfm, v.rfa);
        row('② 游离壁应变 RVFWS', r.error ? r.error
          : 'RVFWS 均值 ' + calc.fmt(r.mean, 1) + '%（' + r.n + ' 段）· ' + r.text);
      } else row('② 游离壁应变 RVFWS');

      if (valid(v.rdt)) {
        const r = calc.rvDpDt(v.rdt);
        row('③ 右室 dP/dt', r.error ? r.error
          : 'RV dP/dt ≈ ' + calc.fmt(r.dpdt, 0) + ' mmHg/s · ' + r.text);
      } else row('③ 右室 dP/dt');

    } else if (gid === 'lvgeom') {
      // —— ★ v1.8.3 合并页：左室重构四联 ——
      const row = function (l, t) { outsArr.push({ l: l, t: t || '等待输入' }); };

      if (valid(v.lhmass, v.lhheight)) {
        const r = calc.lvmHeightIndex(v.lhmass, v.lhheight, female);
        row('① LVMI（身高^2.7）', r.error ? r.error
          : 'LVMI ' + calc.fmt(r.index, 1) + ' g/m^2.7 · ' + r.text);
      } else row('① LVMI（身高^2.7）');

      if (valid(v.rsbp, v.rlvedd, v.rpwt)) {
        const r = calc.relativeWallStress(v.rsbp, v.rlvedd, v.rpwt);
        row('② 相对室壁应力', 'RWS ' + calc.fmt(r.rws, 0) + ' ×10³ dyn/cm² · ' + r.text);
      } else row('② 相对室壁应力');

      if (valid(v.sdd, v.sld)) {
        const r = calc.sphericityIndex(v.sdd, v.sld);
        row('③ 球形指数', r.error ? r.error : 'SI ' + calc.fmt(r.si, 2) +
          '（' + calc.fmt(v.sdd, 2) + ' ÷ ' + calc.fmt(v.sld, 2) + '）· ' + r.text);
      } else row('③ 球形指数');

      if (valid(v.vedv, v.vesv)) {
        const r = calc.volumeIndices(v.vedv, v.vesv, bsa, female);
        if (r.error) row('④ 容积指数', r.error);
        else if (r.sv !== undefined) {
          const parts = ['EF ' + calc.fmt(r.ef, 1) + '%', 'SV ' + calc.fmt(r.sv, 1) + ' mL'];
          if (r.edvi !== undefined) {
            parts.push('EDVi ' + calc.fmt(r.edvi, 1) + '（' + r.edviText + '）');
            parts.push('ESVi ' + calc.fmt(r.esvi, 1) + '（' + r.esviText + '）');
          } else {
            parts.push('填身高体重后给出 EDVi / ESVi（上限 ' +
              (female ? '女 61 / 24' : '男 74 / 31') + '）');
          }
          row('④ 容积指数', parts.join('；'));
        }
      } else row('④ 容积指数');

    } else if (gid === 'tapse') {
      // —— ★ v1.8.3：TAPSE 与 RV-PA 耦联 ——
      if (valid(v.tapse)) {
        const parts = ['TAPSE ' + calc.fmt(v.tapse, 1) + ' mm'];
        parts.push(v.tapse >= 17 ? '正常（≥17）'
          : v.tapse >= 15 ? '轻度减低（15–17）' : '明显减低（<15）');
        if (valid(v.paspv)) {
          const rc = calc.tapsePasp(v.tapse, v.paspv);
          if (rc.ratio !== undefined) {
            parts.push('TAPSE/PASP ' + calc.fmt(rc.ratio, 2) + ' mm/mmHg · ' + rc.text);
          }
        }
        out = parts.join('；');
      }
    }

    this.setData({ out: out, hasOut: !!out, outs: outsArr });
  },

  /* ────────── 转发给朋友 / 收藏（v1.5.8）──────────
     带上当前条目 id：同事点开卡片直接落在同一条目，不用再翻目录。 */
  onShareAppMessage() {
    return {
      title: (this.data.title ? this.data.title + ' · ' : '') + '心脏超声参考',
      path: '/pages/formula/formula?id=' + (this.data.gid || ''),
    };
  },
  onAddToFavorites() {
    return {
      title: (this.data.title ? this.data.title + ' · ' : '') + '心脏超声参考',
      query: 'id=' + (this.data.gid || ''),
    };
  },
});
