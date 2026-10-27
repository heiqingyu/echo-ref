// pages/album/album.js —— 专辑二级页（如整本书的视频切面列表）
//
// 目录里 album 条目只占 1 行，点进来才展开具体切面；
// 点具体切面再跳 pages/video 播放。这样公式集首页不会被 25 行视频占满。
const EX = require('../../utils/extra-data.js');

Page({
  data: {
    title: '',
    note: '',
    count: 0,
    items: [],
    links: [],
    errText: '',
  },

  onLoad(query) {
    const secId = (query && query.sec) || 'bookvid';
    const itemId = (query && query.item) || '';

    const sec = (EX.LINK_SECTIONS || []).filter(function (s) {
      return s.id === secId;
    })[0];
    if (!sec) {
      this.setData({ errText: '找不到这个分组' });
      return;
    }

    let alb = null;
    if (itemId) {
      alb = sec.items.filter(function (it) { return it.id === itemId; })[0];
    }
    if (!alb || !alb.album) {
      alb = sec.items.filter(function (it) { return it.album; })[0];
    }
    if (!alb) {
      this.setData({ errText: '找不到这个专辑' });
      return;
    }

    const kids = alb.children || [];
    this.setData({
      title: alb.title,
      // 书籍出处优先取专辑条目自带的 note，其次取分组 note
      note: alb.note || sec.note || '',
      // ★ v1.8.8：children 里 { g: '…' } 是小节标题，不计入段数
      count: kids.filter(function (c) { return !c.g; }).length,
      // ★ v1.8.5：专辑可带公众号原文等出处链接（视频是转存的，原文才是第一手）
      links: (alb.links || []).map(function (l) {
        return { n: l.n, url: l.url };
      }),
      items: kids.map(function (c) {
        if (c.g) return { id: 'g:' + c.g, g: c.g, title: '', sub: '', url: '' };
        return {
          id: c.id,
          g: '',
          title: c.title,
          sub: c.sub || '',
          url: c.url,
        };
      }),
    });

    if (alb.title) {
      wx.setNavigationBarTitle({ title: alb.title });
    }
  },

  /** 点击出处链接：复制到剪贴板（小程序内不能直接开外链） */
  onCopyLink(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({ title: '已复制，请在浏览器打开', icon: 'none', duration: 2200 });
      },
    });
  },

  /** 点击某个切面：跳站内播放页 */
  onOpen(e) {
    const d = e.currentTarget.dataset;
    if (!d.url) return;
    wx.navigateTo({
      url: '/pages/video/video?url=' + encodeURIComponent(d.url) +
        '&title=' + encodeURIComponent(d.title || ''),
    });
  },
});
