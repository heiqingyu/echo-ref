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
  '前壁基底段', '前间隔基底段', '下间隔基底段', '下壁基底段', '下侧壁基底段', '前侧壁基底段',
  '前壁中间段', '前间隔中间段', '下间隔中间段', '下壁中间段', '下侧壁中间段', '前侧壁中间段',
  '心尖前壁', '心尖间隔', '心尖下壁', '心尖侧壁', '心尖帽',
];

/** 壁名简写：直接画在切面图上（同一张图只对应一个层面，不必带「基底/中段」前缀） */
const SEG_SHORT = [
  '前壁', '前间隔', '下间隔', '下壁', '下侧壁', '前侧壁',
  '前壁', '前间隔', '下间隔', '下壁', '下侧壁', '前侧壁',
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
  // ★ A3C 按 AHA/ASE 2002 的 17 节段标准（R84）+ 教材示意：左侧 下侧壁 → 心尖侧壁 16，
  //   右侧 前间隔 → 心尖前壁 13。ASE/AHA 的切面-节段简化表只列 2、8、5、11 + 17，
  //   照那张表画中间会空掉两段（2026-10-28 用户反馈「中间空了」）。
  'A3C':    [5, 11, 16, 17, 13, 8, 2],
};

/** 切面卡片元数据（title/sub/分组/脚注） */
const WALL_VIEWS = [
  { id: 'PLAX', title: 'PLAX · 胸骨旁长轴', sub: '主要显示基底段与中段；心尖通常在画面左侧之外。',
    groups: [['上壁 · 前间隔', [2, 8]], ['下壁 · 下侧壁', [5, 11]]] },
  { id: 'PSAX-B', title: 'PSAX · 基底段（二尖瓣水平）', sub: '鱼口状二尖瓣 · 节段 1–6',
    groups: [['环形一周：前壁 → 前间隔 → 下间隔 → 下壁 → 下侧壁 → 前侧壁', [1, 2, 3, 4, 5, 6]]] },
  { id: 'PSAX-M', title: 'PSAX · 中段（乳头肌水平）', sub: '节段 7–12 · 显示前外侧、后内侧乳头肌',
    groups: [['环形一周：前壁 → 前间隔 → 下间隔 → 下壁 → 下侧壁 → 前侧壁', [7, 8, 9, 10, 11, 12]]],
    note: 'AL-PM：前外侧乳头肌；PM-PM：后内侧乳头肌。' },
  { id: 'PSAX-A', title: 'PSAX · 心尖段', sub: '乳头肌以下 · 节段 13–16',
    groups: [['环形一周：前壁 · 间隔 · 下壁 · 侧壁', [13, 14, 15, 16]]] },
  { id: 'A4C', title: 'A4C · 心尖四腔心', sub: '心尖朝上；屏幕左侧为右心，右侧为左心。',
    groups: [['屏幕左侧 · 下间隔 → 心尖间隔', [3, 9, 14]], ['屏幕右侧 · 前侧壁 → 心尖侧壁', [6, 12, 16]],
      ['心尖 · 第 17 段（心尖帽）', [17]]] },
  { id: 'A2C', title: 'A2C · 心尖两腔心', sub: '由四腔心旋转获得；右室消失，可见左心耳。',
    groups: [['屏幕左侧 · 下壁', [4, 10, 15]], ['屏幕右侧 · 前壁', [1, 7, 13]],
      ['心尖 · 第 17 段（心尖帽）', [17]]] },
  { id: 'A3C', title: 'A3C · 心尖三腔心（长轴）', sub: '继续旋转至左室长轴；右下方显示流出道及主动脉。',
    groups: [['屏幕左侧 · 下侧壁 → 心尖侧壁', [5, 11, 16]], ['屏幕右侧 · 前间隔 → 心尖前壁', [2, 8, 13]],
      ['心尖 · 第 17 段（心尖帽）', [17]]],
    note: '编号与命名按 AHA/ASE 2002 的 17 节段标准（R84）：左侧 基底下侧壁 5 → 中下侧壁 11 → 心尖侧壁 16，右侧 基底前间隔 2 → 中前间隔 8 → 心尖前壁 13，顶端心尖帽 17。标准的切面-节段对照表里这两面壁没有独立的心尖节段，一些速查表因此把 A3C 只列 2、8、5、11 —— 照那张表画，心尖会空出两片；本工具为与四腔心、两腔心同构，把 13 / 16 也画在长轴上，属读图约定。' },
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
/** ASE/AHA 2002 英文标准名（报告与文献对照用） */
const SEG_EN = [
  'basal anterior', 'basal anteroseptal', 'basal inferoseptal', 'basal inferior',
  'basal inferolateral', 'basal anterolateral',
  'mid anterior', 'mid anteroseptal', 'mid inferoseptal', 'mid inferior',
  'mid inferolateral', 'mid anterolateral',
  'apical anterior', 'apical septal', 'apical inferior', 'apical lateral', 'apical cap',
];

/**
 * 常见同义中文
 * ★ 中文超声里「前间隔 / 前间壁 / 前室间隔」是同一处；「下侧壁」旧称「后壁」，
 *   「前侧壁」旧称「侧壁」，「下间隔」旧称「后间隔」。报告里都会遇到，一并给出。
 */
const SEG_ALIAS = [
  '', '亦称前室间隔 / 前间壁', '亦称下室间隔 / 下间壁 / 后间隔', '', '旧称后壁', '旧称侧壁',
  '', '亦称前室间隔 / 前间壁', '亦称下室间隔 / 下间壁 / 后间隔', '', '旧称后壁', '旧称侧壁',
  '', '亦称室间隔心尖部', '', '', '',
];

function segInfoText(i) {
  if (!i) return '';
  const terr = territoryOf(i);
  const views = viewsOf(i).map(function (v) {
    return { PLAX: 'PLAX', 'PSAX-B': 'PSAX 基底', 'PSAX-M': 'PSAX 中段', 'PSAX-A': 'PSAX 心尖', A4C: 'A4C', A2C: 'A2C', A3C: 'A3C' }[v] || v;
  });
  const en = SEG_EN[i - 1] || '';
  const alias = SEG_ALIAS[i - 1] ? '，' + SEG_ALIAS[i - 1] : '';
  return i + ' · ' + SEG_NAMES[i - 1] + '（' + en + alias + '）｜ ' + terr + ' ｜ 见于：' + views.join('、');
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

  /* ── 外侧引线标注：色带外缘 → 数字胶囊 + 壁名 ── */
  const NAME_FS = 17;
  const cwOf = function (i) { return i >= 10 ? 28 : 24; };
  function capTag(i, x, y) {
    const w = cwOf(i);
    return '<rect x="' + f1(x - w / 2) + '" y="' + f1(y - 11) + '" width="' + w + '" height="22" rx="11" fill="' +
      TERRITORY[territoryOf(i)].color + '"' + (sel === i ? ' stroke="#1e293b" stroke-width="1.8"' : '') + '/>' +
      '<text x="' + f1(x) + '" y="' + f1(y + 5.2) + '" text-anchor="middle" font-size="14.5" font-weight="700"' +
      ' fill="#ffffff" pointer-events="none">' + i + '</text>';
  }
  function nameTag(i, x, y, anchor) {
    const on = sel === i;
    return '<text x="' + f1(x) + '" y="' + f1(y) + '" text-anchor="' + anchor + '" font-size="' + NAME_FS +
      '" font-weight="' + (on ? 700 : 500) + '" fill="' + (on ? '#0f172a' : '#3d4859') +
      '" pointer-events="none">' + SEG_NAMES[i - 1] + '</text>';
  }
  /**
   * 一条引线 + 一行标注
   * @param {Array} p0 色带外缘上的连接点
   * @param {number} ax 引线终点 x
   * @param {number} ay 引线终点 y（也是文字行的垂直中心）
   * @param {string} side 'L' 名称向左展开 / 'R' 向右 / 'C' 胶囊居中、名称向右
   */
  function callout(i, p0, ax, ay, side) {
    const on = sel === i, st = on ? '#1e293b' : '#98a6b8', w = cwOf(i);
    let g = '<g data-seg="' + i + '" data-terr="' + territoryOf(i) + '">' +
      '<path class="seg-lead" d="M' + f1(p0[0]) + ' ' + f1(p0[1]) + ' L' + f1(ax) + ' ' + f1(ay) + '" fill="none" stroke="' + st +
      '" stroke-width="' + (on ? 1.9 : 1.3) + '"/>' +
      '<circle cx="' + f1(p0[0]) + '" cy="' + f1(p0[1]) + '" r="' + (on ? 3.4 : 2.6) + '" fill="' + st + '"/>';
    if (side === 'L') g += capTag(i, ax - w / 2, ay) + nameTag(i, ax - w - 7, ay + 6, 'end');
    else if (side === 'R') g += capTag(i, ax + w / 2, ay) + nameTag(i, ax + w + 7, ay + 6, 'start');
    else g += capTag(i, ax, ay) + nameTag(i, ax + w / 2 + 7, ay + 6, 'start');
    return g + '</g>';
  }

  if (view === 'PLAX') {
    // 左室长轴水平放置：主动脉瓣在右、心尖在左；上壁前间隔、下壁下侧壁
    const cx = 310, cy = 262, rx = 198, ry = 72;
    const irx = rx - 28, iry = ry - 28;
    const ringX = (rx + irx) / 2, ringY = (ry + iry) / 2;
    // 上壁：8 中段（靠心尖）、2 基底段（靠瓣膜）；下壁：5 基底、11 中段
    [[8, -172, -98, 160], [2, -92, -14, 160], [5, 14, 88, 376], [11, 94, 170, 376]]
      .forEach(function (b) {
        const i = b[0], a = b[1], e = b[2], ly = b[3];
        const mid = (a + e) / 2;
        const pin = ept(cx, cy, ringX, ringY, mid);
        n += segNode(i, eband(cx, cy, rx, ry, irx, iry, a, e), pin[0], pin[1] + 6, sel, 18);
        // 连接点取色带外缘中点，引线向上（上壁）或向下（下壁）
        n += callout(i, ept(cx, cy, rx, ry, mid), pin[0], ly, 'C');
      });
    // 心尖汇合部斜线
    for (let a = 172; a <= 188; a += 5) {
      const p = ept(cx, cy, rx, ry, a), q = ept(cx, cy, irx, iry, a);
      n += '<path d="M' + f1(p[0]) + ' ' + f1(p[1]) + ' L' + f1(q[0]) + ' ' + f1(q[1]) +
        '" stroke="#94a3b8" stroke-width="4" opacity=".55"/>';
    }
    // 右室（上方弧带）、主动脉、左房
    n += chamber('M150 96 Q310 30 470 94 L466 126 Q310 76 158 124 Z') + lab(310, 100, 'RV', 16);
    n += chamber('M512 218 L604 208 L604 262 L512 258 Z') + lab(558, 244, 'Ao', 17);
    n += ell(566, 326, 40, 31) + lab(566, 332, 'LA', 17);
    n += lab(cx, 268, 'LV', 20) + lab(40, 268, '心尖', 15);
    return svgWrap(n, '0 0 620 460', 'PLAX 解剖与室壁节段示意图');
  }

  if (view.indexOf('PSAX') === 0) {
    const cx = 240, cy = 235, count = ids.length;
    // 色带加厚到 58：一行编号 + 一行壁名，不用点数字就知道哪块是哪面壁
    const outer = count === 4 ? 136 : 150, inner = outer - 58;
    // 右室（左侧弧带）
    n += chamber(eband(cx, cy, outer + 62, outer + 62, outer + 12, outer + 12, 108, 252));
    n += lab(cx - outer - 32, cy + 6, 'RV');
    const ring = (outer + inner) / 2;
    for (let j = 0; j < count; j++) {
      const i = ids[j];
      const a = -90 - j * (360 / count);
      // 两行都按「色带径向中线 + 垂直叠放」定位：侧面（3/9 点）也不会横向顶出色带
      const p = ept(cx, cy, ring, ring, a);
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
  const GEO = {
    A4C: { cx: 382, lx: 296, rx2: 468, rx: 78 },
    A2C: { cx: 308, lx: 216, rx2: 400, rx: 84 },
    A3C: { cx: 308, lx: 216, rx2: 400, rx: 84 },
  }[view];
  const cx = GEO.cx, cy = 280, rx = GEO.rx, ry = 168, RI = 26;
  const put = function (i, a, b) {
    const mid = (a + b) / 2 - 90;
    const rad = mid * RAD;
    const pin = ept(cx, cy, rx - RI / 2, ry - RI / 2, mid);
    n += segNode(i, eband(cx, cy, rx, ry, rx - RI, ry - RI, a - 90, b - 90), pin[0], pin[1] + 6, sel, 18);
    const p0 = ept(cx, cy, rx, ry, mid);
    const isLeft = Math.cos(rad) < 0;
    n += callout(i, p0, isLeft ? GEO.lx : GEO.rx2, p0[1], isLeft ? 'L' : 'R');
  };
  const PAIRS = {
    'A4C': [[3, -150, -110], [9, -106, -50], [14, -46, -20], [16, 20, 46], [12, 50, 106], [6, 110, 150]],
    'A2C': [[4, -150, -110], [10, -106, -50], [15, -46, -20], [13, 20, 46], [7, 50, 106], [1, 110, 150]],
    // ★ A3C 与 A4C / A2C 同构：基底 → 中段 → 心尖三段（16 / 13），顶端 17。
    //   早前按 ASE 简化表只画 2、8、5、11，中间空出 -50°…-18°、18°…50° 两片，
    //   看着像漏了两个节段（2026-10-28 用户反馈；按教材示意补 13 / 16，不改 ASE 编号体系）。
    'A3C': [[5, -150, -110], [11, -106, -50], [16, -46, -20], [13, 20, 46], [8, 50, 106], [2, 110, 150]],
  }[view];
  PAIRS.forEach(function (p) { put(p[0], p[1], p[2]); });

  // 心尖帽 17：单独放在心尖正上方，引线竖直向上
  const pApex = ept(cx, cy, rx, ry, -90);
  n += segNode(17, eband(cx, cy, rx, ry, rx - RI, ry - RI, -108, -72), cx, cy - ry + RI / 2 + 6, sel, 18);
  n += callout(17, pApex, cx, pApex[1] - 30, 'C');

  if (view === 'A4C') {
    // 右心在屏幕左侧：右室腔（原型等比缩放）+ 右房
    n += '<g transform="translate(-41,67.3) scale(0.93)">' +
      '<path d="M105 418 C55 359 60 203 100 161 C148 105 207 189 207 294 C207 349 197 393 183 418 Z"' +
      ' fill="#eef1f5" stroke="#94a3b8" stroke-width="2.2"/></g>' + lab(80, 306, 'RV', 16);
    n += ell(82, 500, 70, 42) + lab(82, 506, 'RA', 17);
    n += ell(cx, 496, 74, 40) + lab(cx, 502, 'LA', 18);
    n += lab(150, 462, 'TV', 13) + lab(cx, 448, 'MV', 13);
  } else if (view === 'A2C') {
    n += ell(cx, 496, 78, 40) + lab(cx, 502, 'LA', 18);
    n += ell(416, 450, 21, 13) + lab(452, 456, 'LAA', 13);
    n += lab(cx, 448, 'MV', 13);
  } else {
    n += ell(252, 496, 66, 38) + lab(252, 502, 'LA', 18);
    n += chamber('M362 436 L488 480 L472 518 L346 474 Z') + lab(418, 482, 'Ao', 16);
    n += lab(330, 458, 'LVOT', 12) + lab(268, 448, 'MV', 13);
  }
  n += lab(cx, 318, 'LV', 19);
  return svgWrap(n, '0 0 620 580', view + ' 解剖与室壁节段示意图');
}

/* ══════════ 点击命中（小程序 image 不能挂 SVG 事件，只能按坐标反算）══════════ */

/** 各图 viewBox 尺寸（与 bullseyeSvg / wallDiagramSvg 里写死的值一致，改图必须同步） */
const HIT_BOX = {
  bull: [400, 400],
  PLAX: [620, 460], 'PSAX-B': [480, 470], 'PSAX-M': [480, 470], 'PSAX-A': [480, 470],
  A4C: [620, 580], A2C: [620, 580], A3C: [620, 580],
};

function viewBoxOf(kind) { return HIT_BOX[kind] || [620, 580]; }

/** 两个角度之差（度，取 -180…180） */
function angGap(a, b) { return Math.abs(((a - b) % 360 + 540) % 360 - 180); }

/**
 * 椭圆环带图的命中参数
 *   arcs = [节段号, 中心角, 半宽]，角度按 SVG 习惯（0° 向右、顺时针为正）
 *   rLo / rHi = 归一化半径范围（把椭圆拉成圆后的半径，1 = 外缘）
 */
const HIT_ELL = {
  PLAX: { cx: 310, cy: 262, rx: 198, ry: 72, irx: 170, iry: 44, rLo: 0.50, rHi: 1.15,
    arcs: [[8, -135, 37], [2, -53, 39], [5, 51, 37], [11, 132, 38]] },
  'PSAX-B': { cx: 240, cy: 235, rx: 150, ry: 150, irx: 92, iry: 92, rLo: 0.52, rHi: 1.12,
    arcs: [[1, -90, 30], [2, -150, 30], [3, 150, 30], [4, 90, 30], [5, 30, 30], [6, -30, 30]] },
  'PSAX-M': { cx: 240, cy: 235, rx: 150, ry: 150, irx: 92, iry: 92, rLo: 0.52, rHi: 1.12,
    arcs: [[7, -90, 30], [8, -150, 30], [9, 150, 30], [10, 90, 30], [11, 30, 30], [12, -30, 30]] },
  'PSAX-A': { cx: 240, cy: 235, rx: 136, ry: 136, irx: 78, iry: 78, rLo: 0.48, rHi: 1.12,
    arcs: [[13, -90, 45], [14, -180, 45], [15, 90, 45], [16, 0, 45]] },
  A4C: { cx: 382, cy: 280, rx: 78, ry: 168, irx: 52, iry: 142, rLo: 0.55, rHi: 1.12,
    arcs: [[3, -220, 20], [9, -168, 28], [14, -123, 13], [16, -57, 13], [12, -12, 28], [6, 40, 20], [17, -90, 18]] },
  A2C: { cx: 308, cy: 280, rx: 84, ry: 168, irx: 58, iry: 142, rLo: 0.55, rHi: 1.12,
    arcs: [[4, -220, 20], [10, -168, 28], [15, -123, 13], [13, -57, 13], [7, -12, 28], [1, 40, 20], [17, -90, 18]] },
  A3C: { cx: 308, cy: 280, rx: 84, ry: 168, irx: 58, iry: 142, rLo: 0.55, rHi: 1.12,
    arcs: [[5, -220, 20], [11, -168, 28], [16, -123, 13], [13, -57, 13], [8, -12, 28], [2, 40, 20], [17, -90, 18]] },
};

/**
 * 坐标 → 节段号（0 = 没点中）
 * @param {string} kind 'bull' 或 WALL_VIEWS 里的 id
 * @param {number} x viewBox 坐标
 * @param {number} y viewBox 坐标
 */
function hitSeg(kind, x, y) {
  if (kind === 'bull') {
    const dx = x - 200, dy = y - 200;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > 190) return 0;
    if (r <= 40) return 17;
    const deg = Math.atan2(dy, dx) * 180 / Math.PI;
    const al = ((-deg - 90) % 360 + 360) % 360;   // 正上方 0°，逆时针增大（与编号顺序一致）
    if (r <= 84) return 13 + Math.floor(((al + 45) % 360) / 90);
    if (r <= 132) return 7 + Math.floor(((al + 30) % 360) / 60);
    return 1 + Math.floor(((al + 30) % 360) / 60);
  }
  const c = HIT_ELL[kind];
  if (!c) return 0;
  const dx = x - c.cx, dy = y - c.cy;
  const nx = dx / c.rx, ny = dy / c.ry;
  const rr = Math.sqrt(nx * nx + ny * ny);
  if (rr < c.rLo || rr > c.rHi) return 0;
  // ★ 扁椭圆的内外两条弧「参数角」不同（A4C 内缘与外缘最多差 5°），
  //   所以内外各算一次角度，取落在区间更深的那个段，别只按外缘归一化。
  const tOut = Math.atan2(dy / c.ry, dx / c.rx) * 180 / Math.PI;
  const tIn = Math.atan2(dy / c.iry, dx / c.irx) * 180 / Math.PI;
  let best = 0, bestOver = 999;
  for (let k = 0; k < c.arcs.length; k++) {
    const mid = c.arcs[k][1], half = c.arcs[k][2];
    const over = Math.min(angGap(tOut, mid), angGap(tIn, mid)) - half;
    if (over < bestOver) { bestOver = over; best = c.arcs[k][0]; }
  }
  // 相邻色块之间是 2–4° 的白色分隔缝，放 8° 容差让缝也归最近的一段
  return bestOver <= 8 ? best : 0;
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
  SEG_EN,
  SEG_ALIAS,
  VIEW_SEGS,
  WALL_VIEWS,
  territoryOf,
  viewsOf,
  segInfoText,
  bullseyeSvg,
  wallDiagramSvg,
  utf8ToBase64,
  hitSeg,
  viewBoxOf,
};
