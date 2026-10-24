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
  pvAnt: '#2563eb', pvL: '#0f9d58', pvR: '#d97706',       // 肺动脉瓣：前叶/左叶/右叶
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

/**
 * 肺动脉瓣三个瓣叶（半月瓣，命名按解剖位置：前叶 / 左叶 / 右叶）
 * ★ 屏幕方位随探头角度变化，判读以「几个瓣叶、形态、开放幅度」为主，
 *   不靠方位硬记（与主动脉瓣三叶不同，肺动脉瓣没有冠脉开口做地标）。
 */
const PV_CUSPS = [
  { id: 'pv-ant', name: '前叶', abbr: '前叶', color: PALETTE.pvAnt },
  { id: 'pv-l', name: '左叶', abbr: '左叶', color: PALETTE.pvL },
  { id: 'pv-r', name: '右叶', abbr: '右叶', color: PALETTE.pvR },
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

/* ══════════════════════════════════════════════════════════
   探头位置 / 扫描平面小图（v1.5.0 新增）
   ★ 用户要求：每张 TEE 图都配一张「探头在哪、平面怎么切」的小图。
   心脏画成侧位示意（上=近场=左房侧，下=远场=心室侧），
   右侧竖条 = 食管，三角 = 探头晶片面，蓝虚线 = 扫描平面。
   ══════════════════════════════════════════════════════════ */

/** 探头深度（食管内的位置）→ 小图里的 y 坐标 */
const PROBE_Y = { UE: 26, ME: 64, TG: 140 };

/** 探头位置中文名 */
const PROBE_NAME = { UE: '食管上段', ME: '食管中段', TG: '经胃底' };

/**
 * 切面朝向 → 蓝虚线旋转角（0 = 横切，90 = 纵切）
 * 只用于示意「这个切面是横着切还是纵着切」，精确角度看图上文字。
 */
const CUT_ANGLE = { sax: 0, lax: 90, '4c': 76, '2c': 104, mc: 52, tg: 0, vol: 0 };

/**
 * 探头位置 + 扫描平面示意小图
 * @param {{pos:string, deg:string, cut:string, target:string}} tee 视图的 tee 元数据
 * @param {string} title 视图标题（写在小图底部）
 */
function probeSvg(tee, title) {
  const pos = tee.pos || 'ME';
  const py = PROBE_Y[pos] || 64;
  const ang = CUT_ANGLE[tee.cut] === undefined ? 0 : CUT_ANGLE[tee.cut];
  const tg = tee.target || [140, 78];
  const tx = tg[0];
  const ty = tg[1];
  let n = '';

  // 心脏四腔（侧位示意：上方近场=心房，下方远场=心室）
  n += ell(96, 54, 54, 30, '#eef1f5') + lab(78, 60, 'LA', 12, '#94a3b8');
  n += ell(196, 54, 38, 26, '#eef1f5') + lab(196, 60, 'RA', 12, '#94a3b8');
  n += ell(86, 118, 44, 42, '#eef1f5') + lab(74, 124, 'LV', 12, '#94a3b8');
  n += ell(194, 114, 32, 36, '#eef1f5') + lab(196, 120, 'RV', 12, '#94a3b8');
  // 房室间隔
  n += '<path d="M144 30 L144 154" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4 4"/>';

  // 食管（探头所在）
  n += '<rect x="262" y="6" width="22" height="160" rx="9" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5"/>';
  n += '<text x="273" y="150" text-anchor="middle" font-size="10" fill="#64748b" ' +
    'transform="rotate(-90 273 150)">食管</text>';
  // 探头晶片面（朝左）
  n += '<path d="M258 ' + (py - 9) + ' L258 ' + (py + 9) + ' L243 ' + py + ' Z" fill="#2563eb"/>';

  // 扫描平面 / 全容积
  if (tee.cut === 'vol') {
    n += '<rect x="' + (tx - 52) + '" y="' + (ty - 40) + '" width="104" height="80" rx="6" ' +
      'fill="#2563eb" fill-opacity="0.10" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="5 4"/>';
    n += lab(tx, ty + 58, '3D 全容积', 10, '#2563eb');
  } else {
    const a = ang * RAD;
    const hx = Math.cos(a) * 66;
    const hy = Math.sin(a) * 66;
    n += '<line x1="' + f1(tx - hx) + '" y1="' + f1(ty - hy) + '" x2="' + f1(tx + hx) + '" y2="' + f1(ty + hy) +
      '" stroke="#2563eb" stroke-width="2.4" stroke-dasharray="6 4"/>';
    // 晶片面到平面的连线，说明「这条线是从这个探头打出来的」
    n += '<line x1="' + f1(tx + hx * 0.55) + '" y1="' + f1(ty + hy * 0.55) + '" x2="262" y2="' + py +
      '" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2 3"/>';
  }
  // 目标瓣膜
  n += '<circle cx="' + tx + '" cy="' + ty + '" r="5.5" fill="#dc2626" stroke="#fff" stroke-width="1.6"/>';

  // 文字：位置 + 角度（放到底部，避免压住心脏示意）
  n += '<line x1="10" y1="174" x2="290" y2="174" stroke="#e2e8f0" stroke-width="1"/>';
  n += labL(10, 191, PROBE_NAME[pos] + (tee.deg ? ' · ' + tee.deg : ''), 13, '#2563eb', 700);
  if (tee.note) n += labL(10, 204, tee.note, 10, '#94a3b8', 500);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 212" width="100%" role="img" ' +
    'aria-label="' + title + '探头位置与扫描平面示意"><rect x="0" y="0" width="100%" height="100%" ' +
    'rx="10" fill="#fafbfc"/>' + n + '</svg>';
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
   ① 主动脉瓣（TEE）
   ══════════════════════════════════════════════════════════ */

/**
 * ME AV 短轴 30–60°（ME AV SAX）
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

/**
 * ME AV 长轴 120–140°（ME AV LAX）
 * 近场 = LA（上方）；远场 = LV（左下）；主动脉根部向右上延伸。
 * ★ 只看得到两个瓣叶：贴 RVOT 侧的 RCC（前）与贴房间隔侧的 NCC（后），
 *   LCC 一般不在本切面显示 —— 三叶是否齐全必须回短轴确认。
 */
function avTeeLaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  // 左房（近场，上）
  n += ell(168, 96, 148, 60);
  n += lab(168, 102, 'LA（近场）', 15);
  // 左室（远场，左下）
  n += ell(108, 352, 102, 118);
  n += lab(108, 358, 'LV（远场）', 16);
  // LVOT：左室流出道 → 瓣环
  n += '<path d="M182 248 L262 258 L256 316 L176 300 Z" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
  n += lab(216, 290, 'LVOT', 12, '#94a3b8');
  // 主动脉根部 + 升主动脉 + RVOT（整体旋转，从瓣环指向右上）
  n += '<g transform="rotate(-20 262 254)">';
  n += '<path d="M262 206 L446 206 L446 254 L262 254 Z" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
  n += lab(352, 238, 'RVOT（前）', 12, '#94a3b8');
  n += '<path d="M262 254 L452 254 L452 350 L262 350 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>';
  n += lab(392, 330, '升主动脉', 11, '#64748b');
  // 瓣环
  n += '<path d="M262 206 L262 350" stroke="#cbd5e1" stroke-width="3"/>';
  // RCC（贴前壁 / RVOT 侧）、NCC（贴后壁 / 房间隔侧）
  n += part('rcc', 'M264 256 Q324 262 334 300 L264 300 Z',
    dimColor(PALETTE.rcc, sel, 'rcc'), sel);
  n += lab(300, 288, 'RCC', 12, sel && sel !== 'rcc' ? '#9aa2ad' : '#ffffff', 700);
  n += part('ncc', 'M264 348 Q324 342 334 304 L264 304 Z',
    dimColor(PALETTE.ncc, sel, 'ncc'), sel);
  n += lab(300, 334, 'NCC', 12, sel && sel !== 'ncc' ? '#9aa2ad' : '#ffffff', 700);
  n += '</g>';
  n += lab(240, 500, 'TEE 120–140° 长轴：RCC 贴前壁（近 RVOT）· NCC 贴后壁（近房间隔）', 12, '#94a3b8');
  n += lab(240, 522, 'LCC 通常不在本切面显示；三叶是否齐全回短轴确认。测瓣环/瓣上内径也在这里', 11, '#94a3b8');
  return svgWrap(n, '0 0 480 544', '主动脉瓣 TEE 长轴两叶示意图');
}

/**
 * 深部经胃底长轴 0°（Deep TG LAX）
 * ★ 与 ME 长轴看同一对瓣叶，但探头在胃底、血流**背离**探头，
 *   是测 Vmax / 平均跨瓣压差时最容易把声束对齐的窗口（角度最接近 0°）。
 *   代价：分辨率不如 ME，瓣叶形态细节不要在这个切面下结论。
 */
function avTgDeepLaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  // 左室（近场，上方；心尖朝上）
  n += ell(210, 118, 118, 84);
  n += lab(210, 70, '心尖方向（近场）', 13, '#94a3b8');
  n += lab(210, 128, 'LV', 18, '#64748b');
  // 左室流出道（收窄）
  n += '<path d="M170 186 L250 186 L268 268 L152 268 Z" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
  n += lab(210, 232, 'LVOT', 13, '#94a3b8');
  // 主动脉根部 + 升主动脉（远场，向下）
  n += '<path d="M146 268 L274 268 L274 340 L146 340 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>';
  n += '<path d="M150 340 L270 340 L286 452 L134 452 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>';
  n += lab(210, 306, '主动脉根部', 12, '#64748b');
  n += lab(210, 400, '升主动脉（远场）', 13, '#94a3b8');
  // 瓣叶（左右两片）
  n += part('rcc', 'M150 272 Q200 280 204 316 L150 316 Z',
    dimColor(PALETTE.rcc, sel, 'rcc'), sel);
  n += lab(172, 302, 'RCC', 12, sel && sel !== 'rcc' ? '#9aa2ad' : '#ffffff', 700);
  n += part('ncc', 'M270 272 Q220 280 216 316 L270 316 Z',
    dimColor(PALETTE.ncc, sel, 'ncc'), sel);
  n += lab(248, 302, 'NCC', 12, sel && sel !== 'ncc' ? '#9aa2ad' : '#ffffff', 700);
  n += lab(240, 496, '深部经胃底 0°：血流背离探头，最容易把 0° 对齐 → 测 Vmax / 平均压差首选', 12, '#94a3b8');
  n += lab(240, 518, '分辨率不如 ME，瓣叶形态别在这里下结论；角度 >20° 时压差会被低估', 11, '#94a3b8');
  return svgWrap(n, '0 0 480 540', '主动脉瓣深部经胃底长轴示意图');
}

