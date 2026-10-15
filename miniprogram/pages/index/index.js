const core = require('../../utils/echo-core.js');
const app = getApp();

Page({
  data: {
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
    /* —— 参考值列表（合并自原「参考值」页） —— */
    rows: [],
    hasMeasurements: false,
    refDesc: '',
    sourceText: '',
  },

  onLoad() {
    const p = app.globalData.profile;
    this.setData({
      sex: p.sex,
      height: String(p.height),
      weight: String(p.weight),
      standard: app.globalData.standard,
    });
    this.refresh();
  },

  onShow() {
    // 从其他页返回时同步标准选择与测量值
    if (this.data.standard !== app.globalData.standard) {
      this.setData({ standard: app.globalData.standard });
      this.updateNote();
    }
    this.rebuildRef();
  },

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

  /** 重新计算 BSA 并写入全局状态 */
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

    // 同步到全局，供 EF / 参考值页使用
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

  goReference() {
    // 参考值已并入本页，滚动到列表位置
    wx.pageScrollTo({ selector: '.ref-block', duration: 300 });
  },

  goEF() {
    wx.switchTab({ url: '/pages/ef/ef' });
  },

  /** 重建参考值列表（合并自原「参考值」页） */
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
        ? '已关联「EF 计算」页的测量值，实测列显示对照判定'
        : (sex === 'male' ? '男性' : '女性') + ' · ' + std.note,
      sourceText: standard === 'CN'
        ? '中华医学会超声医学分会《中国成年人超声心动图检查测量指南》（2016，95% 参考范围，37 项）'
        : 'ASE/EACVI 2015《Recommendations for Cardiac Chamber Quantification in Adults》',
    });
  },
});
