/**
 * valve-svg.js — 瓣膜解剖 / 分叶 / 分段示意图生成器（纯函数，两端共用）
 *
 * 仿 segment-svg.js 的模式：小程序端转 data URI 给 <image>，
 * 网页端直接输出 SVG 字符串插入 DOM。
 *
 * ★★ 方位总则（2026-10-24 按 ASE/SCA、EAE 2010 与国内教材逐条重核后整份重画）
 *
 *   TEE 图 = TTE 图「上下颠倒」，**左右不变**。探头在心脏后方：
 *     近场（屏幕上方）＝ 心房侧 / 后方　　远场（屏幕下方）＝ 心室侧 / 前方
 *   所以屏幕左＝患者右、屏幕右＝患者左，与 TTE 完全一致。
 *
 *   逐条依据（写清楚是为了以后别再改错）：
 *   - EAE 2010（Recommendations for transoesophageal echocardiography: update 2010）：
 *     ME 四腔心「the left ventricle is on the right side of the sector and the
 *     right ventricle on the left. The left atrium is on top」；
 *     「the anterior mitral leaflet is seen on the left and the posterior on the right;
 *     the septal tricuspid leaflet is on the right side and the anterior tricuspid
 *     leaflet on the left side」；两腔心「convex anterior wall to the right,
 *     straight inferior wall to the left」；长轴「AML / AV / 升主动脉在右侧，
 *     PML 与左室后壁在左侧」。
 *   - ASE/SCA 1999（Guidelines for Performing a Comprehensive Intraoperative
 *     Multiplane TEE Examination）二尖瓣四视图：
 *     四腔心「P1 is to the right of the image display, and A3 is to the left」；
 *     交界切面「A2 in the middle … P1 to the right, P3 to the left」；
 *     两腔心「P3 to the left of the display, anterior leaflet to the right」；
 *     长轴「P2 to the left, A2 to the right」。
 *   - ME 主动脉瓣短轴 30–60°：国内《超声医学专科能力建设专用初级教材》
 *     「左冠瓣位于后方（近场）并在图像右侧，无冠瓣靠近房间隔，右冠瓣位于前方（远场）
 *      靠近 RVOT」；健康界「麻小学超声」同（屏幕左＝右房、左侧对着房间隔＝无冠瓣）。
 *     即 LCC 右上、NCC 左上、RCC 下方 —— 恰好是 TTE 短轴 RCC 上 / LCC 右下 /
 *     NCC 左下 的上下颠倒版，左右没动。
 *   - 经胃底二尖瓣短轴（Annals of Cardiac Anaesthesia 术中 TEE 综述）：
 *     「postero-medial commissure is nearer to the probe and antero-lateral
 *     commissure is at the far field; AML is on the left and PML is to the right」。
 *   - 3D en-face（外科视角）：主动脉瓣在 12 点，A1 / P1 在屏幕左（邻左心耳）、
 *     A3 / P3 在右（Biaggi 等 3D TEE 分叶图同）。
 *   - 深部经胃底长轴：与 ME 五腔心相似、图像上下颠倒（心尖在近场）。
 *
 *   ★ 约定：每个瓣叶标签都锚在一个**画出来的相邻结构**上（RVOT / 房间隔 /
 *     游离壁 / 肺动脉分支）。方位拿不准时看邻居，别只背左右。
 *   ★ 所有只描边不填充的 <path> 必须写 fill="none"——SVG 默认填充是黑色，
 *     一条弯曲的「虚线」会被默认填充成一个黑三角（v1.5.0 踩过）。
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

/** 主动脉瓣三叶（TEE 短轴屏幕方位：NCC 左上、LCC 右上、RCC 下方） */
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
 * ★ 没有冠脉开口当地标，屏幕方位随角度与个体差异大，
 *   认瓣叶靠相邻的 RVOT 与左/右肺动脉分支，不靠左右硬记。
 */
const PV_CUSPS = [
  { id: 'pv-ant', name: '前叶', abbr: '前叶', color: PALETTE.pvAnt },
  { id: 'pv-l', name: '左叶', abbr: '左叶', color: PALETTE.pvL },
  { id: 'pv-r', name: '右叶', abbr: '右叶', color: PALETTE.pvR },
];

/* ══════════════════════════════════════════════════════════
   通用绘图工具
   ★ 全部视图统一画布 480 × 400：解剖区 y 0–352，底部一行方位提示 y 382。
     统一画布是为了让 13 张图在卡片里大小一致（早前每张 viewBox 都不同，
     缩放后在页面上忽大忽小，看着像「变形」）。
   ══════════════════════════════════════════════════════════ */

const RAD = Math.PI / 180;
const BOX = '0 0 480 400';

function f1(n) { return (Math.round(n * 10) / 10).toFixed(1); }

/** 极坐标 → 直角坐标（0° 在右，顺时针为正，与 SVG 约定一致） */
function pt(cx, cy, r, deg) {
  return [cx + r * Math.cos(deg * RAD), cy + r * Math.sin(deg * RAD)];
}

/**
 * 半月瓣（关闭状态）：外缘贴瓣环，两条游离缘直着收向瓣口中心
 * → 三叶拼起来就是标准的「奔驰 Y」，不留空心圆
 */
function sector(cx, cy, R, a0, a1) {
  const p1 = pt(cx, cy, R, a0);
  const p2 = pt(cx, cy, R, a1);
  const large = (a1 - a0) > 180 ? 1 : 0;
  return 'M' + f1(cx) + ' ' + f1(cy) +
    ' L' + f1(p1[0]) + ' ' + f1(p1[1]) +
    ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + f1(p2[0]) + ' ' + f1(p2[1]) + ' Z';
}

/** 环形扇块（房室瓣：留出中间的瓣口） */
function wedge(cx, cy, ri, ro, a0, a1) {
  const p1 = pt(cx, cy, ro, a0);
  const p2 = pt(cx, cy, ro, a1);
  const p3 = pt(cx, cy, ri, a1);
  const p4 = pt(cx, cy, ri, a0);
  const large = (a1 - a0) > 180 ? 1 : 0;
  return 'M' + f1(p1[0]) + ' ' + f1(p1[1]) +
    ' A' + ro + ' ' + ro + ' 0 ' + large + ' 1 ' + f1(p2[0]) + ' ' + f1(p2[1]) +
    ' L' + f1(p3[0]) + ' ' + f1(p3[1]) +
    ' A' + ri + ' ' + ri + ' 0 ' + large + ' 0 ' + f1(p4[0]) + ' ' + f1(p4[1]) + ' Z';
}

/** 横管上的瓣叶（长轴用）：沿上/下壁附着，游离缘鼓向管腔中线
 *  ★ 二次贝塞尔在 t=0.5 处只有控制点一半的位移，控制点必须写 2*yTip - yWall
 *    才能真的穿过中线；否则两个瓣叶中间会留一条白缝，看着像「瓣口没关上」 */
