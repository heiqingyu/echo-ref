/* 融合型二叶式主动脉瓣三种融合表型示意图（小程序 / 网页 / APK 同源）
 * img 块 id: 'bav-fusion'
 * 依据 2021 多学会国际共识与 2022 解读（R125 / R126）的文字及 Figure 4 框架自绘：
 * 只画胸骨旁短轴的三个主动脉窦、功能瓣口与融合嵴位置，不复制期刊原图，
 * 也不把示意轮廓当成实际超声切面。融合型仍保留三个可辨认的主动脉窦。
 */
function bavFusionSvg() {
  const B = '#F7F9FC', INK = '#2C2C2A', MUTED = '#5F5E5A';
  const BLUE = '#185FA5', LIGHT = '#E6F1FB', PINK = '#FBECEC', GREY = '#EEF1F4';
  const RED = '#A32D2D';
  const p = [];
  const cx0 = [207, 371, 535];
  const names = ['右-左冠瓣融合', '右-无冠瓣融合', '左-无冠瓣融合'];
  const rates = ['70–80%', '20–30%', '3–6%'];
  const raphes = [
    [[cx0[0] - 29, 141], [cx0[0] + 29, 141], [cx0[0], 126]],
    [[cx0[1] - 36, 148], [cx0[1] - 8, 196], [cx0[1] - 42, 174]],
    [[cx0[2] + 36, 148], [cx0[2] + 8, 196], [cx0[2] + 42, 174]],
  ];

  function polar(cx, r, deg) {
    const a = deg * Math.PI / 180;
    return [(cx + r * Math.cos(a)).toFixed(1), (169 + r * Math.sin(a)).toFixed(1)];
  }
  function wedge(cx, r, a1, a2) {
    const s = polar(cx, r, a1), e = polar(cx, r, a2);
    return 'M' + cx + ' 169 L' + s[0] + ' ' + s[1] + ' A' + r + ' ' + r + ' 0 0 1 ' + e[0] + ' ' + e[1] + ' Z';
  }

  p.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="110 0 520 380" width="100%" role="img">');
  p.push('<title>融合型二叶式主动脉瓣的三种融合表型</title>');
  p.push('<rect x="110" y="0" width="520" height="380" rx="12" fill="' + B + '"/>');
  p.push('<text x="130" y="30" font-size="15" font-weight="500" fill="' + INK + '">融合型 BAV · 三种融合表型</text>');
  p.push('<text x="130" y="52" font-size="12" fill="' + MUTED + '">胸骨旁短轴收缩期示意 · 三个主动脉窦仍可辨认 · 紫红连线为融合嵴</text>');

  for (let i = 0; i < 3; i++) {
    const cx = cx0[i], x = cx - 75;
    p.push('<rect x="' + x + '" y="68" width="150" height="212" rx="9" fill="#FFFFFF" stroke="' + BLUE + '" stroke-width="0.6"/>');
    p.push('<text x="' + cx + '" y="88" font-size="13" font-weight="500" text-anchor="middle" fill="' + INK + '">' + (i + 1) + ' ' + names[i] + '</text>');
    p.push('<text x="' + cx + '" y="106" font-size="12" text-anchor="middle" fill="' + RED + '">' + rates[i] + '</text>');
    // 三个窦：右冠（左上）、左冠（右上）、无冠（下）
    p.push('<path d="' + wedge(cx, 43, -210, -90) + '" fill="' + LIGHT + '" stroke="' + BLUE + '" stroke-width="0.6"/>');
    p.push('<path d="' + wedge(cx, 43, -90, 30) + '" fill="' + PINK + '" stroke="' + BLUE + '" stroke-width="0.6"/>');
    p.push('<path d="' + wedge(cx, 43, 30, 150) + '" fill="' + GREY + '" stroke="' + BLUE + '" stroke-width="0.6"/>');
    p.push('<circle cx="' + cx + '" cy="169" r="43" fill="none" stroke="' + BLUE + '" stroke-width="1.2"/>');
    // 收缩期功能瓣口：椭圆，仅表达「开放形态」，不作为真实轮廓
    p.push('<ellipse cx="' + cx + '" cy="169" rx="15" ry="22" fill="#FFFFFF" stroke="' + BLUE + '" stroke-width="1.4"/>');
    // 融合嵴：位于两融合窦之间；不是筛出的超声轨迹
    const r = raphes[i];
    p.push('<line x1="' + r[0][0] + '" y1="' + r[0][1] + '" x2="' + r[1][0] + '" y2="' + r[1][1] + '" stroke="' + RED + '" stroke-width="3" stroke-linecap="round"/>');
    p.push('<text x="' + r[2][0] + '" y="' + r[2][1] + '" font-size="12" text-anchor="middle" fill="' + RED + '">嵴</text>');
    p.push('<text x="' + (cx - 40) + '" y="132" font-size="11" text-anchor="middle" fill="' + MUTED + '">右冠</text>');
    p.push('<text x="' + (cx + 40) + '" y="132" font-size="11" text-anchor="middle" fill="' + MUTED + '">左冠</text>');
    p.push('<text x="' + cx + '" y="229" font-size="11" text-anchor="middle" fill="' + MUTED + '">无冠</text>');
    p.push('<text x="' + cx + '" y="264" font-size="11" text-anchor="middle" fill="' + MUTED + '">三窦 · 两功能瓣叶</text>');
  }

  p.push('<text x="130" y="302" font-size="12" fill="' + MUTED + '">融合型占 BAV 90–95%；右-左最常见，左-无最少见</text>');
  p.push('<text x="130" y="324" font-size="12" fill="' + MUTED + '">国际共识按融合瓣叶命名，并要求描述有无嵴与对称性；融合嵴不明显时写「未见明确嵴」</text>');
  p.push('<text x="130" y="346" font-size="12" fill="' + MUTED + '">示意依据 R125 / R126 · 不复制期刊原图，不作为实际超声切面轮廓</text>');
  p.push('</svg>');
  return p.join('');
}

const FIGS = { 'bav-fusion': bavFusionSvg };

function svgOf(id) {
  const fn = FIGS[id];
  return fn ? fn() : '';
}

module.exports = { bavFusionSvg: bavFusionSvg, svgOf: svgOf, FIGS: FIGS };
