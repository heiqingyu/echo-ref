const CG = require('../../utils/calc-groups.js');
const EX = require('../../utils/extra-data.js');
const V = require('../../utils/version.js');
const app = getApp();

/**
 * 公式集目录
 *
 * ★ 以后新增条目（只需改一处）：
 *   - 计算公式：在 utils/calc-groups.js 的 GROUPS 加一条
 *   - 瓣膜评估：在下面 EXTRA 加一条（跳瓣膜页并预选瓣膜）
 *   - 评估类内容：在 utils/extra-data.js 的 BRIEF_SECTIONS 对应分组加一条
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

/** 组装目录：血流动力学（自动） + 瓣膜 + 器械支持 + 心腔与应变（来自 extra-data） */
function buildSections() {
  const sections = [{
    id: 'hemo',
    title: '血流动力学与心功能',
    items: CG.GROUPS.map(function (g) {
      return { kind: 'calc', id: g.id, title: g.title, sub: g.sub || '' };
    }),
  }];

  EXTRA.forEach(function (s) {
    sections.push({ id: s.id, title: s.title, items: s.items });
  });

  EX.BRIEF_SECTIONS.forEach(function (s) {
    sections.push({
      id: s.id,
      title: s.title,
      items: s.items.map(function (it) {
        return { kind: 'brief', id: it.id, title: it.title, sub: it.sub || '' };
      }),
    });
  });

  return sections;
}

Page({
  data: {
    sections: buildSections(),
    bsaText: '—',
    countText: '',
    refs: EX.REFS,
    extLinks: [
      { url: 'https://zs-echo.com', name: '心超速查 ZS-Echo Copilot', desc: '86 个计算器 · 19 类参考值 · 瓣膜与决策流程' },
      { url: 'https://bdrwss.github.io/tte-quickref/dist/', name: 'TTE 心超速查 · 中文版', desc: '床旁速查卡片 · 测量与切面要点' },
    ],
    appVersion: V.APP_VERSION,
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

  /** 点击条目：公式/评估 → 详情页；瓣膜 → 瓣膜评估页并预选该瓣膜 */
  onOpen(e) {
    const d = e.currentTarget.dataset;
    if (d.kind === 'valve') {
      wx.navigateTo({ url: '/pages/valves/valves?tab=' + d.id });
    } else {
      wx.navigateTo({ url: '/pages/formula/formula?id=' + d.id });
    }
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
});