/* ══════════════════════════════════════════════════════════
   ② 二尖瓣（TEE）
   ══════════════════════════════════════════════════════════ */

/** ME 四腔心 0°：只分辨 A2（室间隔侧）与 P2（侧壁侧） */
function mvTee4cSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  // 左房 / 右房（近场，上）
  n += ell(156, 104, 92, 52);
  n += lab(156, 110, 'LA（近场）', 14);
  n += ell(336, 106, 74, 48);
  n += lab(336, 112, 'RA', 14, '#94a3b8');
  // 左室 / 右室（远场，下）
  n += ell(148, 352, 96, 118);
  n += lab(148, 358, 'LV（远场）', 15);
  n += ell(340, 348, 78, 108);
  n += lab(340, 354, 'RV', 15, '#94a3b8');
  // 房室间隔
  n += '<path d="M248 168 L252 452" stroke="#cbd5e1" stroke-width="3"/>';
  // 二尖瓣瓣环
  const VY = 216;
  n += '<path d="M66 ' + VY + ' L246 ' + VY + '" stroke="#cbd5e1" stroke-width="2"/>';
  // 侧壁侧 P2（左）、间隔侧 A2（右，更长）
  n += leaflet('p2', 120, VY, 48, 36, 1, 'P2', sel, 15);
  n += leaflet('a2', 200, VY, 44, 58, 1, 'A2', sel, 16);
  n += lab(120, VY - 22, '侧壁侧', 11, '#94a3b8');
  n += lab(200, VY - 22, '间隔侧', 11, '#94a3b8');
  // 三尖瓣（同屏）
  n += leaflet('sep', 296, VY + 4, 32, 34, 1, '隔叶', sel, 11);
  n += leaflet('ant', 372, VY + 4, 34, 32, 1, '前叶', sel, 11);
  n += lab(334, VY - 22, '三尖瓣', 11, '#94a3b8');
  n += lab(240, 500, 'TEE 0° 四腔心：二尖瓣只见 A2 + P2 —— 精确分叶要 45–60° 交界切面', 12, '#94a3b8');
  n += lab(240, 522, '三尖瓣同屏：隔叶靠室间隔、前叶靠游离壁；隔叶附着点比二尖瓣更靠心尖', 11, '#94a3b8');
  return svgWrap(n, '0 0 480 544', '二尖瓣 TEE 四腔心分叶示意图');
}

