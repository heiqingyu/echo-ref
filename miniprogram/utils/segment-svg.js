/**
 * 节段划分页 SVG 生成器（纯函数，两端共用）
 *
 * ① 17 节段牛眼图：基底段(1-6)外环 / 中间段(7-12)中环 / 心尖段(13-16)内环 / 心尖帽(17)圆心
 *    方位：1 号前壁在正上方，逆时针编号（与 PSAX 钟面一致：10 点前间隔、2 点前外侧）
 * ② 切面解剖示意图：7 个标准切面（PLAX / PSAX×3 / A4C / A2C / A3C），
 *    每图标出可见节段，可按 opts.sel 高亮选中节段
 *
 * 冠脉分区（典型分布）：LAD 1,2,7,8,13,14,17；RCA 3,4,9,10,15；LCx 5,6,11,12,16
 */
const TERRITORY = {
  LAD: { name: 'LAD · 左前降支', segs: [1, 2, 7, 8, 13, 14, 17], color: '#2563eb' },
  RCA: { name: 'RCA · 右冠状动脉', segs: [3, 4, 9, 10, 15], color: '#d97706' },
  LCx: { name: 'LCx · 左回旋支', segs: [5, 6, 11, 12, 16], color: '#0f9d58' },
};

const SEG_NAMES = [
  '前壁基底段', '前间隔基底段', '下间隔基底段', '下壁基底段', '下外侧壁基底段', '前外侧壁基底段',
  '前壁中间段', '前间隔中间段', '下间隔中间段', '下壁中间段', '下外侧壁中间段', '前外侧壁中间段',
  '心尖前壁', '心尖间隔', '心尖下壁', '心尖侧壁', '心尖帽',
];

/** 壁名简写：直接画在切面图上（同一张图只对应一个层面，不必带「基底/中段」前缀） */
const SEG_SHORT = [
  '前壁', '前间隔', '下间隔', '下壁', '下外侧壁', '前外侧壁',
  '前壁', '前间隔', '下间隔', '下壁', '下外侧壁', '前外侧壁',
  '前壁', '间隔', '下壁', '侧壁', '心尖帽',
];

/** 切面 → 显示的节段（ASE 屏幕方位） */
const VIEW_SEGS = {
  'PLAX':   [2, 8, 5, 11],
  'PSAX-B': [1, 2, 3, 4, 5, 6],
  'PSAX-M': [7, 8, 9, 10, 11, 12],
  'PSAX-A': [13, 14, 15, 16],
  'A4C':    [3, 9, 14, 17, 16, 12, 6],
  'A2C':    [4, 10, 15, 17, 13, 7, 1],
  // ★ A3C 按《超声诊断学》（4 版）图 5-73C：左侧 下外侧壁 → 心尖侧壁 16，
  //   右侧 前间隔 → 心尖前壁 13。ASE/AHA 的切面-节段简化表只列 2、8、5、11 + 17，
  //   照那张表画中间会空掉两段（2026-10-28 用户反馈「中间空了」）。
  'A3C':    [5, 11, 16, 17, 13, 8, 2],
};