function lensH(x0, x1, yWall, yTip) {
  const xm = (x0 + x1) / 2;
  const yc = 2 * yTip - yWall;
  return 'M' + f1(x0) + ' ' + f1(yWall) + ' Q' + f1(xm) + ' ' + f1(yc) +
    ' ' + f1(x1) + ' ' + f1(yWall) + ' Z';
}

/** 竖管上的瓣叶（长轴用）：沿左/右壁附着 */
function lensV(y0, y1, xWall, xTip) {
  const ym = (y0 + y1) / 2;
  const xc = 2 * xTip - xWall;
  return 'M' + f1(xWall) + ' ' + f1(y0) + ' Q' + f1(xc) + ' ' + f1(ym) +
    ' ' + f1(xWall) + ' ' + f1(y1) + ' Z';
}

/** 房室瓣瓣叶：从瓣环线向心室侧垂下的一片（带厚度，像小口袋） */
function flapDown(x, y, w, h) {
  return 'M' + f1(x - w) + ' ' + f1(y) +
    ' Q' + f1(x) + ' ' + f1(y + h) + ' ' + f1(x + w) + ' ' + f1(y) +
    ' L' + f1(x + w) + ' ' + f1(y + 11) +
    ' Q' + f1(x) + ' ' + f1(y + h + 11) + ' ' + f1(x - w) + ' ' + f1(y + 11) + ' Z';
}

function lab(x, y, t, size, color, weight, anchor) {
  return '<text x="' + f1(x) + '" y="' + f1(y) + '" text-anchor="' + (anchor || 'middle') +
    '" font-size="' + (size || 14) + '" font-weight="' + (weight || 600) +
    '" fill="' + (color || '#64748b') + '">' + t + '</text>';
}

function labL(x, y, t, size, color, weight) {
  return lab(x, y, t, size, color, weight, 'start');
}

function labR(x, y, t, size, color, weight) {
  return lab(x, y, t, size, color, weight, 'end');
}

/** 腔室轮廓 */
function chamber(d, fill) {
  return '<path d="' + d + '" fill="' + (fill || '#eef2f7') + '" stroke="#94a3b8" stroke-width="2"/>';
}

/** 只描边的线（★ 必须写 fill="none"，否则默认填充成黑色） */
function stroke(d, color, w, dash) {
  return '<path d="' + d + '" fill="none" stroke="' + (color || '#cbd5e1') + '" stroke-width="' +
    (w || 1.5) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
}

function ell(cx, cy, rx, ry, fill) {
  return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry +
    '" fill="' + (fill || '#eef2f7') + '" stroke="#94a3b8" stroke-width="2"/>';
}

/** 心室：U 形（底部圆钝），顶端敞开接瓣环 */
function ventPath(cx, top, w, h) {
  const bot = top + h;
  const r = Math.min(w * 0.95, h * 0.55);
  return 'M' + f1(cx - w) + ' ' + f1(top) +
    ' L' + f1(cx - w) + ' ' + f1(bot - r) +
    ' Q' + f1(cx - w) + ' ' + f1(bot) + ' ' + f1(cx) + ' ' + f1(bot) +
    ' Q' + f1(cx + w) + ' ' + f1(bot) + ' ' + f1(cx + w) + ' ' + f1(bot - r) +
    ' L' + f1(cx + w) + ' ' + f1(top) + ' Z';
}

/** 引线小标注（把「相邻结构」写在图外，用一根细线指进去） */
function tie(x1, y1, x2, y2, color) {
  return stroke('M' + f1(x1) + ' ' + f1(y1) + ' L' + f1(x2) + ' ' + f1(y2), color || '#cbd5e1', 1.2, '3 3');
}

function svgWrap(content, label) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + BOX + '" width="100%" ' +
    'preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + label + '">' +
    '<rect x="0" y="0" width="480" height="400" rx="10" fill="#fafbfc"/>' + content + '</svg>';
}

/** 底部统一方位提示（★ 一行最多约 34 个汉字，超出会被画布右边裁掉） */
function cue(text) {
  return stroke('M16 358 L464 358', '#e2e8f0', 1) + labL(16, 382, text, 11, '#94a3b8', 500);
}

/* ══════════════════════════════════════════════════════════
   探头位置 / 扫描平面小图
   ★ 心脏画成「左侧位」：左＝前（胸骨侧），右＝后（食管侧），
     所以左房紧贴食管——这是 TEE 一切切面的出发点。
     竖条 = 食管，三角 = 探头晶片面（永远朝左），
     蓝扇面 = 这次扫查的切面，红点 = 该切面要看的瓣膜。
   ══════════════════════════════════════════════════════════ */

/** 探头深度（食管内的位置）→ 小图里的 y 坐标 */
const PROBE_Y = { UE: 30, ME: 78, TG: 170 };

/** 探头位置中文名 */
const PROBE_NAME = { UE: '食管上段', ME: '食管中段', TG: '经胃底' };

function probeSvg(tee) {
  const pos = tee.pos || 'ME';
  const py = PROBE_Y[pos] === undefined ? 78 : PROBE_Y[pos];
  const tg = tee.target || [196, 108];
  const tx = tg[0];
  const ty = tg[1];
  const px = 258;
  let n = '';

  // ── 心脏侧位示意：右＝后方＝食管侧 ──
  n += ell(112, 72, 40, 26, '#eef2f7') + lab(98, 77, 'RV', 12, '#94a3b8');
  n += ell(158, 138, 42, 38, '#eef2f7') + lab(146, 144, 'LV', 12, '#94a3b8');
  n += ell(222, 80, 44, 28, '#e8eef7') + lab(210, 85, 'LA', 12, '#64748b');
  n += ell(230, 140, 31, 25, '#eef2f7') + lab(230, 146, 'RA', 12, '#94a3b8');
  n += stroke('M208 116 L260 120', '#cbd5e1', 1.4, '4 3');
  n += stroke('M194 106 C188 130 170 176 156 182', '#cbd5e1', 1.4, '4 3');

  // ── 食管 + 探头 ──
  n += '<rect x="276" y="10" width="24" height="200" rx="10" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.4"/>';
  n += '<text x="288" y="188" text-anchor="middle" font-size="10" fill="#64748b" ' +
    'transform="rotate(-90 288 188)">食管</text>';
  n += '<path d="M' + px + ' ' + (py - 8) + ' L' + px + ' ' + (py + 8) + ' L' + (px - 16) + ' ' + py +
    ' Z" fill="#2563eb"/>';

  // ── 扇面（从晶片面指向目标瓣膜）──
  const dx = tx - px;
  const dy = ty - py;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ang = Math.atan2(dy, dx);
  const had = 26 * RAD;
  const p1 = [px + len * Math.cos(ang - had), py + len * Math.sin(ang - had)];
  const p2 = [px + len * Math.cos(ang + had), py + len * Math.sin(ang + had)];
  n += '<path d="M' + px + ' ' + f1(py) + ' L' + f1(p1[0]) + ' ' + f1(p1[1]) +
    ' A' + f1(len) + ' ' + f1(len) + ' 0 0 1 ' + f1(p2[0]) + ' ' + f1(p2[1]) + ' Z" ' +
    'fill="#2563eb" fill-opacity="0.10" stroke="#a8c1ec" stroke-width="1"/>';

  // ── 目标瓣膜 ──
  n += '<circle cx="' + f1(tx) + '" cy="' + f1(ty) + '" r="5.5" fill="#dc2626" stroke="#fff" stroke-width="1.8"/>';

  // ── 多平面角度徽标 ──
  n += '<rect x="8" y="8" width="104" height="26" rx="8" fill="#eef2ff" stroke="#c7d2fe" stroke-width="1.4"/>';
  n += lab(60, 26, tee.deg || '', 13, '#2563eb', 700);
  n += labL(8, 52, PROBE_NAME[pos], 12, '#64748b', 600);

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 228" width="100%" ' +
    'preserveAspectRatio="xMidYMid meet" role="img" aria-label="探头位置与扫描平面示意">' +
    '<rect x="0" y="0" width="320" height="228" rx="10" fill="#f8fafc"/>' + n + '</svg>';
}