/** ME 两腔心 90°：前壁侧 A2 + 下壁侧 P3 */
function mvTee2cSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  n += ell(212, 104, 132, 56);
  n += lab(212, 110, 'LA（近场）', 15);
  n += ell(212, 356, 126, 122);
  n += lab(212, 362, 'LV（远场）', 16);
  const VY = 214;
  n += '<path d="M62 ' + VY + ' L362 ' + VY + '" stroke="#cbd5e1" stroke-width="2"/>';
  n += leaflet('a2', 158, VY, 56, 56, 1, 'A2', sel, 16);
  n += leaflet('p3', 274, VY, 52, 36, 1, 'P3', sel, 15);
  n += lab(158, VY - 22, '前壁侧', 11, '#94a3b8');
  n += lab(274, VY - 22, '下壁侧', 11, '#94a3b8');
  n += lab(212, 500, 'TEE 90° 两腔心：前壁侧是 A2、下壁侧是 P3 —— 与四腔心（P2）配合可定位 P 段的里外', 12, '#94a3b8');
  n += lab(212, 522, '本切面不看主动脉瓣，测二尖瓣口面积与压差时角度比四腔心更稳', 11, '#94a3b8');
  return svgWrap(n, '0 0 424 544', '二尖瓣 TEE 两腔心分叶示意图');
}

