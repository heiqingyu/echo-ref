/**
 * 跨页签搜索：给「公式集」和「切面学习」互相数命中条数（v1.6.5）
 *
 * 两个页签的目录结构不同（公式集 = calc-groups.GROUPS + extra-data.BRIEF_SECTIONS；
 * 切面学习 = LINK_SECTIONS + 标了 segOnly 的条目），所以各写一个计数函数。
 * 只在需要显示「另一页签里还有 N 条 →」提示时调用，不参与任何渲染。
 *
 * ★ 计数口径必须和两边页面的实际过滤一致，否则提示的条数会对不上：
 *   - 公式集不含 segOnly 条目（那些只在切面学习页）
 *   - 切面学习的专辑要把子视频摊开算（搜「房间隔」能命中专辑里的某一节）
 */
const CG = require('./calc-groups.js');
const EX = require('./extra-data.js');

function hit(it, q) {
  return ((it.title || '') + ' ' + (it.sub || '')).toLowerCase().indexOf(q) !== -1;
}

/** 切面学习页签的命中数：切面速查（segOnly）+ 视频（含专辑子条目）+ TEE 演示 */
function segCount(kw) {
  const q = (kw || '').trim().toLowerCase();
  if (!q) return 0;
  let n = 0;
  (EX.BRIEF_SECTIONS || []).forEach(function (s) {
    (s.items || []).forEach(function (it) {
      if (it.segOnly && hit(it, q)) n++;
    });
  });
  // 瓣膜解剖 TEE 图谱（不在 BRIEF_SECTIONS 里，是切面学习页固定的一条）
  if (hit({ title: '瓣膜解剖 · TEE 标准切面' }, q)) n++;
  (EX.LINK_SECTIONS || []).forEach(function (s) {
    if (s.id !== 'views' && s.id !== 'sim') return;
    (s.items || []).forEach(function (it) {
      if (hit(it, q)) { n++; return; }
      if (!it.album) return;
      (it.children || []).forEach(function (c) { if (hit(c, q)) n++; });
    });
  });
  return n;
}

/** 公式集目录的命中数：计算组 + 评估判读（不含 segOnly） */
function calcCount(kw) {
  const q = (kw || '').trim().toLowerCase();
  if (!q) return 0;
  let n = 0;
  (CG.GROUPS || []).forEach(function (g) { if (hit(g, q)) n++; });
  (EX.BRIEF_SECTIONS || []).forEach(function (s) {
    (s.items || []).forEach(function (it) {
      if (!it.segOnly && hit(it, q)) n++;
    });
  });
  return n;
}

module.exports = { segCount: segCount, calcCount: calcCount };