/** 切面卡片元数据（title/sub/分组/脚注） */
const WALL_VIEWS = [
  { id: 'PLAX', title: 'PLAX · 胸骨旁长轴', sub: '主要显示基底段与中段；心尖通常在画面左侧之外。',
    groups: [['上壁 · 前间隔', [2, 8]], ['下壁 · 下外侧壁', [5, 11]]] },
  { id: 'PSAX-B', title: 'PSAX · 基底段（二尖瓣水平）', sub: '鱼口状二尖瓣 · 节段 1–6',
    groups: [['环形一周：前壁 → 前间隔 → 下间隔 → 下壁 → 下外侧壁 → 前外侧壁', [1, 2, 3, 4, 5, 6]]] },
  { id: 'PSAX-M', title: 'PSAX · 中段（乳头肌水平）', sub: '节段 7–12 · 显示前外侧、后内侧乳头肌',
    groups: [['环形一周：前壁 → 前间隔 → 下间隔 → 下壁 → 下外侧壁 → 前外侧壁', [7, 8, 9, 10, 11, 12]]],
    note: 'AL-PM：前外侧乳头肌；PM-PM：后内侧乳头肌。' },
  { id: 'PSAX-A', title: 'PSAX · 心尖段', sub: '乳头肌以下 · 节段 13–16',
    groups: [['环形一周：前壁 · 间隔 · 下壁 · 侧壁', [13, 14, 15, 16]]] },
  { id: 'A4C', title: 'A4C · 心尖四腔心', sub: '心尖朝上；屏幕左侧为右心，右侧为左心。',
    groups: [['屏幕左侧 · 下间隔 → 心尖间隔', [3, 9, 14]], ['屏幕右侧 · 前外侧壁 → 心尖侧壁', [6, 12, 16]],
      ['心尖 · 第 17 段（心尖帽）', [17]]] },
  { id: 'A2C', title: 'A2C · 心尖两腔心', sub: '由四腔心旋转获得；右室消失，可见左心耳。',
    groups: [['屏幕左侧 · 下壁', [4, 10, 15]], ['屏幕右侧 · 前壁', [1, 7, 13]],
      ['心尖 · 第 17 段（心尖帽）', [17]]] },
  { id: 'A3C', title: 'A3C · 心尖三腔心（长轴）', sub: '继续旋转至左室长轴；右下方显示流出道及主动脉。',
    groups: [['屏幕左侧 · 下外侧壁 → 心尖侧壁', [5, 11, 16]], ['屏幕右侧 · 前间隔 → 心尖前壁', [2, 8, 13]],
      ['心尖 · 第 17 段（心尖帽）', [17]]],
    note: '按《超声诊断学》（4 版）图 5-73C：左侧 基底下侧壁 5 → 中下侧壁 11 → 心尖侧壁 16，右侧 基底前室间隔 2 → 中前室间隔 8 → 心尖前壁 13，顶端心尖帽 17。17 节段模型里这两面壁没有独立心尖节段，一些速查表因此把 A3C 只列 2、8、5、11 —— 照那张表画中间会空两段；本工具按教材补上 13 / 16，与四腔心、两腔心同一套画法。' },
];

function territoryOf(i) {
  for (const k of Object.keys(TERRITORY)) {
    if (TERRITORY[k].segs.indexOf(i) >= 0) return k;
  }
  return '';
}

/** 节段出现在哪些切面，如 ['PLAX','PSAX-M','A3C'] */
function viewsOf(i) {
  const out = [];
  for (const k of Object.keys(VIEW_SEGS)) {
    if (VIEW_SEGS[k].indexOf(i) >= 0) out.push(k);
  }
  return out;
}

/** 点击节段后的说明文字 */
function segInfoText(i) {
  if (!i) return '';
  const terr = territoryOf(i);
  const views = viewsOf(i).map(function (v) {
    return { PLAX: 'PLAX', 'PSAX-B': 'PSAX 基底', 'PSAX-M': 'PSAX 中段', 'PSAX-A': 'PSAX 心尖', A4C: 'A4C', A2C: 'A2C', A3C: 'A3C' }[v] || v;
  });
  return i + ' · ' + SEG_NAMES[i - 1] + ' ｜ ' + terr + ' ｜ 见于：' + views.join('、');
}

const RAD = Math.PI / 180;

/** 极坐标（角度按 SVG 约定：0°在右、顺时针为正） */
function pt(r, deg) {
  return [200 + r * Math.cos(deg * RAD), 200 + r * Math.sin(deg * RAD)];
}

/** 环形扇块路径 */
function wedge(ri, ro, a, b) {
  const [x1, y1] = pt(ro, a);
  const [x2, y2] = pt(ro, b);
  const [x3, y3] = pt(ri, b);
  const [x4, y4] = pt(ri, a);
  return 'M' + x1.toFixed(1) + ' ' + y1.toFixed(1) +
    ' A' + ro + ' ' + ro + ' 0 0 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) +
    ' L' + x3.toFixed(1) + ' ' + y3.toFixed(1) +
    ' A' + ri + ' ' + ri + ' 0 0 0 ' + x4.toFixed(1) + ' ' + y4.toFixed(1) + ' Z';
}

/** 生成 17 节段牛眼图 SVG
 * opts.sel：选中节段（描边加深）；opts.hi：高亮冠脉分区（其余变灰） */
