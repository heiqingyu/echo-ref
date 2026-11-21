/**
 * tte-atlas-svg.js — TTE 标准切面总览图（2×2 四个常用切面）
 *
 * 纯函数，三端共用：小程序转 data URI 给 <image>，网页 / APK 直接内联 SVG。
 * 画法对齐指南里的示意图（R9 ASE 2019 成人 TTE 指南的标准切面图）：
 *   每个切面都画成**扇形（相控阵扇面）**，扇面外标「上 / 下 / 左 / 右」屏幕方位，
 *   心腔、瓣膜按真实相对位置摆进扇面，近场在上、远场在下。
 *
 * ★★ 方位（2026-11-21 按指南逐图重核后整份重画，旧版三处是错的）
 *   1) 心尖四腔 / 两腔：探头在心尖，**心尖在近场（屏幕上方）**、心房在下方。
 *      旧版把心房画在上、心尖画在下，是 TEE 的方位（TEE 探头在食管、心房在近场），
 *      与本页文字「心尖在扇形顶部」自相矛盾。
 *   2) 胸骨旁左室长轴：右室在前（近场、上方）、左室在后（下方），
 *      主动脉根部与左房在**右侧**，心尖指向左侧。
 *   3) 胸骨旁主动脉瓣短轴：**RCC 在上**（贴 RVOT、近场），LCC 右下（贴肺动脉）、
 *      NCC 左下（贴房间隔）。旧版画成 RCC 在下，那是 TEE 短轴的方位
 *      （TEE 近场是左房，故与 TTE 上下颠倒）。
 *
 * 内容依据：R9 ASE 2019 成人完整 TTE 操作指南、R64 中国 TTE 规范化共识 2024。
 * 风格沿用 valve-svg.js：前叶系 / 前壁系蓝 #2563eb、下壁系橙 #d97706、间隔系绿 #0f9d58。
 *
 * ★ 每个切面只画关键结构与必测项，不画成真实超声灰阶图；教学示意，不替代真实图像。
 * ★ 扇面外的标注**不能**放进裁切组，否则会被裁掉（旧版踩过）：body 返回 { c, o }，
 *   c 走 clipPath，o 画在扇面之上。
 */

const RAD = Math.PI / 180;
const FAN_HALF = 45;     // 扇面半角：总角 90°，成人相控阵常用
const FAN_R = 200;       // 扇面半径（px），纵深 ≈141

function f1r(n) { return Math.round(n * 10) / 10; }
function f1(n) { return f1r(n).toFixed(1); }

/** 极坐标 → 直角坐标（0° 在右，顺时针为正） */
function pt(cx, cy, r, deg) {
  return [cx + r * Math.cos(deg * RAD), cy + r * Math.sin(deg * RAD)];
}

function lab(x, y, t, size, color, weight, anchor) {
  return '<text x="' + f1(x) + '" y="' + f1(y) + '" text-anchor="' + (anchor || 'middle') +
    '" font-size="' + (size || 12) + '" font-weight="' + (weight || 500) +
    '" fill="' + (color || '#64748b') + '">' + t + '</text>';
}
function labL(x, y, t, size, color, weight) { return lab(x, y, t, size, color, weight, 'start'); }
function labR(x, y, t, size, color, weight) { return lab(x, y, t, size, color, weight, 'end'); }

function stroke(d, color, w, dash) {
  return '<path d="' + d + '" fill="none" stroke="' + (color || '#cbd5e1') + '" stroke-width="' +
    (w || 1.5) + '" stroke-linecap="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
}
/** 心腔（血池）＋薄壁 */
function pool(d, fill) {
  return '<path d="' + d + '" fill="' + (fill || '#e9eff8') + '" stroke="#9aa9bd" stroke-width="1.5"/>';
}
function ell(cx, cy, rx, ry, fill) {
  return '<ellipse cx="' + f1(cx) + '" cy="' + f1(cy) + '" rx="' + f1(rx) + '" ry="' + f1(ry) +
    '" fill="' + (fill || '#e9eff8') + '" stroke="#9aa9bd" stroke-width="1.5"/>';
}

