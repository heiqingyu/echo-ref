/**
 * valve-svg.js — 瓣膜分区 / 分叶 / 分段示意图生成器（纯函数，两端共用）
 *
 * 仿 segment-svg.js 的模式：小程序端转 data URI 给 <image>，
 * 网页端直接输出 SVG 字符串插入 DOM。
 *
 * ★ 解剖方位依据（2026-10-21 按指南逐条核对后重画）：
 *   - EAE/EACVI《Recommendations for transoesophageal echocardiography: update 2010》：
 *     TEE 主动脉瓣短轴「LCC 位于右上三分之一、NCC 位于左上三分之一、
 *     RCC 位于下方（偏前）」，并明确指出该切面「像是一个上下颠倒的
 *     胸骨旁主动脉瓣短轴切面」。冠脉开口约在 2 点（左冠）与 6 点（右冠）。
 *   - 中国《超声医学专科能力建设专用初级教材》：TEE 短轴「左冠瓣位于后方（近场）
 *     并在图像右侧，无冠瓣靠近房间隔，右冠瓣位于前方（远场）靠近 RVOT」。
 *   - 二尖瓣命名：前叶 = A1/A2/A3（Anterior），后叶 = P1/P2/P3（Posterior）
 *     （此前版本把 A/P 弄反了，本轮修正）。
 *   - TEE 二尖瓣交界切面（ME MC）：左边 P3、中间 A2、右边 P1。
 *   - 四腔心：主要显示 A2 与 P2。
 *
 * 交互：点击色块 → 各视图同步高亮同一解剖结构（opts.sel）
 */

/** 各瓣膜分区配色：前叶系（A）蓝、后叶系（P）橙 */
const PALETTE = {
  rcc: '#2563eb',   // 主动脉瓣 右冠叶
  lcc: '#0f9d58',   // 主动脉瓣 左冠叶
  ncc: '#d97706',   // 主动脉瓣 无冠叶
  a1: '#2563eb', a2: '#3b82f6', a3: '#6366f1',           // 二尖瓣 前叶 A1–A3
  p1: '#d97706', p2: '#f59e0b', p3: '#f97316',           // 二尖瓣 后叶 P1–P3
  ant: '#2563eb', sep: '#0f9d58', post: '#d97706',        // 三尖瓣：前叶/隔叶/后叶
};

/** 主动脉瓣三叶（TTE 短轴屏幕方位：RCC 上、LCC 右下、NCC 左下） */
const AV_CUSPS = [
  { id: 'rcc', name: '右冠叶', abbr: 'RCC', color: PALETTE.rcc },
  { id: 'lcc', name: '左冠叶', abbr: 'LCC', color: PALETTE.lcc },
  { id: 'ncc', name: '无冠叶', abbr: 'NCC', color: PALETTE.ncc },
];

