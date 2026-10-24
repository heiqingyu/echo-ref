const segSvg = require('../../utils/segment-svg.js');
const DATA = require('../../utils/segment-data.js');

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
  },

  onLoad() {
    this.rebuild();
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
});
