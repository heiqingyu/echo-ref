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

const FIGS = { 'ca-clock': coronaryClockSvg };

function svgOf(id) {
  const fn = FIGS[id];
  return fn ? fn() : '';
}

module.exports = { coronaryClockSvg: coronaryClockSvg, svgOf: svgOf, FIGS: FIGS };
