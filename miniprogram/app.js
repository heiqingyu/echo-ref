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

  /* ★ 静默更新（v1.13.9）
     微信只在小程序「冷启动」时检查新版，且新包下载完成后要再冷启动一次才生效，
     所以用户常以为「发布了却还是旧版」。
     这里不弹窗，直接 applyUpdate() 让新版本在本次启动内生效：
       · onUpdateReady 只在「冷启动 + 新包已下载」时触发，热启动不会来；
       · 只在启动后 3 秒内切 —— 这个窗口用户刚打开、还没开始输入，重载代价最小；
       · 超过窗口就什么也不做，留到下次冷启动自动生效（微信默认行为），同样不打扰。
     不弹窗是有意的：版本更新频繁，每次弹窗对使用者是噪音。 */
  checkUpdate() {
    if (!wx.getUpdateManager) return;
    const um = wx.getUpdateManager();
    const t0 = Date.now();
    um.onUpdateReady(() => {
      if (Date.now() - t0 < 3000) um.applyUpdate();
    });
  },
});