/** 二尖瓣分叶：★ 前叶 = A1–A3（大，约 60% 瓣口面积）、后叶 = P1–P3（约 40%） */
const MV_SEGMENTS = [
  { id: 'a1', name: '前叶 A1', abbr: 'A1', color: PALETTE.a1 },
  { id: 'a2', name: '前叶 A2', abbr: 'A2', color: PALETTE.a2 },
  { id: 'a3', name: '前叶 A3', abbr: 'A3', color: PALETTE.a3 },
  { id: 'p1', name: '后叶 P1', abbr: 'P1', color: PALETTE.p1 },
  { id: 'p2', name: '后叶 P2', abbr: 'P2', color: PALETTE.p2 },
  { id: 'p3', name: '后叶 P3', abbr: 'P3', color: PALETTE.p3 },
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

/**
 * 半月瓣：外缘贴瓣环、内缘向中心鼓的扇形瓣叶
 * ★ 三叶各占 120°，拼起来正好铺满整个瓣口（覆盖 100%，不留空隙）
 */
function cuspPath(cx, cy, R, a0, a1) {
  const p1 = pt(cx, cy, R, a0);
  const p2 = pt(cx, cy, R, a1);
  const mid = (a0 + a1) / 2;
  const cp = pt(cx, cy, R * 0.16, mid);
  const large = (a1 - a0) > 180 ? 1 : 0;
  return 'M' + f1(p1[0]) + ' ' + f1(p1[1]) +
    ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + f1(p2[0]) + ' ' + f1(p2[1]) +
    ' Q' + f1(cp[0]) + ' ' + f1(cp[1]) + ' ' + f1(p1[0]) + ' ' + f1(p1[1]) + ' Z';
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
 * TTE 胸骨旁短轴（主动脉瓣水平）
 * 近场在屏幕上方 = RVOT（前）；远场在下方 = LA（后）。
 * RCC 靠 RVOT → 屏幕上方；LCC 靠肺动脉（患者左后）→ 屏幕右下；
 * NCC 靠房间隔（患者右后）→ 屏幕左下。三叶各 120°，铺满瓣口。
 */
function avTteSaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 212, cy = 202, R = 130;
  let n = '';
  // 主动脉根部 / 窦壁
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="164" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="146" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>';
  // 三叶（各 120°，覆盖 100%）
  n += part('rcc', cuspPath(cx, cy, R, -150, -30), dimColor(PALETTE.rcc, sel, 'rcc'), sel, 'RCC',
    ...pt(cx, cy, 82, -90));
  n += part('lcc', cuspPath(cx, cy, R, -30, 90), dimColor(PALETTE.lcc, sel, 'lcc'), sel, 'LCC',
    ...pt(cx, cy, 82, 34));
  n += part('ncc', cuspPath(cx, cy, R, 90, 210), dimColor(PALETTE.ncc, sel, 'ncc'), sel, 'NCC',
    ...pt(cx, cy, 82, 146));
  // 三个交界点（对合线交汇处）
  [-150, -30, 90].forEach(function (a) {
    const p = pt(cx, cy, R, a);
    n += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="3.5" fill="#ffffff" stroke="#64748b" stroke-width="1.5"/>';
  });
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>';
  // 冠脉开口：RCA 起自右冠窦（前），LCA 起自左冠窦（左后）
  const rca = pt(cx, cy, 146, -132);
  const lca = pt(cx, cy, 146, 34);
  n += '<circle cx="' + f1(rca[0]) + '" cy="' + f1(rca[1]) + '" r="7" fill="#dc2626" stroke="#fff" stroke-width="2"/>';
  n += '<circle cx="' + f1(lca[0]) + '" cy="' + f1(lca[1]) + '" r="7" fill="#dc2626" stroke="#fff" stroke-width="2"/>';
  n += lab(cx, cy - 178, '前（近场）：RVOT', 14, '#64748b');
  n += lab(cx, cy + 186, '后（远场）：LA', 14, '#64748b');
  n += lab(cx, cy + 212, '三叶各 120°，铺满整个瓣口；NCC 邻房间隔、RCC 邻 RVOT', 11, '#94a3b8');
  n += lab(cx, cy + 234, '红点 = 冠脉开口：RCA 起自右冠窦 · LCA 起自左冠窦', 11, '#dc2626');
  return svgWrap(n, '0 0 424 470', '主动脉瓣 TTE 短轴三叶分区示意图');
}

/**
 * TEE 食管中段短轴 30–60°（ME AV SAX）
 * ★ 与 TTE 上下颠倒：探头在左房后方，近场（屏幕上方）是 LA，
 *   远场（下方）才是 RVOT。故 RCC 在下方、LCC 右上、NCC 左上。
 *   依据 EAE 2010 TEE 指南；冠脉开口约 2 点（左冠）、6 点（右冠）。
 */
function avTeeSaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 212, cy = 202, R = 130;
  let n = '';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="164" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="146" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>';
  // LCC 右上、NCC 左上、RCC 下方 —— 与 TTE 上下颠倒
  n += part('lcc', cuspPath(cx, cy, R, -90, 30), dimColor(PALETTE.lcc, sel, 'lcc'), sel, 'LCC',
    ...pt(cx, cy, 82, -30));
  n += part('rcc', cuspPath(cx, cy, R, 30, 150), dimColor(PALETTE.rcc, sel, 'rcc'), sel, 'RCC',
    ...pt(cx, cy, 82, 90));
  n += part('ncc', cuspPath(cx, cy, R, 150, 270), dimColor(PALETTE.ncc, sel, 'ncc'), sel, 'NCC',
    ...pt(cx, cy, 82, 210));
  [-90, 30, 150].forEach(function (a) {
    const p = pt(cx, cy, R, a);
    n += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="3.5" fill="#ffffff" stroke="#64748b" stroke-width="1.5"/>';
  });
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>';
  // 冠脉开口：约 2 点（LCA，位于 LCC）、6 点（RCA，位于 RCC）
  const lca = pt(cx, cy, 146, -60);
  const rca = pt(cx, cy, 146, 90);
  n += '<circle cx="' + f1(lca[0]) + '" cy="' + f1(lca[1]) + '" r="7" fill="#dc2626" stroke="#fff" stroke-width="2"/>';
  n += '<circle cx="' + f1(rca[0]) + '" cy="' + f1(rca[1]) + '" r="7" fill="#dc2626" stroke="#fff" stroke-width="2"/>';
  n += lab(cx, cy - 178, '后（近场）：LA', 14, '#64748b');
  n += lab(cx, cy + 186, '前（远场）：RVOT', 14, '#64748b');
  n += lab(cx, cy + 212, '与 TTE 上下颠倒：近场是左房、远场才是 RVOT；NCC 紧邻房间隔', 11, '#94a3b8');
  n += lab(cx, cy + 234, '红点 = 冠脉开口（左冠约 2 点 · 右冠约 6 点）', 11, '#dc2626');
  return svgWrap(n, '0 0 424 470', '主动脉瓣 TEE 短轴三叶分区示意图');
}

