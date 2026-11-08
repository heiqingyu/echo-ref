const core = require('../../utils/echo-core.js');
const V = require('../../utils/version.js');
const keep = require('../../utils/keep.js');
const app = getApp();

/**
 * 「记住本次输入」存哪些字段
 *
 * 用户 2026-11-06：重新加载后输入框全清空，希望自己点一下才保留。
 * 只存这页真正手填的东西（身高体重、性别、公式、四个内径），
 * 参考值标准是全局设置，不跟着这一页走。
 */
const KEEP_ON = 'echoref:keep:index';
const KEEP_DATA = 'echoref:data:index';
const KEEP_FIELDS = ['sex', 'height', 'weight', 'formula', 'lvedd', 'lvesd', 'ivsd', 'lvpwd'];

/* ★ 中国成人标准的「按年龄分层」是阅读偏好，不随本页输入重置；单独记在本机 */
const AGE_ON_KEY = 'echoref:ageOn';
const AGE_BAND_KEY = 'echoref:ageBand';
function loadAgeOn() {
  try { return wx.getStorageSync(AGE_ON_KEY) === true; } catch (e) { return false; }
}
function loadAgeBand() {
  try {
    const v = wx.getStorageSync(AGE_BAND_KEY);
    return (typeof v === 'number' && v >= 0 && v < 6) ? v : 0;
  } catch (e) { return 0; }
}
function saveAge(on, band) {
  try {
    wx.setStorageSync(AGE_ON_KEY, on);
    wx.setStorageSync(AGE_BAND_KEY, band);
  } catch (e) { /* 存不下就算了，不影响本页使用 */ }
}

/* EF 分级配色（ASE 2015 阈值） */
const EF_COLOR = {
  normal: '#0f9d58',
  mild: '#e8a33d',
  moderate: '#d93838',
  severe: '#a11f1f',
};

/* ★ 赞赏「喜欢开发者」组件（<reward />）需基础库 3.17.5 及以上；
   低版本放上去是空白，所以先判版本再渲染。
   ★ 走「代码接入」后，每次发新版本都不必再去「开发者助手」重新做智能接入。 */
function rewardReady() {
  let sv = '';
  try {
    sv = (wx.getAppBaseInfo && wx.getAppBaseInfo().SDKVersion) ||
      (wx.getSystemInfoSync && wx.getSystemInfoSync().SDKVersion) || '';
  } catch (e) {
    sv = '';
  }
  if (!sv) return false;
  const a = String(sv).split('.');
  const b = '3.17.5'.split('.');
  for (let i = 0; i < 3; i += 1) {
    const x = parseInt(a[i] || '0', 10);
    const y = parseInt(b[i] || '0', 10);
    if (x !== y) return x > y;
  }
  return true;
}

