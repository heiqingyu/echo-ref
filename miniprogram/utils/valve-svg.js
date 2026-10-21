/**
 * valve-svg.js — 瓣膜分区 / 分叶 / 分段示意图生成器（纯函数，两端共用）
 *
 * 仿 segment-svg.js 的模式：小程序端转 data URI 给 <image>，
 * 网页端直接输出 SVG 字符串插入 DOM。
 *
 * 内容涵盖（用户需求「瓣叶分区、分叶、分段的 TTE/TEE 示意图」）：
 *   ① 主动脉瓣三叶分区（TTE 短轴钟面位 / TEE 短轴 30–60°）
 *   ② 二尖瓣分叶（TTE 四腔心 / TEE 60° 交界切面 / 瓣口面积占比）
 *   ③ 三尖瓣三个瓣叶（TTE 四腔心）
 *   ④ 肺动脉瓣（TTE 胸骨旁短轴）
 *
 * 交互：点击色块 → 各视图同步高亮同一解剖结构（opts.sel）
 */

/** 各瓣膜分区配色 */
const PALETTE = {
  rcc: '#2563eb',   // 右冠叶
  lcc: '#0f9d58',   // 左冠叶
  ncc: '#d97706',   // 无冠叶
  p1: '#2563eb', p2: '#3b82f6', p3: '#6366f1',           // 二尖瓣前叶
  a1: '#d97706', a2: '#f59e0b', a3: '#f97316',           // 二尖瓣后叶
  ant: '#2563eb', sep: '#0f9d58', post: '#d97706',        // 三尖瓣：前叶/隔叶/后叶
  pv: '#7c3aed',                                       // 肺动脉瓣
};

/** 主动脉瓣三叶命名与位置（TTE 短轴钟面位） */
const AV_CUSPS = [
  { id: 'rcc', name: '右冠叶', abbr: 'RCC', color: PALETTE.rcc },
  { id: 'lcc', name: '左冠叶', abbr: 'LCC', color: PALETTE.lcc },
  { id: 'ncc', name: '无冠叶', abbr: 'NCC', color: PALETTE.ncc },
];

/** 二尖瓣分叶：前叶 P1–P3、后叶 A1–A3 */
const MV_SEGMENTS = [
  { id: 'p1', name: '前叶 P1', abbr: 'P1', color: PALETTE.p1 },
  { id: 'p2', name: '前叶 P2', abbr: 'P2', color: PALETTE.p2 },
  { id: 'p3', name: '前叶 P3', abbr: 'P3', color: PALETTE.p3 },
  { id: 'a1', name: '后叶 A1', abbr: 'A1', color: PALETTE.a1 },
  { id: 'a2', name: '后叶 A2', abbr: 'A2', color: PALETTE.a2 },
  { id: 'a3', name: '后叶 A3', abbr: 'A3', color: PALETTE.a3 },
];

/** 三尖瓣三个瓣叶 */
const TV_LEAFLETS = [
  { id: 'ant', name: '前叶', abbr: '前叶', color: PALETTE.ant },
  { id: 'sep', name: '隔叶', abbr: '隔叶', color: PALETTE.sep },
  { id: 'post', name: '后叶', abbr: '后叶', color: PALETTE.post },
];

/* ══════════════════════════════════════════════════════════
   通用绘图工具
   ══════════════════════════════════════════════════════════ */

const RAD = Math.PI / 180;

function f1(n) { return (Math.round(n * 10) / 10).toFixed(1); }

/** 极坐标 → 直角坐标（0° 在右，顺时针为正，与 SVG 约定一致） */
function pt(cx, cy, r, deg) {
  return [cx + r * Math.cos(deg * RAD), cy + r * Math.sin(deg * RAD)];
}

/** 环形扇块路径（a → b 顺时针） */
function wedge(cx, cy, ri, ro, a, b) {
  const p1 = pt(cx, cy, ro, a);
  const p2 = pt(cx, cy, ro, b);
  const p3 = pt(cx, cy, ri, b);
  const p4 = pt(cx, cy, ri, a);
  const large = (b - a) > 180 ? 1 : 0;
  return 'M' + f1(p1[0]) + ' ' + f1(p1[1]) +
    ' A' + ro + ' ' + ro + ' 0 ' + large + ' 1 ' + f1(p2[0]) + ' ' + f1(p2[1]) +
    ' L' + f1(p3[0]) + ' ' + f1(p3[1]) +
    ' A' + ri + ' ' + ri + ' 0 ' + large + ' 0 ' + f1(p4[0]) + ' ' + f1(p4[1]) + ' Z';
}

