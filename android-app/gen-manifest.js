/**
 * 生成带版本号的 AndroidManifest
 *
 * aapt2 link 没有 --version-code/--version-name 参数（那是 aapt v1 的），
 * 所以做法是：把模板清单里的版本号替换成 VERSION 文件里的值，写到 build/ 下，
 * 供 aapt2 link 使用。AndroidManifest.xml 本身保持模板状态不变。
 *
 * VERSION 文件格式：
 *   第 1 行 = versionName（给用户看）
 *   第 2 行 = versionCode（每次发版必须递增，否则装不上覆盖包）
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const buildDir = path.join(HERE, 'build');

const raw = fs.readFileSync(path.join(HERE, 'VERSION'), 'utf8').split('\n');
const name = (raw[0] || '').trim();
const code = (raw[1] || '').trim();

if (!name || !/^\d+$/.test(code)) {
  console.error('[ERROR] android-app/VERSION 格式错误，应为：\n  1.0.1\n  2');
  process.exit(1);
}

const tpl = fs.readFileSync(path.join(HERE, 'AndroidManifest.xml'), 'utf8');
const out = tpl
  .replace(/android:versionCode="\d+"/, 'android:versionCode="' + code + '"')
  .replace(/android:versionName="[^"]*"/, 'android:versionName="' + name + '"');

if (out === tpl) {
  console.error('[ERROR] AndroidManifest.xml 中未找到 versionCode / versionName');
  process.exit(1);
}

fs.mkdirSync(buildDir, { recursive: true });
const target = path.join(buildDir, 'AndroidManifest.gen.xml');
fs.writeFileSync(target, out, 'utf8');
console.log('   manifest: versionName=' + name + ' versionCode=' + code);