/** 扇面路径：顶点在上，向下张开 */
function fanPath(cx, cy) {
  const pL = pt(cx, cy, FAN_R, 90 - FAN_HALF);
  const pR = pt(cx, cy, FAN_R, 90 + FAN_HALF);
  return 'M' + f1(cx) + ' ' + f1(cy) +
    ' L' + f1(pL[0]) + ' ' + f1(pL[1]) +
    ' A' + FAN_R + ' ' + FAN_R + ' 0 0 1 ' + f1(pR[0]) + ' ' + f1(pR[1]) + ' Z';
}

/** 引线：从文字指到结构 */
function tie(x1, y1, x2, y2) {
  return stroke('M' + f1(x1) + ' ' + f1(y1) + ' L' + f1(x2) + ' ' + f1(y2), '#c7d2e0', 1);
}
/** 扇面外标注：文字 + 引线（画在未裁切层） */
function tag(x, y, t, toX, toY, size, color, anchor) {
  return lab(x, y, t, size || 11, color || '#64748b', 600, anchor) +
    tie(x, y + 4, toX, toY);
}

/** 切面卡片：标题栏 + 扇面（含方位标注）+ 底部一行要点 */
function panel(x, y, idx, title, body, tip) {
  const cx = x + 235, cy = y + 52;
  const fp = fanPath(cx, cy);
  let n = '';
  n += '<rect x="' + x + '" y="' + y + '" width="470" height="280" rx="12" fill="#ffffff" ' +
    'stroke="#dbe3ee" stroke-width="1.5"/>';
  n += '<rect x="' + x + '" y="' + y + '" width="470" height="28" rx="12" fill="#eef2ff"/>';
  n += '<rect x="' + x + '" y="' + (y + 16) + '" width="470" height="12" fill="#eef2ff"/>';
  n += lab(x + 14, y + 19, title, 13, '#3730a3', 700, 'start');

  n += '<defs><clipPath id="tteFan' + idx + '"><path d="' + fp + '"/></clipPath></defs>';
  n += '<path d="' + fp + '" fill="url(#tteFanGrad)" stroke="#c3cedd" stroke-width="1.6"/>';
  n += '<g clip-path="url(#tteFan' + idx + ')">' + body.c + '</g>';
  n += body.o;
  // 探头面（顶点小圆弧）
  n += stroke('M' + f1(cx - 16) + ' ' + f1(cy + 4) + ' Q' + f1(cx) + ' ' + f1(cy - 12) + ' ' +
    f1(cx + 16) + ' ' + f1(cy + 4), '#c3cedd', 1.6);

  // 屏幕方位（与指南示意图一致，标在扇面外）
  n += lab(cx, y + 44, '上', 10, '#b0bbcb');
  n += lab(cx, y + 212, '下', 10, '#b0bbcb');
  n += lab(cx - 146, y + 148, '左', 10, '#b0bbcb');
  n += lab(cx + 146, y + 148, '右', 10, '#b0bbcb');

  n += stroke('M' + (x + 14) + ' ' + (y + 234) + ' L' + (x + 456) + ' ' + (y + 234), '#eef2f7', 1);
  n += labL(x + 14, y + 253, tip, 11, '#64748b', 500);
  return n;
}

/* ══════════════════════════════════════════════════════════
   ① 胸骨旁左室长轴（PLAX）
   近场（上）＝右室前壁侧；远场（下）＝左室后壁；右＝主动脉根部与左房；左＝心尖
   ══════════════════════════════════════════════════════════ */