/**
 * 可点击的解剖分区色块（文字颜色随高亮状态自动切换）
 */
function part(id, d, color, sel, text, tx, ty, fs) {
  const on = sel === id;
  const off = sel && !on;
  const st = on ? '#1e293b' : '#ffffff';
  const sw = on ? 4.5 : 2;
  let s = '<g data-part="' + id + '">' +
    '<path d="' + d + '" fill="' + color + '" stroke="' + st + '" stroke-width="' + sw + '"/>';
  if (text) {
    s += '<text x="' + f1(tx) + '" y="' + f1(ty) + '" text-anchor="middle" font-size="' + (fs || 15) +
      '" font-weight="700" fill="' + (off ? '#8b93a1' : '#ffffff') + '" pointer-events="none">' +
      text + '</text>';
  }
  return s + '</g>';
}

/** 有选中时，未选中的分区变灰 */
function dimColor(color, sel, id) {
  if (!sel) return color;
  return sel === id ? color : '#d5dae1';
}

/* ══════════════════════════════════════════════════════════
   ① 主动脉瓣（TEE）
   ══════════════════════════════════════════════════════════ */

/**
 * ME AV 短轴 30–60°（ME AV SAX）
 * 近场（上）＝ LA，远场（下）＝ RVOT；屏幕左＝患者右（右房＋房间隔），右侧＝肺动脉侧。
 * NCC 左上（紧邻房间隔）、LCC 右上（紧贴肺动脉）、RCC 下方（贴 RVOT）。
 */
function avTeeSaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 240, cy = 190, R = 110;

  let n = '';
  // 周围结构（先画，压在瓣环下面）
  n += ell(240, 36, 104, 24, '#eef2f7') + lab(240, 41, '左房 LA（近场）', 13, '#64748b');
  n += ell(240, 344, 96, 24, '#eef2f7') + lab(240, 349, 'RVOT（远场）', 13, '#64748b');
  n += ell(56, 150, 38, 44, '#eef2f7') + lab(56, 155, '右房', 12, '#94a3b8');
  n += stroke('M104 106 L104 264', '#cbd5e1', 1.6, '5 4');
  n += labR(98, 286, '房间隔', 12, '#94a3b8');
  n += labL(386, 116, '肺动脉', 12, '#94a3b8');
  n += labL(386, 132, '左心耳', 12, '#94a3b8');
  n += tie(384, 122, 356, 166);

  // 主动脉根部
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="132" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R + 2) + '" fill="#fafbfc" stroke="#94a3b8" stroke-width="2"/>';

  // 三叶（关闭态，奔驰 Y）
  n += part('lcc', sector(cx, cy, R, -90, 30), dimColor(PALETTE.lcc, sel, 'lcc'), sel, 'LCC',
    ...pt(cx, cy, 62, -30), 15);
  n += part('rcc', sector(cx, cy, R, 30, 150), dimColor(PALETTE.rcc, sel, 'rcc'), sel, 'RCC',
    ...pt(cx, cy, 62, 90), 15);
  n += part('ncc', sector(cx, cy, R, 150, 270), dimColor(PALETTE.ncc, sel, 'ncc'), sel, 'NCC',
    ...pt(cx, cy, 62, 210), 15);

  // 三个交界
  [-90, 30, 150].forEach(function (a) {
    const p = pt(cx, cy, R, a);
    n += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="3.5" fill="#ffffff" stroke="#64748b" stroke-width="1.5"/>';
  });

  // 冠脉开口：左冠在 LCC、右冠在 RCC
  const lca = pt(cx, cy, 92, -56);
  const rca = pt(cx, cy, 92, 106);
  n += '<circle cx="' + f1(lca[0]) + '" cy="' + f1(lca[1]) + '" r="6" fill="#dc2626" stroke="#fff" stroke-width="1.8"/>';
  n += '<circle cx="' + f1(rca[0]) + '" cy="' + f1(rca[1]) + '" r="6" fill="#dc2626" stroke="#fff" stroke-width="1.8"/>';

  n += cue('近场（上）＝左房，远场（下）＝RVOT；屏幕左右与 TTE 相同');
  return svgWrap(n, '主动脉瓣 TEE 短轴三叶分区示意图');
}

/**
 * ME AV 长轴 120–140°（ME AV LAX）
 * 左房在近场（左上），LV 远场（左下），LVOT→主动脉瓣→升主动脉 在右侧呈直线排列。
 * 瓣上（远场侧）是 RVOT，所以 RCC 在下（贴 RVOT / 前）、NCC 在上（贴房间隔 / 后）。
 * LCC 一般不在本切面显示。
 */
function avTeeLaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';

  // RVOT（前 · 远场）：压在根部下面
  n += chamber('M292 216 L462 216 L462 264 L292 264 Z', '#f1f5f9');
  n += lab(392, 245, 'RVOT（前 · 远场）', 12, '#94a3b8');
  // 升主动脉
  n += chamber('M380 132 L462 132 L462 196 L380 196 Z', '#f4f7fa');
  n += lab(421, 168, '升主动脉', 12, '#64748b');
  // 主动脉根部（窦部略宽于两侧）
  n += chamber('M292 122 L380 132 L380 196 L292 204 Z', '#fbfcfe');
  // 左房（近场，左上）
  n += ell(140, 78, 96, 38, '#eef2f7');
  n += lab(140, 84, '左房 LA（近场）', 14);
  // 左室 + 流出道（一整块，避免「飘在外面的管子」）
  n += chamber('M76 116 L76 244 Q76 312 148 312 Q220 312 220 244 L220 196 L292 196 ' +
    'L292 130 L220 130 L220 116 Z', '#eef2f7');
  n += lab(140, 252, 'LV（远场）', 14);
  n += lab(252, 168, 'LVOT', 11, '#94a3b8');
  // 房间隔
  n += stroke('M238 46 L238 116', '#cbd5e1', 1.6, '5 4');
  n += labL(242, 42, '房间隔', 11, '#94a3b8');

  // 瓣环 + 两个瓣叶（关闭态，游离缘在中线相接）
  n += stroke('M292 130 L292 196', '#64748b', 2.4);
  n += part('ncc', lensH(294, 378, 124, 164), dimColor(PALETTE.ncc, sel, 'ncc'), sel, 'NCC', 336, 146, 13);
  n += part('rcc', lensH(294, 378, 202, 164), dimColor(PALETTE.rcc, sel, 'rcc'), sel, 'RCC', 336, 192, 13);

  // 测量提示
  n += stroke('M284 126 L284 200', '#2563eb', 1.2, '4 3');
  n += labR(280, 118, '瓣环', 11, '#2563eb');

  n += cue('近场在上＝后方（左房），远场在下＝前方（RVOT）：NCC 在上、RCC 在下');
  return svgWrap(n, '主动脉瓣 TEE 长轴两叶示意图');
}

/**
 * 深部经胃底长轴 0°（Deep TG LAX）
 * 与 ME 五腔心相似的切面、图像上下颠倒：心尖在近场（上），血流背离探头。
 */
function avTgDeepLaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';

  // 升主动脉（远场，下）
  n += chamber('M186 282 L294 282 L298 340 L182 340 Z', '#f4f7fa');
  n += lab(240, 316, '升主动脉（远场）', 12, '#94a3b8');
  // 主动脉根部
  n += chamber('M188 218 L292 218 L294 282 L186 282 Z', '#fbfcfe');
  // LVOT
  n += chamber('M200 162 L280 162 L292 218 L188 218 Z', '#eef2f7');
  n += lab(240, 196, 'LVOT', 11, '#94a3b8');
  // 左室（心尖朝上＝近场）；底部收窄接 LVOT，别画成一张平底的蘑菇
  n += chamber('M240 30 C302 30 332 78 332 128 C332 148 304 162 280 162 ' +
    'L200 162 C176 162 148 148 148 128 C148 78 178 30 240 30 Z', '#eef2f7');
  n += lab(240, 100, 'LV', 18, '#64748b');
  n += lab(240, 124, '心尖（近场）', 12, '#94a3b8');

  // 瓣环
  n += stroke('M188 218 L292 218', '#64748b', 2.4);
  // 两个瓣叶（左右壁相接）——管腔窄，标签放外面用引线指
  n += part('rcc', lensV(222, 278, 190, 240), dimColor(PALETTE.rcc, sel, 'rcc'), sel);
  n += part('ncc', lensV(222, 278, 290, 240), dimColor(PALETTE.ncc, sel, 'ncc'), sel);
  n += labR(150, 252, 'RCC', 13, sel && sel !== 'rcc' ? '#b6bcc6' : '#2563eb');
  n += tie(156, 248, 196, 248, '#93b4f0');
  n += labL(332, 252, 'NCC', 13, sel && sel !== 'ncc' ? '#b6bcc6' : '#d97706');
  n += tie(326, 248, 286, 248, '#e0b48a');

  // 血流方向（背离探头）
  n += stroke('M240 168 L240 200', '#dc2626', 2.2, '6 4');
  n += '<path d="M240 208 L233 196 L247 196 Z" fill="#dc2626"/>';
  n += labL(304, 202, '血流背离探头', 11, '#dc2626');

  n += cue('心尖在近场（上）：与 ME 五腔心上下颠倒，血流与声束平行');
  return svgWrap(n, '主动脉瓣深部经胃底长轴示意图');
}

/* ══════════════════════════════════════════════════════════
   ② 二尖瓣（TEE）
   ══════════════════════════════════════════════════════════ */

/**
 * ME 四腔心 0°：右心在屏幕左、左心在屏幕右（EAE 2010）。
 * 二尖瓣在间隔侧（左侧）是前叶 A3、侧壁侧（右侧）是后叶 P1（ASE/SCA）。
 * 本切面切在瓣口中部，部分文献简化写作 A2 / P2。
 */
function mvTee4cSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';

  n += lab(120, 24, '右心', 13, '#94a3b8');
  n += lab(352, 24, '左心', 13, '#64748b');
  n += lab(240, 24, '近场（上）', 11, '#cbd5e1');

  // 心房（近场，上）
  n += ell(148, 96, 72, 42, '#eef2f7');
  n += lab(148, 102, 'RA', 15, '#64748b');
  n += ell(326, 94, 76, 43, '#eef2f7');
  n += lab(326, 100, 'LA（近场）', 14, '#64748b');
  // 心室（远场，下）；左室更长
  n += chamber(ventPath(156, 146, 66, 156), '#eef2f7');
  n += lab(156, 268, 'RV', 15, '#64748b');
  n += chamber(ventPath(320, 146, 68, 180), '#eef2f7');
  n += lab(320, 280, 'LV（远场）', 14, '#64748b');
  // 房间隔 + 室间隔（一条线到底，别左右漂）
  n += stroke('M238 54 L238 300', '#cbd5e1', 3);
  n += lab(250, 54, '房间隔', 11, '#94a3b8', 500, 'start');

  // 二尖瓣瓣环（y=146）
  n += stroke('M254 146 L390 146', '#64748b', 2);
  n += part('a3', flapDown(286, 146, 26, 44), dimColor(PALETTE.a3, sel, 'a3'), sel, 'A3', 286, 180, 13);
  n += part('p1', flapDown(358, 146, 24, 32), dimColor(PALETTE.p1, sel, 'p1'), sel, 'P1', 358, 171, 13);

  // 三尖瓣（同屏，瓣环比二尖瓣更靠心尖）
  n += stroke('M90 168 L218 168', '#64748b', 2);
  n += part('sep', flapDown(196, 168, 20, 38), dimColor(PALETTE.sep, sel, 'sep'), sel, '隔叶', 196, 196, 12);
  n += part('ant', flapDown(126, 168, 22, 30), dimColor(PALETTE.ant, sel, 'ant'), sel, '前叶', 126, 189, 12);
  n += lab(154, 162, '三尖瓣（更靠心尖）', 11, '#94a3b8');

  n += cue('右心在屏幕左、左心在右（与 TTE 相同）；前叶在间隔侧、后叶在侧壁侧');
  return svgWrap(n, '二尖瓣 TEE 四腔心分叶示意图');
}

