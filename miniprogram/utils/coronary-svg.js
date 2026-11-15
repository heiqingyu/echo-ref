/* 冠状动脉超声示意图（小程序 / 网页 / APK 同源）
 * img 块 id: 'ca-clock'
 * 只画钟点坐标与可显示节段编号，不画瓣叶解剖轮廓：
 * 探头角度一变钟点读数就变，把三个窦的方位画死会误导。
 */
function coronaryClockSvg() {
  const B = '#F7F9FC', INK = '#2C2C2A', MUTED = '#5F5E5A';
  const BLUE = '#185FA5', LIGHT = '#E6F1FB', RED = '#A32D2D';
  const p = [];
  p.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="110 0 520 380" width="100%" role="img">');
  p.push('<title>冠状动脉开口钟点与经胸超声可显示节段</title>');
  p.push('<rect x="110" y="0" width="520" height="380" rx="12" fill="' + B + '"/>');
  p.push('<text x="130" y="34" font-size="15" font-weight="500" fill="' + INK + '">胸骨左缘大动脉短轴 · 冠脉开口钟点</text>');
  p.push('<circle cx="250" cy="180" r="92" fill="' + LIGHT + '" stroke="' + BLUE + '" stroke-width="1.5"/>');
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const x1 = (250 + 82 * Math.sin(a)).toFixed(1), y1 = (180 - 82 * Math.cos(a)).toFixed(1);
    const x2 = (250 + 92 * Math.sin(a)).toFixed(1), y2 = (180 - 92 * Math.cos(a)).toFixed(1);
    p.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + BLUE + '" stroke-width="1"/>');
  }
  p.push('<text x="250" y="72" font-size="13" text-anchor="middle" fill="' + MUTED + '">12</text>');
  p.push('<text x="352" y="184" font-size="13" text-anchor="middle" fill="' + MUTED + '">3</text>');
  p.push('<text x="250" y="298" font-size="13" text-anchor="middle" fill="' + MUTED + '">6</text>');
  p.push('<text x="140" y="184" font-size="13" text-anchor="middle" fill="' + MUTED + '">9</text>');
  p.push('<text x="250" y="177" font-size="14" font-weight="500" text-anchor="middle" fill="' + INK + '">主动脉根部短轴</text>');
  p.push('<text x="250" y="202" font-size="13" text-anchor="middle" fill="' + MUTED + '">AO</text>');
  p.push('<circle cx="185" cy="110" r="7" fill="' + BLUE + '"/>');
  p.push('<path d="M185 110 L190 90" fill="none" stroke="' + BLUE + '" stroke-width="1"/>');
  p.push('<text x="125" y="82" font-size="13" fill="' + INK + '">右冠开口 10–11 点</text>');
  p.push('<circle cx="339" cy="205" r="7" fill="' + RED + '"/>');
  p.push('<path d="M339 205 L345 288" fill="none" stroke="' + RED + '" stroke-width="1"/>');
  p.push('<text x="298" y="310" font-size="13" fill="' + INK + '">左冠开口 3–4 点</text>');
  p.push('<rect x="390" y="70" width="215" height="215" rx="10" fill="' + LIGHT + '" stroke="' + BLUE + '" stroke-width="0.5"/>');
  p.push('<text x="402" y="98" font-size="14" font-weight="500" fill="' + INK + '">理想条件下可显示 9 段</text>');
  p.push('<text x="402" y="132" font-size="13" fill="' + INK + '">#1–#4　右冠近 / 中 / 远段、后降支</text>');
  p.push('<text x="402" y="160" font-size="13" fill="' + INK + '">#5　左主干</text>');
  p.push('<text x="402" y="188" font-size="13" fill="' + INK + '">#6 #7　前降支近 / 中段</text>');
  p.push('<text x="402" y="216" font-size="13" fill="' + INK + '">#9　第一对角支</text>');
  p.push('<text x="402" y="244" font-size="13" fill="' + INK + '">#11　回旋支近段</text>');
  p.push('<text x="402" y="272" font-size="12" fill="' + MUTED + '">AHA 15 段中其余 6 段难以显示</text>');
  p.push('<text x="130" y="336" font-size="12" fill="' + MUTED + '">钟点为相对方位，随探头旋转变化；本图不画瓣叶解剖轮廓</text>');
  p.push('<text x="130" y="358" font-size="12" fill="' + MUTED + '">定位标记：三尖瓣环 / 前室间沟 / 左侧房室沟</text>');
  p.push('</svg>');
  return p.join('');
}

/* 图 2：经胸超声可显示的冠状动脉节段（按 R83 图 2 / 表 1 的分段编号自绘）
 * 只画血管走行关系与分段边界，不复制期刊原图线条，也不画实际超声切面轮廓。
 */
