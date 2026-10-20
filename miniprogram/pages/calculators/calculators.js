const CG = require('../../utils/calc-groups.js');
const app = getApp();

/**
 * 公式集目录
 *
 * ★ 以后新增公式：在 utils/calc-groups.js 的 GROUPS 加一条即可自动出现在这里，
 *   点击后跳 /pages/formula/formula?id=<组 id>。
 * ★ 其它页面的工具（如瓣膜评估的 AS / MS）在下面 EXTRA 里加一条，
 *   kind: 'valve' 表示跳瓣膜评估页并选中该瓣膜。
 */
const EXTRA = [
  {
    id: 'valve',
    title: '瓣膜评估',
    items: [
      { kind: 'valve', id: 'as', title: 'AS 主动脉瓣狭窄', sub: 'AVA · 峰值流速 · 压差分级' },
      { kind: 'valve', id: 'ar', title: 'AR 主动脉瓣反流', sub: '反流束 · PHT · 压力减半时间' },
      { kind: 'valve', id: 'ms', title: 'MS 二尖瓣狭窄', sub: 'MVA · PHT · 平均压差' },
      { kind: 'valve', id: 'mr', title: 'MR 二尖瓣反流', sub: 'EROA · RVol · 反流分级' },
      { kind: 'valve', id: 'tr', title: 'TR 三尖瓣反流', sub: 'EROA · RVol · PASP' },
    ],
  },
];

/** 由 GROUPS 自动生成「血流动力学与心功能」分组 */
function buildSections() {
  const sections = [{
    id: 'hemo',
    title: '血流动力学与心功能',
    items: CG.GROUPS.map(function (g) {
      return { kind: 'calc', id: g.id, title: g.title, sub: g.sub || '' };
    }),
  }];
  EXTRA.forEach(function (s) { sections.push(s); });
  return sections;
}

Page({
  data: {
    sections: buildSections(),
    bsaText: '—',
    countText: '',
  },

  onLoad() {
    let n = 0;
    this.data.sections.forEach(function (s) { n += s.items.length; });
    this.setData({ countText: '共 ' + n + ' 项' });
  },

  onShow() {
    const p = app.globalData.profile;
    this.setData({ bsaText: p && p.bsa ? p.bsa.toFixed(2) : '—' });
  },

  /** 点击条目：公式 → 详情页；瓣膜 → 瓣膜评估页并预选该瓣膜 */
  onOpen(e) {
    const d = e.currentTarget.dataset;
    if (d.kind === 'valve') {
      wx.navigateTo({ url: '/pages/valves/valves?tab=' + d.id });
    } else {
      wx.navigateTo({ url: '/pages/formula/formula?id=' + d.id });
    }
  },
});
