const core = require('../../utils/echo-core.js');
const app = getApp();

const EF_COLOR = {
  normal: '#0f9d58',
  mild: '#e8a33d',
  moderate: '#d93838',
  severe: '#a11f1f',
};

Page({
  data: {
    lvedd: '50',
    lvesd: '32',
    ivsd: '9',
    lvpwd: '9',
    valid: true,
    hintText: '',
    hasResult: false,
    r: null,
    lvmBsaText: '—',
    bsaText: '—',
    efGrade: '',
    efCls: '',
    efColor: '#1f2329',
    efMarkLeft: 0,
  },

  onLoad() {
    const m = app.globalData.measurements;
    this.setData({
      lvedd: String(m.lvedd),
      lvesd: String(m.lvesd),
      ivsd: String(m.ivsd),
      lvpwd: String(m.lvpwd),
    });
    this.doCalc();
  },

  onShow() {
    this.setData({ bsaText: app.globalData.profile.bsa
      ? app.globalData.profile.bsa.toFixed(2) : '—' });
  },

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
      this.setData({ valid: false, hasResult: false, hintText: '请输入有效的舒张末与收缩末内径' });
      return;
    }
    if (lvesd >= lvedd) {
      this.setData({ valid: false, hasResult: false, hintText: '舒张末内径应大于收缩末内径，请检查输入' });
      return;
    }
    if (!(ivsd > 0) || !(lvpwd > 0)) {
      this.setData({ valid: false, hasResult: false, hintText: '请输入有效的室间隔与后壁厚度' });
      return;
    }

    const bsa = app.globalData.profile.bsa || 0;

    // 计算
    const fn = core.computeLVFunction(lvedd, lvesd);
    const lvm = core.computeLVM(lvedd, ivsd, lvpwd, bsa);
    const rwt = core.computeRWT(lvedd, lvpwd);
    const grade = core.gradeEF(fn.EF);

    // 写回全局，供参考值页对照
    app.globalData.measurements = {
      lvedd, lvesd, ivsd, lvpwd,
      EF: fn.EF,
    };

    this.setData({
      valid: true,
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
      bsaText: bsa ? bsa.toFixed(2) : '—',
      efGrade: grade.text,
      efCls: 'tag--' + grade.level,
      efColor: EF_COLOR[grade.level] || '#1f2329',
      efMarkLeft: Math.max(2, Math.min(98, fn.EF)),
    });
  },

  goReference() {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