/* ══════════════════════════════════════════════════════════
   ② 二尖瓣分叶
   ══════════════════════════════════════════════════════════ */

/**
 * TTE 心尖四腔心：只分辨前叶 / 后叶大系
 * 四腔心主要显示 A2（靠室间隔侧）与 P2（靠侧壁侧）。
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
  const VY = 452;
  // 前叶 A2：靠室间隔侧（屏幕左侧），较长；后叶 P2：靠侧壁侧，较短
  n += leaflet('a2', 270, VY, 46, 56, -1, 'A2', sel, 16);
  n += leaflet('p2', 350, VY, 36, 36, -1, 'P2', sel, 16);
  n += lab(300, 300, 'LV', 19);
  n += lab(196, 414, 'TV', 14);
  n += lab(300, 40, '心尖', 14, '#94a3b8');
  n += lab(240, 552, '四腔心只显示 A2 与 P2；精确分叶需 TEE 交界切面', 12, '#94a3b8');
  return svgWrap(n, '0 0 480 578', '二尖瓣 TTE 四腔心分叶示意图');
}

/**
 * TEE 二尖瓣交界切面（ME MC，45–60°，即常说的 commissural view）
 * ★ 屏幕方位：左 = P3、中 = A2、右 = P1（见《超声医学专科能力建设专用初级教材》）
 * A2 属前叶，位于远场，故较长、垂向 LV；P3 / P1 属后叶，位于近场。
 */
function mvTeeCommissuralSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  // 左房（近场，上方）
  n += ell(240, 104, 126, 62);
  n += lab(240, 110, 'LA（近场）', 15);
  // 左室（远场，下方）
  n += ell(240, 402, 138, 116);
  n += lab(240, 408, 'LV（远场）', 16);
  // 瓣环平面
  const VY = 212;
  n += '<path d="M92 ' + VY + ' L388 ' + VY + '" stroke="#cbd5e1" stroke-width="2"/>';
  // P3（左）、A2（中，较长）、P1（右）
  n += leaflet('p3', 146, VY, 48, 38, 1, 'P3', sel, 15);
  n += leaflet('a2', 240, VY, 50, 64, 1, 'A2', sel, 16);
  n += leaflet('p1', 334, VY, 48, 38, 1, 'P1', sel, 15);
  // 两个交界（虚线）
  n += '<path d="M192 ' + (VY - 12) + ' L192 ' + (VY + 36) + '" stroke="#dc2626" stroke-width="3" stroke-dasharray="5 4"/>';
  n += '<path d="M288 ' + (VY - 12) + ' L288 ' + (VY + 36) + '" stroke="#dc2626" stroke-width="3" stroke-dasharray="5 4"/>';
  n += lab(192, VY + 56, '交界', 12, '#dc2626');
  n += lab(288, VY + 56, '交界', 12, '#dc2626');
  n += lab(240, 22, 'TEE 45–60° 交界切面（ME MC）', 13, '#94a3b8');
  n += lab(240, 540, '左 P3 · 中 A2 · 右 P1（A2 在远场，显示更长）', 12, '#94a3b8');
  return svgWrap(n, '0 0 480 556', '二尖瓣 TEE 交界切面分叶示意图');
}

