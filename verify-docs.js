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
  // ★ 用户 2026-10-24：底部页签精简为 4 个，与小程序统一；
  //   瓣膜评估与瓣膜解剖都进了公式集，不再是页签
  check('页签数 = 4',
    (await c.evalJs('document.querySelectorAll(".tab").length')) === 4);
  const tabNames = await c.evalJs(
    '[...document.querySelectorAll(".tab")].map(e=>e.dataset.tab).join(",")');
  check('页签顺序 index,peds,segments,calc',
    tabNames === 'index,peds,segments,calc', tabNames);
  check('页面容器 4 个（无 valves / valveana）',
    (await c.evalJs('document.querySelectorAll(".page").length')) === 4);
  check('不再有独立瓣膜评估页 / 瓣膜解剖页',
    (await c.evalJs('!document.getElementById("page-valves") && !document.getElementById("page-valveana")')) === true);
  check('Core 引擎已挂载', (await c.evalJs('typeof window.Core === "object"')) === true);
  check('Peds 引擎已挂载', (await c.evalJs('typeof window.Peds === "object"')) === true);
  check('Calc 引擎已挂载（公式集需要）', (await c.evalJs('typeof window.Calc')) === 'object');
  check('ExtraData 评估内容已挂载', (await c.evalJs('typeof window.ExtraData')) === 'object');
  // v1.4.1：AS/AR/MS/MR/TR 成了公式集里的普通计算条目，ValveCalc 引擎必须留着
  check('ValveCalc 引擎已挂载（瓣膜计算条目需要）', (await c.evalJs('typeof window.ValveCalc')) === 'object');
  check('SegSvg 引擎已挂载（节段划分页需要）',
    (await c.evalJs('typeof window.SegSvg')) === 'object');
  check('ValveSvg 引擎已挂载（公式集瓣膜解剖条目需要）',
    (await c.evalJs('typeof window.ValveSvg')) === 'object');

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

  // ── 室壁厚度选填（v1.9.4）：清空后仍出 EF/FS，但不出现 RWT 与左室质量 ──
  await set('efIvsd', ''); await set('efLvpwd', '');
  await new Promise((r) => setTimeout(r, 500));
  const kvNoWall = await c.evalJs('document.getElementById("efKv").textContent');
  const hintNoWall = await c.evalJs('document.getElementById("efHint").textContent');
  check('清空室壁厚度后仍输出 EF / FS',
    kvNoWall.indexOf('射血分数') !== -1 && kvNoWall.indexOf('缩短分数') !== -1,
    kvNoWall.slice(0, 40));
  check('清空室壁厚度后不出 RWT / 左室质量',
    kvNoWall.indexOf('相对室壁厚度') === -1 && kvNoWall.indexOf('左室质量') === -1,
    'RWT ' + (kvNoWall.indexOf('相对室壁厚度') !== -1) +
    ' / LVM ' + (kvNoWall.indexOf('左室质量') !== -1));
  check('清空室壁厚度不报错', (hintNoWall || '').trim() === '', '「' + hintNoWall + '」');
  // ★ v1.9.5：收缩功能提到容积指标之前
  check('EF 指标排在容积指标之前',
    kvNoWall.indexOf('射血分数') !== -1 &&
    kvNoWall.indexOf('射血分数') < kvNoWall.indexOf('舒张末容积'),
    'EF@' + kvNoWall.indexOf('射血分数') + ' / EDV@' + kvNoWall.indexOf('舒张末容积'));
  const efNoWall = parseFloat((kvNoWall.match(/射血分数\s*([\d.]+)/) || [])[1]);
  check('只填空后 EF 数值不变', Math.abs(efNoWall - efNum) < 0.05,
    efNoWall + ' vs ' + efNum);
  // 恢复，避免影响后续参考值断言
  await set('efIvsd', 9); await set('efLvpwd', 9);
  await new Promise((r) => setTimeout(r, 400));

  // ── 参考值部分 ──
  const refRows = await c.evalJs('document.querySelectorAll("#refList > *").length');
  check('参考值列表已渲染', refRows > 20, refRows + ' 行');
  // 每行参数名须为「中文名（英文缩写）」
  const refAbbr = await c.evalJs(
    '[...document.querySelectorAll("#refList .list-row__n")].filter(function(e){' +
    'return /\uff08[A-Za-z]/.test(e.textContent);}).length');
  check('参考值行均带英文缩写', refAbbr === 64, refAbbr + ' / 64 行');
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
  check('Z 值行均带英文缩写', zAbbr === 40, zAbbr + ' / 40 行');

  // ★ 儿童页必须列出左房与右室（用户反馈：原来只有左室大小，其他房室没有）
  const pedsKamp = await c.evalJs(`(function(){
    var ns = [...document.querySelectorAll('#pdList .zrow__n')];
    var keys = ['LA4C', 'RA4C', 'RVIDd', 'RVIDs', 'LAAP', 'RVDD', 'RVAWd'];
    var hit = 0;
    ns.forEach(function (e) {
      keys.forEach(function (k) {
        if (e.textContent.indexOf('（' + k + '）') >= 0) hit++;
      });
    });
    return JSON.stringify({
      hit: hit,
      note: document.querySelectorAll('#pdList .pnote').length
    });
  })()`);
  const pk = JSON.parse(pedsKamp);
  check('儿童页列出左房与右室 7 项', pk.hit === 7, pedsKamp);
  // v1.8.0：冠脉组也加了「PHN / 深圳 SZ 双法」说明 → 两条 pnote
  check('左房与右心组 + 冠脉组各带一条来源说明', pk.note === 2, pedsKamp);

  // ★ 回归：内径的「均值」必须与「±2SD 范围」同量级
  //   v1.6.8 之前均值漏了 cm→mm 的 ×10，同一行出现「均值 2.0 mm」与「16.4–23.1 mm」
  const midMismatch = await c.evalJs(`(function(){
    var bad = [];
    [...document.querySelectorAll('#pdList .zrow')].forEach(function (r) {
      var sub = r.querySelector('.zrow__sub');
      var rg = r.querySelector('.zrow__r');
      if (!sub || !rg) return;
      // v1.8.0：SZ 行是对数尺度的乘性区间，中点本来就不等于均值，跳过
      var nm = r.querySelector('.zrow__n');
      if (nm && nm.textContent.indexOf('SZ 法') >= 0) return;
      var t = sub.textContent;
      var i = t.indexOf('均值');
      if (i < 0) return;
      var mid = parseFloat(t.slice(i + 2).trim().split(' ')[0]);
      var b = rg.textContent.split('–');
      if (b.length < 2) return;
      var lo = parseFloat(b[0]);
      var hi = parseFloat(b[1]);
      if (!isFinite(mid) || !isFinite(lo) || !isFinite(hi)) return;
      if (Math.abs((lo + hi) / 2 - mid) > 0.08) bad.push(mid + '|' + lo + '-' + hi);
    });
    return bad.join(';');
  })()`);
  check('每行均值与 ±2SD 区间同单位', midMismatch === '', midMismatch || '(全部一致)');

  // ±3SD 表默认折叠、只列 ±3SD（不再与主表重复 ±2SD）
  const rngInit = await c.evalJs('document.getElementById("pdRanges").hidden');
  check('±3SD 阈值表默认折叠', rngInit === true, String(rngInit));
  await c.evalJs('document.getElementById("pdRangesBtn").click()');
  await new Promise((r) => setTimeout(r, 200));
  const rngOpen = await c.evalJs(
    'JSON.stringify({h:document.getElementById("pdRanges").hidden,' +
    'n:document.querySelectorAll("#pdRanges .zrow").length,' +
    'has2:document.getElementById("pdRanges").textContent.indexOf("±2SD")>=0})');
  const ro3 = JSON.parse(rngOpen);
  // 40 项 + 冠脉 3 条 SZ 行（v1.8.0）= 43
  check('点开后展开 ±3SD 表（40 项 + 3 条 SZ 行）', ro3.h === false && ro3.n === 43, rngOpen);
  check('±3SD 表不再重复 ±2SD', ro3.has2 === false, rngOpen);
  await c.evalJs('document.getElementById("pdRangesBtn").click()');
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
      wallSvgs: [].slice.call(document.querySelectorAll('#page-segments .wallsvg-box'))
        .map(function(e){return e.querySelectorAll('svg').length;})
        .filter(function(n){return n>0;}).length,
      wallBoxes: document.querySelectorAll('#page-segments .wallsvg-box').length,
      terrChips: document.querySelectorAll('#page-segments .terr-chip').length,
      segChips: document.querySelectorAll('#page-segments .segchip').length,
      btnZoom: document.querySelectorAll('#page-segments [data-selseg]').length
    });
  })()`);
  const si = JSON.parse(segInfo);
  check('牛眼图 SVG 已绘制', si.bullSvg >= 1, segInfo);
  check('牛眼图含 17 个可点节段', si.bullSegs === 17, si.bullSegs);
  check('7 张切面示意图全部绘制', si.wallBoxes === 7 && si.wallSvgs === 7, segInfo);
  check('供血分区按钮 3 个', si.terrChips === 3, si.terrChips);
  check('节段数字按钮 ≥ 17', si.segChips >= 17, si.segChips);

  // PSAX 环带直接标壁名（用户 2026-10-28：不点数字看不出哪块是哪面壁）
  const psaxTxt = await c.evalJs(`(function(){
    var t=function(id){
      var b=document.getElementById(id);
      return b ? b.textContent.replace(/\\s+/g,'') : '';
    };
    return JSON.stringify({ b: t('wd-PSAX-B'), m: t('wd-PSAX-M'), a: t('wd-PSAX-A') });
  })()`);
  const px = JSON.parse(psaxTxt);
  check('PSAX 基底段环带标出壁名（前壁/前间隔/下壁/前侧壁）',
    ['前壁', '前间隔', '下壁', '前侧壁'].every(function (w) { return px.b.indexOf(w) >= 0; }), px.b);
  check('PSAX 中段环带标出壁名（下侧壁/前侧壁）',
    px.m.indexOf('下侧壁') >= 0 && px.m.indexOf('前侧壁') >= 0, px.m);
  check('PSAX 心尖段环带标出壁名（前壁/间隔/下壁/侧壁）',
    ['前壁', '间隔', '下壁', '侧壁'].every(function (w) { return px.a.indexOf(w) >= 0; }), px.a);

  // 四张图改成「带外引线标注」：编号胶囊 + 壁名画在图外侧，引线连回色带
  // （用户 2026-10-28：A4C/A2C/A3C/PLAX 也要直接看到壁名，不靠下面圆点对照）
  const calloutInfo = await c.evalJs(`(function(){
    var t=function(id){var b=document.getElementById(id);return b?b.textContent.replace(/\\s+/g,''):'';};
    var l=function(id){var b=document.getElementById(id);return b?b.querySelectorAll('svg .seg-lead').length:0;};
    return JSON.stringify({
      plax:t('wd-PLAX'), a4c:t('wd-A4C'), a2c:t('wd-A2C'), a3c:t('wd-A3C'),
      lead:[l('wd-PLAX'), l('wd-A4C'), l('wd-A2C'), l('wd-A3C')]
    });
  })()`);
  const co = JSON.parse(calloutInfo);
  check('四张图每条可见节段都带外引线（PLAX 4 / A4C 7 / A2C 7 / A3C 7）',
    co.lead[0] === 4 && co.lead[1] === 7 && co.lead[2] === 7 && co.lead[3] === 7, calloutInfo);
  check('PLAX 图外标出前间隔与下侧壁的基底/中段名',
    ['前间隔基底段', '前间隔中间段', '下侧壁基底段', '下侧壁中间段']
      .every(function (w) { return co.plax.indexOf(w) >= 0; }), co.plax);
  check('A4C 图外标出下间隔三段 + 前侧壁三段 + 心尖帽',
    ['下间隔基底段', '下间隔中间段', '间隔心尖段', '前侧壁基底段', '前侧壁中间段', '侧壁心尖段', '心尖帽']
      .every(function (w) { return co.a4c.indexOf(w) >= 0; }), co.a4c);
  check('A2C 图外标出下壁三段 + 前壁三段 + 心尖帽',
    ['下壁基底段', '下壁中间段', '下壁心尖段', '前壁基底段', '前壁中间段', '前壁心尖段', '心尖帽']
      .every(function (w) { return co.a2c.indexOf(w) >= 0; }), co.a2c);
  check('A3C 图外标出下侧壁三段 + 前间隔三段 + 心尖帽',
    ['下侧壁基底段', '下侧壁中间段', '侧壁心尖段', '前间隔基底段', '前间隔中间段', '间隔心尖段', '心尖帽']
      .every(function (w) { return co.a3c.indexOf(w) >= 0; }), co.a3c);

  // 小程序端靠坐标反算点图（image 挂不了 SVG 事件）：
  // 在真实色块内部撒点（Canvas Path2D 判定是否落在路径里），再让 hitSeg 反算，必须回到该段
  const hitInfo = await c.evalJs(`(function(){
    var cv=document.createElement('canvas'); cv.width=1; cv.height=1;
    var ctx=cv.getContext('2d');
    var bad=[], tested=0, empty=[], pts=0, missAll=0, wrongAll=0;
    ['PLAX','PSAX-B','PSAX-M','PSAX-A','A4C','A2C','A3C'].forEach(function(k){
      var box=document.getElementById('wd-'+k);
      if(!box){ bad.push(k+':no box'); return; }
      box.querySelectorAll('svg g[data-seg]').forEach(function(g){
        var ps=[].slice.call(g.querySelectorAll('path')).filter(function(q){ return (q.getAttribute('fill')||'none')!=='none'; });
        if(!ps.length) return;
        var p=ps[0], i=Number(g.getAttribute('data-seg'));
        var bb=p.getBBox(), path2d=new Path2D(p.getAttribute('d')), inside=0, wrong=0, miss=0;
        for(var u=0.05;u<1;u+=0.1){
          for(var v=0.05;v<1;v+=0.1){
            var x=bb.x+bb.width*u, y=bb.y+bb.height*v;
            if(!ctx.isPointInPath(path2d, x, y)) continue;
            inside++; pts++;
            var got=window.SegSvg.hitSeg(k, x, y);
            if(got!==i){ if(!got) miss++; else wrong++; }
          }
        }
        if(!inside){ empty.push(k+'#'+i); return; }
        tested++; missAll+=miss; wrongAll+=wrong;
        if(wrong) bad.push(k+'#'+i+':'+wrong+'/'+inside);
      });
    });
    var b=document.getElementById('bullseyeBox');
    if(b){ tested++; if(window.SegSvg.hitSeg('bull',200,200)!==17) bad.push('bull#17:1/1'); }
    return JSON.stringify({bad:bad, tested:tested, empty:empty, pts:pts, miss:missAll, wrong:wrongAll});
  })()`);
  const hitInfoObj = JSON.parse(hitInfo);
  // 落在两段分界线上的采样点有 ±1px 归属歧义，容许极少数（≤0.15%）
  check('坐标反算（小程序点图用）：色块内几乎不会被算成别的节段',
    hitInfoObj.tested >= 30 && hitInfoObj.wrong / hitInfoObj.pts <= 0.0015, hitInfo);
  check('坐标反算漏点率 < 3%（色块边缘的分隔缝可容忍）',
    hitInfoObj.miss / hitInfoObj.pts < 0.03, hitInfo);

  // 壁名统一：ASE/AHA 2002 的 inferolateral / anterolateral（R84）在国内通行译作「下侧壁 / 前侧壁」
  // （用户 2026-10-28：前外侧壁/下外侧壁 是国内少用的直译，全站不再混用）
  const wallAll = await c.evalJs(`(function(){
    var ids=['wd-PLAX','wd-PSAX-B','wd-PSAX-M','wd-PSAX-A','wd-A4C','wd-A2C','wd-A3C'];
    return ids.map(function(id){var b=document.getElementById(id);return b?b.textContent.replace(/\\s+/g,''):'';}).join('|');
  })()`);
  check('7 张图壁名统一：用下侧壁/前侧壁，不出现「外侧壁」',
    wallAll.indexOf('外侧壁') < 0 && wallAll.indexOf('下侧壁') >= 0 && wallAll.indexOf('前侧壁') >= 0, wallAll);

  // A3C：显示 5-11-16 与 2-8-14 + 心尖 17（依据 R86 的心尖长轴示意图）
  // ★ 右侧心尖段必须是 14（间隔心尖段），不是 13（前壁心尖段）—— 前壁走两腔心
  const a3cInfo = await c.evalJs(`(function(){
    var card=[].slice.call(document.querySelectorAll('#page-segments .wall-card')).filter(function(e){
      var t=e.querySelector('.wall-card__t');
      return t && t.textContent.indexOf('A3C') === 0;
    })[0];
    if(!card) return JSON.stringify({err:'no A3C card'});
    var note=card.querySelector('.wall-card__note');
    return JSON.stringify({
      rows: card.querySelectorAll('.wall-group').length,
      chips: [].slice.call(card.querySelectorAll('.segchip')).map(function(e){return e.textContent.trim();}),
      note: note ? note.textContent : ''
    });
  })()`);
  const a3 = JSON.parse(a3cInfo);
  check('A3C 卡片 3 组（下侧壁 / 前间隔 / 心尖 17）', a3.rows === 3, a3cInfo);
  check('A3C 含侧壁心尖段 16 与间隔心尖段 14、且不含前壁心尖段 13',
    (a3.chips || []).indexOf('16') >= 0 && (a3.chips || []).indexOf('14') >= 0 &&
      (a3.chips || []).indexOf('13') < 0, a3cInfo);
  check('A3C 心尖 17 可点', (a3.chips || []).indexOf('17') >= 0, a3cInfo);
  check('A3C 注明 R86 名称表与 R84 编号出处',
    (a3.note || '').indexOf('R86') >= 0 && (a3.note || '').indexOf('R84') >= 0, a3.note);

  // 点 A3C 的「17」→ 三张心尖图（A4C / A2C / A3C）同步高亮
  await c.evalJs(`(function(){
    var card=[].slice.call(document.querySelectorAll('#page-segments .wall-card')).filter(function(e){
      var t=e.querySelector('.wall-card__t');
      return t && t.textContent.indexOf('A3C') === 0;
    })[0];
    var chip=[].slice.call(card.querySelectorAll('.segchip')).filter(function(e){
      return e.textContent.trim() === '17';
    })[0];
    chip.click();
  })()`);
  await new Promise((r) => setTimeout(r, 400));
  check('点 A3C 的「17」后心尖 17 在三张图上同步高亮',
    (await c.evalJs('document.querySelectorAll("#page-segments .segchip--on").length')) >= 3);
  await c.evalJs(`(function(){
    var b=document.querySelector('#page-segments .btn--ghost');
    if(b && /取消选中/.test(b.textContent)) b.click();
  })()`);
  await new Promise((r) => setTimeout(r, 300));

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

  // v1.6.4：切面学习页签 = 节段划分 + 切面速查与图谱 + 教学视频 + TEE 演示，后三块由 renderSegExtras 填充
  const segExtras = await c.evalJs(`(function(){
    return JSON.stringify({
      nav: document.querySelectorAll('#page-segments .fx-nav__c').length,
      navTxt: [...document.querySelectorAll('#page-segments .fx-nav__c')].map(function(e){return e.textContent.trim();}).join('|'),
      views: document.querySelectorAll('#segViewsList .fx-item').length,
      sim: document.querySelectorAll('#segSimList .fx-item').length,
      look: document.querySelectorAll('#segLookList .fx-item').length,
      albumInViews: document.querySelectorAll('#segViewsList .fx-item[data-kind="album"]').length,
      philipsTxt: (document.querySelector('#segViewsList .fx-item[data-id="philips"]') || {}).textContent || ''
    });
  })()`);
  const se = JSON.parse(segExtras);
  check('切面学习页内导航 4 个（节段/速查/视频/演示）', se.nav === 4, se.nav);
  check('页内导航文案与顺序 = 节段划分|切面速查|教学视频|TEE 演示',
    se.navTxt === '节段划分|切面速查|教学视频|TEE 演示', se.navTxt);
  check('切面学习页教学视频列表 8 条', se.views === 8, segExtras);
  check('切面学习页 TEE 演示列表 3 条', se.sim === 3, segExtras);
  check('切面学习页切面速查与图谱 4 条', se.look === 4, segExtras);
  check('教学视频含 3 个专辑入口（操作规范 / 心课堂 / 飞利浦云课堂）', se.albumInViews === 3, se.albumInViews);
  check('飞利浦专辑入口显示 150 段（组标题不计入）', /150/.test(se.philipsTxt), se.philipsTxt.replace(/\s+/g, ' ').slice(0, 80));

  // ── v1.9.0：150 段的飞利浦专辑页要有搜索框与专题导航，否则只能死滚 ──
  await c.evalJs(`(function(){
    var el = document.querySelector('#segViewsList .fx-item[data-id="philips"]');
    if (el) el.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  })()`);
  await new Promise((r) => setTimeout(r, 400));

  const albInfo = await c.evalJs(`(function(){
    return JSON.stringify({
      open: !document.getElementById('calcAlbum').hidden,
      bar: !document.getElementById('albumBar').hidden,
      search: !!document.getElementById('albumSearch'),
      chips: document.querySelectorAll('#albumNav .album-nav__b').length,
      chip0: (document.querySelector('#albumNav .album-nav__b') || {}).textContent || '',
      rows: document.querySelectorAll('#albumList .fx-item').length,
      groups: document.querySelectorAll('#albumList .album__g').length,
      gids: [...document.querySelectorAll('#albumList .album__g')].map(function(e){return e.id;}).join(',')
    });
  })()`);
  const alb = JSON.parse(albInfo);
  check('飞利浦专辑页已打开', alb.open === true, albInfo);
  check('专辑页出现搜索框与导航条', alb.bar === true && alb.search === true, albInfo);
  check('专辑页导航 9 个 chip（全部 + 8 专题）', alb.chips === 9, alb.chips);
  check('首位 chip 文案 = 全部 150', /^全部\s*150$/.test(alb.chip0.trim()), alb.chip0);
  check('专辑页默认列出 150 段 + 8 个组标题', alb.rows === 150 && alb.groups === 8, albInfo);
  check('组标题锚点 id = ag0…ag7', alb.gids === 'ag0,ag1,ag2,ag3,ag4,ag5,ag6,ag7', alb.gids);

  // 搜索：PISA 只剩 2 条（重复条目已删）
  await c.evalJs(`(function(){
    var i=document.getElementById('albumSearch');
    i.value='PISA';
    i.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await new Promise((r) => setTimeout(r, 250));
  const albF = JSON.parse(await c.evalJs(`(function(){
    return JSON.stringify({
      rows: document.querySelectorAll('#albumList .fx-item').length,
      groups: document.querySelectorAll('#albumList .album__g').length,
      txt: [...document.querySelectorAll('#albumList .fx-item__n')].map(function(e){return e.textContent;}).join(' / '),
      clr: !document.getElementById('albumSearchClr').hidden
    });
  })()`));
  check('搜「PISA」命中 2 条（讲座 + 操作流程，无重复）', albF.rows === 2, albF.txt);
  check('搜「PISA」只保留有命中的组标题', albF.groups === 2, albF.groups);
  check('搜索时右侧清除按钮出现', albF.clr === true, albF.clr);

  // 空结果
  await c.evalJs(`(function(){
    var i=document.getElementById('albumSearch');
    i.value='zzz不存在的关键词';
    i.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await new Promise((r) => setTimeout(r, 200));
  const albEmpty = await c.evalJs(`document.querySelectorAll('#albumList .album-empty').length`);
  check('无命中时显示空态提示', albEmpty === 1, albEmpty);

  // 清除 → 恢复 151
  await c.evalJs(`document.getElementById('albumSearchClr').click()`);
  await new Promise((r) => setTimeout(r, 250));
  const albBack = await c.evalJs(`document.querySelectorAll('#albumList .fx-item').length`);
  check('点清除后恢复全部 150 段', albBack === 150, albBack);

  // 点第 4 个专题 chip（k=3）→ 页面确实滚下去
  const beforeY = await c.evalJs('window.scrollY');
  await c.evalJs(`(function(){
    var bs=document.querySelectorAll('#albumNav .album-nav__b');
    if (bs[4]) bs[4].dispatchEvent(new MouseEvent('click',{bubbles:true}));
  })()`);
  await new Promise((r) => setTimeout(r, 700));
  const afterY = await c.evalJs('window.scrollY');
  const chipOn = await c.evalJs(`document.querySelectorAll('#albumNav .album-nav__b--on').length`);
  check('点第 5 个 chip 后页面向下滚动', afterY > beforeY + 200, beforeY + ' → ' + afterY);
  check('chip 只有一个处于选中态', chipOn === 1, chipOn);
  check('选中 chip = ④ 三维（k=3）',
    (await c.evalJs(`(document.querySelector('#albumNav .album-nav__b--on')||{}).dataset
      ? document.querySelector('#albumNav .album-nav__b--on').dataset.k : ''`)) === '3');

  // 吸顶条与目标组标题的相对位置：组标题必须在吸顶条下方，不能被压住
  const pos = JSON.parse(await c.evalJs(`(function(){
    var bar=document.getElementById('albumBar').getBoundingClientRect();
    var g=document.getElementById('ag3').getBoundingClientRect();
    var on=document.querySelector('#albumNav .album-nav__b--on').getBoundingClientRect();
    var nav=document.getElementById('albumNav').getBoundingClientRect();
    return JSON.stringify({barB:Math.round(bar.bottom), gT:Math.round(g.top),
      chipL:Math.round(on.left), chipR:Math.round(on.right),
      navL:Math.round(nav.left), navR:Math.round(nav.right)});
  })()`));
  check('跳转后目标组标题落在吸顶条下方（没被压住）', pos.gT >= pos.barB - 2,
    'bar 底 ' + pos.barB + ' / 组标题顶 ' + pos.gT);
  check('选中的 chip 已滚进可视区（高亮看得见）',
    pos.chipL >= pos.navL - 1 && pos.chipR <= pos.navR + 1,
    'chip ' + pos.chipL + '–' + pos.chipR + ' / 可视 ' + pos.navL + '–' + pos.navR);

  // 复位：回到切面学习页签，免得影响后面的搜索用例
  await c.evalJs(`document.getElementById('albumBack').click()`);
  await new Promise((r) => setTimeout(r, 400));

  // ── v1.6.5：切面学习页自带搜索 + 与公式集互为补充的跨页签提示 ──
  const segType = async function (v) {
    await c.evalJs(`(function(){
      var i=document.getElementById('segSearch');
      i.value=${JSON.stringify(v)};
      i.dispatchEvent(new Event('input',{bubbles:true}));
    })()`);
    await new Promise((r) => setTimeout(r, 150));
  };
  const segState = async function () {
    const s = await c.evalJs(`(function(){
      return JSON.stringify({
        segpart: document.getElementById('segpart').hidden === true,
        nav: document.getElementById('segNav').hidden === true,
        look: document.querySelectorAll('#segLookList .fx-item').length,
        views: document.querySelectorAll('#segViewsList .fx-item').length,
        sim: document.querySelectorAll('#segSimList .fx-item').length,
        empty: document.getElementById('segEmpty').hidden === false,
        cross: document.getElementById('segCross').hidden === false,
        crossTxt: document.getElementById('segCross').textContent
      });
    })()`);
    return JSON.parse(s);
  };

  await segType('TEE');
  const sw = await segState();
  check('切面学习搜索「TEE」：速查只剩命中条目', sw.look > 0 && sw.look < 4, JSON.stringify(sw));
  check('切面学习搜索时隐藏「节段划分」整块', sw.segpart === true, 'hidden=' + sw.segpart);
  check('切面学习搜索时隐藏页内导航', sw.nav === true, 'hidden=' + sw.nav);

  await segType('zzzz-not-exist');
  const sn = await segState();
  check('切面学习搜不到时给空态', sn.empty === true, JSON.stringify(sn));
  check('两边都搜不到时不显示跨页签提示', sn.cross === false, sn.crossTxt);

  // 只有公式集里才有的词 → 提示带关键词跳过去
  await segType('TAPSE');
  const sc = await segState();
  check('切面学习搜「TAPSE」提示去公式集', sc.cross === true && /公式集/.test(sc.crossTxt), sc.crossTxt);
  await c.evalJs('document.getElementById("segCrossBtn").click()');
  await new Promise((r) => setTimeout(r, 300));
  const crossTo = await c.evalJs(`(function(){
    return JSON.stringify({
      calc: !document.getElementById('page-calc').hidden,
      kw: document.getElementById('fxSearch').value,
      hits: document.querySelectorAll('#calcList .fx-item').length
    });
  })()`);
  const ct = JSON.parse(crossTo);
  check('点跨页签提示切到公式集', ct.calc === true, crossTo);
  check('跨页签跳转把关键词带过去', ct.kw === 'TAPSE', ct.kw);
  check('公式集按该关键词列出结果', ct.hits > 0, ct.hits);

  // 反向：公式集搜「房间隔」，切面学习里也有命中 → 给回链
  await c.evalJs(`(function(){
    var i=document.getElementById('fxSearch');
    i.value='房间隔'; i.dispatchEvent(new Event('input',{bubbles:true}));
  })()`);
  await new Promise((r) => setTimeout(r, 200));
  const rev = await c.evalJs(`(function(){
    var b=document.querySelector('#calcList [data-cross]');
    return JSON.stringify({ has: !!b, txt: b ? b.textContent : '' });
  })()`);
  const rv = JSON.parse(rev);
  check('公式集搜索页给出「切面学习」的跨页签入口', rv.has === true && /切面学习/.test(rv.txt), rev);

  // 复位：清搜索、回切面学习页
  await c.evalJs(`(function(){
    var i=document.getElementById('fxSearch');
    i.value=''; i.dispatchEvent(new Event('input',{bubbles:true}));
    var s=document.getElementById('segSearch');
    if (s) { s.value=''; s.dispatchEvent(new Event('input',{bubbles:true})); }
    document.querySelector('.tab[data-tab="segments"]').click();
  })()`);
  await new Promise((r) => setTimeout(r, 300));
  const srst = await segState();
  check('清空搜索后切面学习恢复完整列表', srst.segpart === false && srst.look === 4 && srst.views === 8 && srst.sim === 3,
    JSON.stringify(srst));

  // v1.6.4 回归：从切面学习点条目 → 进公式集详情 → 返回，页签必须回到「切面学习」
  // （用户 2026-10-24 反馈：「进去后点击哪个，返回页变成了公式集」）
  await c.evalJs(`(function(){
    var b=document.querySelector('#segLookList .fx-item');
    if (b) b.click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));
  const jumpInfo = await c.evalJs(`(function(){
    return JSON.stringify({
      detail: !document.getElementById('calcDetail').hidden,
      title: document.getElementById('appbarTitle').textContent,
      backTxt: (document.getElementById('calcBack') || {}).textContent || '',
      resetHidden: document.getElementById('resetBtn').hidden === true,
      onTab: (document.querySelector('.tab.tab--on') || {}).dataset
        ? document.querySelector('.tab.tab--on').dataset.tab : ''
    });
  })()`);
  const ji = JSON.parse(jumpInfo);
  check('切面速查点条目后打开公式集详情', ji.detail === true, jumpInfo);
  // v1.6.5：从这个入口进来，返回按钮必须写「返回切面学习」，且「重置」不该出现
  check('详情页返回按钮写「返回切面学习」（不是返回公式集）',
    /返回切面学习/.test(ji.backTxt), ji.backTxt);
  check('纯判读详情页隐藏「重置」按钮', ji.resetHidden === true, 'hidden=' + ji.resetHidden);
  check('详情页底部页签仍高亮「切面学习」', ji.onTab === 'segments', ji.onTab);
  await c.evalJs('document.getElementById("calcBack").click()');
  await new Promise((r) => setTimeout(r, 700));
  const backInfo = await c.evalJs(`(function(){
    return JSON.stringify({
      segVisible: !document.getElementById('page-segments').hidden,
      calcVisible: !document.getElementById('page-calc').hidden,
      title: document.getElementById('appbarTitle').textContent,
      resetHidden: document.getElementById('resetBtn').hidden === true
    });
  })()`);
  const bi = JSON.parse(backInfo);
  check('从切面速查进详情后返回，页签回到「切面学习」', bi.segVisible === true && bi.calcVisible === false, backInfo);
  check('返回后顶栏标题为「切面学习」（不被公式集覆盖）', bi.title === '切面学习', bi.title);
  check('切面学习页不显示「重置」按钮', bi.resetHidden === true, 'hidden=' + bi.resetHidden);

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
      resetShown: document.getElementById('resetBtn').hidden !== true,
      groups: [...idx.querySelectorAll('.fx-group')].map(function(e){return e.textContent;}),
      items: idx.querySelectorAll('.fx-item').length,
      links: idx.querySelectorAll('a.fx-item').length,
      valve: idx.querySelectorAll('.fx-item[data-kind="valve"]').length,
      // ★ v1.8.3：详情卡是 buildCalcInputs() 运行时写进 #calcGroups 的，不在目录 #calcIndex 里
      resistOuts: document.querySelectorAll('#calcGroups .card[data-g="resist"] .calc-out').length,
      lvgeomOuts: document.querySelectorAll('#calcGroups .card[data-g="lvgeom"] .calc-out').length,
      valveCalc: (function () {
        // ★ v1.8.2：组头被包进 .fx-hd，列表与 .fx-hd 同级（同在 .fx-card 内），
        //   不再能从 .fx-group 直接 nextElementSibling 找到 —— 先上溯卡片再取列表。
        var gs = idx.querySelectorAll('.fx-group');
        for (var i = 0; i < gs.length; i += 1) {
          if (gs[i].textContent.indexOf('瓣膜评估') === 0) {
            var card = gs[i].closest ? gs[i].closest('.fx-card') : null;
            var lst = card ? card.querySelector('.fx-list') : null;
            if (!lst) {
              lst = gs[i].nextElementSibling;
              while (lst && !lst.classList.contains('fx-list')) lst = lst.nextElementSibling;
            }
            return lst ? lst.querySelectorAll('.fx-item[data-kind="calc"]').length : -1;
          }
        }
        return -1;
      })(),
      album: idx.querySelectorAll('.fx-item[data-kind="album"]').length,
      albumTxt: (idx.querySelector('.fx-item[data-kind="album"]') || {}).textContent || '',
      segOnlyLeak: ['tee-20','tte-std','tte-measure'].filter(function(id){
        return !!idx.querySelector('.fx-item[data-id="'+id+'"]');
      }).length,
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
    // v1.6.5：回到公式集目录后「重置」重新出现（详情页与切面学习页会隐藏）
    check('公式集目录恢复显示「重置」按钮', d.resetShown === true, 'shown=' + d.resetShown);
    check('公式集分组 = 4 个计算组 + 瓣膜 + 4 组评估（v1.6.3 起外链组移出目录）',
      d.groups.join('|') === '瓣膜评估|血流动力学、舒张与心功能|右心与肺循环|重构、室壁运动与心肌功能|图像质控与规范|心腔、心肌与应变|先天性心脏病（含术后）|急症与特殊场景',
      d.groups.join('|'));
    // v1.6.3：「切面学习（视频）」与「TEE 切面在线演示」两外链组从目录移出、收进「切面学习」页签
    // v1.6.4：切面速查 3 条（tee-20 / tte-std / tte-measure）也移入该页签 → 130 → 127
    check('条目 114 条（计算 41 + 评估判读 73；v1.11.4 新增主动脉弓离断与肺动脉起源异常）', d.items === 114, d.items);
    check('合并页一条出多行结果（resist 3 槽 / lvgeom 4 槽）',
      d.resistOuts === 3 && d.lvgeomOuts === 4,
      d.resistOuts + ' / ' + d.lvgeomOuts);
    check('目录不再含切面速查条目（tee-20 / tte-std / tte-measure）', d.segOnlyLeak === 0, d.segOnlyLeak);
    check('外链 <a> 条目 0 条（切面学习/TEE 演示已移出公式集目录）', d.links === 0, d.links);
    check('目录不再含操作规范专辑入口（已移入切面学习页签）', d.album === 0, d.album + ' / ' + d.albumTxt);
    check('公式集目录带搜索框', d.search, true);
    check('专辑二级视图容器存在（切面学习页跳转依赖）', d.albumView, true);
    check('无外链时 href 免检', d.links === 0 || (d.href || '').indexOf('https://') === 0, d.href);
    check('切面条目不加载图片/iframe/视频（省内存）', d.media === 0, d.media);
    check('发布版不列瓣膜计算器（无瓣膜页）', d.valve === 0, d.valve);
    check('发布版瓣膜评估组含 4 条计算（TR / PPM / TAVR 瓣环 / 人工瓣术后）', d.valveCalc === 4, d.valveCalc);
    check('参考文献 90 条', d.refs === 90, d.refs);
    check('已删除延展阅读卡片（三端一致）', d.ext === false, d.ext);
  }

  // ── v1.3.10 新增：4 项体验修复的断言 ──
  console.log('\n【三·a】体验修复：关于本页位置 / 加粗解析 / 返回栈 / 小节导航');
  {
    // ① 「关于本页」只在公式集页末尾出现一次，其余页签一律没有
    const pn = await c.evalJs(`(function () {
      var all = document.querySelectorAll('.pubnote');
      var inCalc = document.querySelectorAll('#page-calc .pubnote').length;
      var inIndex = document.querySelectorAll('#page-index .pubnote').length;
      var inSeg = document.querySelectorAll('#page-segments .pubnote').length;
      var inPeds = document.querySelectorAll('#page-peds .pubnote').length;
      // 是否在 main 的最前面（旧版位置：main 顶部）
      var main = document.getElementById('main');
      var firstEl = main ? main.firstElementChild : null;
      var atTop = !!(firstEl && firstEl.classList.contains('pubnote'));
      // 是否位于公式集页最后一个卡片之后
      var calcSec = document.getElementById('page-calc');
      var lastCard = calcSec ? calcSec.querySelector('.card:last-of-type') : null;
      var pnEl = calcSec ? calcSec.querySelector('.pubnote') : null;
      var atEnd = !!(pnEl && lastCard &&
        (pnEl.compareDocumentPosition(lastCard) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0);
      return JSON.stringify({ total: all.length, inCalc: inCalc, inIndex: inIndex,
        inSeg: inSeg, inPeds: inPeds, atTop: atTop, atEnd: atEnd,
        txt: (pnEl || {}).textContent || '' });
    })()`);
    const p = JSON.parse(pn);
    check('「关于本页」全页只有 1 处', p.total === 1, p.total);
    check('「关于本页」在公式集页内', p.inCalc === 1, p.inCalc);
    check('「关于本页」不在 EF·参考值页', p.inIndex === 0, p.inIndex);
    check('「关于本页」不在节段划分页', p.inSeg === 0, p.inSeg);
    check('「关于本页」不在儿童 Z 值页', p.inPeds === 0, p.inPeds);
    check('「关于本页」已从页面顶部移走', p.atTop === false, p.atTop);
    check('「关于本页」位于公式集页末尾', p.atEnd === true, p.atEnd);
    check('「关于本页」含免责声明', /非任何学会|不能单凭/.test(p.txt), p.txt.slice(0, 60));

    // ② **加粗** 解析：引擎已注入，且渲染结果不含字面量 **
    const md = await c.evalJs(`(function () {
      return JSON.stringify({
        hasEngine: typeof window.InlineMd === 'object',
        hasParse: !!(window.InlineMd && window.InlineMd.parseInline),
        sample: window.InlineMd && window.InlineMd.parseInline
          ? window.InlineMd.parseInline('前**重点**后') : []
      });
    })()`);
    const m = JSON.parse(md);
    check('InlineMd 引擎已注入网页版', m.hasEngine === true, m.hasEngine);
    check('InlineMd.parseInline 可用', m.hasParse === true, m.hasParse);
    check('解析器把 **重点** 切成加粗片段',
      Array.isArray(m.sample) && m.sample.length === 3 &&
      m.sample[1].b === true && m.sample[1].t === '重点',
      JSON.stringify(m.sample));

    // ②b 打开一个长条目，确认详情里没有字面量 **，且有 <b> 标签
    const lit = await c.evalJs(`(function () {
      var btn = document.querySelector('#calcList .fx-item[data-kind="brief"]');
      if (!btn) return JSON.stringify({ skip: true });
      btn.click();
      var card = document.querySelector('#calcGroups > .card:not([hidden])');
      if (!card) return JSON.stringify({ skip: true });
      var txt = card.textContent || '';
      var html = card.innerHTML || '';
      return JSON.stringify({
        literal: txt.indexOf('**') >= 0 ? txt.slice(txt.indexOf('**') - 20, txt.indexOf('**') + 20) : '',
        bold: card.querySelectorAll('b').length,
        toc: card.querySelectorAll('.fx-nav--sec .fx-nav__c').length,
        anchors: card.querySelectorAll('.fx-h[id^="sec-"]').length
      });
    })()`);
    const L = JSON.parse(lit);
    if (L.skip) {
      check('详情页可打开（用于验证加粗与导航）', false, '未找到 brief 条目');
    } else {
      check('详情正文不再出现字面量 **', L.literal === '', L.literal);
      check('详情正文已渲染 <b> 加粗', L.bold > 0, L.bold);
      check('长条目顶部有小节导航胶囊', L.toc >= 2, L.toc);
      check('小节标题带锚点 id（可跳转）', L.anchors >= 2, L.anchors);
    }

    // ③ 返回栈：进入详情后 hash 变化，返回能回到目录（不是退出页面）
    const hist = await c.evalJs(`(function () {
      var before = location.hash;
      var idx = document.getElementById('calcIndex');
      var detail = document.getElementById('calcDetail');
      return JSON.stringify({ before: before, hash: location.hash });
    })()`);
    const H = JSON.parse(hist);
    check('进入详情后 URL 带视图 hash（返回键可回退）',
      /^#\/calc\//.test(H.hash), H.hash);

    // 点「返回公式集」按钮后应回到目录视图
    const back = await c.evalJs(`(function () {
      var b = document.getElementById('calcBack');
      if (!b) return JSON.stringify({ skip: true });
      b.click();
      return JSON.stringify({
        indexVisible: !document.getElementById('calcIndex').hidden,
        detailHidden: document.getElementById('calcDetail').hidden
      });
    })()`);
    const B = JSON.parse(back);
    if (B.skip) {
      check('「返回公式集」按钮存在', false, '未找到 #calcBack');
    } else {
      check('点「返回公式集」回到目录视图',
        B.indexVisible === true && B.detailHidden === true,
        JSON.stringify(B));
      // history.back() 是异步的，hash 退回要等一拍
      await new Promise((r) => setTimeout(r, 250));
      const bh = await c.evalJs(`JSON.stringify({ hash: location.hash })`);
      const BH = JSON.parse(bh);
      check('返回后 hash 回到目录', BH.hash === '#/calc' || BH.hash === '', BH.hash);
    }
  }

  // ── v1.2.4 新增计算器：端到端点开 + 填值 + 读结果 ──
  console.log('\n【三·b】新增计算器端到端（右心 / 瓣膜 / 舒张 / 重构）');
  const backToList = async () => {
    await c.evalJs(`(function(){var b=document.getElementById('calcBack'); if(b) b.click();})()`);
    await new Promise((r) => setTimeout(r, 200));
  };
  // 评估页（brief 条目）：进卡后先清空所有输入，避免上一条用例的缓存值串进来
  const openBrief = async (id) => {
    await backToList();
    await c.evalJs(`(function(){
      var e=document.querySelector('#calcList .fx-item[data-kind="brief"][data-id="${id}"]');
      if(e) e.click();
    })()`);
    await new Promise((r) => setTimeout(r, 250));
    await c.evalJs(`(function(){
      var box=document.querySelector('#calcGroups .card[data-g="${id}"]');
      if(!box) return;
      [].slice.call(box.querySelectorAll('input[data-ck]')).forEach(function(i){
        i.value=''; i.dispatchEvent(new Event('input',{bubbles:true}));
      });
    })()`);
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
  check('目录出现合并后的计算组',
    ['血流动力学、舒张与心功能', '右心与肺循环', '重构、室壁运动与心肌功能'].every((t) => newGroupTitles.indexOf(t) !== -1),
    newGroupTitles);

  // v1.10.5：左心补几何构型四分法与肥厚病因四联；右心补四种耦联写法与决策用法
  const briefText = async (gid) => await c.evalJs(
    `(function(){var b=document.querySelector('#calcGroups .card[data-g="${gid}"]');
      return b ? b.textContent.replace(/\\s+/g,' ') : '';})()`);
  await openBrief('lv');
  const lvTxt = await briefText('lv');
  check('左心评估含几何构型四分法',
    ['向心性重构', '向心性肥厚', '离心性肥厚'].every((w) => lvTxt.indexOf(w) >= 0), lvTxt.slice(0, 40));
  check('左心评估含肥厚病因四联（高血压 / HCM / 淀粉样变 / 运动心脏）',
    ['高血压性肥厚', '肥厚型心肌病', '淀粉样变', '运动心脏'].every((w) => lvTxt.indexOf(w) >= 0), '');
  check('左心评估含三对矛盾判读法', lvTxt.indexOf('三对矛盾') >= 0, '');
  await openBrief('rv');
  const rvTxt = await briefText('rv');
  check('右心评估含 TAPSE/PASP 之外的三种写法',
    ['RVFAC / PASP', 'RVESVi / PASP', 'TAPSE / TRV'].every((w) => rvTxt.indexOf(w) >= 0), '');
  check('右心评估含耦联三期（适应 / 勉强适应 / 失适应）',
    ['adaptation', '勉强适应', '失适应'].every((w) => rvTxt.indexOf(w) >= 0), '');
  check('右心评估含决策用法（右心门槛 / 术后右心衰）',
    rvTxt.indexOf('右心门槛') >= 0 && rvTxt.indexOf('术后右心衰') >= 0, '');
  await openBrief('rvfun');
  const rfTxt = await briefText('rvfun');
  check('右室功能含两种负荷方式（多巴酚丁胺 / 仰卧踏车）',
    ['低剂量多巴酚丁胺', '仰卧踏车运动'].every((w) => rfTxt.indexOf(w) >= 0), '');
  check('右室功能含运动负荷正常与异常反应',
    rfTxt.indexOf('EIPH') >= 0 && rfTxt.indexOf('耦联储备不足') >= 0, '');
  check('右室功能含耦联储备公式',
    rfTxt.indexOf('耦联储备 =（峰值 TAPSE') >= 0, '');
  // 实填：TAPSE 16→23、PASP 30→45，比值 0.53→0.51，判「保留」；峰值 PASP 70 时判「不足」
  await fillCalc('rvfun', 'rvr0', '-14');
  await fillCalc('rvfun', 'rvr1', '-21');
  await fillCalc('rvfun', 'rvt0', '16');
  await fillCalc('rvfun', 'rvt1', '23');
  await fillCalc('rvfun', 'rvfpasp', '30');
  await fillCalc('rvfun', 'rvp1', '45');
  await new Promise((r) => setTimeout(r, 300));
  let rvOut = await outOf('rvfun');
  check('右室储备：0.53→0.51 判耦联储备保留',
    /0\.53→0\.51/.test(rvOut) && /耦联储备保留/.test(rvOut), rvOut.slice(0, 90));
  await fillCalc('rvfun', 'rvp1', '70');
  await new Promise((r) => setTimeout(r, 300));
  rvOut = await outOf('rvfun');
  check('右室储备：峰值 PASP 70 判耦联储备不足', /耦联储备不足/.test(rvOut), rvOut.slice(0, 90));

  // v1.10.7：主动脉瓣条目扩充 —— AVA 四法 / DVI / 四象限 / 高流量陷阱 / 危险标志
  await openBrief('aortic');
  const aoTxt = await briefText('aortic');
  const hasAll = (ws) => ws.every((w) => aoTxt.indexOf(w) >= 0);
  check('主动脉瓣含 AVA 四种算法',
    hasAll(['连续性方程', '峰速法', 'planimetry', '压力恢复']), '');
  check('主动脉瓣含 DVI 独立小节与三档阈值',
    hasAll(['DVI：低流量时最稳', '0.25–0.50', '≤0.20']), '');
  check('主动脉瓣含流量 × 压差四象限',
    hasAll(['正常流量低压差', '低流量高压差', '高压差重度']), '');
  check('主动脉瓣含高流量状态与假性 AVA',
    hasAll(['高流量状态', '假性 AVA', 'DVI 正常']), '');
  check('主动脉瓣含无症状重度危险标志',
    hasAll(['危险标志', 'BNP', 'GLS', '运动试验']), '');
  check('主动脉瓣十二节编号连续',
    ['一、AS 三联', '二、AVA 的四种算法', '三、DVI', '四、低流量低压差', '五、反向的坑',
      '六、AS 分期', '七、无症状重度', '八、AR 定量', '九、重度 AR', '十、急性 AR',
      '十一、TAVR', '十二、混合瓣膜病'].every((w) => aoTxt.indexOf(w) >= 0), '');

  // 实填：三联 + LF-LG 四值 → 应判反常型，且不再重复出「⚠ AVA ≤1.0 而压差 <40」
  await openBrief('aortic');
  await fillCalc('aortic', 'as_lvotD', '1.8');
  await fillCalc('aortic', 'as_lvotVti', '15');
  await fillCalc('aortic', 'as_avVti', '40');
  await fillCalc('aortic', 'as_mg', '32');
  await fillCalc('aortic', 'lflgsvi', '22');
  await fillCalc('aortic', 'lflgmpg', '32');
  await fillCalc('aortic', 'lflgava', '0.95');
  await fillCalc('aortic', 'lflgef', '60');
  await new Promise((r) => setTimeout(r, 350));
  const aoOut = await outOf('aortic');
  check('主动脉瓣：AVA 连续方程 0.95（1.8 / 15 / 40）', /AVA 连续方程 0\.95/.test(aoOut), aoOut.slice(0, 120));
  check('主动脉瓣：四值齐备判反常型 LF-LG', /低流量低压差.*反常/.test(aoOut), aoOut.slice(-120));
  check('主动脉瓣：LF-LG 已判时不再重复 ⚠ 提示', /⚠ AVA ≤1\.0/.test(aoOut) ? 'dup' : 'ok', 'ok');

  // v1.10.9：人工瓣条目扩充 —— 五道门 / PPM 双切点 / 血栓 vs pannus / VARC-3 三级 / 瓣周漏
  await openBrief('prosthetic');
  const prTxt = await briefText('prosthetic');
  const hasPr = (ws) => ws.every((w) => prTxt.indexOf(w) >= 0);
  check('人工瓣含五道门判别路径',
    hasPr(['① 流量', '② 尺寸', '③ 几何', '④ 反流', '⑤ 时间轴']), '');
  check('人工瓣含 PPM 两套切点（含 BMI ≥ 30）',
    hasPr(['0.66–0.85', '≤ 0.65', '0.56–0.70', '≤ 0.55', '0.91–1.20', '≤ 0.75']), '');
  check('人工瓣含血栓 vs pannus 六维鉴别',
    hasPr(['瓣膜血栓', '血管翳 pannus', '抗凝 / 溶栓', '高密度（纤维组织）']), '');
  check('人工瓣含 VARC-3 三级 SVD',
    hasPr(['Stage 1 形态学 SVD', 'Stage 2 中度血流动力学 SVD', 'Stage 3 重度血流动力学 SVD']), '');
  check('人工瓣含瓣周漏三级定量',
    hasPr(['VC < 3 mm', 'VC 3–6 mm', 'VC ≥ 6 mm', '周向 > 20%']), '');
  check('人工瓣含八个高频误判',
    hasPr(['用不同切面测压差', '不记心率就比压差', '把 pannus 当血栓反复溶栓']), '');
  check('人工瓣十二节编号连续',
    ['一、第一原则', '二、正常流速与压差', '三、压差升高', '四、PPM', '五、机械瓣与生物瓣',
      '六、瓣膜血栓', '七、血管翳', '八、SVD', '九、低流量', '十、瓣周漏',
      '十一、随访节奏', '十二、八个高频误判'].every((w) => prTxt.indexOf(w) >= 0), '');

  // v1.10.10：新增「左室心肌致密化不全」判读条目
  await openBrief('nc-lv');
  const ncTxt = await briefText('nc-lv');
  const hasNc = (ws) => ws.every((w) => ncTxt.indexOf(w) >= 0);
  check('LVNC 条目说明它是表型而非独立疾病',
    hasNc(['左室小梁化表型', '不是一个独立的疾病', 'NDLVC']), '');
  check('LVNC 条目含三套影像标准与阈值',
    hasNc(['Jenni', 'Petersen', 'Jacquier', 'Captur', 'NC/C > 2.0', 'NC/C > 2.3', 'NC/C > 3.0']), '');
  check('LVNC 条目含五步判读顺序',
    hasNc(['① 比值', '② 两层', '③ 隐窝', '④ 功能', '⑤ 病因']), '');
  check('LVNC 条目含六类过度诊断人群',
    hasNc(['运动员', '妊娠与围产期', '镰状细胞病', '淀粉样变', 'Danon / Pompe']), '');
  check('LVNC 条目明确不因小梁化抗凝',
    hasNc(['本身不是指征', 'LVEF ≥ 40%、窦性心律、无栓塞史']), '');
  check('LVNC 条目含报告三段写法',
    hasNc(['描述段', '结论段', '建议段', '不要写「心肌致密化不全（确诊）」']), '');
  check('LVNC 九节编号连续',
    ['一、它现在不是一个独立的疾病', '二、三套影像标准', '三、判读顺序', '四、最容易被过度诊断',
      '五、血栓与抗凝', '六、功能、心律与器械', '七、家族筛查', '八、一份能复现的报告',
      '九、七个坑'].every((w) => ncTxt.indexOf(w) >= 0), '');
  // 桥接：LVNC 条目末尾应挂「相关计算」；v1.11.2 起 NC/C 已内嵌进本条，桥接改指重构四联与 EF
  check('LVNC 条目挂上相关计算桥接',
    /相关计算（通用量）/.test(ncTxt) && /左室重构四联/.test(ncTxt), '');
  // DCM 条目的鉴别小节应指向新条目
  await openBrief('dcm');
  const dcmTxt = await briefText('dcm');
  check('DCM 条目指向 LVNC 新条目',
    /完整判读（三套标准、过度诊断、抗凝与报告写法）/.test(dcmTxt), '');

  /* ★ v1.11.2
   *   ① NC/C 从独立计算器并进 LVNC 判读条目 —— 目录里不再出现两条「致密化不全」
   *   ② 法洛四联症补术前（四联征确认 / 骑跨率与 DORV / 可根治性 / 术式）
   *   ③ 新增冠状动脉瘘 */

  await openBrief('nc-lv');
  check('LVNC 条目自带 NC/C 两个输入框',
    await c.evalJs(`(function(){var b=document.querySelector('#calcGroups .card[data-g="nc-lv"]');
      return !!(b && b.querySelector('input[data-ck="lnvnc"]') && b.querySelector('input[data-ck="lnvc"]'));})()`),
    true);
  await fillCalc('nc-lv', 'lnvnc', '7');
  await fillCalc('nc-lv', 'lnvc', '3');
  await new Promise((r) => setTimeout(r, 200));
  const ncOut = await outOf('nc-lv');
  check('NC/C 7÷3 → 2.33 且提示超过 Petersen 2.3',
    /2\.33/.test(ncOut) && /Petersen/.test(ncOut), ncOut);
  await fillCalc('nc-lv', 'lnvnc', '4');
  await fillCalc('nc-lv', 'lnvc', '4');
  await new Promise((r) => setTimeout(r, 200));
  const ncOut2 = await outOf('nc-lv');
  check('NC/C 4÷4 → 1.00 且判未达 Jenni 2.0', /1\.00/.test(ncOut2) && /Jenni/.test(ncOut2), ncOut2);

  await openBrief('tof-pr');
  const tofTxt = await briefText('tof-pr');
  check('TOF 补上术前四联征确认与骑跨率',
    ['四联征是四件事', '骑跨率', 'DORV'].every((w) => tofTxt.indexOf(w) >= 0), '');
  check('TOF 补上可根治性判断（McGoon / Nakata / MAPCA）',
    ['McGoon', 'Nakata', 'MAPCA'].every((w) => tofTxt.indexOf(w) >= 0), '');
  check('TOF 补上术式与术后基线五件事',
    ['跨瓣环补片', '术后三个月内', '残余 VSD'].every((w) => tofTxt.indexOf(w) >= 0), '');
  check('TOF 保留原有 PR / PVR 内容',
    ['PR 指数', 'RVESVi', 'PVR'].every((w) => tofTxt.indexOf(w) >= 0), '');
  check('TOF 补上长期随访三件事（AR / 心律失常 / 左室功能）',
    ['主动脉根部扩张', 'QRS', '左室功能'].every((w) => tofTxt.indexOf(w) >= 0), '');
  check('TOF 条目顶部渲染「本文缩写」并给出 TOF 中文全称',
    await c.evalJs(`(function(){
      var b=document.querySelector('#calcGroups .card[data-g="tof-pr"] .abbr');
      return !!(b && b.textContent.indexOf('本文缩写')>=0 && b.textContent.indexOf('法洛四联症')>=0);})()`),
    true);

  await openBrief('caf');
  const cafTxt = await briefText('caf');
  check('冠状动脉瘘含三步定位（起源 / 走行 / 引流口）',
    ['起源', '走行', '引流口'].every((w) => cafTxt.indexOf(w) >= 0), '');
  check('冠状动脉瘘强调连续性血流与鉴别',
    ['连续性', '主动脉窦瘤破裂', '川崎病'].every((w) => cafTxt.indexOf(w) >= 0), '');
  check('冠状动脉瘘含关闭指征（Qp/Qs >1.5）',
    /Qp\/Qs/.test(cafTxt) && /1\.5/.test(cafTxt), '');

  /* ★ v1.11.3：一个病一条、术前到术后 —— 冠脉异常起源 / 肺静脉异位引流 / Fontan 扩写 */
  await openBrief('aca');
  const acaTxt = await briefText('aca');
  check('冠脉异常起源：ALCAPA 七步含左冠开口 / 侧支 / 肺动脉内反向血流',
    ['左冠开口', '侧支', '肺动脉内'].every((w) => acaTxt.indexOf(w) >= 0), '');
  check('冠脉异常起源：点明婴儿型 DCM 陷阱（必须看左冠开口）',
    /DCM/.test(acaTxt) && /婴儿/.test(acaTxt), '');
  check('冠脉异常起源：AAOCA 四条危险特征齐全',
    ['壁内段 >5 mm', '裂隙样', '主肺动脉之间'].every((w) => acaTxt.indexOf(w) >= 0), '');
  check('冠脉异常起源：术后看吻合口流速 >2 m/s',
    /2 m\/s/.test(acaTxt), acaTxt.slice(0, 80));

  await openBrief('pvai');
  const pvTxt = await briefText('pvai');
  check('肺静脉异位引流：四型齐全（心上 / 心内 / 心下 / 混合）',
    ['心上型', '心内型', '心下型', '混合型'].every((w) => pvTxt.indexOf(w) >= 0), '');
  check('肺静脉异位引流：梗阻判定写清连续血流与左房小',
    /连续血流/.test(pvTxt) && /左房小|左房常偏小/.test(pvTxt), '');
  check('肺静脉异位引流：冠状静脉窦扩张的必查链（LSVC / 左上肺静脉 / 静脉窦型 ASD）',
    ['LSVC', '左上肺静脉', '静脉窦型'].every((w) => pvTxt.indexOf(w) >= 0), '');
  check('肺静脉异位引流：术后吻合口 >1.5 m/s 提示狭窄',
    /1\.5 m\/s/.test(pvTxt), '');

  await openBrief('fontan');
  const fnTxt = await briefText('fontan');
  check('Fontan：标题已扩为单心室与循环衰竭',
    /单心室与 Fontan 循环/.test(fnTxt) && /衰竭/.test(fnTxt), '');
  check('Fontan：衰竭五步鉴别指向具体可逆项（管道 / EF / 房室瓣 / 窦房结 / FALD）',
    ['管道', '系统性心室 EF', '房室瓣反流加重', '窦房结', 'FALD'].every((w) => fnTxt.indexOf(w) >= 0), '');
  check('Fontan：FALD 写清门静脉 <10 cm/s 且转氨酶正常不能排除',
    /10 cm\/s/.test(fnTxt) && /转氨酶正常不能排除/.test(fnTxt), '');
  check('Fontan：仍保留开窗与肝静脉反向血流两条要点',
    ['开窗', '肝静脉'].every((w) => fnTxt.indexOf(w) >= 0), '');
  /* ★ v1.11.4：Fontan 运动与药物试验 */
  check('Fontan：运动试验三项限制（变时 / 前负荷 / 开窗分流）',
    ['变时功能', '前负荷', '峰值 VO'].every((w) => fnTxt.indexOf(w) >= 0), '');
  check('Fontan：药物段写清过度利尿压低前负荷',
    /西地那非/.test(fnTxt) && /过度利尿/.test(fnTxt), '');
  check('Fontan：小节编号连续到十四（新增三节后不跳号）',
    ['十一、运动试验', '十二、负荷超声与药物试验', '十三、药物', '十四、七个坑']
      .every((w) => fnTxt.indexOf(w) >= 0), '');

  /* v1.11.4：主动脉弓离断 / 肺动脉起源异常两个新条目 */
  await openBrief('iaa');
  const iaaTxt = await briefText('iaa');
  check('主动脉弓离断：三型按断口位置写清（A 远端 / B 左颈总与左锁骨下之间 / C）',
    ['左锁骨下动脉开口远端', '左颈总与左锁骨下之间'].every((w) => iaaTxt.indexOf(w) >= 0), '');
  check('主动脉弓离断：点明「压差测不出不能排除」',
    /压差测不出/.test(iaaTxt) || /没有连续腔/.test(iaaTxt), '');
  check('主动脉弓离断：B 型要查 22q11 与迷走右锁骨下',
    ['22q11', '迷走右锁骨下'].every((w) => iaaTxt.indexOf(w) >= 0), '');
  check('主动脉弓离断：术后看吻合口与 LVOT',
    ['弓部吻合口', 'LVOT'].every((w) => iaaTxt.indexOf(w) >= 0), '');

  await openBrief('pa-origin');
  const paTxt = await briefText('pa-origin');
  check('肺动脉起源异常：三型齐全（AOPA / 吊带 / 单侧缺如）',
    ['AOPA', '肺动脉吊带', '单侧缺如'].every((w) => paTxt.indexOf(w) >= 0), '');
  check('肺动脉起源异常：AOPA 两个不该有的分支 + 双期连续血流',
    ['主肺动脉少一支', '升主动脉多一支', '双期连续'].every((w) => paTxt.indexOf(w) >= 0), '');
  check('肺动脉起源异常：吊带写清气管受压与完全性气管环',
    /气管下段/.test(paTxt) && /完全性气管环/.test(paTxt), '');

  /* v1.11.4：ALCAPA 术后负荷超声（并入冠脉异常起源条目，不另开入口） */
  await openBrief('aca');
  const acaTxt2 = await briefText('aca');
  check('冠脉异常起源：新增术后负荷超声（运动 / 多巴酚丁胺 / 灌注）',
    ['运动负荷超声', '多巴酚丁胺', '吻合口流速'].every((w) => acaTxt2.indexOf(w) >= 0), '');
  check('冠脉异常起源：写清「未达负荷」不等于阴性',
    /未达负荷/.test(acaTxt2), '');

  /* v1.11.4：HCM 下蹲-站立激发 */
  await openBrief('hcm');
  const hcmTxt = await briefText('hcm');
  check('肥厚型心肌病：新增下蹲-站立体位激发（四步 + 优缺点）',
    ['下蹲-站立', '蹲位 30–60 s', '优点', '局限'].every((w) => hcmTxt.indexOf(w) >= 0), '');
  check('肥厚型心肌病：写清与主动脉瓣狭窄的相反反应',
    /蹲下变轻/.test(hcmTxt) && /杂音增强/.test(hcmTxt), '');
  check('肥厚型心肌病：说明只测蹲位会低估梗阻',
    /只测蹲位会低估梗阻/.test(hcmTxt), '');
  check('肥厚型心肌病：小节编号连续到十一（插入新节后不跳号）',
    ['五、下蹲-站立', '六、SAM', '十一、报告怎么写'].every((w) => hcmTxt.indexOf(w) >= 0), '');

  /* v1.11.3：条目内引用 → 参考文献总表，展开 + 定位 + 高亮 */
  await openBrief('pvai');
  const jumpId = await c.evalJs(`(function(){
    var card=document.querySelector('#calcGroups .card[data-g="pvai"]');
    var a=card && card.querySelector('[data-refjump]');
    if(!a) return 'none';
    a.click();
    return a.dataset.refjump;
  })()`);
  await new Promise((r) => setTimeout(r, 700));
  const jumpSt = await c.evalJs(`(function(){
    var list=document.getElementById('calcRefList');
    var t=document.getElementById('ref-R32');
    var d=document.getElementById('calcDetail');
    return JSON.stringify({
      open: !!(list && !list.hidden),
      hit: !!(t && t.className.indexOf('ref-item--hit')>=0),
      backToIndex: !!(d && d.hidden),
      inView: !!(t && t.getBoundingClientRect().top > 20 && t.getBoundingClientRect().top < 900)
    });
  })()`);
  check('条目内引用可跳参考文献（R32：回目录 + 展开 + 高亮 + 到位）',
    jumpId === 'R32' && /"open":true/.test(jumpSt) && /"hit":true/.test(jumpSt) &&
    /"backToIndex":true/.test(jumpSt) && /"inView":true/.test(jumpSt), jumpSt);
  // 还原成默认折叠，后面的文献折叠断言依赖初始状态
  await c.evalJs(`(function(){
    var l=document.getElementById('calcRefList'); if(l) l.hidden=true;
    var t=document.getElementById('ref-R32'); if(t) t.classList.remove('ref-item--hit');
    var hd=document.getElementById('refsToggle'); if(hd){hd.classList.remove('refs-hd--open');hd.setAttribute('aria-expanded','false');}
    return 1;
  })()`);

  await openCalc('mpap');
  await fillCalc('mpap', 'pp_tr', '3.0');
  await fillCalc('mpap', 'pp_pr', '1.5');
  await fillCalc('mpap', 'pp_rap', '8');
  await new Promise((r) => setTimeout(r, 300));
  let o = await outOf('mpap');
  check('肺动脉压三合一：TR 3.0 + PR 1.5 + RAP 8 → sPAP 44 / dPAP 17 / mPAP 26',
    /sPAP 44/.test(o) && /dPAP 17/.test(o) && /mPAP 26/.test(o), o);

  // —— v1.3.12：随访与术中评估 ——
  await openCalc('aortagrow');
  await fillCalc('aortagrow', 'd1', '3.0');
  await fillCalc('aortagrow', 'd2', '3.6');
  await fillCalc('aortagrow', 'yrs', '2');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('aortagrow');
  check('主动脉 3.0→3.6cm/2年 → 3.00 mm/年 中危', /3\.00 mm/.test(o) && /中危/.test(o), o);

  await openCalc('pvfu');
  await fillCalc('pvfu', 'lvotD', '2.0');
  await fillCalc('pvfu', 'lvotVti', '20');
  await fillCalc('pvfu', 'valveVti', '20');
  await fillCalc('pvfu', 'fupvmax', '2.6');
  await fillCalc('pvfu', 'fupmean', '12');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('pvfu');
  check('人工瓣 EOA 3.14 cm² 开放良好、平均压差正常',
    /3\.14 cm²/.test(o) && /开放良好/.test(o) && /正常/.test(o), o);

  await openCalc('cfr');
  await fillCalc('cfr', 'distal', '60');
  await fillCalc('cfr', 'proximal', '25');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('cfr');
  check('CFR 2.40 正常', /2\.40/.test(o) && /正常/.test(o), o);

  // 说明块（临床意义 / 参考标准 / 判读要点）应出现在计算器详情里
  const notesOk = await c.evalJs(`(function(){
    var box=document.querySelector('#calcGroups .card[data-g="flow"]');
    if(!box) return false;
    var t=box.textContent||'';
    return t.indexOf('这个指标是干什么用的')!==-1 &&
           t.indexOf('参考标准 / 正常值')!==-1 &&
           t.indexOf('判读要点与常见陷阱')!==-1;
  })()`);
  check('计算器详情含「临床意义 / 参考标准 / 判读要点」三节', notesOk, notesOk);

  // ★ v1.8.3：pvrv 已是「血管阻力」合并页里的①小节，卡片入口换成 resist，结果槽 id 不变
  await openCalc('resist');
  await fillCalc('resist', 'hmmpap', '45');
  await fillCalc('resist', 'hmpawp', '12');
  await fillCalc('resist', 'hmco', '5');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('pvrv');
  check('PVR 33/5 → 6.6 WU 重度', /6\.6/.test(o) && /重度/.test(o), o);

  // v1.4.5：PISA 独立计算器并入二尖瓣评估页，改在评估页 MR 段验证
  await openBrief('mitral');
  await fillCalc('mitral', 'mr_radius', '0.8');
  await fillCalc('mitral', 'mr_aliasVa', '40');
  await fillCalc('mitral', 'mr_regV', '5.0');
  await fillCalc('mitral', 'mr_regVti', '150');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('mitral');
  check('二尖瓣页 PISA r=0.8 → EROA 0.32 / RVol 48', /0\.32/.test(o) && /48/.test(o), o);

  // v1.10.8：二尖瓣条目补齐 MR 定量方法学与继发 MR 分层
  await openBrief('mitral');
  const mrTxt = await briefText('mitral');
  const hasMr = (ws) => ws.every((w) => mrTxt.indexOf(w) >= 0);
  check('二尖瓣含 MR 四条定量路线',
    hasMr(['3D VCA', '容积法', '肺静脉', '四条独立路线']), '');
  check('二尖瓣含四法不一致的处理',
    hasMr(['相差 >25%', '不要取平均', '3D VCA > 容积法']), '');
  check('二尖瓣含心房性 / 心室性 SMR 分层',
    hasMr(['心房性（A-SMR）', '心室性（V-SMR）', 'tenting', 'LVEDVi']), '');
  check('二尖瓣含成比例 / 不成比例（界值 0.14）',
    hasMr(['0.14', 'COAPT', 'MITRA-FR', '不成比例']), '');
  check('二尖瓣含继发 MR 五道门与 COAPT-like 边界',
    hasMr(['五道门', 'GDMT', 'LVEF 20–50%', 'LVESD ≤70 mm', 'Ⅰ A']), '');
  check('二尖瓣含合并冠心病走 CABG / PCI 分支',
    hasMr(['CABG', 'PCI', 'Ⅱb C']), '');
  check('二尖瓣含原发 MR 两层推荐（LVESDi ≥20、四条合并症）',
    hasMr(['LVESDi ≥20 mm/m²', 'LAVI ≥60 mL/m²', '≥3 条']), '');
  check('二尖瓣含 TEER 解剖门槛数值',
    hasMr(['8–10 mm', '4.0 cm²', 'tenting height / area']), '');
  check('二尖瓣十三节编号连续',
    ['一、狭窄 MS', '二、平均压差', '三、Wilkins', '四、PMBV', '五、MS 的后果',
      '六、反流 MR', '七、Carpentier', '八、继发 MR 的两条机制', '九、成比例',
      '十、继发 MR 该不该干预', '十一、原发 MR 的干预时机',
      '十二、TEER', '十三、把两个瓣'].every((w) => mrTxt.indexOf(w) >= 0), '');

  // 实填：PISA + 容积法 + LVEDV 同时给，两条路应互相印证
  await openBrief('mitral');
  await fillCalc('mitral', 'mr_radius', '0.8');
  await fillCalc('mitral', 'mr_aliasVa', '40');
  await fillCalc('mitral', 'mr_regV', '5.0');
  await fillCalc('mitral', 'mr_regVti', '150');
  await fillCalc('mitral', 'mr_mvD', '3.4');
  await fillCalc('mitral', 'mr_lvedv', '200');
  await fillCalc('mitral', 'mit_mvVti', '12');
  await fillCalc('mitral', 'mit_lvotD', '2.0');
  await fillCalc('mitral', 'mit_lvotVti', '20');
  await new Promise((r) => setTimeout(r, 350));
  const mrOut = await outOf('mitral');
  check('二尖瓣页容积法 RVol 46.1 / RF 42.3',
    /容积法 RVol 46\.1 mL/.test(mrOut) && /容积法 RF 42\.3%/.test(mrOut), mrOut.slice(0, 140));
  check('二尖瓣页 PISA 路径 RF 43.4%（分母含反流量）',
    /反流分数 RF 43\.4%/.test(mrOut), mrOut.slice(-160));
  check('二尖瓣页 EROA ÷ LVEDV 判不成比例',
    /EROA ÷ LVEDV 0\.161.*不成比例/.test(mrOut), mrOut.slice(-160));

  await openCalc('dfun');
  await fillCalc('dfun', 'dfe', '80');
  await fillCalc('dfun', 'dfa', '60');
  await fillCalc('dfun', 'dfes', '10');
  await fillCalc('dfun', 'dfel', '14');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('dfun');
  check('舒张四步法 E/A 1.33 → 正常充盈', /1\.33/.test(o) && /正常充盈/.test(o), o);

  await openCalc('lvgeom');
  await fillCalc('lvgeom', 'rsbp', '140');
  await fillCalc('lvgeom', 'rlvedd', '5.5');
  await fillCalc('lvgeom', 'rpwt', '1.1');
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
  check('评分与随访已并入 recon；「介入尺寸、先心与随访」组 v1.5.3 起已拆散，旧组名不再出现',
    newGroupTitles.indexOf('评分与室壁运动') === -1 &&
    newGroupTitles.indexOf('随访与术中评估') === -1 &&
    newGroupTitles.indexOf('重构、室壁运动与心肌功能') !== -1 &&
    newGroupTitles.indexOf('介入尺寸、先心与随访') === -1, newGroupTitles);

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

  await openCalc('rvsyst');
  await fillCalc('rvsyst', 'rdt', '25');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('rvdvdt');
  check('RV dP/dt Δt25 → 480 mmHg/s', /480/.test(o), o);

  // ★ v1.9.6：合并页要给三段小标题（网页端一直正常，加断言防回归）
  const fgrpN = await c.evalJs(
    'document.querySelectorAll(\'#calcGroups .card[data-g="rvsyst"] .fx-fgrp\').length');
  check('合并页 rvsyst 渲染 3 段小标题', fgrpN === 3, fgrpN);
  const rvsTxt = await c.evalJs(
    '(function(){var c=document.querySelector(\'#calcGroups .card[data-g="rvsyst"]\');return c?c.textContent:"";})()');
  check('rvsyst 正文不再重复界值表（折叠区已有参考标准）',
    rvsTxt.indexOf('三个指标的正常界值') === -1 && rvsTxt.indexOf('怎么测') !== -1,
    rvsTxt.slice(0, 30));

  await openCalc('resist');
  await fillCalc('resist', 'ripvr', '6');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('residx');
  check('PVRI 6 WU × BSA → 指数化结果', /PVRI 1[0-9]\./.test(o), o);

  // ── v1.3.0 第三批：瓣膜与舒张细节 ──
  // v1.4.5：Wilkins 独立计算器并入二尖瓣评估页
  await openBrief('mitral');
  await fillCalc('mitral', 'wk1', '2');
  await fillCalc('mitral', 'wk2', '2');
  await fillCalc('mitral', 'wk3', '2');
  await fillCalc('mitral', 'wk4', '2');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('mitral');
  check('二尖瓣页 Wilkins 四面 2 分 → 8/16 适合 PBMV', /Wilkins 8\/16/.test(o) && /PBMV/.test(o), o);

  // v1.4.9：VCW 分级 / RF 反流分数两个纯查表计算器已删（分级参考值写在 MR / AR / TR 评估页里），
  // 对应的三条断言一并移除。

  await openBrief('mitral');
  await fillCalc('mitral', 'mit_lvotD', '2.0');
  await fillCalc('mitral', 'mit_lvotVti', '20');
  await fillCalc('mitral', 'mit_mvVti', '8');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('mitral');
  check('二尖瓣页 MVA 连续性方程 2.0/20/8 → 7.85', /7\.85/.test(o), o);

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

  await openCalc('lvgeom');
  await fillCalc('lvgeom', 'lhmass', '200');
  await fillCalc('lvgeom', 'lhheight', '170');
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

  // —— v1.7.5：心脏同步化（机械不同步）——
  await openCalc('sync');
  await fillCalc('sync', 'sy_spwmd', '60');
  await fillCalc('sync', 'sy_tssd', '45');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('sync');
  check('心脏同步化：SPWMD 60 + Ts-SD 45 → 1 项阳性（阈值 130 / 33）',
    /1 项阳性/.test(o) && /Ts-SD/.test(o), o);
  await pickOpt('sync', 'sy_flash', 'y');
  await new Promise((r) => setTimeout(r, 300));
  o = await outOf('sync');
  check('勾上室间隔闪动后 → 2 项阳性、证据较充分',
    /2 项阳性/.test(o) && /较充分/.test(o), o);

  await openCalc('mpap'); // 收尾回到列表
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
  check('折叠头显示 90 条', /90/.test(ri.cnt), refsInit);
  check('折叠头 aria-expanded=false、无 open 类',
    ri.aria === 'false' && ri.open === false, refsInit);

  await c.evalJs('(function(){document.getElementById("refsToggle").click();return 1;})()');
  await new Promise((r) => setTimeout(r, 200));
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
  check('点击后展开全部 90 条', ro.hidden === false && ro.n === 90 && ro.h > 0, refsOpen);
  check('展开后箭头状态与 aria 同步', ro.aria === 'true' && ro.open === true, refsOpen);
  check('展开后首条为 R1 中文标题', /指南|超声/.test(ro.first), refsOpen);

  // ── v1.6.6：目录顶部导航条末尾挂「参考文献」，点了直接展开并滚到文献卡 ──
  await c.evalJs('(function(){document.getElementById("refsToggle").click();return 1;})()');  // 先收起
  await new Promise((r) => setTimeout(r, 150));
  const refNav = await c.evalJs(`(function(){
    var nav = document.querySelector('#calcList .fx-nav');
    var chips = nav ? [...nav.querySelectorAll('.fx-nav__c')] : [];
    var b = document.querySelector('#calcList [data-refjump]');
    return JSON.stringify({
      has: !!b,
      txt: b ? b.textContent.trim() : '',
      last: chips.length ? chips[chips.length - 1].textContent.trim() : '',
      groups: chips.length,
      anchors: document.querySelectorAll('#calcList .fx-nav a[href^="#g-"]').length
    });
  })()`);
  const rn = JSON.parse(refNav);
  check('目录顶部导航条含「参考文献」标签', rn.has === true && rn.txt === '参考文献', refNav);
  check('「参考文献」排在导航条末尾', rn.last === '参考文献', refNav);
  check('导航条不再用 #g- 锚点（button + goToY，免得和视图栈 hash 打架）',
    rn.anchors === 0, refNav);
  await c.evalJs('(function(){document.querySelector("#calcList [data-refjump]").click();return 1;})()');
  // 平滑滚动是按距离计时的（8000+ px 要一两秒），轮询到位置稳定再断言
  let refJump = '';
  let lastY = -1;
  for (let i = 0; i < 25; i++) {
    refJump = await c.evalJs(`(function(){
      var l = document.getElementById('calcRefList');
      return JSON.stringify({
        open: l.hidden === false,
        h: l.offsetHeight,
        scrollY: Math.round(window.scrollY),
        refsTop: Math.round(document.getElementById('calcRefs').getBoundingClientRect().top)
      });
    })()`);
    const y = JSON.parse(refJump).scrollY;
    if (y === lastY && y > 200) break;
    lastY = y;
    await new Promise((r) => setTimeout(r, 150));
  }
  const rjInfo = JSON.parse(refJump);
  check('点「参考文献」标签自动展开文献列表', rjInfo.open === true && rjInfo.h > 0, refJump);
  check('点「参考文献」标签滚到文献卡（卡片顶部落在视口内）',
    Math.abs(rjInfo.refsTop) <= 120, refJump);
  check('滚动位置确实发生变化（不是停在页顶）', rjInfo.scrollY > 200, refJump);

  // 「需订阅」地址：可见、样式与免费直链区分、且指向 doi.org / 中华医学期刊网
  const subDl = await c.evalJs(`(function(){
    var items = [].slice.call(document.querySelectorAll('#calcRefList .ref-dl__i--sub'));
    var r1 = document.querySelector('#calcRefList .ref-item .ref-dl__i');
    var styl = items.length ? getComputedStyle(items[0]) : null;
    return JSON.stringify({
      n: items.length,
      txt: items.length ? items[0].textContent.trim() : '',
      border: styl ? styl.borderTopStyle : '',
      cnt: (document.getElementById('refsCount') || {}).textContent || '',
      r1txt: r1 ? r1.textContent.trim() : '',
      r1href: r1 ? r1.getAttribute('href') : ''
    });
  })()`);
  const sd = JSON.parse(subDl);
  // ★ 数量从数据源算，避免每加一条需订阅文献就要改断言
  const onlySubN = require('./miniprogram/utils/extra-data.js').REFS.filter(function (r) {
    return (r.dl || []).length && r.dl.every(function (x) { return x.t === '需订阅'; });
  }).length;
  check('「需订阅」胶囊渲染出 ' + onlySubN + ' 个（其余均可免费获取）', sd.n === onlySubN, subDl);
  check('「需订阅」胶囊文案为「需订阅」', sd.txt === '需订阅', subDl);
  check('「需订阅」用虚线灰边与免费直链区分', sd.border === 'dashed', subDl);
  check('折叠头同时给出免费直链条数', /条附免费直链/.test(sd.cnt), subDl);
  check('R1 标为「免费页面」且指向中华医学期刊网（进页面点 PDF 可下）',
    sd.r1txt === '免费页面' && /^https:\/\/rs\.yiigle\.com\/cmaid\//.test(sd.r1href), subDl);

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
  check('发布版保留 ValveCalc 与 SegSvg（瓣膜计算条目 + 节段页都要用）',
    st.valveEngine === 'object' && st.segEngine === 'object', stripped);

  const homeVer = await c.evalJs('document.querySelector("#page-index .verline") ? 1 : 0');
  check('首页显示版本行', homeVer === 1, homeVer);
  const verText = await c.evalJs('(document.querySelector("#page-index .verline") || {}).textContent || ""');
  check('版本号已递增（非 1.0.0）', /v\d+\.\d+\.\d+/.test(verText) && !/v1\.0\.0/.test(verText), verText);

  console.log('\n【三b】切面学习页签的瓣膜解剖条目（v1.7.9 从公式集移入）');
  await c.evalJs('document.querySelector(\'.tab[data-tab="calc"]\').click()');
  await new Promise((r) => setTimeout(r, 300));
  check('公式集目录已不再列出「瓣膜解剖 · TEE 标准切面」',
    (await c.evalJs('!document.querySelector(\'#calcList .fx-item[data-kind="valveana"]\')')) === true);
  await c.evalJs('document.querySelector(\'.tab[data-tab="segments"]\').click()');
  await new Promise((r) => setTimeout(r, 400));
  check('切面学习「切面速查与图谱」首条即「瓣膜解剖 · TEE 标准切面」',
    (await c.evalJs('(function(){var b=document.querySelector("#segLookList .fx-item");' +
      'return !!b && b.dataset.kind === "valveana";})()')) === true);
  await c.evalJs('document.querySelector(\'#segLookList .fx-item[data-kind="valveana"]\').click()');
  await new Promise((r) => setTimeout(r, 700));
  check('点条目后进入详情并显示解剖卡',
    (await c.evalJs('!document.querySelector(\'#calcGroups .card[data-g="valveana"]\').hidden')) === true);
  check('顶栏标题切到瓣膜解剖',
    (await c.evalJs('document.getElementById("appbarTitle").textContent')).indexOf('瓣膜解剖') !== -1);
  check('ValveSvg 视图数 = 13（只留 TEE）',
    (await c.evalJs('window.ValveSvg.VALVE_VIEWS.length')) === 13);
  check('全部是 TEE 切面（无 TTE 短轴 / 四腔心视图）',
    (await c.evalJs('window.ValveSvg.VALVE_VIEWS.every(function(v){return /TEE|经胃底|3D/.test(v.title);})')) === true);
  const vaFilled = await c.evalJs(
    '[...document.querySelectorAll(".wallsvg-box[id^=va-]")]' +
    '.filter(function(e){return e.querySelector("svg");}).length');
  check('13 张示意图全部已渲染 SVG', vaFilled === 13, vaFilled);
  const probeFilled = await c.evalJs(
    '[...document.querySelectorAll(".va-probe")]' +
    '.filter(function(e){return e.querySelector("svg");}).length');
  check('13 张探头位置小图全部已渲染', probeFilled === 13, probeFilled);
  check('示意图含可点击分区标记',
    (await c.evalJs('document.querySelectorAll(\'#calcGroups .card[data-g="valveana"] g[data-part]\').length')) > 0);
  check('色块按钮存在',
    (await c.evalJs('document.querySelectorAll(\'#calcGroups .card[data-g="valveana"] [data-vap]\').length')) > 0);
  // 点色块 → 跨视图同步高亮
  await c.evalJs('document.querySelector(\'#calcGroups .card[data-g="valveana"] [data-vap="rcc"]\').click()');
  await new Promise((r) => setTimeout(r, 400));
  check('点「RCC」后三张主动脉瓣图同步高亮',
    (await c.evalJs('document.querySelectorAll(\'#calcGroups .card[data-g="valveana"] .segchip--on\').length')) >= 1);
  check('高亮说明列出该分区出现的所有视图',
    (await c.evalJs('(document.getElementById("vaSelInfo")||{textContent:""}).textContent')).indexOf('见于') !== -1);
  // 返回切面学习（v1.7.9：从切面学习进入，返回文案随之变为「返回切面学习」）
  check('从切面学习进入时返回按钮文案为「返回切面学习」',
    (await c.evalJs('document.getElementById("calcBack").textContent')).indexOf('切面学习') !== -1);
  await c.evalJs('document.getElementById("calcBack").click()');
  await new Promise((r) => setTimeout(r, 400));
  check('返回切面学习后该页签重新激活',
    (await c.evalJs('document.querySelector(\'.tab[data-tab="segments"]\').classList.contains("tab--on")')) === true);
  const refCopy = await c.evalJs(`(function(){
    const el = document.querySelector('#calcRefs .refs-copy');
    return el ? el.textContent.replace(/\\s+/g, '') : '';
  })()`);
  check('参考文献末尾含版权声明（三端一致）',
    /著作权均?归原作者与发布机构所有/.test(refCopy) ? 1 : 0, 1, 0);

  // ★ 2026-10-22：app.css 曾把 style 闭标签写成注释字面量，内联后提前结束
  //   样式表，导致页面顶部露出一段 CSS 注释。这里做运行时兜底。
  const leak = await c.evalJs(`(function () {
    const out = [];
    document.querySelectorAll('style').forEach(function (s, i) {
      if (s.textContent.indexOf('<' + '/style>') !== -1) out.push('style#' + i);
    });
    Array.prototype.forEach.call(document.body.childNodes, function (n) {
      if (n.nodeType === 3 && n.textContent.trim().length > 8) {
        out.push('裸文本:' + n.textContent.trim().slice(0, 20));
      }
    });
    return out.join(' | ');
  })()`);
  check('CSS 注释未被泄漏成页面可见文字', leak === '', leak === '' ? '干净' : leak);

  check('瓣膜解剖不再单列教学资源（与切面学习/在线演示重复）',
    (await c.evalJs('document.querySelectorAll("#calcGroups .va-lesson").length')) === 0);

  /* ────────────────────────────────────────────────────────────
     【三c】条目内小节导航真的能滚
     用户 2026-10-22 报「APK 公式集点进去的导航点不动，小程序正常」。
     根因是 window.scrollTo({behavior:'smooth'}) 在部分 Android WebView 里
     静默失效，已改为 goToY() 带 420ms 兜底。这里做真实点击回归：
     打开小节数最多的条目 → 点第 4 个胶囊 → 断言 scrollY 明显大于 0。
     ★ 必须放在文件末尾：中途切页签会让后面的断言全红。
     ──────────────────────────────────────────────────────────── */
  console.log('\n【三c】条目内小节导航（点胶囊真的会滚）');
  await c.evalJs(`(function(){
    document.querySelector('.tab[data-tab="calc"]').click();
    const card = document.querySelector('#calcGroups .card[data-g="tavr"]');
    if (!card) return 'noc';
    document.getElementById('calcIndex').hidden = true;
    document.getElementById('calcDetail').hidden = false;
    card.hidden = false;
    window.scrollTo(0, 0);
    return card.querySelectorAll('.fx-nav--sec .fx-nav__c').length;
  })()`);
  const navN = await c.evalJs(
    'document.querySelectorAll(\'#calcGroups .card[data-g="tavr"] .fx-nav--sec .fx-nav__c\').length');
  check('TAVR 条目渲染出 8 个小节导航胶囊', navN === 8, navN);
  await c.evalJs(
    'document.querySelector(\'#calcGroups .card[data-g="tavr"] .fx-nav--sec .fx-nav__c:nth-child(5)\').click()');
  await new Promise((r) => setTimeout(r, 900));
  const scrollInfo = await c.evalJs(`(function(){
    return JSON.stringify({
      wy: Math.round(window.scrollY),
      de: Math.round(document.documentElement.scrollTop),
      bd: Math.round(document.body.scrollTop),
      sec4: Math.round((document.getElementById('sec-4-tavr')||{getBoundingClientRect:function(){return{top:-9999}}}).getBoundingClientRect().top)
    });
  })()`);
  const navSc = JSON.parse(scrollInfo);
  const scrolled = Math.max(navSc.wy, navSc.de, navSc.bd);
  check('点第 5 个胶囊后页面确实向下滚动', scrolled > 200, scrollInfo);
  const atTarget = await c.evalJs(`(function(){
    const el = document.getElementById('sec-4-tavr');
    if (!el) return -1;
    const dy = Math.round(el.getBoundingClientRect().top);
    // 顶栏 56px 遮挡余量，落在 -80 ~ +200 之间即算定位正确
    return (dy > -80 && dy < 200) ? 1 : dy;
  })()`);
  check('滚动落点对准目标小节（顶栏留 56px 余量）', atTarget === 1, atTarget);
  await c.evalJs('window.scrollTo(0, 0)');

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
