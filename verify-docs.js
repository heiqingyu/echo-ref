// 用 Chrome DevTools Protocol 实测发布版三页签：切页 + 计算 + 控制台报错
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
].find((p) => p && fs.existsSync(p)) || 'chrome';

// docs/index.html 与本脚本同目录
const FILE = 'file:///' + path.join(__dirname, 'docs', 'index.html').replace(/\\/g, '/');
const PORT = 9333;

const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + ud,
  '--allow-file-access-from-files',
  FILE,
], { stdio: 'ignore' });

function get(p) {
  return new Promise((res, rej) => {
    http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => {
      let d = '';
      r.on('data', (c) => { d += c; });
      r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } });
    }).on('error', rej);
  });
}

async function waitTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await get('/json/list');
      const t = list.find((x) => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch (e) { /* retry */ }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('未能连上 Chrome 调试端口');
}

let msgId = 0;
function mkClient(ws) {
  const pending = new Map();
  const logs = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') {
      logs.push('[console.' + m.params.type + '] ' +
        m.params.args.map((a) => a.value !== undefined ? a.value : a.description).join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      logs.push('[EXCEPTION] ' + (m.params.exceptionDetails.exception
        ? m.params.exceptionDetails.exception.description
        : m.params.exceptionDetails.text));
    }
  });
  return {
    logs,
    send(method, params) {
      const id = ++msgId;
      return new Promise((res) => {
        pending.set(id, (m) => res(m));
        ws.send(JSON.stringify({ id, method, params: params || {} }));
      });
    },
    async evalJs(expr) {
      const r = await this.send('Runtime.evaluate', {
        expression: expr, returnByValue: true, awaitPromise: true,
      });
      if (r.result && r.result.exceptionDetails) {
        throw new Error(r.result.exceptionDetails.text + ' :: ' + expr);
      }
      return r.result.result.value;
    },
  };
}

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail) });
  console.log((ok ? '  ✅ ' : '  ❌ ') + name + (detail !== undefined && detail !== '' ? '  → ' + detail : ''));
}