/** ME 长轴 120–140°：A2（前）+ P2（后），同屏 LVOT 与主动脉瓣 */
function mvTeeLaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  n += ell(178, 104, 148, 62);
  n += lab(178, 110, 'LA（近场）', 15);
  n += ell(118, 356, 104, 122);
  n += lab(118, 362, 'LV（远场）', 16);
  // 主动脉根部（右上）
  n += '<g transform="rotate(-18 262 214)">';
  n += '<path d="M244 150 L452 150 L452 236 L244 236 Z" fill="#f1f4f8" stroke="#94a3b8" stroke-width="2"/>';
  n += lab(360, 200, '主动脉根部', 11, '#94a3b8');
  n += '</g>';
  const VY = 218;
  n += '<path d="M62 ' + VY + ' L268 ' + VY + '" stroke="#cbd5e1" stroke-width="2"/>';
  n += leaflet('a2', 168, VY, 54, 58, 1, 'A2', sel, 16);
  n += leaflet('p2', 250, VY, 40, 34, 1, 'P2', sel, 14);
  n += lab(168, VY - 22, '前（主动脉瓣侧）', 11, '#94a3b8');
  n += lab(266, VY + 62, '后', 11, '#94a3b8');
  n += lab(240, 500, 'TEE 120–140° 长轴：A2 与 P2 同屏，还能看到 LVOT 与主动脉瓣', 12, '#94a3b8');
  n += lab(240, 522, '二尖瓣 + 主动脉瓣联合病变、以及 LVOT 梗阻评估首选这个切面', 11, '#94a3b8');
  return svgWrap(n, '0 0 480 544', '二尖瓣 TEE 长轴分叶示意图');
}

