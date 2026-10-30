/**
 * APK 构建收尾：把签好名的 dist\EchoRef.apk 复制到仓库根目录，
 * 命名为 EchoRef-v<版本>.apk，并清掉根目录下其它旧版本 APK。
 *
 * ★ 为什么不用 build-apk.bat 里的 copy + for /f + del：
 *   cmd 的 `for /f` + `dir /b` + `del` 组合在 Git Bash 调 cmd 的场景下不稳定
 *   （同一脚本两次运行报不同的错：文件名语法不正确 / 命令语法不正确），
 *   而且 copy 的目标名会被吞掉扩展名（产物叫 EchoRef-v1.3.10 而不是 .apk）。
 *   这里改用 Node 做，纯字符串路径处理，没有 cmd 转义坑。
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const DIST = path.join(HERE, 'dist');
const SRC = path.join(DIST, 'EchoRef.apk');
const ROOT = path.resolve(HERE, '..');

function readVersion() {
  const raw = fs.readFileSync(path.join(HERE, 'VERSION'), 'utf8');
  const line = raw.split(/\r?\n/)[0].trim();
  if (!line) throw new Error('android-app\\VERSION 第一行为空');
  return line;
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error('[FAIL] dist\\EchoRef.apk 不存在，签名步骤可能失败');
    process.exit(1);
  }

  const version = readVersion();
  const dst = path.join(ROOT, 'EchoRef-v' + version + '.apk');
  fs.copyFileSync(SRC, dst);
  const size = fs.statSync(dst).size;
  console.log('  COPY: ' + dst + '  (' + size + ' bytes)');

  // 根目录只保留最新一个版本化 APK
  // ★ 例外：KEEP 名单里的历史版本不清（第一个发布版留给用户存档；
  //   以前这里是「除当前版本外全删」，下次打包会把手工留的 v1.0.0 删掉）
  const KEEP = ['EchoRef-v1.0.0.apk'];
  const keep = path.basename(dst);
  const removed = [];
  for (const name of fs.readdirSync(ROOT)) {
    if (!/^EchoRef-v.*\.apk$/i.test(name)) continue;
    if (name === keep) continue;
    if (KEEP.indexOf(name) !== -1) { console.log('  KEEP: ' + name); continue; }
    fs.unlinkSync(path.join(ROOT, name));
    removed.push(name);
  }
  if (removed.length) console.log('  REMOVED old: ' + removed.join(', '));
}

main();