function bullseyeSvg(opts) {
  const hi = (opts && opts.hi) || '';
  const sel = opts && opts.sel != null ? opts.sel : null;
  let paths = '';
  for (let i = 1; i <= 17; i++) {
    let ri, ro, a, b, c, d, pos;
    const terr = territoryOf(i);
    const dim = !sel && hi && terr !== hi;
    const fill = dim ? '#d3d7de' : TERRITORY[terr].color;
    const isSel = sel === i;
    if (i <= 12) {
      ri = i <= 6 ? 128 : 80;
      ro = i <= 6 ? 180 : 128;
      const j = (i - 1) % 6;
      c = -90 - j * 60;
      a = c - 30; b = c + 30;
    } else if (i <= 16) {
      ri = 36; ro = 80;
      c = -90 - (i - 13) * 90;
      a = c - 45; b = c + 45;
    } else {
      pos = [200, 200];
    }
    const stroke = isSel ? '#1e293b' : 'white';
    const sw = isSel ? 4.5 : 2;
    if (i === 17) {
      d = '<circle cx="200" cy="200" r="36" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    } else {
      d = '<path d="' + wedge(ri, ro, a, b) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"/>';
    }
    pos = pos || pt((ri + ro) / 2, c);
    paths += '<g data-seg="' + i + '" data-terr="' + terr + '">' + d +
      '<text x="' + pos[0].toFixed(1) + '" y="' + (pos[1] + 5).toFixed(1) +
      '" text-anchor="middle" fill="white" font-size="16" font-weight="600" pointer-events="none">' +
      i + '</text></g>';
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" role="img" aria-label="左室17节段牛眼图">' +
    '<rect x="0" y="0" width="400" height="400" rx="12" fill="#fafbfc"/>' + paths + '</svg>';
}

/* ══════════ 切面解剖示意图 ══════════ */

function ept(cx, cy, rx, ry, a) {
  return [cx + rx * Math.cos(a * RAD), cy + ry * Math.sin(a * RAD)];
}

function f1(n) { return n.toFixed(1); }

/** 椭圆环带扇块（a→b 顺时针） */
function eband(cx, cy, rx, ry, irx, iry, a, b) {
  const large = (b - a) > 180 ? 1 : 0;
  const p1 = ept(cx, cy, rx, ry, a), p2 = ept(cx, cy, rx, ry, b);
  const p3 = ept(cx, cy, irx, iry, b), p4 = ept(cx, cy, irx, iry, a);
  return 'M' + f1(p1[0]) + ' ' + f1(p1[1]) +
    ' A' + rx + ',' + ry + ' 0 ' + large + ' 1 ' + f1(p2[0]) + ' ' + f1(p2[1]) +
    ' L' + f1(p3[0]) + ' ' + f1(p3[1]) +
    ' A' + irx + ',' + iry + ' 0 ' + large + ' 0 ' + f1(p4[0]) + ' ' + f1(p4[1]) + ' Z';
}

function chamber(d) {
  return '<path d="' + d + '" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
}

function ell(cx, cy, rx, ry) {
  return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="#eef1f5" stroke="#94a3b8" stroke-width="2"/>';
}

function lab(x, y, t, size) {
  return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="' + (size || 17) +
    '" font-weight="600" fill="#64748b">' + t + '</text>';
}

/** 节段色块 + 编号（sel 时描边加深） */
function segNode(i, d, tx, ty, sel, fs) {
  const isSel = sel === i;
  return '<g data-seg="' + i + '" data-terr="' + territoryOf(i) + '">' +
    '<path d="' + d + '" fill="' + TERRITORY[territoryOf(i)].color +
    '" stroke="' + (isSel ? '#1e293b' : '#ffffff') + '" stroke-width="' + (isSel ? 4.5 : 2) + '"/>' +
    '<text x="' + f1(tx) + '" y="' + f1(ty) + '" text-anchor="middle" fill="white" font-size="' + (fs || 17) +
    '" font-weight="700" pointer-events="none">' + i + '</text></g>';
}

/** 节段色块 + 编号 + 壁名（PSAX 环带：编号在上、壁名在下，都在色带内） */
function segNode2(i, d, num, nm, sel) {
  const isSel = sel === i;
  return '<g data-seg="' + i + '" data-terr="' + territoryOf(i) + '">' +
    '<path d="' + d + '" fill="' + TERRITORY[territoryOf(i)].color +
    '" stroke="' + (isSel ? '#1e293b' : '#ffffff') + '" stroke-width="' + (isSel ? 4.5 : 2) + '"/>' +
    '<text x="' + f1(num[0]) + '" y="' + f1(num[1]) + '" text-anchor="middle" fill="#ffffff" font-size="15"' +
    ' font-weight="700" pointer-events="none">' + i + '</text>' +
    '<text x="' + f1(nm[0]) + '" y="' + f1(nm[1]) + '" text-anchor="middle" fill="#ffffff" font-size="12"' +
    ' font-weight="600" opacity=".96" pointer-events="none">' + SEG_SHORT[i - 1] + '</text></g>';
}

function svgWrap(content, box, label) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + box + '" width="100%" role="img" aria-label="' + label + '">' +
    '<rect x="0" y="0" width="100%" height="100%" rx="10" fill="#fafbfc"/>' + content + '</svg>';
}

