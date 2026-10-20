const DATA = require('../../utils/valve-data.js');
const vcalc = require('../../utils/valve-calc.js');
const app = getApp();

/** 把数据块规整成视图模型（WXML 里不做逻辑） */
function toBlocks(sec) {
  return sec.blocks.map(function (b) {
    if (b.type === 'table') {
      return { kind: 'table', heads: b.heads, rows: b.rows, cols: b.heads.length };
    }
    if (b.type === 'h') return { kind: 'h', text: b.text };
    if (b.type === 'note') return { kind: 'note', text: b.text };
    if (b.type === 'formula') return { kind: 'formula', text: b.text };
    return { kind: 'text', text: b.text };
  });
}

/** 输入字段两两一行，便于左右并排 */
function toRows(fields) {
  const rows = [];
  for (let i = 0; i < fields.length; i += 2) rows.push(fields.slice(i, i + 2));
  return rows;
}

function findSec(id) {
  return DATA.VALVE_SECTIONS.find(function (s) { return s.id === id; });
}

Page({
  data: {
    tabs: DATA.VALVE_SECTIONS.map(function (s) {
      return { id: s.id, label: s.tab, name: s.short };
    }),
    cur: 'as',
    sec: null,
    fieldRows: [],
    collapse: DATA.IVC_COLLAPSE,
    collapseV: '',
    rows: [],
    notes: [],
    summary: '等待输入',
    level: 'none',
    bsaText: '—',
  },

  onLoad(query) {
    // 各瓣膜的输入值分瓣膜缓存，切换回来不丢
    this.values = {};
    DATA.VALVE_SECTIONS.forEach(function (s) { this.values[s.id] = {}; }, this);
    // 从「公式集」直接点 AS / MS 进来时，用 tab 参数预选该瓣膜
    const want = query && query.tab ? String(query.tab).toLowerCase() : '';
    this.select(findSec(want) ? want : 'as');
  },

  onShow() {
    const p = app.globalData.profile;
    this.setData({ bsaText: p && p.bsa ? p.bsa.toFixed(2) : '—' });
    this.refresh();
  },

  /** 切换瓣膜 */
  select(id) {
    const sec = findSec(id);
    if (!sec) return;
    const cache = this.values[id] || {};
    const fields = sec.fields.map(function (f) {
      return {
        k: f.k,
        n: f.n,
        u: f.u,
        opt: !!f.opt,
        value: cache[f.k] === undefined ? '' : cache[f.k],
      };
    });
    this.setData({
      cur: id,
      sec: {
        id: sec.id,
        name: sec.name,
        sub: sec.sub,
        source: sec.source,
        calcTitle: sec.calcTitle,
        hasCollapse: !!sec.collapse,
        blocks: toBlocks(sec),
      },
      fieldRows: toRows(fields),
      collapseV: cache.ivcCollapse || '',
    });
    this.refresh();
  },

  onTapTab(e) {
    this.select(e.currentTarget.dataset.id);
  },

  /** 输入只写缓存并重算结果，不整体重绘输入框（避免打断输入法） */
  onInput(e) {
    this.values[this.data.cur][e.currentTarget.dataset.k] = e.detail.value;
    this.refresh();
  },

  onCollapse(e) {
    const v = e.currentTarget.dataset.v;
    this.values[this.data.cur].ivcCollapse = v;
    this.setData({ collapseV: v });
    this.refresh();
  },

  onClear() {
    this.values[this.data.cur] = {};
    const fieldRows = this.data.fieldRows.map(function (r) {
      return r.map(function (f) { return Object.assign({}, f, { value: '' }); });
    });
    this.setData({
      fieldRows: fieldRows,
      collapseV: '',
      rows: [],
      notes: [],
      summary: '等待输入',
      level: 'none',
    });
  },

  /** 计算当前瓣膜 */
  refresh() {
    const cur = this.data.cur;
    if (!cur || !this.values[cur]) return;
    const cache = this.values[cur];
    const v = {};
    Object.keys(cache).forEach(function (k) {
      if (k === 'ivcCollapse') return;
      const n = parseFloat(cache[k]);
      if (cache[k] !== '' && !isNaN(n)) v[k] = n;
    });
    const p = app.globalData.profile;
    const bsa = p && p.bsa ? p.bsa : 0;
    const r = vcalc.valveCalc(cur, v, bsa);
    this.setData({
      rows: r.rows,
      notes: r.notes,
      summary: r.summary,
      level: r.level,
    });
  },
});
