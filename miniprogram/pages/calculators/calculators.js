const CG = require('../../utils/calc-groups.js');
const EX = require('../../utils/extra-data.js');
const XS = require('../../utils/cross-search.js');
const V = require('../../utils/version.js');
const MT = require('../../utils/materials.js');
const app = getApp();

/**
 * 公式集目录
 *
 * ★ 以后新增条目（只需改一处）：
 *   - 计算公式：在 utils/calc-groups.js 的 GROUPS 加一条（瓣膜 AS/AR/MS/MR/TR 也是）
 *   - 评估类内容：在 utils/extra-data.js 的 BRIEF_SECTIONS 对应分组加一条
 *
 * ★ v1.4.1：原来 5 个跳「瓣膜页」的专用计算器改成公式集里的普通计算条目
 *   （AS/AR/MS/MR/TR 在 calc-groups.js 里，id 与原瓣膜页一致），
 *   这样网页 / APK / 小程序三端目录完全一致，不再有「这个端有、那个端没有」。
 *   这里只留「瓣膜解剖示意图」一个跳转项，放在组末尾。
 */
const EXTRA = [
  {
    id: 'valve',
    title: '瓣膜评估',
    // ★ v1.7.9：「瓣膜解剖 · TEE 标准切面」已移到「切面学习」页签（与切面速查同属图谱，
    //   不是计算器也不是判读条目）。组壳保留，供 BRIEF_SECTIONS 的 mergeInto 并入用。
    items: [],
  },
];

/** 该条目是否是视频直链（站内播放页可播） */
function isVideo(url) {
  return /\.mp4(\?|$)/i.test(url || '');
}

/* ────────── 收藏（v1.7.7）──────────
   存 id 数组，跨启动保留；没有收藏时不显示「收藏」组。 */
const FAV_KEY = 'echoref_favs';