function lab(x, y, t, size, color, weight) {
  return '<text x="' + f1(x) + '" y="' + f1(y) + '" text-anchor="middle" font-size="' + (size || 16) +
    '" font-weight="' + (weight || 600) + '" fill="' + (color || '#64748b') + '">' + t + '</text>';
}

function labL(x, y, t, size, color, weight) {
  return '<text x="' + f1(x) + '" y="' + f1(y) + '" text-anchor="start" font-size="' + (size || 15) +
    '" font-weight="' + (weight || 600) + '" fill="' + (color || '#64748b') + '">' + t + '</text>';
}

function chamber(d, fill) {
  return '<path d="' + d + '" fill="' + (fill || '#eef1f5') + '" stroke="#94a3b8" stroke-width="2"/>';
}

function ell(cx, cy, rx, ry, fill) {
  return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry +
    '" fill="' + (fill || '#eef1f5') + '" stroke="#94a3b8" stroke-width="2"/>';
}

function svgWrap(content, box, label) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + box + '" width="100%" role="img" aria-label="' + label + '">' +
    '<rect x="0" y="0" width="100%" height="100%" rx="10" fill="#fafbfc"/>' + content + '</svg>';
}

/**
 * 可点击的解剖分区色块
 * @param {string} id     分区 id（用于联动高亮）
 * @param {string} d      路径
 * @param {string} color  填充色
 * @param {string} sel    当前选中分区
 * @param {string} text   色块内文字
 * @param {number} tx,ty  文字位置
 */
function part(id, d, color, sel, text, tx, ty, fs) {
  const on = sel === id;
  const stroke = on ? '#1e293b' : '#ffffff';
  const sw = on ? 4.5 : 2;
  let s = '<g data-part="' + id + '">' +
    '<path d="' + d + '" fill="' + color + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
  if (text) {
    s += '<text x="' + f1(tx) + '" y="' + f1(ty) + '" text-anchor="middle" fill="#ffffff" font-size="' +
      (fs || 16) + '" font-weight="700" pointer-events="none">' + text + '</text>';
  }
  return s + '</g>';
}

/** 有选中时，未选中的分区变灰 */
function dimColor(color, sel, id) {
  if (!sel) return color;
  return sel === id ? color : '#d3d7de';
}

/**
 * 房室瓣叶（半月形）：沿一条基线向指定方向鼓出
 * @param {number} s 鼓出方向：1 向下（朝心室），-1 向上
 */
function leafletPath(x, y, w, h, s) {
  return 'M' + f1(x - w) + ' ' + f1(y) +
    ' Q' + f1(x) + ' ' + f1(y + s * h) + ' ' + f1(x + w) + ' ' + f1(y) +
    ' L' + f1(x + w) + ' ' + f1(y + s * 13) +
    ' Q' + f1(x) + ' ' + f1(y + s * 13 + s * h) + ' ' + f1(x - w) + ' ' + f1(y + s * 13) + ' Z';
}

/** 画一个瓣叶色块 */
function leaflet(id, x, y, w, h, s, text, sel, fs) {
  return part(id, leafletPath(x, y, w, h, s),
    dimColor(PALETTE[id], sel, id), sel, text, x, y + s * (h * 0.6), fs || 15);
}

/* ══════════════════════════════════════════════════════════
   ① 主动脉瓣三叶分区
   ══════════════════════════════════════════════════════════ */

/**
 * TTE 胸骨旁短轴（主动脉瓣水平）钟面位
 * 三叶呈 Y 形闭合；右冠叶约 1–2 点、左冠叶约 4–5 点、无冠叶约 8–10 点
 */
function avTteSaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 210, cy = 210;
  let n = '';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="152" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="120" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>';
  // 三叶各占一个窦（120° 一块），中心闭合点
  const a0 = -118, a1 = -62, a2 = -58, a3 = 2, a4 = 8, a5 = 128, a6 = 172, a7 = -172;
  n += part('rcc', wedge(cx, cy, 14, 120, a0, a1), dimColor(PALETTE.rcc, sel, 'rcc'), sel, 'RCC',
    ...pt(cx, cy, 74, (a0 + a1) / 2));
  n += part('lcc', wedge(cx, cy, 14, 120, a2, a3), dimColor(PALETTE.lcc, sel, 'lcc'), sel, 'LCC',
    ...pt(cx, cy, 74, (a2 + a3) / 2));
  n += part('ncc', wedge(cx, cy, 14, 120, a4, a5), dimColor(PALETTE.ncc, sel, 'ncc'), sel, 'NCC',
    ...pt(cx, cy, 74, (a4 + a5) / 2));
  // 闭合的三条交线（Y 形）
  const Y = [[-90, -30], [30, 90], [150, 210]];
  Y.forEach(function (seg) {
    const p1 = pt(cx, cy, 118, seg[0]);
    const p2 = pt(cx, cy, 14, seg[1]);
    n += '<path d="M' + f1(p1[0]) + ' ' + f1(p1[1]) + ' L' + f1(p2[0]) + ' ' + f1(p2[1]) +
      '" stroke="#ffffff" stroke-width="3"/>';
  });
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="13" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>';
  // 冠状动脉开口：RCA 起自右冠窦、LCA 起自左冠窦
  n += labL(cx + 96, cy - 118, 'RCA 开口', 13, '#dc2626');
  n += labL(cx + 92, cy + 128, 'LCA 开口', 13, '#dc2626');
  n += lab(cx, cy - 164, '前壁（前）', 14, '#94a3b8');
  n += lab(cx, cy + 176, '后壁（后）', 14, '#94a3b8');
  n += lab(cx, 246, 'LVOT', 15, '#94a3b8');
  return svgWrap(n, '0 0 420 420', '主动脉瓣 TTE 短轴三叶分区示意图');
}

/**
 * TEE 短轴 30–60°：主动脉瓣三叶（屏幕方位与 TTE 不同）
 */
function avTeeSaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 210, cy = 205;
  let n = '';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="142" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="112" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>';
  // TEE 视角：右冠叶在屏幕左上、左冠叶在右上、无冠叶在下方
  n += part('rcc', wedge(cx, cy, 14, 112, -142, -82), dimColor(PALETTE.rcc, sel, 'rcc'), sel, 'RCC',
    ...pt(cx, cy, 70, -112));
  n += part('lcc', wedge(cx, cy, 14, 112, -78, -18), dimColor(PALETTE.lcc, sel, 'lcc'), sel, 'LCC',
    ...pt(cx, cy, 70, -48));
  n += part('ncc', wedge(cx, cy, 14, 112, -14, 106), dimColor(PALETTE.ncc, sel, 'ncc'), sel, 'NCC',
    ...pt(cx, cy, 70, 46));
  const Y = [[-112, -52], [8, 68], [128, 188]];
  Y.forEach(function (seg) {
    const p1 = pt(cx, cy, 110, seg[0]);
    const p2 = pt(cx, cy, 14, seg[1]);
    n += '<path d="M' + f1(p1[0]) + ' ' + f1(p1[1]) + ' L' + f1(p2[0]) + ' ' + f1(p2[1]) +
      '" stroke="#ffffff" stroke-width="3"/>';
  });
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="13" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>';
  n += lab(cx, cy - 152, 'TEE 30–60° 短轴', 15, '#94a3b8');
  n += lab(cx, cy + 164, 'LA（近场，在屏幕下方）', 14, '#94a3b8');
  n += lab(cx, cy + 190, '冠脉开口位置与 TTE 相反，须以解剖标志核实', 12, '#dc2626');
  return svgWrap(n, '0 0 420 410', '主动脉瓣 TEE 短轴三叶分区示意图');
}

/* ══════════════════════════════════════════════════════════
   ② 二尖瓣分叶
   ══════════════════════════════════════════════════════════ */

/**
 * TTE 四腔心：二尖瓣前叶 / 后叶大系
 * 房室瓣环在左房与左室交界处 ≈ y450；前叶在屏幕右上（P 系），后叶在左下（A 系）
 */
