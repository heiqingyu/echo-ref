// pages/video/video.js —— 站内视频播放页
//
// 用途：目录 / 专辑里 url 以 .mp4 结尾的条目，直接在本页用 video 组件播放，
// 不必复制链接到系统浏览器。video 组件的 src 不受 downloadFile 合法域名限制，
// 故无需在小程序后台配置业务域名。
//
// ★★ v1.9.0 关键改动：不再靠 URL 传参
//   之前用 `?url=` + encodeURIComponent 传地址。飞利浦那批地址是**全中文 percent-encode**
//   （`live_broadcast/%E8%B6%85%E5%A3%B0/...`），经微信 query 解析再 encode/decode 一轮
//   极易失真，实测会落到「视频地址无效」。改成传 `sec` + `item` + `kid` 三个 id，
//   本页自己去 extra-data 里取地址，编码链彻底断掉。`url` 参数只作旧链接兜底。
const EX = require('../../utils/extra-data.js');

/** 按 id 定位条目（专辑子条目用 kid，专辑本身用 item） */
function findEntry(secId, itemId, kid) {
  const secs = EX.LINK_SECTIONS || [];
  const sec = secs.filter(function (s) { return s.id === secId; })[0];
  if (!sec) return null;
  const it = (sec.items || []).filter(function (i) { return i.id === itemId; })[0];
  if (!it) return null;
  if (!kid) return { url: it.url || '', title: it.title || '' };
  const sub = (it.children || []).filter(function (c) { return c.id === kid; })[0];
  return sub ? { url: sub.url || '', title: sub.title || '' } : null;
}

/** 多层 percent 解码，最多 3 轮；已明文 http 开头就不再解 */
function unq(v) {
  let s = String(v || '');
  for (let i = 0; i < 3 && !/^https?:\/\//i.test(s) && s.indexOf('%') >= 0; i++) {
    try {
      s = decodeURIComponent(s);
    } catch (e) {
      break;
    }
  }
  return s;
}

/** 标题只解一层，避免标题里的字面 % 被反复解坏 */
function unqTitle(v) {
  let s = String(v || '');
  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try {
      s = decodeURIComponent(s);
    } catch (e) {
      /* 保持原样 */
    }
  }
  return s;
}

Page({
  data: {
    url: '',
    title: '',
    errText: '',
    hint: '',
    copyUrl: '',
  },

  onLoad(query) {
    const q = query || {};
    let url = '';
    let title = '';

    // ① 首选：按 id 取，编码链最短
    if (q.item) {
      const e = findEntry(q.sec || 'views', q.item, q.kid || '');
      if (e) {
        url = e.url || '';
        title = e.title || '';
      }
    }
    // ② 兜底：旧的 ?url= 直达（纯 ASCII 地址）
    if (!url && q.url) url = unq(q.url);
    if (!title && q.title) title = unqTitle(q.title);

    if (!url) {
      this.setData({ errText: '没有找到这条视频的地址，请返回重新进入。' });
      return;
    }

    // mp4 直链才用 video 组件；网页 / HLS 索引页给可复制的提示
    const isMp4 = /^https?:\/\/\S+\.mp4(\?\S*)?$/i.test(url);

    this.setData({
      url: isMp4 ? url : '',
      copyUrl: url,
      title: title,
      hint: isMp4 ? '' : '这条指向网页播放页（HLS 分片），小程序内不能直接播。点下方复制直链，用浏览器打开。',
      errText: '',
    });

    if (title) {
      wx.setNavigationBarTitle({ title: title.slice(0, 16) });
    }
  },

  /** 播放失败（网络 / 源站限速 / 未做 faststart）时给出可操作的提示 */
  onError() {
    this.setData({ errText: '视频加载失败：源站可能限速，或该片未做 faststart。请点下方复制直链，用浏览器打开。' });
  },

  /** 复制直链，便于在浏览器里打开或另存 */
  onCopy() {
    const u = this.data.copyUrl || this.data.url;
    if (!u) return;
    wx.setClipboardData({
      data: u,
      success() {
        wx.showToast({ title: '链接已复制', icon: 'none' });
      },
    });
  },
});