/**
 * ME 二尖瓣交界切面（ME MC，45–60°，即常说的 commissural view）
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
 * 3D TEE 外科视角（瓣口正面观 / en-face，主动脉瓣在上）
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
  n += lab(cx, cy - 162, '前叶 A1–A3（贴主动脉瓣侧）', 15, '#2563eb');
  n += lab(cx, cy + 174, '后叶 P1–P3（贴左室后壁侧）', 15, '#d97706');
  n += lab(cx, cy + 206, '左＝前外侧交界（A1｜P1）　右＝后内侧交界（A3｜P3）', 12, '#dc2626');
  n += lab(cx, cy + 230, '后叶附着约 2/3 瓣环、前叶约 1/3；但前叶更长，两叶面积大致相当', 11, '#94a3b8');
  n += lab(cx, cy + 250, '3D 全容积采集后看这个视角；2D 的 45–60° 交界切面与之左右相反（左 P3 / 右 P1）', 11, '#94a3b8');
  return svgWrap(n, '0 0 424 480', '二尖瓣 3D TEE 外科视角分叶示意图');
}

/**
 * 经胃底基底短轴 0°（TG basal SAX）
 * ★ 2D 瓣口短轴：只分前叶（贴近场）/ 后叶（贴远场），两侧是前后交界。
 *   是「鱼嘴样」开口的经典切面，MS 时用来直接描记瓣口面积（planimetry）。
 *   ★ 它不分 P1/P2/P3 —— 细分叶要靠 3D 或交界切面，别在这里报段。
 */
function mvTgSaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 212, cy = 206, R = 126;
  let n = '';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="158" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
  // 前叶（上半）、后叶（下半）
  n += part('a2', cuspPath(cx, cy, R, -176, -4), dimColor(PALETTE.a2, sel, 'a2'), sel, '前叶',
    ...pt(cx, cy, 74, -90), 15);
  n += part('p2', cuspPath(cx, cy, R, 4, 176), dimColor(PALETTE.p2, sel, 'p2'), sel, '后叶',
    ...pt(cx, cy, 74, 90), 15);
  // 两侧交界
  n += '<path d="M' + (cx - R) + ' ' + cy + ' L' + (cx + R) + ' ' + cy + '" stroke="#dc2626" stroke-width="2" stroke-dasharray="6 4"/>';
  n += lab(cx - R - 24, cy + 4, '交界', 11, '#dc2626');
  n += lab(cx + R + 24, cy + 4, '交界', 11, '#dc2626');
  n += lab(cx, cy - 172, '近场（经胃底往上打）', 12, '#94a3b8');
  n += lab(cx, cy + 184, '远场', 12, '#94a3b8');
  n += lab(cx, cy + 212, 'TEE 经胃底 0° 基底短轴：2D 下只分前叶 / 后叶，开口呈鱼嘴样', 11, '#94a3b8');
  n += lab(cx, cy + 234, 'MS 时直接描记开口面积（planimetry）；细分 P1–P3 请用 3D 或交界切面', 11, '#94a3b8');
  return svgWrap(n, '0 0 424 470', '二尖瓣 TEE 经胃底短轴示意图');
}

/* ══════════════════════════════════════════════════════════
   ③ 三尖瓣（TEE）
   ══════════════════════════════════════════════════════════ */

/** ME 四腔心 0°：隔叶（靠室间隔）+ 前叶（靠游离壁）；后叶看不到 */
function tvTee4cSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  n += ell(156, 104, 92, 52);
  n += lab(156, 110, 'LA（近场）', 14, '#94a3b8');
  n += ell(340, 106, 76, 48);
  n += lab(340, 112, 'RA（近场）', 14);
  n += ell(148, 352, 96, 118);
  n += lab(148, 358, 'LV', 15, '#94a3b8');
  n += ell(344, 348, 80, 110);
  n += lab(344, 354, 'RV（远场）', 15);
  // 房室间隔
  n += '<path d="M250 160 C254 250 246 350 252 452" stroke="#cbd5e1" stroke-width="3"/>';
  const VY = 218;
  n += '<path d="M270 ' + VY + ' L424 ' + VY + '" stroke="#cbd5e1" stroke-width="2"/>';
  // 隔叶贴间隔侧（左）、前叶贴游离壁（右）
  n += leaflet('sep', 300, VY, 34, 42, 1, '隔叶', sel, 12);
  n += leaflet('ant', 380, VY, 34, 36, 1, '前叶', sel, 12);
  n += lab(300, VY - 20, '间隔侧', 11, '#94a3b8');
  n += lab(380, VY - 20, '游离壁侧', 11, '#94a3b8');
  n += lab(240, 500, 'TEE 0° 四腔心：三尖瓣只见隔叶 + 前叶；后叶要 60–90° 右室流入-流出道', 12, '#94a3b8');
  n += lab(240, 522, '隔叶附着点比二尖瓣前叶更靠心尖（正常约 8 mm，Ebstein 时显著下移）', 11, '#94a3b8');
  return svgWrap(n, '0 0 480 544', '三尖瓣 TEE 四腔心分叶示意图');
}

