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

/**
 * 相控阵扇面：顶点 (cx, cy)，向下张开 half 度，半径 R
 * ★ TEE 探头在食管紧贴左房后壁，所以扇面顶点朝上、近场在上 —— 与 TTE 同向，
 *   但两者看到的「近场结构」不同（TTE 近场是心尖 / 胸壁，TEE 近场是左房 / 食管）。
 *   长轴类视图统一用这个底盘，不要再用矩形堆腔室（2026-11-21 用户反馈「很难看」）。
 */
function fanPath(cx, cy, R, half) {
  const p1 = pt(cx, cy, R, 90 - half);
  const p2 = pt(cx, cy, R, 90 + half);
  return 'M' + f1(cx) + ' ' + f1(cy) +
    ' L' + f1(p1[0]) + ' ' + f1(p1[1]) +
    ' A' + R + ' ' + R + ' 0 0 1 ' + f1(p2[0]) + ' ' + f1(p2[1]) + ' Z';
}

/** 扇面底盘（浅蓝径向渐变 + 细描边） */
function fanBg(cx, cy, R, half) {
  return '<defs><radialGradient id="vaFanGrad" cx="50%" cy="0%" r="115%">' +
    '<stop offset="0" stop-color="#f8fbfe"/><stop offset="1" stop-color="#e4edf8"/>' +
    '</radialGradient></defs>' +
    '<path d="' + fanPath(cx, cy, R, half) + '" fill="url(#vaFanGrad)" ' +
    'stroke="#c3cedd" stroke-width="1.6"/>';
}

/**
 * 细描边腔室：长轴 / 流入道类视图用它，避免 2px 深灰边把画面切成「流程框图」
 * （2026-11-21 用户反馈「这种反正很难看」）
 */
function soft(d, fill) {
  return '<path d="' + d + '" fill="' + (fill || '#ffffff') + '" stroke="#9aa9bd" stroke-width="1.5"/>';
}

/** 锥形管：沿轴线从 (x0,y0) 到 (x1,y1)，半宽 w0 → w1，端头圆钝
 *  主动脉根部 / 升主动脉 / RVOT 用它，避免斜放方框的「流程图」感 */
function tube(x0, y0, x1, y1, w0, w1, fill) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  return '<path d="M' + f1(x0 + nx * w0) + ' ' + f1(y0 + ny * w0) +
    ' L' + f1(x1 + nx * w1) + ' ' + f1(y1 + ny * w1) +
    ' Q' + f1(x1 + ux * w1 * 0.92) + ' ' + f1(y1 + uy * w1 * 0.92) +
    ' ' + f1(x1 - nx * w1) + ' ' + f1(y1 - ny * w1) +
    ' L' + f1(x0 - nx * w0) + ' ' + f1(y0 - ny * w0) +
    ' Q' + f1(x0 - ux * w0 * 0.5) + ' ' + f1(y0 - uy * w0 * 0.5) +
    ' ' + f1(x0 + nx * w0) + ' ' + f1(y0 + ny * w0) +
    ' Z" fill="' + (fill || '#ffffff') + '" stroke="#9aa9bd" stroke-width="1.5"/>';
}

/** 椭圆腔室路径（心房用） */
function ellPath(cx, cy, rx, ry) {
  return 'M' + f1(cx - rx) + ' ' + f1(cy) +
    ' A' + f1(rx) + ' ' + f1(ry) + ' 0 1 0 ' + f1(cx + rx) + ' ' + f1(cy) +
    ' A' + f1(rx) + ' ' + f1(ry) + ' 0 1 0 ' + f1(cx - rx) + ' ' + f1(cy) + ' Z';
}

/** 心房：上半椭圆 + 底部水平线（底部就是房室瓣环平面，与心室顶严丝合缝） */
function atriaPath(cx, baseY, rx, ry) {
  return 'M' + f1(cx - rx) + ' ' + f1(baseY) +
    ' A' + f1(rx) + ' ' + f1(ry) + ' 0 0 1 ' + f1(cx + rx) + ' ' + f1(baseY) + ' Z';
}

