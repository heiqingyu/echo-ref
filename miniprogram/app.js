/**
 * 心脏超声参考值查询小程序
 * 说明：本小程序为纯数值计算工具，不提供任何诊断或治疗建议。
 */
App({
  globalData: {
    /** 用户基本参数，各页面共享 */
    profile: {
      sex: 'male',
      height: 170,
      weight: 65,
      bsa: 1.75,
    },
    /** 参考标准：CN（中国成人） | ASE（国际） */
    standard: 'CN',
    /** EF 计算（首页最上方）的测量值缓存，供参考值列表对照 */
    measurements: {
      lvedd: 50,
      lvesd: 32,
      ivsd: 9,
      lvpwd: 9,
    },
    /**
     * 跨页签搜索的关键词中转（v1.6.5）
     * wx.switchTab 不能带参数，所以「公式集 ↔ 切面学习」互跳时先把词放这里，
     * 目标页 onShow 取走并清空（不清会让下次切页签又筛一遍）。
     */
    pendingCalcKw: '',
    pendingSegKw: '',
    /**
     * 条目详情页点「本条目引用」的文献 → 切到公式集并定位该条（v1.11.3）
     * 同样是因为 wx.switchTab 不能带参数；目标页取走即清空。
     */
    pendingRef: '',
  },

  onLaunch() {
    // 本工具无需登录、无需联网，所有计算均在本地完成
    console.log('[echo-ref] launched');
    this.checkUpdate();
  },

  /* ★ 主动更新提示（v1.13.9）
     微信只在小程序「冷启动」时检查新版，且下载完成后要再冷启动一次才生效，
     所以用户常以为「发布了却还是旧版」。检测到新包就提示重启，
     applyUpdate() 会立即重载，不用删小程序、也不用等微信被系统回收。 */
  checkUpdate() {
    if (!wx.getUpdateManager) return;
    const um = wx.getUpdateManager();
    um.onUpdateReady(() => {
      wx.showModal({
        title: '发现新版本',
        content: '新版本已下载完成，重启后生效。是否立即重启？',
        confirmText: '立即重启',
        cancelText: '稍后',
        success: (res) => {
          if (res.confirm) um.applyUpdate();
        },
      });
    });
  },
});