/**
 * ME 右室流入-流出道切面（ME RV inflow-outflow，60–90°）
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
   ④ 肺动脉瓣（TEE）
   ══════════════════════════════════════════════════════════ */

/**
 * 肺动脉瓣短轴（高位 ME 右室流出道 / 上食管大动脉短轴，约 30–60°）
 * ★ 肺动脉瓣三叶按解剖位置命名：前叶 / 左叶 / 右叶。
 *   与主动脉瓣不同，它没有冠脉开口当路标，屏幕方位随角度与个体差异变化较大，
 *   判读以「瓣叶数目、增厚、开放幅度、反流束起源」为主，不靠方位硬记。
 */
function pvTeeSaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 212, cy = 202, R = 124;
  let n = '';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="158" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="142" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>';
  // 前叶在上（贴近场 RVOT）、左叶右下、右叶左下
  n += part('pv-ant', cuspPath(cx, cy, R, -150, -30), dimColor(PALETTE.pvAnt, sel, 'pv-ant'), sel, '前叶',
    ...pt(cx, cy, 78, -90), 13);
  n += part('pv-l', cuspPath(cx, cy, R, -30, 90), dimColor(PALETTE.pvL, sel, 'pv-l'), sel, '左叶',
    ...pt(cx, cy, 78, 30), 13);
  n += part('pv-r', cuspPath(cx, cy, R, 90, 210), dimColor(PALETTE.pvR, sel, 'pv-r'), sel, '右叶',
    ...pt(cx, cy, 78, 150), 13);
  [-150, -30, 90].forEach(function (a) {
    const p = pt(cx, cy, R, a);
    n += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="3.5" fill="#fff" stroke="#64748b" stroke-width="1.5"/>';
  });
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="11" fill="#fff" stroke="#94a3b8" stroke-width="2"/>';
  n += lab(cx, cy - 174, '近场：RVOT', 13, '#64748b');
  n += lab(cx, cy + 182, '远场：主肺动脉', 13, '#64748b');
  n += lab(cx, cy + 208, '肺动脉瓣三叶（前 / 左 / 右），无冠脉开口当路标 —— 方位随角度变化，别硬记', 11, '#94a3b8');
  n += lab(cx, cy + 230, '看三件事：瓣叶数目、增厚与活动度、反流束从哪个交界起源', 11, '#94a3b8');
  return svgWrap(n, '0 0 424 470', '肺动脉瓣 TEE 短轴三叶示意图');
}

/* ══════════════════════════════════════════════════════════
   视图元数据（与 segment-svg.js 的 WALL_VIEWS 同构）
   ★ v1.5.0：只保留 TEE 切面（TTE 短轴/四腔心已在「切面学习」里，重复），
     并按 ASE/SCA 标准 TEE 切面集扩充到 13 个。
     每个视图的 tee 字段 = 探头位置 + 多平面角度 + 切面朝向 + 小图上靶点坐标，
     用来生成「探头在哪、平面怎么切」的小图（probeSvg）。
   ══════════════════════════════════════════════════════════ */