/** 锥形心室：基底在 top（半宽 halfW），向心尖收窄、圆钝收口 */
function ventCone(cx, top, halfW, tipY) {
  const h = tipY - top;
  return 'M' + f1(cx - halfW) + ' ' + f1(top) +
    ' C' + f1(cx - halfW * 1.03) + ' ' + f1(top + h * 0.46) + ' ' +
    f1(cx - halfW * 0.5) + ' ' + f1(tipY - 12) + ' ' + f1(cx) + ' ' + f1(tipY) +
    ' C' + f1(cx + halfW * 0.5) + ' ' + f1(tipY - 12) + ' ' +
    f1(cx + halfW * 1.03) + ' ' + f1(top + h * 0.46) + ' ' + f1(cx + halfW) + ' ' + f1(top) + ' Z';
}

/** 切面图统一底盘：扇面 + 渐变 + 裁切定义（长轴 / 四腔类视图共用） */
function fanBox(cx, cy, R, half) {
  const fd = fanPath(cx, cy, R, half);
  return '<defs><radialGradient id="vaFanGrad" cx="50%" cy="0%" r="110%">' +
    '<stop offset="0" stop-color="#f9fbfe"/><stop offset="1" stop-color="#e3ecf8"/>' +
    '</radialGradient><clipPath id="vaFanClip"><path d="' + fd + '" fill="#ffffff"/></clipPath></defs>' +
    '<path d="' + fd + '" fill="url(#vaFanGrad)" stroke="#d3dde9" stroke-width="1.4"/>';
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

/** 底部统一方位提示（★ 12px / 深色，430px 宽时仍可读；一行最多约 30 个汉字，超出会被画布右边裁掉） */
function cue(text) {
  return stroke('M16 356 L464 356', '#e2e8f0', 1) + labL(16, 382, text, 12, '#64748b', 600);
}

/* ══════════════════════════════════════════════════════════
   探头位置 / 扫描平面小图
   ★ 心脏画成「左侧位」：左＝前（胸骨侧），右＝后（食管侧），
     所以左房紧贴食管——这是 TEE 一切切面的出发点。
     竖条 = 食管，三角 = 探头晶片面（永远朝左），
     蓝扇面 = 这次扫查的切面，红点 = 该切面要看的瓣膜。
   ══════════════════════════════════════════════════════════ */

/** 探头深度（食管内的位置）→ 小图里的 y 坐标 */
const PROBE_Y = { UE: 44, ME: 96, TG: 166 };

/** 探头位置中文名 */
const PROBE_NAME = { UE: '食管上段', ME: '食管中段', TG: '经胃底' };

function probeSvg(tee) {
  const pos = tee.pos || 'ME';
  const py = PROBE_Y[pos] === undefined ? 78 : PROBE_Y[pos];
  const tg = tee.target || [196, 108];
  const tx = tg[0];
  const ty = tg[1];
  const px = 236;
  let n = '';

  // ── 心脏侧位轮廓：左＝前（胸骨侧），右＝后（食管侧）
  // 竖长的蛋形 + 房室交界 / 间隔两条分隔线；不再用四个椭圆拼腔室
  n += '<path d="M104 24 C140 16 180 30 194 60 C206 86 204 134 192 166 ' +
    'C180 196 156 208 132 202 C104 196 84 176 78 148 C72 120 76 58 104 24 Z" ' +
    'fill="#f1f5f9" stroke="#8fa0b5" stroke-width="1.6"/>';
  n += stroke('M82 118 C120 110 172 108 202 114', '#cbd5e1', 1.6);
  n += stroke('M148 26 C146 84 144 146 142 202', '#cbd5e1', 1.6);

  n += lab(106, 82, 'RV', 12, '#64748b');
  n += lab(178, 76, 'LA', 12, '#475569');
  n += lab(108, 168, 'LV', 12, '#64748b');
  n += lab(176, 162, 'RA', 12, '#64748b');

  // ── 食管 + 探头晶片面（永远朝左）──
  n += '<rect x="238" y="20" width="22" height="190" rx="11" fill="#e8eef7" ' +
    'stroke="#94a3b8" stroke-width="1.4"/>';
  n += '<text x="274" y="118" text-anchor="middle" font-size="10" fill="#64748b" ' +
    'transform="rotate(-90 274 118)">食管</text>';
  n += '<path d="M' + px + ' ' + (py - 11) + ' L' + px + ' ' + (py + 11) + ' L' + (px - 15) + ' ' + py +
    ' Z" fill="#2563eb"/>';

  // ── 扇面：从晶片面张开，覆盖目标瓣膜所在区域 ──
  const dx = tx - px;
  const dy = ty - py;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  let len = Math.min(Math.max(dist * 1.55, 96), 168);
  const ang = Math.atan2(dy, dx);
  const had = 25 * RAD;
  // 扇面上缘若朝上，按「不越过画布顶部」反推最大半径
  [ang - had, ang + had].forEach(function (a) {
    const sn = Math.sin(a);
    if (sn < -0.02) len = Math.min(len, (py - 8) / -sn);
  });
  const p1 = [px + len * Math.cos(ang - had), py + len * Math.sin(ang - had)];
  const p2 = [px + len * Math.cos(ang + had), py + len * Math.sin(ang + had)];
  n += '<path d="M' + px + ' ' + f1(py) + ' L' + f1(p1[0]) + ' ' + f1(p1[1]) +
    ' A' + f1(len) + ' ' + f1(len) + ' 0 0 1 ' + f1(p2[0]) + ' ' + f1(p2[1]) + ' Z" ' +
    'fill="#2563eb" fill-opacity="0.10" stroke="#a8c1ec" stroke-width="1"/>';

  // ── 目标瓣膜 ──
  n += '<circle cx="' + f1(tx) + '" cy="' + f1(ty) + '" r="5" fill="#dc2626" ' +
    'stroke="#fff" stroke-width="1.8"/>';

  // ── 多平面角度徽标 + 探头位置 ──
  n += '<rect x="8" y="8" width="100" height="26" rx="8" fill="#eef2ff" ' +
    'stroke="#c7d2fe" stroke-width="1.4"/>';
  n += lab(58, 26, tee.deg || '', 13, '#2563eb', 700);
  n += labL(8, 48, PROBE_NAME[pos], 11, '#64748b', 600);

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
  // 相控阵扇面：探头在食管紧贴左房后壁，近场（上）是左房；
  // 升主动脉与 RVOT 向右伸出扇面被截断 —— 与真实图像一致
  n += fanBox(240, 8, 500, 58);

  n += '<g clip-path="url(#vaFanClip)">';
  // RVOT（前 · 远场）：主动脉根部前下方的锥形带
  n += soft('M302 180 C360 196 430 222 500 244 L500 280 C430 258 360 236 302 220 Z', '#eef3fa');
  // 主动脉根部（窦部略膨大）→ 升主动脉
  n += soft('M300 128 C352 118 400 108 434 100 L434 150 C400 146 352 150 300 176 Z', '#fbfdff');
  // 左房（近场 · 顶部）
  n += soft('M152 122 C152 76 180 44 226 42 C268 40 296 76 298 120 L298 126 L152 126 Z', '#ffffff');
  // 左室：基底宽、向心尖明显收窄；LVOT 在基底右上方接瓣环
  n += soft('M150 126 C144 220 160 300 196 314 C226 302 238 240 241 186 ' +
    'L298 178 L298 126 Z', '#ffffff');
  // 二尖瓣前叶（长轴只见前叶一角）
  n += '<path d="M186 126 C196 150 214 150 222 126 C214 142 196 142 186 126 Z" fill="#d97706" opacity="0.85"/>';
  // 瓣环 + 两个瓣叶（关闭态，游离缘在中线相接）
  n += part('ncc', lensH(302, 356, 128, 152), dimColor(PALETTE.ncc, sel, 'ncc'), sel, 'NCC', 328, 142, 12);
  n += part('rcc', lensH(302, 356, 176, 152), dimColor(PALETTE.rcc, sel, 'rcc'), sel, 'RCC', 328, 170, 12);
  n += '</g>';

  // 房间隔（左房与右房之间）
  n += stroke('M302 46 L302 120', '#cbd5e1', 1.6, '5 4');

  // 标注
  n += lab(225, 86, '左房 LA（近场）', 14, '#475569');
  n += lab(194, 250, 'LV（远场）', 14, '#475569');
  n += lab(268, 158, 'LVOT', 10, '#94a3b8');
  n += labL(306, 42, '房间隔', 11, '#94a3b8');
  n += tie(410, 104, 376, 124, '#cbd5e1');
  n += labL(414, 100, '升主动脉', 12, '#64748b');
  n += lab(392, 252, 'RVOT（前 · 远场）', 12, '#7c8ba1');

  // 测量提示：瓣环
  n += stroke('M292 124 L292 180', '#2563eb', 1.2, '4 3');
  n += labR(288, 196, '瓣环', 11, '#2563eb');

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
  n += fanBox(240, 8, 500, 58);

  n += '<g clip-path="url(#vaFanClip)">';
  // 升主动脉（远场 · 下）
  n += soft('M190 306 C190 320 191 332 192 344 L288 344 C289 332 290 320 290 306 Z', '#f7fafd');
  // 主动脉根部（窦部略膨大）
  n += soft('M210 256 C202 270 194 288 190 306 L290 306 C286 288 278 270 270 256 Z', '#fbfdff');
  // LVOT：自左室基底向下收窄接瓣环
  n += soft('M196 208 L284 208 C280 224 275 240 270 256 L210 256 C205 240 200 224 196 208 Z', '#ffffff');
  // 左室：心尖朝上（近场），向基底展开
  n += soft('M240 56 C198 76 176 122 174 182 L174 208 L306 208 L306 182 ' +
    'C304 122 282 76 240 56 Z', '#ffffff');
  // 主动脉瓣：RCC 在左壁、NCC 在右壁（关闭态）
  n += part('rcc', lensV(262, 302, 202, 240), dimColor(PALETTE.rcc, sel, 'rcc'), sel);
  n += part('ncc', lensV(262, 302, 278, 240), dimColor(PALETTE.ncc, sel, 'ncc'), sel);
  n += '</g>';

  // 血流方向（背离探头，向下）
  n += stroke('M240 226 L240 254', '#dc2626', 2.2, '6 4');
  n += '<path d="M240 262 L233 250 L247 250 Z" fill="#dc2626"/>';

  n += lab(240, 132, 'LV', 17, '#475569');
  n += labR(190, 46, '心尖（近场）', 12, '#94a3b8');
  n += tie(194, 44, 234, 58, '#cbd5e1');
  n += lab(240, 330, '升主动脉（远场）', 12, '#94a3b8');
  n += labL(304, 286, '血流背离探头', 11, '#dc2626');
  n += labR(186, 250, 'RCC', 13, sel && sel !== 'rcc' ? '#b6bcc6' : '#2563eb');
  n += tie(180, 246, 204, 268, '#93b4f0');
  n += labL(296, 246, 'NCC', 13, sel && sel !== 'ncc' ? '#b6bcc6' : '#d97706');
  n += tie(302, 242, 280, 264, '#e0b48a');

  n += cue('心尖在近场（上）：与 ME 五腔心上下颠倒，血流与声束平行');
  return svgWrap(n, '主动脉瓣深部经胃底长轴示意图');
}

/**
 * ME 四腔心 0°：右心在屏幕左、左心在屏幕右（EAE 2010）。
 * 二尖瓣在间隔侧（左侧）是前叶 A3、侧壁侧（右侧）是后叶 P1（ASE/SCA）。
 * 本切面切在瓣口中部，部分文献简化写作 A2 / P2。
 */
function mvTee4cSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  n += fanBox(240, 8, 500, 58);

  n += '<g clip-path="url(#vaFanClip)">';
  // 右心：三尖瓣环比二尖瓣更靠心尖（RA/RV 整体低一档）
  n += soft(atriaPath(186, 150, 52, 54), '#ffffff');
  n += soft(ventCone(186, 150, 52, 304), '#ffffff');
  // 左心
  n += soft(atriaPath(300, 138, 54, 44), '#ffffff');
  n += soft(ventCone(300, 138, 54, 320), '#ffffff');
  // 房间隔 + 室间隔（一条线到底）
  n += stroke('M243 54 L243 316', '#b9c6d6', 3);
  // 瓣环
  n += stroke('M246 138 L354 138', '#8fa0b5', 2);
  n += stroke('M134 150 L238 150', '#8fa0b5', 2);
  // 二尖瓣：A3 间隔侧、P1 侧壁侧
  n += part('a3', flapDown(274, 138, 22, 42), dimColor(PALETTE.a3, sel, 'a3'), sel);
  n += part('p1', flapDown(336, 138, 22, 32), dimColor(PALETTE.p1, sel, 'p1'), sel);
  // 三尖瓣：隔叶靠间隔、前叶靠游离壁
  n += part('sep', flapDown(222, 150, 18, 34), dimColor(PALETTE.sep, sel, 'sep'), sel);
  n += part('ant', flapDown(158, 150, 20, 26), dimColor(PALETTE.ant, sel, 'ant'), sel);
  n += '</g>';

  n += lab(186, 120, 'RA', 15, '#475569');
  n += lab(300, 112, 'LA', 15, '#475569');
  n += lab(186, 250, 'RV', 15, '#475569');
  n += lab(300, 262, 'LV', 15, '#475569');
  n += labL(248, 58, '房间隔', 11, '#94a3b8');
  n += lab(274, 196, 'A3', 12, '#1d4ed8', 700);
  n += lab(336, 186, 'P1', 12, '#b45309', 700);
  n += lab(222, 200, '隔叶', 11, '#15803d', 700);
  n += lab(158, 192, '前叶', 11, '#7c3aed', 700);

  n += cue('右心在屏幕左、左心在右（与 TTE 相同）；前叶在间隔侧、后叶在侧壁侧');
  return svgWrap(n, '二尖瓣 TEE 四腔心分叶示意图');
}

