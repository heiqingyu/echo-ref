const core = require('../../utils/echo-core.js');
const app = getApp();

/* EF 分级配色（ASE 2015 阈值） */
const EF_COLOR = {
  normal: '#0f9d58',
  mild: '#e8a33d',
  moderate: '#d93838',
  severe: '#a11f1f',
};

Page({
  data: {
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
    formula: 'dubois',
    standard: 'CN',
    standardNote: '',
    /* —— EF 计算（合并自原「EF 计算」页） —— */
    lvedd: '50',
    lvesd: '32',
    ivsd: '9',
    lvpwd: '9',
    efValid: true,
    efHint: '',
    hasResult: false,
    r: null,
    lvmBsaText: '—',
    efGrade: '',
    efCls: '',
    efColor: '#1f2329',
    efMarkLeft: 0,
    /* —— 参考值列表 —— */
    rows: [],
    hasMeasurements: false,
    refDesc: '',
    sourceText: '',
  },

  onLoad() {
    const p = app.globalData.profile;
    const m = app.globalData.measurements;
    this.setData({
      sex: p.sex,
      height: String(p.height),
      weight: String(p.weight),
      standard: app.globalData.standard,
      lvedd: m && m.lvedd ? String(m.lvedd) : this.data.lvedd,
      lvesd: m && m.lvesd ? String(m.lvesd) : this.data.lvesd,
      ivsd: m && m.ivsd ? String(m.ivsd) : this.data.ivsd,
      lvpwd: m && m.lvpwd ? String(m.lvpwd) : this.data.lvpwd,
    });
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

  onSex(e) {
    this.setData({ sex: e.currentTarget.dataset.v });
    this.refresh();
  },

  onHeight(e) {
    this.setData({ height: e.detail.value });
    this.refresh();
  },

  onWeight(e) {
    this.setData({ weight: e.detail.value });
    this.refresh();
  },

  onFormula(e) {
    this.setData({ formula: e.currentTarget.dataset.v });
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
    const patch = {};
    patch[k] = e.detail.value;
    this.setData(patch);
    if (this.data.hasResult) this.doCalc();
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
    if (!(ivsd > 0) || !(lvpwd > 0)) {
      app.globalData.measurements = null;
      this.setData({
        efValid: false, hasResult: false,
        efHint: '请输入有效的室间隔与后壁厚度',
      });
      this.rebuildRef();
      return;
    }

    const bsa = app.globalData.profile.bsa || 0;

    // 计算
    const fn = core.computeLVFunction(lvedd, lvesd);
    const lvm = core.computeLVM(lvedd, ivsd, lvpwd, bsa);
    const rwt = core.computeRWT(lvedd, lvpwd);
    const grade = core.gradeEF(fn.EF);

    // 写回全局，供参考值列表对照
    app.globalData.measurements = {
      lvedd, lvesd, ivsd, lvpwd,
      EF: fn.EF,
    };

    this.setData({
      efValid: true,
      hasResult: true,
      r: {
        EDV: fn.EDV.toFixed(1),
        ESV: fn.ESV.toFixed(1),
        SV: fn.SV.toFixed(1),
        EF: fn.EF.toFixed(1),
        FS: fn.FS.toFixed(1),
        RWT: rwt !== null ? rwt.toFixed(2) : '—',
        LVM: lvm.LVM.toFixed(1),
      },
      lvmBsaText: lvm['LVM/BSA'] !== null ? lvm['LVM/BSA'].toFixed(1) : '—',
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

    const rows = core.buildReferenceList(sex, measured, standard, p.bsa);
    const std = core.REFERENCE[standard];

    this.setData({
      rows,
      hasMeasurements: hasM,
      refDesc: hasM
        ? '已关联上方 EF 计算的测量值，实测列显示对照判定'
        : (sex === 'male' ? '男性' : '女性') + ' · ' + std.note,
      sourceText: standard === 'CN'
        ? '中华医学会超声医学分会《中国成年人超声心动图检查测量指南》（2016，95% 参考范围，37 项）'
        : 'ASE/EACVI 2015《Recommendations for Cardiac Chamber Quantification in Adults》',
    });
  },
});