/**
 * 二尖瓣叶分区示意（瓣口正面观 / 3D 外科视角，主动脉瓣在上）
 *
 * ★ Carpentier–ASE/SCA 命名：前叶 = A1/A2/A3，后叶 = P1/P2/P3。
 *   P1 邻前外侧交界（本图左侧）、P2 居中、P3 邻后内侧交界（本图右侧）；
 *   A1/A3 分别位于 P1/P3 的正对面 → A1 与 P1、A3 与 P3 在两侧相邻。
 *   瓣环附着：后叶约占 2/3 周径、前叶约 1/3；但前叶自瓣环到游离缘更长
 *   （约为后叶两倍），故两叶面积大致相当（前叶略大，常引作 60%:40%）。
 */
function mvAreaSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 212, cy = 208, R = 128, ri = 14;
  let n = '';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="146" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
  // 上 = 前叶（A1 左 / A2 中 / A3 右）；下 = 后叶（P3 右 / P2 中 / P1 左）
  const segs = [
    ['a1', 180, 240], ['a2', 240, 300], ['a3', 300, 360],
    ['p3', 0, 60], ['p2', 60, 120], ['p1', 120, 180],
  ];
  segs.forEach(function (s) {
    const mid = (s[1] + s[2]) / 2;
    n += part(s[0], wedge(cx, cy, ri, R, s[1], s[2]),
      dimColor(PALETTE[s[0]], sel, s[0]), sel, s[0].toUpperCase(), ...pt(cx, cy, 88, mid));
  });
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="13" fill="#fff" stroke="#94a3b8" stroke-width="2"/>';
  // 两个交界的虚线分隔（A1/P1 左侧、A3/P3 右侧）
  n += '<path d="M' + (cx - R) + ' ' + cy + ' L' + (cx + R) + ' ' + cy + '" stroke="#dc2626" stroke-width="0" />';
  n += lab(cx, cy - 162, '前叶 A1–A3（贴主动脉瓣侧）', 15, '#2563eb');
  n += lab(cx, cy + 174, '后叶 P1–P3（贴左室后壁侧）', 15, '#d97706');
  n += lab(cx, cy + 206, '左＝前外侧交界（A1｜P1）　右＝后内侧交界（A3｜P3）', 12, '#dc2626');
  n += lab(cx, cy + 230, '后叶附着约 2/3 瓣环、前叶约 1/3；但前叶更长，两叶面积大致相当', 11, '#94a3b8');
  n += lab(cx, cy + 250, 'TEE 45–60° 交界切面与此图左右相反（左 P3 / 右 P1）', 11, '#94a3b8');
  return svgWrap(n, '0 0 424 480', '二尖瓣叶分区示意图');
}

/* ══════════════════════════════════════════════════════════
   ③ 三尖瓣瓣叶
   ══════════════════════════════════════════════════════════ */

/** TTE 心尖四腔心：显示隔叶（靠室间隔）+ 前叶；后叶需短轴 */
function tvTteSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  const lvCx = 300, lvCy = 250;
  n += chamber('M108 430 C58 370 63 210 103 168 C151 112 208 196 208 300 C208 352 198 396 184 430 Z');
  n += lab(142, 300, 'RV', 19);
  n += ell(140, 492, 70, 42) + lab(140, 498, 'RA', 19);
  n += ell(lvCx, 492, 82, 42) + lab(lvCx, 498, 'LA', 19);
  n += ell(lvCx, lvCy, 100, 190);
  // 三尖瓣：位于 RA/RV 交界，隔叶靠室间隔（右），前叶靠游离壁（左）
  const VY = 442;
  n += leaflet('sep', 184, VY, 36, 46, -1, '隔叶', sel, 14);
  n += leaflet('ant', 118, VY, 40, 40, -1, '前叶', sel, 14);
  n += lab(222, VY + 62, '室间隔', 10, '#94a3b8');
  n += lab(300, 300, 'LV', 19);
  n += lab(150, 414, 'TV', 14);
  n += lab(300, 40, '心尖', 14, '#94a3b8');
  n += lab(240, 552, '隔叶附着点更靠近心尖（Ebstein 时下移）；后叶需短轴切面', 12, '#94a3b8');
  return svgWrap(n, '0 0 480 578', '三尖瓣 TTE 四腔心瓣叶示意图');
}