/** ME 两腔心 90°：下壁在左（P3）、前壁在右（前叶 A2） */
function mvTee2cSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  n += fanBox(240, 8, 500, 58);

  n += '<g clip-path="url(#vaFanClip)">';
  // 左心耳（左房右前方，袋状）
  n += soft('M330 100 C352 88 378 94 382 112 C384 130 362 140 338 136 C330 134 328 116 330 100 Z', '#f2f6fb');
  // 左房（近场）
  n += soft(atriaPath(238, 146, 110, 54), '#ffffff');
  // 左室（远场）：基底宽、向心尖收窄
  n += soft(ventCone(238, 146, 110, 318), '#ffffff');
  n += stroke('M128 146 L348 146', '#8fa0b5', 2);
  // 二尖瓣：P3 在左（下壁侧）、A2 在右（前壁侧）
  n += part('p3', flapDown(186, 146, 30, 40), dimColor(PALETTE.p3, sel, 'p3'), sel);
  n += part('a2', flapDown(292, 146, 30, 58), dimColor(PALETTE.a2, sel, 'a2'), sel);
  n += '</g>';

  n += lab(238, 120, 'LA', 15, '#475569');
  n += lab(238, 262, 'LV', 15, '#475569');
  n += labL(344, 158, '左心耳', 11, '#94a3b8');
  n += labR(122, 220, '下壁', 12, '#94a3b8');
  n += labL(354, 220, '前壁', 12, '#94a3b8');
  n += lab(186, 204, 'P3', 12, '#b45309', 700);
  n += lab(292, 220, 'A2', 12, '#1d4ed8', 700);

  n += cue('90° 两腔心：下壁在左、前壁在右 —— 后叶 P3 在左、前叶 A2 在右');
  return svgWrap(n, '二尖瓣 TEE 两腔心分叶示意图');
}