/** ME 两腔心 90°：下壁在左（P3）、前壁在右（前叶 A2） */
function mvTee2cSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';

  // 左心耳（瓣环右侧）
  n += chamber('M356 92 Q398 78 410 104 Q400 122 356 118 Z', '#f1f5f9');
  n += labL(368, 140, '左心耳', 11, '#94a3b8');
  // 左房 / 左室
  n += ell(238, 92, 126, 44, '#eef2f7');
  n += lab(238, 98, 'LA（近场）', 14);
  n += chamber(ventPath(238, 148, 110, 170), '#eef2f7');
  n += lab(238, 276, 'LV（远场）', 14);

  // 壁
  n += labR(120, 210, '下壁', 12, '#94a3b8');
  n += labL(356, 210, '前壁', 12, '#94a3b8');

  // 瓣环 + 两叶
  n += stroke('M128 148 L348 148', '#64748b', 2);
  n += part('p3', flapDown(188, 148, 34, 40), dimColor(PALETTE.p3, sel, 'p3'), sel, 'P3', 188, 178, 14);
  n += part('a2', flapDown(296, 148, 34, 60), dimColor(PALETTE.a2, sel, 'a2'), sel, 'A2', 296, 196, 14);

  n += cue('90° 两腔心：下壁在左、前壁在右 —— 后叶 P3 在左、前叶在右');
  return svgWrap(n, '二尖瓣 TEE 两腔心分叶示意图');
}

/** ME 长轴 120–140°：P2 在左（后壁侧）、A2 在右（主动脉瓣侧） */
function mvTeeLaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';

  // 主动脉根部 + 升主动脉（右侧，与 LVOT 一条直线）
  n += chamber('M292 126 L462 132 L462 194 L292 200 Z', '#f4f7fa');
  n += labL(396, 166, '主动脉根部', 11, '#94a3b8');
  // 左房
  n += ell(140, 78, 96, 38, '#eef2f7');
  n += lab(140, 84, 'LA（近场）', 14);
  // 左室 + 流出道
  n += chamber('M76 116 L76 244 Q76 312 148 312 Q220 312 220 244 L220 196 L286 196 ' +
    'L286 132 L220 132 L220 116 Z', '#eef2f7');
  n += lab(140, 256, 'LV（远场）', 14);
  // 房间隔（LA 右缘）
  n += stroke('M236 46 L236 116', '#cbd5e1', 1.6, '5 4');
  n += labL(240, 42, '房间隔', 11, '#94a3b8');

  // 二尖瓣瓣环（LA-LV 交界，y=116）
  n += stroke('M78 116 L220 116', '#64748b', 2);
  n += part('p2', flapDown(122, 116, 30, 34), dimColor(PALETTE.p2, sel, 'p2'), sel, 'P2', 122, 146, 14);
  n += part('a2', flapDown(196, 116, 28, 52), dimColor(PALETTE.a2, sel, 'a2'), sel, 'A2', 196, 158, 14);
  n += lab(122, 100, '后壁侧', 11, '#94a3b8');
  n += lab(200, 100, '主动脉瓣侧', 11, '#94a3b8');

  n += cue('120–140°：后叶 P2 在左（后壁侧）、前叶 A2 在右（主动脉瓣侧），LVOT 同屏');
  return svgWrap(n, '二尖瓣 TEE 长轴分叶示意图');
}

/**
 * ME 二尖瓣交界切面（ME MC，45–60°）
 * 屏幕方位：左 P3 · 中 A2 · 右 P1（ASE/SCA）。A2 在远场，故显示更长。
 */
function mvTeeCommissuralSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';

  n += ell(240, 90, 122, 44, '#eef2f7');
  n += lab(240, 96, 'LA（近场）', 14);
  n += chamber(ventPath(240, 144, 116, 178), '#eef2f7');
  n += lab(240, 288, 'LV（远场）', 14);

  n += stroke('M124 144 L356 144', '#64748b', 2);
  n += part('p3', flapDown(172, 144, 28, 34), dimColor(PALETTE.p3, sel, 'p3'), sel, 'P3', 172, 172, 14);
  n += part('a2', flapDown(240, 144, 30, 62), dimColor(PALETTE.a2, sel, 'a2'), sel, 'A2', 240, 198, 15);
  n += part('p1', flapDown(308, 144, 28, 34), dimColor(PALETTE.p1, sel, 'p1'), sel, 'P1', 308, 172, 14);

  // 两个交界
  n += stroke('M206 130 L206 186', '#dc2626', 3, '5 4');
  n += stroke('M274 130 L274 186', '#dc2626', 3, '5 4');
  n += lab(206, 122, '交界', 11, '#dc2626');
  n += lab(274, 122, '交界', 11, '#dc2626');

  n += cue('45–60° 交界切面：左 P3 · 中 A2 · 右 P1，两个交界被同一平面横穿');
  return svgWrap(n, '二尖瓣 TEE 交界切面分叶示意图');
}

/**
 * 3D TEE 外科视角（瓣口正面观 / en-face）
 * 主动脉瓣在 12 点；A1 / P1 邻左心耳在左，A3 / P3 在右。
 * 前叶贴主动脉瓣侧、后叶贴左室后壁侧；后叶占瓣环约 2/3 周径但更矮，
 * 前叶占 1/3 周径却更长，两叶面积大致相当（常引作 60% : 40%）。
 */
function mvAreaSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 240, cy = 198, R = 126, ri = 30;
  let n = '';

  // 主动脉瓣标记（12 点）
  n += chamber('M198 46 Q240 22 282 46 L278 74 Q240 54 202 74 Z', '#f4f7fa');
  n += lab(240, 18, '主动脉瓣', 11, '#94a3b8');
  // 左心耳（左侧地标）
  n += chamber('M46 200 Q26 158 64 140 Q92 156 82 200 Z', '#f4f7fa');
  n += lab(54, 130, '左心耳', 11, '#94a3b8');

  // 瓣环
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R + 12) + '" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>';

  // 前叶 120°（上，180–360）· 后叶 240°（下，0–180）
  const segs = [
    ['a1', 180, 240], ['a2', 240, 300], ['a3', 300, 360],
    ['p3', 0, 60], ['p2', 60, 120], ['p1', 120, 180],
  ];
  segs.forEach(function (s) {
    const mid = (s[1] + s[2]) / 2;
    n += part(s[0], wedge(cx, cy, ri, R, s[1], s[2]),
      dimColor(PALETTE[s[0]], sel, s[0]), sel, s[0].toUpperCase(), ...pt(cx, cy, 94, mid), 14);
  });

  // 两个交界（3 点与 9 点方向）
  n += '<circle cx="' + (cx - R) + '" cy="' + cy + '" r="4.5" fill="#fff" stroke="#64748b" stroke-width="1.8"/>';
  n += '<circle cx="' + (cx + R) + '" cy="' + cy + '" r="4.5" fill="#fff" stroke="#64748b" stroke-width="1.8"/>';
  n += labR(84, 214, '前外侧交界', 11, '#dc2626');
  n += tie(88, 208, cx - R - 4, cy + 2, '#f0a5a5');
  n += labL(396, 214, '后内侧交界', 11, '#dc2626');
  n += tie(392, 208, cx + R + 4, cy + 2, '#f0a5a5');

  n += cue('3D 外科视角：主动脉瓣在 12 点，上三分之一是前叶 A1–A3（左 A1 / 右 A3）');
  return svgWrap(n, '二尖瓣 3D TEE 外科视角分叶示意图');
}