function plaxBody(cx, cy) {
  let c = '', o = '';

  // 左房（主动脉根部下方、左室后壁右后方）
  c += ell(cx + 62, cy + 116, 28, 22, '#e9eff8');
  // 右室：近场一条宽带，向左侧收窄
  c += pool('M' + f1(cx - 120) + ' ' + f1(cy + 6) + ' L' + f1(cx + 104) + ' ' + f1(cy + 6) +
    ' L' + f1(cx + 54) + ' ' + f1(cy + 40) + ' Q' + f1(cx - 4) + ' ' + f1(cy + 48) + ' ' +
    f1(cx - 78) + ' ' + f1(cy + 72) + ' Z', '#e4ebf6');
  // 室间隔
  c += stroke('M' + f1(cx + 50) + ' ' + f1(cy + 34) + ' Q' + f1(cx - 4) + ' ' + f1(cy + 40) + ' ' +
    f1(cx - 80) + ' ' + f1(cy + 74), '#a9b7c9', 9);
  // 左室：心尖朝左，中部最厚
  c += pool('M' + f1(cx + 50) + ' ' + f1(cy + 36) +
    ' Q' + f1(cx - 4) + ' ' + f1(cy + 56) + ' ' + f1(cx - 72) + ' ' + f1(cy + 106) +
    ' Q' + f1(cx - 4) + ' ' + f1(cy + 150) + ' ' + f1(cx + 56) + ' ' + f1(cy + 92) + ' Z', '#f5f9fd');
  // 左室后壁
  c += stroke('M' + f1(cx - 72) + ' ' + f1(cy + 106) + ' Q' + f1(cx - 4) + ' ' + f1(cy + 150) + ' ' +
    f1(cx + 56) + ' ' + f1(cy + 92), '#a9b7c9', 7);
  // 主动脉根部（管状：两侧壁 + 窦部）
  c += pool('M' + f1(cx + 20) + ' ' + f1(cy + 44) + ' L' + f1(cx + 54) + ' ' + f1(cy + 46) +
    ' L' + f1(cx + 60) + ' ' + f1(cy + 94) + ' L' + f1(cx + 26) + ' ' + f1(cy + 96) + ' Z', '#f3f7fc');
  c += stroke('M' + f1(cx + 20) + ' ' + f1(cy + 44) + ' L' + f1(cx + 26) + ' ' + f1(cy + 96), '#a9b7c9', 3);
  c += stroke('M' + f1(cx + 54) + ' ' + f1(cy + 46) + ' L' + f1(cx + 60) + ' ' + f1(cy + 94), '#a9b7c9', 3);
  // 主动脉瓣（蓝）
  c += '<path d="M' + f1(cx + 23) + ' ' + f1(cy + 62) + ' L' + f1(cx + 42) + ' ' + f1(cy + 74) +
    ' L' + f1(cx + 27) + ' ' + f1(cy + 78) + ' Z" fill="#2563eb"/>';
  c += '<path d="M' + f1(cx + 56) + ' ' + f1(cy + 64) + ' L' + f1(cx + 42) + ' ' + f1(cy + 74) +
    ' L' + f1(cx + 55) + ' ' + f1(cy + 80) + ' Z" fill="#2563eb" opacity="0.72"/>';
  // 二尖瓣（橙）：左房室交界
  c += '<path d="M' + f1(cx + 48) + ' ' + f1(cy + 96) + ' L' + f1(cx + 40) + ' ' + f1(cy + 110) +
    ' L' + f1(cx + 50) + ' ' + f1(cy + 108) + ' Z" fill="#d97706"/>';
  c += '<path d="M' + f1(cx + 62) + ' ' + f1(cy + 98) + ' L' + f1(cx + 56) + ' ' + f1(cy + 112) +
    ' L' + f1(cx + 65) + ' ' + f1(cy + 112) + ' Z" fill="#d97706" opacity="0.72"/>';

  o += lab(cx - 18, cy + 28, 'RV', 12, '#475569', 700);
  o += lab(cx - 12, cy + 100, 'LV', 13, '#334155', 700);
  o += lab(cx + 64, cy + 124, 'LA', 12, '#475569', 700);
  o += tag(cx - 150, cy + 130, '心尖', cx - 74, cy + 108, 11, '#64748b');
  o += tag(cx + 150, cy + 24, '升主动脉', cx + 44, cy + 40, 11, '#64748b', 'start');
  o += tag(cx - 150, cy + 58, 'IVS', cx - 70, cy + 66, 10, '#8494a8');
  o += tag(cx + 150, cy + 138, 'LVPW', cx + 20, cy + 128, 10, '#8494a8', 'start');
  return { c: c, o: o };
}