/** ME 长轴 120–140°：P2 在左（后壁侧）、A2 在右（主动脉瓣侧） */
function mvTeeLaxSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  n += fanBox(240, 8, 500, 58);

  n += '<g clip-path="url(#vaFanClip)">';
  // 主动脉根部（与 LVOT 同一轴线，二尖瓣前叶与主动脉后壁连续）
  n += soft('M300 128 C352 118 400 108 434 100 L434 150 C400 146 352 150 300 176 Z', '#f7fafd');
  // 左房（近场 · 顶部）
  n += soft('M152 122 C152 76 180 44 226 42 C268 40 296 76 298 120 L298 126 L152 126 Z', '#ffffff');
  // 左室：基底宽、向心尖收窄，LVOT 在基底右上方
  n += soft('M150 126 C144 220 160 300 196 314 C226 302 238 240 241 186 ' +
    'L298 178 L298 126 Z', '#ffffff');
  // 二尖瓣：后叶 P2 在左（后壁侧）、前叶 A2 在右（主动脉瓣侧）
  n += part('p2', flapDown(182, 126, 26, 38), dimColor(PALETTE.p2, sel, 'p2'), sel);
  n += part('a2', flapDown(262, 126, 26, 54), dimColor(PALETTE.a2, sel, 'a2'), sel);
  n += lab(182, 184, 'P2', 12, '#b45309', 700);
  n += lab(262, 196, 'A2', 12, '#1d4ed8', 700);
  n += '</g>';

  n += stroke('M302 46 L302 120', '#cbd5e1', 1.6, '5 4');

  n += lab(222, 82, 'LA（近场）', 14, '#475569');
  n += lab(190, 250, 'LV（远场）', 14, '#475569');
  n += labL(306, 42, '房间隔', 11, '#94a3b8');
  n += tie(410, 104, 376, 124, '#cbd5e1');
  n += labL(414, 100, '主动脉根部', 12, '#64748b');

  n += cue('后叶 P2 在左（后壁侧）、前叶 A2 在右（主动脉瓣侧），LVOT 同屏');
  return svgWrap(n, '二尖瓣 TEE 长轴分叶示意图');
}