/**
 * TEE 食管中段右室流入-流出道切面（ME RV inflow-outflow，60–75°）
 *
 * 依据：TEE 该切面「后叶位于屏幕左侧、附着于右室游离壁；
 * 前叶紧邻主动脉瓣。（Aneskey《Tricuspid and Pulmonic Valves》）」
 * 同屏还可见 RA（近场）、RV（远场）、主动脉瓣与 RVOT。
 */
function tvTeeRvinSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  // 右房（近场，上）
  n += chamber('M88 198 L310 206 C310 96 200 58 122 78 C96 86 88 132 88 198 Z');
  n += lab(196, 132, 'RA（近场）', 15);
  // 右室（远场，下）—— 与右房共用瓣环线
  n += chamber('M88 198 L310 206 C332 300 330 392 300 432 C220 454 120 442 90 410 C78 340 82 260 88 198 Z');
  n += lab(198, 344, 'RV（远场）', 16);
  // 主动脉瓣 + 右室流出道（屏幕右侧）
  n += ell(370, 118, 42, 38);
  n += lab(370, 124, '主动脉瓣', 11, '#64748b');
  n += chamber('M334 46 Q404 30 448 58 L446 88 Q394 68 334 82 Z', '#f1f4f8');
  n += lab(394, 40, 'RVOT', 11, '#94a3b8');
  // 三尖瓣瓣环（与两腔室共用边界）
  n += '<path d="M96 199 L305 206" stroke="#94a3b8" stroke-width="2"/>';
  // 后叶（左，贴右室游离壁）、前叶（右，贴主动脉瓣）
  n += leaflet('post', 156, 200, 46, 46, 1, '后叶', sel, 14);
  n += leaflet('ant', 268, 205, 42, 42, 1, '前叶', sel, 14);
  n += lab(240, 498, 'TEE 60–75° 右室流入-流出道：左＝后叶（贴 RV 游离壁）· 右＝前叶（贴主动脉瓣）', 12, '#94a3b8');
  n += lab(240, 520, '隔叶在此切面看不到，需 ME 四腔心', 11, '#94a3b8');
  return svgWrap(n, '0 0 480 552', '三尖瓣 TEE 右室流入流出道分叶示意图');
}

/**
 * TEE 经胃底三尖瓣短轴（TG SAX，约 30°）
 *
 * 依据：该切面是唯一能同时显示三个瓣叶的 2D 切面；
 * 「隔叶在屏幕右侧（靠左室），前叶在左侧远场、后叶在左侧近场」
 * （Aneskey；PMC5494426 图 9 同）。
 */
function tvTeeTgsaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 212, cy = 206, R = 122;
  let n = '';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="156" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="138" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>';
  // 隔叶在右（靠左室）、前叶左下方（远场）、后叶左上方（近场）
  n += part('sep', cuspPath(cx, cy, R, -60, 60), dimColor(PALETTE.sep, sel, 'sep'), sel, '隔叶',
    ...pt(cx, cy, 78, 0), 14);
  n += part('ant', cuspPath(cx, cy, R, 60, 180), dimColor(PALETTE.ant, sel, 'ant'), sel, '前叶',
    ...pt(cx, cy, 78, 120), 14);
  n += part('post', cuspPath(cx, cy, R, 180, 300), dimColor(PALETTE.post, sel, 'post'), sel, '后叶',
    ...pt(cx, cy, 78, 240), 14);
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="#fff" stroke="#94a3b8" stroke-width="2"/>';
  n += lab(cx, cy - 170, '近场（上）', 12, '#94a3b8');
  n += lab(cx, cy + 182, '远场（下）', 12, '#94a3b8');
  n += lab(cx, cy + 210, 'TEE 经胃底短轴（约 30°）：唯一能同屏看全三个瓣叶的 2D 切面', 11, '#94a3b8');
  n += lab(cx, cy + 232, '隔叶在右（靠左室）· 后叶近场 · 前叶远场', 11, '#94a3b8');
  return svgWrap(n, '0 0 424 470', '三尖瓣 TEE 经胃底短轴三叶示意图');
}

