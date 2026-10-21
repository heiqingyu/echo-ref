/**
 * materials.js — 本地资料清单（PDF / 图片 / 视频直链）
 *
 * ★ 本文件由 `node scan-materials.js` 扫描 `docs/materials/` 自动生成，请勿手改。
 *   往 `docs/materials/` 里放文件后跑一次脚本即可；工具里只存 URL 字符串
 *   （每条几十字节），所以无论放多大的 PDF，小程序 / APK 的体积都不会变大。
 *
 * 直链规则：GitHub Pages 把 `docs/` 当站点根目录，
 *   所以 `docs/materials/xxx.pdf` → `<base>xxx.pdf`。
 */
const MATERIAL_BASE = 'https://heiqingyu.github.io/echo-ref/materials/';

const MATERIALS = [];

module.exports = { MATERIAL_BASE, MATERIALS };