/**
 * 经胃底基底短轴 0°（TG basal SAX）
 * 「鱼嘴样」开口的经典切面，MS 时直接描记瓣口面积。
 * 方位（Annals of Cardiac Anaesthesia）：前叶在左、后叶在右；
 * 后内侧交界贴近场（上），前外侧交界在远场（下）。
 */
function mvTgSaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 240, cy = 190, R = 112, ri = 30;
  let n = '';

  n += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R + 14) + '" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>';

  // 前叶（左半）、后叶（右半）
  n += part('a2', wedge(cx, cy, ri, R, 90, 270), dimColor(PALETTE.a2, sel, 'a2'), sel, '前叶',
    ...pt(cx, cy, 74, 180), 15);
  n += part('p2', wedge(cx, cy, ri, R, -90, 90), dimColor(PALETTE.p2, sel, 'p2'), sel, '后叶',
    ...pt(cx, cy, 74, 0), 15);

  // 瓣口（鱼嘴样）
  n += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + ri + '" ry="' + (ri - 4) + '" fill="#fafbfc" stroke="#94a3b8" stroke-width="1.6"/>';

  // 两个交界（上下）
  n += stroke('M' + cx + ' ' + (cy - R - 12) + ' L' + cx + ' ' + (cy - ri - 4), '#dc2626', 2.4, '5 4');
  n += stroke('M' + cx + ' ' + (cy + R + 12) + ' L' + cx + ' ' + (cy + ri + 4), '#dc2626', 2.4, '5 4');
  n += lab(cx, cy - R - 26, '后内侧交界（近场）', 12, '#dc2626');
  n += lab(cx, cy + R + 32, '前外侧交界（远场）', 12, '#dc2626');

  n += cue('经胃底 0°：前叶在左、后叶在右；MS 时沿内缘描记瓣口面积（planimetry）');
  return svgWrap(n, '二尖瓣 TEE 经胃底短轴示意图');
}

/* ══════════════════════════════════════════════════════════
   ③ 三尖瓣（TEE）
   ══════════════════════════════════════════════════════════ */

/**
 * ME 四腔心 0°：右心在屏幕左。三尖瓣隔叶在间隔侧（屏幕右）、前叶在游离壁侧（屏幕左）
 * （EAE 2010）。后叶在此切面看不到。
 * 隔叶附着点比二尖瓣前叶更靠心尖（正常约 8 mm），Ebstein 时显著下移。
 */
function tvTee4cSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';

  n += lab(126, 24, '右心', 13, '#64748b');
  n += lab(352, 24, '左心（对照）', 11, '#cbd5e1');

  n += ell(148, 96, 72, 42, '#eef2f7');
  n += lab(148, 102, 'RA（近场）', 13, '#64748b');
  n += ell(326, 94, 72, 42, '#f4f7fa');
  n += lab(326, 100, 'LA', 14, '#94a3b8');
  n += chamber(ventPath(148, 168, 66, 148), '#eef2f7');
  n += lab(148, 288, 'RV（远场）', 13, '#64748b');
  n += chamber(ventPath(326, 148, 66, 168), '#f4f7fa');
  n += lab(326, 288, 'LV', 14, '#94a3b8');

  n += stroke('M238 54 L238 300', '#cbd5e1', 3);
  n += lab(250, 54, '房间隔', 11, '#94a3b8', 500, 'start');

  // 三尖瓣瓣环（比二尖瓣更靠心尖）
  n += stroke('M90 168 L212 168', '#64748b', 2);
  n += part('sep', flapDown(192, 168, 20, 40), dimColor(PALETTE.sep, sel, 'sep'), sel, '隔叶', 192, 198, 12);
  n += part('ant', flapDown(124, 168, 22, 30), dimColor(PALETTE.ant, sel, 'ant'), sel, '前叶', 124, 190, 12);
  n += lab(150, 156, '三尖瓣', 11, '#94a3b8');

  // 二尖瓣对照
  n += stroke('M252 148 L400 148', '#e2e8f0', 2, '4 3');
  n += lab(326, 140, '二尖瓣（对照）', 11, '#cbd5e1');

  n += cue('隔叶在间隔侧（屏幕右）、前叶在游离壁侧（屏幕左）；附着点比二尖瓣更靠心尖');
  return svgWrap(n, '三尖瓣 TEE 四腔心分叶示意图');
}

/**
 * ME 右室流入-流出道切面（ME RV inflow-outflow，60–90°）
 * 同屏可见 RA（近场）、RV（远场）、三尖瓣、主动脉瓣短轴、RVOT 与肺动脉瓣。
 * 前叶贴主动脉瓣 / RVOT 侧、后叶贴右室游离壁侧 —— 用邻居认叶，别背左右。
 */
function tvTeeRvinSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';

  // 主动脉瓣短轴（右侧地标）
  n += '<circle cx="374" cy="150" r="44" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2"/>';
  n += lab(374, 148, '主动脉瓣', 11, '#64748b');
  n += lab(374, 164, '（短轴）', 10, '#94a3b8');
  // RVOT（上方）+ 肺动脉瓣
  n += chamber('M330 78 Q400 52 462 80 L460 112 Q396 88 330 112 Z', '#f4f7fa');
  n += lab(396, 68, 'RVOT', 11, '#94a3b8');
  n += '<circle cx="436" cy="96" r="13" fill="#eef2f7" stroke="#94a3b8" stroke-width="1.6"/>';
  n += labR(420, 126, '肺动脉瓣', 10, '#94a3b8');

  // 右房（近场）
  n += chamber('M72 190 L262 196 C262 96 172 54 104 76 C78 88 72 130 72 190 Z', '#eef2f7');
  n += lab(160, 120, 'RA（近场）', 14);
  // 右室（远场）
  n += chamber('M72 190 L262 196 C290 268 288 314 258 336 C182 356 100 342 76 314 C66 262 70 228 72 190 Z', '#eef2f7');
  n += lab(164, 286, 'RV（远场）', 14);

  // 三尖瓣瓣环
  n += stroke('M80 191 L258 197', '#64748b', 2);
  n += part('post', flapDown(136, 192, 36, 40), dimColor(PALETTE.post, sel, 'post'), sel, '后叶', 136, 222, 13);
  n += part('ant', flapDown(222, 195, 30, 36), dimColor(PALETTE.ant, sel, 'ant'), sel, '前叶', 222, 220, 13);
  n += lab(128, 172, '贴游离壁侧', 10.5, '#94a3b8');
  n += lab(232, 172, '贴主动脉瓣侧', 10.5, '#94a3b8');

  n += cue('60–90°：前叶贴主动脉瓣 / RVOT 侧，后叶贴右室游离壁侧；隔叶回四腔心');
  return svgWrap(n, '三尖瓣 TEE 右室流入流出道分叶示意图');
}

