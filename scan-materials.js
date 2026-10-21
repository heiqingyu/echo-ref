/**
 * scan-materials.js — 扫描 docs/materials/ 生成本地资料清单
 *
 * 用法：
 *   1) 把 PDF / 图片 / mp4 丢进 docs/materials/
 *   2) node scan-materials.js
 *   3) node build-www.js && 提交推送（GitHub Pages 才会真正可访问）
 *
 * 设计要点：
 *   - 工具里只存 URL 字符串，不内嵌文件 → 小程序 / APK 体积完全不受影响
 *   - 文件名即标题（下划线 / 连字符转空格，去掉扩展名）
 *   - 跳过的文件：隐藏文件、.md、大于 90 MB 的（GitHub 单文件上限 100 MB）
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIR = path.join(ROOT, 'docs', 'materials');
const OUT = path.join(ROOT, 'miniprogram', 'utils', 'materials.js');
const BASE = 'https://heiqingyu.github.io/echo-ref/materials/';
const MAX_MB = 90;

const KINDS = {
  '.pdf': 'pdf',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.gif': 'image',
  '.mp4': 'video', '.webm': 'video',
};

function humanSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

function titleOf(name) {
  return path.basename(name, path.extname(name))
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function main() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

  const files = fs.readdirSync(DIR)
    .filter((f) => !f.startsWith('.'))
    .filter((f) => KINDS[path.extname(f).toLowerCase()])
    .sort();

  const items = [];
  const skipped = [];

  files.forEach((f) => {
    const full = path.join(DIR, f);
    const st = fs.statSync(full);
    if (!st.isFile()) return;
    if (st.size > MAX_MB * 1024 * 1024) {
      skipped.push(f + '（' + humanSize(st.size) + '，超过 ' + MAX_MB + ' MB）');
      return;
    }
    const kind = KINDS[path.extname(f).toLowerCase()];
    items.push({
      id: 'm-' + f.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9\u4e00-\u9fa5]+/g, '-').toLowerCase(),
      title: titleOf(f),
      sub: kind === 'pdf' ? 'PDF · ' + humanSize(st.size) : humanSize(st.size),
      kind: kind,
      url: BASE + encodeURIComponent(f),
    });
  });

  const body = items.map((it) => '  {\n' +
    "    id: '" + it.id + "',\n" +
    "    title: '" + it.title.replace(/'/g, "\\'") + "',\n" +
    "    sub: '" + it.sub + "',\n" +
    "    kind: '" + it.kind + "',\n" +
    "    url: '" + it.url + "',\n" +
    '  },').join('\n');

  const src = `/**
 * materials.js — 本地资料清单（PDF / 图片 / 视频直链）
 *
 * ★ 本文件由 \`node scan-materials.js\` 扫描 \`docs/materials/\` 自动生成，请勿手改。
 *   往 \`docs/materials/\` 里放文件后跑一次脚本即可；工具里只存 URL 字符串
 *   （每条几十字节），所以无论放多大的 PDF，小程序 / APK 的体积都不会变大。
 *
 * 直链规则：GitHub Pages 把 \`docs/\` 当站点根目录，
 *   所以 \`docs/materials/xxx.pdf\` → \`<base>xxx.pdf\`。
 */
const MATERIAL_BASE = '${BASE}';

const MATERIALS = ${items.length ? '[\n' + body + '\n]' : '[]'};

module.exports = { MATERIAL_BASE, MATERIALS };
`;

  // ★ 本机禁止「打开已存在文件截断写入」，先删再写
  if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
  fs.writeFileSync(OUT, src, 'utf8');

  console.log('📚 扫描 ' + DIR);
  console.log('   收录 ' + items.length + ' 个文件');
  items.forEach((it) => console.log('   · [' + it.kind + '] ' + it.title + '  ' + it.sub));
  if (skipped.length) {
    console.log('   跳过 ' + skipped.length + ' 个：');
    skipped.forEach((s) => console.log('   × ' + s));
  }
  console.log('   → 已写 ' + path.relative(ROOT, OUT));
  if (!items.length) {
    console.log('   （目录为空，清单为 []，页面不会出现「PDF 资料」分组）');
  }
}

main();
