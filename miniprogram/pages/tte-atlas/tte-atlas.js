const A = require('../../utils/tte-atlas-svg.js');

/**
 * TTE 标准切面总览页（R9 / R64）
 *
 * ★ 2026-11-21：正文只有 343px 宽，四联图缩到 1/3，字只剩 4–5px。
 *   改成单切面图（480×290）逐张纵向排（现 6 张：PLAX / AV 短轴 / A4C / A2C /
 *   A5C / MV 短轴），每张占满卡片宽度，字与结构才看得清。
 *   图上标的「上 / 下 / 左 / 右」是屏幕方位，与指南里的切面示意图一致。
 */
Page({
  data: {
    srcs: [],
  },
  onLoad() {
    const srcs = [];
    for (let i = 0; i < 6; i += 1) {
      srcs.push('data:image/svg+xml;base64,' + A.utf8ToBase64(A.ttePanelSvg(i)));
    }
    this.setData({ srcs: srcs });
  },
  onShareAppMessage() {
    return { title: 'TTE 标准切面总览 · EchoRef', path: '/pages/tte-atlas/tte-atlas' };
  },
});
