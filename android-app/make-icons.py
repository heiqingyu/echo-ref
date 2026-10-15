#!/usr/bin/env python3
"""
生成应用图标（纯 Python，零第三方依赖）

输出：
  res/mipmap-anydpi-v26/ic_launcher.xml   自适应图标描述
  res/mipmap-hdpi/ic_launcher.png         72×72
  res/mipmap-xhdpi/ic_launcher.png        96×96
  res/mipmap-xxhdpi/ic_launcher.png       144×144
  res/mipmap-xxxhdpi/ic_launcher.png      192×192
  res/drawable-*/ic_launcher_fg.png       前景层（自适应图标用）
  res/values/colors.xml                   背景色

图形：品牌蓝底 + 白色心形轮廓 + 心内一条超声波形线
"""
import os
import struct
import zlib
import math

ROOT = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(ROOT, 'res')

BRAND = (0x25, 0x63, 0xEB)      # #2563eb 品牌蓝
WHITE = (0xFF, 0xFF, 0xFF)
LIGHT = (0xEF, 0xF4, 0xFF)      # #eff4ff 浅蓝


# ══════════════════════════════════════════════════════════
#  PNG 编码（RGBA, 8bit）
# ══════════════════════════════════════════════════════════

def png_chunk(tag: bytes, data: bytes) -> bytes:
    return (struct.pack('>I', len(data)) + tag + data
            + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF))


def write_png(path: str, w: int, h: int, pixels):
    """pixels: 二维列表 [y][x] = (r,g,b,a)"""
    raw = bytearray()
    for y in range(h):
        raw.append(0)                       # filter type 0 (None)
        for x in range(w):
            r, g, b, a = pixels[y][x]
            raw += bytes((r, g, b, a))

    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)   # 8bit RGBA
    png = (b'\x89PNG\r\n\x1a\n'
           + png_chunk(b'IHDR', ihdr)
           + png_chunk(b'IDAT', zlib.compress(bytes(raw), 9))
           + png_chunk(b'IEND', b''))

    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        os.remove(path)                      # ★ 本机覆盖写会 PermissionError
    with open(path, 'wb') as f:
        f.write(png)


# ══════════════════════════════════════════════════════════
#  几何：心形 + 波形
# ══════════════════════════════════════════════════════════

def heart_inside(x: float, y: float) -> bool:
    """标准心形隐函数（y 向下为正，故点乘 -1）
    心形实际范围：|x| ≤ 1.14，y ∈ [-1.26, 1.02]，先归一化到单位圆内。"""
    x /= 1.14
    y /= 1.18
    return (x * x + y * y - 1) ** 3 - x * x * y * y * y <= 0


def heart_point(t: float):
    """心形参数方程（用于描边/波形定位）"""
    x = 16 * math.sin(t) ** 3
    y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
    return x / 17.0, -y / 17.0


def render(size, bg, fg, with_bg=True, scale_heart=1.0):
    """渲染一张图标。返回像素矩阵。"""
    S = size
    cx = cy = S / 2.0
    R = S * 0.46 * scale_heart          # 心形半径
    px = [[(0, 0, 0, 0)] * S for _ in range(S)]

    # 抗锯齿：每像素 3×3 超采样
    SS = 3
    inv = 1.0 / SS

    for yy in range(S):
        for xx in range(S):
            hits_bg = 0
            hits_fg = 0
            for sy in range(SS):
                for sx in range(SS):
                    fx = (xx + (sx + 0.5) * inv - cx) / R
                    fy = (yy + (sy + 0.5) * inv - cy) / R

                    # 背景圆
                    if with_bg:
                        if fx * fx + fy * fy <= 1.0:
                            hits_bg += 1
                    else:
                        hits_bg += 1

                    # 心形（1.32 ≈ 缩到圆的 ~75%，居中留出蓝底边）
                    k = 1.32 / max(scale_heart / 0.80, 1e-6) * 0.80
                    if heart_inside(fx * k, fy * k):
                        hits_fg += 1

            n = SS * SS
            a_bg = hits_bg / n
            a_fg = hits_fg / n

            # 在心形内部画一条超声波形，让图标更像"超声"
            base = bg if with_bg else (0, 0, 0, 0)
            r = g = b = 0
            a = 0

            if a_bg > 0:
                r = int(base[0] * a_bg)
                g = int(base[1] * a_bg)
                b = int(base[2] * a_bg)
                a = int(255 * a_bg)

            if a_fg > 0:
                # 前色叠加
                r = int(r * (1 - a_fg) + fg[0] * a_fg)
                g = int(g * (1 - a_fg) + fg[1] * a_fg)
                b = int(b * (1 - a_fg) + fg[2] * a_fg)
                a = max(a, int(255 * min(1.0, a_bg + a_fg)))

            px[yy][xx] = (max(0, min(255, r)), max(0, min(255, g)),
                          max(0, min(255, b)), max(0, min(255, a)))
    return px


