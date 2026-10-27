// pages/album/album.js —— 专辑二级页（如整本书的视频切面列表）
//
// 目录里 album 条目只占 1 行，点进来才展开具体切面；
// 点具体切面再跳 pages/video 播放。这样公式集首页不会被上百行视频占满。
//
// ★ v1.9.0：飞利浦专辑到 151 段，太长，页内加「搜索框 + 专题导航条」。
//   - 搜索：按标题 / 副标题（含日期、来源、时长）过滤，组标题只保留有命中的组
//   - 导航：①–⑧ 八个专题 chips，点一下滚到该组（SelectorQuery 算绝对位置，
//     不依赖 selector 版 pageScrollTo，老基础库也能用）
const EX = require('../../utils/extra-data.js');

function norm(s) {
  return String(s || '').toLowerCase();
}

/** 组名压成 chip 短名：取「·」之前那一段，去掉「（1–3 分钟）」这类时长，保留编号 */
function chipName(g) {
  const m = /^([①②③④⑤⑥⑦⑧⑨])\s*(.*)$/.exec(g || '');
  const no = m ? m[1] : '';
  let rest = m ? m[2] : String(g || '');
  rest = rest.split('·')[0].split('・')[0].replace(/[（(][^）)]*[）)]/g, '').trim();
  return (no + ' ' + rest).trim() || '分组';
}

Page({
  data: {
    title: '',
    note: '',
    count: 0,
    items: [],
    rows: [],
    kw: '',
    chips: [],
    navOn: 'all',
    navInto: '',
    hasNav: false,
    links: [],
    errText: '',
  },

  onLoad(query) {
    const secId = (query && query.sec) || 'bookvid';
    const itemId = (query && query.item) || '';
    // ★ v1.9.0：跳播放页时按 id 传参，不再拼 URL
    this.__sec = secId;
    this.__item = itemId;

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
    // 组装行：组标题行带 gi（第几个组），普通行带 gi 归属，便于搜索时按组过滤
    let gi = -1;
    const all = kids.map(function (c) {
      if (c.g) {
        gi += 1;
        return { id: 'g:' + gi, g: c.g, gi: gi, title: '', sub: '' };
      }
      return {
        id: c.id,
        g: '',
        gi: gi < 0 ? 0 : gi,
        title: c.title || '',
        sub: c.sub || '',
        // 只为「复制直链」等场景留个底，跳播放页已改为传 id
        url: c.url || '',
      };
    });

    const groups = all.filter(function (r) { return r.g; });
    const chips = [{ k: 'all', n: '全部 ' + all.filter(function (r) { return !r.g; }).length }].concat(
      groups.map(function (r) { return { k: String(r.gi), n: chipName(r.g) }; })
    );

    this.__all = all;

    this.setData({
      title: alb.title,
      // 书籍出处优先取专辑条目自带的 note，其次取分组 note
      note: alb.note || sec.note || '',
      // ★ v1.8.8：children 里 { g: '…' } 是小节标题，不计入段数
      count: all.filter(function (r) { return !r.g; }).length,
      // ★ v1.8.5：专辑可带公众号原文等出处链接（视频是转存的，原文才是第一手）
      links: (alb.links || []).map(function (l) {
        return { n: l.n, url: l.url };
      }),
      items: all,
      rows: all,
      // 只有一个分组时导航没意义
      chips: groups.length > 1 ? chips : [],
      hasNav: groups.length > 1,
    });

    if (alb.title) {
      wx.setNavigationBarTitle({ title: alb.title });
    }
  },

  /** 按关键词重算可见行（空关键词 → 全部） */
  rebuild(kw) {
    const all = this.__all || [];
    const k = norm(kw).trim();
    if (!k) return all.slice();

    const hit = {};
    all.forEach(function (r) {
      if (r.g) return;
      if (norm(r.title).indexOf(k) >= 0 || norm(r.sub).indexOf(k) >= 0) {
        hit[r.gi] = (hit[r.gi] || 0) + 1;
      }
    });

    const out = [];
    all.forEach(function (r) {
      if (r.g) {
        if (hit[r.gi]) out.push(r);
        return;
      }
      if (norm(r.title).indexOf(k) >= 0 || norm(r.sub).indexOf(k) >= 0) out.push(r);
    });
    return out;
  },

  onKw(e) {
    const kw = e.detail.value;
    this.setData({ kw: kw, rows: this.rebuild(kw) });
  },

  onClear() {
    this.setData({ kw: '', rows: this.rebuild(''), navOn: 'all' });
  },

  /** 点专题 chip：滚到对应组（落点要扣掉吸顶条自身高度，否则组标题被压住） */
  onChip(e) {
    const k = e.currentTarget.dataset.k;
    // 选中的 chip 可能在横向滚动区视口外，scroll-into-view 把它带到中间
    this.setData({ navOn: k, navInto: 'nc' + k });
    if (k === 'all') {
      wx.pageScrollTo({ scrollTop: 0, duration: 200 });
      return;
    }
    const q = wx.createSelectorQuery();
    q.select('#ag' + k).boundingClientRect();
    q.select('.album__bar').boundingClientRect();
    q.selectViewport().scrollOffset();
    q.exec(function (res) {
      if (!res || !res[0]) return;
      const base = res[2] ? res[2].scrollTop : 0;
      const barH = res[1] ? res[1].height : 0;
      wx.pageScrollTo({ scrollTop: res[0].top + base - barH - 12, duration: 240 });
    });
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

  /** 点击某个切面：跳站内播放页（★ v1.9.0 传 id，不传 URL，避免百分号编码失真） */
  onOpen(e) {
    const d = e.currentTarget.dataset;
    if (!d.id) return;
    wx.navigateTo({
      url: '/pages/video/video?sec=' + (this.__sec || 'views') +
        '&item=' + (this.__item || '') + '&kid=' + d.id,
    });
  },
});