/**
 * TEE 经胃底三尖瓣短轴（TG SAX，约 30°）
 * 唯一能同屏看全三个瓣叶的 2D 切面。
 * 隔叶贴室间隔（屏幕右，挨着左室），前叶在前方（远场，下方），后叶在后方（近场，上方）。
 */
function tvTeeTgsaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 234, cy = 190, R = 100;
  let n = '';

  // 地标：左室 + 室间隔在右侧，RV 前壁在下方
  n += chamber('M340 110 C398 128 404 254 344 272 L330 190 Z', '#f1f5f9');
  n += labL(356, 196, '左室', 11, '#94a3b8');
  n += lab(cx, 348, 'RV 前壁（远场）', 11, '#94a3b8');

  n += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R + 12) + '" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>';

  // 隔叶（右，贴间隔）、前叶（下，远场）、后叶（上，近场）
  n += part('sep', sector(cx, cy, R, -60, 60), dimColor(PALETTE.sep, sel, 'sep'), sel, '隔叶',
    ...pt(cx, cy, 58, 0), 14);
  n += part('ant', sector(cx, cy, R, 60, 180), dimColor(PALETTE.ant, sel, 'ant'), sel, '前叶',
    ...pt(cx, cy, 58, 120), 14);
  n += part('post', sector(cx, cy, R, 180, 300), dimColor(PALETTE.post, sel, 'post'), sel, '后叶',
    ...pt(cx, cy, 58, 240), 14);

  [-60, 60, 180].forEach(function (a) {
    const p = pt(cx, cy, R, a);
    n += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="3.5" fill="#fff" stroke="#64748b" stroke-width="1.5"/>';
  });
  n += lab(cx, 62, '近场（后）', 11, '#94a3b8');

  n += cue('经胃底短轴（约 30°）：唯一能同屏看全三叶');
  return svgWrap(n, '三尖瓣 TEE 经胃底短轴三叶示意图');
}

/* ══════════════════════════════════════════════════════════
   ④ 肺动脉瓣（TEE）
   ══════════════════════════════════════════════════════════ */

/**
 * 肺动脉瓣短轴（高位 ME 右室流出道 / 上食管大动脉短轴，约 30–60°）
 * 三叶按解剖位置命名：前叶 / 左叶 / 右叶。没有冠脉开口当路标，
 * 认瓣叶靠相邻的 RVOT（前）与左 / 右肺动脉分支。
 */
function pvTeeSaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  const cx = 240, cy = 184, R = 92;
  let n = '';

  // 分支地标：右肺动脉在左、左肺动脉在右（屏幕左＝患者右）
  n += chamber('M34 112 Q116 90 166 118 L158 162 Q108 142 34 158 Z', '#f1f5f9');
  n += labR(160, 102, '右肺动脉', 11, '#94a3b8');
  n += chamber('M446 112 Q364 90 314 118 L322 162 Q372 142 446 158 Z', '#f1f5f9');
  n += labL(320, 102, '左肺动脉', 11, '#94a3b8');
  // RVOT（前 · 远场，在下）
  n += chamber('M150 272 Q240 258 330 272 L330 314 Q240 302 150 314 Z', '#f1f5f9');
  n += lab(240, 300, 'RVOT（前 · 远场）', 12, '#94a3b8');

  n += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R + 14) + '" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="2"/>';

  // 前叶（下，贴 RVOT）、左叶（右，贴左肺动脉）、右叶（左，贴右肺动脉）
  n += part('pv-ant', sector(cx, cy, R, 30, 150), dimColor(PALETTE.pvAnt, sel, 'pv-ant'), sel, '前叶',
    ...pt(cx, cy, 52, 90), 14);
  n += part('pv-l', sector(cx, cy, R, -30, 30), dimColor(PALETTE.pvL, sel, 'pv-l'), sel, '左叶',
    ...pt(cx, cy, 52, 0), 14);
  n += part('pv-r', sector(cx, cy, R, 150, 270), dimColor(PALETTE.pvR, sel, 'pv-r'), sel, '右叶',
    ...pt(cx, cy, 52, 210), 14);

  [-30, 30, 150].forEach(function (a) {
    const p = pt(cx, cy, R, a);
    n += '<circle cx="' + f1(p[0]) + '" cy="' + f1(p[1]) + '" r="3.5" fill="#fff" stroke="#64748b" stroke-width="1.5"/>';
  });

  n += cue('三叶（前 / 左 / 右）没有冠脉开口当地标：认瓣叶看它挨着 RVOT 还是肺动脉分支');
  return svgWrap(n, '肺动脉瓣 TEE 短轴三叶示意图');
}

/* ══════════════════════════════════════════════════════════
   视图元数据（与 segment-svg.js 的 WALL_VIEWS 同构）
   ★ v1.5.0：只保留 TEE 切面（TTE 短轴/四腔心已在「切面学习」里，重复），
     按 ASE/SCA 标准 TEE 切面集扩充到 13 个。
     tee 字段 = 探头位置 + 多平面角度 + 小图上靶点坐标，用于 probeSvg。
   ══════════════════════════════════════════════════════════ */