Page({
  data: {
    appVersion: V.APP_VERSION,
    // 「记住本次输入」开关（默认关：重新加载即清空）
    keep: false,
    /* —— 受检者基本信息 —— */
    sex: 'male',
    height: '170',
    weight: '65',
    bsaValue: 0,
    bsaText: '—',
    bmiText: '—',
    bmiLabel: '',
    bmiCls: '',
    valid: true,
    formula: 'mosteller',
    standard: 'CN',
    standardNote: '',
    /* —— 中国成人标准：按年龄分层（默认关 = 6 段合并总人群）—— */
    ageOn: false,
    ageBand: -1,
    ageBands: [],
    ageNote: '',
    /* —— EF 计算（合并自原「EF 计算」页） —— */
    lvedd: '50',
    lvesd: '32',
    ivsd: '9',
    lvpwd: '9',
    efValid: true,
    efHint: '',
    hasResult: false,
    hasWall: false,
    r: null,
    lvmBsaText: '—',
    efGrade: '',
    efCls: '',
    efColor: '#1f2329',
    efMarkLeft: 0,
    /* EF 分级图例：必须放 data（WXML 不解析 &lt; 这类实体，写死会露出字面量） */
    efLegend: ['<30 重度', '30–44 中度', '45–54 轻度', '≥55 正常'],
    /* —— 参考值列表 —— */
    rows: [],
    hasMeasurements: false,
    refDesc: '',
    sourceText: '',
    /* ★ 赞赏「喜欢开发者」组件开关（基础库 3.17.5+ 才渲染） */
    showReward: false,
  },

  onLoad() {
    const p = app.globalData.profile;
    const m = app.globalData.measurements;
    // ★ 默认不记：只有点过「记住本次输入」才恢复上次那份
    const keepOn = keep.on(KEEP_ON);
    const sv = keepOn ? keep.read(KEEP_DATA) : null;
    const pick = function (k, fallback) {
      return (sv && sv[k] !== undefined && sv[k] !== '') ? sv[k] : fallback;
    };
    this.setData({
      keep: keepOn,
      sex: pick('sex', p.sex),
      height: String(pick('height', p.height)),
      weight: String(pick('weight', p.weight)),
      formula: pick('formula', this.data.formula),
      standard: app.globalData.standard,
      ageOn: loadAgeOn(),
      ageBand: loadAgeBand(),
      ageBands: core.AGE_BANDS,
      showReward: rewardReady(),
      lvedd: pick('lvedd', m && m.lvedd ? String(m.lvedd) : this.data.lvedd),
      lvesd: pick('lvesd', m && m.lvesd ? String(m.lvesd) : this.data.lvesd),
      ivsd: pick('ivsd', m && m.ivsd ? String(m.ivsd) : this.data.ivsd),
      lvpwd: pick('lvpwd', m && m.lvpwd ? String(m.lvpwd) : this.data.lvpwd),
    });
    this.refresh();
    this.doCalc();
  },

  /* ══════ 记住 / 重置 ══════ */

  /** 开关打开时把本页手填的字段存一份 */
  saveSnapshot() {
    if (!this.data.keep) return;
    const o = {};
    const self = this;
    KEEP_FIELDS.forEach(function (k) { o[k] = self.data[k]; });
    keep.write(KEEP_DATA, o);
  },

  onToggleKeep() {
    const v = !this.data.keep;
    keep.setOn(KEEP_ON, v);
    if (v) {
      this.setData({ keep: true });
      this.saveSnapshot();
    } else {
      keep.drop(KEEP_DATA);
      this.setData({ keep: false });
    }
  },

  /**
   * 「重置」：清掉存档与开关，并把本页输入全部清空
   *
   * ★ 身高体重也要清（用户 2026-11-06：「身高体重没重置」）。
   *   清了以后 BSA 显示 —，等用户自己填，避免又回到「默认 170/65 一直在那儿」的老问题。
   */
  onReset() {
    keep.setOn(KEEP_ON, false);
    keep.drop(KEEP_DATA);
    this.setData({
      keep: false,
      sex: 'male',
      height: '',
      weight: '',
      formula: 'mosteller',
      lvedd: '', lvesd: '', ivsd: '', lvpwd: '',
    });
    app.globalData.measurements = null;
    this.refresh();
    this.doCalc();
  },

  onShow() {
    // 从其他页返回时同步标准选择
    if (this.data.standard !== app.globalData.standard) {
      this.setData({ standard: app.globalData.standard });
      this.updateNote();
    }
    this.rebuildRef();
  },

  /* ══════ 受检者基本信息 ══════ */

  /**
   * ★ 值没变就直接返回
   *
   * 基础库 3.17.x：setData 把值写回正在输入的 <input>，视图层会再抛一次 bindinput
   * （值相同）。不判断就会在「更新正在应用」的同步过程中再调 setData，
   * 触发 `Component recursive update detected ... may lead to unexpected render results`
   * （2026-11-06 用户报「点参考值 TAB 也报错」）。同一值直接 return 即可断链。
   */
  onSex(e) {
    const v = e.currentTarget.dataset.v;
    if (v === this.data.sex) return;
    this.setData({ sex: v });
    this.saveSnapshot();
    this.refresh();
  },

  onHeight(e) {
    const v = e.detail.value;
    if (v === this.data.height) return;
    this.setData({ height: v });
    this.saveSnapshot();
    this.refresh();
  },

  onWeight(e) {
    const v = e.detail.value;
    if (v === this.data.weight) return;
    this.setData({ weight: v });
    this.saveSnapshot();
    this.refresh();
  },

  onFormula(e) {
    const v = e.currentTarget.dataset.v;
    if (v === this.data.formula) return;
    this.setData({ formula: v });
    this.saveSnapshot();
    this.refresh();
  },

  onStandard(e) {
    const standard = e.currentTarget.dataset.v;
    app.globalData.standard = standard;
    this.setData({ standard });
    this.updateNote();
    this.rebuildRef();
  },

  updateNote() {
    this.setData({ standardNote: core.REFERENCE[this.data.standard].note });
  },

  /* ══════ 中国成人标准：按年龄分层（2026-11-08） ══════ */

  /** 开关：关＝6 段合并的总人群 95% 参考范围；开＝按所选年龄段显示 */
  onToggleAge() {
    const on = !this.data.ageOn;
    const band = this.data.ageBand < 0 ? 0 : this.data.ageBand;
    saveAge(on, band);
    this.setData({ ageOn: on, ageBand: band });
    this.rebuildRef();
  },

  /** 选年龄段：表格区间与「实测值对照」的判定同步切换 */
  onAgeBand(e) {
    const band = parseInt(e.currentTarget.dataset.i, 10);
    if (!(band >= 0 && band < core.AGE_BANDS.length)) return;
    if (band === this.data.ageBand && this.data.ageOn) return;
    saveAge(true, band);
    this.setData({ ageOn: true, ageBand: band });
    this.rebuildRef();
  },

  /** 重新计算 BSA / BMI，写入全局状态 */
  refresh() {
    const h = parseFloat(this.data.height);
    const w = parseFloat(this.data.weight);
    const valid = h > 50 && h < 250 && w > 2 && w < 300;

    if (!valid) {
      this.setData({ valid: false, bsaText: '—', bsaValue: 0, bmiText: '—', bmiLabel: '' });
      return;
    }

    const bsa = this.data.formula === 'dubois'
      ? core.bsaDuBois(h, w)
      : core.bsaMosteller(h, w);

    // BMI（中国成人标准 WS/T 428-2013）
    const b = core.bmi(h, w);
    const bc = core.bmiClass(b);

    // 同步到全局，供 EF 计算与参考值折算使用
    app.globalData.profile = {
      sex: this.data.sex,
      height: h,
      weight: w,
      bsa: core.round(bsa, 3),
    };

    this.setData({
      valid: true,
      bsaValue: core.round(bsa, 3),
      bsaText: bsa.toFixed(2),
      bmiText: b.toFixed(1),
      bmiLabel: bc.text,
      bmiCls: 'bmi--' + bc.level,
    });
    this.updateNote();
    this.rebuildRef();
  },

  /* ══════ EF 计算（合并自原「EF 计算」页） ══════ */

  onInput(e) {
    const k = e.currentTarget.dataset.k;
    const v = e.detail.value;
    // 同值不回写：否则 setData 写回输入框会再抛一次 bindinput，形成递归更新
    if ((this.data[k] === undefined ? '' : this.data[k]) === v) return;
    // ★ 直接更新 data、不单独 setData：用户刚输的值本来就在输入框里，
    //   回写只会触发基础库再抛一次 bindinput（2026-11-06 递归更新告警）。
    //   结果由 doCalc 一次性下发，且不带输入字段，输入框 DOM 不动。
    this.data[k] = v;
    this.saveSnapshot();
    // ★ 输入即出结果：两个内径填齐就自动算，不用再点「计算」按钮。
    //   清空 / 未填齐时收起旧结果，避免留着上一份数字误导。
    const d = parseFloat(this.data.lvedd);
    const s = parseFloat(this.data.lvesd);
    if (d > 0 && s > 0 && s < d) {
      this.doCalc();
    } else if (this.data.hasResult) {
      app.globalData.measurements = null;
      this.setData({ hasResult: false, efValid: false, efHint: '请输入有效的舒张末与收缩末内径' });
      this.rebuildRef();
    }
  },

  doCalc() {
    const lvedd = parseFloat(this.data.lvedd);
    const lvesd = parseFloat(this.data.lvesd);
    const ivsd = parseFloat(this.data.ivsd);
    const lvpwd = parseFloat(this.data.lvpwd);

    // 输入校验
    if (!(lvedd > 0) || !(lvesd > 0)) {
      app.globalData.measurements = null;
      this.setData({
        efValid: false, hasResult: false,
        efHint: '请输入有效的舒张末与收缩末内径',
      });
      this.rebuildRef();
      return;
    }
    if (lvesd >= lvedd) {
      app.globalData.measurements = null;
      this.setData({
        efValid: false, hasResult: false,
        efHint: '舒张末内径应大于收缩末内径，请检查输入',
      });
      this.rebuildRef();
      return;
    }
    // ★ 室壁厚度为选填：只测内径就能算 EF / FS，缺厚度时不出 RWT 与左室质量
    const hasIvs = ivsd > 0;
    const hasPwt = lvpwd > 0;
    const hasWall = hasIvs && hasPwt;

    const bsa = app.globalData.profile.bsa || 0;

    // 计算
    const fn = core.computeLVFunction(lvedd, lvesd);
    const lvm = core.computeLVM(lvedd, hasIvs ? ivsd : 0, hasPwt ? lvpwd : 0, bsa);
    const rwt = core.computeRWT(lvedd, hasPwt ? lvpwd : 0);
    const grade = core.gradeEF(fn.EF);

    // 写回全局，供参考值列表对照
    app.globalData.measurements = {
      lvedd, lvesd,
      ivsd: hasIvs ? ivsd : 0,
      lvpwd: hasPwt ? lvpwd : 0,
      EF: fn.EF,
    };

    this.setData({
      efValid: true,
      hasResult: true,
      efHint: '',
      hasPwt,
      hasWall,
      r: {
        EDV: fn.EDV.toFixed(1),
        ESV: fn.ESV.toFixed(1),
        SV: fn.SV.toFixed(1),
        EF: fn.EF.toFixed(1),
        FS: fn.FS.toFixed(1),
        RWT: rwt !== null ? rwt.toFixed(2) : '',
        LVM: lvm.LVM !== null ? lvm.LVM.toFixed(1) : '',
      },
      lvmBsaText: lvm['LVM/BSA'] !== null ? lvm['LVM/BSA'].toFixed(1) : '',
      efGrade: grade.text,
      efCls: 'tag--' + grade.level,
      efColor: EF_COLOR[grade.level] || '#1f2329',
      efMarkLeft: Math.max(2, Math.min(98, fn.EF)),
    });

    // 同页显示实测值对照，立即刷新列表
    this.rebuildRef();
  },

  /** 滚动到下方参考值列表 */
  goReference() {
    wx.pageScrollTo({ selector: '.ref-block', duration: 300 });
  },

  /**
   * 延展阅读：复制外部链接
   * 小程序 web-view 只能打开已在小程序后台配置业务域名的页面，
   * 别人的站点无法校验，故统一走「复制链接 → 用户自行到浏览器打开」。
   */
  onCopyLink(e) {
    const url = e && e.currentTarget && e.currentTarget.dataset
      ? e.currentTarget.dataset.url
      : '';
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({ title: '请到浏览器粘贴访问', icon: 'none', duration: 2200 });
      },
    });
  },

  /* ══════ 参考值列表 ══════ */

  rebuildRef() {
    const { sex, standard } = this.data;
    const p = app.globalData.profile;
    const m = app.globalData.measurements;

    const hasM = !!(m && m.lvedd && m.lvesd);
    let measured = null;
    if (hasM) {
      measured = core.measurementsToRefDict({
        lvedd: m.lvedd,
        lvesd: m.lvesd,
        ivsd: m.ivsd,
        lvpwd: m.lvpwd,
        bsa: p.bsa,
        height: p.height,
      });
    }

    // ★ 只有「中国成人标准 + 开关打开」才按年龄段取区间；ASE 与关闭状态都用总人群
    const band = (standard === 'CN' && this.data.ageOn) ? this.data.ageBand : -1;
    const rows = core.buildReferenceList(sex, measured, standard, p.bsa, band);
    const std = core.REFERENCE[standard];
    const ab = band >= 0 ? core.AGE_BANDS[band] : null;
    const bandDesc = ab
      ? ' · ' + ab.t + '组（男 n=' + ab.n.male + ' / 女 n=' + ab.n.female + '）'
      : '';

    this.setData({
      rows,
      hasMeasurements: hasM,
      refDesc: (hasM
        ? '已关联上方 EF 计算的测量值，实测列显示对照判定'
        : (sex === 'male' ? '男性' : '女性') + ' · ' + std.note) + bandDesc,
      ageNote: ab
        ? '当前按 ' + ab.t + '组的 95% 参考范围显示，实测值判定也按这一组。' +
          '年龄段样本量较小，仅作参照；' +
          'LVM/BSA、LVM/H2.7、LVEDD/H、RWT 四项原表未给年龄分层，仍用总人群值。' +
          '指南只覆盖 18~79 岁，超出范围请回到总人群。'
        : '',
      phaseNote: core.PHASE_NOTE,
      sourceText: standard === 'CN'
        ? '中华医学会超声医学分会《中国成年人超声心动图检查测量指南》（2016，男 678 / 女 716，表 2～表 9 共 64 项 95% 参考范围；LVM/身高^2.7、内径/身高两行为派生值）'
        : 'ASE/EACVI 2015《Recommendations for Cardiac Chamber Quantification in Adults》',
    });
  },

  /* ────────── 转发给朋友 / 收藏（v1.5.8）──────────
     ★ 微信规定：不定义 onShareAppMessage，右上角「转发给朋友」根本不显示。
     之前四个页面都没有，别人只能靠搜名字找到小程序 —— 这是「给别人用」最大的障碍。 */
  onShareAppMessage() {
    return { title: '心脏超声参考值速查 · EF 与参考区间', path: '/pages/index/index' };
  },
  onAddToFavorites() {
    return { title: '心脏超声参考值速查 · EF 与参考区间', query: '/pages/index/index' };
  },
});
