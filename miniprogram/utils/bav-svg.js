/* 二叶式主动脉瓣（BAV）融合分型示意图（小程序 / 网页 / APK 同源）
 * img 块 id: 'bav-fusion'
 * 按国际共识 R125 / R126 的 Figure 4 自绘，非期刊原图、不嵌水印。
 * 每型两态：左＝舒张期关闭（三片瓣叶拼合、虚线为融合嵴），右＝收缩期开放
 * （偏心开放口尖端到顶、黄色双向箭头示口径）。
 * ★ 逐型照原图核对过的三件事，勿自由发挥：
 *   1) 冠脉开口位置三型完全相同——左侧红点＝右冠（起自右冠窦 RC）、右上蓝点＝左冠（起自左冠窦 LC）；
 *   2) 变化的只有融合嵴方位（右上 / 左上 / 下）与开放口方向（↘ / ↗ / 近水平↗）；
 *   3) 开放口两头到顶、瓣叶只占薄薄一圈，不是中间一个小岛。
 * 口径同源：融合型 90–95%、右-左 70–80%、右-无 20–30%、左-无 3–6%（R125 / R126）。
 */
function pt(cx, cy, r, deg) { const a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
function n(v) { return (+v).toFixed(1); }
function fan(cx, cy, r, a1, a2) {
  const p1 = pt(cx, cy, r, a1), p2 = pt(cx, cy, r, a2);
  let d = a2 - a1; while (d > 360) d -= 360; while (d < 0) d += 360;
  const large = d > 180 ? 1 : 0;
  return 'M' + cx + ' ' + cy + ' L' + n(p1[0]) + ' ' + n(p1[1]) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + n(p2[0]) + ' ' + n(p2[1]) + ' Z';
}
function rad(cx, cy, r1, r2, deg, stroke, w, dash) {
  const a = pt(cx, cy, r1, deg), b = pt(cx, cy, r2, deg);
  return '<line x1="' + n(a[0]) + '" y1="' + n(a[1]) + '" x2="' + n(b[0]) + '" y2="' + n(b[1]) +
    '" stroke="' + stroke + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
}
function arrow(cx, cy, r, deg, color, w) {
  const a = pt(cx, cy, r, deg), b = pt(cx, cy, r, deg + 180);
  return '<line x1="' + n(a[0]) + '" y1="' + n(a[1]) + '" x2="' + n(b[0]) + '" y2="' + n(b[1]) +
    '" stroke="' + color + '" stroke-width="' + w + '" marker-start="url(#AH)" marker-end="url(#AH)"/>';
}

// 三窦固定方位（短轴：12点=前；屏幕左=患者右）
const SINUS = { RCC: -90, NCC: 135, LCC: 45 };

// raphe / long 逐型照 Figure 4 核对
const PANELS = [
  { name: '右-左冠瓣融合', pct: '70–80%', raphe: -45, long: 45, openTxt: '左上↘右下' },
  { name: '右-无冠瓣融合', pct: '20–30%', raphe: -160, long: -45, openTxt: '左下↗右上' },
  { name: '左-无冠瓣融合', pct: '3–6%', raphe: 75, long: -18, openTxt: '近水平↗' },
];
const DEFS = '<defs>'
  + '<radialGradient id="wall" cx="42%" cy="38%" r="70%"><stop offset="0%" stop-color="#FFF3F0"/><stop offset="62%" stop-color="#F7C9C6"/><stop offset="86%" stop-color="#E58C8C"/><stop offset="100%" stop-color="#C9636B"/></radialGradient>'
  + '<linearGradient id="leaf" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#E9C8E8"/><stop offset="45%" stop-color="#C48FC4"/><stop offset="100%" stop-color="#9E63A4"/></linearGradient>'
  + '<radialGradient id="lumen" cx="45%" cy="40%" r="70%"><stop offset="0%" stop-color="#FFF9F5"/><stop offset="100%" stop-color="#FBE2D8"/></radialGradient>'
  + '<radialGradient id="rca" cx="38%" cy="34%" r="70%"><stop offset="0%" stop-color="#F4767E"/><stop offset="100%" stop-color="#8E1E29"/></radialGradient>'
  + '<radialGradient id="lca" cx="38%" cy="34%" r="70%"><stop offset="0%" stop-color="#7AA8E8"/><stop offset="100%" stop-color="#243C8E"/></radialGradient>'
  + '<marker id="AH" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M0 4 L8 0 L8 8 Z" fill="#E3A400"/></marker>'
  + '</defs>';

// 单个冠脉开口：壁上的小圆点 + 壁外灰绿血管袢
function ostium(cx, cy, R, deg, fill, stroke) {
  const [px, py] = pt(cx, cy, R + 1, deg);
  const [v1x, v1y] = pt(cx, cy, R + 5, deg - 24);
  const [v2x, v2y] = pt(cx, cy, R + 26, deg);
  const [v3x, v3y] = pt(cx, cy, R + 5, deg + 24);
  const q = 'M' + n(v1x) + ' ' + n(v1y) + ' Q' + n(v2x) + ' ' + n(v2y) + ' ' + n(v3x) + ' ' + n(v3y);
  let s = '<path d="' + q + '" fill="none" stroke="#A9BAA2" stroke-width="7" stroke-linecap="round"/>';
  s += '<path d="' + q + '" fill="none" stroke="#7E9177" stroke-width="1.2" stroke-linecap="round"/>';
  s += '<circle cx="' + n(px) + '" cy="' + n(py) + '" r="6.5" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.4"/>';
  return s;
}
// 冠脉位置照原图 Figure 4：三型完全相同。按三窦追踪——右冠窦RC(左上)发出的血管袢走左侧=右冠(红)；左冠窦LC(右)发出的血管袢走右上=左冠(蓝)
function drawCoronary(cx, cy, R) {
  return ostium(cx, cy, R, 176, 'url(#rca)', '#6E1620') +   // 左侧：右冠
    ostium(cx, cy, R, -48, 'url(#lca)', '#1B2E72');          // 右上：左冠
}

function drawClosed(cx, cy, R, p) {
  const raphe = p.raphe;
  let s = '';
  s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R + 6) + '" fill="url(#wall)" stroke="#B85C64" stroke-width="1.5"/>';
  for (let k = 0; k < 3; k++) {
    s += '<path d="' + fan(cx, cy, R, raphe + k * 120, raphe + (k + 1) * 120) + '" fill="url(#leaf)" stroke="#8B5590" stroke-width="1.1"/>';
  }
  [0, 1, 2].forEach(function (k) {
    const a = raphe + k * 120, isR = k === 0;
    s += rad(cx, cy, 4, R, a, isR ? '#7A1F2B' : '#6E3D73', isR ? 3 : 1.3, isR ? '6 4' : '');
  });
  s += '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#8B5590"/>';
  s += drawCoronary(cx, cy, R);
  return s;
}
function drawOpen(cx, cy, R, p) {
  let s = '';
  s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R + 6) + '" fill="url(#wall)" stroke="#B85C64" stroke-width="1.5"/>';
  s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="#A56CAB"/>';
  const ra = (p.raphe + 180) * Math.PI / 180;
  const off = 9;
  const ox = cx + off * Math.cos(ra), oy = cy + off * Math.sin(ra);
  const rx = R - 10, ry = R - 22;
  s += '<ellipse cx="' + n(ox) + '" cy="' + n(oy) + '" rx="' + rx + '" ry="' + ry + '" fill="url(#lumen)" stroke="#6E3D73" stroke-width="1.6" transform="rotate(' + p.long + ' ' + n(ox) + ' ' + n(oy) + ')"/>';
  s += arrow(ox, oy, rx - 10, p.long, '#E3A400', 3);
  s += rad(cx, cy, R, R - 12, p.raphe, '#7A1F2B', 3.2, '');
  s += drawCoronary(cx, cy, R);
  return s;
}