function readFavs() {
  try {
    const a = wx.getStorageSync(FAV_KEY);
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}

function saveFavs(arr) {
  try { wx.setStorageSync(FAV_KEY, arr); } catch (e) { /* 存储满 / 隐私模式：静默 */ }
}

/** 把某个 id 的组挪到最前（桌面端与网页端同一套规则） */
function moveSectionFirst(sections, id) {
  const i = sections.map(function (s) { return s.id; }).indexOf(id);
  if (i > 0) sections.unshift(sections.splice(i, 1)[0]);
}

/** 组内若干条目提到最前，顺序按 ids 给定 */
function headItems(sections, secId, ids) {
  const sec = sections.filter(function (s) { return s.id === secId; })[0];
  if (!sec) return;
  const head = ids.map(function (id) {
    return sec.items.filter(function (it) { return it.id === id; })[0];
  }).filter(Boolean);
  if (!head.length) return;
  sec.items = head.concat(sec.items.filter(function (it) {
    return head.indexOf(it) === -1;
  }));
}

/**
 * 组装目录：4 个计算组 + 瓣膜 + 各评估分组 + 外链分组
 *
 * 计算组按 calc-groups.js 的 CALC_SECTIONS 拆分（hemo / right / vq / recon），
 * 每条 GROUP 用 sec 指定归属，缺省 hemo —— 29 个公式不再堆在同一个组里。
 *
 * ★ album 条目（如整本书的视频）在目录里只占 1 条，children 不塞进 data，
 *   点进去再按 sec/item 到 extra-data 里取，避免 setData 传输整份子列表。
 */
function buildSections() {
  const sections = CG.CALC_SECTIONS.map(function (cs) {
    return {
      id: cs.id,
      title: cs.title,
      items: CG.GROUPS.filter(function (g) {
        if (g.partOnly) return false;   // v1.8.3 合并页里的小节，不进目录
        if (g.dirHide) return false;    // v1.11.2 已内嵌进判读条目，目录不再单列
        return (g.sec || 'hemo') === cs.id;
      }).map(function (g) {
        return { kind: 'calc', id: g.id, ab: g.ab || '', title: g.title, sub: g.sub || '' };
      }),
    };
  });

  EXTRA.forEach(function (s) {
    // ★ 跳转型条目（瓣膜解剖示意图）先别急着塞开头，等判读条目合并完再放末尾
    sections.push({ id: s.id, title: s.title, items: s.items.slice() });
  });

  // ★ 瓣膜组（sec: 'valve'）的计算器由下面的 BRIEF 循环统一并入（mergeInto 分支），
  //   v1.5.3 起不再在这里单独拼一遍，否则 tavrsz / pvfu 会重复出现两次。

  EX.BRIEF_SECTIONS.forEach(function (s) {
    // ★ v1.5.3：sec 指向本组的计算器直接并进来，排在判读条目之前
    //   （原「介入尺寸、先心与随访」组已拆散，8 个计算器归到 valve / chd / chamber）
    const calcs = CG.GROUPS.filter(function (g) {
      return !g.partOnly && !g.dirHide && g.sec === s.id;
    }).map(function (g) {
      return { kind: 'calc', id: g.id, ab: g.ab || '', title: g.title, sub: g.sub || '' };
    });
    const items = calcs.concat(s.items.filter(function (it) {
      // ★ v1.6.4：segOnly 条目（切面速查 / 标准切面）只在「切面学习」页签列出，
      //   不进公式集目录；条目定义仍留在 BRIEF_SECTIONS 里，详情页照常可取。
      return !it.segOnly;
    }).map(function (it) {
      return { kind: 'brief', id: it.id, ab: it.ab || '', title: it.title, sub: it.sub || '' };
    }));
    // mergeInto：并入同名组（如「瓣膜评估」计算器组），不另起一个组
    if (s.mergeInto) {
      const host = sections.filter(function (x) { return x.id === s.mergeInto; })[0];
      if (host) {
        host.items = host.items.concat(items);
        return;
      }
    }
    sections.push({ id: s.id, title: s.title, items: items });
  });

  // ★ 切面学习与 TEE 切面在线演示（LINK_SECTIONS 的 views / sim）已收进「切面学习」页签，
  //   公式集目录不再重复列出（与网页 / APK 三端一致，v1.6.3）。

  // ★ moveTo：把标注了 moveTo 的评估条目挪到另一个分组显示（与网页端 app.js 同逻辑）
  //   条目定义仍留在 BRIEF_SECTIONS 里（详情页靠它取内容），只是目录换位置。
  //   2026-10-24：用户要求把「TTE 标准切面与测量项目」从节段划分页移到「切面学习」。
  EX.BRIEF_SECTIONS.forEach(function (s) {
    s.items.forEach(function (it) {
      if (!it.moveTo || it.moveTo === s.id) return;
      if (it.segOnly) return;   // 已在「切面学习」页签，别再挪回目录
      const host = sections.filter(function (x) { return x.id === it.moveTo; })[0];
      if (!host) return;
      const from = sections.filter(function (x) { return x.id === s.id; })[0];
      if (from) {
        from.items = from.items.filter(function (x) { return x.id !== it.id; });
      }
      host.items.push({ kind: 'brief', id: it.id, ab: it.ab || '', title: it.title, sub: it.sub || '' });
    });
  });

  // 本地资料（PDF / 图片 / 视频直链）：docs/materials/ 里放了东西才出现这一组
  // ★ 只存 URL，不内嵌文件，所以工具体积不随资料变大
  if (MT.MATERIALS && MT.MATERIALS.length) {
    sections.push({
      id: 'materials',
      title: '本地资料（PDF 等）',
      note: '放在 docs/materials/ 的本地资料，体积不影响工具本体；点一下复制链接到浏览器打开',
      items: MT.MATERIALS.map(function (it) {
        return {
          kind: 'link', id: it.id, title: it.title, sub: it.sub || '', url: it.url,
          video: isVideo(it.url),
        };
      }),
    });
  }

  // ★ v1.7.7：瓣膜评估整组前置（临床使用频率最高），组内二尖瓣 / 主动脉瓣评估再提到最前
  moveSectionFirst(sections, 'valve');
  headItems(sections, 'valve', ['mitral', 'aortic']);

  // ★ v1.7.7：收藏组置顶（没有收藏时不出现），每条目也记一个 fav 标记给星标用
  const favs = readFavs();
  const byId = {};
  sections.forEach(function (s) {
    s.items.forEach(function (it) {
      it.fav = favs.indexOf(it.id) !== -1;
      if (!byId[it.id]) byId[it.id] = it;
    });
  });
  const favItems = favs.map(function (id) { return byId[id]; }).filter(Boolean);
  if (favItems.length) {
    sections.unshift({
      id: 'fav',
      title: '收藏',
      note: '点条目右侧的 ☆ / ★ 可加入或移出；收藏只存在本机，不上传',
      items: favItems,
    });
  }

  return sections;
}

/** 取某个专辑条目的子条目（原始数据） */
function albumChildren(secId, itemId) {
  const sec = (EX.LINK_SECTIONS || []).filter(function (s) { return s.id === secId; })[0];
  if (!sec) return [];
  const alb = sec.items.filter(function (it) { return it.id === itemId && it.album; })[0];
  return (alb && alb.children) || [];
}

/** 条目是否命中关键词（标题 + 说明） */
function hit(it, q) {
  return ((it.title || '') + ' ' + (it.sub || '')).toLowerCase().indexOf(q) !== -1;
}

/**
 * 搜索：按关键词过滤
 *
 * 专辑条目的子条目也参与匹配——搜「房间隔」时会把命中的视频直接平铺出来，
 * 免得用户还要先点进专辑再找；而专辑标题本身命中时，仍只显示一条入口。
 */
function searchSections(all, kw) {
  const q = kw.toLowerCase();
  const out = [];
  all.forEach(function (sec) {
    if (sec.id === 'fav') return;   // 收藏组只是镜像，命中时按原位置给出，避免结果里出现两条
    const items = [];
    sec.items.forEach(function (it) {
      if (it.kind !== 'album') {
        if (hit(it, q)) items.push(it);
        return;
      }
      if (hit(it, q)) {
        items.push(it);
        return;
      }
      albumChildren(it.sec, it.id).forEach(function (c) {
        if (!hit(c, q)) return;
        items.push({
          kind: 'link', id: c.id, title: c.title, sub: c.sub || '', url: c.url, video: true,
        });
      });
    });
    if (items.length) {
      out.push({ id: sec.id, title: sec.title, note: sec.note || '', items: items });
    }
  });
  return out;
}

Page({
  data: {
    sections: buildSections(),
    kw: '',
    searching: false,
    segCrossN: 0,   // 「切面学习」页签里的命中数（v1.6.5 跨页签提示）
    bsaText: '—',
    countText: '',
    refs: EX.REFS,
    refsCount: EX.REFS.length,
    // 只数「点开就能看」的免费链；标「需订阅」的 DOI 页面不算直链
    refsPdf: EX.REFS.filter(function (r) {
      return (r.dl || []).some(function (d) { return d.t !== '需订阅'; });
    }).length,
    refsOpen: false,
    appVersion: V.APP_VERSION,
    // 组名跳转条：目录很长，点一下定位到该组；末尾挂「参考文献」直达页底文献卡（v1.6.6）
    navGroups: buildSections().map(function (s) {
      return { id: s.id, title: s.title.replace(/（.*?）/g, '') };
    }).concat([{ id: 'refs', title: '参考文献' }]),
    curGroup: '',
    showTop: false,
  },

  onLoad() {
    // 原始目录留在实例上，搜索时不必反复重建
    this.allSections = this.data.sections;
    this.setData({ countText: this.countTextOf(this.allSections) });
  },

  onShow() {
    const p = app.globalData.profile;
    this.setData({ bsaText: p && p.bsa ? p.bsa.toFixed(2) : '—' });
    // 从「切面学习」跨页签搜过来：接着刚才的关键词继续筛
    const pend = app.globalData.pendingCalcKw;
    if (pend) {
      app.globalData.pendingCalcKw = '';
      this.applySearch(pend);
    }
  },

  /** 参考文献默认折叠（40 条会把页面拉得很长），点标题才展开全部 */
  /** 滚动到一定距离后显示「回到顶部」 */
  onPageScroll(e) {
    const show = e.scrollTop > 420;
    if (show !== this.data.showTop) this.setData({ showTop: show });
  },

  onToTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 260 });
    this.setData({ showTop: false });
  },

  onToggleRefs() {
    this.setData({ refsOpen: !this.data.refsOpen });
  },

  /**
   * 点组名胶囊 → 滚到该组
   * 用选择查询拿元素相对视口的位置 + 当前滚动量，算出目标 scrollTop
   * （wx.pageScrollTo 的 selector 分支在部分基础库上不稳，故自己算）
   */
  onJumpGroup(e) {
    const id = e && e.currentTarget && e.currentTarget.dataset
      ? e.currentTarget.dataset.id : '';
    if (!id) return;
    const self = this;
    const scroll = function () {
      const q = wx.createSelectorQuery().in(self);
      q.select('#g-' + id).boundingClientRect();
      q.selectViewport().scrollOffset();
      q.exec(function (res) {
        const rect = res && res[0];
        if (!rect) return;                     // 搜索时该组可能被过滤掉了
        const cur = (res[1] && res[1].scrollTop) || 0;
        const top = Math.max(0, cur + rect.top - 8);
        wx.pageScrollTo({ scrollTop: top, duration: 220 });
      });
    };
    // 「参考文献」：先展开再量位置（setData 是异步的，位置要等回调里量）
    if (id === 'refs') {
      this.setData({ curGroup: id, refsOpen: true }, scroll);
      return;
    }
    this.setData({ curGroup: id });
    scroll();
  },

  /** 「共 N 项」/「找到 N 项」（hasKw 由调用方传入，避免读到还没刷新的 this.data.kw） */
  countTextOf(list, hasKw) {
    let n = 0;
    // 收藏组只是同一批条目的镜像，计数时要排除，否则同一台计算器会被数两次
    list.forEach(function (s) { if (s.id !== 'fav') n += s.items.length; });
    return (hasKw ? '找到 ' + n + ' 项' : '共 ' + n + ' 项');
  },

  /** 搜索框输入：实时过滤（条目总量不大，直接过滤，无需防抖） */
  onSearch(e) {
    this.applySearch((e.detail && e.detail.value) || '');
  },

  /** 搜索主体（从搜索框、清空、跨页签跳转三处共用） */
  applySearch(raw) {
    const kw = (raw || '').trim();
    // allSections 是 onLoad 里缓存的原始目录；理论上 onShow 之前一定已 onLoad，
    // 但这里给个回退，免得任何调用顺序下都炸掉整页。
    const all = this.allSections || this.data.sections;
    if (!kw) {
      this.setData({
        kw: '', searching: false, sections: all,
        countText: this.countTextOf(all), segCrossN: 0,
      });
      return;
    }
    const secs = searchSections(all, kw);
    this.setData({
      kw: kw,
      searching: true,
      sections: secs,
      countText: secs.length ? '找到 ' + kw : '没有匹配「' + kw + '」',
      // v1.6.5：切面学习页签的速查/视频/演示不在本目录里，命中就给一条过去的入口
      segCrossN: XS.segCount(kw),
    });
  },

  /** 清空搜索 */
  onClearSearch() {
    this.applySearch('');
  },

  /** 跨页签：带着关键词跳到「切面学习」（switchTab 不能带参数，走 globalData） */
  onSegCross() {
    app.globalData.pendingSegKw = this.data.kw;
    wx.switchTab({ url: '/pages/segments/segments' });
  },

  /**
   * 点击条目：
   *   album → 视频目录页（列出该专辑下的具体切面）
   *   link  → mp4 走站内播放页，其余复制外链
   *   valve → 瓣膜评估页并预选该瓣膜
   *   其余  → 公式 / 评估内容详情页
   */
  /**
   * 收藏 / 取消收藏（v1.7.7）
   * 星标用 catchtap 拦住冒泡，点星不会同时打开条目；收藏组置顶、没有收藏时不显示。
   */
  onFav(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const favs = readFavs();
    const i = favs.indexOf(id);
    if (i === -1) favs.unshift(id); else favs.splice(i, 1);
    saveFavs(favs);
    this.allSections = buildSections();
    // 搜索状态下重绘后要保住关键词，否则列表会跳回完整目录
    if (this.data.kw) {
      this.applySearch(this.data.kw);
      return;
    }
    this.setData({
      sections: this.allSections,
      navGroups: this.navGroupsOf(this.allSections),
      countText: this.countTextOf(this.allSections),
    });
  },

  /** 组名跳转条数据（目录重绘时同步） */
  navGroupsOf(list) {
    return list.map(function (s) {
      return { id: s.id, title: s.title.replace(/（.*?）/g, '') };
    }).concat([{ id: 'refs', title: '参考文献' }]);
  },

  onOpen(e) {
    const d = e.currentTarget.dataset;
    if (d.kind === 'album') {
      wx.navigateTo({
        url: '/pages/album/album?sec=' + d.sec + '&item=' + d.id,
      });
      return;
    }
    if (d.kind === 'link') {
      // 视频直链（.mp4）在站内播放页打开，不必让用户复制到浏览器
      if (isVideo(d.url)) {
        // ★ v1.9.0：按 id 传参（不再拼 URL，中文/百分号地址不会在 query 里失真）
        wx.navigateTo({
          url: '/pages/video/video?sec=' + (d.sec || 'views') + '&item=' + d.id,
        });
        return;
      }
      this.copyLink(d.url);
      return;
    }
    if (d.kind === 'valveana') {
      wx.navigateTo({ url: '/pages/valveana/valveana' });
    } else {
      wx.navigateTo({ url: '/pages/formula/formula?id=' + d.id });
    }
  },

  /**
   * 复制外部链接（参考文献 PDF 胶囊用）
   * 小程序 web-view 只能打开已在小程序后台配置业务域名的页面，
   * 别人的站点无法校验，故统一走「复制链接 → 用户自行到浏览器打开」。
   */
  onCopyLink(e) {
    const url = e && e.currentTarget && e.currentTarget.dataset
      ? e.currentTarget.dataset.url
      : '';
    this.copyLink(url);
  },

  /** 复制外链（统一入口） */
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
     ★ 微信规定：不定义 onShareAppMessage，右上角「转发给朋友」根本不显示。
     之前四个页面都没有，别人只能靠搜名字找到小程序 —— 这是「给别人用」最大的障碍。 */
  onShareAppMessage() {
    return { title: '超声公式集 · 48 个计算器与评估清单', path: '/pages/calculators/calculators' };
  },
  onAddToFavorites() {
    return { title: '超声公式集 · 48 个计算器与评估清单', query: '/pages/calculators/calculators' };
  },
});