/* ══════════════════════════════════════════════════════════
   视图元数据（与 segment-svg.js 的 WALL_VIEWS 同构）
   ══════════════════════════════════════════════════════════ */

const VALVE_VIEWS = [
  {
    id: 'avTteSax',
    group: '主动脉瓣',
    title: '主动脉瓣 · TTE 胸骨旁短轴',
    sub: '三叶铺满瓣口（各 120°）· RCC 在上（近 RVOT）/ LCC 右下 / NCC 左下（靠房间隔）',
    parts: ['rcc', 'lcc', 'ncc'],
    fn: avTteSaxSvg,
  },
  {
    id: 'avTeeSax',
    group: '主动脉瓣',
    title: '主动脉瓣 · TEE 短轴 30–60°',
    sub: '与 TTE 上下颠倒：LCC 右上 / NCC 左上（紧邻房间隔）/ RCC 下方（近 RVOT）',
    parts: ['rcc', 'lcc', 'ncc'],
    fn: avTeeSaxSvg,
  },
  {
    id: 'mvArea',
    group: '二尖瓣',
    title: '二尖瓣 · 分叶与瓣口面积',
    sub: '前叶 A1–A3（贴主动脉瓣侧）· 后叶 P1–P3（贴后壁侧）；A1 与 P1、A3 与 P3 分别相邻于两侧交界',
    parts: ['a1', 'a2', 'a3', 'p1', 'p2', 'p3'],
    fn: mvAreaSvg,
  },
  {
    id: 'mvTteA4c',
    group: '二尖瓣',
    title: '二尖瓣 · TTE 心尖四腔心',
    sub: '只分辨大系：A2（室间隔侧）与 P2（侧壁侧）',
    parts: ['a2', 'p2'],
    fn: mvTteA4cSvg,
  },
  {
    id: 'mvTeeCommissural',
    group: '二尖瓣',
    title: '二尖瓣 · TEE 45–60° 交界切面',
    sub: '屏幕方位：左 P3 · 中 A2 · 右 P1；A2 属前叶在远场，显示更长',
    parts: ['p3', 'a2', 'p1'],
    fn: mvTeeCommissuralSvg,
  },
  {
    id: 'tvTte',
    group: '三尖瓣',
    title: '三尖瓣 · TTE 心尖四腔心',
    sub: '显示隔叶（靠室间隔）与前叶；后叶需短轴右室流入道切面',
    parts: ['sep', 'ant'],
    fn: tvTteSvg,
  },
  {
    id: 'tvTeeRvin',
    group: '三尖瓣',
    title: '三尖瓣 · TEE 右室流入-流出道 60–75°',
    sub: '左＝后叶（贴右室游离壁）· 右＝前叶（贴主动脉瓣）；隔叶需四腔心',
    parts: ['post', 'ant'],
    fn: tvTeeRvinSvg,
  },
  {
    id: 'tvTeeTgsax',
    group: '三尖瓣',
    title: '三尖瓣 · TEE 经胃底短轴 约 30°',
    sub: '唯一能同屏看全三叶的 2D 切面：隔叶在右（靠左室）· 后叶近场 · 前叶远场',
    parts: ['sep', 'ant', 'post'],
    fn: tvTeeTgsaxSvg,
  },
];

/** 分区 id → 名称/颜色（全瓣膜统一索引） */
const PART_INDEX = (function () {
  const m = {};
  AV_CUSPS.concat(MV_SEGMENTS, TV_LEAFLETS).forEach(function (p) { m[p.id] = p; });
  return m;
})();

/** 某分区出现在哪些视图里 */
function viewsOfPart(id) {
  return VALVE_VIEWS.filter(function (v) {
    return v.parts.indexOf(id) !== -1;
  }).map(function (v) { return v.title; });
}

/** 分区说明文本：名称（缩写）｜ 见于：… */
function partInfoText(id) {
  const p = PART_INDEX[id];
  if (!p) return '';
  return p.name + '（' + p.abbr + '） ｜ 见于：' + viewsOfPart(id).join('、');
}

/**
 * UTF-8 → Base64（小程序 <image src="data:image/svg+xml;base64,...">）
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
  tvTeeRvinSvg,
  tvTeeTgsaxSvg,
  viewsOfPart,
  partInfoText,
  utf8ToBase64,
};
