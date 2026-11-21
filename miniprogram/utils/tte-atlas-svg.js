/**
 * tte-atlas-svg.js — TTE 标准切面总览图（2×2 四个常用切面）
 *
 * 纯函数，三端共用：小程序转 data URI 给 <image>，网页 / APK 直接内联 SVG。
 * 风格、配色、标注方式沿用 valve-svg.js（瓣膜解剖 TEE 图谱）：
 *   - 前叶系 / 前壁系蓝 #2563eb、下壁系橙 #d97706、间隔系绿 #0f9d58
 *   - 分区圆角胶囊 + 细引线，底部一行方位提示
 *
 * 内容依据：R9 ASE 2019 成人完整 TTE 操作指南、R64 中国 TTE 规范化共识 2024。
 * 方位总则（TTE）：近场（屏幕上方）＝探头侧 / 前方，心尖在远场（下方）；
 *   胸骨旁窗「屏幕左＝患者右」，心尖窗也是「屏幕左＝患者右」。
 *   ★ 与 TEE 的差别：TTE 是「上下不颠倒、左右同」；TEE 是「上下颠倒、左右同」。
 *
 * ★ 每个切面只画该切面的关键结构与必测项，不画成真实超声灰阶图；
 *   教学示意，不替代真实图像。
 */

const RAD = Math.PI / 180;

function f1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
function pt(cx, cy, r, deg) {
  return [cx + r * Math.cos(deg * RAD), cy + r * Math.sin(deg * RAD)];
}
function lab(x, y, t, size, color, weight, anchor) {
  return '<text x="' + f1(x) + '" y="' + f1(y) + '" text-anchor="' + (anchor || 'middle') +
    '" font-size="' + (size || 14) + '" font-weight="' + (weight || 600) +
    '" fill="' + (color || '#64748b') + '">' + t + '</text>';
}
function labL(x, y, t, size, color, weight) { return lab(x, y, t, size, color, weight, 'start'); }
function labR(x, y, t, size, color, weight) { return lab(x, y, t, size, color, weight, 'end'); }
function stroke(d, color, w, dash) {
  return '<path d="' + d + '" fill="none" stroke="' + (color || '#cbd5e1') + '" stroke-width="' +
    (w || 1.5) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
}
function ell(cx, cy, rx, ry, fill) {
  return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry +
    '" fill="' + (fill || '#eef2f7') + '" stroke="#94a3b8" stroke-width="1.6"/>';
}
function vent(cx, top, w, h) {
  const bot = top + h;
  const r = Math.min(w * 0.95, h * 0.55);
  return 'M' + f1(cx - w) + ' ' + f1(top) + ' L' + f1(cx - w) + ' ' + f1(bot - r) +
    ' Q' + f1(cx - w) + ' ' + f1(bot) + ' ' + f1(cx) + ' ' + f1(bot) +
    ' Q' + f1(cx + w) + ' ' + f1(bot) + ' ' + f1(cx + w) + ' ' + f1(bot - r) +
    ' L' + f1(cx + w) + ' ' + f1(top) + ' Z';
}
function chamber(d, fill) {
  return '<path d="' + d + '" fill="' + (fill || '#eef2f7') + '" stroke="#94a3b8" stroke-width="1.6"/>';
}
function sector(cx, cy, R, a0, a1) {
  const p1 = pt(cx, cy, R, a0), p2 = pt(cx, cy, R, a1);
  const large = (a1 - a0) > 180 ? 1 : 0;
  return 'M' + f1(cx) + ' ' + f1(cy) + ' L' + f1(p1[0]) + ' ' + f1(p1[1]) +
    ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + f1(p2[0]) + ' ' + f1(p2[1]) + ' Z';
}

/** 一个切面卡片：title 顶栏 + SVG 内容 + 底部一行要点 */
function panel(x, y, title, body, tip) {
  let n = '<rect x="' + x + '" y="' + y + '" width="470" height="180" rx="10" fill="#ffffff" ' +
    'stroke="#dbe3ee" stroke-width="1.5"/>';
  n += '<rect x="' + x + '" y="' + y + '" width="470" height="26" rx="10" fill="#eef2ff"/>';
  n += '<rect x="' + x + '" y="' + (y + 16) + '" width="470" height="10" fill="#eef2ff"/>';
  n += lab(x + 12, y + 18, title, 13, '#3730a3', 700, 'start');
  n += body;
  n += stroke('M' + (x + 12) + ' ' + (y + 154) + ' L' + (x + 458) + ' ' + (y + 154), '#eef2f7', 1);
  n += labL(x + 12, y + 170, tip, 11, '#64748b', 500);
  return n;
}