function coronarySegmentsSvg() {
  const B = '#F7F9FC', INK = '#2C2C2A', MUTED = '#5F5E5A';
  const BLUE = '#185FA5', LIGHT = '#E6F1FB', RED = '#A32D2D', PINK = '#FBECEC';
  const p = [];
  p.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="110 0 520 380" width="100%" role="img">');
  p.push('<title>经胸超声可显示的冠状动脉节段与分段边界</title>');
  p.push('<rect x="110" y="0" width="520" height="380" rx="12" fill="' + B + '"/>');
  p.push('<text x="130" y="32" font-size="15" font-weight="500" fill="' + INK + '">经胸超声可显示的冠状动脉节段</text>');
  p.push('<text x="130" y="54" font-size="12" fill="' + MUTED + '">AHA 15 分段编号 · 虚线为分段边界（R83 图 2 / 表 1）</text>');
  p.push('<circle cx="252" cy="188" r="58" fill="' + LIGHT + '" stroke="' + BLUE + '" stroke-width="1.5"/>');
  p.push('<text x="252" y="185" font-size="13" text-anchor="middle" fill="' + INK + '">主动脉</text>');
  p.push('<text x="252" y="203" font-size="13" text-anchor="middle" fill="' + INK + '">根部短轴</text>');
  p.push('<path d="M252 188 L252 132 M252 188 L300 216 M252 188 L204 216" fill="none" stroke="' + BLUE + '" stroke-width="1"/>');
  p.push('<path d="M214 142 C170 108, 118 138, 122 192 C126 244, 168 278, 218 270" fill="none" stroke="' + BLUE + '" stroke-width="8" stroke-linecap="round"/>');
  p.push('<path d="M160 100 L196 140 M112 196 L146 214 M204 248 L222 292" fill="none" stroke="' + MUTED + '" stroke-width="1" stroke-dasharray="4 3"/>');
  p.push('<text x="226" y="128" font-size="14" font-weight="500" fill="' + BLUE + '">#1</text>');
  p.push('<text x="158" y="110" font-size="14" font-weight="500" fill="' + BLUE + '">#2</text>');
  p.push('<text x="112" y="232" font-size="14" font-weight="500" fill="' + BLUE + '">#3</text>');
  p.push('<text x="222" y="292" font-size="14" font-weight="500" fill="' + BLUE + '">#4</text>');
  p.push('<text x="126" y="316" font-size="12" fill="' + MUTED + '">右冠 #1-#4 绕三尖瓣环</text>');
  p.push('<path d="M310 184 L350 178" fill="none" stroke="' + RED + '" stroke-width="8" stroke-linecap="round"/>');
  p.push('<text x="318" y="160" font-size="14" font-weight="500" fill="' + RED + '">#5</text>');
  p.push('<path d="M350 172 C412 160, 484 138, 574 104 L574 122 C484 154, 412 176, 350 186 Z" fill="' + PINK + '" stroke="' + RED + '" stroke-width="1.2"/>');
  p.push('<path d="M462 118 L470 168 M542 88 L550 138" fill="none" stroke="' + MUTED + '" stroke-width="1" stroke-dasharray="4 3"/>');
  p.push('<text x="398" y="146" font-size="14" font-weight="500" fill="' + RED + '">#6</text>');
  p.push('<text x="500" y="118" font-size="14" font-weight="500" fill="' + RED + '">#7</text>');
  p.push('<path d="M492 148 C516 162, 538 180, 556 200" fill="none" stroke="' + RED + '" stroke-width="4" stroke-linecap="round"/>');
  p.push('<text x="556" y="204" font-size="14" font-weight="500" fill="' + RED + '">#9</text>');
  p.push('<path d="M350 186 C352 228, 338 268, 322 300" fill="none" stroke="' + RED + '" stroke-width="6" stroke-linecap="round"/>');
  p.push('<text x="292" y="306" font-size="14" font-weight="500" fill="' + RED + '">#11</text>');
  p.push('<text x="392" y="248" font-size="12" fill="' + MUTED + '">左主干分出前降支、对角支与回旋支</text>');
  p.push('<text x="130" y="344" font-size="12" fill="' + MUTED + '">#8 #10 #12-#15 共 6 段经胸超声难以显示</text>');
  p.push('<text x="130" y="364" font-size="12" fill="' + MUTED + '">仅示意编号与解剖关系，不作为实际超声切面轮廓</text>');
  p.push('</svg>');
  return p.join('');
}

const FIGS = { 'ca-clock': coronaryClockSvg, 'ca-segments': coronarySegmentsSvg };

function svgOf(id) {
  const fn = FIGS[id];
  return fn ? fn() : '';
}

module.exports = { coronaryClockSvg: coronaryClockSvg, coronarySegmentsSvg: coronarySegmentsSvg, svgOf: svgOf, FIGS: FIGS };
