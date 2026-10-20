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
      count: kids.length,
      items: kids.map(function (c) {
        return {
          id: c.id,
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
