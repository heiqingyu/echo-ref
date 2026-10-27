const segSvg = require('../../utils/segment-svg.js');
const DATA = require('../../utils/segment-data.js');
const EX = require('../../utils/extra-data.js');
const XS = require('../../utils/cross-search.js');
const app = getApp();

/** 条目是否为视频直链（站内播放页可播） */
function isVideo(url) {
  return /\.mp4(\?|$)/i.test(url || '');
}

/** 把 LINK_SECTIONS 里的条目转换成列表项（预算 kind / video / count） */
function toListItem(it, secId) {
  if (it.album) {
    return {
      kind: 'album', id: it.id, sec: secId, title: it.title,
      // ★ v1.8.8：children 里的 { g: '…' } 是小节标题，不算段数
      sub: it.sub || '', count: (it.children || []).filter(function (c) { return !c.g; }).length, url: '',
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
    // ── ③ 切面学习页签：切面速查 / 教学视频 / TEE 演示 ──
    segNav: [
      { key: 'segpart', t: '节段划分' },
      { key: 'lookpart', t: '切面速查' },
      { key: 'viewspart', t: '教学视频' },
      { key: 'simpart', t: 'TEE 演示' },
    ],
    curSeg: 'segpart',
    viewsList: [], // views 外链（含专辑）
    simList: [],   // sim 外链
    lookList: [],  // 切面速查与图谱：segOnly 的 brief 条目 + 瓣膜解剖
    // ── ④ 本页签搜索（v1.6.5）──
    segKw: '',
    segSearching: false, // 有搜索词：节段划分与页内导航让位
    segEmpty: '',        // 搜不到时的空态文案
    segCrossN: 0,        // 公式集里的命中数（>0 才显示跨页签入口）
  },

  onLoad() {
    this.rebuild();
    this.loadSegExtras();
  },

  /** 从公式集「跨页签搜索」跳过来时，接着刚才的关键词继续筛（switchTab 不能带参数） */
  onShow() {
    const pend = app.globalData && app.globalData.pendingSegKw;
    if (pend) {
      app.globalData.pendingSegKw = '';
      this.applySegKw(pend);
    }
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

  /** 装配三个列表的原始数据（标题只在 extra-data.js 维护一份），随后按当前关键词渲染 */
  loadSegExtras() {
    const links = EX.LINK_SECTIONS || [];
    const views = (links.filter(function (s) { return s.id === 'views'; })[0] || {}).items || [];
    const sim = (links.filter(function (s) { return s.id === 'sim'; })[0] || {}).items || [];
    // ★ 切面速查 / 标准切面：标题与说明只在 extra-data.js 维护一份，
    //   这里按 segOnly 标记取（与网页 / APK 的 renderSegLists 同源）
    // ★ v1.7.9：「瓣膜解剖 · TEE 标准切面」从公式集移到这里，排块首（图谱是入口，先看到）
    const look = [{
      kind: 'valveana', id: 'valveana', title: '瓣膜解剖 · TEE 标准切面',
      sub: '13 个 TEE 切面：主动脉瓣 3 · 二尖瓣 6 · 三尖瓣 3 · 肺动脉瓣 1', url: '',
    }];
    (EX.BRIEF_SECTIONS || []).forEach(function (s) {
      (s.items || []).forEach(function (it) {
        if (!it.segOnly) return;
        look.push({
          kind: 'brief', id: it.id, title: it.title, sub: it.sub || '', url: '',
        });
      });
    });
    this._raw = { look: look, views: views, sim: sim };
    this.applySegKw(this.data.segKw || '');
  },

  /**
   * 本页签搜索（v1.6.5）：只筛三块列表
   *
   * 有搜索词时「节段划分」整块与页内导航让位 —— 它不是可搜索的条目，
   * 又占大半屏，留着只会让人以为没筛。
   * 专辑要往下搜子视频：整组搬过来后只按专辑名匹配的话，搜「房间隔」什么都找不到。
   */
  applySegKw(kw) {
    const raw = this._raw || { look: [], views: [], sim: [] };
    const q = (kw || '').trim().toLowerCase();
    const hit = function (it) {
      return ((it.title || '') + ' ' + (it.sub || '')).toLowerCase().indexOf(q) !== -1;
    };
    const look = q ? raw.look.filter(hit) : raw.look;
    const simRaw = q ? raw.sim.filter(hit) : raw.sim;
    const viewsRaw = [];
    raw.views.forEach(function (it) {
      if (!q || hit(it)) { viewsRaw.push(it); return; }
      if (!it.album) return;
      (it.children || []).forEach(function (c) {
        if (hit(c)) viewsRaw.push(c);
      });
    });

    const viewsList = viewsRaw.map(function (it) { return toListItem(it, 'views'); });
    const simList = simRaw.map(function (it) { return toListItem(it, 'sim'); });
    const total = look.length + viewsList.length + simList.length;

    this.setData({
      segKw: kw || '',
      segSearching: !!q,
      segEmpty: q && !total ? '切面学习里没有匹配「' + (kw || '').trim() + '」的条目' : '',
      segCrossN: q ? XS.calcCount(q) : 0,
      lookList: look,
      viewsList: viewsList,
      simList: simList,
    });
  },

  onSegInput(e) {
    this.applySegKw((e.detail && e.detail.value) || '');
  },

  onSegClear() {
    this.applySegKw('');
  },

  /** 切面学习搜不到时，带着关键词跳到公式集继续搜（switchTab 不能带参数，走 globalData） */
  onSegCross() {
    app.globalData.pendingCalcKw = this.data.segKw;
    wx.switchTab({ url: '/pages/calculators/calculators' });
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
        // ★ v1.9.0：按 id 传参（不再拼 URL，中文/百分号地址不会在 query 里失真）
        wx.navigateTo({
          url: '/pages/video/video?sec=' + (d.sec || 'views') + '&item=' + d.id,
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
    return { title: '超声切面学习 · 节段划分、切面速查、教学视频与 TEE 演示', path: '/pages/segments/segments' };
  },
  onAddToFavorites() {
    return { title: '超声切面学习 · 节段划分、切面速查、教学视频与 TEE 演示', query: '/pages/segments/segments' };
  },
});