const VALVE_VIEWS = [
  /* ── 主动脉瓣 ── */
  {
    id: 'avTeeSax',
    group: '主动脉瓣',
    title: '主动脉瓣 · TEE 短轴 30–60°',
    sub: '近场（上）＝左房、远场（下）＝RVOT。屏幕左右与 TTE 相同（左＝患者右）：' +
      'NCC 在左（紧邻房间隔）、LCC 在右（贴肺动脉）、RCC 在下（贴 RVOT）。红点＝冠脉开口。',
    parts: ['rcc', 'lcc', 'ncc'],
    tee: { pos: 'ME', deg: '30–60°', target: [204, 106] },
    fn: avTeeSaxSvg,
  },
  {
    id: 'avTeeLax',
    group: '主动脉瓣',
    title: '主动脉瓣 · TEE 长轴 120–140°',
    sub: '只看到两叶：NCC 在上（贴房间隔 / 后）、RCC 在下（贴 RVOT / 前）；' +
      'LCC 一般不显示，三叶是否齐全要回短轴确认。测瓣环与瓣上内径也在这里。',
    parts: ['rcc', 'ncc'],
    tee: { pos: 'ME', deg: '120–140°', target: [204, 106] },
    fn: avTeeLaxSvg,
  },
  {
    id: 'avTgDeepLax',
    group: '主动脉瓣',
    title: '主动脉瓣 · 深部经胃底长轴 0°',
    sub: '心尖在近场（上），与 ME 五腔心上下颠倒；血流背离探头，最容易把声束对齐 —— ' +
      '测 Vmax 与平均压差首选。代价是分辨率不如 ME，瓣叶形态别在这里下结论。',
    parts: ['rcc', 'ncc'],
    tee: { pos: 'TG', deg: '0°', target: [204, 106] },
    fn: avTgDeepLaxSvg,
  },

  /* ── 二尖瓣 ── */
  {
    id: 'mvTee4c',
    group: '二尖瓣',
    title: '二尖瓣 · TEE 四腔心 0°',
    sub: '右心在屏幕左、左心在右（与 TTE 相同）。二尖瓣：前叶 A3 在间隔侧（左）、' +
      '后叶 P1 在侧壁侧（右）；切在瓣口中部时也有文献写作 A2 / P2。三尖瓣同屏（隔叶 + 前叶）。',
    parts: ['a3', 'p1', 'sep', 'ant'],
    tee: { pos: 'ME', deg: '0°', target: [188, 110] },
    fn: mvTee4cSvg,
  },
  {
    id: 'mvTee2c',
    group: '二尖瓣',
    title: '二尖瓣 · TEE 两腔心 90°',
    sub: '下壁在左、前壁在右；后叶 P3 在左、前叶 A2 在右。与四腔心互为正交，' +
      '配合起来才能定位 P 段的里外；测二尖瓣口面积与压差时角度比四腔心更稳。',
    parts: ['p3', 'a2'],
    tee: { pos: 'ME', deg: '90°', target: [188, 110] },
    fn: mvTee2cSvg,
  },
  {
    id: 'mvTeeLax',
    group: '二尖瓣',
    title: '二尖瓣 · TEE 长轴 120–140°',
    sub: '后叶 P2 在左（后壁侧）、前叶 A2 在右（主动脉瓣侧），LVOT 与主动脉瓣同屏。' +
      '二尖瓣 + 主动脉瓣联合病变、以及 LVOT 梗阻 / SAM 首选这个切面。',
    parts: ['p2', 'a2'],
    tee: { pos: 'ME', deg: '120–140°', target: [188, 110] },
    fn: mvTeeLaxSvg,
  },
  {
    id: 'mvTeeCommissural',
    group: '二尖瓣',
    title: '二尖瓣 · TEE 45–60° 交界切面',
    sub: '屏幕方位：左 P3 · 中 A2 · 右 P1；两个交界被同一个平面横穿。' +
      'A2 属前叶、位于远场，所以显示得比两侧的 P 段更长。',
    parts: ['p3', 'a2', 'p1'],
    tee: { pos: 'ME', deg: '45–60°', target: [188, 110] },
    fn: mvTeeCommissuralSvg,
  },
  {
    id: 'mvTee3d',
    group: '二尖瓣',
    title: '二尖瓣 · 3D TEE 外科视角',
    sub: '瓣口正面观：主动脉瓣在 12 点，上三分之一是前叶 A1–A3（左 A1 / 右 A3）、' +
      '下三分之二是后叶 P1–P3（左 P1 / 右 P3）。A1 / P1 邻左心耳。',
    parts: ['a1', 'a2', 'a3', 'p1', 'p2', 'p3'],
    tee: { pos: 'ME', deg: '全容积', target: [188, 110] },
    fn: mvAreaSvg,
  },
  {
    id: 'mvTgSax',
    group: '二尖瓣',
    title: '二尖瓣 · 经胃底基底短轴 0°',
    sub: '2D 下只分大系：前叶在左、后叶在右，开口呈鱼嘴样；后内侧交界近场、前外侧交界远场。' +
      'MS 时直接描记瓣口面积（planimetry）；细分 P1–P3 请用 3D 或交界切面。',
    parts: ['a2', 'p2'],
    tee: { pos: 'TG', deg: '0°', target: [188, 110] },
    fn: mvTgSaxSvg,
  },

  /* ── 三尖瓣 ── */
  {
    id: 'tvTee4c',
    group: '三尖瓣',
    title: '三尖瓣 · TEE 四腔心 0°',
    sub: '右心在屏幕左。隔叶在间隔侧（屏幕右）、前叶在游离壁侧（屏幕左）；后叶此切面看不到，' +
      '要 60–90° 右室流入-流出道。隔叶附着点比二尖瓣前叶更靠心尖（正常约 8 mm）。',
    parts: ['sep', 'ant'],
    tee: { pos: 'ME', deg: '0°', target: [162, 118] },
    fn: tvTee4cSvg,
  },
  {
    id: 'tvTeeRvin',
    group: '三尖瓣',
    title: '三尖瓣 · TEE 右室流入-流出道 60–90°',
    sub: '同屏可见 RA、RV、三尖瓣、主动脉瓣短轴、RVOT 与肺动脉瓣。' +
      '前叶贴主动脉瓣 / RVOT 侧、后叶贴右室游离壁侧 —— 用邻居认叶，别背左右。',
    parts: ['post', 'ant'],
    tee: { pos: 'ME', deg: '60–90°', target: [162, 118] },
    fn: tvTeeRvinSvg,
  },
  {
    id: 'tvTeeTgsax',
    group: '三尖瓣',
    title: '三尖瓣 · TEE 经胃底短轴 约 30°',
    sub: '唯一能同屏看全三叶的 2D 切面：隔叶贴室间隔（屏幕右，挨着左室）、' +
      '前叶在前方（远场）、后叶在后方（近场）。',
    parts: ['sep', 'ant', 'post'],
    tee: { pos: 'TG', deg: '约 30°', target: [162, 118] },
    fn: tvTeeTgsaxSvg,
  },

  /* ── 肺动脉瓣 ── */
  {
    id: 'pvTeeSax',
    group: '肺动脉瓣',
    title: '肺动脉瓣 · TEE 短轴 30–60°',
    sub: '高位 / 上食管大动脉短轴：前叶 / 左叶 / 右叶。没有冠脉开口当路标，' +
      '认瓣叶靠相邻的 RVOT 与左 / 右肺动脉分支，方位别硬背。',
    parts: ['pv-ant', 'pv-l', 'pv-r'],
    tee: { pos: 'UE', deg: '30–60°', target: [120, 60] },
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
  return probeSvg(v.tee);
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