const VALVE_VIEWS = [
  /* ── 主动脉瓣 ── */
  {
    id: 'avTeeSax',
    group: '主动脉瓣',
    title: '主动脉瓣 · TEE 短轴 30–60°',
    sub: '与 TTE 上下颠倒：LCC 右上 / NCC 左上（紧邻房间隔）/ RCC 下方（近 RVOT）',
    parts: ['rcc', 'lcc', 'ncc'],
    tee: { pos: 'ME', deg: '30–60°', cut: 'sax', target: [126, 82], note: '横切主动脉瓣 → 三叶同屏' },
    fn: avTeeSaxSvg,
  },
  {
    id: 'avTeeLax',
    group: '主动脉瓣',
    title: '主动脉瓣 · TEE 长轴 120–140°',
    sub: '只看 RCC（贴 RVOT / 前）与 NCC（贴房间隔 / 后）；LCC 一般不显示',
    parts: ['rcc', 'ncc'],
    tee: { pos: 'ME', deg: '120–140°', cut: 'lax', target: [126, 82], note: '纵切 → 量瓣环与瓣上内径' },
    fn: avTeeLaxSvg,
  },
  {
    id: 'avTgDeepLax',
    group: '主动脉瓣',
    title: '主动脉瓣 · 深部经胃底长轴 0°',
    sub: '血流背离探头，最容易把声束对齐 —— 测 Vmax 与平均压差首选；形态细节回 ME 短轴',
    parts: ['rcc', 'ncc'],
    tee: { pos: 'TG', deg: '0°', cut: 'lax', target: [126, 82], note: '从胃底往上看，血流背离探头' },
    fn: avTgDeepLaxSvg,
  },

  /* ── 二尖瓣 ── */
  {
    id: 'mvTee4c',
    group: '二尖瓣',
    title: '二尖瓣 · TEE 四腔心 0°',
    sub: '只分辨大系：A2（室间隔侧）与 P2（侧壁侧）；三尖瓣同屏（隔叶 + 前叶）',
    parts: ['a2', 'p2', 'sep', 'ant'],
    tee: { pos: 'ME', deg: '0°', cut: '4c', target: [118, 86], note: '四腔心：房间隔与室间隔同在画面中央' },
    fn: mvTee4cSvg,
  },
  {
    id: 'mvTee2c',
    group: '二尖瓣',
    title: '二尖瓣 · TEE 两腔心 90°',
    sub: '前壁侧是 A2、下壁侧是 P3 —— 与四腔心（P2）配合才能定位 P 段的里外',
    parts: ['a2', 'p3'],
    tee: { pos: 'ME', deg: '90°', cut: '2c', target: [118, 86], note: '两腔心：只看左心，前后壁对穿' },
    fn: mvTee2cSvg,
  },
  {
    id: 'mvTeeLax',
    group: '二尖瓣',
    title: '二尖瓣 · TEE 长轴 120–140°',
    sub: 'A2 + P2，同屏还能看到 LVOT 与主动脉瓣 —— 联合瓣膜病首选',
    parts: ['a2', 'p2'],
    tee: { pos: 'ME', deg: '120–140°', cut: 'lax', target: [118, 86], note: '纵切 → 二尖瓣与主动脉瓣同屏' },
    fn: mvTeeLaxSvg,
  },
  {
    id: 'mvTeeCommissural',
    group: '二尖瓣',
    title: '二尖瓣 · TEE 45–60° 交界切面',
    sub: '屏幕方位：左 P3 · 中 A2 · 右 P1；A2 属前叶在远场，显示更长',
    parts: ['p3', 'a2', 'p1'],
    tee: { pos: 'ME', deg: '45–60°', cut: 'mc', target: [118, 86], note: '斜切两个交界 → P3 / A2 / P1 同屏' },
    fn: mvTeeCommissuralSvg,
  },
  {
    id: 'mvTee3d',
    group: '二尖瓣',
    title: '二尖瓣 · 3D TEE 外科视角',
    sub: '瓣口正面观：前叶 A1–A3（近主动脉瓣）、后叶 P1–P3（近后壁），两侧是前后交界',
    parts: ['a1', 'a2', 'a3', 'p1', 'p2', 'p3'],
    tee: { pos: 'ME', deg: '全容积', cut: 'vol', target: [118, 86], note: '3D 全容积采集后重建，不分角度' },
    fn: mvAreaSvg,
  },
  {
    id: 'mvTgSax',
    group: '二尖瓣',
    title: '二尖瓣 · 经胃底基底短轴 0°',
    sub: '2D 下只分前叶 / 后叶，开口呈鱼嘴样；MS 时直接描记瓣口面积（planimetry）',
    parts: ['a2', 'p2'],
    tee: { pos: 'TG', deg: '0°', cut: 'sax', target: [118, 86], note: '经胃底横切瓣口 → 鱼嘴样开口' },
    fn: mvTgSaxSvg,
  },

  /* ── 三尖瓣 ── */
  {
    id: 'tvTee4c',
    group: '三尖瓣',
    title: '三尖瓣 · TEE 四腔心 0°',
    sub: '隔叶（靠室间隔）+ 前叶（靠游离壁）；后叶需 60–90° 右室流入-流出道',
    parts: ['sep', 'ant'],
    tee: { pos: 'ME', deg: '0°', cut: '4c', target: [166, 88], note: '四腔心：三尖瓣在画面右半' },
    fn: tvTee4cSvg,
  },
  {
    id: 'tvTeeRvin',
    group: '三尖瓣',
    title: '三尖瓣 · TEE 右室流入-流出道 60–90°',
    sub: '左＝后叶（贴右室游离壁）· 右＝前叶（贴主动脉瓣）；隔叶需四腔心',
    parts: ['post', 'ant'],
    tee: { pos: 'ME', deg: '60–90°', cut: 'lax', target: [166, 88], note: '纵切右心 → 后叶与前叶同屏' },
    fn: tvTeeRvinSvg,
  },
  {
    id: 'tvTeeTgsax',
    group: '三尖瓣',
    title: '三尖瓣 · TEE 经胃底短轴 约 30°',
    sub: '唯一能同屏看全三叶的 2D 切面：隔叶在右（靠左室）· 后叶近场 · 前叶远场',
    parts: ['sep', 'ant', 'post'],
    tee: { pos: 'TG', deg: '约 30°', cut: 'sax', target: [166, 88], note: '经胃底横切 → 三叶同屏' },
    fn: tvTeeTgsaxSvg,
  },

  /* ── 肺动脉瓣 ── */
  {
    id: 'pvTeeSax',
    group: '肺动脉瓣',
    title: '肺动脉瓣 · TEE 短轴 30–60°',
    sub: '高位 / 上食管大动脉短轴：前叶 / 左叶 / 右叶；无冠脉开口当路标，方位别硬记',
    parts: ['pv-ant', 'pv-l', 'pv-r'],
    tee: { pos: 'ME', deg: '30–60°', cut: 'sax', target: [138, 44], note: '主动脉瓣短轴稍上提 → 肺动脉瓣' },
    fn: pvTeeSaxSvg,
  },
];

