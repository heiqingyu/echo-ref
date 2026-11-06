const peds = require('../../utils/peds-zscore.js');
const core = require('../../utils/echo-core.js');

/**
 * 儿童 Z 值页 —— 2026-11-06 版式重构
 *
 * ── 为什么改成「按解剖分组」──
 *   旧版：上面一坨输入（快捷 11 项 + 展开 29 项）→ 中间功能/摘要 → 下面 41 行结果表。
 *   同一个结构要上下翻两屏，用户反馈「难找填的位置、难找答案、东一块西一块」。
 *   新版：一个解剖组 = 一张卡 = 输入框 + 该组 Z 结果，输入完目光下移就是答案。
 *   组与组之间用顶部分区导航跳转，卡片可折叠，页面再长也只展开你要看的那组。
 *
 * ── 分组与顺序的唯一真相源 ──
 *   `peds.PEDS_GROUPS`（引擎里定义，10 组 + 冠脉 4 项）。
 *   本页只负责把它渲染成「输入 + 结果」双栏，不再自己维护第二份键顺序。
 */

/** 首次进入时默认展开的组（其余收起，点标题展开） */
const DEFAULT_OPEN = ['冠状动脉', '左心室结构'];

/**
 * 展开/收起状态记在本机
 *
 * 每个人习惯不一样：有人只看冠脉、有人要全摊开。所以状态按「本机上次的选择」
 * 存下来，下次进页面照旧，不再每次回到默认。
 * 存的是「哪些组是展开的」（下标 → true），组标题改字也不会错位。
 */
const OPEN_KEY = 'echoref:pedsOpen';

/**
 * 本页自己的身高体重 / 年龄 / 性别，记在本机
 *
 * ★ 不能拿 app.globalData.profile 当默认：那里是成人默认 170 cm / 65 kg，
 *   儿童页每次启动都填这组数，等于每次都在给一个不存在的孩子算 Z 值
 *   （用户 2026-11-06 反馈「每次启动默认都是 170/65」）。
 *   本页只认自己上次填的，没记录就留空，让用户自己输。
 */
const PROFILE_KEY = 'echoref:pedsProfile';

function loadProfile() {
  try {
    const s = wx.getStorageSync(PROFILE_KEY);
    if (s && typeof s === 'object') return s;
  } catch (e) { /* 读不到就当没填过 */ }
  return null;
}

function loadOpen() {
  const o = {};
  peds.PEDS_GROUPS.forEach(function (g, i) {
    o[i] = DEFAULT_OPEN.indexOf(g.title) !== -1;
  });
  try {
    const saved = wx.getStorageSync(OPEN_KEY);
    if (saved && typeof saved === 'object') {
      peds.PEDS_GROUPS.forEach(function (g, i) {
        if (typeof saved[i] === 'boolean') o[i] = saved[i];
      });
    }
  } catch (e) { /* 读不到就用默认 */ }
  return o;
}

function saveOpen(open) {
  try { wx.setStorageSync(OPEN_KEY, open); } catch (e) { /* 存不下就算了，不影响用 */ }
}

/** { 下标: 展开? } → { 下标: 收起? }（模板里用的是 collapsed） */
function toCollapsed(open) {
  const c = {};
  Object.keys(open).forEach(function (k) { c[k] = !open[k]; });
  return c;
}