function mvTteA4cSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  const lvCx = 300, lvCy = 250, rx = 100, ry = 190;
  // 右心（屏幕左）
  n += chamber('M108 430 C58 370 63 210 103 168 C151 112 208 196 208 300 C208 352 198 396 184 430 Z');
  n += lab(142, 300, 'RV', 19);
  n += ell(140, 492, 70, 42) + lab(140, 498, 'RA', 19);
  n += ell(lvCx, 492, 82, 42) + lab(lvCx, 498, 'LA', 19);
  // 左室腔（心尖朝上）
  n += ell(lvCx, lvCy, rx, ry);
  // 瓣环平面
  const VY = 450;
  // 前叶 P（向心尖方向鼓 = 向上，s = -1），沿室间隔侧 P3 → P1
  n += leaflet('p3', 330, VY - 2, 44, 40, -1, 'P3', sel, 16);
  n += leaflet('p2', 362, VY - 34, 40, 36, -1, 'P2', sel, 16);
  n += leaflet('p1', 330, VY - 66, 36, 30, -1, 'P1', sel, 16);
  // 后叶 A2（向左室后壁方向鼓 = 向下）
  n += leaflet('a2', 258, VY + 6, 42, 36, 1, 'A2', sel, 16);
  n += lab(300, 300, 'LV', 19);
  n += lab(196, 414, 'TV', 14);
  n += lab(300, 66, '心尖', 14, '#94a3b8');
  n += lab(240, 552, '四腔心只能分辨前叶 / 后叶大系，精确分叶需 TEE 交界切面', 13, '#94a3b8');
  return svgWrap(n, '0 0 480 566', '二尖瓣 TTE 四腔心分叶示意图');
}

/**
 * TEE 60° 交界切面（commissural view）：同屏可见 P1、A2、P3 与两个交界
 */
function mvTeeCommissuralSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  // 左房（近场，上方）
  n += chamber('M116 34 Q240 2 364 34 L358 132 Q240 104 122 132 Z');
  n += lab(240, 74, 'LA（近场）', 15);
  // 左室（远场，下方）
  n += ell(240, 380, 132, 112);
  n += lab(240, 386, 'LV（远场）', 16);
  // 瓣环平面 ≈ y200；三个叶段沿同一条线排开
  const VY = 196;
  n += leaflet('p1', 138, VY, 46, 36, -1, 'P1', sel);
  n += leaflet('a2', 240, VY - 4, 46, 38, -1, 'A2', sel);
  n += leaflet('p3', 342, VY, 46, 36, -1, 'P3', sel);
  // 两个交界（虚线）
  n += '<path d="M184 190 L184 224" stroke="#dc2626" stroke-width="3" stroke-dasharray="5 4"/>';
  n += '<path d="M296 190 L296 224" stroke="#dc2626" stroke-width="3" stroke-dasharray="5 4"/>';
  n += lab(184, 240, '交界', 12, '#dc2626');
  n += lab(296, 240, '交界', 12, '#dc2626');
  n += lab(240, 140, 'TEE 60° 交界切面', 15, '#94a3b8');
  n += lab(240, 520, '前叶 P 在近场呈弧形，后叶 A2 位于远场中部', 13, '#94a3b8');
  return svgWrap(n, '0 0 480 536', '二尖瓣 TEE 交界切面分叶示意图');
}

/**
 * 二尖瓣叶分区面积示意（前叶 vs 后叶），用于「分区」概念
 */
function mvAreaSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  const cx = 210, cy = 200;
  n += part('p1', wedge(cx, cy, 16, 130, -172, -128), dimColor(PALETTE.p1, sel, 'p1'), sel, 'P1', ...pt(cx, cy, 82, -150));
  n += part('p2', wedge(cx, cy, 16, 130, -128, -52), dimColor(PALETTE.p2, sel, 'p2'), sel, 'P2', ...pt(cx, cy, 82, -90));
  n += part('p3', wedge(cx, cy, 16, 130, -52, -8), dimColor(PALETTE.p3, sel, 'p3'), sel, 'P3', ...pt(cx, cy, 82, -30));
  n += part('a1', wedge(cx, cy, 16, 130, 8, 82), dimColor(PALETTE.a1, sel, 'a1'), sel, 'A1', ...pt(cx, cy, 82, 45));
  n += part('a2', wedge(cx, cy, 16, 130, 82, 148), dimColor(PALETTE.a2, sel, 'a2'), sel, 'A2', ...pt(cx, cy, 82, 115));
  n += part('a3', wedge(cx, cy, 16, 130, 148, 188), dimColor(PALETTE.a3, sel, 'a3'), sel, 'A3', ...pt(cx, cy, 82, 168));
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="14" fill="#fff" stroke="#94a3b8" stroke-width="2"/>';
  n += lab(cx, cy - 148, '前叶（蓝）≈ 60% 瓣口面积', 15, '#2563eb');
  n += lab(cx, cy + 158, '后叶（橙）≈ 40% 瓣口面积', 15, '#d97706');
  n += lab(cx, cy + 186, '交界区：P1–A1 / P3–A3', 13, '#dc2626');
  return svgWrap(n, '0 0 420 430', '二尖瓣叶分区面积示意图');
}

