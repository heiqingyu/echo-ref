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

/** 该条目是否是视频直链（站内播放页可播） */
function isVideo(url) {
  return /\.mp4(\?|$)/i.test(url || '');
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
        return (g.sec || 'hemo') === cs.id;
      }).map(function (g) {
        return { kind: 'calc', id: g.id, title: g.title, sub: g.sub || '' };
      }),
    };
  });

  EXTRA.forEach(function (s) {
    sections.push({ id: s.id, title: s.title, items: s.items });
  });

  EX.BRIEF_SECTIONS.forEach(function (s) {
    const items = s.items.map(function (it) {
      return { kind: 'brief', id: it.id, title: it.title, sub: it.sub || '' };
    });
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

  // 切面学习与 TEE 模拟器：纯链接条目
  // mp4 直链走站内播放页，其余外链仍复制到浏览器（小程序 web-view 受业务域名限制）
  EX.LINK_SECTIONS.forEach(function (s) {
    sections.push({
      id: s.id,
      title: s.title,
      note: s.note || '',
      items: s.items.map(function (it) {
        // 整本书 / 整套视频：目录只留一条入口，二级页里再列具体切面
        if (it.album) {
          return {
            kind: 'album', id: it.id, sec: s.id, title: it.title,
            sub: it.sub || '', count: (it.children || []).length,
          };
        }
        return {
          kind: 'link', id: it.id, title: it.title, sub: it.sub || '', url: it.url,
          video: isVideo(it.url),
        };
      }),
    });
  });

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
    bsaText: '—',
    countText: '',
    refs: EX.REFS,
    refsCount: EX.REFS.length,
    refsPdf: EX.REFS.filter(function (r) { return r.dl && r.dl.length; }).length,
    refsOpen: false,
    extLinks: [
      { url: 'https://zs-echo.com', name: '心超速查 ZS-Echo Copilot', desc: '86 个计算器 · 19 类参考值 · 瓣膜与决策流程' },
      { url: 'https://bdrwss.github.io/tte-quickref/dist/', name: 'TTE 心超速查 · 中文版', desc: '床旁速查卡片 · 测量与切面要点' },
    ],
    appVersion: V.APP_VERSION,
  },

  onLoad() {
    // 原始目录留在实例上，搜索时不必反复重建
    this.allSections = this.data.sections;
    this.setData({ countText: this.countTextOf(this.allSections) });
  },

  onShow() {
    const p = app.globalData.profile;
    this.setData({ bsaText: p && p.bsa ? p.bsa.toFixed(2) : '—' });
  },

  /** 参考文献默认折叠（40 条会把页面拉得很长），点标题才展开全部 */
  onToggleRefs() {
    this.setData({ refsOpen: !this.data.refsOpen });
  },

  /** 「共 N 项」/「找到 N 项」（hasKw 由调用方传入，避免读到还没刷新的 this.data.kw） */
  countTextOf(list, hasKw) {
    let n = 0;
    list.forEach(function (s) { n += s.items.length; });
    return (hasKw ? '找到 ' + n + ' 项' : '共 ' + n + ' 项');
  },

  /** 搜索框输入：实时过滤（条目总量不大，直接过滤，无需防抖） */
  onSearch(e) {
    const kw = ((e.detail && e.detail.value) || '').trim();
    if (!kw) {
      this.setData({
        kw: '', searching: false, sections: this.allSections,
        countText: this.countTextOf(this.allSections),
      });
      return;
    }
    const secs = searchSections(this.allSections, kw);
    this.setData({
      kw: kw,
      searching: true,
      sections: secs,
      countText: secs.length ? '找到 ' + kw : '没有匹配「' + kw + '」',
    });
  },

  /** 清空搜索 */
  onClearSearch() {
    this.setData({
      kw: '', searching: false, sections: this.allSections,
      countText: this.countTextOf(this.allSections),
    });
  },

  /**
   * 点击条目：
   *   album → 视频目录页（列出该专辑下的具体切面）
   *   link  → mp4 走站内播放页，其余复制外链
   *   valve → 瓣膜评估页并预选该瓣膜
   *   其余  → 公式 / 评估内容详情页
   */
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
        wx.navigateTo({
          url: '/pages/video/video?url=' + encodeURIComponent(d.url) +
            '&title=' + encodeURIComponent(d.title || ''),
        });
        return;
      }
      this.copyLink(d.url);
      return;
    }
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
});
