const A = require('../../utils/tte-atlas-svg.js');

/** TTE 标准切面总览页：一张 2×2 图 + 四个切面的要点与 TEE 方位对照（R9/R64） */
Page({
  data: {
    src: '',
  },
  onLoad() {
    this.setData({
      src: 'data:image/svg+xml;base64,' + A.utf8ToBase64(A.tteOverviewSvg()),
    });
  },
  onShareAppMessage() {
    return { title: 'TTE 标准切面总览 · EchoRef', path: '/pages/tte-atlas/tte-atlas' };
  },
});
