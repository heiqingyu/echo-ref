#!/usr/bin/env node
/**
 * 小程序上传前包体自检
 *
 * 背景：微信开发者工具规则——单个 JS 超过 500 KB 时跳过 ES6 转译与代码压缩，
 * 上传包会不完整（不是"大一点"，是缺内容），真机依赖它的页面直接白屏。
 * 2026-11-05 因 extra-data.js 991 KB 出过一次事故（上传包 1.27 MB → 433 KB）。
 *
 * 用法：node check-mp-size.js
 * 退出码：0 通过 / 1 有预警（可上传，但要留意）/ 2 有阻塞（不要上传）
 */
const fs = require('fs');
const path = require('path');

const MP = path.join(__dirname, 'miniprogram');
const SOFT = 400 * 1024;          // 预警线：离 500 KB 门槛不足 100 KB
const HARD = 500 * 1024;          // 硬门槛：超过必被跳过转译
const MAIN_MAX = 2 * 1024 * 1024; // 主包上限 2 MB
const TOTAL_MAX = 20 * 1024 * 1024;
const RATIO = 0.75;               // 实测压缩比（1.64 MB 源 → 1.22 MB 上传包）

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push({ p, rel: path.relative(MP, p).replace(/\\/g, '/'), size: st.size });
  }
  return out;
}

function mb(n) { return (n / 1048576).toFixed(2) + ' MB'; }
function kb(n) { return Math.round(n / 1024) + ' KB'; }

const files = walk(MP);
const total = files.reduce((s, f) => s + f.size, 0);

// 读分包配置
let subPkgs = [];
try {
  const app = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
  subPkgs = app.subPackages || app.subpackages || [];
} catch (e) {
  console.log('[警告] 读不到 app.json，按无分包处理');
}
const subRoots = subPkgs.map(s => (s.root || '').replace(/\/$/, '') + '/');
const isSub = rel => subRoots.some(r => rel.startsWith(r));
const mainFiles = files.filter(f => !isSub(f.rel));
const subFiles = files.filter(f => isSub(f.rel));
const mainSize = mainFiles.reduce((s, f) => s + f.size, 0);

// 版本号
let ver = '(未读到)';
try {
  const v = fs.readFileSync(path.join(MP, 'utils/version.js'), 'utf8');
  ver = (v.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/) || [])[1] || ver;
} catch (e) { /* ignore */ }

console.log('============================================');
console.log(' 小程序包体自检  v' + ver);
console.log('============================================');

let block = [], warn = [];

// 1. 单文件门槛（只看会参与编译的代码文件）
const CODE_EXT = /\.(js|wxs|ts|json|wxml|wxss)$/;
const code = files.filter(f => CODE_EXT.test(f.rel)).sort((a, b) => b.size - a.size);
const heavy = code.filter(f => f.size > HARD);
const near = code.filter(f => f.size > SOFT && f.size <= HARD);

console.log('\n[1] 单文件门槛（>500 KB 会被跳过 ES6 转译 → 真机白屏）');
console.log('    最大单文件：' + kb(code[0].size) + '  ' + code[0].rel);
if (heavy.length) {
  heavy.forEach(f => {
    block.push('单文件 ' + kb(f.size) + ' 超过 500 KB：' + f.rel);
    console.log('    ✗ 阻塞 ' + kb(f.size) + '  ' + f.rel);
  });
} else {
  console.log('    ✓ 全部低于门槛');
}
if (near.length) {
  near.forEach(f => {
    warn.push('单文件 ' + kb(f.size) + ' 逼近门槛：' + f.rel);
    console.log('    ! 预警 ' + kb(f.size) + '  ' + f.rel);
  });
}
console.log('\n    TOP 5：');
code.slice(0, 5).forEach(f => console.log('      ' + kb(f.size).padStart(8) + '  ' + f.rel));

// 2. 主包体积
console.log('\n[2] 主包体积（上限 2 MB，压缩按 ' + RATIO + ' 估算）');
const est = Math.round(mainSize * RATIO);
const pct = (est / MAIN_MAX * 100).toFixed(0);
console.log('    源文件 ' + mb(mainSize) + ' → 估压缩 ' + mb(est) + ' / 2.00 MB（占 ' + pct + '%）');
if (est > MAIN_MAX) {
  block.push('主包估算 ' + mb(est) + ' 超过 2 MB 上限');
  console.log('    ✗ 阻塞 估算已超上限，必须分包或瘦身');
} else if (est > MAIN_MAX * 0.85) {
  warn.push('主包已用 ' + pct + '%，余量不足 15%');
  console.log('    ! 预警 余量不足，下次加内容很可能超');
} else {
  console.log('    ✓ 余量 ' + mb(MAIN_MAX - est));
}

// 3. 分包情况
console.log('\n[3] 分包配置');
if (!subPkgs.length) {
  console.log('    ! 预警 无分包，全部页面在主包');
  warn.push('未配置分包，主包已 ' + mb(mainSize));
} else {
  subPkgs.forEach(sp => {
    const n = sp.pages ? sp.pages.length : '?';
    const size = subFiles.filter(f => f.rel.startsWith((sp.root || '').replace(/\/$/, '') + '/'))
      .reduce((s, f) => s + f.size, 0);
    console.log('    ✓ ' + sp.root + '  ' + n + ' 页  ' + mb(size));
  });
}
if (total > TOTAL_MAX) {
  block.push('总包 ' + mb(total) + ' 超过 20 MB');
}

// 4. 上传设置
console.log('\n[4] 上传设置');
try {
  const pc = JSON.parse(fs.readFileSync(path.join(__dirname, 'project.config.json'), 'utf8'));
  const s = pc.setting || {};
  if (s.minified === false) {
    warn.push('setting.minified = false，包体会明显变大');
    console.log('    ! 预警 setting.minified = false（包体偏大，上传可能超限）');
  } else {
    console.log('    ✓ setting.minified 开启（压缩）');
  }
  console.log('    ' + (s.es6 === false ? '!' : '✓') + ' setting.es6 = ' + s.es6 + '（转 ES5，低版本安卓/iOS 必需）');
  if (s.es6 === false) warn.push('setting.es6 已关闭，低版本机可能无法解析');
} catch (e) {
  console.log('    [警告] 读不到 project.config.json');
}

// 结论
console.log('\n============================================');
if (block.length) {
  console.log(' 结论：不要上传 ✗');
  block.forEach(b => console.log('   · ' + b));
  console.log('\n 修法：把超限的大数组按业务分组拆成多个 <400 KB 的模块，');
  console.log('       主文件 require 后 concat；改完重跑本脚本。');
  console.log('       ★ 拆数据文件后必须同步 build-www.js 的内联路径，否则网页端丢数据。');
  process.exit(2);
} else if (warn.length) {
  console.log(' 结论：可以上传，但有 ' + warn.length + ' 项预警');
  warn.forEach(w => console.log('   · ' + w));
  console.log('\n ⚠ 上传后务必做两件事：');
  console.log('   1. 看上传结束的「已跳过处理」列表——出现文件就是有东西被跳过');
  console.log('   2. 上传即自动刷新体验版，用手机打开体验版逐页点一遍再提审');
  process.exit(1);
} else {
  console.log(' 结论：通过 ✓  可以上传');
  console.log('\n 上传后仍须：① 看「已跳过处理」列表为空 ② 打开体验版真机验证（无需重新预览）');
  process.exit(0);
}