(async () => {
  const target = await waitTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });
  const c = mkClient(ws);
  await c.send('Runtime.enable');
  await c.send('Page.enable');
  await new Promise((r) => setTimeout(r, 1500)); // 等 boot

  console.log('\n【一】结构');
  check('页签数 = 2',
    (await c.evalJs('document.querySelectorAll(".tab").length')) === 2);
  const tabNames = await c.evalJs(
    '[...document.querySelectorAll(".tab")].map(e=>e.dataset.tab).join(",")');
  check('页签顺序 index,peds', tabNames === 'index,peds', tabNames);
  check('页面容器 2 个（无 ef/calc/valves/segments）',
    (await c.evalJs('document.querySelectorAll(".page").length')) === 2);
  check('Core 引擎已挂载', (await c.evalJs('typeof window.Core === "object"')) === true);
  check('Peds 引擎已挂载', (await c.evalJs('typeof window.Peds === "object"')) === true);
  check('Calc 引擎已移除', (await c.evalJs('typeof window.Calc')) === 'undefined');
  check('ValveCalc 引擎已移除', (await c.evalJs('typeof window.ValveCalc')) === 'undefined');
  check('SegSvg 引擎已移除', (await c.evalJs('typeof window.SegSvg')) === 'undefined');

  console.log('\n【二】Tab1 EF·参考值（EF 计算 + 参数参考值已合并）');
  // 通用：给输入框赋值并触发 input
  const set = async (id, v) => {
    await c.evalJs(
      '(function(){var e=document.getElementById("' + id + '");' +
      'e.value="' + v + '";e.dispatchEvent(new Event("input",{bubbles:true}));})()'
    );
  };
  check('page-index 默认可见',
    (await c.evalJs('!document.getElementById("page-index").hidden')) === true);
  check('顶栏标题为 EF·参考值',
    (await c.evalJs('document.getElementById("appbarTitle").textContent')) === 'EF·参考值');

  // 合并的关键：EF 计算卡片必须排在参考值列表之前
  const order = await c.evalJs(
    '(function(){var k=[].slice.call(document.querySelectorAll("#page-index > *"));' +
    'var a=-1,b=-1;k.forEach(function(x,i){' +
    'if(x.querySelector("#efLvedd"))a=i;if(x.querySelector("#refList"))b=i;});' +
    'return a+","+b;})()');
  const ord = String(order).split(',').map(Number);
  check('EF 计算位于参考值之前', ord[0] >= 0 && ord[1] > ord[0],
    'EF 序号 ' + ord[0] + ' / 参考值序号 ' + ord[1]);

  // ── EF 计算部分 ──
  await set('efLvedd', 50); await set('efLvesd', 32);
  await set('efIvsd', 9);   await set('efLvpwd', 9);
  await new Promise((r) => setTimeout(r, 600));
  const ef = await c.evalJs('document.getElementById("efResult").textContent');
  check('EF 结果已输出（内容非空）', ef && ef.trim().length > 0);
  const efM = (ef || '').match(/射血分数\s*([\d.]+)\s*%/);
  const efNum = efM ? parseFloat(efM[1]) : NaN;
  check('EF 落在合理区间(50–70%)', efNum > 50 && efNum < 70, efNum + '%');
  check('EF 结论为「正常」', (ef || '').indexOf('正常') !== -1);
  const efGrade = await c.evalJs('document.getElementById("efGrade").textContent');
  check('EF 分级已输出', efGrade && efGrade.trim().length > 0, efGrade);
  // 合并后参考值列表应自动切到「实测值对照」
  check('参考值列表切到实测值对照',
    (await c.evalJs('document.getElementById("refTitle").textContent')) === '实测值对照');

  // 同页后 BSA 变化必须联动 EF 结果的 LVM/BSA
  const kvBefore = await c.evalJs('document.getElementById("efKv").textContent');
  await set('inHeight', 180);
  await new Promise((r) => setTimeout(r, 400));
  const kvAfter = await c.evalJs('document.getElementById("efKv").textContent');
  check('改身高后 LVM/BSA 联动重算', kvBefore !== kvAfter,
    kvBefore.slice(0, 40) + ' → ' + kvAfter.slice(0, 40));
  await set('inHeight', 170);
  await new Promise((r) => setTimeout(r, 300));
  // EF 结果卡片里的「与下方参考值对照」按钮
  check('结果卡片含跳转参考值按钮',
    (await c.evalJs('!!document.getElementById("jumpRef")')) === true);

  // ── 参考值部分 ──
  const refRows = await c.evalJs('document.querySelectorAll("#refList > *").length');
  check('参考值列表已渲染', refRows > 20, refRows + ' 行');
  // 每行参数名须为「中文名（英文缩写）」
  const refAbbr = await c.evalJs(
    '[...document.querySelectorAll("#refList .list-row__n")].filter(function(e){' +
    'return /\uff08[A-Za-z]/.test(e.textContent);}).length');
  check('参考值行均带英文缩写', refAbbr === 37, refAbbr + ' / 37 行');
  const refSample = await c.evalJs(
    '[...document.querySelectorAll("#refList .list-row__n")]' +
    '.map(function(e){return e.textContent;}).join(" ｜ ")');
  check('缩写形如「左室舒张末期内径（LVEDD）」',
    refSample.indexOf('（LVEDD）') !== -1 && refSample.indexOf('（LVEF）') !== -1,
    refSample.slice(0, 96));
  const bsa1 = await c.evalJs('document.getElementById("outBsa").textContent');
  check('BSA 已计算（170/65）', /^[\d.]+\s*m/.test(bsa1) || /\d\.\d+/.test(bsa1), bsa1);
  // 切换性别
  await c.evalJs('document.querySelector(\'[data-seg="sex"] [data-v="female"]\').click()');
  await new Promise((r) => setTimeout(r, 300));
  const sexOn = await c.evalJs(
    'document.querySelector(\'[data-seg="sex"] .seg__i--on\').dataset.v');
  check('可切换到女性标准', sexOn === 'female', sexOn);
  await c.evalJs('document.querySelector(\'[data-seg="sex"] [data-v="male"]\').click()');
  // 切换参考标准 CN/ASE
  await c.evalJs('document.querySelector(\'[data-seg="standard"] [data-v="ASE"]\').click()');
  await new Promise((r) => setTimeout(r, 300));
  check('可切换到 ASE 标准',
    (await c.evalJs('document.getElementById("stdNote").textContent')).indexOf('ASE') !== -1);
  await c.evalJs('document.querySelector(\'[data-seg="standard"] [data-v="CN"]\').click()');


  console.log('\n【三】Tab2 儿童 Z 值');
  await c.evalJs('document.querySelector(\'.tab[data-tab="peds"]\').click()');
  await new Promise((r) => setTimeout(r, 400));
  check('切到儿童页后 page-peds 可见',
    (await c.evalJs('!document.getElementById("page-peds").hidden')) === true);
  const zInputs = await c.evalJs('document.querySelectorAll("#pdInputs input").length');
  check('儿童 Z 值输入项已生成', zInputs > 3, zInputs + ' 项');
  // 录入身高体重年龄
  await set('pdHeight', 110); await set('pdWeight', 19); await set('pdAge', 5);
  await new Promise((r) => setTimeout(r, 600));
  const zRows = await c.evalJs('document.querySelectorAll("#pdList > *").length');
  check('Z 值结果行已渲染', zRows > 3, zRows + ' 行');
  // 儿童 Z 值行同样须带英文缩写
  const zAbbr = await c.evalJs(
    '[...document.querySelectorAll("#pdList .zrow__n")].filter(function(e){' +
    'return /\uff08[A-Za-z]/.test(e.textContent);}).length');
  check('Z 值行均带英文缩写', zAbbr === 33, zAbbr + ' / 33 行');
  const pdBsa = await c.evalJs('document.getElementById("pdBsa").textContent');
  check('儿童 BSA 已算出', pdBsa && /\d\.\d+/.test(pdBsa), pdBsa);

  console.log('\n【三·五】延展阅读与参考文献（已随公式集页移出发布版）');
  await c.evalJs('document.querySelector(\'.tab[data-tab="index"]\').click()');
  await new Promise((r) => setTimeout(r, 300));
  // 延展阅读与参考文献现在位于「公式集」页，而公式集属于转载/扩展内容，
  // 发布版（GitHub Pages）在构建阶段已整页剥离，这里验证剥离干净即可。
  const extGone = await c.evalJs('document.getElementById("extLinks") === null');
  check('发布版已无延展阅读卡片（随公式集页剥离）', extGone, true);
  const refGone = await c.evalJs('document.getElementById("calcRefs") === null');
  check('发布版已无参考文献区（随公式集页剥离）', refGone, true);
  const noExtra = await c.evalJs('typeof window.ExtraData === "undefined"');
  check('发布版已剔除评估内容数据 ExtraData', noExtra, true);
  const homeVer = await c.evalJs('document.querySelector("#page-index .verline") ? 1 : 0');
  check('首页显示版本行', homeVer === 1, homeVer);
  const verText = await c.evalJs('(document.querySelector("#page-index .verline") || {}).textContent || ""');
  check('版本号已递增（非 1.0.0）', /v1\.0\.[1-9]/.test(verText), verText);

  console.log('\n【四】控制台');
  const errs = c.logs.filter((l) => l.indexOf('EXCEPTION') === 0 ||
    l.indexOf('[console.error') === 0);
  check('无 JS 异常', errs.length === 0, errs.join(' | '));

  console.log('\n════════ 汇总 ════════');
  const pass = results.filter((r) => r.ok).length;
  console.log('通过 ' + pass + ' / ' + results.length);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log('失败项：');
    failed.forEach((f) => console.log('  - ' + f.name + '  ' + f.detail));
  }

  ws.close();
  chrome.kill();
  try { fs.rmSync(ud, { recursive: true, force: true }); }
  catch (e) { /* Windows 下 Chrome 可能尚未释放临时文件，忽略 */ }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('测试异常：' + e.message);
  chrome.kill();
  process.exit(1);
});
