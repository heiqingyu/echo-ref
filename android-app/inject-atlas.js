/**
 * APK 专用「文献图谱」注入器
 * 只在 android-app/assets/index.html 上执行；docs/index.html（网页版）与小程序源码不动。
 * 由 build-apk.bat 第 0 步在 copy docs -> assets 之后调用。
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const HTML = path.join(ROOT, 'assets', 'index.html');
const SRC = path.join(ROOT, 'atlas-src');
const DEST = path.join(ROOT, 'assets', 'atlas');
const B = '<!-- APK_ATLAS_BEGIN -->';
const E = '<!-- APK_ATLAS_END -->';

if (!fs.existsSync(HTML)) {
  console.error('[atlas] assets/index.html not found; run build-www.js + copy first');
  process.exit(1);
}

// 1) 复制图片到 assets/atlas（先删后建，绕开本机覆盖写限制）
if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST, { recursive: true });
const files = fs.readdirSync(SRC).filter(function (f) { return /\.(jpg|jpeg|png|webp)$/i.test(f); });
files.forEach(function (f) { fs.copyFileSync(path.join(SRC, f), path.join(DEST, f)); });
console.log('[atlas] copied ' + files.length + ' images');

// 2) 生成图谱数据
function cap(title, src, note) {
  return { t: title, s: 'atlas/' + src, n: note };
}
var bavNotes = [
  ['BAV 疾病谱与命名', 'R126 Figure 1'],
  ['TTE 诊断 BAV（短轴/长轴）与病理对照', 'R126 Figure 2'],
  ['主动脉根部综合体示意（瓣环/窦/STJ）', 'R126 Figure 3'],
  ['融合型三型 TTE 短轴示意图（右左/右无/左无）', 'R126 Figure 4'],
  ['非融合瓣叶交界角对称性 TTE 短轴示意', 'R126 Figure 5'],
  ['TEE 测量非融合瓣叶交界角', 'R126 Figure 6'],
  ['双窦型 BAV 两亚型 TTE 短轴示意', 'R126 Figure 7'],
  ['双窦型 BAV 的 TTE 与 CT 图像', 'R126 Figure 8'],
  ['部分融合型 BAV TTE 短轴示意', 'R126 Figure 9'],
  ['BAV 主动脉病变三表型', 'R126 Figure 10'],
  ['BAV 解剖谱系（部分融合→融合→双窦）', 'R126 Figure 11'],
  ['BAV 关键影像评估流程', 'R126 Figure 12']
];
var groups = [
  {
    k: 'bav', n: '主动脉瓣 · 分叶分型（TTE 短轴）',
    d: '按 R125/R126 国际共识原图；Figure 4/5/7/9 均为胸骨旁短轴 TTE 视角的示意图。',
    items: bavNotes.map(function (x, i) { return cap(x[0], 'bav-f' + String(i + 1).padStart(2, '0') + '.jpg', x[1]); })
  },
  {
    k: 'mrhd', n: '二尖瓣 · 风湿性瓣叶与交界（TTE/TEE）',
    d: 'ASE 2022 风湿性心脏病评估建议原图页面；含瓣口描记、交界融合、3D en face 等。',
    items: files.filter(function (f) { return f.indexOf('mrhd-ase22-') === 0; }).sort().map(function (f, i) {
      return cap('风湿性二尖瓣影像原图 ' + (i + 1), f, 'R42 · ASE 2022 原图页面');
    })
  },
  {
    k: 'tte', n: 'TTE 标准切面与扫查指引',
    d: 'ASE 2019 成人完整经胸超声心动图操作指南原图页面（扫描平面、声窗、扫查手法）。',
    items: files.filter(function (f) { return f.indexOf('tte-ase19-') === 0; }).sort().map(function (f) {
      var p = (f.match(/p(\d+)/) || [])[1] || '?';
      return cap('TTE 指南原图 · 第 ' + p + ' 页', f, 'R9 · ASE 2019 · 官方中文/英文 PDF');
    })
  },
  {
    k: 'tee', n: 'TEE 标准切面与扫查指引',
    d: 'ASE/SCA 2013 成人完整经食管超声心动图检查指南原图页面。',
    items: files.filter(function (f) { return f.indexOf('tee-ase13-') === 0; }).sort().map(function (f, i) {
      return cap('TEE 指南原图 ' + (i + 1), f, 'R10 · ASE/SCA 2013');
    })
  },
  {
    k: 'aha', n: '三尖瓣 · AHA 2024（R127）',
    d: 'AHA 科学声明 Figure 3 的原图受站点保护，这里给出逐 panel 指引；DOI 可点开看原图。',
    items: [{
      t: 'Figure 3 · TTE/TEE/MPR 三尖瓣解剖定位（9 格）',
      s: '',
      n: 'A 右室流入道见隔叶；B 主动脉瓣水平短轴；C 短轴 en face；D 心尖四腔上翘见 LVOT（前叶+隔叶）；E 心尖四腔下压见冠状静脉窦（后叶+隔叶，P1/P2）；F 3D TTE；G TEE 双平面 P1-S；H TEE 胃底 en face（四叶）；I 多平面重建（Ⅳ型）。',
      u: 'https://doi.org/10.1161/CIR.0000000000001232'
    }, {
      t: 'Figure 1 · 三尖瓣解剖与分叶变异',
      s: '',
      n: 'Ⅰ型三叶、Ⅱ型二叶、Ⅲ型四叶（IIIA 双前叶 / IIIB 双后叶 / IIIC 双隔叶）、Ⅳ型>4 叶；另有右冠状动脉、房室结、冠状静脉窦的邻接关系。',
      u: 'https://doi.org/10.1161/CIR.0000000000001232'
    }]
  }
];

var data = JSON.stringify(groups).replace(/</g, '\\u003c');

var css = [
  // 悬浮按钮已移除（入口改到切面速查区块的条目），只保留面板样式
  '#apkAtlas{position:fixed;inset:0;z-index:1300;background:#f5f7fa;display:none;flex-direction:column;color:#1c2530}',
  '#apkAtlas.is-open{display:flex}',
  '#apkAtlas .at-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#fff;border-bottom:1px solid #dde3ea}',
  '#apkAtlas .at-head b{font-size:16px;flex:1}',
  '#apkAtlas .at-head button{border:1px solid #ccd4dd;background:#fff;color:#334;border-radius:6px;padding:5px 12px;font-size:14px}',
  '#apkAtlas .at-tabs{display:flex;gap:6px;overflow-x:auto;padding:9px 12px;background:#fff;border-bottom:1px solid #e5eaf0}',
  '#apkAtlas .at-tab{flex:none;border:1px solid #d3dbe4;background:#fff;color:#334;border-radius:16px;padding:6px 11px;font-size:12px}',
  '#apkAtlas .at-tab.on{background:#0b6fb8;border-color:#0b6fb8;color:#fff}',
  '#apkAtlas .at-desc{padding:9px 14px;font-size:12px;line-height:1.6;color:#556;border-bottom:1px solid #e5eaf0;background:#fff}',
  '#apkAtlas .at-list{flex:1;overflow:auto;padding:10px 12px 40px}',
  '#apkAtlas .at-card{background:#fff;border:1px solid #e2e8ef;border-radius:8px;margin:0 0 12px;padding:10px}',
  '#apkAtlas .at-card h4{margin:0 0 6px;font-size:14px;color:#163b5b}',
  '#apkAtlas .at-card img{width:100%;display:block;border:1px solid #e6ebf1;border-radius:4px;cursor:zoom-in}',
  '#apkAtlas .at-card p{margin:7px 0 0;font-size:12px;line-height:1.65;color:#54626f}',
  '#apkAtlas .at-card a{color:#0b6fb8;font-size:12px}',
  '#apkAtlas .at-note{background:#fff8e6;border:1px solid #f0dfae;border-radius:6px;padding:8px 10px;font-size:12px;color:#66552c;line-height:1.6}',
  // ★ 放大层挂到 body（不放在 #apkAtlas 内），避免点缩略图后事件冒泡到自身遮罩被立刻关掉
  '.at-zoom{position:fixed;inset:0;z-index:1400;background:rgba(0,0,0,.92);display:none;align-items:center;justify-content:center;overflow:auto}',
  '.at-zoom.on{display:flex}',
  '.at-zoom img{max-width:100%;max-height:88vh}',
  '.at-zoom .at-zoom-tip{position:fixed;bottom:18px;left:0;right:0;text-align:center;color:#fff;font-size:13px;opacity:.85;pointer-events:none}'
].join('');

var html = [
  B,
  '<div id="apkAtlas" role="dialog" aria-label="文献图谱">',
  '  <div class="at-head"><b>文献图谱（APK 专用）</b><button type="button" id="atClose">关闭</button></div>',
  '  <div class="at-tabs" id="atTabs"></div>',
  '  <div class="at-desc" id="atDesc"></div>',
  '  <div class="at-list" id="atList"></div>',
  '</div>',
  '<style>' + css + '</style>',
  '<script>',
  '(function(){',
  '  var G=' + data + ';',
  '  var box=document.getElementById("apkAtlas"),list=document.getElementById("atList"),tabs=document.getElementById("atTabs"),desc=document.getElementById("atDesc");',
  '  if(!box||!list||!tabs)return;',
  '  var zoom=document.createElement("div");zoom.className="at-zoom";zoom.id="atZoom";',
  '  var zimg=document.createElement("img");zimg.id="atZoomImg";zimg.alt="图谱大图";',
  '  var tip=document.createElement("div");tip.className="at-zoom-tip";tip.textContent="点任意处关闭大图";',
  '  zoom.appendChild(zimg);zoom.appendChild(tip);document.body.appendChild(zoom);',
  '  function render(k){',
  '    var g=G.filter(function(x){return x.k===k})[0]||G[0];',
  '    tabs.innerHTML="";',
  '    G.forEach(function(x){var b=document.createElement("button");b.type="button";b.className="at-tab"+(x.k===k?" on":"");b.textContent=x.n.replace(/（.*?）/g,"");b.onclick=function(){render(x.k)};tabs.appendChild(b)});',
  '    desc.textContent=g.d;list.innerHTML="";',
  '    g.items.forEach(function(it){',
  '      var c=document.createElement("div");c.className="at-card";',
  '      var h=document.createElement("h4");h.textContent=it.t;c.appendChild(h);',
  '      if(it.s){var im=document.createElement("img");im.src=it.s;im.alt=it.t;im.loading="lazy";im.onclick=function(ev){ev.stopPropagation();ev.preventDefault();zimg.src=it.s;zoom.classList.add("on")};c.appendChild(im)}',
  '      var p=document.createElement("p");p.textContent=(it.n||"")+"  "+it.s.replace("atlas/", "");c.appendChild(p);',
  '      if(it.u){var a=document.createElement("a");a.href=it.u;a.target="_blank";a.textContent="打开原文 DOI";c.appendChild(a)}',
  '      list.appendChild(c)',
  '    });',
  '    if(!g.items.length){var z=document.createElement("div");z.className="at-note";z.textContent="暂无图片";list.appendChild(z)}',
  '  }',
  '  function openAtlas(){box.classList.add("is-open");render("bav")}',
  '  function closeAtlas(){box.classList.remove("is-open");zoom.classList.remove("on")}',
  '  document.getElementById("atClose").onclick=closeAtlas;',
  '  zoom.onclick=closeAtlas;',
  '  document.addEventListener("keydown",function(e){if(e.key==="Escape")closeAtlas()});',
  '  var look=document.getElementById("lookpart");',
  '  if(look){',
  '    var en=document.createElement("button");en.className="fx-item";en.id="apkAtlasEntry";en.type="button";',
  '    en.innerHTML=\'<span class="fx-item__main"><span class="fx-item__n">瓣膜分叶与标准切面 · 文献原图图谱</span><span class="fx-item__d">主动脉瓣 / 二尖瓣 / 三尖瓣 + TTE / TEE 指南原图 · ' + files.length + ' 张 · 点图放大（APK 专用）</span></span><span class="fx-item__a">' + files.length + ' 图 ›</span>\';',
  '    en.onclick=function(ev){ev.stopPropagation();ev.preventDefault();openAtlas()};',
  '    look.appendChild(en);',
  '  }',
  '  window.__apkAtlasCount=' + files.length + ';',
  '})();',
  '</script>',
  E
].join('\n');

var raw = fs.readFileSync(HTML, 'utf8');
if (raw.indexOf(B) !== -1) {
  var s = raw.indexOf(B), e = raw.indexOf(E) + E.length;
  raw = raw.slice(0, s) + raw.slice(e);
}
if (raw.indexOf('</body>') === -1) {
  console.error('[atlas] no </body> in assets/index.html');
  process.exit(1);
}
raw = raw.replace('</body>', html + '</body>');
if (fs.existsSync(HTML)) fs.unlinkSync(HTML);
fs.writeFileSync(HTML, raw, 'utf8');
console.log('[atlas] injected into assets/index.html, ' + Buffer.byteLength(raw, 'utf8') + ' bytes');