/* ══════════════════════════════════════════════════════════
   ③ 三尖瓣瓣叶
   ══════════════════════════════════════════════════════════ */

/** TTE 四腔心：三尖瓣隔叶（靠室间隔）+ 前叶 */
function tvTteSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  const lvCx = 300, lvCy = 250;
  n += chamber('M108 430 C58 370 63 210 103 168 C151 112 208 196 208 300 C208 352 198 396 184 430 Z');
  n += lab(142, 300, 'RV', 19);
  n += ell(140, 492, 70, 42) + lab(140, 498, 'RA', 19);
  n += ell(lvCx, 492, 82, 42) + lab(lvCx, 498, 'LA', 19);
  n += ell(lvCx, lvCy, 100, 190);
  // 三尖瓣：位于 RA/RV 交界 ≈ y440，隔叶靠室间隔（右），前叶靠前壁/游离壁（左）
  const VY = 440;
  n += leaflet('sep', 180, VY, 38, 34, -1, '隔叶', sel, 15);
  n += leaflet('ant', 124, VY - 32, 36, 28, -1, '前叶', sel, 15);
  n += lab(300, 300, 'LV', 19);
  n += lab(150, 414, 'TV', 14);
  n += lab(300, 66, '心尖', 14, '#94a3b8');
  n += lab(240, 552, '后叶需胸骨旁短轴右室流入道切面，四腔心不显示', 13, '#94a3b8');
  return svgWrap(n, '0 0 480 566', '三尖瓣 TTE 四腔心瓣叶示意图');
}

/* ══════════════════════════════════════════════════════════
   ④ 肺动脉瓣
   ══════════════════════════════════════════════════════════ */

function pvSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  const cx = 210, cy = 205;
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="122" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="96" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>';
  // 三个独立的半月瓣（瓣叶呈弧形，彼此不相连）
  const cusps = [[-120, -60], [0, 60], [120, 180]];
  cusps.forEach(function (c) {
    const p1 = pt(cx, cy, 96, c[0]);
    const p2 = pt(cx, cy, 96, c[1]);
    const mid = pt(cx, cy, 52, (c[0] + c[1]) / 2);
    const mid2 = pt(cx, cy, 80, (c[0] + c[1]) / 2);
    n += part('pv',
      'M' + f1(p1[0]) + ' ' + f1(p1[1]) +
      ' Q' + f1(mid[0]) + ' ' + f1(mid[1]) + ' ' + f1(p2[0]) + ' ' + f1(p2[1]) +
      ' Q' + f1(mid2[0]) + ' ' + f1(mid2[1]) +
      ' ' + f1(p1[0]) + ' ' + f1(p1[1]) + ' Z',
      dimColor(PALETTE.pv, sel, 'pv'), sel, '', 0, 0);
  });
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="10" fill="#fff" stroke="#94a3b8" stroke-width="2"/>';
  n += lab(cx, cy - 136, '肺动脉瓣环（TTE 胸骨旁短轴）', 15, '#94a3b8');
  n += lab(cx, cy + 148, '三个半月瓣，不单独命名', 14, '#7c3aed');
  n += lab(cx, cy + 172, '与主动脉瓣不同，无冠窦命名', 12, '#94a3b8');
  return svgWrap(n, '0 0 420 410', '肺动脉瓣示意图');
}

/* ══════════════════════════════════════════════════════════
   视图元数据（与 segment-svg.js 的 WALL_VIEWS 同构）
   ══════════════════════════════════════════════════════════ */