/* ── 1. 胸骨旁左室长轴 PLAX ── */
function plaxBody(ox, oy) {
  // ox/oy 为卡片左上角，内部坐标以卡片为基准
  const X = ox, Y = oy;
  let n = '';
  // 右室（近场，左）、室间隔、左室（远场，右）
  n += chamber('M' + (X + 40) + ' ' + (Y + 44) + ' Q' + (X + 84) + ' ' + (Y + 52) + ' ' + (X + 118) + ' ' + (Y + 44) +
    ' L' + (X + 112) + ' ' + (Y + 132) + ' Q' + (X + 76) + ' ' + (Y + 142) + ' ' + (X + 44) + ' ' + (Y + 132) + ' Z', '#f1f5f9');
  n += lab(X + 78, Y + 92, 'RV', 12, '#94a3b8');
  n += chamber(vent(X + 240, Y + 58, 92, 90), '#eef2f7');
  n += lab(X + 240, Y + 112, 'LV', 14, '#64748b');
  // 左房（上）与主动脉（右上）
  n += ell(X + 240, Y + 46, 60, 20, '#eef2f7');
  n += lab(X + 240, Y + 50, 'LA', 12, '#64748b');
  n += chamber('M' + (X + 320) + ' ' + (Y + 42) + ' L' + (X + 420) + ' ' + (Y + 42) +
    ' L' + (X + 420) + ' ' + (Y + 78) + ' L' + (X + 320) + ' ' + (Y + 78) + ' Z', '#f1f5f9');
  n += lab(X + 370, Y + 64, '升主动脉', 11, '#94a3b8');
  // 主动脉瓣（根部，右上）
  n += '<path d="M' + (X + 330) + ' ' + (Y + 60) + ' L' + (X + 342) + ' ' + (Y + 70) + ' L' + (X + 330) + ' ' + (Y + 78) + ' Z" fill="#2563eb"/>';
  n += lab(X + 314, Y + 72, 'AV', 11, '#2563eb', 700, 'end');
  // 二尖瓣（左房室交界）
  n += '<path d="M' + (X + 200) + ' ' + (Y + 58) + ' L' + (X + 226) + ' ' + (Y + 88) + ' L' + (X + 246) + ' ' + (Y + 58) + ' Z" fill="#d97706"/>';
  n += lab(X + 196, Y + 72, 'MV', 11, '#d97706', 700, 'end');
  // 室间隔（标注放在 RV 与 IVS 之间，不出面板）
  n += stroke('M' + (X + 146) + ' ' + (Y + 44) + ' L' + (X + 152) + ' ' + (Y + 138), '#64748b', 3);
  n += lab(X + 168, Y + 130, 'IVS', 10, '#94a3b8');
  return n;
}

/* ── 2. 胸骨旁主动脉瓣短轴 ── */
function avSaxBody(ox, oy) {
  const cx = ox + 235, cy = oy + 84, R = 48;
  let n = '';
  n += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R + 10) + '" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.6"/>';
  // TTE 短轴：RCC 上（12 点，贴 RVOT）、LCC 右下、NCC 左下 —— 与 TEE 短轴上下颠倒
  n += '<path d="' + sector(cx, cy, R, -90, 30) + '" fill="#0f9d58" stroke="#fff" stroke-width="2"/>';   // 右上 = LCC
  n += '<path d="' + sector(cx, cy, R, 30, 150) + '" fill="#2563eb" stroke="#fff" stroke-width="2"/>';   // 下 = RCC
  n += '<path d="' + sector(cx, cy, R, 150, 270) + '" fill="#d97706" stroke="#fff" stroke-width="2"/>';  // 左上 = NCC
  n += lab(cx + 32, cy - 14, 'LCC', 12, '#fff', 700);
  n += lab(cx, cy + 34, 'RCC', 12, '#fff', 700);
  n += lab(cx - 32, cy - 14, 'NCC', 12, '#fff', 700);
  // RVOT 在上（近场），位置下移避开头部标题栏与 NCC 标签
  n += chamber('M' + (ox + 160) + ' ' + (oy + 40) + ' Q' + cx + ' ' + (oy + 34) + ' ' + (ox + 310) + ' ' + (oy + 40) +
    ' L' + (ox + 304) + ' ' + (oy + 50) + ' Q' + cx + ' ' + (oy + 46) + ' ' + (ox + 166) + ' ' + (oy + 50) + ' Z', '#eef2f7');
  n += lab(cx, oy + 38, 'RVOT（上）', 10, '#94a3b8');
  // 冠脉开口红点
  const lca = pt(cx, cy, 66, -50), rca = pt(cx, cy, 66, 106);
  n += '<circle cx="' + f1(lca[0]) + '" cy="' + f1(lca[1]) + '" r="4.5" fill="#dc2626" stroke="#fff" stroke-width="1.6"/>';
  n += '<circle cx="' + f1(rca[0]) + '" cy="' + f1(rca[1]) + '" r="4.5" fill="#dc2626" stroke="#fff" stroke-width="1.6"/>';
  // 右侧图例
  n += labL(ox + 316, oy + 72, '蓝 = 右冠叶 RCC', 11, '#2563eb', 600);
  n += labL(ox + 316, oy + 90, '绿 = 左冠叶 LCC', 11, '#0f9d58', 600);
  n += labL(ox + 316, oy + 108, '橙 = 无冠叶 NCC', 11, '#d97706', 600);
  return n;
}

