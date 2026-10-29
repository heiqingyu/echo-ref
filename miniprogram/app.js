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
  },
});