Page({
  data: {
    // 受检者
    sex: 'male',
    age: '',
    height: '',
    weight: '',

    // BSA / BMI
    bsaText: '—',
    bsaValue: 0,
    bsaValid: false,
    bmiText: '—',

    // ★ 全页唯一的测值字典：{ 键: 字符串 }
    values: {},

    // 分区导航（新生儿不再单列：它只是页面末尾一张小卡，
    //   且绝大多数字段都停用，占一个导航位反而碍事 —— 用户 2026-11-06 反馈）
    nav: [
      { id: 'sec-person', title: '受检者' },
      { id: 'sec-measure', title: '测量与结果' },
      { id: 'sec-info', title: '说明与来源' },
    ],

    // 分组卡（输入 + 结果，由 refresh 生成）
    groups: [],
    collapsed: {},          // { 组序号: true } 收起
    onlyMeasured: false,

    // 收缩功能（LVEDD + LVESD 推算）
    func: null,

    // 结果摘要
    hasBsa: false,
    measuredList: [],
    summary: null,
    warnings: [],

    // 新生儿（0–28 天）体重法
    neoTitle: '新生儿（0–28 天）· 体重法',
    neoInputs: [],
    neoGrouped: [],
    neoOpen: false,
    neoWeight: '',
    neoHasRows: false,
    neoExtrap: false,
    neoTooOld: false,
    neoAgeText: '',

    // 说明区
    infoOpen: false,
    showFormula: false,
  },

  onLoad() {
    // ★ 本页只恢复自己上次填的那组数；第一次进来是空的，不预填成人默认值
    const pr = loadProfile() || {};
    // 展开状态同理：按本机上次的选择恢复（首次进入才用 DEFAULT_OPEN）
    this._open = loadOpen();
    this.setData({
      height: pr.height || '',
      weight: pr.weight || '',
      age: pr.age || '',
      sex: pr.sex || 'male',
      collapsed: toCollapsed(this._open),
      neoInputs: this.mkNeoRows(),
    });
    this.refresh();
  },

  /** 记住本页填过的身高体重 / 年龄 / 性别（只在本页用，不写成人页） */
  saveLocalProfile() {
    try {
      wx.setStorageSync(PROFILE_KEY, {
        height: this.data.height,
        weight: this.data.weight,
        age: this.data.age,
        sex: this.data.sex,
      });
    } catch (e) { /* 存不下就算了 */ }
  },

  /** 新生儿体重法里需要自填的 8 项（其余 9 项从上方同名测值带入） */
  mkNeoRows() {
    return peds.NEO_OWN_KEYS.map(function (k) {
      const d = peds.NEO_Z[k];
      return { key: k, name: d.name, unit: d.unit, value: '' };
    });
  },

  /* ---------------- 交互 ---------------- */

  onSex(e) { this.setData({ sex: e.currentTarget.dataset.v }); this.saveLocalProfile(); },
  onAge(e)    { this.setData({ age: e.detail.value }); this.saveLocalProfile(); this.refresh(); },
  onHeight(e) { this.setData({ height: e.detail.value }); this.saveLocalProfile(); this.refresh(); },
  onWeight(e) { this.setData({ weight: e.detail.value }); this.saveLocalProfile(); this.refresh(); },

  /** 分区导航：滚到对应区块（用 SelectorQuery 取偏移，不用 hash 锚点） */
  onNav(e) {
    const id = e.currentTarget.dataset.id;
    wx.createSelectorQuery().select('#' + id).boundingClientRect().selectViewport().scrollOffset().exec(function (res) {
      if (!res || !res[0]) return;
      wx.pageScrollTo({ scrollTop: res[0].top + (res[1] ? res[1].scrollTop : 0) - 8, duration: 260 });
    });
  },

  onToggleGroup(e) {
    const i = e.currentTarget.dataset.i;
    const c = Object.assign({}, this.data.collapsed);
    c[i] = !c[i];
    this.setData({ collapsed: c });
    // 记住这次选择，下次进页面照旧
    const open = {};
    peds.PEDS_GROUPS.forEach(function (g, k) { open[k] = !c[k]; });
    this._open = open;
    saveOpen(open);
  },

  /** 全部展开 / 全部收起（同样会记住） */
  onExpandAll()   { this.setAllOpen(true); },
  onCollapseAll() { this.setAllOpen(false); },

  setAllOpen(open) {
    const o = {};
    peds.PEDS_GROUPS.forEach(function (g, i) { o[i] = open; });
    this._open = o;
    saveOpen(o);
    this.setData({ collapsed: toCollapsed(o) });
  },

  onToggleOnlyMeasured() { this.setData({ onlyMeasured: !this.data.onlyMeasured }); this.refresh(); },
  onToggleNeo()      { this.setData({ neoOpen: !this.data.neoOpen }); },
  onToggleInfo()     { this.setData({ infoOpen: !this.data.infoOpen }); },
  onToggleFormula()  { this.setData({ showFormula: !this.data.showFormula }); },

  onNeoInput(e) {
    const key = e.currentTarget.dataset.k;
    const arr = this.data.neoInputs;
    for (let i = 0; i < arr.length; i++) if (arr[i].key === key) arr[i].value = e.detail.value;
    this.setData({ neoInputs: arr });
    this.refresh();
  },

  /** 测量值输入：全页共用一个 values 字典，键＝引擎里的参数键 */
  onInput(e) {
    const key = e.currentTarget.dataset.k;
    const upd = {};
    upd['values.' + key] = e.detail.value;
    this.setData(upd);
    this.refresh();
  },

  onClear() {
    const clr = function (arr) { arr.forEach(function (r) { r.value = ''; }); return arr; };
    this.setData({ values: {}, neoInputs: clr(this.data.neoInputs) });
    this.refresh();
  },

  /* ---------------- 计算 ---------------- */

  refresh() {
    const h = parseFloat(this.data.height);
    const w = parseFloat(this.data.weight);
    const valid = h > 30 && h < 220 && w > 1 && w < 150;

    const bsa = valid ? peds.bsaHaycock(h, w) : 0;
    const hasBsa = valid && bsa > 0;
    const bmiText = valid ? core.round(core.bmi(h, w), 1).toFixed(1) : '—';

    // 汇总实测值（界面单位）
    const vals = this.data.values || {};
    const measured = {};
    let anyValue = false;
    Object.keys(vals).forEach(function (k) {
      const v = parseFloat(vals[k]);
      if (vals[k] !== '' && vals[k] !== undefined && !isNaN(v)) {
        measured[k] = v;
        anyValue = true;
      }
    });

    // 收缩功能：输入 LVEDD 与 LVESD 即用 Teichholz 推算 EF/FS/SV
    let func = null;
    let zMeasured = measured;
    if (hasBsa && measured.LVEDD > 0 && measured.LVESD > 0 && measured.LVEDD > measured.LVESD) {
      func = core.computeLVFunction(measured.LVEDD, measured.LVESD);
      func.efGrade = core.gradeEF(func.EF);
      const fsSt = func.FS < 28 ? 'low' : (func.FS > 44 ? 'high' : 'normal');
      func.fsStatusText = core.STATUS_TEXT[fsSt].text;
      func.fsStatusCls = core.STATUS_TEXT[fsSt].cls;
      zMeasured = Object.assign({}, measured);
      if (zMeasured.LVEDV === undefined) zMeasured.LVEDV = func.EDV;
      if (zMeasured.LVESV === undefined) zMeasured.LVESV = func.ESV;
    }

    const grouped = hasBsa ? peds.buildPedsGrouped(bsa, zMeasured) : [];

    // ── 新生儿体重法 ──
    const neoOwn = {};
    this.data.neoInputs.forEach(function (r) {
      const v = parseFloat(r.value);
      if (r.value !== '' && !isNaN(v)) neoOwn[r.key] = v;
    });
    const neoMeasured = Object.assign({}, measured, neoOwn);
    const neoW = (w > 0 && w < 150) ? w : 0;
    const neoAge = parseFloat(this.data.age);
    const neoAgeDays = (!isNaN(neoAge) && neoAge > 0) ? neoAge * 365.25 : 0;
    const neoTooOld = neoAgeDays > 28;
    const neoGrouped = (neoW && !neoTooOld) ? peds.buildNeoGrouped(neoW, neoMeasured) : [];
    if (neoW >= peds.NEO_RANGE.wMin && neoW <= peds.NEO_RANGE.wMax && !neoTooOld && !this._neoAuto) {
      this._neoAuto = true;
      this.setData({ neoOpen: true });
    }

    // ── 分组卡：每组 = 输入行 + 结果行 ──
    const groups = peds.PEDS_GROUPS.map(function (g, i) {
      const rows = grouped[i] ? grouped[i].rows : [];
      const inputs = g.keys.map(function (k) {
        const d = peds.PEDS_Z[k];
        return {
          key: k,
          name: d.name,
          unit: d.unit === 'cm' ? 'mm' : d.unit,
          value: vals[k] === undefined ? '' : vals[k],
        };
      });
      let cnt = 0;
      rows.forEach(function (r) { if (r.hasValue) cnt++; });
      return {
        idx: i,
        title: g.title,
        note: g.note || '',
        inputs: inputs,
        results: rows,
        measuredCount: cnt,
        hasValue: cnt > 0,
      };
    });

    this.setData({
      bsaValid: valid,
      hasBsa: hasBsa,
      bsaValue: hasBsa ? peds.round(bsa, 3) : 0,
      bsaText: hasBsa ? bsa.toFixed(2) : '—',
      bmiText: bmiText,
      func: func,
      groups: groups,
      measuredList: this.buildMeasuredList(grouped),
      summary: hasBsa ? this.buildSummary(grouped) : null,
      warnings: this.buildWarnings(valid, hasBsa ? bsa : 0),
      neoGrouped: neoGrouped,
      neoWeight: neoW ? neoW.toFixed(1) : '',
      neoHasRows: neoGrouped.length > 0 && neoW > 0 && neoW <= 8,
      neoTooOld: neoTooOld && neoW > 0 && neoW <= 8,
      neoAgeText: neoTooOld ? (neoAgeDays >= 60 ? neoAge.toFixed(1) + ' 岁' : Math.round(neoAgeDays) + ' 天') : '',
      neoExtrap: !neoTooOld && neoW > 0 && (neoW < peds.NEO_RANGE.wMin || neoW > peds.NEO_RANGE.wMax),
    });
  },

  /** 已测项一览：输入几项就列几行，按 |Z| 降序 */
  buildMeasuredList(grouped) {
    const out = [];
    grouped.forEach(function (g) {
      g.rows.forEach(function (r) {
        if (!r.hasValue) return;
        out.push({
          key: r.key,
          name: r.name,
          group: g.title,
          valueText: r.value + (r.unit ? ' ' + r.unit : ''),
          zText: r.zText,
          zAbs: r.z === null ? -1 : Math.abs(r.z),
          statusText: r.statusText,
          statusCls: r.statusCls,
          altLabel: r.altLabel || '',
          altText: r.alt ? r.alt.zText : '',
        });
      });
    });
    out.sort(function (a, b) { return b.zAbs - a.zAbs; });
    return out;
  },

  /** 结果摘要：统计正常 / 轻度 / 显著，并挑出偏离最大的项 */
  buildSummary(grouped) {
    let normal = 0, mild = 0, severe = 0, measuredCount = 0;
    let worst = null;

    grouped.forEach(function (g) {
      g.rows.forEach(function (r) {
        if (!r.hasValue) return;
        measuredCount++;
        if (r.status === 'normal') normal++;
        else if (r.status === 'mild') mild++;
        else if (r.status === 'severe') severe++;
        if (worst === null || Math.abs(r.z) > Math.abs(worst.z)) worst = r;
      });
    });

    // 冠脉两法（深圳 SZ / 四川 2025）若一法异常、一法正常，必须点明
    const discord = [];
    grouped.forEach(function (g) {
      g.rows.forEach(function (r) {
        if (!r.alt || !r.hasValue || r.z === null || r.alt.z === null) return;
        if ((Math.abs(r.z) > 2) !== (Math.abs(r.alt.z) > 2)) {
          discord.push(r.name + '（深圳 ' + r.zText + ' ' + r.statusText +
            ' / 四川 ' + r.alt.zText + ' ' + r.alt.statusText + '）');
        }
      });
    });

    let level = 'normal';
    if (severe > 0) level = 'severe';
    else if (mild > 0) level = 'mild';

    return {
      normal: normal, mild: mild, severe: severe, measuredCount: measuredCount, level: level,
      worstName: worst ? worst.name : '',
      worstZText: worst ? worst.zText : '',
      worstStatusText: worst ? worst.statusText : '',
      worstCls: worst ? worst.statusCls : 'tag--none',
      discordText: discord.length
        ? '⚠ 冠脉两法结论不一致：' + discord.join('；') + '。以报告所采用的那一套判读。'
        : '',
    };
  },

  buildWarnings(valid, bsa) {
    const arr = [];
    if (!valid && this.data.height && this.data.weight) {
      arr.push('身高体重超出常用范围（30–220 cm / 1–150 kg），请核对后重填。');
    }
    const a = parseFloat(this.data.age);
    if (this.data.age && !isNaN(a) && a > 18) {
      arr.push('本页 Z 值适用于 0–18 岁儿童。成人请改用「参考值」页的中国成人或 ASE 标准。');
    }
    const isNeonate = (bsa > 0 && bsa < peds.SZ_RANGE.bsaMin) ||
      (this.data.age !== '' && !isNaN(a) && a >= 0 && a < 1 / 12);
    if (isNeonate) {
      arr.push('新生儿段：冠脉方程建模范围为 1 月龄–17 岁，冠脉行仅为外推值，' +
        '判读请以新生儿体重法或本单位参考值为准。');
    }
    return arr;
  },

  /* ────────── 转发 / 收藏 ────────── */
  onShareAppMessage() {
    return { title: '儿童超声 Z 值计算 · 按 BSA 校正', path: '/pages/pediatric/pediatric' };
  },
  onAddToFavorites() {
    return { title: '儿童超声 Z 值计算 · 按 BSA 校正', query: '/pages/pediatric/pediatric' };
  },
});
