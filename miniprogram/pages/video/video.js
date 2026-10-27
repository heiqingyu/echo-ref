// pages/video/video.js —— 站内视频播放页
//
// 用途：目录里 url 以 .mp4 结尾的条目（《实用超声规范化检查与操作》配套动图）
// 直接在本页用 video 组件播放，不必复制链接到系统浏览器。
// video 组件的 src 不受 downloadFile 合法域名限制，故无需在小程序后台配置。
Page({
  data: {
    url: '',
    title: '',
    errText: '',
  },

  onLoad(query) {
    // ★ v1.8.9：只在上游没解过码时才 decode。
    //   微信会把页面参数解一次码，若这里无条件再解一次，飞利浦那种**全中文 percent-encode**
    //   的地址（`live_broadcast/%E8%B6%85%E5%A3%B0/...`）就变成裸中文，
    //   再交给 video 组件重新编码一次，容易与 OSS 对象名对不上。以 `http` 开头即视为已解码。
    const rawUrl = (query && query.url) || '';
    const url = /^https?%3A/i.test(rawUrl) ? decodeURIComponent(rawUrl) : rawUrl;
    const rawTitle = (query && query.title) || '';
    const title = /%[0-9A-Fa-f]{2}/.test(rawTitle) ? decodeURIComponent(rawTitle) : rawTitle;

    // 只接受 https 的 mp4，避免被拼接成非法地址
    if (!/^https:\/\/.+\.mp4(\?|$)/i.test(url)) {
      this.setData({ errText: '视频地址无效' });
      return;
    }

    this.setData({ url: url, title: title });
    if (title) {
      wx.setNavigationBarTitle({ title: title });
    }
  },

  /** 播放失败（网络 / 源站失效）时给出可操作的提示 */
  onError() {
    this.setData({ errText: '视频加载失败，请检查网络后重试' });
  },

  /** 复制直链，便于在浏览器里打开或另存 */
  onCopy() {
    if (!this.data.url) return;
    wx.setClipboardData({
      data: this.data.url,
      success() {
        wx.showToast({ title: '链接已复制', icon: 'none' });
      },
    });
  },
});
