const peds = require('../../utils/peds-zscore.js');
const core = require('../../utils/echo-core.js');
const app = getApp();

/** 常用参数（快捷输入区）
 *  ★ 左房（LAAP）与右室内径（RVDD）必须在快速区：儿童超声里房室大小比壁厚更常被问，
 *    放到「展开其他参数」里等于藏起来了。*/
const QUICK_KEYS = ['LVEDD', 'LVESD', 'LVST', 'LVPWT',
  'LA4C', 'RA4C', 'RVIDd', 'LVEDV', 'LVESV', 'LVM', 'ROOT'];

Page({
  data: {
    // 受检者
    sex: 'male',
    age: '',
    height: '',
    weight: '',

    // BSA
    bsaText: '—',
    bsaValue: 0,
    bsaValid: false,

    // BMI
    bmiText: '—',

    // 收缩功能（由 LVEDD/LVESD 经 Teichholz 推算）
    func: null,

    // 测量值输入
    inputs: [],
    moreInputs: [],
    moreOpen: false,
    totalCount: 0,

    // 结果
    grouped: [],
    hasBsa: false,
    hasAnyValue: false,
    summary: null,
    warnings: [],
    rangesOpen: false,

    // ★ v1.8.1 新生儿（0–28 天）体重法：独立输入 + 独立区块
    neoInputs: [],
    neoGrouped: [],
    neoOpen: false,
    neoWeight: '',
    neoHasRows: false,

    showFormula: false,
  },

  onLoad() {
    this.syncFromGlobal();
    this.initInputs();
    this.refresh();
  },

  onShow() {
    const p = app.globalData.profile;
    if (p && p.height && String(p.height) !== this.data.height) {
      this.setData({ height: String(p.height), weight: String(p.weight) });
      this.refresh();
    }
  },

  /** 从全局同步身高体重 */
  syncFromGlobal() {
    const p = app.globalData.profile;
    if (!p) return;
    const upd = {};
    if (p.height) upd.height = String(p.height);
    if (p.weight) upd.weight = String(p.weight);
    if (p.sex) upd.sex = p.sex;
    this.setData(upd);
  },

  /** 依据系数表构建输入行 */
  initInputs() {
    this.setData({
      totalCount: peds.PEDS_FIELDS.length,
      inputs: this.mkRows(QUICK_KEYS),
      moreInputs: this.mkRows(peds.PEDS_FIELDS.filter(function (k) {
        return QUICK_KEYS.indexOf(k) === -1;
      })),
      neoInputs: this.mkNeoRows(),
    });
  },

  /** 新生儿体重法里需要自填的 8 项（其余 9 项从上方同名测值带入） */
  mkNeoRows() {
    return peds.NEO_OWN_KEYS.map(function (k) {
      const d = peds.NEO_Z[k];
      return { key: k, name: d.name, unit: d.unit, value: '' };
    });
  },

  mkRows(keys) {
    return keys.map(function (k) {
      const d = peds.PEDS_Z[k];
      const isLen = d.unit === 'cm';
      return {
        key: k,
        name: d.name,
        unit: isLen ? 'mm' : d.unit,
        value: '',
      };
    });
  },

  /* ---------------- 交互 ---------------- */

  onSex(e) {
    this.setData({ sex: e.currentTarget.dataset.v });
  },

  onAge(e)    { this.setData({ age: e.detail.value }); this.refresh(); },
  onHeight(e) { this.setData({ height: e.detail.value }); this.refresh(); },
  onWeight(e) { this.setData({ weight: e.detail.value }); this.refresh(); },

  onToggleMore()    { this.setData({ moreOpen: !this.data.moreOpen }); },
  onToggleNeo()     { this.setData({ neoOpen: !this.data.neoOpen }); },
  onToggleFormula() { this.setData({ showFormula: !this.data.showFormula }); },
  onToggleRanges()  { this.setData({ rangesOpen: !this.data.rangesOpen }); },

  /** 新生儿区块的 8 个自填项（与上方 40 项互不干扰） */
  onNeoInput(e) {
    const key = e.currentTarget.dataset.k;
    const arr = this.data.neoInputs;
    for (let i = 0; i < arr.length; i++) if (arr[i].key === key) arr[i].value = e.detail.value;
    this.setData({ neoInputs: arr });
    this.refresh();
  },

  onInput(e) {
    const key = e.currentTarget.dataset.k;
    const v = e.detail.value;
    const inQuick = this.data.inputs.some(function (r) { return r.key === key; });
    if (inQuick) {
      const arr = this.data.inputs;
      for (let i = 0; i < arr.length; i++) if (arr[i].key === key) arr[i].value = v;
      this.setData({ inputs: arr });
    } else {
      const arr = this.data.moreInputs;
      for (let i = 0; i < arr.length; i++) if (arr[i].key === key) arr[i].value = v;
      this.setData({ moreInputs: arr });
    }
    this.refresh();
  },

  onClear() {
    const clr = function (arr) { arr.forEach(function (r) { r.value = ''; }); return arr; };
    this.setData({
      inputs: clr(this.data.inputs),
      moreInputs: clr(this.data.moreInputs),
      neoInputs: clr(this.data.neoInputs),
      moreOpen: false,
    });
    this.refresh();
  },

  /* ---------------- 计算 ---------------- */

  refresh() {
    const h = parseFloat(this.data.height);
    const w = parseFloat(this.data.weight);
    const valid = h > 30 && h < 220 && w > 1 && w < 150;

    const bsa = valid ? peds.bsaHaycock(h, w) : 0;
    const hasBsa = valid && bsa > 0;

    // BMI（仅显示数值；儿童应对照百分位曲线，不用成人标准判级）
    const bmiText = valid ? core.round(core.bmi(h, w), 1).toFixed(1) : '—';

    // 汇总实测值（界面单位）
    const measured = {};
    let anyValue = false;
    this.data.inputs.concat(this.data.moreInputs).forEach(function (r) {
      const v = parseFloat(r.value);
      if (r.value !== '' && !isNaN(v)) {
        measured[r.key] = v;
        anyValue = true;
      }
    });

    // ★ 收缩功能推算：输入了 LVEDD 与 LVESD 即可计算 EF/FS/SV（Teichholz）
    //   推算出的 EDV/ESV 在用户未直接填容积时代入 Z 值对照
    let func = null;
    let zMeasured = measured;
    if (hasBsa && measured.LVEDD > 0 && measured.LVESD > 0 && measured.LVEDD > measured.LVESD) {
      func = core.computeLVFunction(measured.LVEDD, measured.LVESD);
      // EF 分级（ASE 通用阈值）与 FS 判级（儿童常用参考 28–44%）
      func.efGrade = core.gradeEF(func.EF);
      const fsSt = func.FS < 28 ? 'low' : (func.FS > 44 ? 'high' : 'normal');
      func.fsStatusText = core.STATUS_TEXT[fsSt].text;
      func.fsStatusCls = core.STATUS_TEXT[fsSt].cls;
      zMeasured = Object.assign({}, measured);
      if (zMeasured.LVEDV === undefined) zMeasured.LVEDV = func.EDV;
      if (zMeasured.LVESV === undefined) zMeasured.LVESV = func.ESV;
    }

    const grouped = hasBsa ? peds.buildPedsGrouped(bsa, zMeasured) : [];

    // ★ v1.8.1 新生儿体重法：只认体重，不依赖 BSA（新生儿 BSA 太小，三套 BSA 模型全在外推区）
    const neoOwn = {};
    this.data.neoInputs.forEach(function (r) {
      const v = parseFloat(r.value);
      if (r.value !== '' && !isNaN(v)) neoOwn[r.key] = v;
    });
    const neoMeasured = Object.assign({}, measured, neoOwn);
    const neoW = (w > 0 && w < 150) ? w : 0;
    const neoGrouped = neoW ? peds.buildNeoGrouped(neoW, neoMeasured) : [];
    // 体重落在 1.5–5.0 kg 时自动展开一次（用户手动收起后不再自动弹开）
    if (neoW >= peds.NEO_RANGE.wMin && neoW <= peds.NEO_RANGE.wMax && !this._neoAuto) {
      this._neoAuto = true;
      this.setData({ neoOpen: true });
    }

    this.setData({
      bsaValid: valid,
      hasBsa: hasBsa,
      bsaValue: hasBsa ? peds.round(bsa, 3) : 0,
      bsaText: hasBsa ? bsa.toFixed(2) : '—',
      bmiText: bmiText,
      func: func,
      grouped: grouped,
      neoGrouped: neoGrouped,
      neoWeight: neoW ? neoW.toFixed(1) : '',
      neoHasRows: neoGrouped.length > 0 && neoW > 0 && neoW <= 8,
      neoExtrap: neoW > 0 && (neoW < peds.NEO_RANGE.wMin || neoW > peds.NEO_RANGE.wMax),
      hasAnyValue: anyValue,
      summary: hasBsa ? this.buildSummary(grouped) : null,
      warnings: this.buildWarnings(valid, hasBsa ? bsa : 0),
    });

    if (hasBsa) {
      app.globalData.peds = {
        bsa: peds.round(bsa, 3),
        age: this.data.age,
        measured: measured,
      };
    }
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

    // ★ v1.8.0：冠脉两法（PHN / 深圳 SZ）若一法异常、一法正常，必须点明
    const discord = [];
    grouped.forEach(function (g) {
      g.rows.forEach(function (r) {
        if (!r.alt || !r.hasValue || r.z === null || r.alt.z === null) return;
        if ((Math.abs(r.z) > 2) !== (Math.abs(r.alt.z) > 2)) {
          discord.push(r.name + '（PHN ' + r.zText + ' ' + r.statusText +
            ' / SZ ' + r.alt.zText + ' ' + r.alt.statusText + '）');
        }
      });
    });

    let level = 'normal';
    if (severe > 0) level = 'severe';
    else if (mild > 0) level = 'mild';

    return {
      normal: normal,
      mild: mild,
      severe: severe,
      measuredCount: measuredCount,
      level: level,
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
    // ★ v1.8.0：深圳 SZ 冠脉方程队列为 1 月龄–17 岁，新生儿段只能算外推
    const isNeonate = (bsa > 0 && bsa < peds.SZ_RANGE.bsaMin) ||
      (this.data.age !== '' && !isNaN(a) && a >= 0 && a < 1 / 12);
    if (isNeonate) {
      arr.push('新生儿段：深圳 SZ 冠脉方程建模范围为 1 月龄–17 岁，冠脉两行中的「SZ 法」仅为外推值，' +
        '判读请以 PHN 行或本单位新生儿参考值为准。');
    }
    return arr;
  },

  /** 把身高体重写回全局，供其他页复用 */
  saveProfile() {
    const h = parseFloat(this.data.height);
    const w = parseFloat(this.data.weight);
    if (!(h > 30 && h < 220 && w > 1 && w < 150)) {
      wx.showToast({ title: '身高体重无效', icon: 'none' });
      return;
    }
    app.globalData.profile.height = h;
    app.globalData.profile.weight = w;
    wx.showToast({ title: '已保存身高体重', icon: 'success' });
  },

  /* ────────── 转发给朋友 / 收藏（v1.5.8）──────────
     ★ 微信规定：不定义 onShareAppMessage，右上角「转发给朋友」根本不显示。
     之前四个页面都没有，别人只能靠搜名字找到小程序 —— 这是「给别人用」最大的障碍。 */
  onShareAppMessage() {
    return { title: '儿童超声 Z 值计算 · 按 BSA 校正', path: '/pages/pediatric/pediatric' };
  },
  onAddToFavorites() {
    return { title: '儿童超声 Z 值计算 · 按 BSA 校正', query: '/pages/pediatric/pediatric' };
  },
});
