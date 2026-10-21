// 用 Chrome DevTools Protocol 实测发布版四页签（EF·参考值 / 节段划分 / 儿童 Z 值 / 公式集）
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
  check('页签数 = 4',
    (await c.evalJs('document.querySelectorAll(".tab").length')) === 4);
  const tabNames = await c.evalJs(
    '[...document.querySelectorAll(".tab")].map(e=>e.dataset.tab).join(",")');
  check('页签顺序 index,segments,peds,calc', tabNames === 'index,segments,peds,calc', tabNames);
  check('页面容器 4 个（无 ef/valves）',
    (await c.evalJs('document.querySelectorAll(".page").length')) === 4);
  check('Core 引擎已挂载', (await c.evalJs('typeof window.Core === "object"')) === true);
  check('Peds 引擎已挂载', (await c.evalJs('typeof window.Peds === "object"')) === true);
  check('Calc 引擎已挂载（公式集需要）', (await c.evalJs('typeof window.Calc')) === 'object');
  check('ExtraData 评估内容已挂载', (await c.evalJs('typeof window.ExtraData')) === 'object');
  check('ValveCalc 引擎已移除', (await c.evalJs('typeof window.ValveCalc')) === 'undefined');
  check('SegSvg 引擎已挂载（节段划分页需要）',
    (await c.evalJs('typeof window.SegSvg')) === 'object');

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


  console.log('\n【三】Tab3 儿童 Z 值');
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

  console.log('\n【三·二】节段划分页（室壁划分，APK 也打这一份）');
  await c.evalJs('document.querySelector(\'.tab[data-tab="segments"]\').click()');
  await new Promise((r) => setTimeout(r, 600));
  check('切到节段页后 page-segments 可见',
    (await c.evalJs('!document.getElementById("page-segments").hidden')) === true);
  const segInfo = await c.evalJs(`(function(){
    return JSON.stringify({
      bullSvg: document.querySelectorAll('#bullseyeBox svg').length,
      bullSegs: document.querySelectorAll('#bullseyeBox g[data-seg]').length,
      wallSvgs: [].slice.call(document.querySelectorAll('.wallsvg-box'))
        .map(function(e){return e.querySelectorAll('svg').length;})
        .filter(function(n){return n>0;}).length,
      wallBoxes: document.querySelectorAll('.wallsvg-box').length,
      terrChips: document.querySelectorAll('.terr-chip').length,
      segChips: document.querySelectorAll('.segchip').length,
      btnZoom: document.querySelectorAll('#page-segments [data-selseg]').length
    });
  })()`);
  const si = JSON.parse(segInfo);
  check('牛眼图 SVG 已绘制', si.bullSvg >= 1, segInfo);
  check('牛眼图含 17 个可点节段', si.bullSegs === 17, si.bullSegs);
  check('7 张切面示意图全部绘制', si.wallBoxes === 7 && si.wallSvgs === 7, segInfo);
  check('供血分区按钮 3 个', si.terrChips === 3, si.terrChips);
  check('节段数字按钮 ≥ 17', si.segChips >= 17, si.segChips);

  // 点分区 → 高亮提示行出现
  await c.evalJs('document.querySelector(\'#page-segments .terr-chip\').click()');
  await new Promise((r) => setTimeout(r, 300));
  check('点供血分区后高亮提示行可见',
    (await c.evalJs('!document.getElementById("segHiLine").hidden')) === true);

  // 点牛眼图里的节段 → 选中信息行出现
  await c.evalJs('document.querySelector(\'#bullseyeBox g[data-seg="7"]\').dispatchEvent(' +
    'new MouseEvent("click",{bubbles:true}))');
  await new Promise((r) => setTimeout(r, 300));
  const selInfo = await c.evalJs(`(function(){
    var box=document.getElementById('segSelInfo');
    return JSON.stringify({shown: !box.hidden, txt: box.textContent.replace(/\\s+/g,' ').slice(0,60)});
  })()`);
  const sel = JSON.parse(selInfo);
  check('点节段 7 后选中信息行可见', sel.shown === true, selInfo);
  check('选中信息含节段名与供血冠脉', /段/.test(sel.txt) && /LAD|LCx|RCA/.test(sel.txt), sel.txt);

  console.log('\n【三·五】公式集（发布版第四页）');
  await c.evalJs('document.querySelector(\'.tab[data-tab="index"]\').click()');
  await new Promise((r) => setTimeout(r, 250));
  await c.evalJs('document.querySelector(\'.tab[data-tab="calc"]\').click()');
  await new Promise((r) => setTimeout(r, 600));

  const info = await c.evalJs(`(function(){
    var idx=document.getElementById('calcIndex');
    if (!idx) return 'MISSING';
    return JSON.stringify({
      visible: !document.getElementById('page-calc').hidden,
      groups: [...idx.querySelectorAll('.fx-group')].map(function(e){return e.textContent;}),
      items: idx.querySelectorAll('.fx-item').length,
      links: idx.querySelectorAll('a.fx-item').length,
      valve: idx.querySelectorAll('.fx-item[data-kind="valve"]').length,
      album: idx.querySelectorAll('.fx-item[data-kind="album"]').length,
      albumTxt: (idx.querySelector('.fx-item[data-kind="album"]') || {}).textContent || '',
      search: !!document.getElementById('fxSearch'),
      albumView: !!document.getElementById('calcAlbum'),
      refs: document.querySelectorAll('#calcRefList .ref-item').length,
      ext: !!document.getElementById('extLinks'),
      media: idx.querySelectorAll('img, iframe, video').length,
      href: (document.querySelector('#calcList a.fx-item') || {}).getAttribute
        ? document.querySelector('#calcList a.fx-item').getAttribute('href') : ''
    });
  })()`);

  if (info === 'MISSING') {
    check('发布版含公式集页', false, '未找到 #calcIndex');
  } else {
    const d = JSON.parse(info);
    check('发布版含公式集页且默认可见', d.visible, true);
    check('公式集分组 = 6 个计算组 + 瓣膜 + 10 组评估 + 2 组外链',
      d.groups.join('|') === '血流动力学与心功能|右心与肺循环|瓣膜与舒张定量|重构与心肌功能|评分与室壁运动|介入尺寸与先心|瓣膜评估|器械支持|心腔与应变|心肌病变|大血管与急症|先天性心脏病|先心病术后残余病变|负荷与功能试验|介入 TEE 评估|造影与特殊检查|报告与质控|切面学习（视频）|TEE 模拟器',
      d.groups.join('|'));
    check('条目 109 条（57 计算 − 5 瓣膜计算器 + 9 瓣膜 + 39 评估 + 9 外链）', d.items === 109, d.items);
    check('外链 <a> 条目 8 条（切面指南已并入参考文献）', d.links === 8, d.links);
    check('操作规范专辑入口 1 条且显示 25 段', d.album === 1 && /25/.test(d.albumTxt), d.album + ' / ' + d.albumTxt);
    check('公式集目录带搜索框', d.search, true);
    check('专辑二级视图容器存在', d.albumView, true);
    check('外链为新窗口链接', (d.href || '').indexOf('https://') === 0, d.href);
    check('切面条目不加载图片/iframe/视频（省内存）', d.media === 0, d.media);
    check('发布版不列瓣膜计算器（无瓣膜页）', d.valve === 0, d.valve);
    check('参考文献 51 条', d.refs === 51, d.refs);
    check('延展阅读卡片在公式集页', d.ext, true);
  }

  // ── v1.2.4 新增计算器：端到端点开 + 填值 + 读结果 ──
  console.log('\n【三·b】新增计算器端到端（右心 / 瓣膜 / 舒张 / 重构）');
  const backToList = async () => {
    await c.evalJs(`(function(){var b=document.getElementById('calcBack'); if(b) b.click();})()`);
    await new Promise((r) => setTimeout(r, 200));
  };
  const openCalc = async (id) => {
    await backToList();
    await c.evalJs(`(function(){
      var e=document.querySelector('#calcList .fx-item[data-kind="calc"][data-id="${id}"]');
      if(e) e.click();
    })()`);
    await new Promise((r) => setTimeout(r, 250));
  };
  const fillCalc = async (gid, key, val) => {
    await c.evalJs(`(function(){
      var box=document.querySelector('#calcGroups .card[data-g="${gid}"]');
      var i=box&&box.querySelector('input[data-ck="${key}"]');
      if(i){i.value="${val}";i.dispatchEvent(new Event('input',{bubbles:true}));}
    })()`);
  };
  const outOf = async (gid) => await c.evalJs(
    `(document.querySelector('#calcOut-${gid} .calc-out__v')||{}).textContent||''`);

  // 目录里能看到 4 个新计算组
  const newGroupTitles = await c.evalJs(
    `[].slice.call(document.querySelectorAll('#calcList .fx-group')).map(function(e){return e.textContent;}).join('|')`);
  check('目录出现 4 个计算组',
    ['右心与肺循环', '瓣膜与舒张定量', '重构与心肌功能'].every((t) => newGroupTitles.indexOf(t) !== -1),
    newGroupTitles);

  await openCalc('paspv');
  await fillCalc('paspv', 'ptrv', '3.0');
  await fillCalc('paspv', 'prap', '8');
  await new Promise((r) => setTimeout(r, 300));
  let o = await outOf('paspv');
  check('PASP 3.0 + 8 → 44 mmHg 轻度', /44/.test(o) && /轻度/.test(o), o);

  await openCalc('pvrv');
  await fillCalc('pvrv', 'hmmpap', '45');
  await fillCalc('pvrv', 'hmpawp', '12');
  await fillCalc('pvrv', 'hmco', '5');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('pvrv');
  check('PVR 33/5 → 6.6 WU 重度', /6\.6/.test(o) && /重度/.test(o), o);

  await openCalc('pisav');
  await fillCalc('pisav', 'prad', '0.8');
  await fillCalc('pisav', 'pvmax', '5.0');
  await fillCalc('pisav', 'pvti', '150');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('pisav');
  check('PISA r=0.8 → EROA 0.32 / RVol 48', /0\.32/.test(o) && /48/.test(o), o);

  await openCalc('dfun');
  await fillCalc('dfun', 'dfe', '80');
  await fillCalc('dfun', 'dfa', '60');
  await fillCalc('dfun', 'dfes', '10');
  await fillCalc('dfun', 'dfel', '14');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('dfun');
  check('舒张四步法 E/A 1.33 → 正常充盈', /1\.33/.test(o) && /正常充盈/.test(o), o);

  await openCalc('rwsv');
  await fillCalc('rwsv', 'rsbp', '140');
  await fillCalc('rwsv', 'rlvedd', '5.5');
  await fillCalc('rwsv', 'rpwt', '1.1');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('rwsv');
  check('RWS 140/5.5/1.1 → 195', /195/.test(o), o);

  await openCalc('lastrain');
  await fillCalc('lastrain', 'lsr', '30');
  await fillCalc('lastrain', 'lscd', '18');
  await fillCalc('lastrain', 'lsct', '12');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('lastrain');
  check('左房应变三值自洽', /LASr/.test(o) && /自洽/.test(o), o);

  // ── v1.2.8 新增两组：评分与室壁运动 / 介入尺寸与先心 ──
  check('目录出现「评分与室壁运动」「介入尺寸与先心」两组',
    newGroupTitles.indexOf('评分与室壁运动') !== -1 &&
    newGroupTitles.indexOf('介入尺寸与先心') !== -1, newGroupTitles);

  // 选项组点击（性别 / 心律 / 节段总数 …）
  const pickOpt = async (gid, key, val) => {
    await c.evalJs(`(function(){
      var box=document.querySelector('#calcGroups .card[data-g="${gid}"]');
      var seg=box&&box.querySelector('.seg[data-opt="${key}"]');
      var it=seg&&seg.querySelector('.seg__i[data-v="${val}"]');
      if(it) it.click();
    })()`);
    await new Promise((r) => setTimeout(r, 200));
  };

  await openCalc('mtype');
  await fillCalc('mtype', 'mtdd', '50');
  await fillCalc('mtype', 'mtds', '32');
  await fillCalc('mtype', 'mtepss', '8');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('mtype');
  check('M 型 50/32 → FS 36% / Teichholz EF 65.4%',
    /FS 36\.0%/.test(o) && /EF 65\.4%/.test(o), o);
  check('M 型 EPSS 8 判增大', /EPSS/.test(o) && /增大/.test(o), o);

  await openCalc('wmsi');
  await fillCalc('wmsi', 'wn1', '12');
  await fillCalc('wmsi', 'wn2', '3');
  await fillCalc('wmsi', 'wn3', '1');
  await fillCalc('wmsi', 'wn4', '1');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('wmsi');
  check('WMSI 25÷17 → 1.47 轻度', /1\.47/.test(o) && /轻度异常/.test(o), o);

  await openCalc('h2fpef');
  await pickOpt('h2fpef', 'haf', '1');
  await pickOpt('h2fpef', 'hbp', '1');
  await fillCalc('h2fpef', 'hbmi', '31');
  await fillCalc('h2fpef', 'hage', '65');
  await fillCalc('h2fpef', 'hee', '10');
  await fillCalc('h2fpef', 'hpasp', '40');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('h2fpef');
  check('H2FPEF 全阳性 → 9 分高可能', /9 分/.test(o) && /可能性高/.test(o), o);
  check('H2FPEF 列出计分项', /计分项/.test(o) && /心房颤动/.test(o), o);

  await openCalc('hfapeff');
  await fillCalc('hfapeff', 'hlavi', '42');
  await fillCalc('hfapeff', 'hee2', '16');
  await fillCalc('hfapeff', 'hbnp', '600');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('hfapeff');
  check('HFA-PEFF 三类相加 6 分', /6 分/.test(o) && /形态 2/.test(o), o);

  await openCalc('tavrsz');
  await fillCalc('tavrsz', 'tcirc', '75');
  await fillCalc('tavrsz', 'tarea', '420');
  await fillCalc('tavrsz', 'tnom', '26');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('tavrsz');
  check('TAVR 周长 75 → 导出 23.9mm、oversizing 26.4%',
    /23\.9/.test(o) && /26\.4%/.test(o), o);

  await openCalc('laasz');
  await fillCalc('laasz', 'lzmax', '24');
  await fillCalc('laasz', 'lzmin', '19');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('laasz');
  check('LAA 24mm → 推荐 27mm', /27 mm/.test(o), o);

  // ── v1.2.9 第二批：右心与肺循环 ──
  await openCalc('papi');
  await fillCalc('papi', 'pispap', '40');
  await fillCalc('papi', 'pidpap', '20');
  await fillCalc('papi', 'pirap', '15');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('papi');
  check('PAPi (40−20)/15 → 1.33 失耦联', /1\.33/.test(o) && /失耦联/.test(o), o);

  await openCalc('rvdvdt');
  await fillCalc('rvdvdt', 'rdt', '25');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('rvdvdt');
  check('RV dP/dt Δt25 → 480 mmHg/s', /480/.test(o), o);

  await openCalc('residx');
  await fillCalc('residx', 'ripvr', '6');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('residx');
  check('PVRI 6 WU × BSA → 指数化结果', /PVRI 1[0-9]\./.test(o), o);

  // ── v1.3.0 第三批：瓣膜与舒张细节 ──
  await openCalc('wilkins');
  await fillCalc('wilkins', 'wk1', '2');
  await fillCalc('wilkins', 'wk2', '2');
  await fillCalc('wilkins', 'wk3', '2');
  await fillCalc('wilkins', 'wk4', '2');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('wilkins');
  check('Wilkins 四面 2 分 → 8 分适合 PBMV', /8/.test(o) && /PBMV/.test(o), o);

  await openCalc('vcw');
  await fillCalc('vcw', 'vcwv', '4');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('vcw');
  check('VCW 4mm（MR 默认）→ 中度', /MR/.test(o) && /中度/.test(o), o);
  await fillCalc('vcw', 'vcwv', '6');
  await pickOpt('vcw', 'vsite', 'ar');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('vcw');
  check('VCW 6mm 切到 AR → 判重度', /AR/.test(o) && /重度/.test(o), o);

  await openCalc('rf');
  await fillCalc('rf', 'rfvol', '60');
  await fillCalc('rf', 'rfsv', '86');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('rf');
  check('RF 60/86 → 69.8% 重度', /69\.8%/.test(o) && /重度/.test(o), o);

  await openCalc('mva');
  await fillCalc('mva', 'mvd', '2.0');
  await fillCalc('mva', 'mvlvti', '20');
  await fillCalc('mva', 'mvmvti', '8');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('mva');
  check('MVA 连续性方程 2.0/20/8 → 7.85', /7\.85/.test(o), o);

  await openCalc('laef');
  await fillCalc('laef', 'lavmax', '80');
  await fillCalc('laef', 'lavmin', '40');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('laef');
  check('LAEF 80/40 → 50% 保留', /50\.0%/.test(o) && /保留/.test(o), o);

  await openCalc('quickratio');
  await fillCalc('quickratio', 'qla', '40');
  await fillCalc('quickratio', 'qao', '32');
  await fillCalc('quickratio', 'qrv', '40');
  await fillCalc('quickratio', 'qlv', '50');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('quickratio');
  check('LA/Ao 1.25 增大 / RV/LV 0.80 扩大',
    /1\.25/.test(o) && /0\.80/.test(o) && /扩大/.test(o), o);

  await openCalc('lvmih');
  await fillCalc('lvmih', 'lhmass', '200');
  await fillCalc('lvmih', 'lhheight', '170');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('lvmih');
  check('LVMI 身高^2.7 200/170 → 47.7', /47\.7/.test(o), o);

  // ── v1.3.0 第四批：先心 / 心肌 / 耦联 ──
  await openCalc('paidx');
  await fillCalc('paidx', 'prpa', '10');
  await fillCalc('paidx', 'plpa', '10');
  await fillCalc('paidx', 'pdao', '12');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('paidx');
  check('McGoon 1.67 判发育不足', /1\.67/.test(o) && /不足/.test(o), o);

  await openCalc('ras');
  await fillCalc('ras', 'rasap', '-18');
  await fillCalc('ras', 'rasba', '-9');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('ras');
  check('RAS 2.00 存在心尖保留', /2\.00/.test(o) && /心尖保留/.test(o), o);

  await openCalc('ea');
  await fillCalc('ea', 'eaesp', '100');
  await fillCalc('ea', 'easv', '70');
  await fillCalc('ea', 'eaesv', '50');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('ea');
  check('Ea 1.43 / Ees-Ea 1.40', /1\.43/.test(o) && /1\.40/.test(o), o);

  await openCalc('coa');
  await fillCalc('coa', 'coav', '3.2');
  await fillCalc('coa', 'coaved', '1.2');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('coa');
  check('CoA 3.2 m/s → 41 mmHg + 拖尾征', /41/.test(o) && /拖尾征/.test(o), o);

  // ── v1.3.1 成人主动脉分节段 Z 值 ──
  await openCalc('aortaz');
  await fillCalc('aortaz', 'azann', '26');
  await fillCalc('aortaz', 'azsin', '42');
  await fillCalc('aortaz', 'azstj', '29');
  await fillCalc('aortaz', 'azasc', '38');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('aortaz');
  check('主动脉四段 Z 值 + 最大 Z 3.9 显著扩张',
    /窦部 Z 3\.9/.test(o) && /显著扩张/.test(o), o);
  check('主动脉 Z 值附带参考区间', /参考 3–3\.8 cm/.test(o), o);
  await pickOpt('aortaz', 'azsex', 'f');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('aortaz');
  check('切女性后参考区间随之变化（2.7–3.5）', /参考 2\.7–3\.5 cm/.test(o), o);

  await openCalc('paspv'); // 收尾回到列表
  await backToList();

  // 详情视图在发布版仍可用
  await c.evalJs(`(function(){
    var e=[].slice.call(document.querySelectorAll('#calcList .fx-item'))
      .filter(function(x){return /CRT 同步化/.test(x.textContent);});
    if (e[0]) e[0].click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));
  const det = await c.evalJs(`(function(){
    var v=[].slice.call(document.querySelectorAll('#calcGroups > .card'))
      .filter(function(c){return !c.hidden;}).map(function(c){return c.dataset.g;});
    return JSON.stringify({g: v, tbl: document.querySelectorAll(
      '#calcGroups > .card:not([hidden]) .fx-tbl').length});
  })()`);
  const dd = JSON.parse(det);
  check('发布版可打开评估类详情（CRT）', dd.g[0] === 'crt', det);
  check('详情内表格已渲染', dd.tbl >= 2, dd.tbl);

  // 判读页 ↔ 计算器桥接：主动脉页末块指向公式集
  await c.evalJs('(function(){var b=document.getElementById("calcBack");if(b)b.click();return 1;})()');
  await new Promise((r) => setTimeout(r, 300));
  await c.evalJs(`(function(){
    var e=[].slice.call(document.querySelectorAll('#calcList .fx-item'))
      .filter(function(x){return /主动脉疾病/.test(x.textContent);});
    if (e[0]) e[0].click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));
  const bridgeTxt = await c.evalJs(`(function(){
    var card=document.querySelector('#calcGroups > .card:not([hidden])');
    if(!card) return '';
    var ps=card.querySelectorAll('p, .fx-note');
    return ps.length? ps[ps.length-1].textContent : card.textContent.slice(-300);
  })()`);
  check('主动脉判读页末段为「相关计算（通用量）」', /相关计算（通用量）/.test(bridgeTxt), bridgeTxt.slice(0, 120));
  check('桥接指向「主动脉分节段 Z 值」', /主动脉分节段 Z 值/.test(bridgeTxt), bridgeTxt.slice(0, 160));

  // ── 参考文献：默认折叠，点标题才展开全部（40 条平铺会把目录拉得极长）──
  await c.evalJs('(function(){var b=document.getElementById("calcBack");if(b)b.click();return 1;})()');
  const refsInit = await c.evalJs(`(function(){
    var l = document.getElementById('calcRefList');
    var hd = document.getElementById('refsToggle');
    return JSON.stringify({
      hidden: !!l.hidden,
      h: l.offsetHeight,
      n: l.querySelectorAll('.ref-item').length,
      cnt: (document.getElementById('refsCount') || {}).textContent || '',
      aria: hd ? hd.getAttribute('aria-expanded') : '',
      open: hd ? hd.classList.contains('refs-hd--open') : null
    });
  })()`);
  const ri = JSON.parse(refsInit);
  check('参考文献默认折叠（列表隐藏、高度 0）', ri.hidden === true && ri.h === 0, refsInit);
  check('折叠头显示 51 条', /51/.test(ri.cnt), refsInit);
  check('折叠头 aria-expanded=false、无 open 类',
    ri.aria === 'false' && ri.open === false, refsInit);

  await c.evalJs('(function(){document.getElementById("refsToggle").click();return 1;})()');
  const refsOpen = await c.evalJs(`(function(){
    var l = document.getElementById('calcRefList');
    var hd = document.getElementById('refsToggle');
    return JSON.stringify({
      hidden: !!l.hidden,
      h: l.offsetHeight,
      n: l.querySelectorAll('.ref-item').length,
      aria: hd.getAttribute('aria-expanded'),
      open: hd.classList.contains('refs-hd--open'),
      first: (l.querySelector('.ref-item__zh') || {}).textContent || ''
    });
  })()`);
  const ro = JSON.parse(refsOpen);
  check('点击后展开全部 51 条', ro.hidden === false && ro.n === 51 && ro.h > 0, refsOpen);
  check('展开后箭头状态与 aria 同步', ro.aria === 'true' && ro.open === true, refsOpen);
  check('展开后首条为 R1 中文标题', /指南|超声/.test(ro.first), refsOpen);

  await c.evalJs('(function(){document.getElementById("refsToggle").click();return 1;})()');
  const refsAgain = await c.evalJs(
    'JSON.stringify({hidden: !!document.getElementById("calcRefList").hidden})');
  check('再点一次可收起', JSON.parse(refsAgain).hidden === true, refsAgain);

  // 转载内容仍应剥离干净；节段划分页（自有内容）已回归发布版
  const stripped = await c.evalJs(`(function(){
    return JSON.stringify({
      valvePage: !!document.getElementById('page-valves'),
      segPage: !!document.getElementById('page-segments'),
      valveEngine: typeof window.ValveCalc,
      segEngine: typeof window.SegSvg
    });
  })()`);
  const st = JSON.parse(stripped);
  check('发布版已剥离瓣膜页', st.valvePage === false, stripped);
  check('发布版保留节段划分页', st.segPage === true, stripped);
  check('发布版已剥离 ValveCalc、保留 SegSvg',
    st.valveEngine === 'undefined' && st.segEngine === 'object', stripped);

  const homeVer = await c.evalJs('document.querySelector("#page-index .verline") ? 1 : 0');
  check('首页显示版本行', homeVer === 1, homeVer);
  const verText = await c.evalJs('(document.querySelector("#page-index .verline") || {}).textContent || ""');
  check('版本号已递增（非 1.0.0）', /v\d+\.\d+\.\d+/.test(verText) && !/v1\.0\.0/.test(verText), verText);

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
