const segSvg = require('../../utils/segment-svg.js');
const DATA = require('../../utils/segment-data.js');
const EX = require('../../utils/extra-data.js');

/** 条目是否为视频直链（站内播放页可播） */
function isVideo(url) {
  return /\.mp4(\?|$)/i.test(url || '');
}

/** 把 LINK_SECTIONS 里的条目转换成列表项（预算 kind / video / count） */
function toListItem(it, secId) {
  if (it.album) {
    return {
      kind: 'album', id: it.id, sec: secId, title: it.title,
      sub: it.sub || '', count: (it.children || []).length, url: '',
    };
  }
  return {
    kind: 'link', id: it.id, sec: secId, title: it.title, sub: it.sub || '',
    url: it.url, video: isVideo(it.url),
  };
}

Page({
  data: {
    // ── ① 17 节段牛眼图 ──
    bsaSvgSrc: '',
    hi: '', // 当前高亮冠脉分区
    sel: null, // 当前选中节段（1–17）
    selInfo: '',
    territoryKey: DATA.TERRITORY_KEY,
    layerRows: DATA.LAYER_ROWS,
    // ── ② 切面与室壁对应（示意图） ──
    wallViews: [],
    hiName: '',
    // ── ③ 切面学习页签：视频 / TEE 演示 / 更多入口 ──
    segNav: [
      { key: 'segpart', t: '节段划分' },
      { key: 'viewspart', t: '教学视频' },
      { key: 'simpart', t: 'TEE 演示' },
      { key: 'anapart', t: '更多入口' },
    ],
    curSeg: 'segpart',
    viewsList: [], // views 外链（含专辑）
    simList: [],   // sim 外链
    anaList: [     // 更多入口：公式集里的切面条目
      { kind: 'brief', id: 'tte-measure', title: 'TTE 标准切面与测量项目',
        sub: '13 个切面 × 观察结构 × 主要测量 · ASE 成人完整检查建议', url: '' },
      { kind: 'valveana', id: 'valveana', title: '瓣膜解剖 · TEE 标准切面',
        sub: '13 个 TEE 切面：主动脉瓣 3 · 二尖瓣 6 · 三尖瓣 3 · 肺动脉瓣 1', url: '' },
    ],
  },

  onLoad() {
    this.rebuild();
    this.loadSegExtras();
  },

  /** 重新生成全部 SVG（牛眼图 + 7 张切面示意图） */
  rebuild() {
    const sel = this.data.sel;
    const wallViews = segSvg.WALL_VIEWS.map(function (w) {
      return {
        id: w.id,
        title: w.title,
        sub: w.sub,
        note: w.note || '',
        groups: w.groups.map(function (g) {
          return {
            label: g[0],
            chips: g[1].map(function (i) {
              return { i: i, color: segSvg.TERRITORY[segSvg.territoryOf(i)].color };
            }),
          };
        }),
        src: 'data:image/svg+xml;base64,' +
          segSvg.utf8ToBase64(segSvg.wallDiagramSvg(w.id, { sel: sel })),
      };
    });
    this.setData({
      bsaSvgSrc: 'data:image/svg+xml;base64,' +
        segSvg.utf8ToBase64(segSvg.bullseyeSvg({ hi: this.data.hi, sel: sel })),
      wallViews: wallViews,
      selInfo: sel ? segSvg.segInfoText(sel) : '',
    });
  },

  /** 装配「教学视频 / TEE 演示」两个外链分组（来自 extra-data 的 LINK_SECTIONS） */
  loadSegExtras() {
    const links = EX.LINK_SECTIONS || [];
    const views = (links.filter(function (s) { return s.id === 'views'; })[0] || {}).items || [];
    const sim = (links.filter(function (s) { return s.id === 'sim'; })[0] || {}).items || [];
    this.setData({
      viewsList: views.map(function (it) { return toListItem(it, 'views'); }),
      simList: sim.map(function (it) { return toListItem(it, 'sim'); }),
    });
  },

  /** 页内导航：点标签滚到对应区块（用选择器算绝对位置，最稳） */
  onSegJump(e) {
    const key = e.currentTarget.dataset.seg;
    if (!key) return;
    this.setData({ curSeg: key });
    const q = wx.createSelectorQuery().in(this);
    q.select('#' + key).boundingClientRect();
    q.selectViewport().scrollOffset();
    const self = this;
    q.exec(function (res) {
      const rect = res && res[0];
      if (!rect) return;
      const cur = (res[1] && res[1].scrollTop) || 0;
      const top = Math.max(0, cur + rect.top - 8);
      wx.pageScrollTo({ scrollTop: top, duration: 220 });
    });
  },

  /** 点击视频 / 演示 / 更多入口里的条目 */
  onFxTap(e) {
    const d = e.currentTarget.dataset;
    if (d.kind === 'album') {
      wx.navigateTo({
        url: '/pages/album/album?sec=' + d.sec + '&item=' + d.id,
      });
      return;
    }
    if (d.kind === 'valveana') {
      wx.navigateTo({ url: '/pages/valveana/valveana' });
      return;
    }
    if (d.kind === 'brief') {
      wx.navigateTo({ url: '/pages/formula/formula?id=' + d.id });
      return;
    }
    if (d.kind === 'link') {
      if (d.video) {
        wx.navigateTo({
          url: '/pages/video/video?url=' + encodeURIComponent(d.url) +
            '&title=' + encodeURIComponent(d.title || ''),
        });
      } else {
        this.copyLink(d.url);
      }
    }
  },

  /** 点击分区色块 → 高亮该冠脉供血区 */
  onTerritory(e) {
    const key = e.currentTarget.dataset.k;
    const hi = this.data.hi === key ? '' : key;
    const hit = DATA.TERRITORY_KEY.find(function (t) { return t.key === hi; });
    this.setData({ hi: hi, hiName: hit ? hit.full : '' });
    this.rebuild();
  },

  /** 点击节段（数字按钮）→ 全页同步选中/取消 */
  onSeg(e) {
    const i = Number(e.currentTarget.dataset.s);
    this.setData({ sel: this.data.sel === i ? null : i });
    this.rebuild();
  },

  onClearSeg() {
    this.setData({ sel: null });
    this.rebuild();
  },

  /* ────────── 复制外链（统一入口）────────── */
  copyLink(url) {
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({ title: '请到浏览器粘贴访问', icon: 'none', duration: 2200 });
      },
    });
  },

  /* ────────── 转发给朋友 / 收藏（v1.5.8）──────────
     ★ 微信规定：不定义 onShareAppMessage，右上角「转发给朋友」根本不显示。 */
  onShareAppMessage() {
    return { title: '超声切面学习 · 17 节段划分、标准切面视频与 TEE 演示', path: '/pages/segments/segments' };
  },
  onAddToFavorites() {
    return { title: '超声切面学习 · 17 节段划分、标准切面视频与 TEE 演示', query: '/pages/segments/segments' };
  },
});