/**
 * 生成单个切面的解剖示意图
 * @param {string} view WALL_VIEWS 中的 id
 * @param {Object} opts opts.sel：选中节段
 */
function wallDiagramSvg(view, opts) {
  const sel = opts && opts.sel != null ? opts.sel : null;
  let n = '';
  const ids = VIEW_SEGS[view];

  if (view === 'PLAX') {
    // 左室长轴水平放置：主动脉瓣在右、心尖在左；上壁前间隔、下壁下外侧壁
    const cx = 265, cy = 210;
    // 上壁：8 中段(靠心尖)、2 基底段(靠瓣膜)；下壁：5 基底、11 中段
    n += segNode(8, eband(cx, cy, 212, 96, 176, 66, -172, -98),
      ept(cx, cy, 194, 81, -135)[0], ept(cx, cy, 194, 81, -135)[1] + 6, sel);
    n += segNode(2, eband(cx, cy, 212, 96, 176, 66, -92, -14),
      ept(cx, cy, 194, 81, -53)[0], ept(cx, cy, 194, 81, -53)[1] + 6, sel);
    n += segNode(5, eband(cx, cy, 212, 96, 176, 66, 14, 88),
      ept(cx, cy, 194, 81, 51)[0], ept(cx, cy, 194, 81, 51)[1] + 6, sel);
    n += segNode(11, eband(cx, cy, 212, 96, 176, 66, 94, 170),
      ept(cx, cy, 194, 81, 132)[0], ept(cx, cy, 194, 81, 132)[1] + 6, sel);
    // 心尖汇合部斜线
    for (let a = 172; a <= 188; a += 5) {
      const p = ept(cx, cy, 212, 96, a), q = ept(cx, cy, 176, 66, a);
      n += '<path d="M' + f1(p[0]) + ' ' + f1(p[1]) + ' L' + f1(q[0]) + ' ' + f1(q[1]) +
        '" stroke="#94a3b8" stroke-width="4" opacity=".55"/>';
    }
    // 右室（上方弧带）、主动脉、左房
    n += chamber('M118 84 Q272 18 452 82 L448 122 Q270 66 126 120 Z') + lab(278, 74, 'RV');
    n += chamber('M448 152 L556 142 L556 198 L448 194 Z') + lab(502, 180, 'Ao');
    n += ell(496, 274, 54, 44) + lab(496, 280, 'LA');
    n += lab(cx, 216, 'LV', 20) + lab(30, 216, '心尖', 15);
    return svgWrap(n, '0 0 570 355', 'PLAX 解剖与室壁节段示意图');
  }

  if (view.indexOf('PSAX') === 0) {
    const cx = 240, cy = 235, count = ids.length;
    // 色带加厚到 58：一行编号 + 一行壁名，不用点数字就知道哪块是哪面壁
    const outer = count === 4 ? 136 : 150, inner = outer - 58;
    // 右室（左侧弧带）
    n += chamber(eband(cx, cy, outer + 62, outer + 62, outer + 12, outer + 12, 108, 252));
    n += lab(cx - outer - 32, cy + 6, 'RV');
    const mid = (outer + inner) / 2;
    for (let j = 0; j < count; j++) {
      const i = ids[j];
      const a = -90 - j * (360 / count);
      // 两行都按「色带径向中线 + 垂直叠放」定位：侧面（3/9 点）也不会横向顶出色带
      const p = ept(cx, cy, mid, mid, a);
      n += segNode2(i, eband(cx, cy, outer, outer, inner, inner, a - 180 / count, a + 180 / count),
        [p[0], p[1] - 3], [p[0], p[1] + 14], sel);
    }
    if (view === 'PSAX-B') {
      n += '<path d="M175 235 Q240 183 305 235 Q240 277 175 235 Z" fill="none" stroke="#94a3b8" stroke-width="2"/>' +
        lab(240, 240, 'MV');
    } else if (view === 'PSAX-M') {
      n += '<circle cx="197" cy="284" r="15" fill="none" stroke="#94a3b8" stroke-width="2"/>' +
        '<circle cx="298" cy="272" r="15" fill="none" stroke="#94a3b8" stroke-width="2"/>' +
        lab(200, 258, 'PM-PM', 13) + lab(300, 246, 'AL-PM', 13);
    } else {
      n += lab(240, 241, 'LV');
    }
    return svgWrap(n, '0 0 480 470', view + ' 解剖与室壁节段示意图');
  }

  // 心尖切面：左室竖放、心尖朝上；φ 角以心尖为 0°，负值在屏幕左侧
  const cx = view === 'A4C' ? 300 : 240, cy = 262, rx = 100, ry = 194;
  const put = function (i, a, b) {
    const mid = (a + b) / 2 - 90;
    const pos = ept(cx, cy, rx - 12, ry - 12, mid);
    n += segNode(i, eband(cx, cy, rx, ry, rx - 24, ry - 24, a - 90, b - 90), pos[0], pos[1] + 6, sel);
  };
  const PAIRS = {
    'A4C': [[3, -150, -110], [9, -106, -50], [14, -46, -20], [16, 20, 46], [12, 50, 106], [6, 110, 150]],
    'A2C': [[4, -150, -110], [10, -106, -50], [15, -46, -20], [13, 20, 46], [7, 50, 106], [1, 110, 150]],
    // ★ A3C 与 A4C / A2C 同构：基底 → 中段 → 心尖三段（16 / 13），顶端 17。
    //   早前按 ASE 简化表只画 2、8、5、11，中间空出 -50°…-18°、18°…50° 两片，
    //   看着像漏了两个节段（2026-10-28 用户反馈，对照《超声诊断学》4 版图 5-73C 修正）。
    'A3C': [[5, -150, -110], [11, -106, -50], [16, -46, -20], [13, 20, 46], [8, 50, 106], [2, 110, 150]],
  }[view];
  PAIRS.forEach(function (p) { put(p[0], p[1], p[2]); });
  put(17, -18, 18);

  if (view === 'A4C') {
    n += chamber('M105 418 C55 359 60 203 100 161 C148 105 207 189 207 294 C207 349 197 393 183 418 Z') +
      lab(140, 302, 'RV', 20);
    n += ell(137, 482, 73, 45) + lab(137, 488, 'RA', 20);
    n += ell(cx, 482, 84, 45) + lab(cx, 488, 'LA', 20);
    n += lab(197, 432, 'TV', 15) + lab(cx, 432, 'MV', 15);
  } else if (view === 'A2C') {
    n += ell(cx, 482, 88, 44) + lab(cx, 488, 'LA', 20);
    n += ell(362, 438, 26, 17) + lab(405, 444, 'LAA', 15);
    n += lab(cx, 432, 'MV', 15);
  } else {
    n += ell(200, 482, 72, 42) + lab(200, 488, 'LA', 20);
    n += chamber('M288 414 L414 478 L392 516 L266 450 Z') + lab(348, 482, 'Ao', 17);
    n += lab(316, 438, 'LVOT', 13) + lab(236, 432, 'MV', 15);
  }
  n += lab(cx, 306, 'LV', 20);
  return svgWrap(n, '0 0 480 550', view + ' 解剖与室壁节段示意图');
}

/** 简易 UTF-8 base64（小程序端 image 组件用 data URI） */
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
  TERRITORY,
  SEG_NAMES,
  VIEW_SEGS,
  WALL_VIEWS,
  territoryOf,
  viewsOf,
  segInfoText,
  bullseyeSvg,
  wallDiagramSvg,
  utf8ToBase64,
};