/**
 * ME 二尖瓣交界切面（ME MC，45–60°）
 * 屏幕方位：左 P3 · 中 A2 · 右 P1（ASE/SCA）。A2 在远场，故显示更长。
 */
function mvTeeCommissuralSvg(opts) {
  const sel = (opts && opts.sel) || null;
  let n = '';
  n += fanBox(240, 8, 500, 58);

  n += '<g clip-path="url(#vaFanClip)">';
  n += soft(atriaPath(240, 146, 116, 52), '#ffffff');
  n += soft(ventCone(240, 146, 116, 318), '#ffffff');
  n += stroke('M124 146 L356 146', '#8fa0b5', 2);
  n += part('p3', flapDown(172, 146, 28, 34), dimColor(PALETTE.p3, sel, 'p3'), sel);
  n += part('a2', flapDown(240, 146, 30, 60), dimColor(PALETTE.a2, sel, 'a2'), sel);
  n += part('p1', flapDown(308, 146, 28, 34), dimColor(PALETTE.p1, sel, 'p1'), sel);
  // 两个交界被同一平面横穿
  n += stroke('M206 132 L206 188', '#dc2626', 3, '5 4');
  n += stroke('M274 132 L274 188', '#dc2626', 3, '5 4');
  n += '</g>';

  n += lab(240, 118, 'LA（近场）', 14, '#475569');
  n += lab(240, 268, 'LV（远场）', 14, '#475569');
  n += lab(172, 200, 'P3', 12, '#b45309', 700);
  n += lab(240, 222, 'A2', 12, '#1d4ed8', 700);
  n += lab(308, 200, 'P1', 12, '#b45309', 700);
  n += lab(206, 124, '交界', 11, '#dc2626');
  n += lab(274, 124, '交界', 11, '#dc2626');

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
  n += fanBox(240, 8, 500, 58);

  n += '<g clip-path="url(#vaFanClip)">';
  // 右心（主角）：三尖瓣环比二尖瓣更靠心尖
  n += soft(atriaPath(160, 172, 56, 66), '#ffffff');
  n += soft(ventCone(160, 172, 56, 308), '#ffffff');
  // 左心（对照，淡）
  n += soft(atriaPath(324, 150, 58, 56), '#f5f8fc');
  n += soft(ventCone(324, 150, 58, 302), '#f5f8fc');
  n += stroke('M240 54 L240 312', '#b9c6d6', 3);
  // 三尖瓣环 + 两个瓣叶
  n += stroke('M104 172 L216 172', '#8fa0b5', 2);
  n += part('sep', flapDown(196, 172, 20, 38), dimColor(PALETTE.sep, sel, 'sep'), sel);
  n += part('ant', flapDown(118, 172, 22, 28), dimColor(PALETTE.ant, sel, 'ant'), sel);
  n += '</g>';

  n += lab(160, 140, 'RA（近场）', 13, '#475569');
  n += lab(324, 112, 'LA', 13, '#94a3b8');
  n += lab(160, 268, 'RV（远场）', 13, '#475569');
  n += lab(324, 262, 'LV', 13, '#94a3b8');
  n += labL(246, 58, '房间隔', 11, '#94a3b8');
  n += lab(196, 224, '隔叶', 11, '#15803d', 700);
  n += lab(118, 212, '前叶', 11, '#7c3aed', 700);
  n += labL(268, 144, '二尖瓣（对照）', 10, '#b6c0cd');

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