/* ══════════════════════════════════════════════════════════
   ② 胸骨旁主动脉瓣短轴（PSAX-AV）
   近场（上）＝ RVOT；RCC 在上、LCC 右下（贴肺动脉）、NCC 左下（贴房间隔）
   ══════════════════════════════════════════════════════════ */
function psaxBody(cx, cy) {
  const ox = cx, oy = cy + 94, R = 50;
  let c = '', o = '';

  // 左房（远场）、右房（屏幕左）、肺动脉（屏幕右）
  c += ell(cx, cy + 132, 28, 16, '#e9eff8');
  c += ell(cx - 66, cy + 104, 22, 20, '#e9eff8');
  c += ell(cx + 68, cy + 100, 20, 18, '#e9eff8');
  // RVOT：包在主动脉前方的月牙
  c += pool('M' + f1(cx - 76) + ' ' + f1(cy + 44) + ' Q' + f1(cx) + ' ' + f1(cy + 18) + ' ' +
    f1(cx + 76) + ' ' + f1(cy + 46) + ' L' + f1(cx + 66) + ' ' + f1(cy + 74) +
    ' Q' + f1(cx) + ' ' + f1(cy + 44) + ' ' + f1(cx - 66) + ' ' + f1(cy + 74) + ' Z', '#eef3fa');

  // 主动脉根部外环
  c += '<circle cx="' + f1(ox) + '" cy="' + f1(oy) + '" r="' + (R + 8) + '" fill="#f1f5f9" stroke="#c3cedd" stroke-width="1.6"/>';

  // 三叶：RCC 上、LCC 右下、NCC 左下
  const segs = [
    ['#2563eb', -150, -30, 'RCC', -90],
    ['#0f9d58', -30, 90, 'LCC', 40],
    ['#d97706', 90, 210, 'NCC', 150],
  ];
  segs.forEach(function (s) {
    const p1 = pt(ox, oy, R, s[1]);
    const p2 = pt(ox, oy, R, s[2]);
    c += '<path d="M' + f1(ox) + ' ' + f1(oy) + ' L' + f1(p1[0]) + ' ' + f1(p1[1]) +
      ' A' + R + ' ' + R + ' 0 0 1 ' + f1(p2[0]) + ' ' + f1(p2[1]) + ' Z" fill="' + s[0] +
      '" stroke="#ffffff" stroke-width="1.8"/>';
    const lp = pt(ox, oy, 31, s[4]);
    c += lab(lp[0], lp[1] + 4, s[3], 11, '#ffffff', 700);
  });
  // 冠脉开口：右冠在 RCC 侧、左冠在 LCC 侧
  const rca = pt(ox, oy, R - 4, -112), lca = pt(ox, oy, R - 4, 22);
  c += '<circle cx="' + f1(rca[0]) + '" cy="' + f1(rca[1]) + '" r="3.6" fill="#dc2626" stroke="#ffffff" stroke-width="1.4"/>';
  c += '<circle cx="' + f1(lca[0]) + '" cy="' + f1(lca[1]) + '" r="3.6" fill="#dc2626" stroke="#ffffff" stroke-width="1.4"/>';

  o += lab(cx, cy + 136, 'LA', 12, '#475569', 700);
  o += lab(cx - 66, cy + 108, 'RA', 11, '#64748b', 700);
  o += lab(cx + 68, cy + 104, 'PA', 11, '#64748b', 700);
  o += lab(cx, cy + 36, 'RVOT', 11, '#64748b', 700);
  return { c: c, o: o };
}

/* ══════════════════════════════════════════════════════════
   ③ 心尖四腔（A4C）
   探头在心尖：心尖在近场（上），心房在远场（下）；屏幕左＝患者右（右心在左）
   ══════════════════════════════════════════════════════════ */
