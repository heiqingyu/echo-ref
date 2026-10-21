const VS = require('../../utils/valve-svg.js');

/**
 * 瓣膜解剖页：瓣叶分区 / 分叶 / 分段的 TTE/TEE 示意图
 *
 * 与「节段划分」页同一套交互范式：
 *   - 示意图用 SVG data URI 渲染（小程序 image 组件）
 *   - 下方色块按钮选择解剖分区 → 全部视图同步高亮同一结构
 *
 * 视图按瓣膜分组（主动脉瓣 / 二尖瓣 / 三尖瓣 / 肺动脉瓣），
 * 每个瓣膜只显示自己相关的视图，避免一屏 7 张图过于拥挤。
 */
Page({
  data: {
    groups: [],
    cur: 'av',
    sel: null,
    selInfo: '',
  },

  onLoad() {
    // ★ 用户 2026-10-21：教学视频与交互教学站与「切面学习 / TEE 模拟器」重复，
    //   本页不再单列，只保留分区示意图。
    this.rebuild();
  },

  /** 重新生成全部 SVG（按当前瓣膜分组） */
  rebuild() {
    const sel = this.data.sel;
    const byGroup = {};
    VS.VALVE_VIEWS.forEach(function (v) {
      if (!byGroup[v.group]) byGroup[v.group] = [];
      byGroup[v.group].push(v);
    });

    const order = ['主动脉瓣', '二尖瓣', '三尖瓣', '肺动脉瓣'];
    const groups = order.map(function (g) {
      const views = (byGroup[g] || []).map(function (v) {
        // 该视图可见的分区，做成可点的色块按钮
        const chips = v.parts.map(function (id) {
          const p = VS.PART_INDEX[id];
          return { id: id, n: p ? p.abbr : id, color: p ? p.color : '#64748b', name: p ? p.name : id };
        });
        return {
          id: v.id,
          title: v.title,
          sub: v.sub,
          chips: chips,
          src: 'data:image/svg+xml;base64,' + VS.utf8ToBase64(v.fn({ sel: sel })),
        };
      });
      return { id: g, title: g, views: views };
    }).filter(function (g) { return g.views.length; });

    this.setData({
      groups: groups,
      selInfo: sel ? VS.partInfoText(sel) : '',
    });
  },

  /** 点击分区 → 全页同步高亮 / 取消 */
  onPart(e) {
    const id = e.currentTarget.dataset.p;
    this.setData({ sel: this.data.sel === id ? null : id });
    this.rebuild();
  },

  onClear() {
    this.setData({ sel: null });
    this.rebuild();
  },

});
