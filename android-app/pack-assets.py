#!/usr/bin/env python3
"""把 assets/index.html 与 classes.dex 塞进 APK（ZIP），并保持 Android 安装校验要求。

关键点（踩坑记录）：
  1. resources.arsc 必须 STORED（不压缩）且 4 字节对齐 —— 否则 targetSdk 30+
     的设备/模拟器安装直接失败（INSTALL_PARSE_FAILED_UNEXPECTED_EXCEPTION）。
     aapt2 link 产出的 base.apk 本身是对的，之前用 ZIP_DEFLATED 整体重写
     会把它重新压缩，从而破坏这一点。这是雷电模拟器安装失败的真凶。
  2. AndroidManifest.xml 在 targetSdk 30+ 同样要求 STORED。
  3. 因此这里逐条目沿用原压缩方式，只对新增的两个条目自行决定：
       classes.dex       -> STORED 且对齐
       assets/index.html -> STORED 且对齐（WebView 可直接 mmap）
  4. 本机坑：已存在文件覆盖写会 PermissionError -> 一律先 remove 再写。
"""
import sys
import os
import zipfile
import shutil

ALIGN = 4
FORCE_STORE = {'resources.arsc', 'AndroidManifest.xml'}


def write_entry(zf, name, data, compress_type):
    """写入一条；STORED 时用 extra field 把数据起始偏移对齐到 ALIGN 字节。"""
    zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
    zi.compress_type = compress_type
    zi.external_attr = 0o644 << 16
    if compress_type == zipfile.ZIP_STORED:
        header_len = 30 + len(name.encode('utf-8'))
        cur = zf.fp.tell()
        pad = (ALIGN - (cur + header_len) % ALIGN) % ALIGN
        if pad:
            zi.extra = b'\x00' * pad
    zf.writestr(zi, data)


def main():
    if len(sys.argv) != 5:
        print('usage: pack-assets.py <apk> <assets_src> <dex_name> <dex_src>')
        return 2
    apk, asset_src, dex_name, dex_src = sys.argv[1:5]

    with open(dex_src, 'rb') as f:
        dex_data = f.read()
    with open(asset_src, 'rb') as f:
        asset_data = f.read()

    with zipfile.ZipFile(apk, 'r') as zin:
        entries = []
        for info in zin.infolist():
            if info.filename in (dex_name, 'assets/index.html'):
                continue
            if info.filename.startswith('META-INF/'):
                continue  # 丢弃旧签名残留
            entries.append((info.filename, zin.read(info.filename),
                            info.compress_type))

    tmp = apk + '.tmp'
    if os.path.exists(tmp):
        os.remove(tmp)

    with open(tmp, 'wb') as raw:
        with zipfile.ZipFile(raw, 'w') as zout:
            # resources.arsc 必须排在最前且 STORED，这是 AOSP 的查找约定
            ordered = sorted(entries, key=lambda e: (e[0] != 'resources.arsc',
                                                     e[0]))
            for name, data, ctype in ordered:
                if name in FORCE_STORE:
                    ctype = zipfile.ZIP_STORED
                write_entry(zout, name, data, ctype)
            write_entry(zout, dex_name, dex_data, zipfile.ZIP_STORED)
            write_entry(zout, 'assets/index.html', asset_data,
                        zipfile.ZIP_STORED)

    if os.path.exists(apk):
        os.remove(apk)
    shutil.move(tmp, apk)

    print('已注入: %s (%d bytes), assets/index.html (%d bytes)'
          % (dex_name, len(dex_data), len(asset_data)))


if __name__ == '__main__':
    sys.exit(main())
