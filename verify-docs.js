// 用 Chrome DevTools Protocol 实测发布版三页签：切页 + 计算 + 控制台报错
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILE = 'file:///<project-directory>/docs/index.html';
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
  check('页签数 = 3',
    (await c.evalJs('document.querySelectorAll(".tab").length')) === 3);
  const tabNames = await c.evalJs(
    '[...document.querySelectorAll(".tab")].map(e=>e.dataset.tab).join(",")');
  check('页签顺序 index,ef,peds', tabNames === 'index,ef,peds', tabNames);
  check('页面容器 3 个（无 calc/valves/segments）',
    (await c.evalJs('document.querySelectorAll(".page").length')) === 3);
  check('Core 引擎已挂载', (await c.evalJs('typeof window.Core === "object"')) === true);
  check('Peds 引擎已挂载', (await c.evalJs('typeof window.Peds === "object"')) === true);
  check('Calc 引擎已移除', (await c.evalJs('typeof window.Calc')) === 'undefined');
  check('ValveCalc 引擎已移除', (await c.evalJs('typeof window.ValveCalc')) === 'undefined');
  check('SegSvg 引擎已移除', (await c.evalJs('typeof window.SegSvg')) === 'undefined');

  console.log('\n【二】Tab1 参数·参考值');
  // 通用：给输入框赋值并触发 input
  const set = async (id, v) => {
    await c.evalJs(
      '(function(){var e=document.getElementById("' + id + '");' +
      'e.value="' + v + '";e.dispatchEvent(new Event("input",{bubbles:true}));})()'
    );
  };
  check('page-index 默认可见',
    (await c.evalJs('!document.getElementById("page-index").hidden')) === true);
  const refRows = await c.evalJs('document.querySelectorAll("#refList > *").length');
  check('参考值列表已渲染', refRows > 20, refRows + ' 行');
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

  console.log('\n【三】Tab2 EF 计算');
  await c.evalJs('document.querySelector(\'.tab[data-tab="ef"]\').click()');
  await new Promise((r) => setTimeout(r, 400));
  check('切到 EF 页后 page-ef 可见',
    (await c.evalJs('!document.getElementById("page-ef").hidden')) === true);
  check('顶栏标题已切换',
    (await c.evalJs('document.getElementById("appbarTitle").textContent')) === 'EF 计算');
  // 录入 LVEDD 50 / LVESD 32 / IVSD 9 / LVPWD 9
  await set('efLvedd', 50); await set('efLvesd', 32);
  await set('efIvsd', 9);   await set('efLvpwd', 9);
  await new Promise((r) => setTimeout(r, 600));
  const ef = await c.evalJs('document.getElementById("efResult").textContent');
  check('EF 结果已输出（内容非空）', ef && ef.trim().length > 0);
  // 从「射血分数 65.4%」里取数字
  const efM = (ef || '').match(/射血分数\s*([\d.]+)\s*%/);
  const efNum = efM ? parseFloat(efM[1]) : NaN;
  check('EF 落在合理区间(50–70%)', efNum > 50 && efNum < 70, efNum + '%');
  check('EF 结论为「正常」', (ef || '').indexOf('正常') !== -1);
  const efGrade = await c.evalJs('document.getElementById("efGrade").textContent');
  check('EF 分级已输出', efGrade && efGrade.trim().length > 0, efGrade);

  console.log('\n【四】Tab3 儿童 Z 值');
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
  const pdBsa = await c.evalJs('document.getElementById("pdBsa").textContent');
  check('儿童 BSA 已算出', pdBsa && /\d\.\d+/.test(pdBsa), pdBsa);

  console.log('\n【五】控制台');
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
  fs.rmSync(ud, { recursive: true, force: true });
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('测试异常：' + e.message);
  chrome.kill();
  process.exit(1);
});