function a4cBody(cx, cy) {
  let c = '', o = '';

  // 左房 / 右房（远场）
  c += ell(cx + 40, cy + 120, 32, 22, '#e9eff8');
  c += ell(cx - 40, cy + 118, 30, 21, '#eef3fa');

  // 右室（屏幕左）
  c += pool('M' + f1(cx) + ' ' + f1(cy + 14) +
    ' C' + f1(cx - 36) + ' ' + f1(cy + 44) + ' ' + f1(cx - 78) + ' ' + f1(cy + 74) + ' ' +
    f1(cx - 76) + ' ' + f1(cy + 96) +
    ' L' + f1(cx - 3) + ' ' + f1(cy + 96) +
    ' C' + f1(cx - 3) + ' ' + f1(cy + 70) + ' ' + f1(cx - 2) + ' ' + f1(cy + 42) + ' ' +
    f1(cx) + ' ' + f1(cy + 14) + ' Z', '#e4ebf6');
  // 左室（屏幕右）
  c += pool('M' + f1(cx) + ' ' + f1(cy + 14) +
    ' C' + f1(cx + 36) + ' ' + f1(cy + 44) + ' ' + f1(cx + 80) + ' ' + f1(cy + 74) + ' ' +
    f1(cx + 78) + ' ' + f1(cy + 98) +
    ' L' + f1(cx + 3) + ' ' + f1(cy + 98) +
    ' C' + f1(cx + 3) + ' ' + f1(cy + 70) + ' ' + f1(cx + 2) + ' ' + f1(cy + 42) + ' ' +
    f1(cx) + ' ' + f1(cy + 14) + ' Z', '#f5f9fd');
  // 室间隔
  c += stroke('M' + f1(cx) + ' ' + f1(cy + 16) + ' L' + f1(cx) + ' ' + f1(cy + 96), '#c3cedd', 2.4);

  // 二尖瓣（间隔侧 A3 蓝、侧壁侧 P1 橙）；三尖瓣（隔叶绿）
  c += '<path d="M' + f1(cx + 4) + ' ' + f1(cy + 98) + ' L' + f1(cx + 14) + ' ' + f1(cy + 112) +
    ' L' + f1(cx + 8) + ' ' + f1(cy + 98) + ' Z" fill="#2563eb"/>';
  c += '<path d="M' + f1(cx + 76) + ' ' + f1(cy + 98) + ' L' + f1(cx + 66) + ' ' + f1(cy + 112) +
    ' L' + f1(cx + 72) + ' ' + f1(cy + 98) + ' Z" fill="#d97706"/>';
  c += '<path d="M' + f1(cx - 4) + ' ' + f1(cy + 96) + ' L' + f1(cx - 13) + ' ' + f1(cy + 108) +
    ' L' + f1(cx - 8) + ' ' + f1(cy + 96) + ' Z" fill="#0f9d58"/>';

  o += lab(cx - 32, cy + 74, 'RV', 12, '#475569', 700);
  o += lab(cx + 34, cy + 78, 'LV', 13, '#334155', 700);
  o += lab(cx - 40, cy + 122, 'RA', 11, '#64748b', 700);
  o += lab(cx + 40, cy + 124, 'LA', 11, '#475569', 700);
  o += tag(cx - 150, cy + 36, '心尖（近场）', cx - 8, cy + 24, 11, '#64748b');
  o += tag(cx + 150, cy + 60, '心尖段勿切掉', cx + 26, cy + 32, 10, '#94a3b8', 'start');
  return { c: c, o: o };
}

/* ══════════════════════════════════════════════════════════
   ④ 心尖两腔（A2C）
   心尖在上；右侧前壁、左侧下壁；与四腔心正交（90°）
   ══════════════════════════════════════════════════════════ */