const VALVE_VIEWS = [
  {
    id: 'avTteSax',
    group: '主动脉瓣',
    title: '主动脉瓣 · TTE 胸骨旁短轴',
    sub: '三叶分区（钟面位）· 右冠叶 RCC / 左冠叶 LCC / 无冠叶 NCC',
    parts: ['rcc', 'lcc', 'ncc'],
    fn: avTteSaxSvg,
  },
  {
    id: 'avTeeSax',
    group: '主动脉瓣',
    title: '主动脉瓣 · TEE 短轴 30–60°',
    sub: '同样三叶，但屏幕方位与 TTE 相反，注意冠脉开口位置',
    parts: ['rcc', 'lcc', 'ncc'],
    fn: avTeeSaxSvg,
  },
  {
    id: 'mvArea',
    group: '二尖瓣',
    title: '二尖瓣 · 分叶与瓣口面积',
    sub: '前叶 P1–P3 约占 60%，后叶 A1–A3 约占 40%',
    parts: ['p1', 'p2', 'p3', 'a1', 'a2', 'a3'],
    fn: mvAreaSvg,
  },
  {
    id: 'mvTteA4c',
    group: '二尖瓣',
    title: '二尖瓣 · TTE 四腔心',
    sub: '可见前叶 P1–P3 与后叶中段 A2',
    parts: ['p1', 'p2', 'p3', 'a2'],
    fn: mvTteA4cSvg,
  },
  {
    id: 'mvTeeCommissural',
    group: '二尖瓣',
    title: '二尖瓣 · TEE 60° 交界切面',
    sub: 'commissural view，同时看清 P1、A2、P3 与两个交界',
    parts: ['p1', 'a2', 'p3'],
    fn: mvTeeCommissuralSvg,
  },
  {
    id: 'tvTte',
    group: '三尖瓣',
    title: '三尖瓣 · TTE 四腔心',
    sub: '可见隔叶与前叶；后叶需胸骨旁短轴右室流入道切面',
    parts: ['ant', 'sep'],
    fn: tvTteSvg,
  },
  {
    id: 'pv',
    group: '肺动脉瓣',
    title: '肺动脉瓣 · TTE 胸骨旁短轴',
    sub: '三个半月瓣，不单独命名',
    parts: ['pv'],
    fn: pvSvg,
  },
];

/** 分区 id → 名称/颜色（全瓣膜统一索引） */
const PART_INDEX = (function () {
  const m = {};
  AV_CUSPS.concat(MV_SEGMENTS, TV_LEAFLETS).forEach(function (p) { m[p.id] = p; });
  m.pv = { id: 'pv', name: '肺动脉瓣', abbr: 'PA', color: PALETTE.pv };
  return m;
})();

/** 分区 id → 出现在哪些视图（用于说明文字） */
function viewsOfPart(id) {
  const out = [];
  VALVE_VIEWS.forEach(function (v) {
    if (v.parts.indexOf(id) >= 0) out.push(v.title);
  });
  return out;
}

/** 点击分区后的说明文字 */
function partInfoText(id) {
  const p = PART_INDEX[id];
  if (!p) return '';
  const views = viewsOfPart(id);
  return p.name + '（' + p.abbr + '）' + (views.length ? ' ｜ 见于：' + views.join('、') : '');
}

/* ══════════════════════════════════════════════════════════
   导出
   ══════════════════════════════════════════════════════════ */

/**
 * 简易 UTF-8 base64（小程序端 image 组件用 data URI）
 *
 * ★ 必须在本地定义，不能写成 `require('./segment-svg.js').utf8ToBase64`：
 *   build-www.js 的 wrapEngine 用静态分析提取 module.exports 的成员名，
 *   写成表达式会导致整个引擎被抽成空对象 { }（网页端示意图全空白）。
 */
function utf8ToBase64(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i);
    if (c < 0x80) {
      bytes.push(c);
    } else if (c < 0x800) {
      bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else {
      bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | ((b1 || 0) >> 4)];
    out += b1 === undefined ? '=' : chars[((b1 & 15) << 2) | ((b2 || 0) >> 6)];
    out += b2 === undefined ? '=' : chars[b2 & 63];
  }
  return out;
}

module.exports = {
  PALETTE,
  AV_CUSPS,
  MV_SEGMENTS,
  TV_LEAFLETS,
  VALVE_VIEWS,
  PART_INDEX,
  avTteSaxSvg,
  avTeeSaxSvg,
  mvAreaSvg,
  mvTteA4cSvg,
  mvTeeCommissuralSvg,
  tvTteSvg,
  pvSvg,
  viewsOfPart,
  partInfoText,
  utf8ToBase64,
};
