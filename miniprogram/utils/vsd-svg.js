/**
 * vsd-svg.js — 室间隔缺损「主动脉瓣短轴钟点」示意图（纯函数，三端共用）
 *
 * 仿 valve-svg.js 的模式：小程序端转 data URI 给 <image>，网页端直接插 SVG 字符串。
 *
 * ★ 这张图只画坐标，不画解剖轮廓，理由有两条：
 *   1) 钟点的实际读数随探头角度、左右显示约定而变，把三叶画死在固定方位上，
 *      换一台机器就会与图不符；
 *   2) 各教材给的弧段本身就不一致（9～11 / 9～12 / 10～11 三套口径，12 点有的
 *      算嵴内、有的算嵴下），图只能表达「钟点 → 类型」的对应，不能替教材定论。
 *   所以：中心圆 = 主动脉瓣短轴（读钟点的基准），外圈 = 时钟读数，
 *   三段彩色环带 = 本切面能定位的三类缺损，3～7 点一段 = 左房 / 房间隔侧。
 *   图注（条目正文）必须写明「分型以缺损边缘为准」。
 */

/** 画布：720×430，圆心 (360,205)，主动脉瓣短轴半径 90，环带厚 16 */
const BOX = '110 0 520 380';
const CX = 360;
const CY = 205;
const R = 90;
const BAND = 16;

function f1(n) {
  return Math.round(n * 10) / 10;
}

/** 钟点 → 坐标（12 点在上，顺时针；h 可为小数，如 10.5） */
function pt(h, r) {
  const t = (h * Math.PI) / 6;
  return [CX + r * Math.sin(t), CY - r * Math.cos(t)];
}

/** 环带扇段：h1 → h2 顺时针（跨度均 < 180°，故 large-arc 恒为 0） */
function band(h1, h2, fill) {
  const r1 = R;
  const r2 = R + BAND;
  const a = pt(h1, r1);
  const b = pt(h2, r1);
  const c = pt(h2, r2);
  const d = pt(h1, r2);
  return '<path d="M' + f1(a[0]) + ' ' + f1(a[1]) +
    ' A' + r1 + ' ' + r1 + ' 0 0 1 ' + f1(b[0]) + ' ' + f1(b[1]) +
    ' L' + f1(c[0]) + ' ' + f1(c[1]) +
    ' A' + r2 + ' ' + r2 + ' 0 0 0 ' + f1(d[0]) + ' ' + f1(d[1]) + ' Z"' +
    ' fill="' + fill + '" stroke="#ffffff" stroke-width="1"/>';
}

/** 整点刻度 */
function tick(h) {
  const a = pt(h, R + BAND + 2);
  const b = pt(h, R + BAND + 10);
  return '<line x1="' + f1(a[0]) + '" y1="' + f1(a[1]) + '" x2="' + f1(b[0]) + '" y2="' + f1(b[1]) +
    '" stroke="#cbd5e1" stroke-width="1.4"/>';
}

/** 钟点数字（只标 12 / 3 / 6 / 9） */
function hourNum(h, t) {
  const p = pt(h, R + 42);
  return '<text x="' + f1(p[0]) + '" y="' + f1(p[1] + 4.5) + '" text-anchor="middle"' +
    ' font-size="12" font-weight="600" fill="#94a3b8">' + t + '</text>';
}

/** 图外标签：主行（类型）+ 次行（钟点与毗邻），用虚线引到环带中点 */
function label(o) {
  const p = pt(o.h, R + BAND - 4);
  const x2 = o.anchor === 'end' ? o.x - 6 : o.x + 6;
  const tie = '<line x1="' + f1(x2) + '" y1="' + f1(o.y - 5) + '" x2="' + f1(p[0]) + '" y2="' + f1(p[1]) +
    '" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3 3"/>';
  const t1 = '<text x="' + o.x + '" y="' + o.y + '" text-anchor="' + o.anchor + '"' +
    ' font-size="13" font-weight="700" fill="' + o.color + '">' + o.t1 + '</text>';
  const t2 = '<text x="' + o.x + '" y="' + (o.y + 17) + '" text-anchor="' + o.anchor + '"' +
    ' font-size="10.5" fill="#64748b">' + o.t2 + '</text>';
  return tie + t1 + t2;
}