/** 按 id 取视图 */
function viewById(id) {
  for (let i = 0; i < VALVE_VIEWS.length; i += 1) {
    if (VALVE_VIEWS[i].id === id) return VALVE_VIEWS[i];
  }
  return null;
}

/** 按 id 生成「探头位置 + 扫描平面」小图 */
function probeOf(id) {
  const v = viewById(id);
  if (!v || !v.tee) return '';
  return probeSvg(v.tee, v.title);
}

/** 分区 id → 名称/颜色（全瓣膜统一索引） */
const PART_INDEX = (function () {
  const m = {};
  AV_CUSPS.concat(MV_SEGMENTS, TV_LEAFLETS, PV_CUSPS).forEach(function (p) { m[p.id] = p; });
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
  PV_CUSPS,
  VALVE_VIEWS,
  PART_INDEX,
  avTeeSaxSvg,
  avTeeLaxSvg,
  avTgDeepLaxSvg,
  mvTee4cSvg,
  mvTee2cSvg,
  mvTeeLaxSvg,
  mvTeeCommissuralSvg,
  mvAreaSvg,
  mvTgSaxSvg,
  tvTee4cSvg,
  tvTeeRvinSvg,
  tvTeeTgsaxSvg,
  pvTeeSaxSvg,
  probeSvg,
  probeOf,
  viewById,
  viewsOfPart,
  partInfoText,
  utf8ToBase64,
};