function bavFusionSvg() {
  const W = 1080, COLW = 360, R = 88, YC = 188, YO = 470;
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' 700" width="100%" font-family="Microsoft YaHei, sans-serif">' + DEFS;
  s += '<rect width="' + W + '" height="700" fill="#fff"/>';
  PANELS.forEach(function (p, col) {
    const cx = COLW / 2 + col * COLW;
    s += '<text x="' + cx + '" y="30" text-anchor="middle" font-size="15" font-weight="bold" fill="#5A3B6E">' + (col + 1) + '. ' + p.name + ' ' + p.pct + '</text>';
    s += '<text x="' + cx + '" y="52" text-anchor="middle" font-size="12" fill="#9A918D">关闭（舒张期）</text>';
    s += drawClosed(cx, YC, R, p);
    s += '<text x="' + cx + '" y="' + (YO - 128) + '" text-anchor="middle" font-size="12" fill="#9A918D">开放（收缩期）　箭头 ' + p.openTxt + '</text>';
    s += drawOpen(cx, YO, R, p);
  });
  const ly = 664;
  s += '<circle cx="196" cy="' + ly + '" r="6.5" fill="url(#rca)" stroke="#6E1620" stroke-width="1.2"/>';
  s += '<text x="209" y="' + (ly + 4) + '" font-size="12" fill="#7A5A5E">右冠开口</text>';
  s += '<circle cx="398" cy="' + ly + '" r="6.5" fill="url(#lca)" stroke="#1B2E72" stroke-width="1.2"/>';
  s += '<text x="411" y="' + (ly + 4) + '" font-size="12" fill="#55628A">左冠开口</text>';
  s += '<line x1="640" y1="' + ly + '" x2="670" y2="' + ly + '" stroke="#7A1F2B" stroke-width="3" stroke-dasharray="6 4"/>';
  s += '<text x="680" y="' + (ly + 4) + '" font-size="12" fill="#7A1F2B">融合嵴</text>';
  return s + '</svg>';
}

const FIGS = { 'bav-fusion': bavFusionSvg };

function svgOf(id) {
  const fn = FIGS[id];
  return fn ? fn() : '';
}

module.exports = { bavFusionSvg: bavFusionSvg, svgOf: svgOf, FIGS: FIGS };
