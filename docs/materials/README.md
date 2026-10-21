# 本地资料目录

把 **PDF / 图片 / 视频** 放进这个目录，然后在仓库根目录跑：

```
node scan-materials.js
```

脚本会生成 `miniprogram/utils/materials.js`（只记录标题、大小、URL），
工具里的「公式集 → 本地资料（PDF 等）」分组就会出现这些条目。

## 为什么不影响工具体积

- 文件放在这里，由 **GitHub Pages** 直接托管：
  `https://heiqingyu.github.io/echo-ref/materials/文件名`
- 小程序 / APK / 网页里**只存这条 URL 字符串**（几十字节），
  不内嵌 PDF，所以放多大的文件，工具本体都不会变大。

## 注意

1. GitHub 单文件上限 100 MB，脚本会自动跳过超过 90 MB 的文件。
2. 只有 **push 之后** GitHub Pages 才会真正可访问（本地测试无效）。
3. 小程序端不能直接打开外部 PDF：微信要求 `wx.downloadFile` 的域名
   已备案并在后台配置。所以小程序里是「复制链接 → 到浏览器打开」，
   和其它外链的行为一致。
4. 文件名即标题（下划线、连字符会转成空格），改名等于改标题。
