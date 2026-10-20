# -*- coding: utf-8 -*-
"""从「霓虹心脏超声」源图（icon-src.jpg）生成三端图标。

用法：
    python make-icons.py

产出：
  res/mipmap-{mdpi..xxxhdpi}/ic_launcher.png      传统图标 48/72/96/144/192
  res/drawable-{mdpi..xxxhdpi}/ic_launcher_fg.png 自适应前景（108dp 系列，已按 72% 内缩）
  res/drawable-{mdpi..xxxhdpi}/ic_launcher_bg.png 自适应背景（纯底色）
  ../miniprogram/images/app-icon.png              小程序后台头像 144×144
  ../miniprogram/images/app-icon-512.png          备用大图 512×512

源图是"深蓝底 + 圆角矩形、四角为白"，因此：
  · 先把四角白角填成图内底色（否则 launcher 圆角处会露白边）
  · 自适应前景再抠掉底色（透明），并用收缩的圆角遮罩抹掉边界 JPEG 噪点
网页 favicon 以 base64 内嵌在 build-www.js 的 FAVICON_DATA（脚本末尾会打印新值）。
"""
import os, io, base64
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(ROOT, 'res')
MP_DIR = os.path.join(ROOT, '..', 'miniprogram', 'images')
SRC = os.path.join(ROOT, 'icon-src.jpg')

im = Image.open(SRC).convert('RGB')
W, H = im.size
print('source', im.size)

# ── 底色取样（顶部中心：圆角矩形内部、扇形之外） ──
bg = im.getpixel((W // 2, 20))
if sum(bg) > 600:                      # 万一取到白角，四边中点投票
    bg = min([im.getpixel((W // 2, 12)), im.getpixel((12, H // 2)),
              im.getpixel((W - 12, H // 2)), im.getpixel((W // 2, H - 12))], key=sum)
BR = bg
print('bg', bg, '#%02X%02X%02X' % BR)

# ── 去白：接近白色的像素按程度混到底色 ──
px = im.load()
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        m = min(r, g, b)
        if m < 205:
            continue
        if max(r, g, b) - m > 40:      # 三通道都要亮，避免误伤青色描边
            continue
        t = min(1.0, (m - 205) / 50.0)
        px[x, y] = (int(r + (BR[0] - r) * t),
                    int(g + (BR[1] - g) * t),
                    int(b + (BR[2] - b) * t))
flat = im.copy()


def force(path, img, **kw):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        os.remove(path)                # ★ 本机覆盖写会 PermissionError
    img.save(path, **kw)


# ── 1) 传统图标（量化 256 色：渐变图 PNG 无损压缩不划算，省掉 ~2/3 体积） ──
for name, sz in [('mdpi', 48), ('hdpi', 72), ('xhdpi', 96),
                 ('xxhdpi', 144), ('xxxhdpi', 192)]:
    small = flat.resize((sz, sz), Image.LANCZOS).convert('RGB')
    force(os.path.join(RES, 'mipmap-' + name, 'ic_launcher.png'),
          small.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG),
          optimize=True)
    print('  mipmap-%s/ic_launcher.png  %dx%d' % (name, sz, sz))

# ── 2) 自适应图标：fg = 抠底色后的图形（透明），bg = 纯底色 ──
cut = flat.convert('RGBA')
cpx = cut.load()
fp = flat.load()
THR_LO, THR_HI = 10, 46
mask = Image.new('L', (W, H), 0)
ImageDraw.Draw(mask).rounded_rectangle(
    [10, 10, W - 11, H - 11], radius=int(W * 0.185), fill=255)
mk = mask.load()
for y in range(H):
    for x in range(W):
        r, g, b = fp[x, y]
        d = abs(r - BR[0]) + abs(g - BR[1]) + abs(b - BR[2])
        if d <= THR_LO:
            a = 0
        elif d < THR_HI:
            a = int(255 * (d - THR_LO) / float(THR_HI - THR_LO))
        else:
            a = 255
        cpx[x, y] = (r, g, b, a * mk[x, y] // 255)

FG_RATIO = 0.72                        # 内容约 92% → 落在中心 66dp 安全区
for name, base in [('mdpi', 108), ('hdpi', 162), ('xhdpi', 216),
                   ('xxhdpi', 324), ('xxxhdpi', 432)]:
    canvas = Image.new('RGBA', (base, base), (BR[0], BR[1], BR[2], 255))
    inner = int(round(base * FG_RATIO))
    fg = cut.resize((inner, inner), Image.LANCZOS)
    off = (base - inner) // 2
    canvas.paste(fg, (off, off), fg)
    # RGBA 用 FASTOCTREE 量化（保留 alpha）：432px 从 ~74KB 降到 ~11KB
    force(os.path.join(RES, 'drawable-' + name, 'ic_launcher_fg.png'),
          canvas.quantize(colors=256, method=Image.FASTOCTREE), optimize=True)
    print('  drawable-%s/ic_launcher_fg.png  %dx%d' % (name, base, base))
print('  背景层用 @color/icon_bg（纯色不必存 PNG）')

# ── 3) 小程序头像 ──
force(os.path.join(MP_DIR, 'app-icon.png'), flat.resize((144, 144), Image.LANCZOS), optimize=True)
force(os.path.join(MP_DIR, 'app-icon-512.png'), flat.resize((512, 512), Image.LANCZOS), optimize=True)
print('  miniprogram/images/app-icon.png（144）+ app-icon-512.png')

# ── 4) favicon 用图（64px，128 色量化约 3KB） ──
b = io.BytesIO()
flat.resize((64, 64), Image.LANCZOS).quantize(
    colors=128, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG).save(
        b, format='PNG', optimize=True)
b64 = base64.b64encode(b.getvalue()).decode('ascii')
print('  favicon 64px = %d bytes' % len(b.getvalue()))
with open(os.path.join(ROOT, '..', '_favicon_b64.txt'), 'w') as f:
    f.write(b64)
print('  已写出 _favicon_b64.txt（如需替换见 build-www.js 的 FAVICON_DATA）')
print('done, bg = #%02X%02X%02X' % BR)