function a2cBody(cx, cy) {
  let c = '', o = '';

  // 左房（远场）
  c += ell(cx, cy + 126, 40, 21, '#e9eff8');
  // 左室
  c += pool('M' + f1(cx) + ' ' + f1(cy + 14) +
    ' C' + f1(cx + 34) + ' ' + f1(cy + 34) + ' ' + f1(cx + 62) + ' ' + f1(cy + 68) + ' ' +
    f1(cx + 52) + ' ' + f1(cy + 100) +
    ' L' + f1(cx - 52) + ' ' + f1(cy + 100) +
    ' C' + f1(cx - 62) + ' ' + f1(cy + 68) + ' ' + f1(cx - 34) + ' ' + f1(cy + 34) + ' ' +
    f1(cx) + ' ' + f1(cy + 14) + ' Z', '#f5f9fd');
  // 二尖瓣：前叶在主动脉侧（屏幕右）、后叶在左
  c += '<path d="M' + f1(cx + 20) + ' ' + f1(cy + 100) + ' L' + f1(cx + 10) + ' ' + f1(cy + 114) +
    ' L' + f1(cx + 16) + ' ' + f1(cy + 100) + ' Z" fill="#2563eb"/>';
  c += '<path d="M' + f1(cx - 18) + ' ' + f1(cy + 100) + ' L' + f1(cx - 8) + ' ' + f1(cy + 114) +
    ' L' + f1(cx - 14) + ' ' + f1(cy + 100) + ' Z" fill="#d97706"/>';

  o += lab(cx, cy + 74, 'LV', 13, '#334155', 700);
  o += lab(cx, cy + 130, 'LA', 11, '#475569', 700);
  o += tag(cx + 148, cy + 70, '前壁', cx + 54, cy + 72, 11, '#2563eb', 'start');
  o += tag(cx - 148, cy + 96, '下壁', cx - 58, cy + 88, 11, '#d97706');
  o += tag(cx - 148, cy + 34, '心尖（近场）', cx - 4, cy + 22, 11, '#64748b');
  return { c: c, o: o };
}

/** 四个切面的定义：总览图与单切面图共用同一份，避免两处画得不一样 */
function panelDefs() {
  return [
    {
      title: '① 胸骨旁左室长轴 PLAX', body: plaxBody,
      tip: '测：LVEDD / LVESD、IVS / LVPW、主动脉根部、LA 前后径',
    },
    {
      title: '② 胸骨旁主动脉瓣短轴', body: psaxBody,
      tip: 'RCC 上（贴 RVOT）、LCC 右下、NCC 左下；红点＝冠脉开口',
    },
    {
      title: '③ 心尖四腔 A4C', body: a4cBody,
      tip: '测：Simpson 容积 / EF、双房面积、TAPSE、二尖瓣流入道',
    },
    {
      title: '④ 心尖两腔 A2C', body: a2cBody,
      tip: '测：双平面容积、前壁 / 下壁节段；与 A4C 正交',
    },
  ];
}

/** 扇面渐变（总览图与单切面图都要，重复一份 id 在各自文档里互不影响） */
function gradDefs() {
  return '<defs><radialGradient id="tteFanGrad" cx="50%" cy="0%" r="115%">' +
    '<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eaf1fa"/></radialGradient></defs>';
}

/** 生成整张 TTE 总览 SVG（4 个切面 2×2，扇面 + 屏幕方位） */
function tteOverviewSvg() {
  const D = panelDefs();
  let n = gradDefs();
  n += '<rect x="0" y="0" width="960" height="590" rx="12" fill="#fafbfc"/>';
  n += panel(10, 10, 1, D[0].title, D[0].body(10 + 235, 10 + 52), D[0].tip);
  n += panel(480, 10, 2, D[1].title, D[1].body(480 + 235, 10 + 52), D[1].tip);
  n += panel(10, 300, 3, D[2].title, D[2].body(10 + 235, 300 + 52), D[2].tip);
  n += panel(480, 300, 4, D[3].title, D[3].body(480 + 235, 300 + 52), D[3].tip);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 590" width="100%" ' +
    'preserveAspectRatio="xMidYMid meet" role="img" aria-label="TTE 标准切面总览示意图">' + n + '</svg>';
}

/**
 * 单个切面图（480×290）
 * ★ 小程序正文只有 343px 宽：960 宽的四联图缩到 1/3，字只剩 4–5px。
 *   手机上改成四张单切面图纵向排，每张占满宽度，字与真实图像尺寸才对得上。
 */
function ttePanelSvg(i) {
  const D = panelDefs();
  const d = D[i];
  if (!d) return '';
  let n = gradDefs();
  n += '<rect x="0" y="0" width="480" height="290" rx="12" fill="#fafbfc"/>';
  n += panel(5, 5, i + 1, d.title, d.body(5 + 235, 5 + 52), d.tip);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 290" width="100%" ' +
    'preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + d.title + '示意图">' + n + '</svg>';
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
  ttePanelSvg,
  utf8ToBase64,
};
