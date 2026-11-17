/* 主动脉根部四段测量径线示意图（小程序 / 网页 / APK 同源）
 * img 块 id: 'aorta-measure'
 * 只画血管走向线框、四条测量径线与正常上限，不画瓣叶解剖轮廓：
 * 四段的区分在「测哪一段、用什么时相、上限多少」，把瓣叶画死反而误导。
 * 数值口径：R2 / R27 / R111，与 brief-b.js「主动脉根部与升主动脉」条目表 1 同源。
 */
function aortaMeasureSvg() {
  const B = '#F7F9FC', INK = '#2C2C2A', MUTED = '#5F5E5A';
  const BLUE = '#185FA5', LIGHT = '#E6F1FB', RED = '#A32D2D';
  const p = [];
  p.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="110 0 520 380" width="100%" role="img">');
  p.push('<title>主动脉根部四段测量径线与正常上限</title>');
  p.push('<rect x="110" y="0" width="520" height="380" rx="12" fill="' + B + '"/>');
  p.push('<text x="130" y="32" font-size="15" font-weight="500" fill="' + INK + '">主动脉根部四段 · 测量径线</text>');
  p.push('<text x="130" y="54" font-size="12" fill="' + MUTED + '">内缘到内缘 · 正常上限 男 / 女（mm）</text>');
  // 血管腔：左瓣环 → 窦部膨大 → 窦管交界收窄 → 管状升主动脉，只画两条壁的走向
  p.push('<path d="M150 152 L200 152 C222 152, 226 126, 252 126 L282 126 C308 126, 312 146, 334 146 L364 146 C380 146, 386 141, 404 141 L570 141 L570 219 L404 219 C386 219, 380 224, 364 224 L334 224 C312 224, 308 234, 282 234 L252 234 C226 234, 222 208, 200 208 L150 208 Z" fill="' + LIGHT + '" stroke="' + BLUE + '" stroke-width="1.5"/>');
  // 四条测量径线（红线 = 内缘到内缘）
  p.push('<line x1="175" y1="152" x2="175" y2="208" stroke="' + RED + '" stroke-width="2"/>');
  p.push('<line x1="267" y1="126" x2="267" y2="234" stroke="' + RED + '" stroke-width="2"/>');
  p.push('<line x1="349" y1="146" x2="349" y2="224" stroke="' + RED + '" stroke-width="2"/>');
  p.push('<line x1="470" y1="141" x2="470" y2="219" stroke="' + RED + '" stroke-width="2"/>');
  // 上方：部位
  p.push('<text x="175" y="116" font-size="13" font-weight="500" text-anchor="middle" fill="' + INK + '">瓣环</text>');
  p.push('<text x="267" y="100" font-size="13" font-weight="500" text-anchor="middle" fill="' + INK + '">窦部</text>');
  p.push('<text x="349" y="118" font-size="13" font-weight="500" text-anchor="middle" fill="' + INK + '">窦管交界</text>');
  p.push('<text x="470" y="116" font-size="13" font-weight="500" text-anchor="middle" fill="' + INK + '">升主动脉</text>');
  // 下方：时相 + 正常上限
  p.push('<text x="175" y="262" font-size="12" text-anchor="middle" fill="' + MUTED + '">收缩中期</text>');
  p.push('<text x="175" y="284" font-size="13" font-weight="500" text-anchor="middle" fill="' + RED + '">26 / 23</text>');
  p.push('<text x="267" y="262" font-size="12" text-anchor="middle" fill="' + MUTED + '">舒张末期</text>');
  p.push('<text x="267" y="284" font-size="13" font-weight="500" text-anchor="middle" fill="' + RED + '">40 / 36</text>');
  p.push('<text x="349" y="262" font-size="12" text-anchor="middle" fill="' + MUTED + '">舒张末期</text>');
  p.push('<text x="349" y="284" font-size="13" font-weight="500" text-anchor="middle" fill="' + RED + '">35 / 32</text>');
  p.push('<text x="470" y="262" font-size="12" text-anchor="middle" fill="' + MUTED + '">舒张末期</text>');
  p.push('<text x="470" y="284" font-size="13" font-weight="500" text-anchor="middle" fill="' + RED + '">37 / 33</text>');
  // 脚注
  p.push('<text x="130" y="322" font-size="12" fill="' + MUTED + '">四段正常上限不同，报告必须写明测的是哪一段</text>');
  p.push('<text x="130" y="344" font-size="12" fill="' + MUTED + '">一律内缘到内缘；斜切可使直径假性增大 3–5 mm</text>');
  p.push('<text x="130" y="364" font-size="12" fill="' + MUTED + '">口径同源 R2 / R27 / R111 · 不画瓣叶解剖轮廓</text>');
  p.push('</svg>');
  return p.join('');
}

const FIGS = { 'aorta-measure': aortaMeasureSvg };

function svgOf(id) {
  const fn = FIGS[id];
  return fn ? fn() : '';
}

module.exports = { aortaMeasureSvg: aortaMeasureSvg, svgOf: svgOf, FIGS: FIGS };