/** 主动脉瓣短轴钟点图（唯一一张） */
function clockSvg() {
  const COLOR = { mem: '#2563eb', out: '#d97706', in: '#0f9d58', none: '#e2e8f0' };
  let s = '';

  s += '<rect x="100" y="0" width="540" height="380" fill="#fafbfc"/>';

  // 中心圆：主动脉瓣短轴（读钟点的基准）
  s += '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="#eef2f7" stroke="#94a3b8" stroke-width="1.5"/>';

  // 环带：膜周部 9–12、流出道 12–3、流入道 7–9、3–7 无缺损
  s += band(9, 12, COLOR.mem);
  s += band(12, 3, COLOR.out);
  s += band(7, 9, COLOR.in);
  s += band(3, 7, COLOR.none);

  // 刻度（逐点）
  for (let h = 0; h < 12; h++) s += tick(h);
  s += hourNum(12, '12');
  s += hourNum(3, '3');
  s += hourNum(6, '6');
  s += hourNum(9, '9');

  // 圆心文字
  s += '<text x="' + CX + '" y="' + (CY - 4) + '" text-anchor="middle" font-size="14" font-weight="700" fill="#475569">主动脉瓣</text>';
  s += '<text x="' + CX + '" y="' + (CY + 15) + '" text-anchor="middle" font-size="10.5" fill="#94a3b8">短轴</text>';

  // 四组标签
  s += label({ h: 10.5, x: 247, y: 104, anchor: 'end', color: COLOR.mem,
    t1: '膜周部', t2: '9–12 点 · 邻三尖瓣隔瓣' });
  s += label({ h: 1.5, x: 473, y: 100, anchor: 'start', color: COLOR.out,
    t1: '流出道型', t2: '12–3 点 · 12 点嵴内、1–2 点干下' });
  s += label({ h: 8, x: 247, y: 292, anchor: 'end', color: COLOR.in,
    t1: '流入道型', t2: '7–9 点 · 三尖瓣隔瓣后' });
  s += label({ h: 5, x: 473, y: 300, anchor: 'start', color: '#64748b',
    t1: '无缺损区', t2: '3–7 点' });

  // 脚注：肌部不在本切面，避免「图上没画＝没有这一类」的误读
  s += '<text x="' + CX + '" y="372" text-anchor="middle" font-size="11.5" fill="#94a3b8">' +
    '肌部（小梁部）缺损不在本切面定位，需心尖四腔 / 左室短轴小梁部扫查</text>';

  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + BOX + '" width="100%"' +
    ' preserveAspectRatio="xMidYMid meet" role="img"' +
    ' aria-label="主动脉瓣短轴切面钟点与室间隔缺损分型的对应示意图">' + s + '</svg>';
}

const FIGS = {
  'vsd-clock': clockSvg,
};

/** 取图（id 不存在时返回空串，渲染端跳过） */
function svgOf(id) {
  const fn = FIGS[id];
  return fn ? fn() : '';
}

/**
 * UTF-8 → Base64（小程序 <image src="data:image/svg+xml;base64,...">）
 *
 * ★ 必须在本地定义，不能 require 别的模块：build-www.js 的 wrapEngine 用静态
 *   分析提取 module.exports 成员名，写成表达式会把整个引擎抽成空对象。
 */
function utf8ToBase64(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
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
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | ((b1 || 0) >> 4)];
    out += b1 === undefined ? '=' : chars[((b1 & 15) << 2) | ((b2 || 0) >> 6)];
    out += b2 === undefined ? '=' : chars[b2 & 63];
  }
  return out;
}

module.exports = {
  clockSvg,
  svgOf,
  utf8ToBase64,
  FIGS,
};
