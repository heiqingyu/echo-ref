/* 融合型二叶式主动脉瓣三种融合表型示意图（小程序 / 网页 / APK 同源）
 * img 块 id: 'bav-fusion'
 * 依据 2021 多学会国际共识与 2022 解读（R125 / R126）自绘，不复制期刊原图。
 * 画法是「胸骨旁短轴 · 收缩期开放」，不是舒张期关闭线、也不是长轴穹窿：
 *   · 三个主动脉窦都在，但功能上只有两片瓣叶 —— 融合的两片连成一片（紫，跨两个窦），
 *     未融合的一片单独成片（蓝，跨一个窦）；
 *   · 开放口呈偏心「鱼嘴」形：融合侧被嵴顶出凹口，开口偏向未融合瓣叶一侧；
 *   · 融合嵴位于两个融合窦之间，从瓣环伸向凹口底。
 * 方位约定：12 点 = 前方（右室流出道侧）。右冠窦在前、无冠窦在右后、左冠窦在左后。
 */
function bavFusionSvg() {
  const B = '#F7F9FC', INK = '#2C2C2A', MUTED = '#5F5E5A';
  const BLUE = '#185FA5', RED = '#A32D2D';
  const FUSED = '#AE85B8', SINGLE = '#3E8FC9';
  const CY = 180, R = 56;
  const p = [];
  const cx0 = [200, 370, 540];
  const names = ['右-左冠瓣融合', '右-无冠瓣融合', '左-无冠瓣融合'];
  const rates = ['70–80%', '20–30%', '3–6%'];
  const rap = [-30, -150, 90];
  const openTo = ['无冠窦侧', '左冠窦侧', '右冠窦侧（前）'];
  const rapAt = ['右、左冠窦之间', '右、无冠窦之间', '左、无冠窦之间'];
  const sinus = [[-90, '右冠'], [30, '左冠'], [150, '无冠']];

  function pt(cx, r, deg) {
    const a = deg * Math.PI / 180;
    return [+(cx + r * Math.cos(a)).toFixed(1), +(CY + r * Math.sin(a)).toFixed(1)];
  }
  // 贴壁的瓣叶弧：从 a1 到 a2 顺时针
  function ring(cx, r, a1, a2) {
    const s = pt(cx, r, a1), e = pt(cx, r, a2);
    const span = ((a2 - a1) % 360 + 360) % 360;
    return 'M' + s[0] + ' ' + s[1] + ' A' + r + ' ' + r + ' 0 ' + (span > 180 ? 1 : 0) + ' 1 ' + e[0] + ' ' + e[1];
  }
  // 过 A、M、Bp 三点的圆弧命令（用于开口的外缘与内缘）
  function arcD(A, M, Bp) {
    const ax = A[0], ay = A[1], mx = M[0], my = M[1], bx = Bp[0], by = Bp[1];
    const d = 2 * (ax * (my - by) + mx * (by - ay) + bx * (ay - my));
    if (Math.abs(d) < 1e-9) return 'L' + bx + ' ' + by;
    const ux = ((ax * ax + ay * ay) * (my - by) + (mx * mx + my * my) * (by - ay) + (bx * bx + by * by) * (ay - my)) / d;
    const uy = ((ax * ax + ay * ay) * (bx - mx) + (mx * mx + my * my) * (ax - bx) + (bx * bx + by * by) * (mx - ax)) / d;
    const r = Math.hypot(ax - ux, ay - uy);
    const N = function (v) { return ((v % 360) + 360) % 360; };
    const ang = function (px, py) { return N(Math.atan2(py - uy, px - ux) * 180 / Math.PI); };
    const a1 = ang(ax, ay), am = ang(mx, my), a2 = ang(bx, by);
    const dAM = N(am - a1), dAB = N(a2 - a1);
    const inc = dAM > 0 && dAM <= dAB;
    const span = inc ? dAB : N(-dAB);
    return 'A' + r.toFixed(2) + ' ' + r.toFixed(2) + ' 0 ' + (span > 180 ? 1 : 0) + ' ' + (inc ? 1 : 0) + ' ' + bx + ' ' + by;
  }

  p.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="110 0 520 380" width="100%" role="img">');
  p.push('<title>融合型二叶式主动脉瓣三种融合表型的收缩期开放形态</title>');
  p.push('<rect x="110" y="0" width="520" height="380" rx="12" fill="' + B + '"/>');
  p.push('<text x="130" y="30" font-size="15" font-weight="500" fill="' + INK + '">融合型 BAV · 三种融合表型的开放形态</text>');
  p.push('<text x="130" y="52" font-size="12" fill="' + MUTED + '">胸骨旁短轴 · 收缩期开放 · 三个窦都在，功能上只有两片瓣叶</text>');

  for (let i = 0; i < 3; i++) {
    const cx = cx0[i], th = rap[i];
    p.push('<rect x="' + (cx - 81) + '" y="64" width="162" height="220" rx="9" fill="#FFFFFF" stroke="' + BLUE + '" stroke-width="0.6"/>');
    p.push('<text x="' + (cx - 78) + '" y="90" font-size="12.5" font-weight="500" fill="' + INK + '">' + (i + 1) + ' ' + names[i] + '</text>');
    p.push('<text x="' + (cx + 78) + '" y="90" font-size="12" text-anchor="end" fill="' + RED + '">' + rates[i] + '</text>');

    // 瓣环
    p.push('<circle cx="' + cx + '" cy="' + CY + '" r="' + R + '" fill="#FBFCFE" stroke="' + BLUE + '" stroke-width="1.4"/>');

    // 两片功能瓣叶（收缩期贴壁）：紫 = 融合片（跨两个窦），蓝 = 未融合片（跨一个窦）
    p.push('<path d="' + ring(cx, 50, th - 120, th + 120) + '" fill="none" stroke="' + FUSED + '" stroke-width="7"/>');
    p.push('<path d="' + ring(cx, 50, th + 120, th - 120) + '" fill="none" stroke="' + SINGLE + '" stroke-width="7"/>');

    // 两处交界（两片瓣叶的端点）
    [th - 120, th + 120].forEach(function (s) {
      const a = pt(cx, 44, s), b = pt(cx, R, s);
      p.push('<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="' + BLUE + '" stroke-width="1" opacity="0.65"/>');
    });

    // 三个窦的标注（方位固定，三图一致）
    sinus.forEach(function (d) {
      const a = pt(cx, R, d[0]), b = pt(cx, 66, d[0]), t = pt(cx, 73, d[0]);
      p.push('<line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '" stroke="' + MUTED + '" stroke-width="0.7" opacity="0.55"/>');
      p.push('<text x="' + t[0] + '" y="' + (t[1] + 3.5) + '" font-size="10.5" text-anchor="middle" fill="' + MUTED + '">' + d[1] + '</text>');
    });

    // 收缩期开放口：偏心卵形，中心让向未融合瓣叶侧，融合侧被嵴顶出凹口
    const a0 = th * Math.PI / 180;
    const ux = Math.cos(a0), uy = Math.sin(a0), vx = -Math.sin(a0), vy = Math.cos(a0);
    const PX = cx - 16 * ux, PY = CY - 16 * uy;
    const RX = 24, RY = 34, dd = [];
    for (let k = 0; k <= 72; k++) {
      const t = k * 5, tr = t * Math.PI / 180;
      const tt = t > 180 ? t - 360 : t;
      const s = 1 - 0.6 * Math.exp(-Math.pow(tt / 18, 2));
      const ex = RX * Math.cos(tr) * s, ey = RY * Math.sin(tr) * s;
      dd.push((k ? 'L' : 'M') + (PX + ex * ux + ey * vx).toFixed(1) + ' ' + (PY + ex * uy + ey * vy).toFixed(1));
    }
    p.push('<path d="' + dd.join(' ') + ' Z" fill="#FFFFFF" stroke="' + BLUE + '" stroke-width="1.6"/>');

    // 融合嵴：从瓣环沿径向伸到开口凹口底
    const r1 = pt(cx, R, th);
    const nx = (PX + RX * 0.4 * ux).toFixed(1), ny = (PY + RX * 0.4 * uy).toFixed(1);
    p.push('<line x1="' + r1[0] + '" y1="' + r1[1] + '" x2="' + nx + '" y2="' + ny + '" stroke="' + RED + '" stroke-width="3.5" stroke-linecap="round"/>');

    p.push('<text x="' + (cx - 78) + '" y="254" font-size="11" fill="' + MUTED + '">开口偏向' + openTo[i] + '</text>');
    p.push('<text x="' + (cx - 78) + '" y="272" font-size="11" fill="' + MUTED + '">嵴在' + rapAt[i] + '</text>');
  }

  p.push('<text x="130" y="304" font-size="12" fill="' + MUTED + '">收缩期开口偏心：融合侧被嵴顶出凹口，开口偏向未融合瓣叶一侧</text>');
  p.push('<text x="130" y="324" font-size="12" fill="' + MUTED + '">紫弧 = 两个窦的瓣叶融合成一片；蓝弧 = 未融合瓣叶；红线 = 融合嵴</text>');
  p.push('<text x="130" y="344" font-size="12" fill="' + MUTED + '">融合型占 BAV 90–95% · 依据 R125 / R126 自绘，不复制期刊原图</text>');
  p.push('</svg>');
  return p.join('');
}

const FIGS = { 'bav-fusion': bavFusionSvg };

function svgOf(id) {
  const fn = FIGS[id];
  return fn ? fn() : '';
}

module.exports = { bavFusionSvg: bavFusionSvg, svgOf: svgOf, FIGS: FIGS };