def render_wave(size, color):
    """仅波形层（自适应图标前景用）：心形轮廓内一条 ECG/超声线"""
    S = size
    cx = cy = S / 2.0
    R = S * 0.44
    px = [[(0, 0, 0, 0)] * S for _ in range(S)]
    SS = 3
    inv = 1.0 / SS
    thick = max(1.6, S * 0.028)

    for yy in range(S):
        for xx in range(S):
            hit = 0
            for sy in range(SS):
                for sx in range(SS):
                    fx = (xx + (sx + 0.5) * inv - cx) / R
                    fy = (yy + (sy + 0.5) * inv - cy) / R

                    if not heart_inside(fx * 1.05, fy * 1.05):
                        continue

                    # 波形：以 fx 为横轴，模拟一段脉冲
                    u = fx * 1.9                       # 横向范围
                    if -0.85 <= u <= 0.85:
                        # 基线 + 一个尖峰
                        v = 0.0
                        # 小的 P 波
                        v += 0.10 * math.exp(-((u + 0.45) ** 2) / 0.012)
                        # 尖锐 R 波
                        v -= 0.42 * math.exp(-(u ** 2) / 0.0016)
                        # S 波回升
                        v += 0.16 * math.exp(-((u - 0.13) ** 2) / 0.004)
                        # T 波
                        v += 0.09 * math.exp(-((u - 0.45) ** 2) / 0.02)

                        if abs(fy - v) <= thick / R:
                            hit += 1
            if hit:
                px[yy][xx] = (color[0], color[1], color[2], int(255 * hit / (SS * SS)))
    return px


def overlay(base, top):
    """把 top 叠到 base 上（top 为前景）"""
    H = len(base)
    W = len(base[0])
    out = [[(0, 0, 0, 0)] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            br, bg_, bb, ba = base[y][x]
            tr, tg, tb, ta = top[y][x]
            af = ta / 255.0
            out[y][x] = (
                int(br * (1 - af) + tr * af),
                int(bg_ * (1 - af) + tg * af),
                int(bb * (1 - af) + tb * af),
                max(ba, ta),
            )
    return out


# ══════════════════════════════════════════════════════════
#  主流程
# ══════════════════════════════════════════════════════════

DENSITIES = [
    ('mdpi', 48),
    ('hdpi', 72),
    ('xhdpi', 96),
    ('xxhdpi', 144),
    ('xxxhdpi', 192),
]

print('生成应用图标...')

# ── 传统方形图标（含圆底 + 心形 + 波形）──
for name, sz in DENSITIES:
    heart = render(sz, BRAND, WHITE, with_bg=True, scale_heart=0.80)
    wave = render_wave(sz, BRAND)          # 波形用品牌蓝，压在心形白底上
    icon = overlay(heart, wave)
    p = os.path.join(RES, 'mipmap-' + name, 'ic_launcher.png')
    write_png(p, sz, sz, icon)
    print('  ✓ mipmap-%s/ic_launcher.png  (%d×%d)' % (name, sz, sz))

# ── 自适应图标（Android 8+）：背景色层 + 前景层 ──
for name, sz in DENSITIES:
    # 前景需留安全边距，图形约 66%
    fg = render(sz, BRAND, WHITE, with_bg=False, scale_heart=0.62)
    wave = render_wave(sz, BRAND)
    fg = overlay(fg, wave)
    p = os.path.join(RES, 'drawable-' + name, 'ic_launcher_fg.png')
    write_png(p, sz, sz, fg)
    p2 = os.path.join(RES, 'drawable-' + name, 'ic_launcher_bg.png')
    write_png(p2, sz, sz, [[(BRAND[0], BRAND[1], BRAND[2], 255)] * sz for _ in range(sz)])
    print('  ✓ drawable-%s/ic_launcher_fg.png + bg (%d×%d)' % (name, sz, sz))

# ── 自适应图标 XML ──
adir = os.path.join(RES, 'mipmap-anydpi-v26')
os.makedirs(adir, exist_ok=True)
p = os.path.join(adir, 'ic_launcher.xml')
if os.path.exists(p):
    os.remove(p)
with open(p, 'w', encoding='utf-8') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n'
            '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
            '    <background android:drawable="@drawable/ic_launcher_bg"/>\n'
            '    <foreground android:drawable="@drawable/ic_launcher_fg"/>\n'
            '</adaptive-icon>\n')
print('  ✓ mipmap-anydpi-v26/ic_launcher.xml')

# ── colors.xml ──
p = os.path.join(RES, 'values', 'colors.xml')
if os.path.exists(p):
    os.remove(p)
with open(p, 'w', encoding='utf-8') as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n'
            '<resources>\n'
            '    <color name="brand">#FF2563EB</color>\n'
            '    <color name="brand_soft">#FFEFF4FF</color>\n'
            '    <color name="bg">#FFF5F6F8</color>\n'
            '</resources>\n')
print('  ✓ values/colors.xml')

print('图标生成完毕。')