/* ── 3. 心尖四腔 A4C ── */
function a4cBody(ox, oy) {
  let n = '';
  // 心房（上，近场）：右在左、左在右
  n += ell(ox + 148, oy + 46, 62, 20, '#eef2f7');
  n += lab(ox + 148, oy + 50, 'RA', 12, '#94a3b8');
  n += ell(ox + 320, oy + 46, 62, 20, '#eef2f7');
  n += lab(ox + 320, oy + 50, 'LA', 12, '#64748b');
  // 心室（下，远场，心尖在下）
  n += chamber(vent(ox + 152, oy + 64, 60, 84), '#eef2f7');
  n += lab(ox + 152, oy + 116, 'RV', 13, '#94a3b8');
  n += chamber(vent(ox + 322, oy + 64, 62, 96), '#eef2f7');
  n += lab(ox + 322, oy + 124, 'LV', 14, '#64748b');
  // 房间隔 / 室间隔
  n += stroke('M' + (ox + 235) + ' ' + (oy + 34) + ' L' + (ox + 235) + ' ' + (oy + 150), '#cbd5e1', 2.4);
  // 二尖瓣（间隔侧 A3 蓝、侧壁侧 P1 橙）
  n += '<path d="M' + (ox + 268) + ' ' + (oy + 64) + ' L' + (ox + 284) + ' ' + (oy + 84) + ' L' + (ox + 300) + ' ' + (oy + 64) + ' Z" fill="#2563eb"/>';
  n += '<path d="M' + (ox + 348) + ' ' + (oy + 64) + ' L' + (ox + 364) + ' ' + (oy + 82) + ' L' + (ox + 380) + ' ' + (oy + 64) + ' Z" fill="#d97706"/>';
  n += lab(ox + 284, oy + 98, 'A3', 11, '#2563eb', 700);
  n += lab(ox + 364, oy + 96, 'P1', 11, '#d97706', 700);
  n += lab(ox + 322, oy + 146, '心尖', 11, '#94a3b8');
  return n;
}

/* ── 4. 心尖两腔 A2C ── */
function a2cBody(ox, oy) {
  let n = '';
  n += ell(ox + 235, oy + 46, 58, 18, '#eef2f7');
  n += lab(ox + 235, oy + 50, 'LA', 12, '#64748b');
  n += chamber(vent(ox + 235, oy + 62, 74, 96), '#eef2f7');
  n += lab(ox + 235, oy + 124, 'LV', 14, '#64748b');
  // 下壁（左，橙）、前壁（右，蓝）
  n += '<path d="M' + (ox + 168) + ' ' + (oy + 62) + ' L' + (ox + 186) + ' ' + (oy + 86) + ' L' + (ox + 204) + ' ' + (oy + 62) + ' Z" fill="#d97706"/>';
  n += '<path d="M' + (ox + 266) + ' ' + (oy + 62) + ' L' + (ox + 284) + ' ' + (oy + 86) + ' L' + (ox + 302) + ' ' + (oy + 62) + ' Z" fill="#2563eb"/>';
  n += lab(ox + 186, oy + 100, '下壁', 11, '#d97706', 600);
  n += lab(ox + 284, oy + 100, '前壁', 11, '#2563eb', 600);
  n += lab(ox + 235, oy + 146, '心尖', 11, '#94a3b8');
  return n;
}

/** 生成整张 TTE 总览 SVG（4 个切面 2×2） */
function tteOverviewSvg() {
  let n = '<rect x="0" y="0" width="960" height="400" rx="12" fill="#fafbfc"/>';
  n += panel(10, 12, '① 胸骨旁左室长轴 PLAX', plaxBody(10, 12),
    '测：LVEDD / LVESD、IVS / LVPW、主动脉根部、LA 前后径');
  n += panel(480, 12, '② 胸骨旁主动脉瓣短轴', avSaxBody(480, 12),
    '看三叶：RCC 上（贴 RVOT）、LCC 右下、NCC 左下');
  n += panel(10, 204, '③ 心尖四腔 A4C', a4cBody(10, 204),
    '测：Simpson 容积 / EF、双房面积、TAPSE、二尖瓣流入道');
  n += panel(480, 204, '④ 心尖两腔 A2C', a2cBody(480, 204),
    '测：双平面容积、前壁 / 下壁节段；与 A4C 正交');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 400" width="100%" ' +
    'preserveAspectRatio="xMidYMid meet" role="img" aria-label="TTE 标准切面总览示意图">' + n + '</svg>';
}

/* ── UTF-8 → Base64（小程序 <image> 用；与 valve-svg.js 同实现） ── */
function utf8ToBase64(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = [];
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
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
  tteOverviewSvg,
  utf8ToBase64,
};
