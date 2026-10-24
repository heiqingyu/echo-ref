/* ══════════════════════════════════════════════════════════
   心脏超声参考值 · 单页应用逻辑
   引擎来自 window.Core（成人）与 window.Peds（儿童），由小程序源码自动抽取
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const Core = window.Core;
  const Peds = window.Peds;
  const Calc = window.Calc;
  const ValveCalc = window.ValveCalc;

  /* ══════════ 全局状态（对应小程序的 app.globalData） ══════════ */
  const state = {
    sex: 'male',
    height: 170,
    weight: 65,
    bsa: 0,
    formula: 'dubois',      // dubois | mosteller
    standard: 'CN',         // CN | ASE
    measurements: null,      // EF 页的测量值
    peds: null,
  };

  const $ = (id) => document.getElementById(id);

  /** 可空取值：发布版会移除部分页面，相关元素可能不存在 */
  function q(id) { return document.getElementById(id); }

  /** 给可能不存在的元素设置文本，不存在则静默跳过 */
  function setText(id, text) {
    const el = q(id);
    if (el) el.textContent = text;
  }

  /* ══════════════════════════════════════════════════════════
     一、页签切换
     ══════════════════════════════════════════════════════════ */

  const TAB_TITLE = {
    index: 'EF·参考值',
    calc: '公式集',
    valves: '瓣膜评估',
    peds: '儿童 Z 值',
    segments: '节段划分',
    valveana: '瓣膜解剖',
  };

  let currentTab = 'index';

  /**
   * ── 视图栈（history） ──
   *
   * 用户 2026-10-21 反馈：「在公式集里点击返回就直接退出页面 / APP，
   * 不是返回上一页」。
   *
   * 根因：本页是单页应用，切换视图只改 hidden 属性，从不写 history，
   * 于是 WebView 的 canGoBack() 恒为 false —— APK 的返回键
   * （MainActivity.onKeyDown）无处可退，只能退出 APP；
   * 浏览器的后退键同理，会直接离开站点。
   *
   * 做法：用 location.hash 记录当前视图（进入详情时写一次），
   * 返回时 history.back()，再由 hashchange / popstate 把界面还原。
   *
   * ★ 为什么用 hash 而不是 history.pushState：
   *   APK 里页面是 file:///android_asset/index.html，file:// 是 opaque origin，
   *   pushState 会抛 SecurityError（已 try/catch 兜底，但那样就没历史了）。
   *   改 hash 在 file:// 下照常创建历史条目，WebView.canGoBack() 会变 true，
   *   APK 返回键就能正确回退。
   *
   * ★ hash 前缀用 "/"，与目录页的组名锚点（#g-xxx）不冲突。
   */
  let viewStack = [];     // 已进入的子视图栈
  let lastHash = null;    // 已处理过的 hash（用于去重 + 抑制自己写的变更）

  /** 视图状态 → hash */
  function viewHash(v) {
    if (v.type === 'calc') return '#/calc/' + encodeURIComponent(v.id);
    if (v.type === 'album') return '#/album/' + encodeURIComponent(v.sec) + '/' + encodeURIComponent(v.id);
    return '#/calc';
  }

  /** hash → 视图状态（不是本应用的视图 hash 就返回 null） */
  function parseHash() {
    const h = location.hash || '';
    if (h.indexOf('#/') !== 0) return null;
    const parts = h.slice(2).split('/');
    if (parts[0] === 'calc' && parts[1]) {
      return { type: 'calc', id: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === 'album' && parts[1] && parts[2]) {
      return { type: 'album', sec: decodeURIComponent(parts[1]), id: decodeURIComponent(parts[2]) };
    }
    return { type: 'calcIndex' };
  }

  /**
   * 进入子视图：写一次 hash，产生一条历史条目
   * 先把 lastHash 记成新值，随后到来的 hashchange 因「值没变」而被跳过
   */
  function pushView(v) {
    const h = viewHash(v);
    if ((location.hash || '') === h) return;   // 同一视图，不重复压栈
    viewStack.push(v);
    lastHash = h;
    location.hash = h;
  }

  /**
   * 退出子视图
   *
   * 两件事同时做：
   *   1) 立刻还原界面（用户点了返回按钮就该马上变，不能等异步的 hashchange）
   *   2) history.back() 退掉那条历史条目，让 APK / 浏览器返回键也能退
   * 随后到来的 popstate / hashchange 会再还原一次同样的界面（幂等，无副作用）
   */
  function popView() {
    restoreCalcIndex();
    if (viewStack.length) history.back();
  }

  /** 按视图状态还原界面 */
  function restoreView(v) {
    if (!v) v = { type: 'calcIndex' };
    if (v.type === 'calc') {
      switchTab('calc');
      openCalcGroup(v.id, true);
    } else if (v.type === 'album') {
      switchTab('calc');
      openAlbum(v.sec, v.id, true);
    } else {
      restoreCalcIndex();
    }
  }

  /**
   * 导航事件（popstate 与 hashchange 都会触发，用 lastHash 去重）
   * file:// 下部分 WebView 只派发其中一个，两个都监听更稳
   */
  function onNavEvent() {
    const h = location.hash || '';
    if (h === lastHash) return;    // 已处理过（popstate + hashchange 双触发）
    lastHash = h;
    if (viewStack.length) viewStack.pop();
    restoreView(parseHash());
  }

  window.addEventListener('hashchange', onNavEvent);
  window.addEventListener('popstate', onNavEvent);

  function switchTab(name) {
    if (!TAB_TITLE[name]) return;
    currentTab = name;

    document.querySelectorAll('.page').forEach(function (el) {
      el.hidden = el.id !== 'page-' + name;
    });
    document.querySelectorAll('.tab').forEach(function (el) {
      el.classList.toggle('tab--on', el.dataset.tab === name);
    });
    $('appbarTitle').textContent = TAB_TITLE[name];

    // 切页时刷新数据
    if (name === 'peds') renderPeds();
    // 切到公式集页时重置为目录视图（直接还原界面，不动 history：
    // 切页签不是「往上一层」，不该触发返回）
    if (name === 'calc') { restoreCalcIndex(); renderCalc(); }
    if (name === 'valves') renderValves();
    if (name === 'valveana') renderValveAna();
    if (name === 'index') renderIndex();

    window.scrollTo(0, 0);
    if (typeof syncToTop === 'function') {
      requestAnimationFrame(syncToTop);
    }
  }

  document.querySelectorAll('.tab').forEach(function (el) {
    el.addEventListener('click', function () { switchTab(el.dataset.tab); });
  });

  document.querySelectorAll('[data-go]').forEach(function (el) {
    el.addEventListener('click', function () { switchTab(el.dataset.go); });
  });

  /* ══════════════════════════════════════════════════════════
     回到顶部：公式集目录很长（100+ 条），滚下去后给个回顶按钮
     只在公式集页出现，其它页签一律隐藏
     ══════════════════════════════════════════════════════════ */
  const toTopBtn = document.createElement('button');
  toTopBtn.type = 'button';
  toTopBtn.className = 'totop';
  toTopBtn.setAttribute('aria-label', '回到顶部');
  toTopBtn.textContent = '↑';
  document.body.appendChild(toTopBtn);

  function syncToTop() {
    toTopBtn.classList.toggle('totop--on', currentTab === 'calc' && window.scrollY > 420);
  }
  window.addEventListener('scroll', syncToTop, { passive: true });

  /**
   * 平滑滚动到指定纵向位置，带兜底
   *
   * ★ 必须带兜底：部分 Android WebView（以及系统开了「减少动态效果」时）
   *   对 scrollTo({behavior:'smooth'}) 完全无反应 —— 表现为「点了没动静」。
   *   用户 2026-10-21 报的「APK 里回到顶部点了不动」、2026-10-22 报的
   *   「公式集点进去的小节导航点不动」都是这一个根因。
   *   这里统一：先试平滑，420ms 后若位置没变就直接跳过去。
   */
  function goToY(top) {
    const y = Math.max(0, Math.round(top));
    const before = window.scrollY;
    try {
      window.scrollTo({ top: y, behavior: 'smooth' });
    } catch (e) { /* 老 WebView 不认对象参数 */ }
    setTimeout(function () {
      // 平滑滚动已经开始移动时不要打断，只处理「一点没动」的情况
      if (window.scrollY === before && before !== y) window.scrollTo(0, y);
    }, 420);
  }

  toTopBtn.addEventListener('click', function () { goToY(0); });

  /* ══════════════════════════════════════════════════════════
     二、分段选择器（通用）
     ══════════════════════════════════════════════════════════ */

  /**
   * 同一个 data-seg 分组内的选择器保持同步（如「性别」在多页都有）
   * 切换后回调 onPick(group, value)
   */
  const segHandlers = {
    sex: function (v) { state.sex = v; renderIndex(); },
    formula: function (v) { state.formula = v; renderIndex(); },
    standard: function (v) { state.standard = v; renderIndex(); },
    pdsex: function () { /* 儿童 Z 值不区分性别，仅作记录 */ },
    calccollapse: function (v) { calcCollapse = v; renderCalc(); },
    calcsigns: function (v) { calcSigns = v; renderCalc(); },
    valveivc: function (v) { valveIvc = v; renderValves(); },
  };

  document.querySelectorAll('.seg').forEach(function (seg) {
    seg.querySelectorAll('.seg__i').forEach(function (item) {
      item.addEventListener('click', function () {
        const group = seg.dataset.seg;
        const val = item.dataset.v;

        // 同步所有同组选择器
        document.querySelectorAll('.seg[data-seg="' + group + '"]').forEach(function (s) {
          s.querySelectorAll('.seg__i').forEach(function (i) {
            i.classList.toggle('seg__i--on', i.dataset.v === val);
          });
        });

        const fn = segHandlers[group];
        if (fn) fn(val);
      });
    });
  });

  /** 以程序方式设置某个分段选择器的值（并同步同组） */
  function setSeg(group, val) {
    document.querySelectorAll('.seg[data-seg="' + group + '"]').forEach(function (s) {
      s.querySelectorAll('.seg__i').forEach(function (i) {
        i.classList.toggle('seg__i--on', i.dataset.v === val);
      });
    });
  }

  /* ══════════════════════════════════════════════════════════
     三、Tab1 基本参数
     ══════════════════════════════════════════════════════════ */

  function computeBsa() {
    const h = parseFloat($('inHeight').value);
    const w = parseFloat($('inWeight').value);
    const valid = h > 50 && h < 250 && w > 2 && w < 300;

    if (!valid) return { valid: false, bsa: 0 };

    const bsa = state.formula === 'dubois'
      ? Core.bsaDuBois(h, w)
      : Core.bsaMosteller(h, w);

    return { valid: true, bsa: bsa, h: h, w: w };
  }

  function renderIndex() {
    const r = computeBsa();

    if (!r.valid) {
      $('outBsa').textContent = '—';
      $('outBsaLbl').textContent = '体表面积';
      $('outBmi').textContent = '—';
      $('outBmiTag').textContent = '';
      $('bsaHint').textContent =
        ($('inHeight').value && $('inWeight').value)
          ? '请输入有效的身高（50–250 cm）与体重（2–300 kg）'
          : '';
      state.bsa = 0;
      setText('calcBsaNote', '按主题分组，点击条目进入公式 · BSA —（请先在上方填写有效身高体重）');
      // renderEF 内部会刷新参考值列表；EF 结果的 LVM/BSA 也随 BSA 变化
      renderEF();
      renderValves();
      return;
    }

    state.height = r.h;
    state.weight = r.w;
    state.bsa = Core.round(r.bsa, 3);

    $('outBsa').textContent = r.bsa.toFixed(2);
    $('outBsaLbl').textContent = '体表面积（' +
      (state.formula === 'dubois' ? 'Du Bois' : 'Mosteller') + '）';

    // BMI（中国成人标准 WS/T 428-2013）
    const b = Core.bmi(r.h, r.w);
    const bc = Core.bmiClass(b);
    $('outBmi').textContent = b.toFixed(1);
    $('outBmiTag').textContent = bc.text;
    $('outBmiTag').className = 'bmi-tag bmi--' + bc.level;

    $('bsaHint').textContent = '';
    setText('calcBsaNote',
      '按主题分组，点击条目进入公式 · BSA ' + state.bsa.toFixed(2) + ' m²（来自本页上方）');

    // 参考值列表、EF 结果（LVM/BSA）与计算页都依赖 BSA，一并刷新
    renderEF();
    renderValves();
  }

  ['inHeight', 'inWeight'].forEach(function (id) {
    $(id).addEventListener('input', renderIndex);
  });

  // 「查看下方参考值」平滑滚动
  if ($('jumpRef')) $('jumpRef').addEventListener('click', function () {
    const el = $('refBlock');
    if (!el) return;
    // 与其它跳转统一走 goToY：APK 的 WebView 不认 smooth，必须有兜底
    goToY(el.getBoundingClientRect().top + window.pageYOffset - 56);
  });

  /* ══════════════════════════════════════════════════════════
     四、Tab2 参考值
     ══════════════════════════════════════════════════════════ */

  const STD_NOTE = {
    CN: '《中国成年人超声心动图检查测量指南》(2016) · 95% 参考范围',
    ASE: 'ASE/EACVI 2015 Reference limits for cardiac chamber quantification in adults',
  };

  const STD_SOURCE = {
    CN: '中华医学会超声医学分会《中国成年人超声心动图检查测量指南》（2016，95% 参考范围，37 项）',
    ASE: 'ASE/EACVI 2015《Recommendations for Cardiac Chamber Quantification in Adults》',
  };

  function renderReference() {
    // 同步到顶栏下的说明
    $('stdNote').textContent = STD_NOTE[state.standard];

    $('aseUnitNote').hidden = state.standard !== 'ASE';

    // 若 EF 页算过，组装实测值字典
    let measured = null;
    let hasM = false;
    if (state.measurements) {
      const m = state.measurements;
      measured = Core.measurementsToRefDict({
        lvedd: m.lvedd,
        lvesd: m.lvesd,
        ivsd: m.ivsd,
        lvpwd: m.lvpwd,
        bsa: state.bsa,
        height: state.height,
      });
      hasM = true;
    }

    const rows = Core.buildReferenceList(state.sex, measured, state.standard, state.bsa);

    $('refTitle').textContent = hasM ? '实测值对照' : '正常参考范围';
    $('refDesc').textContent = hasM
      ? '已关联上方 EF 计算的测量值，下表显示实测值与参考范围的对照结果。'
      : (state.sex === 'male' ? '男性' : '女性') + ' · ' + STD_NOTE[state.standard];

    $('refSource').textContent = '参考值来源：' + STD_SOURCE[state.standard];

    // 渲染列表
    let html = '';
    if (hasM) {
      html += headerRow(['参数', '实测', '参考范围', '判定']);
    } else {
      html += headerRow(['参数', '参考范围', '']);
    }

    rows.forEach(function (r) {
      const nameCell = '<div class="list-row__n">' + esc(r.name) + '（' + esc(r.key) + '）' +
        (r.hasDerived
          ? '<span class="derived">按当前 BSA 折算 ' + esc(r.derivedText) + ' ' + esc(r.derivedUnit) + '</span>'
          : '') +
        '</div>';

      if (hasM) {
        html += '<div class="list-row">' + nameCell +
          '<div class="list-row__v">' + esc(r.value) + esc(r.unit) + '</div>' +
          '<div class="list-row__r">' + esc(r.range) + '</div>' +
          '<div class="list-row__g"><span class="tag ' + r.statusCls + '">' + esc(r.statusText) + '</span></div>' +
          '</div>';
      } else {
        html += '<div class="list-row">' + nameCell +
          '<div class="list-row__r" style="flex:1.6">' + esc(r.range) + ' ' + esc(r.unit) + '</div>' +
          '<div class="list-row__g"></div>' +
          '</div>';
      }
    });

    $('refList').innerHTML = html;
  }

  function headerRow(cols) {
    let h = '<div class="list-row" style="border-bottom:1px solid #e3e6ea">';
    h += '<div class="list-row__n" style="font-weight:600">' + cols[0] + '</div>';
    h += '<div class="list-row__v" style="font-weight:600">' + cols[1] + '</div>';
    h += '<div class="list-row__r" style="font-weight:600">' + cols[2] + '</div>';
    h += '<div class="list-row__g" style="font-weight:600;color:#6b7280">' + (cols[3] || '') + '</div>';
    h += '</div>';
    return h;
  }

  /* ══════════════════════════════════════════════════════════
     五、Tab1 EF 计算（与参考值同页，置于卡片最上方）
     ══════════════════════════════════════════════════════════ */

  const EF_IDS = ['efLvedd', 'efLvesd', 'efIvsd', 'efLvpwd'];

  function renderEF() {
    const lvedd = parseFloat($('efLvedd').value);
    const lvesd = parseFloat($('efLvesd').value);
    const ivsd = parseFloat($('efIvsd').value);
    const lvpwd = parseFloat($('efLvpwd').value);

    // 需要 LVIDd + LVIDs 才能算收缩功能
    const canCalc = lvedd > 0 && lvesd > 0 && lvedd > lvesd;

    if (!canCalc) {
      $('efResult').hidden = true;
      state.measurements = null;
      if ((lvedd || lvesd) && lvedd <= lvesd) {
        $('efHint').textContent = '舒张末内径应大于收缩末内径，请核对。';
      } else if ($('efLvedd').value && $('efLvesd').value) {
        $('efHint').textContent = '请输入有效内径（mm）。';
      } else {
        $('efHint').textContent = '';
      }
      // 同页的参考值列表要跟着退回「正常参考范围」
      renderReference();
      return;
    }

    $('efHint').textContent = '';

    const fn = Core.computeLVFunction(lvedd, lvesd);
    const lvm = Core.computeLVM(lvedd, ivsd || 0, lvpwd || 0, state.bsa);
    const rwt = Core.computeRWT(lvedd, lvpwd || 0);
    const grade = Core.gradeEF(fn.EF);

    // 记录供参考值页使用
    state.measurements = {
      lvedd: lvedd, lvesd: lvesd, ivsd: ivsd, lvpwd: lvpwd,
    };

    // 指标网格
    const items = [
      { k: 'EDV', v: fn.EDV, u: 'mL', t: '舒张末容积' },
      { k: 'ESV', v: fn.ESV, u: 'mL', t: '收缩末容积' },
      { k: 'SV', v: fn.SV, u: 'mL', t: '每搏量' },
      { k: 'EF', v: fn.EF, u: '%', t: '射血分数' },
      { k: 'FS', v: fn.FS, u: '%', t: '缩短分数' },
    ];
    if (rwt !== null) items.push({ k: 'RWT', v: rwt, u: '', t: '相对室壁厚度' });
    if (lvm.LVM !== null) items.push({ k: 'LVM', v: lvm.LVM, u: 'g', t: '左室质量' });
    if (lvm['LVM/BSA'] !== null) items.push({ k: 'LVM/BSA', v: lvm['LVM/BSA'], u: 'g/m²', t: '质量指数' });

    let kv = '';
    items.forEach(function (it) {
      kv += '<div class="kv__i"><div class="kv__k">' + it.t + '</div>' +
        '<div class="kv__v">' + it.v + '<span class="kv__u">' + it.u + '</span></div></div>';
    });
    $('efKv').innerHTML = kv;

    // 进度条
    const pct = Math.max(0, Math.min(100, fn.EF));
    $('efMark').style.left = pct + '%';

    // 分级说明
    $('efGrade').innerHTML = '射血分数 <b>' + fn.EF + '%</b> —— ' +
      '<span class="tag ' + gradeCls(grade.level) + '">' + esc(grade.text) + '</span>' +
      '　（ASE 2015 阈值：≥55% 正常，45–54% 轻度减低，30–44% 中度减低，&lt;30% 重度减低）';

    $('efFormula').innerHTML =
      'Teichholz：EDV = 7 × (' + (lvedd / 10).toFixed(2) + ')<sup>3</sup> ÷ (2.4 + ' +
      (lvedd / 10).toFixed(2) + ') = ' + fn.EDV + ' mL；' +
      'ESV = ' + fn.ESV + ' mL' +
      (state.bsa ? '　·　指数基于 BSA ' + state.bsa.toFixed(3) + ' m²' : '');

    $('efResult').hidden = false;

    // 同页参考值列表实时切到「实测值对照」
    renderReference();
  }

  function gradeCls(level) {
    return { normal: 'tag--normal', mild: 'tag--mild', moderate: 'tag--moderate', severe: 'tag--severe' }[level] || 'tag--none';
  }

  EF_IDS.forEach(function (id) {
    $(id).addEventListener('input', renderEF);
  });

/*<<<PUBLIC-CUT:calc>>>*/
  /* ══════════════════════════════════════════════════════════
     五B、Tab3 公式集（目录 + 单个公式详情）
     ══════════════════════════════════════════════════════════ */

  const CALC_GROUPS = [
    { id: 'flow', title: 'LVOT · 每搏量与心排量',
      fields: [['ld', 'LVOT 直径', 'cm'], ['lvti', 'LVOT VTI', 'cm'], ['hr', '心率', '次/min']],
      note: 'SV = πd²/4 × VTI；CO = SV × HR ÷ 1000' },
    { id: 'ef', title: '左室容积与射血分数',
      fields: [['edv', '舒张末容积 EDV', 'mL'], ['esv', '收缩末容积 ESV', 'mL']],
      note: 'EF = (EDV − ESV) / EDV；SV = EDV − ESV。有 BSA 时同出 SVi 与 ESVi（ESVi 决定 ICD 指征）' },
    { id: 'lvmass', title: '左室质量与几何构型',
      fields: [['lvid', 'LVIDd（舒张末内径）', 'cm'], ['ivs', 'IVSd（室间隔厚度）', 'cm'], ['lvpw', 'LVPWd（后壁厚度）', 'cm']],
      note: 'LV Mass = 0.8 × 1.04 × [(LVIDd+IVSd+LVPWd)³ − LVIDd³] + 0.6；RWT = 2×LVPWd/LVIDd。LVMI 上限男 115 / 女 95 g/m²' },
    { id: 'mapse', title: 'MAPSE 长轴收缩',
      fields: [['mapse', 'MAPSE', 'mm']],
      note: 'MAPSE 正常 ≥10–12 mm；长轴功能常早于 EF 下降，EF 正常而 MAPSE 减低提示早期收缩功能障碍' },
    { id: 'tei', title: 'Tei 指数（MPI）',
      fields: [['ivct', '等容收缩时间 IVCT', 'ms'], ['ivrt', '等容舒张时间 IVRT', 'ms'], ['et', '射血时间 ET', 'ms'], ['tside', '侧别（右室填 2，留空按左室）', '']],
      note: 'MPI = (IVCT + IVRT) / ET；左室 >0.40、右室 >0.55 为异常。心率与负荷会影响测值' },
    { id: 'mpap', title: '平均肺动脉压',
      fields: [['prv', '肺动脉反流峰速 Vmax', 'm/s'], ['mrap', '右房压 RAP', 'mmHg']],
      note: 'mPAP = 4 × PR Vmax² + RAP；>25 mmHg 符合肺高压。也可用 Mahan 近似 0.61 × sPAP + 2' },
    { id: 'shunt', title: 'Qp/Qs 肺体循环血流比',
      fields: [['rd', 'RVOT 直径', 'cm'], ['rvti', 'RVOT VTI', 'cm'],
        ['ld', 'LVOT 直径（体循环）', 'cm'], ['lvti', 'LVOT VTI（体循环）', 'cm']],
      note: 'Qp/Qs = (π·d_RVOT²/4 × VTI_RVOT) ÷ (π·d_LVOT²/4 × VTI_LVOT)；>2.0 大量分流、1.5–2.0 中等量、<1.0 提示净右向左' },
    { id: 'bernoulli', title: '简化伯努利压差',
      fields: [['v2', '远端峰速 V₂', 'm/s'], ['v1', '近端峰速 V₁（可选）', 'm/s']],
      note: 'ΔP = 4(V₂² − V₁²)；缺省 V₁ 按 0 处理。瓣膜狭窄 / 反流定量见「瓣膜评估」页' },
    { id: 'atrial', title: '心房容积指数',
      fields: [['lav', '左房容积', 'mL'], ['rav', '右房容积', 'mL']],
      note: '容积 ÷ BSA；LAVI 正常 ≤34 mL/m²；右房正常值需匹配测量方法' },
    { id: 'dias', sec: 'hemo', title: '舒张功能基础比值',
      fields: [['e', 'E 峰', 'cm/s'], ['a', 'A 峰', 'cm/s'], ['es', '间隔 e′', 'cm/s'], ['el', '侧壁 e′', 'cm/s']],
      note: 'E/e′ <8 左房压正常，>14 升高，8–14 为灰区；完整分级需结合 LAVI、肺静脉等' },

    { id: 'vtir', sec: 'hemo', title: 'RVOT / LVOT VTI 比',
      fields: [['vtrvo', 'RVOT VTI', 'cm'], ['vtrlo', 'LVOT VTI', 'cm']],
      note: '正常 0.7–1.05；>1.2 提示左向右分流（可近似当 Qp/Qs），<0.6 提示肺血流减少。优点是不用测两处直径——直径平方的误差会被放大两次' },

    /* ── 右心与肺循环（sec: right） ── */
    { id: 'paspv', sec: 'right', title: '肺动脉收缩压 PASP',
      fields: [['ptrv', 'TR 峰速 Vmax', 'm/s'], ['prap', '右房压 RAP', 'mmHg']],
      note: 'PASP = 4 × Vmax² + RAP；≤36 正常 / 37–49 轻 / 50–69 中 / ≥70 重度。肺动脉瓣狭窄或 RVOT 梗阻时会高估' },
    { id: 'rvfacv', sec: 'right', title: '右室面积变化分数 FAC',
      fields: [['feda', '舒张末面积 RVEDA', 'cm²'], ['fesa', '收缩末面积 RVESA', 'cm²']],
      note: 'FAC <35% 提示右室收缩功能减低；<25% 为明显减低。与 TAPSE、S′、RVFWS 合看更可靠' },
    { id: 'pvrv', sec: 'right', title: '肺血管阻力 PVR',
      fields: [['hmmpap', '平均肺动脉压 mPAP', 'mmHg'], ['hmpawp', '肺动脉楔压 PAWP', 'mmHg'], ['hmco', '心输出量 CO', 'L/min']],
      note: 'PVR(WU) = (mPAP − PAWP) / CO；≤2 正常、2–3 轻、3–5 中、>5 重度。先心病可手术性常以 <3 WU 为界' },
    { id: 'svrv', sec: 'right', title: '体循环血管阻力 SVR',
      fields: [['smap', '平均动脉压 MAP', 'mmHg'], ['srap', '右房压 RAP', 'mmHg'], ['sco', '心输出量 CO', 'L/min']],
      note: '正常 800–1200 dyn·s·cm⁻⁵；有 BSA 时同出 SVRI（1600–2400）' },

    /* ── v1.2.9 第二批：右心与肺循环补全 ── */
    { id: 'rvvol', sec: 'right', title: '右室容积指数 RVEDVi / RVESVi',
      fields: [['rvedv', 'RV 舒张末容积', 'mL'], ['rvesv', 'RV 收缩末容积（可选）', 'mL']],
      note: 'RVEDVi 上限男 87 / 女 75 mL/m²；RVESVi 上限男 44 / 女 35 mL/m²（ASE 右心指南）。右室扩大而左室正常时注意 ARVC、房间隔缺损、肺高压；随访必须同一方法' },
    { id: 'rvfws', sec: 'right', title: '右室游离壁应变 RVFWS',
      fields: [['rfb', '基底段', '%'], ['rfm', '中间段', '%'], ['rfa', '心尖段', '%']],
      note: 'RVFWS 正常 |均值| ≥20%（即 ≤ −20%）。右室纵向功能常先于 TAPSE、FAC 下降；填负数更符合习惯（如 −24）。仅填一到两段也能算，但三段齐全更可靠' },
    { id: 'papi', sec: 'right', title: 'PAPi 肺动脉搏动指数',
      fields: [['pispap', '肺动脉收缩压 sPAP', 'mmHg'], ['pidpap', '肺动脉舒张压 dPAP', 'mmHg'],
        ['pirap', '右房压 RAP', 'mmHg']],
      note: 'PAPi = (sPAP − dPAP) / RAP，反映右室与肺循环的耦联。<1.85 提示失耦联，肺高压与心衰患者预后差；>2.0 相对保留。RAP 需先由 IVC 估出' },
    { id: 'pdap', sec: 'right', title: '舒张期肺动脉压 PADP',
      fields: [['pdprv', 'PR 舒张末期流速', 'm/s'], ['pdrap', '右房压 RAP', 'mmHg']],
      note: 'PADP = 4 × V² + RAP，正常 8–15 mmHg。平均肺动脉压条目（mpap）用 PR 峰值速度算平均压，本条算舒张末压，两者互补' },
    { id: 'residx', sec: 'right', title: '阻力指数 PVRI / SVRI',
      fields: [['ripvr', 'PVR（可选）', 'WU'], ['risvr', 'SVR（可选）', 'dyn·s·cm⁻⁵']],
      note: 'PVRI = PVR × BSA，正常 3–5 WU·m²，>5 提示肺血管阻力显著升高（先心手术决策关键）；SVRI = SVR × BSA，正常 1970–2390 dyn·s·cm⁻⁵·m²' },
    { id: 'rvdvdt', sec: 'right', title: '右室 dP/dt',
      fields: [['rdt', '1→2 m/s 时间差 Δt', 'ms']],
      note: '两点压差差为 4×2² − 4×1² = 12 mmHg，故 dP/dt = 12 ÷ Δt(s)，单位 mmHg/s。<400 提示右室收缩功能减低' },

    { id: 'phprob', sec: 'right', title: '超声肺高压可能性',
      opts: [{ k: 'phsign', n: '其他右心征象', list: [['n', '无'], ['y', '有']] }],
      fields: [['phv', 'TR Vmax', 'm/s'], ['phrvotat', 'RVOT 加速时间（可选）', 'ms']],
      note: 'TR Vmax ≤2.8 无征象 → 低；≤2.8 有征象 或 2.9–3.4 无征象 → 中；2.9–3.4 有征象 或 >3.4 → 高。右心征象指 RV/LV >1、室间隔变平 / 矛盾运动、RVOT AT <105 ms、右房面积 >18 cm²、IVC >21 mm 不塌陷、收缩期切迹。超声只给「可能性」，确诊必须右心导管' },

    /* ── 瓣膜专用定量（v1.4.1 起与小程序 calc-groups.js 同源，走 valve-calc 引擎）
       ★ v1.4.4：AS / AR / MS / MR 并入两个评估页，此处只留 TR ── */
    { id: 'tr', sec: 'valve', title: 'TR 三尖瓣反流定量',
      fields: [['tr_radius', 'PISA 半径', 'cm'], ['tr_aliasVa', '混叠速度 Va', 'cm/s'],
        ['tr_regV', '反流峰速', 'm/s'], ['tr_regVti', '反流 VTI', 'cm'],
        ['tr_vc', '缩流颈 VC（可选）', 'cm'], ['tr_trV', 'TR 峰速（可选）', 'm/s'],
        ['tr_ivc', 'IVC 内径（可选）', 'mm']],
      note: 'PISA：EROA = 2πr²Va ÷ Vmax，RVol = EROA × VTI_TR；TR 峰速按 4V² 得压差，配合 IVC 内径估右房压算出 PASP。填了 VC 会给缩流颈分级' },

    /* ── v1.3.0 第三批：瓣膜与舒张细节 ── */
    { id: 'evp', sec: 'hemo', title: 'E/Vp 左房压估测',
      fields: [['evpe', 'E 峰速度', 'cm/s'], ['evpvp', 'Vp 血流传播速度', 'cm/s']],
      note: 'E/Vp ≤1.5 正常；>1.5 提示 PCWP >15 mmHg，>2.5 提示 >18 mmHg。Vp 用彩色 M 型在四腔切面测（正常 ≥45 cm/s）。Vp 正常而 E/Vp 升高时，E 峰多被容量负荷或 MR 抬高，不等于松弛受损' },
    { id: 'laef', sec: 'recon', title: '左房排空分数 LAEF',
      fields: [['lavmax', 'LA 最大容积', 'mL'], ['lavmin', 'LA 最小容积', 'mL']],
      note: 'LAEF = (LAVmax − LAVmin) / LAVmax，正常 ≥50%；扩张指数 = (LAVmax − LAVmin) / LAVmin。LAEF 减低提示左房机械功能受损' },
    { id: 'quickratio', sec: 'hemo', title: '快速比值：LA/Ao · RV/LV',
      fields: [['qla', '左房内径 LA', 'mm'], ['qao', '主动脉根部 Ao', 'mm'],
        ['qrv', '右室舒张末内径 RV', 'mm'], ['qlv', '左室舒张末内径 LV', 'mm']],
      note: 'LA/Ao ≤1.1 正常；RV/LV >0.6 提示右室扩大（>1.0 高度提示右心负荷过重）。单位同组一致即可' },
    { id: 'lvmih', sec: 'recon', title: 'LVMI 身高^2.7（肥胖适用）',
      fields: [['lhmass', '左室质量 LV Mass', 'g'], ['lhheight', '身高', 'cm']],
      note: 'LVMI = Mass / 身高(m)^2.7，男 >50、女 >47 g/m^2.7 提示左室肥厚。肥胖患者按 BSA 指数化会低估肥厚程度，此时应改用身高^2.7' },

    /* ── v1.3.0 第四批：先心 / 心肌 / 耦联 ── */
    { id: 'paidx', sec: 'ivs', title: 'McGoon 比值与 Nakata 指数',
      fields: [['prpa', '右肺动脉 RPA', 'mm'], ['plpa', '左肺动脉 LPA', 'mm'],
        ['pdao', '膈肌水平降主动脉（可选）', 'mm']],
      note: 'McGoon = (RPA + LPA) ÷ 降主动脉，≥1.8 可考虑根治；Nakata = 左右肺动脉截面积之和 ÷ BSA（需身高体重），≥150 mm²/m² 可考虑根治。随访必须用同一口径' },
    { id: 'ras', sec: 'recon', title: '心尖保留比值 RAS',
      fields: [['rasap', '心尖段平均应变', '%'], ['rasba', '基底段平均应变', '%']],
      note: 'RAS = |心尖段均值| ÷ |基底段均值|。≥1 提示相对心尖保留，是心肌淀粉样变的典型表现；典型淀粉样变多在 2.0 以上' },
    { id: 'ea', sec: 'hemo', title: '有效动脉弹性 Ea / Ees-Ea 耦联',
      fields: [['eaesp', '收缩末压 ESP', 'mmHg'], ['easv', '每搏量 SV', 'mL'], ['eaesv', '收缩末容积 ESV', 'mL']],
      note: 'Ea = ESP / SV；单点 Ees ≈ ESP / ESV，故 Ees/Ea = SV / ESV。常见区间 0.8–1.5，心衰时降低。单点法仅作趋势参考' },
    { id: 'coa', sec: 'ivs', title: '主动脉缩窄压差与拖尾',
      fields: [['coav', '缩窄处峰值流速', 'm/s'], ['coaved', '舒张末期流速（可选）', 'm/s']],
      note: '压差 = 4 × Vmax²。峰值压差 ≥20 mmHg 提示有血流动力学意义；舒张末期仍有 ≥5 mmHg 压差说明存在持续跨缩窄血流（拖尾征）。新生儿期压差可能不高' },
    { id: 'aortaz', sec: 'ivs', title: '主动脉分节段 Z 值',
      opts: [{ k: 'azsex', n: '性别', list: [['m', '男'], ['f', '女']] }],
      fields: [['azann', '主动脉瓣环', 'mm'], ['azsin', '窦部（Valsalva）', 'mm'],
        ['azstj', '窦管交界', 'mm'], ['azasc', '近段升主动脉', 'mm']],
      note: '四个位点可只填测到的。Z 值由站内成人参考区间反推（均值 = 区间中点，SD = 半径 ÷ 1.96），口径与「Z > 2 视为扩张」一致，但不是人群实测 SD，不能与儿童 Z 值或 CT 的 Z 值互换。近段升主动脉另按 BSA 指数化：男 ≥2.1、女 ≥2.0 cm/m² 提示扩张' },

    /* ── 舒张功能定量（sec: vq） ── */
    { id: 'ppm', sec: 'valve', title: '人工瓣 EOAi 与 PPM',
      fields: [['peoa', '有效开口面积 EOA', 'cm²'], ['ppos', '位置（1 主动脉 / 2 二尖瓣）', ''],
        ['pbmi', 'BMI（可选；≥30 用肥胖切点）', 'kg/m²']],
      note: 'EOAi = EOA/BSA。R17（ASE 2024）：主动脉位 正常 >0.85、中度 0.85–0.66、重度 ≤0.65；二尖瓣位 正常 >1.2、中度 1.2–0.91、重度 ≤0.90（cm²/m²）。BMI ≥30 时整体下调：主动脉位 0.70 / 0.70–0.56 / ≤0.55，二尖瓣位 1.0 / 1.0–0.76 / ≤0.75' },
    { id: 'dfun', sec: 'hemo', title: '舒张功能分级（四步法）',
      fields: [['dfe', 'E 峰', 'cm/s'], ['dfa', 'A 峰', 'cm/s'], ['dfes', '间隔 e′', 'cm/s'],
        ['dfel', '侧壁 e′', 'cm/s'], ['dflavi', 'LAVi（可选）', 'mL/m²'], ['dftrv', 'TR Vmax（可选）', 'm/s']],
      note: '2016 ASE/EACVI 简化路径：E/A 加三个升高指标（E/e′ >14、LAVi >34、TR Vmax >2.8）分为 Ⅰ/Ⅱ/Ⅲ 级' },

    /* ── 重构与心肌功能（sec: recon） ── */
    { id: 'volidx', sec: 'recon', title: '容积指数与重构分级',
      fields: [['vedv', '舒张末容积 EDV', 'mL'], ['vesv', '收缩末容积 ESV', 'mL']],
      note: 'EDVi 上限男 74 / 女 61，ESVi 上限男 31 / 女 24 mL/m²；ESVi >45 提示收缩功能显著减低' },
    { id: 'rwsv', sec: 'recon', title: '相对室壁应力 RWS',
      fields: [['rsbp', '收缩压 SBP', 'mmHg'], ['rlvedd', 'LVEDD', 'cm'], ['rpwt', '后壁厚度 PWT', 'cm']],
      note: 'RWS = 0.334 × SBP × LVEDD / [PWT × (1 + PWT/LVEDD)]；正常 60–160（10³ dyn/cm²）' },
    { id: 'spher', sec: 'recon', title: '左室球形指数',
      fields: [['sdd', '左室短径', 'cm'], ['sld', '左室长径', 'cm']],
      note: 'SI ≤0.65 正常；0.66–0.75 球形化；>0.75 显著球形化（重构、预后差）' },
    { id: 'lastrain', sec: 'recon', title: '左房应变三值',
      fields: [['lsr', '储备应变 LASr', '%'], ['lscd', '管道应变 LAScd', '%'], ['lsct', '泵应变 LASct（绝对值）', '%']],
      note: 'LASr ≥30 正常、23–30 轻度、18–23 中度、<18 重度减低；LASr ≈ LAScd + |LASct|，偏差 >5 提示勾画有问题' },
    { id: 'aortaidx', sec: 'recon', title: '升主动脉直径指数',
      fields: [['aodim', '升主动脉内径', 'mm']],
      note: '≤1.9 正常、1.9–2.1 边缘、>2.1 扩张、>2.6 显著扩张 cm/m²；绝对值上限男 3.6 / 女 3.3 cm' },
    { id: 'mdsv', sec: 'recon', title: '应变离散度 MDS',
      fields: [['mds1', '前壁', '%'], ['mds2', '下壁', '%'], ['mds3', '侧壁', '%'],
        ['mds4', '室间隔', '%'], ['mds5', '后壁', '%'], ['mds6', '前间隔', '%']],
      note: '六壁峰值纵向应变的标准差；健康人 <4–5%，≥5% 提示区域收缩差异。非时间型机械离散度 MAD' },
    { id: 'swv', sec: 'recon', title: '每搏功 SW / SWi',
      fields: [['ssv', '每搏量 SV', 'mL'], ['wmap', '平均动脉压 MAP', 'mmHg']],
      note: 'SW(g·m) = SV × MAP × 0.0136，正常 60–110；SWi = SW/BSA。GWI/GCW/GWE 需专有软件，无法手算' },

    { id: 'lastiff', sec: 'recon', title: '左房僵硬度',
      fields: [['lsee', 'E/e′', ''], ['lslars', 'LARS（填正数）', '%']],
      note: 'LA stiffness = E/e′ ÷ LARS，LARS 填正数百分值（如 25 表示 25%）。≤0.47 正常，>0.47 支持 HFpEF，>0.60 明显僵硬' },
    { id: 'lvnc', sec: 'recon', title: '致密化不全 NC/C 比',
      fields: [['lnvnc', '非致密层厚度', 'mm'], ['lnvc', '致密层厚度', 'mm']],
      note: 'Jenni（超声，收缩末期短轴）>2.0；Petersen（CMR，舒张末期）>2.3。比值只是三条标准之一，还必须有：两层结构分明、深陷隐窝与左室腔血流相通' },

    /* ── v1.2.8 第一批：M 型 / 评分体系 / 介入尺寸 ── */
    { id: 'mtype', sec: 'hemo', title: 'M 型三合一：FS · Teichholz EF · EPSS',
      fields: [['mtdd', 'LVIDd（舒张末内径）', 'mm'], ['mtds', 'LVIDs（收缩末内径）', 'mm'],
        ['mtepss', 'EPSS（可选）', 'mm']],
      note: 'FS = (LVIDd − LVIDs)/LVIDd；Teichholz：V = 7D³/(2.4+D)（D 取 cm），EF = (EDV−ESV)/EDV。EPSS <7 mm 正常，>12 mm 提示 EF 显著减低。M 型受取样线偏斜与节段性室壁运动异常影响，条件允许时以 Simpson 双平面为准' },
    { id: 'wmsi', sec: 'recon', title: 'WMSI 室壁运动积分',
      opts: [{ k: 'wseg', n: '节段总数', list: [['17', '17 节段（推荐）'], ['16', '16 节段']] }],
      fields: [['wn1', '正常（1 分）节段数', '个'], ['wn2', '运动减弱（2 分）', '个'],
        ['wn3', '无运动（3 分）', '个'], ['wn4', '反常运动（4 分）', '个'],
        ['wn5', '室壁瘤（5 分）', '个']],
      note: 'WMSI = (1·n1 + 2·n2 + 3·n3 + 4·n4 + 5·n5) ÷ 节段总数。按各类节段个数录入，比逐段填 17 个格子快且不易漏段。1.0 正常，1.0–1.5 轻度，1.5–1.7 中度，≥1.7 提示大面积缺血且预后差' },
    { id: 'h2fpef', sec: 'recon', title: 'H2FPEF 评分',
      opts: [{ k: 'haf', n: '心房颤动', list: [['0', '无'], ['1', '有']] },
        { k: 'hbp', n: '降压药种数', list: [['0', '0–1 种'], ['1', '≥2 种']] }],
      fields: [['hbmi', 'BMI', 'kg/m²'], ['hage', '年龄', '岁'], ['hee', 'E/e′', ''], ['hpasp', 'PASP', 'mmHg']],
      note: '加权评分：BMI >30 计 2 分，心房颤动 3 分，年龄 >60 岁 1 分，≥2 种降压药 1 分，E/e′ >9 计 1 分，PASP >35 mmHg 计 1 分。≥6 分 HFpEF 可能性高，≤1 分可能性低，2–5 分需负荷超声或侵入性血流动力学' },
    { id: 'hfapeff', sec: 'recon', title: 'HFA-PEFF 评分',
      opts: [{ k: 'hsex', n: '性别', list: [['m', '男性'], ['f', '女性']] },
        { k: 'haf2', n: '心律', list: [['0', '窦性心律'], ['1', '心房颤动']] }],
      fields: [['hlavi', 'LAVi', 'mL/m²'], ['hlvmi', 'LVMI', 'g/m²'], ['hrwt', 'RWT', ''],
        ['hpasp2', 'PASP', 'mmHg'], ['hee2', 'E/e′', ''], ['hes', '间隔 e′', 'cm/s'],
        ['hel', '侧壁 e′', 'cm/s'], ['htrv', 'TR Vmax', 'm/s'], ['hgls', 'GLS（绝对值）', '%'],
        ['hbnp', 'NT-proBNP', 'pg/mL']],
      note: '三类各取最高分后相加（0–6）。形态学：LAVi ≥34 计 1、≥40 计 2；LVMI 男 >115/149、女 >95/122 计 1/2；RWT >0.42 计 1；PASP >35 计 1。功能学：E/e′ 9–14 计 1、≥15 计 2；e′ 减低计 1；TR Vmax >2.8 计 1；GLS <16% 计 1。标志物按窦律/房颤分档。≥5 分支持 HFpEF' },
    { id: 'tavrsz', sec: 'ivs', title: 'TAVR 瓣环尺寸与 oversizing',
      fields: [['tcirc', '瓣环周长', 'mm'], ['tarea', '瓣环面积', 'mm²'], ['tnom', '拟用标称直径', 'mm']],
      note: '周长导出直径 = C/π；面积导出直径 = 2√(A/π)；面积 oversizing = (标称面积/实测面积 − 1)×100%。自膨胀瓣常见目标 10–20%，球囊扩张瓣 −10% ~ +5%。具体型号按厂商说明书与术者经验核定' },
    { id: 'laasz', sec: 'ivs', title: '左心耳封堵尺寸推荐',
      fields: [['lzmax', '着陆区最大径', 'mm'], ['lzmin', '着陆区最小径（可选）', 'mm'],
        ['lzdepth', '着陆区深度（可选）', 'mm']],
      note: '按着陆区最大径 × 1.08 上取整落到常规型号（17/20/24/27/31/35 mm）。长短径比 >1.3 提示椭圆度大；深度不足时考虑小一号。多用于 Watchman FLX 类器械，其他产品按各自说明书' },
    { id: 'aortagrow', sec: 'ivs', title: '主动脉扩张增长率',
      fields: [['d1', '上次直径', 'cm'], ['d2', '本次直径', 'cm'], ['yrs', '间隔时间', '年']],
      note: '增长率 = (本次 − 上次) × 10 ÷ 间隔年数（mm/年）。<3 低危；3–5 缩短随访间隔；≥5 倾向尽快干预。必须同切面同方法测量' },
    { id: 'pvfu', sec: 'ivs', title: '人工瓣术后跨瓣血流',
      fields: [['lvotD', 'LVOT 直径', 'cm'], ['lvotVti', 'LVOT VTI', 'cm'],
        ['valveVti', '人工瓣 VTI', 'cm'], ['fupvmax', '跨瓣峰值流速', 'm/s'], ['fupmean', '跨瓣平均压差', 'mmHg']],
      note: 'EOA = (π×LVOT 直径²÷4 × LVOT VTI) ÷ 人工瓣 VTI。术后平均压差 <20 mmHg、EOA ≥1.2 cm²（EOAi ≥0.8）为佳。压差高不等于故障：先排 undersizing、瓣周漏、LVOT 梗阻、压降恢复与高流量' },
    { id: 'cfr', sec: 'ivs', title: '冠脉血流储备 CFR',
      fields: [['distal', '远端冠脉舒张期流速', 'cm/s'], ['proximal', '近端冠脉舒张期流速', 'cm/s']],
      note: 'CFR = 远端 ÷ 近端。>2.0 正常；1.6–2.0 可疑；<1.6 明显受限（缺血）。要求同一支冠脉、同一角度、同一心率与同一负荷状态下测量' },
  ];

  /** 计算类条目的目录分组（与 calc-groups.js 的 CALC_SECTIONS 同源同序） */
  const CALC_SECTIONS = [
    { id: 'hemo', title: '血流动力学、舒张与心功能' },
    { id: 'right', title: '右心与肺循环' },
    { id: 'recon', title: '重构、室壁运动与心肌功能' },
    { id: 'ivs', title: '介入尺寸、先心与随访' },
  ];

  const CALC_COLLAPSE = [['', 'IVC 塌陷未知'], ['yes', '吸气塌陷 >50%'], ['no', '吸气塌陷 ≤50%']];
  const CALC_SIGNS = [['', 'PH 征象未评估'], ['yes', '有（≥2 类）'], ['no', '无']];

  const calcVal = {};
  let calcCollapse = '';
  let calcSigns = '';
  /** 选项组状态（性别 / 心律 / 节段总数 …），键为 calcc-groups 里的 opts.k */
  const calcOpt = {};

  /** 目录里每条公式的一句话说明 */
  const CALC_SUB = {
    // 瓣膜专用定量（v1.4.1：从小程序瓣膜页搬进公式集）
    as: 'AVA 连续性方程 · DVI · 峰速法',
    ar: 'PISA EROA · 缩流颈 VC · PHT · 反流分数',
    ms: 'MVA 描记 / PHT · 平均压差 · PASP',
    mr: 'PISA EROA · RVol · dP/dt',
    tr: 'EROA · RVol · TR 峰速 · IVC',
    flow: 'SV · CO · SVi · CI',
    ef: 'Simpson 双平面 · EF · SVi · ESVi',
    lvmass: 'LV Mass · LVMI · RWT · 四分法',
    mapse: '二尖瓣环收缩期位移',
    dvi: 'LVOT VTI ÷ 主动脉瓣 VTI',
    tei: '等容时间之和 ÷ 射血时间',
    mpap: '舒张期肺动脉反流法',
    shunt: '分流方向与分流量分级',
    bernoulli: 'ΔP = 4(V₂² − V₁²)',
    atrial: 'LAVI · RAVI',
    dias: 'E/A · 平均 E/e′',
    paspv: 'TR 压差 + 右房压 · 轻中重分级',
    rapv: 'ASE 三分级 · 3 / 8 / 15 mmHg',
    rvfacv: '(RVEDA − RVESA) ÷ RVEDA',
    rcratiov: '右室收缩 ÷ 肺动脉负荷',
    pvrv: '(mPAP − PAWP) ÷ CO · WU',
    svrv: '(MAP − RAP) × 80 ÷ CO',
    pisav: 'EROA · RVol · 反流分级',
    avav: 'AVA · AVAi · DVI',
    ppm: '有效开口面积指数 · 患者-瓣膜不匹配',
    dfun: 'E/A · E/e′ · LAVi · TR Vmax',
    volidx: 'EDVi · ESVi · SVi（按性别）',
    rwsv: '后负荷与室壁厚度的匹配',
    spher: '短径 ÷ 长径（舒张末）',
    lastrain: '储备 LASr · 管道 LAScd · 泵 LASct',
    aortaidx: '内径 ÷ BSA · 扩张分层',
    mdsv: '六壁峰值应变的均值与标准差',
    swv: 'SV × MAP × 0.0136',
    mtype: '缩短分数 · 立方公式 EF · EPSS',
    wmsi: '按分值节段个数录入 · 1.0 正常 · ≥1.7 提示大面积缺血',
    h2fpef: 'BMI · 房颤 · 年龄 · 降压药 · E/e′ · PASP → 0–9 分',
    hfapeff: '形态学 / 功能学 / 生物标志物 三类取最高后相加',
    tavrsz: '周长/面积导出直径 · 面积 oversizing 判读',
    laasz: '着陆区最大径 → 推荐型号 · 深度与椭圆度提示',
    rvvol: '按性别分档 · 右室扩大与 ARVC 随访',
    rvfws: '三节段均值 · |均值| <20% 提示减低',
    papi: '(sPAP − dPAP) ÷ RAP · <1.85 失耦联',
    pdap: '4 × V(PR 舒张末)² + RAP',
    residx: 'PVR、SVR 按 BSA 指数化',
    rvdvdt: 'TR 反流谱 1→2 m/s 的 Δt · <400 减低',
    wilkins: '4 项各 1–4 分 · ≤8 适合 PBMV',
    vcw: 'MR / TR：<3 轻 · 3–6.9 中 · ≥7 重',
    rf: 'RVol ÷ SV · 轻 <30 中 30–49 重 ≥50',
    mva: 'MVA = 220÷PHT 与 SV÷VTI_MV 同屏对照',
    evp: 'E 峰 ÷ 血流传播速度 Vp',
    lastiff: 'E/e′ ÷ LARS',
    vtir: '不测直径的分流替代量',
    lvnc: '非致密层 ÷ 致密层',
    phprob: '2022 ESC/ERS 三步法',
    laef: 'LAEF 与 LA 扩张指数',
    quickratio: '床头最常用的两个半定量比值',
    lvmih: 'de Simone 指数 · 男 >50 女 >47',
    paidx: '肺动脉发育 · 先心根治可行性',
    ras: '心尖段 ÷ 基底段 · ≥1 提示淀粉样变',
    ea: 'ESP ÷ SV · Ees/Ea ≈ SV ÷ ESV',
    coa: '峰值压差 · 舒张末期持续血流',
    aortaz: '四段 Z 值 · 成人参考区间',
    aortagrow: '两次测量之差 ÷ 间隔年数',
    pvfu: '人工瓣术后 EOA 与压差',
    cfr: '远端 ÷ 近端冠脉舒张期流速',
  };

  /** 评估类内容（切面与图像 / 心腔应变与负荷 / …）与参考文献：来自 extra-data.js，与小程序同源 */
  const BRIEF = (window.ExtraData && window.ExtraData.BRIEF_SECTIONS) || [];
  const LINKS = (window.ExtraData && window.ExtraData.LINK_SECTIONS) || [];
  const REFS = (window.ExtraData && window.ExtraData.REFS) || [];

  /** 当前打开的条目（详情视图） */
  let curCalcGroup = 'flow';

  function calcGroupOf(id) {
    for (let i = 0; i < CALC_GROUPS.length; i += 1) {
      if (CALC_GROUPS[i].id === id) return CALC_GROUPS[i];
    }
    return null;
  }

  /** 按 id 取评估类条目 */
  function briefOf(id) {
    for (let i = 0; i < BRIEF.length; i += 1) {
      const hit = BRIEF[i].items.filter(function (b) { return b.id === id; })[0];
      if (hit) return hit;
    }
    return null;
  }

  /** 目录：分组标题 + 分组说明（可选） + 列表开标签 */
  function fxGroupHtml(id, title, note) {
    let h = '<div class="fx-group" id="g-' + esc(id) + '">' + esc(title) + '</div>';
    if (note) h += '<div class="fx-gnote">' + esc(note) + '</div>';
    return h + '<div class="fx-list">';
  }

  /** 目录条目：kind = calc / brief / valve / link / album
   *  link 为纯外链条目：渲染成 <a target="_blank">，不加载任何图片或 iframe
   *  url 为 .mp4 时用 ▶ 标识，点击由浏览器直接播放
   *  album 为专辑（整本书的视频）：右侧显示段数，点击进入二级列表 */
  function fxItemHtml(kind, id, title, sub, url, count, secId) {
    const isVid = /\.mp4(\?|$)/i.test(url || '');
    let arrow = '›';
    if (kind === 'album') arrow = (count || 0) + ' ›';
    else if (isVid) arrow = '▶';
    const inner = '<span class="fx-item__main">' +
      '<span class="fx-item__n">' + esc(title) + '</span>' +
      '<span class="fx-item__d">' + esc(sub) + '</span>' +
      '</span><span class="fx-item__a">' + arrow + '</span>';
    if (kind === 'link') {
      return '<a class="fx-item" href="' + esc(url || '#') +
        '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
    }
    return '<button class="fx-item" data-kind="' + kind + '" data-id="' + id + '"' +
      (secId ? ' data-sec="' + secId + '"' : '') + '>' +
      inner + '</button>';
  }

  /**
   * 取某计算器的说明块（临床意义 / 参考标准 / 判读要点）
   * 数据来自 miniprogram/utils/calc-notes.js，构建时注入为 window.CalcNotes。
   */
  function calcNotesBlocks(id) {
    if (!window.CalcNotes || !window.CalcNotes.notesBlocks) return [];
    return window.CalcNotes.notesBlocks(id) || [];
  }

  /**
   * 评估类内容块 → HTML（与小程序 formula 页渲染一致）
   *
   * ★ 正文里的 **加粗** 要转成 <b>，否则屏幕上出现字面量 ** （用户 2026-10-21 反馈）。
   *   解析器 InlineMd 与小程序共用同一份（miniprogram/utils/inline-md.js）。
   * ★ 返回 { html, toc }：toc 是小节标题清单，长条目用它做顶部导航。
   *
   * ★★ 锚点 id 必须带条目前缀（用户 2026-10-22 报「APK 导航点不动」的根因）：
   *   网页端把**全部**条目卡一次性渲染进 #calcGroups，若每张卡都从 sec-0 编号，
   *   整页会出现 100 多组重复 id；document.getElementById('sec-4') 只返回文档里
   *   第一个，而那是**别的（隐藏的）卡片**里的元素，rect.top 恒为 0 →
   *   点导航永远滚到顶或不动。小程序是「一条目一页面」所以不复现。
   *   故 id 形如 sec-4-tavr：既能用 [id^="sec-"] 选中，又保证全页唯一。
   */
  function blocksHtml(blocks, prefix) {
    let h = '';
    const toc = [];
    let secIdx = -1;
    const uid = prefix ? String(prefix) : '';
    (blocks || []).forEach(function (b) {
      if (b.kind === 'h') {
        secIdx += 1;
        const id = 'sec-' + secIdx + (uid ? '-' + uid : '');
        toc.push({ id: id, t: String(b.text || '').replace(/\*\*/g, '') });
        h += '<div class="fx-h" id="' + id + '">' + mdInline(b.text) + '</div>';
        return;
      }
      if (b.kind === 'note') {
        h += '<div class="fx-note">' + mdInline(b.text) + '</div>';
        if (b.links && b.links.length) {
          h += '<div class="chiprow">';
          b.links.forEach(function (id) {
            const g = calcGroupOf(id);
            h += '<button type="button" class="chip" data-jump="' + esc(id) + '">' +
              esc(g ? g.title : id) + '</button>';
          });
          h += '</div>';
        }
        return;
      }
      if (b.kind === 'formula') { h += '<div class="fx-formula">' + mdInline(b.text) + '</div>'; return; }
      if (b.kind === 'table') {
        h += '<div class="fx-tbl fx-tbl--' + b.heads.length + '">';
        h += '<div class="fx-tbl__r fx-tbl__r--h">';
        // ★ 表头与单元格也要过 mdInline：表格里的 **强调** 以前直接 esc() 输出，
        //   219 个单元格会把字面量 ** 漏到屏幕上（用户 2026-10-22 第二次反馈）
        b.heads.forEach(function (c) { h += '<span class="fx-tbl__c">' + mdInline(c) + '</span>'; });
        h += '</div>';
        (b.rows || []).forEach(function (r) {
          h += '<div class="fx-tbl__r">';
          r.forEach(function (c) { h += '<span class="fx-tbl__c">' + mdInline(c) + '</span>'; });
          h += '</div>';
        });
        h += '</div>';
        return;
      }
      h += '<div class="fx-text">' + mdInline(b.text) + '</div>';
    });
    return { html: h, toc: toc };
  }

  /**
   * 条目内小节导航（长条目定位用）
   * 只在 2 个以上小节时才出，避免短条目多一行无用胶囊。
   */
  function tocHtml(toc) {
    if (!toc || toc.length < 2) return '';
    let h = '<div class="fx-nav fx-nav--sec">';
    toc.forEach(function (s) {
      h += '<a class="fx-nav__c" href="#' + s.id + '" data-sec="' + s.id + '">' + esc(s.t) + '</a>';
    });
    return h + '</div>';
  }

  /**
   * 详情页底部的「相关内容」
   *
   * 条目之间做交叉引用（如「中国正常值」↔「左室定量」），点胶囊直接换到那条，
   * 与目录点击同一条路径（openCalcGroup），历史栈照常压入，返回可回到上一条。
   * 引用 id 找不到就跳过，不阻断渲染。
   */
  function briefRelHtml(ids) {
    if (!ids || !ids.length) return '';
    let chips = '';
    let n = 0;
    ids.forEach(function (id) {
      const b = briefOf(id);
      if (!b) return;
      chips += '<a class="chip chip--rel" data-rel="' + esc(id) + '">' + esc(b.title) + '</a>';
      n += 1;
    });
    if (!n) return '';
    return '<div class="fx-h">相关内容</div><div class="chiprow">' + chips + '</div>';
  }

  /** 详情页底部的本条目引用 */
  function briefRefsHtml(ids) {
    if (!ids || !ids.length || !REFS.length) return '';
    let h = '<div class="fx-h">本条目引用</div>';
    ids.forEach(function (rid) {
      const r = REFS.filter(function (x) { return x.id === rid; })[0];
      if (!r) return;
      h += '<div class="ref-item"><div class="ref-item__id">' + esc(r.id) + '</div>' +
        '<div class="ref-item__body">' +
        '<div class="ref-item__zh">' + esc(r.zh) + '</div>' +
        '<div class="ref-item__where">' + esc(r.where) + '</div>' +
        '</div></div>';
    });
    return h;
  }

  /**
   * 目录底部的参考文献总表
   *
   * 40 条文献平铺会把目录拉得极长，所以默认折叠：标题行显示条数，
   * 点一下才把全部条目展开（再点收起）。展开状态由 #calcRefList 的 hidden 决定，
   * 单一数据源，不必另存变量。
   */
  function renderRefs() {
    const box = $('calcRefList');
    if (!box) return;
    let h = '';
    REFS.forEach(function (r) {
      h += '<div class="ref-item"><div class="ref-item__id">' + esc(r.id) + '</div>' +
        '<div class="ref-item__body">' +
        '<div class="ref-item__zh">' + esc(r.zh) + '</div>' +
        '<div class="ref-item__en">' + esc(r.en) + '</div>' +
        '<div class="ref-item__where">' + esc(r.where) + '</div>' +
        '<div class="ref-item__use">用于：' + esc(r.use) + '</div>' +
        dlHtml(r.dl) +
        '</div></div>';
    });
    box.innerHTML = h;

    const cnt = $('refsCount');
    if (cnt) cnt.textContent = REFS.length + ' 条';
    const hd = $('refsToggle');
    if (hd && !hd.dataset.bound) {
      hd.dataset.bound = '1';
      hd.addEventListener('click', function () { toggleRefs(); });
      hd.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleRefs(); }
      });
    }
  }

  /** 文献直链（官方 / 免费 PDF，点开即下载，无需登录） */
  function dlHtml(dl) {
    if (!dl || !dl.length) return '';
    let h = '<div class="ref-dl">';
    dl.forEach(function (d) {
      h += '<a class="ref-dl__i" href="' + esc(d.u) + '" target="_blank" rel="noopener">' +
        esc(d.t) + '</a>';
    });
    return h + '</div>';
  }

  /** 展开 / 收起参考文献总表（force 为 true/false 时指定状态） */
  function toggleRefs(force) {
    const hd = $('refsToggle');
    const list = $('calcRefList');
    if (!hd || !list) return;
    const open = typeof force === 'boolean' ? force : !!list.hidden;
    list.hidden = !open;
    hd.classList.toggle('refs-hd--open', open);
    hd.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  /**
   * 一组输入框（两两一行）
   *
   * fields 里可以混入 `{ g: '① 形态 …' }` 这种无 k 的分段标题项：
   * 输入框按段成组显示，一段内仍两两一行。
   * 评估页（mitral / aortic）把「狭窄 / 反流」塞进同一条目，靠它分区。
   */
  function fieldsHtml(fields) {
    let h = '';
    let buf = [];
    const flush = function () {
      for (let i = 0; i < buf.length; i += 2) {
        h += '<div class="row">';
        for (let j = i; j < i + 2 && j < buf.length; j++) {
          const f = buf[j];
          h += '<div class="field"><label class="field__l">' + esc(f.n) +
            (f.u ? ' / ' + esc(f.u) : '') + '</label>' +
            '<input class="field__i" type="number" inputmode="decimal" step="any" ' +
            'data-ck="' + f.k + '" placeholder="未填写" value="' +
            (calcVal[f.k] !== undefined ? calcVal[f.k] : '') + '"></div>';
        }
        h += '</div>';
      }
      buf = [];
    };
    fields.forEach(function (f) {
      if (f.g) {
        flush();
        h += '<div class="fx-fgrp">' + esc(f.g) + '</div>';
      } else buf.push(f);
    });
    flush();
    return h;
  }

  /** 选项组（性别 / 心律 / 节段总数 …）：与 calc-groups.js 的 opts 同构 */
  function optsHtml(opts) {
    let h = '';
    opts.forEach(function (o) {
      const cur = calcOpt[o.k] !== undefined ? calcOpt[o.k] : o.list[0][0];
      h += '<div class="field"><label class="field__l">' + esc(o.n) + '</label>' +
        '<div class="seg" data-opt="' + o.k + '">';
      o.list.forEach(function (c) {
        h += '<div class="seg__i' + (c[0] === cur ? ' seg__i--on' : '') +
          '" data-v="' + esc(c[0]) + '">' + esc(c[1]) + '</div>';
      });
      h += '</div></div>';
    });
    return h;
  }

  /**
   * 生成公式集目录 + 各条目的详情卡
   *
   * ★ 新增条目：在 CALC_GROUPS / VALVE_INDEX 加一条，或在
   *   miniprogram/utils/extra-data.js 的 BRIEF_SECTIONS 加一条即可，
   *   目录会自动出现，不必改别处。
   */
  /** 目录数据（结构化）：血流动力学 / 瓣膜评估 / 各评估分组 / 外链分组
   *
   *  与小程序 calculators.js 的 buildSections() 同源同序。
   *  album 条目（整本书的视频）只占 1 行，children 不进目录，点进去才列切面。
   */
  function buildCalcSections() {
    // mergeInto：并入同名组，避免「瓣膜评估」与「瓣膜疾病评估」两个相似组并存
    const MERGED = {};
    BRIEF.forEach(function (sec) {
      if (!sec.mergeInto) return;
      (MERGED[sec.mergeInto] = MERGED[sec.mergeInto] || []).push(sec);
    });

    const secs = [];
    // 计算类条目按 CALC_SECTIONS 拆成 4 组（hemo / right / recon / ivs）
    CALC_SECTIONS.forEach(function (cs) {
      secs.push({
        id: cs.id,
        title: cs.title,
        items: CALC_GROUPS.filter(function (g) {
          return (g.sec || 'hemo') === cs.id;
        }).map(function (g) {
          return { kind: 'calc', id: g.id, title: g.title, sub: CALC_SUB[g.id] || '' };
        }),
      });
    });

    // 瓣膜评估组：v1.4.1 起 AS/AR/MS/MR/TR 就是 calc-groups 里的普通计算条目
    // （三层端目录一致），这里不再从 VALVE_INDEX 生成 kind:'valve' 条目，
    // 否则完整版里同一台计算器会出现两次。
    const valveItems = [];
    // ★ 瓣膜通用计算（sec: 'valve'）并入瓣膜组，紧跟瓣膜专用计算器之后
    //   —— 与小程序 calculators.js 的顺序严格一致
    CALC_GROUPS.filter(function (g) {
      return g.sec === 'valve';
    }).forEach(function (g) {
      valveItems.push({ kind: 'calc', id: g.id, title: g.title, sub: CALC_SUB[g.id] || '' });
    });
    (MERGED.valve || []).forEach(function (sec) {
      sec.items.forEach(function (it) {
        valveItems.push({ kind: 'brief', id: it.id, title: it.title, sub: it.sub || '' });
      });
    });
    secs.push({ id: 'valve', title: '瓣膜评估', items: valveItems });

    BRIEF.forEach(function (sec) {
      if (sec.mergeInto) return;
      secs.push({
        id: sec.id,
        title: sec.title,
        items: sec.items.map(function (it) {
          return { kind: 'brief', id: it.id, title: it.title, sub: it.sub || '' };
        }),
      });
    });

    LINKS.forEach(function (sec) {
      secs.push({
        id: sec.id,
        title: sec.title,
        note: sec.note || '',
        items: sec.items.map(function (it) {
          if (it.album) {
            return {
              kind: 'album', id: it.id, sec: sec.id, title: it.title,
              sub: it.sub || '', count: (it.children || []).length,
            };
          }
          return {
            kind: 'link', id: it.id, title: it.title, sub: it.sub || '', url: it.url,
          };
        }),
      });
    });

    // 本地资料（PDF / 图片 / 视频直链）：docs/materials/ 里有东西才出现
    const MT = window.Materials;
    if (MT && MT.MATERIALS && MT.MATERIALS.length) {
      secs.push({
        id: 'materials',
        title: '本地资料（PDF 等）',
        note: '放在 docs/materials/ 的本地资料，体积不影响工具本体；点击在新标签页打开',
        items: MT.MATERIALS.map(function (it) {
          return { kind: 'link', id: it.id, title: it.title, sub: it.sub || '', url: it.url };
        }),
      });
    }

    return secs;
  }

  /** 条目是否命中关键词（标题 + 说明，忽略大小写） */
  function hitKw(it, q) {
    return ((it.title || '') + ' ' + (it.sub || '')).toLowerCase().indexOf(q) !== -1;
  }

  /** 按 id 取专辑条目（含 children） */
  function albumOf(secId, itemId) {
    const sec = LINKS.filter(function (s) { return s.id === secId; })[0];
    if (!sec) return null;
    return sec.items.filter(function (it) {
      return it.id === itemId && it.album;
    })[0] || null;
  }

  /**
   * 渲染公式集目录（kw 为空即全量）
   *
   * 专辑的子条目也参与匹配：搜「房间隔」会把命中视频直接平铺出来，
   * 不必先点进专辑再翻；而专辑标题本身命中时仍只显示一条入口。
   */
  function renderCalcList(kw) {
    const box = $('calcList');
    if (!box) return;
    const q = (kw || '').trim().toLowerCase();
    const secs = buildCalcSections();
    let list = '';

    secs.forEach(function (sec) {
      const items = [];
      sec.items.forEach(function (it) {
        if (it.kind !== 'album') {
          if (!q || hitKw(it, q)) items.push(it);
          return;
        }
        if (!q || hitKw(it, q)) { items.push(it); return; }
        const alb = albumOf(it.sec, it.id);
        ((alb && alb.children) || []).forEach(function (c) {
          if (!hitKw(c, q)) return;
          items.push({ kind: 'link', id: c.id, title: c.title, sub: c.sub || '', url: c.url });
        });
      });
      if (!items.length) return;
      list += fxGroupHtml(sec.id, sec.title, sec.note);
      items.forEach(function (it) {
        list += fxItemHtml(it.kind, it.id, it.title, it.sub, it.url, it.count, it.sec);
      });
      list += '</div>';
    });

    if (!list) {
      list = '<div class="fx-empty">没有匹配「' + esc((kw || '').trim()) + '」的条目</div>';
    }
    // 组名跳转条：目录很长，点一下锚到该组（横向可滑动）
    let nav = '';
    secs.forEach(function (sec) {
      if (!sec.items.length) return;
      nav += '<a class="fx-nav__c" href="#g-' + esc(sec.id) + '">' +
        esc(sec.title.replace(/（.*?）/g, '')) + '</a>';
    });
    box.innerHTML = (nav ? '<div class="fx-nav">' + nav + '</div>' : '') + list;
  }

  /** 目录的事件绑定：搜索框 + 条目点击（都用委托 / 只绑一次，重渲染无需重绑） */
  let calcBound = false;
  function bindCalcListEvents() {
    if (calcBound) return;
    calcBound = true;

    const box = $('calcList');
    box.addEventListener('click', function (ev) {
      const el = ev.target.closest ? ev.target.closest('.fx-item') : null;
      if (!el) return;
      const kind = el.dataset.kind;
      // 外链条目渲染为 <a>，没有 data-kind：交给浏览器默认跳转（新窗口播放 / 打开原站）
      if (!kind) return;
      if (kind === 'valve') {
        switchTab('valves');
        switchValve(el.dataset.id);
      } else if (kind === 'album') {
        openAlbum(el.dataset.sec, el.dataset.id);
      } else {
        openCalcGroup(el.dataset.id);
      }
    });

    const sIn = $('fxSearch');
    const sClr = $('fxSearchClear');
    if (sIn) {
      sIn.addEventListener('input', function () {
        renderCalcList(sIn.value);
        if (sClr) sClr.hidden = !sIn.value;
      });
      // 回车只用于收起键盘，过滤是实时的
      sIn.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') sIn.blur();
      });
    }
    if (sClr) {
      sClr.addEventListener('click', function () {
        if (sIn) { sIn.value = ''; renderCalcList(''); sIn.focus(); }
        sClr.hidden = true;
      });
    }
  }

  /** 打开专辑：在公式集 Tab 内的第三个视图列出全部切面 */
  function openAlbum(secId, itemId, fromHistory) {
    const alb = albumOf(secId, itemId);
    if (!alb) return;
    const sec = LINKS.filter(function (s) { return s.id === secId; })[0];
    const kids = alb.children || [];

    if ($('albumTitle')) $('albumTitle').textContent = alb.title;
    if ($('albumDesc')) {
      $('albumDesc').textContent = '共 ' + kids.length + ' 段 · 点击条目在新窗口播放';
    }
    const nt = $('albumNote');
    if (nt) {
      // 书籍出处优先取专辑条目自带的 note（专辑已并入「切面学习」分组），其次取分组 note
      const noteTxt = alb.note || (sec && sec.note) || '';
      if (noteTxt) { nt.textContent = noteTxt; nt.hidden = false; }
      else { nt.textContent = ''; nt.hidden = true; }
    }

    if ($('albumList')) {
      let h = '<div class="fx-list">';
      kids.forEach(function (c) {
        h += '<a class="fx-item" href="' + esc(c.url) + '" target="_blank" rel="noopener noreferrer">' +
          '<span class="fx-item__main">' +
          '<span class="fx-item__n">' + esc(c.title) + '</span>' +
          '<span class="fx-item__d">' + esc(c.sub || '') + '</span>' +
          '</span><span class="fx-item__a">▶</span></a>';
      });
      h += '</div>';
      $('albumList').innerHTML = h;
    }

    if ($('calcIndex')) $('calcIndex').hidden = true;
    if ($('calcDetail')) $('calcDetail').hidden = true;
    if ($('calcAlbum')) $('calcAlbum').hidden = false;
    if ($('appbarTitle')) $('appbarTitle').textContent = alb.title;
    window.scrollTo(0, 0);
    if (!fromHistory) pushView({ type: 'album', sec: secId, id: itemId });
  }

  /** 从专辑回到目录 */
  function closeAlbum() {
    popView();
  }

  function buildCalcInputs() {
    if (!$('calcList')) return;

    // ── 目录 ──
    bindCalcListEvents();
    renderCalcList($('fxSearch') ? $('fxSearch').value : '');

    renderRefs();

    // ── 详情：一次性渲染全部条目卡，按条目切换显示 ──
    let html = '';
    CALC_GROUPS.forEach(function (g) {
      // 说明块（临床意义 / 参考标准 / 判读要点）来自 calc-notes.js，与小程序同源
      const nb = calcNotesBlocks(g.id);
      const bl = blocksHtml(nb, g.id);
      html += '<div class="card" data-g="' + g.id + '" hidden>' +
        '<div class="card__t">' + esc(g.title) + '</div>' +
        tocHtml(bl.toc) +
        bl.html +
        fieldsHtml(g.fields.map(function (f) { return { k: f[0], n: f[1], u: f[2] }; }));
      if (g.opts) html += optsHtml(g.opts);
      // 右房压条目需要 IVC 塌陷选项（与右心评估条目共用同一条状态）
      if (g.id === 'rapv') html += segHtml('calccollapse', CALC_COLLAPSE, calcCollapse);
      html += '<div class="note">' + mdInline(g.note) + '</div>' +
        '<div class="calc-out" id="calcOut-' + g.id + '">' +
        '<span class="calc-out__lbl">结果</span><span class="calc-out__v">等待输入</span></div></div>';
    });

    BRIEF.forEach(function (sec) {
      sec.items.forEach(function (it) {
        const bl = blocksHtml(it.blocks, it.id);
        html += '<div class="card" data-g="' + it.id + '" hidden>' +
          '<div class="card__t">' + esc(it.title) + '</div>' +
          tocHtml(bl.toc) +
          bl.html;
        if (it.fields && it.fields.length) {
          html += fieldsHtml(it.fields);
          if (it.id === 'rv') {
            html += segHtml('calccollapse', CALC_COLLAPSE, calcCollapse) +
              segHtml('calcsigns', CALC_SIGNS, calcSigns);
          }
        }
        if (it.fields && it.fields.length) {
          html += '<div class="calc-out" id="calcOut-' + it.id + '">' +
            '<span class="calc-out__lbl">结果</span><span class="calc-out__v">等待输入</span></div>';
        }
        if (it.note) html += '<div class="note">' + mdInline(it.note) + '</div>';
        html += briefRelHtml(it.rel) + briefRefsHtml(it.source) + '</div>';
      });
    });
    $('calcGroups').innerHTML = html;

    // 绑定输入（同 key 的多个输入框互相同步）
    $('calcGroups').querySelectorAll('input[data-ck]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const key = inp.dataset.ck;
        if (inp.value === '') delete calcVal[key];
        else calcVal[key] = inp.value;
        document.querySelectorAll('#calcGroups input[data-ck="' + key + '"]')
          .forEach(function (o) { if (o !== inp) o.value = inp.value; });
        renderCalc();
      });
    });
    // 「相关计算」胶囊：点了直接进对应计算器
    $('calcGroups').querySelectorAll('.chip[data-jump]').forEach(function (c) {
      c.addEventListener('click', function () { openCalcGroup(c.dataset.jump); });
    });
    // 「相关内容」胶囊：直接打开对应条目（同目录点击）
    $('calcGroups').querySelectorAll('.chip[data-rel]').forEach(function (c) {
      c.addEventListener('click', function () { openCalcGroup(c.dataset.rel); });
    });
    // 条目内小节导航：点胶囊滚到对应小节（与目录页组名跳转条同一套交互）
    $('calcGroups').querySelectorAll('.fx-nav--sec .fx-nav__c').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        const id = a.dataset.sec;
        const target = id ? document.getElementById(id) : null;
        if (!target) return;
        // 顶栏是 fixed 的，滚动后要留出高度，否则标题被盖住
        const top = target.getBoundingClientRect().top + window.pageYOffset - 56;
        goToY(top);
      });
    });
    // 绑定动态生成的分段选择器
    $('calcGroups').querySelectorAll('.seg').forEach(function (seg) {
      seg.querySelectorAll('.seg__i').forEach(function (item) {
        item.addEventListener('click', function () {
          const group = seg.dataset.seg;
          const val = item.dataset.v;
          seg.querySelectorAll('.seg__i').forEach(function (i) {
            i.classList.toggle('seg__i--on', i === item);
          });
          const fn = segHandlers[group];
          if (fn) fn(val);
        });
      });
    });
    // 选项组（性别 / 心律 / 节段总数 …）：高亮由上面的通用绑定负责，这里只记状态重算
    $('calcGroups').querySelectorAll('.seg[data-opt]').forEach(function (seg) {
      seg.querySelectorAll('.seg__i').forEach(function (item) {
        item.addEventListener('click', function () {
          calcOpt[seg.dataset.opt] = item.dataset.v;
          renderCalc();
        });
      });
    });
  }

  /**
   * 打开某条目（计算公式或评估内容）
   * fromHistory=true 表示由 popstate 触发，不再重复 push
   */
  function openCalcGroup(id, fromHistory) {
    const g = calcGroupOf(id);
    const b = briefOf(id);
    if (!g && !b) return;
    curCalcGroup = id;
    if ($('calcIndex')) $('calcIndex').hidden = true;
    if ($('calcDetail')) $('calcDetail').hidden = false;
    document.querySelectorAll('#calcGroups > .card').forEach(function (c) {
      c.hidden = c.dataset.g !== id;
    });
    $('appbarTitle').textContent = g ? g.title : b.title;
    renderCalc();
    window.scrollTo(0, 0);
    if (!fromHistory) pushView({ type: 'calc', id: id });
  }

  /** 回到公式集目录（界面还原，不动 history） */
  function restoreCalcIndex() {
    if ($('calcIndex')) $('calcIndex').hidden = false;
    if ($('calcDetail')) $('calcDetail').hidden = true;
    if ($('calcAlbum')) $('calcAlbum').hidden = true;
    $('appbarTitle').textContent = TAB_TITLE.calc;
    window.scrollTo(0, 0);
  }

  /** 回到公式集目录（用户点了「返回公式集」按钮） */
  function closeCalcGroup() {
    popView();
  }

  if ($('calcBack')) $('calcBack').addEventListener('click', closeCalcGroup);
  if ($('albumBack')) $('albumBack').addEventListener('click', closeAlbum);

  function segHtml(group, opts, cur) {
    let h = '<div class="field"><label class="field__l">' +
      (group === 'calccollapse' ? 'IVC 吸气塌陷' : 'PH 支持征象（≥2 类）') + '</label>' +
      '<div class="seg" data-seg="' + group + '">';
    opts.forEach(function (o) {
      h += '<div class="seg__i' + (o[0] === cur ? ' seg__i--on' : '') + '" data-v="' + o[0] + '">' + esc(o[1]) + '</div>';
    });
    return h + '</div></div>';
  }

  /** valve-calc 的 rows → 一行文本：`k v（分级）`，用 · 连接（评估页分段结果用） */
  function rowsText(rows) {
    return (rows || []).map(function (r) {
      return r.k + ' ' + r.v + (r.tag ? '（' + r.tag + '）' : '');
    }).join(' · ');
  }

  /** 重算全部计算组 */
  function renderCalc() {
    if (!$('calcGroups') || !Calc) return;
    const v = {};
    Object.keys(calcVal).forEach(function (k) {
      const n = parseFloat(calcVal[k]);
      if (calcVal[k] !== '' && !isNaN(n)) v[k] = n;
    });
    const bsa = state.bsa;
    const has = function () {
      for (let i = 0; i < arguments.length; i++) {
        if (v[arguments[i]] === undefined || !isFinite(v[arguments[i]])) return false;
      }
      return true;
    };
    const put = function (id, text) {
      const el = $('calcOut-' + id);
      if (el) el.querySelector('.calc-out__v').textContent = text || '等待输入';
    };
    const partsOf = function (arr) { return arr.filter(Boolean).join('；'); };

    // flow
    if (has('ld', 'lvti')) {
      const csa = Calc.csaFromDiameter(v.ld);
      const sv = Calc.strokeVolume(v.ld, v.lvti);
      const parts = ['CSA ' + Calc.fmt(csa) + ' cm²', 'SV ' + Calc.fmt(sv, 1) + ' mL'];
      if (has('hr')) {
        const co = Calc.cardiacOutput(sv, v.hr);
        parts.push('CO ' + Calc.fmt(co) + ' L/min');
        if (bsa > 0) {
          parts.push('SVi ' + Calc.fmt(sv / bsa, 1) + ' mL/m²');
          parts.push('CI ' + Calc.fmt(co / bsa) + ' L/min/m²');
        }
      }
      put('flow', partsOf(parts));
    } else put('flow');

    // shunt
    if (has('rd', 'rvti', 'ld', 'lvti')) {
      const qs = Calc.strokeVolume(v.ld, v.lvti);
      const qp = Calc.strokeVolume(v.rd, v.rvti);
      if (qs > 0) {
        const g = Calc.shuntGrade(qp, qs);
        put('shunt', 'Qp/Qs = ' + Calc.fmt(g.ratio) + ' · ' + g.text);
      } else put('shunt');
    } else put('shunt');

    // bernoulli
    if (has('v2')) {
      put('bernoulli', (has('v1') && v.v1 > v.v2)
        ? '近端速度不能大于远端速度，请核对取样位置'
        : 'ΔP = ' + Calc.fmt(Calc.bernoulli(v.v2, v.v1), 1) + ' mmHg');
    } else put('bernoulli');

    // atrial
    if (bsa > 0 && (has('lav') || has('rav'))) {
      const parts = [];
      if (has('lav')) parts.push('LAVI ' + Calc.fmt(v.lav / bsa) + ' mL/m²');
      if (has('rav')) parts.push('RAVI ' + Calc.fmt(v.rav / bsa) + ' mL/m²');
      put('atrial', partsOf(parts));
    } else put('atrial');

    // dias
    {
      const r = Calc.diastolicRatios(
        v.e === undefined ? null : v.e,
        v.a === undefined ? null : v.a,
        v.es === undefined ? null : v.es,
        v.el === undefined ? null : v.el
      );
      const parts = [];
      if (r.ea !== undefined) parts.push('E/A = ' + Calc.fmt(r.ea));
      if (r.avgEe !== undefined) parts.push('平均 E/e′ = ' + Calc.fmt(r.avgEe) + '（' + Calc.gradeEe(r.avgEe).text + '）');
      put('dias', partsOf(parts));
    }

    const female = state.sex === 'female';

    // 左室容积与射血分数
    if (has('edv', 'esv')) {
      const r = Calc.lvEf(v.edv, v.esv, bsa);
      if (r.error) put('ef', r.error);
      else {
        const parts = ['EF ' + Calc.fmt(r.ef, 1) + '%', 'SV ' + Calc.fmt(r.sv, 1) + ' mL'];
        if (r.svi !== undefined) {
          parts.push('SVi ' + Calc.fmt(r.svi, 1) + ' mL/m²');
          parts.push('ESVi ' + Calc.fmt(r.esvi, 1) + ' mL/m²');
        }
        if (r.text) parts.push('→ ' + r.text);
        put('ef', partsOf(parts));
      }
    } else put('ef');

    // 左室质量与几何构型
    if (has('lvid', 'ivs', 'lvpw')) {
      const r = Calc.lvMass({ lvid: v.lvid, ivs: v.ivs, lvpw: v.lvpw, bsa: bsa, female: female });
      const parts = ['LV Mass ' + Calc.fmt(r.mass, 1) + ' g', 'RWT ' + Calc.fmt(r.rwt, 2)];
      if (r.lvmi !== undefined) {
        parts.push('LVMI ' + Calc.fmt(r.lvmi, 1) + ' g/m²（' + (female ? '女' : '男') + ' 上限 ' + r.hi + '）');
      }
      if (r.text) parts.push('→ ' + r.text);
      put('lvmass', partsOf(parts));
    } else put('lvmass');

    // MAPSE
    if (has('mapse')) {
      const r = Calc.mapseIndex(v.mapse);
      put('mapse', 'MAPSE ' + Calc.fmt(v.mapse, 0) + ' mm → ' + r.text);
    } else put('mapse');

    // DVI
    if (has('dlvti', 'davti')) {
      const r = Calc.dviIndex(v.dlvti, v.davti);
      put('dvi', r.error ? r.error : 'DVI = ' + Calc.fmt(r.dvi, 2) + ' → ' + r.text);
    } else put('dvi');

    // Tei 指数 MPI
    if (has('ivct', 'ivrt', 'et')) {
      const side = v.tside === 2 ? 'rv' : 'lv';
      const r = Calc.teiIndex(v.ivct, v.ivrt, v.et, side);
      put('tei', 'MPI = ' + Calc.fmt(r.mpi, 2) + '（' + (side === 'rv' ? '右室' : '左室') +
        ' 上限 ' + Calc.fmt(r.cut, 2) + '）→ ' + r.text);
    } else put('tei');

    // 平均肺动脉压
    if (has('prv', 'mrap')) {
      const r = Calc.mpap(v.prv, v.mrap);
      put('mpap', 'mPAP ≈ ' + Calc.fmt(r.mpap, 1) + ' mmHg → ' + r.text);
    } else put('mpap');

    // ── 右心与肺循环 ──
    // PASP
    if (has('ptrv', 'prap')) {
      const val = Calc.pasp(v.ptrv, v.prap);
      put('paspv', 'PASP ≈ ' + Calc.fmt(val, 1) + ' mmHg（4×' + Calc.fmt(v.ptrv, 2) +
        '² + ' + Calc.fmt(v.prap, 0) + '）→ ' + Calc.paspGrade(val).text);
    } else put('paspv');

    // 右房压（IVC 法）
    {
      const r = Calc.rapEstimate(v.rivc, calcCollapse);
      if (r.rap !== undefined) {
        put('rapv', 'RAP ≈ ' + r.rap + ' mmHg · IVC ' + Calc.fmt(r.ivc, 0) + ' mm · ' + r.text);
      } else put('rapv');
    }

    // 右室 FAC
    if (has('feda', 'fesa')) {
      if (v.fesa >= v.feda) put('rvfacv', 'RVESA 不可大于或等于 RVEDA，请核对');
      else {
        const f = Calc.fac(v.feda, v.fesa);
        put('rvfacv', 'FAC ' + Calc.fmt(f, 1) + '% · ' +
          (f >= 35 ? '正常（≥35%）' : f >= 25 ? '轻度减低（25–35%）' : '明显减低（<25%）'));
      }
    } else put('rvfacv');

    // TAPSE/PASP
    if (has('ctapse', 'cpasp')) {
      const r = Calc.tapsePasp(v.ctapse, v.cpasp);
      put('rcratiov', 'TAPSE/PASP = ' + Calc.fmt(r.ratio, 2) + ' mm/mmHg · ' + r.text);
    } else put('rcratiov');

    // PVR
    {
      const r = Calc.pvrResistance(v.hmmpap, v.hmpawp, v.hmco);
      if (r.error) put('pvrv', r.error);
      else if (r.wu !== undefined) {
        put('pvrv', 'PVR ' + Calc.fmt(r.wu) + ' WU（' + Calc.fmt(r.dyn, 0) +
          ' dyn·s·cm⁻⁵，跨瓣压差 ' + Calc.fmt(r.grad, 1) + ' mmHg）· ' + r.text);
      } else put('pvrv');
    }

    // SVR
    {
      const r = Calc.svrResistance(v.smap, v.srap, v.sco, bsa);
      if (r.dyn !== undefined) {
        const parts = ['SVR ' + Calc.fmt(r.dyn, 0) + ' dyn·s·cm⁻⁵'];
        if (r.svri !== undefined) parts.push('SVRI ' + Calc.fmt(r.svri, 0));
        parts.push('· ' + r.text);
        put('svrv', partsOf(parts));
      } else put('svrv');
    }

    // ── 舒张功能定量 ──
    // PISA
    if (has('prad', 'pvmax')) {
      const alias = has('palias') ? v.palias : 40;
      const r = Calc.pisa(v.prad, alias, v.pvmax, has('pvti') ? v.pvti : undefined);
      const ge = Calc.gradeEroa(r.eroa);
      const parts = ['流量 ' + Calc.fmt(r.flow, 1) + ' mL/s', 'EROA ' + Calc.fmt(r.eroa, 2) + ' cm²'];
      let worst = ge.text;
      if (r.rvol !== undefined) {
        parts.push('RVol ' + Calc.fmt(r.rvol, 0) + ' mL');
        const gr = Calc.gradeRvol(r.rvol);
        if (gr.level === 'severe') worst = '重度反流';
        else if (gr.level === 'moderate' && ge.level !== 'severe') worst = '中度反流';
      }
      parts.push('→ ' + worst);
      put('pisav', partsOf(parts));
    } else put('pisav');

    // AVA 连续性方程
    if (has('ald', 'alvti', 'aavti')) {
      const sv = Calc.strokeVolume(v.ald, v.alvti);
      const ava = Calc.avaContinuity(sv, v.aavti);
      const parts = ['SV ' + Calc.fmt(sv, 1) + ' mL', 'AVA ' + Calc.fmt(ava, 2) + ' cm²（' + Calc.gradeAva(ava).text + '）'];
      if (bsa > 0) {
        const idx = ava / bsa;
        parts.push('AVAi ' + Calc.fmt(idx, 2) + ' cm²/m²' + (idx <= 0.6 ? '（≤0.6 支持重度）' : ''));
      }
      const dvi = Calc.dviIndex(v.alvti, v.aavti);
      if (!dvi.error) parts.push('DVI ' + Calc.fmt(dvi.dvi, 2));
      put('avav', partsOf(parts));
    } else put('avav');

    // AS 负荷量化（ELI · Zva · SWL）
    {
      const sum = Calc.asLoadSummary({
        vmax: has('alvmax') ? v.alvmax : null,
        meanGrad: has('almean') ? v.almean : null,
        eoa: has('alava') ? v.alava : null,
        ascAo: has('alao') ? v.alao : null,
        sbp: has('alsbp') ? v.alsbp : null,
        sv: has('alsv') ? v.alsv : null,
        bsa: bsa,
      });
      const parts = [];
      const notes = [];
      if (sum.eli) { parts.push(sum.eli.text); notes.push(sum.eli.note); }
      if (sum.zva) { parts.push(sum.zva.text); notes.push(sum.zva.note); }
      if (sum.swl) { parts.push(sum.swl.text); notes.push(sum.swl.note); }
      if (sum.pr) parts.push(sum.pr.text);
      if (parts.length) {
        put('asload', partsOf(parts) + (notes.length ? '｜' + notes.join('｜') : ''));
      } else {
        put('asload', '请至少填写：EOA + 升主动脉直径（算 ELI）、收缩压 + 每搏量 + 身高体重（算 Zva）、平均压差（算 SWL）');
      }
    }

    // 压力恢复校正
    {
      const r = Calc.pressureRecovery(
        has('prvmax') ? v.prvmax : null,
        has('preoa') ? v.preoa : null,
        has('prao') ? v.prao : null,
      );
      put('pr', r.error ? r.error : (r.text + '｜' + r.note));
    }

    // MVA（PHT 法 + 连续性方程，同屏对照）
    {
      const m = Calc.mvaBoth(
        has('mpht') ? v.mpht : null,
        has('mvd') ? v.mvd : null,
        has('mvlvti') ? v.mvlvti : null,
        has('mvmvti') ? v.mvmvti : null
      );
      const parts = [];
      if (m.pht !== undefined) {
        parts.push('MVA ' + Calc.fmt(m.pht, 2) + ' cm²（PHT 法）→ ' + m.phtText);
      }
      if (m.cont !== undefined) {
        parts.push('MVA ' + Calc.fmt(m.cont, 2) + ' cm²（连续方程，SV ' +
          Calc.fmt(m.sv, 1) + ' mL）→ ' + m.contText);
      }
      if (m.diffText) parts.push(m.diffText);
      put('mva', partsOf(parts));
    }

    // 人工瓣 EOAi / PPM
    {
      const r = Calc.eoaPpm(v.peoa, bsa, v.ppos, v.pbmi);
      if (r.eoai !== undefined) {
        put('ppm', 'EOAi ' + Calc.fmt(r.eoai, 2) + ' cm²/m²（' +
          (r.pos === 'av' ? '主动脉位' : '二尖瓣位') + '）→ ' + r.text);
      } else if (has('peoa') && bsa <= 0) {
        put('ppm', '需先在「EF·参考值」页填写身高体重（BSA 为 0 时无法算 EOAi）');
      } else put('ppm');
    }

    // 瓣膜专用定量（AS / AR / MS / MR / TR）——v1.4.1 起与小程序共用 valve-calc 引擎
    // 结果行直接把前 5 项算出来的数值列出来（AVA / EROA / VC 这些才是要点），
    // 末尾再缀一句综合分级，跟瓣膜页原来的表格信息量对齐。
    ['as', 'ar', 'ms', 'mr', 'tr'].forEach(function (vid) {
      if (!ValveCalc) { put(vid, ''); return; }
      // 输入键带条目前缀（as_lvotD），去掉前缀还原成引擎认的键名
      const vv = {};
      Object.keys(v).forEach(function (k) {
        if (k.indexOf(vid + '_') === 0) vv[k.slice(vid.length + 1)] = v[k];
      });
      const rv = ValveCalc.valveCalc(vid, vv, bsa);
      let txt = '';
      if (rv.rows && rv.rows.length) {
        txt = rv.rows.slice(0, 5).map(function (r) {
          return r.k + ' ' + r.v + (r.tag ? '（' + r.tag + '）' : '');
        }).join(' · ') + '｜' + rv.summary;
      }
      put(vid, txt);
    });

    // 舒张功能分级
    {
      const f = Calc.lvFilling({
        e: v.dfe === undefined ? null : v.dfe,
        a: v.dfa === undefined ? null : v.dfa,
        es: v.dfes === undefined ? null : v.dfes,
        el: v.dfel === undefined ? null : v.dfel,
        lavi: v.dflavi === undefined ? null : v.dflavi,
        trv: v.dftrv === undefined ? null : v.dftrv,
      });
      const parts = [];
      if (f.ea !== undefined) parts.push('E/A ' + Calc.fmt(f.ea));
      if (f.avgEe !== undefined) parts.push('平均 E/e′ ' + Calc.fmt(f.avgEe));
      if (f.count > 0) parts.push('升高指标 ' + f.count + ' 项（' + f.crit.join('、') + '）');
      else parts.push('升高指标 0 项');
      if (f.text) parts.push('→ ' + f.text);
      put('dfun', partsOf(parts));
    }

    // ── 重构与心肌功能 ──
    // 容积指数
    {
      const r = Calc.volumeIndices(v.vedv, v.vesv, bsa, female);
      if (r.error) put('volidx', r.error);
      else if (r.sv !== undefined) {
        const parts = ['EF ' + Calc.fmt(r.ef, 1) + '%', 'SV ' + Calc.fmt(r.sv, 1) + ' mL'];
        if (r.edvi !== undefined) {
          parts.push('EDVi ' + Calc.fmt(r.edvi, 1) + '（' + r.edviText + '）');
          parts.push('ESVi ' + Calc.fmt(r.esvi, 1) + '（' + r.esviText + '）');
          parts.push('SVi ' + Calc.fmt(r.svi, 1));
        } else {
          parts.push('填身高体重后给出 EDVi / ESVi（上限 ' + (female ? '女 61 / 24' : '男 74 / 31') + '）');
        }
        if (r.notes && r.notes.length) parts.push(r.notes.join('；'));
        put('volidx', partsOf(parts));
      } else put('volidx');
    }

    // 相对室壁应力
    if (has('rsbp', 'rlvedd', 'rpwt')) {
      const r = Calc.relativeWallStress(v.rsbp, v.rlvedd, v.rpwt);
      put('rwsv', 'RWS ' + Calc.fmt(r.rws, 0) + ' ×10³ dyn/cm² · ' + r.text);
    } else put('rwsv');

    // 球形指数
    if (has('sdd', 'sld')) {
      const r = Calc.sphericityIndex(v.sdd, v.sld);
      put('spher', r.error ? r.error : 'SI ' + Calc.fmt(r.si, 2) + '（' + Calc.fmt(v.sdd, 2) +
        ' ÷ ' + Calc.fmt(v.sld, 2) + '）· ' + r.text);
    } else put('spher');

    // 左房应变三值
    {
      const r = Calc.laStrainTri(v.lsr, v.lscd, v.lsct);
      const parts = [];
      if (r.sr !== undefined) parts.push('LASr ' + Calc.fmt(r.sr, 1) + '% · ' + r.srText);
      if (r.scd !== undefined) parts.push('LAScd ' + Calc.fmt(r.scd, 1) + '% · ' + r.scdText);
      if (r.sct !== undefined) parts.push('LASct ' + Calc.fmt(r.sct, 1) + '% · ' + r.sctText);
      if (r.consistent !== undefined) {
        parts.push(r.consistent
          ? '三值自洽（LAScd+|LASct| 偏差 ' + Calc.fmt(r.diff, 1) + '）'
          : '偏差 ' + Calc.fmt(r.diff, 1) + '：LASr 与 LAScd+|LASct| 不符，检查勾画与时相');
      }
      put('lastrain', partsOf(parts));
    }

    // 升主动脉指数
    {
      const r = Calc.aortaIndex(v.aodim, bsa, female);
      if (r.index !== undefined) {
        put('aortaidx', '内径 ' + Calc.fmt(r.cm, 1) + ' cm · 指数 ' + Calc.fmt(r.index, 2) +
          ' cm/m² → ' + r.text + '；' + r.absText);
      } else if (has('aodim') && bsa <= 0) {
        put('aortaidx', '需先在「EF·参考值」页填写身高体重（BSA 为 0 时无法算指数）');
      } else put('aortaidx');
    }

    // 应变离散度
    {
      const r = Calc.strainDispersion([v.mds1, v.mds2, v.mds3, v.mds4, v.mds5, v.mds6]);
      if (r.n) {
        put('mdsv', '均值 ' + Calc.fmt(r.mean, 1) + '% · SD ' + Calc.fmt(r.sd, 1) +
          '%（范围 ' + Calc.fmt(r.min, 1) + '–' + Calc.fmt(r.max, 1) + '，n=' + r.n + '）· ' + r.text);
      } else put('mdsv');
    }

    // 每搏功
    if (has('ssv', 'wmap')) {
      const r = Calc.strokeWork(v.ssv, v.wmap, bsa);
      const parts = ['SW ' + Calc.fmt(r.sw, 1) + ' g·m'];
      if (r.swi !== undefined) parts.push('SWi ' + Calc.fmt(r.swi, 1) + ' g·m/m²');
      parts.push('· ' + r.text);
      put('swv', partsOf(parts));
    } else put('swv');

    // ── v1.2.8 第一批：M 型 / 评分体系 / 介入尺寸 ──

    // M 型三合一
    {
      const r = Calc.mModeTriple(v.mtdd, v.mtds, v.mtepss);
      if (r.error) put('mtype', r.error);
      else {
        const parts = [
          'FS ' + Calc.fmt(r.fs, 1) + '% · ' + r.fsText,
          'Teichholz EDV ' + Calc.fmt(r.edv, 1) + ' / ESV ' + Calc.fmt(r.esv, 1) +
            ' mL / EF ' + Calc.fmt(r.ef, 1) + '% · ' + r.efText,
        ];
        if (r.epss !== undefined) parts.push(r.epssText);
        if (r.mismatch) parts.push(r.mismatch);
        put('mtype', partsOf(parts));
      }
    }

    // WMSI 室壁运动积分
    {
      const r = Calc.wmsiIndex([v.wn1, v.wn2, v.wn3, v.wn4, v.wn5]);
      if (r.error) put('wmsi', r.error);
      else {
        const want = parseInt(calcOpt.wseg || '17', 10);
        const parts = ['WMSI = ' + Calc.fmt(r.wmsi, 2) + '（' + r.total + ' 节段，总分 ' + r.score + '）'];
        if (r.total !== want) parts.push('注意：录入节段数 ' + r.total + ' 与所选 ' + want + ' 节段不一致');
        parts.push(r.text);
        put('wmsi', partsOf(parts));
      }
    }

    // H2FPEF
    if (has('hbmi', 'hage', 'hee', 'hpasp')) {
      const r = Calc.h2fpefScore({
        bmi: v.hbmi, age: v.hage, ee: v.hee, pasp: v.hpasp,
        af: calcOpt.haf === '1', bpMeds: calcOpt.hbp === '1' ? 2 : 1,
      });
      const parts = ['H2FPEF ' + r.score + ' 分 · ' + r.text];
      if (r.items.length) {
        parts.push('计分项：' + r.items.map(function (it) { return it[0] + ' +' + it[1]; }).join('、'));
      }
      put('h2fpef', partsOf(parts));
    } else put('h2fpef');

    // HFA-PEFF
    if (has('hlavi') || has('hee2') || has('hbnp')) {
      const r = Calc.hfaPeffScore({
        female: calcOpt.hsex === 'f', af: calcOpt.haf2 === '1',
        lavi: v.hlavi, lvmi: v.hlvmi, rwt: v.hrwt, pasp: v.hpasp2,
        ee: v.hee2, es: v.hes, el: v.hel, trv: v.htrv,
        gls: v.hgls, ntprobnp: v.hbnp,
      });
      put('hfapeff', 'HFA-PEFF ' + r.score + ' 分（形态 ' + r.structural +
        ' + 功能 ' + r.functional + ' + 标志物 ' + r.biomarker + '）· ' + r.text);
    } else put('hfapeff');

    // TAVR 瓣环与 oversizing
    if (has('tcirc') || has('tarea')) {
      const r = Calc.tavrSizing(v.tcirc, v.tarea, v.tnom);
      if (r.error) put('tavrsz', r.error);
      else {
        const parts = [];
        if (r.dc !== undefined) parts.push('周长导出直径 ' + Calc.fmt(r.dc, 1) + ' mm');
        if (r.da !== undefined) parts.push('面积导出直径 ' + Calc.fmt(r.da, 1) + ' mm');
        if (r.areaOver !== undefined) {
          parts.push('面积 oversizing ' + Calc.fmt(r.areaOver, 1) + '%');
          if (r.circOver !== undefined) parts.push('周长 oversizing ' + Calc.fmt(r.circOver, 1) + '%');
          parts.push(r.text);
        } else if (r.hint) parts.push(r.hint);
        put('tavrsz', partsOf(parts));
      }
    } else put('tavrsz');

    // 左心耳封堵尺寸
    if (has('lzmax')) {
      const r = Calc.laaSize(v.lzmax, v.lzmin, v.lzdepth);
      if (r.error) put('laasz', r.error);
      else {
        const parts = [];
        if (r.ratio !== undefined) parts.push('长短径比 ' + Calc.fmt(r.ratio, 2));
        parts.push(r.text);
        if (r.shapeText) parts.push(r.shapeText);
        if (r.depthWarn) parts.push(r.depthWarn);
        put('laasz', partsOf(parts));
      }
    } else put('laasz');

    // 主动脉扩张增长率
    if (has('d1', 'd2', 'yrs')) {
      const r = Calc.aorticGrowthRate(v.d1, v.d2, v.yrs);
      put('aortagrow', r.error ? r.error : r.text + '｜' + r.note);
    } else put('aortagrow');

    // 人工瓣术后跨瓣血流
    if (has('lvotD', 'lvotVti', 'valveVti') || has('fupvmax') || has('fupmean')) {
      const r = Calc.prostheticValveFunction({
        lvotD: v.lvotD, lvotVti: v.lvotVti, valveVti: v.valveVti,
        vmax: v.fupvmax, meanGrad: v.fupmean, bsa: bsa,
      });
      put('pvfu', r.error ? r.error : r.text + '｜' + r.note);
    } else put('pvfu');

    // 冠脉血流储备
    if (has('distal', 'proximal')) {
      const r = Calc.coronaryFlowReserve(v.distal, v.proximal);
      put('cfr', r.error ? r.error : r.text + '｜' + r.note);
    } else put('cfr');

    // ── v1.2.9 第二批：右心与肺循环 ──

    // RV 容积指数
    if (has('rvedv')) {
      const r = Calc.rvVolumeIndex(v.rvedv, v.rvesv, bsa, female);
      if (r.error) put('rvvol', r.error);
      else {
        const parts = ['RVEDVi ' + Calc.fmt(r.edvi, 1) + ' mL/m² · ' + r.edvText];
        if (r.esvi !== undefined) {
          parts.push('RVESVi ' + Calc.fmt(r.esvi, 1) + ' mL/m² · ' + r.esvText);
        }
        put('rvvol', partsOf(parts));
      }
    } else put('rvvol');

    // RVFWS
    if (has('rfb') || has('rfm') || has('rfa')) {
      const r = Calc.rvFreeWallStrain(v.rfb, v.rfm, v.rfa);
      if (r.error) put('rvfws', r.error);
      else put('rvfws', 'RVFWS 均值 ' + Calc.fmt(r.mean, 1) + '%（' + r.n + ' 段）· ' + r.text);
    } else put('rvfws');

    // PAPi
    if (has('pispap', 'pidpap', 'pirap')) {
      const r = Calc.pulmonaryPulseIndex(v.pispap, v.pidpap, v.pirap);
      put('papi', r.error ? r.error : 'PAPi = ' + Calc.fmt(r.papi, 2) + ' · ' + r.text);
    } else put('papi');

    // PADP
    if (has('pdprv')) {
      const r = Calc.pulmonaryDiastolicPressure(v.pdprv, v.pdrap);
      put('pdap', r.error ? r.error
        : 'PADP ≈ ' + Calc.fmt(r.padp, 1) + ' mmHg（压差 ' + Calc.fmt(r.grad, 1) + ' + RAP）');
    } else put('pdap');

    // 阻力指数
    if (has('ripvr') || has('risvr')) {
      const r = Calc.resistanceIndices(v.ripvr, v.risvr, bsa);
      if (r.error) put('residx', r.error);
      else {
        const parts = [];
        if (r.pvri !== undefined) parts.push('PVRI ' + Calc.fmt(r.pvri, 1) + ' WU·m² · ' + r.pvriText);
        if (r.svri !== undefined) parts.push('SVRI ' + Calc.fmt(r.svri, 0) + ' · ' + r.svriText);
        put('residx', partsOf(parts));
      }
    } else put('residx');

    // RV dP/dt
    if (has('rdt')) {
      const r = Calc.rvDpDt(v.rdt);
      put('rvdvdt', r.error ? r.error : 'RV dP/dt ≈ ' + Calc.fmt(r.dpdt, 0) + ' mmHg/s · ' + r.text);
    } else put('rvdvdt');

    // ── v1.3.0 第三批：瓣膜与舒张细节 ──

    // Wilkins 形态评分
    if (has('wk1') || has('wk2') || has('wk3') || has('wk4')) {
      const r = Calc.wilkinsScore(v.wk1, v.wk2, v.wk3, v.wk4);
      put('wilkins', r.error ? r.error : 'Wilkins 总分 ' + r.total + ' / 16 · ' + r.text);
    } else put('wilkins');

    // 缩流颈宽度
    if (has('vcwv')) {
      const r = Calc.vcwGrade(v.vcwv, calcOpt.vsite || 'mr');
      put('vcw', r.error ? r.error : r.text);
    } else put('vcw');

    // 反流分数
    if (has('rfvol', 'rfsv')) {
      const r = Calc.regurgFraction(v.rfvol, v.rfsv);
      put('rf', r.error ? r.error : 'RF = ' + Calc.fmt(r.rf, 1) + '% · ' + r.text);
    } else put('rf');

    // E/Vp 左房压估测
    if (has('evpe', 'evpvp')) {
      const r = Calc.evpRatio(v.evpe, v.evpvp);
      const parts = r.error ? [r.error] : ['E/Vp ' + Calc.fmt(r.ratio, 2), r.vpText, r.text];
      if (!r.error && r.note) parts.push(r.note);
      put('evp', partsOf(parts));
    } else put('evp');

    // 左房僵硬度
    if (has('lsee', 'lslars')) {
      const r = Calc.laStiffness(v.lsee, v.lslars);
      const parts = r.error ? [r.error] : ['LA stiffness ' + Calc.fmt(r.stiffness, 2), r.text];
      if (!r.error && r.note) parts.push(r.note);
      put('lastiff', partsOf(parts));
    } else put('lastiff');

    // RVOT / LVOT VTI 比
    if (has('vtrvo', 'vtrlo')) {
      const r = Calc.vtiRatio(v.vtrvo, v.vtrlo);
      put('vtir', r.error ? r.error : 'VTI 比 ' + Calc.fmt(r.ratio, 2) + '；' + r.text);
    } else put('vtir');

    // 致密化不全 NC/C
    if (has('lnvnc', 'lnvc')) {
      const r = Calc.lvncRatio(v.lnvnc, v.lnvc);
      const parts = r.error ? [r.error] : ['NC/C ' + Calc.fmt(r.ratio, 2), r.text];
      if (!r.error && r.note) parts.push(r.note);
      put('lvnc', partsOf(parts));
    } else put('lvnc');

    // 超声肺高压可能性（2022 ESC/ERS）
    {
      const signs = calcOpt.phsign === 'y';
      if (has('phv') || has('phrvotat') || signs) {
        const r = Calc.phLikelihood(v.phv, signs, v.phrvotat);
        const parts = r.error ? [r.error] : ['可能性 ' + r.prob, r.text];
        if (!r.error && r.atText) parts.push(r.atText);
        if (!r.error && r.note) parts.push(r.note);
        put('phprob', partsOf(parts));
      } else put('phprob');
    }

    // 左房排空分数
    if (has('lavmax', 'lavmin')) {
      const r = Calc.laEmptying(v.lavmax, v.lavmin);
      put('laef', r.error ? r.error : 'LAEF ' + Calc.fmt(r.laef, 1) + '% · 扩张指数 ' +
        Calc.fmt(r.expand, 1) + '% · ' + r.text);
    } else put('laef');

    // 快速比值
    if (has('qla', 'qao') || has('qrv', 'qlv')) {
      const r = Calc.quickRatios(v.qla, v.qao, v.qrv, v.qlv);
      if (r.error) put('quickratio', r.error);
      else {
        const parts = [];
        if (r.laAo !== undefined) parts.push('LA/Ao = ' + Calc.fmt(r.laAo) + ' · ' + r.laAoText);
        if (r.rvLv !== undefined) parts.push('RV/LV = ' + Calc.fmt(r.rvLv) + ' · ' + r.rvLvText);
        put('quickratio', partsOf(parts));
      }
    } else put('quickratio');

    // LVMI 身高^2.7
    if (has('lhmass', 'lhheight')) {
      const r = Calc.lvmHeightIndex(v.lhmass, v.lhheight, female);
      put('lvmih', r.error ? r.error : 'LVMI ' + Calc.fmt(r.index, 1) + ' g/m^2.7 · ' + r.text);
    } else put('lvmih');

    // ── v1.3.0 第四批：先心 / 心肌 / 耦联 ──

    // McGoon / Nakata
    if (has('prpa', 'plpa')) {
      const r = Calc.paIndex(v.prpa, v.plpa, v.pdao, bsa);
      if (r.error) put('paidx', r.error);
      else {
        const parts = [];
        if (r.mcgoon !== undefined) parts.push('McGoon ' + Calc.fmt(r.mcgoon) + ' · ' + r.mcgoonText);
        if (r.nakata !== undefined) parts.push('Nakata ' + Calc.fmt(r.nakata, 0) + ' mm²/m² · ' + r.nakataText);
        put('paidx', partsOf(parts));
      }
    } else put('paidx');

    // 心尖保留比值
    if (has('rasap', 'rasba')) {
      const r = Calc.apicalSparing(v.rasap, v.rasba);
      put('ras', r.error ? r.error : 'RAS = ' + Calc.fmt(r.ras) + ' · ' + r.text);
    } else put('ras');

    // Ea / Ees-Ea
    if (has('eaesp', 'easv', 'eaesv')) {
      const r = Calc.ventriculoArterial(v.eaesp, v.easv, v.eaesv);
      if (r.error) put('ea', r.error);
      else {
        put('ea', 'Ea ' + Calc.fmt(r.ea) + ' mmHg/mL · Ees(单点) ' + Calc.fmt(r.ees, 2) +
          ' · Ees/Ea ' + Calc.fmt(r.ratio) + ' · ' + r.text);
      }
    } else put('ea');

    // 主动脉缩窄
    if (has('coav')) {
      const r = Calc.coarctationEcho(v.coav, v.coaved);
      if (r.error) put('coa', r.error);
      else {
        const parts = ['峰值压差 ' + Calc.fmt(r.grad, 0) + ' mmHg · ' + r.text];
        if (r.continuum) parts.push(r.continuum);
        put('coa', partsOf(parts));
      }
    } else put('coa');

    // 主动脉分节段 Z 值
    if (has('azann') || has('azsin') || has('azstj') || has('azasc')) {
      const r = Calc.aorticZscore(
        [v.azann, v.azsin, v.azstj, v.azasc], calcOpt.azsex === 'f', bsa);
      if (r.error) put('aortaz', r.error);
      else {
        const segTxt = r.segs.map(function (s) {
          return s.sn + ' Z ' + Calc.fmt(s.z, 1) + '（参考 ' + s.lo + '–' + s.hi + ' cm）';
        }).join(' / ');
        put('aortaz', partsOf([segTxt, r.text, r.ascIndexText]));
      }
    } else put('aortaz');

    // ── 评估类条目（切面与图像 / 心腔应变与负荷 / …）──

    // CRT：SV / SVi（低流量）+ QRS 时限提示
    {
      const parts = [];
      if (has('ld', 'lvti')) {
        const sv = Calc.strokeVolume(v.ld, v.lvti);
        parts.push('SV ' + Calc.fmt(sv, 1) + ' mL');
        if (bsa > 0) {
          const svi = sv / bsa;
          parts.push('SVi ' + Calc.fmt(svi, 1) + ' mL/m²');
          if (svi < 35) parts.push('（低流量）');
        }
      }
      if (v.qrs !== undefined) {
        parts.push('QRS ' + Calc.fmt(v.qrs, 0) + ' ms → ' + (
          v.qrs >= 150 ? '≥150 ms，CRT 指征最强（LBBB 为 I 类、非 LBBB 为 IIa）'
            : v.qrs >= 130 ? '130–149 ms，LBBB 为 IIa、非 LBBB 为 IIb'
              : '＜130 ms，通常不满足 CRT 指征'));
      }
      put('crt', partsOf(parts));
    }

    // 左心房容积指数
    if (has('lav') && bsa > 0) {
      const lavi = v.lav / bsa;
      put('la', 'LAVi ' + Calc.fmt(lavi) + ' mL/m² · ' +
        (lavi > 34 ? '增大（>34 mL/m²，男女同阈值）' : '正常（≤34 mL/m²）'));
    } else put('la');

    // 左室质量指数分级 + 相对室壁厚度
    {
      const parts = [];
      if (v.lvmi !== undefined) {
        const female = state.sex === 'female';
        const bands = female
          ? [[0, 89, '正常'], [90, 107, '轻度增高'], [108, 121, '中度增高'], [122, 137, '重度增高'], [138, Infinity, '极重度增高']]
          : [[0, 95, '正常'], [96, 115, '轻度增高'], [116, 131, '中度增高'], [132, 149, '重度增高'], [150, Infinity, '极重度增高']];
        let lvl = '';
        bands.forEach(function (bd) {
          if (v.lvmi >= bd[0] && v.lvmi <= bd[1]) lvl = bd[2];
        });
        parts.push('LVMI ' + Calc.fmt(v.lvmi, 1) + ' g/m²（' +
          (female ? '女性' : '男性') + '）→ ' + lvl);
      }
      if (v.rwt !== undefined) {
        parts.push('RWT ' + Calc.fmt(v.rwt, 2) + ' · ' +
          (v.rwt > 0.42 ? '升高：向心性肥厚' : '正常或偏低：离心性重构'));
      }
      // 左室充盈压（原独立条目已并入本组）
      const f = Calc.lvFilling({
        e: v.dge === undefined ? null : v.dge,
        a: v.dga === undefined ? null : v.dga,
        es: v.dges === undefined ? null : v.dges,
        el: v.dgel === undefined ? null : v.dgel,
        lavi: v.dglavi === undefined ? null : v.dglavi,
        trv: v.dgtrv === undefined ? null : v.dgtrv,
      });
      if (f.ea !== undefined) parts.push('E/A ' + Calc.fmt(f.ea));
      if (f.avgEe !== undefined) parts.push('平均 E/e′ ' + Calc.fmt(f.avgEe));
      if (f.count > 0) parts.push('充盈压升高指标 ' + f.count + ' 项（' + f.crit.join('、') + '）');
      else if (v.dglavi !== undefined || v.dgtrv !== undefined) {
        parts.push('充盈压升高指标 0 项');
      }
      if (f.text) parts.push('→ ' + f.text);
      put('lv', partsOf(parts));
    }

    // 右心：RAP + PASP（含分级）+ PVR + PADP + PH 概率 + 右室功能
    {
      const parts = [];
      let rap = null;
      if (v.ivc !== undefined) {
        rap = Calc.rapFromIvc(v.ivc, calcCollapse);
        parts.push('RAP 估计 ' + rap + ' mmHg');
      }
      if (v.tr !== undefined && rap !== null) {
        parts.push('PASP ≈ ' + Calc.fmt(Calc.pasp(v.tr, rap), 1) + ' mmHg · ' +
          (v.tr <= 2.8 ? '无肺高压' : v.tr < 3.4 ? '轻度升高' : '中重度升高'));
      }
      if (has('tr', 'rvti2')) parts.push('PVR ≈ ' + Calc.fmt(Calc.pvrEstimate(v.tr, v.rvti2)) + ' WU');
      if (has('prend') && rap !== null) parts.push('PADP ≈ ' + Calc.fmt(Calc.padp(v.prend, rap), 1) + ' mmHg');
      if (v.tr !== undefined) {
        const signs = calcSigns === '' ? null : calcSigns === 'yes';
        parts.push('PH 超声概率：' + Calc.phProbability(v.tr, signs));
      }
      if (has('eda', 'esa')) {
        parts.push(v.esa > v.eda ? 'RV EDA/ESA 不匹配（ESA 不可大于 EDA）'
          : 'FAC ' + Calc.fmt(Calc.fac(v.eda, v.esa), 1) + '%（正常 >35%）');
      }
      if (has('rvs')) parts.push('RV S′ ' + Calc.fmt(v.rvs, 1) + ' cm/s（正常 >9.5）');
      put('rv', partsOf(parts));
    }

    // 右室-肺动脉耦联 TAPSE/PASP
    if (has('tapse', 'paspv')) {
      const rc = Calc.tapsePasp(v.tapse, v.paspv);
      put('rcoupling', 'TAPSE/PASP = ' + Calc.fmt(rc.ratio, 2) + ' mm/mmHg · ' + rc.text);
    } else put('rcoupling');

    // 主动脉瓣狭窄 LF-LG 判读
    {
      const r = Calc.asLflg({
        lvef: v.lflgef, svi: v.lflgsvi, mpg: v.lflgmpg, ava: v.lflgava,
        dsvi: v.lflgdsvi, dava: v.lflgdava,
      });
      const parts = [];
      if (r.text) parts.push(r.text);
      if (r.flowReserve !== undefined) {
        parts.push('SV 增幅 ' + Calc.fmt((r.flowReserve - 1) * 100, 1) + '%（' +
          (r.hasReserve ? '有收缩储备' : '无收缩储备') + '）');
      }
      if (r.dse) parts.push(r.dse);
      put('lf-lg', partsOf(parts));
    }

    // 右室功能分级（ASE 六指标积分）+ 右室应变
    {
      const r = Calc.rvFuncScore({
        rvbase: v.rvfbase, fac: v.rvffac, tapse: v.rvftapse,
        rvs: v.rvfs, rvef: v.rvfe,
      });
      const parts = [];
      if (r.n) {
        const bad = r.items.filter(function (i) { return i.bad; })
          .map(function (i) { return i.name; });
        parts.push(r.score + '/' + r.n + ' 项异常 → ' + r.text);
        if (bad.length) parts.push('异常项：' + bad.join('、'));
      }
      if (v.rvfws !== undefined) {
        parts.push('RVFWS ' + Calc.fmt(v.rvfws, 1) + '% · ' +
          (v.rvfws <= -20 ? '正常' : v.rvfws <= -15 ? '轻度减低' : '明显减低（预后不良）'));
      }
      put('rvfail', partsOf(parts));
    }

    // 缩窄性心包炎 vs 限制型心肌病：呼吸变异量化
    {
      const r = Calc.cpRm({
        mvex: v.cpmex, mvinsp: v.cpmix, tvex: v.cptex, tvinsp: v.cptix,
        medee: v.cpmee,
      });
      const parts = [];
      if (r.mvVar !== undefined) parts.push('二尖瓣 E 变异 ' + Calc.fmt(Math.abs(r.mvVar), 1) + '%');
      if (r.tvVar !== undefined) parts.push('三尖瓣 E 变异 ' + Calc.fmt(Math.abs(r.tvVar), 1) + '%');
      if (r.feats.length) parts.push(r.feats.join('、'));
      if (r.text) parts.push('→ ' + r.text);
      put('cp-rm', partsOf(parts));
    }

    // 左房应变与 HFA-PEFF 三大类计分
    {
      const r = Calc.hfaPeff({
        lavi: v.hplavi, lvmi: v.hplvmi, female: state.sex === 'female', rwt: v.hprwt,
        ntp: v.hpntp, ee: v.hpee, trv: v.hptrv, lasr: v.hplasr, gls: v.hpgls,
      });
      const parts = [];
      if (r.n) {
        parts.push('形态学 ' + r.morph + ' 分' + (r.morphName ? '（' + r.morphName + '）' : ''));
        parts.push('标志物 ' + r.bio + ' 分' + (r.bioName ? '（' + r.bioName + '）' : ''));
        parts.push('功能 ' + r.func + ' 分' + (r.funcName ? '（' + r.funcName + '）' : ''));
        parts.push('合计 ' + r.total + '/6 → ' + r.text);
      }
      put('la-strain', partsOf(parts));
    }

    // Duke 评分 + 收缩储备
    {
      const parts = [];
      const dk = Calc.dukeScore({ time: v.dktime, stDev: v.dkst, angina: v.dkang });
      if (dk.score !== undefined) {
        parts.push('Duke ' + Calc.fmt(dk.score, 1) + ' 分 · ' + dk.text);
      }
      if (has('dkefr', 'dkefp')) {
        const d = v.dkefp - v.dkefr;
        parts.push('EF 变化 ' + (d >= 0 ? '+' : '') + Calc.fmt(d, 1) + '% · ' +
          (d >= 5 ? '收缩储备正常' : '收缩储备不足（提示多支病变 / 预后不良）'));
      }
      // 肺动脉收缩压运动反应
      if (has('dksp0', 'dksp1')) {
        const p = Calc.paspStress({ rest: v.dksp0, peak: v.dksp1 });
        if (p.text) {
          parts.push('PASP ' + Calc.fmt(v.dksp0, 0) + '→' + Calc.fmt(v.dksp1, 0) +
            ' mmHg（Δ' + Calc.fmt(p.delta, 0) + '）· ' + p.text);
        }
      }
      put('stress-echo', partsOf(parts));
    }

    // 右室应变与 RVFWS 细化
    {
      const r = Calc.rvStrain({
        base: v.rvsb, mid: v.rvsm, apex: v.rvsa, sep: v.rvssep, pasp: v.rvspasp,
      });
      const parts = [];
      if (r.avg !== undefined) {
        parts.push('RVFWS ' + Calc.fmt(r.avg, 1) + '% → ' + r.gradeText);
        parts.push(r.gradText);
      }
      if (r.rvgls !== undefined) {
        parts.push('RVGLS ' + Calc.fmt(r.rvgls, 1) + '%' +
          (r.sepLower ? '（室间隔受累更重，提示双室受累）' : ''));
      }
      if (r.ratio !== undefined) {
        parts.push('RVFWS/PASP ' + Calc.fmt(r.ratio, 2) + ' · ' + r.coupling);
      }
      // 右室收缩储备（低剂量多巴酚丁胺负荷）
      if (has('rvr0', 'rvr1')) {
        const rs = Calc.rvReserve({
          rest: v.rvr0, peak: v.rvr1,
          tapse0: v.rvt0, tapse1: v.rvt1,
          pasp0: v.rvspasp, pasp1: v.rvp1,
        });
        if (rs.text) {
          parts.push('收缩储备：RVFWS ' + Calc.fmt(rs.rest, 1) + '%→' + Calc.fmt(rs.peak, 1) +
            '%（Δ' + (rs.delta >= 0 ? '+' : '') + Calc.fmt(rs.delta, 1) + '）· ' + rs.text);
        }
        if (rs.tapseDelta !== undefined) {
          parts.push('TAPSE ' + (rs.tapseDelta >= 0 ? '+' : '') + Calc.fmt(rs.tapseDelta, 1) + ' mm（' +
            (rs.tapseChange >= 0 ? '+' : '') + Calc.fmt(rs.tapseChange, 0) + '%）' +
            (rs.tapseOk ? ' · 支持储备保留' : ' · 未见明显增加'));
        }
        if (rs.couplingDelta !== undefined) {
          parts.push('负荷后耦联 ' + Calc.fmt(rs.ratio0, 2) + '→' + Calc.fmt(rs.ratio1, 2) +
            (rs.couplingDelta > 0 ? '（改善）' : rs.couplingDelta < 0 ? '（恶化）' : '（不变）'));
        }
        if (rs.afterloadOnly) {
          parts.push('注意：PASP 升 ' + Calc.fmt(rs.dpasp, 0) + ' mmHg 而 RVFWS 未涨，更像后负荷效应而非储备耗竭');
        }
      }
      put('rv-strain', partsOf(parts));
    }

    // 限制型心肌病 vs 淀粉样变：心尖保留比值
    {
      const r = Calc.rcmStrain({
        base: v.rcmb, mid: v.rcmm, apex: v.rcma,
        endo: v.rcmendo, epi: v.rcmepi,
      });
      const parts = [];
      if (r.rar !== undefined) {
        parts.push('RAR ' + Calc.fmt(r.rar, 2) + '（GLS ' + Calc.fmt(-r.gls, 1) + '%）→ ' + r.text);
      }
      if (r.transGrad !== undefined) {
        parts.push('心内膜/心外膜 ' + Calc.fmt(r.transGrad, 2) +
          (r.gradLost ? ' · 梯度消失（支持浸润性病变）' : ' · 梯度保留'));
      }
      put('rcm-strain', partsOf(parts));
    }

    // 先心病分流：Qp/Qs 分级
    {
      const r = (has('shqp', 'shqs') ? Calc.shuntGrade(v.shqp, v.shqs) : {});
      put('shd', r.text ? 'Qp/Qs = ' + Calc.fmt(r.ratio) + ' · ' + r.text : '');
    }

    // 分流性肺高压的可手术性
    {
      const parts = [];
      if (has('pvrv')) {
        const pvr = v.pvrv;
        if (v.pvrqp !== undefined && v.pvrqp < 1.0) {
          parts.push('Qp/Qs ' + Calc.fmt(v.pvrqp) + '：净右向左分流，倾向禁忌关闭');
        }
        if (pvr > 8) parts.push('PVR ' + Calc.fmt(pvr) + ' WU：多属不可逆，禁忌关闭');
        else if (pvr >= 5) parts.push('PVR ' + Calc.fmt(pvr) + ' WU：灰区，需急性血管反应试验或靶向治疗后复评');
        else parts.push('PVR ' + Calc.fmt(pvr) + ' WU：阻力尚可，可考虑关闭');
      }
      if (has('pvrvi')) {
        parts.push('PVRI ' + Calc.fmt(v.pvrvi) + ' WU·m² · ' +
          (v.pvrvi > 8 ? '显著升高' : v.pvrvi >= 6 ? '灰区' : '可接受'));
      }
      put('pht-rev', partsOf(parts));
    }

    // 法洛四联症术后 PR：严重度 + PVR 指征
    {
      const r = Calc.tofPr({
        pridx: v.pridx, prw: v.prw,
        rvedvi: v.rvedvi, rvesvi: v.rvesvi, rvef: v.rvef, rvotpg: v.rvotpg,
      });
      const parts = [];
      if (r.severityText) {
        parts.push(r.severityText + (r.discordant ? '（PR 指数与宽度比不一致，取较重档）' : ''));
      }
      if (r.pvrIndication) {
        parts.push('已达 PVR 评估指征');
      } else if (r.rvesvi !== undefined || r.rvedvi !== undefined || r.rvef !== undefined) {
        parts.push('尚未达 PVR 容量阈值');
      }
      if (r.notes && r.notes.length) parts.push(r.notes.join('；'));
      put('tof-pr', partsOf(parts));
    }

    // Ebstein：三尖瓣隔瓣下移指数
    {
      const r = Calc.ebsteinIndex(v.ebdisp, v.ebbsa);
      put('ebstein', r.text
        ? '下移指数 ' + Calc.fmt(r.index, 1) + ' mm/m²（' + Calc.fmt(r.disp, 1) + ' mm ÷ ' +
          Calc.fmt(r.bsa, 2) + ' m²）· ' + r.text
        : '');
    }

    // Mustard / Senning：两套挡板压差
    {
      const baffle = function (x) {
        if (x > 8) return '狭窄明显，建议干预评估';
        if (x > 4) return '有血流动力学意义的狭窄';
        return '可接受';
      };
      const parts = [];
      if (has('mvsvc')) parts.push('体静脉挡板 ' + Calc.fmt(v.mvsvc, 1) + ' mmHg · ' + baffle(v.mvsvc));
      if (has('mvpv')) parts.push('肺静脉挡板 ' + Calc.fmt(v.mvpv, 1) + ' mmHg · ' + baffle(v.mvpv));
      put('mustard', partsOf(parts));
    }

    // Fontan：管道压差 + 开窗宽度
    {
      const parts = [];
      if (has('fnpg')) {
        const g = v.fnpg;
        parts.push('管道压差 ' + Calc.fmt(g, 1) + ' mmHg · ' +
          (g > 4 ? '明显梗阻，需进一步评估' : g > 2 ? '轻度升高，密切随访' : '通畅'));
      }
      if (has('fnfen')) {
        const w = v.fnfen;
        parts.push('开窗 ' + Calc.fmt(w, 1) + ' mm' +
          (w < 3 ? '（偏小，注意是否已闭合）'
            : w > 6 ? '（偏大，注意右向左分流量）' : '（常规范围 3–6 mm）'));
      }
      put('fontan', partsOf(parts));
    }

    // LVAD 超声要点
    {
      const r = Calc.lvadEcho({
        d: v.lvadd, vti: v.lvadvti, hr: v.lvadhr,
        lvedd: v.lvadlv, avOpen: v.lvadav, tapse: v.lvadtp,
      });
      const parts = [];
      if (r.sv !== undefined) {
        parts.push('出血道 SV ' + Calc.fmt(r.sv, 1) + ' mL');
        if (r.co !== undefined) parts.push('CO ' + Calc.fmt(r.co) + ' L/min');
      }
      if (r.notes && r.notes.length) parts.push(r.notes.join('；'));
      put('lvad', partsOf(parts));
    }

    // 三尖瓣反流五级严重度
    {
      const g = Calc.trGrade(v.treroa, v.trrvol);
      const parts = [];
      if (g.text) {
        parts.push('TR ' + g.text);
        if (g.byEroa !== g.byRvol) parts.push('EROA 与 RVol 不一致，取较重档');
      }
      put('tr-interv', partsOf(parts));
    }

    // CTRCD 肿瘤治疗相关心功能不全
    {
      const r = Calc.ctrcd({ g0: v.g0, g1: v.g1, ef0: v.ef0, ef1: v.ef1 });
      const parts = [];
      if (r.relDrop !== undefined) parts.push('GLS 相对下降 ' + Calc.fmt(r.relDrop, 1) + '%');
      if (r.efDrop !== undefined && r.efDrop !== 0) {
        parts.push('EF 变化 ' + Calc.fmt(-r.efDrop, 1) + ' 个百分点');
      }
      if (r.text) parts.push('→ ' + r.text);
      put('ctrcd', partsOf(parts));
    }

    // 心肌应变判读（R43 · ASE/EACVI 2025：正常 <−18%、灰区 −16~−18%、异常 >−16%）
    {
      const parts = [];
      if (v.gls !== undefined) {
        let t;
        if (v.gls > -16) t = '异常（R43：绝对值 <16）';
        else if (v.gls > -18) t = '灰区（−16 ~ −18%，需合并其他异常）';
        else t = '正常（R43：＜ −18%）';
        parts.push('GLS ' + Calc.fmt(v.gls, 1) + '% · ' + t);
      }
      if (v.rvstrain !== undefined) {
        parts.push('右室游离壁应变 ' + Calc.fmt(v.rvstrain, 1) + '% · ' +
          (v.rvstrain <= -20 ? '正常（男 ≤−20 / 女 ≤−21）' : '缩短减低'));
      }
      put('strain', partsOf(parts));
    }

    // 二尖瓣疾病评估页（v1.4.4：原「MS 狭窄定量」「MR 反流定量」两条并入本页）
    //   形态（Wilkins）→ 狭窄（MVA 三法 + 压差 + PASP）→ 反流（PISA / VC / dP/dt / RF）
    //   → PMBV 适合度。只填关心的段也能出结论。
    {
      const parts = [];
      let wkTotal = null;
      if (has('wk1') || has('wk2') || has('wk3') || has('wk4')) {
        const w = Calc.wilkinsScore(v.wk1, v.wk2, v.wk3, v.wk4);
        if (w.error) parts.push(w.error);
        else {
          wkTotal = w.total;
          const detail = w.items.map(function (it) {
            return it.n.replace('瓣叶', '') + ' ' + it.score;
          }).join(' · ');
          parts.push('形态 Wilkins ' + w.total + '/16（' + detail + '）· ' + w.text + '；' + w.worstText);
        }
      }

      // 狭窄：mit_ 前缀还原成引擎认的键名
      const msv = {};
      Object.keys(v).forEach(function (k) {
        if (k.indexOf('mit_') === 0) msv[k.slice(4)] = v[k];
      });
      const msr = ValveCalc ? ValveCalc.valveCalc('ms', msv, bsa) : { rows: [] };
      if (msr.rows && msr.rows.length) {
        parts.push('狭窄 ' + rowsText(msr.rows) + ' → ' + msr.summary);
      }

      // 反流：mr_ 前缀；LVOT 直径与 VTI 与狭窄段共用（同一次测量算了 SV 与 RF）
      const mrv = {};
      Object.keys(v).forEach(function (k) {
        if (k.indexOf('mr_') === 0) mrv[k.slice(3)] = v[k];
      });
      if (mrv.lvotD === undefined && v.mit_lvotD !== undefined) mrv.lvotD = v.mit_lvotD;
      if (mrv.lvotVti === undefined && v.mit_lvotVti !== undefined) mrv.lvotVti = v.mit_lvotVti;
      const mrr = ValveCalc ? ValveCalc.valveCalc('mr', mrv, bsa) : { rows: [] };
      if (mrr.rows && mrr.rows.length) {
        parts.push('反流 ' + rowsText(mrr.rows) + ' → ' + mrr.summary);
      }

      // PMBV 适合度：面积优先取描记，其次连续方程，最后 PHT
      let mvaUsed = null;
      let mvaHow = '';
      if (has('mit_mvaPlani') && v.mit_mvaPlani > 0) {
        mvaUsed = v.mit_mvaPlani;
        mvaHow = '直接描记';
      } else if (has('mit_lvotD', 'mit_lvotVti', 'mit_mvVti') && v.mit_mvVti > 0) {
        mvaUsed = (Math.PI * v.mit_lvotD * v.mit_lvotD / 4 * v.mit_lvotVti) / v.mit_mvVti;
        mvaHow = '连续方程';
      } else if (has('mit_pht') && v.mit_pht > 0) {
        mvaUsed = 220 / v.mit_pht;
        mvaHow = 'PHT 法';
      }
      if (mvaUsed !== null || wkTotal !== null || has('mit_pasp')) {
        const s = Calc.pmbvSuit({
          mva: mvaUsed,
          mvaHow: mvaHow,
          gra: has('mit_mgrad') ? v.mit_mgrad : null,
          pasp: has('mit_pasp') ? v.mit_pasp : null,
          wilkins: wkTotal,
        });
        // 已单独成段展示过的不重复（MVA 三法在「狭窄」段、Wilkins 在「形态」段）
        const ps = s.parts.filter(function (p) {
          if (p.indexOf('① 严重度：MVA') === 0 && mvaUsed !== null) return false;
          if (p.indexOf('③ 形态：Wilkins') === 0 && wkTotal !== null) return false;
          return true;
        });
        const flow = ps.join('；');
        if (flow) parts.push('PMBV 适合度 ' + flow);
        // verdict 自带「PMBV 适合度：」前缀，单独一段，避免与前缀重复
        if (s.verdict) parts.push(s.verdict);
      }
      put('mitral', parts.join('\n'));
    }

    // 主动脉瓣疾病评估页（v1.4.4：原「AS 狭窄定量」「AR 反流定量」两条并入本页）
    //   狭窄（AVA / DVI / 峰速法 + 压差）→ 反流（PISA / VC / PHT / RF）
    {
      const parts = [];
      const asv = {};
      const arv = {};
      Object.keys(v).forEach(function (k) {
        if (k.indexOf('as_') === 0) asv[k.slice(3)] = v[k];
        else if (k.indexOf('ar_') === 0) arv[k.slice(3)] = v[k];
      });
      const asr = ValveCalc ? ValveCalc.valveCalc('as', asv, bsa) : { rows: [] };
      if (asr.rows && asr.rows.length) {
        parts.push('狭窄 ' + rowsText(asr.rows) + ' → ' + asr.summary);
      }
      const arr = ValveCalc ? ValveCalc.valveCalc('ar', arv, bsa) : { rows: [] };
      if (arr.rows && arr.rows.length) {
        parts.push('反流 ' + rowsText(arr.rows) + ' → ' + arr.summary);
      }
      // 三联不一致时补一句低流量低压差的提示（引擎只给分级，不给这条判读路径）
      if (has('as_mg', 'as_avVti', 'as_lvotD', 'as_lvotVti')) {
        const ava = Math.PI * v.as_lvotD * v.as_lvotD / 4 * v.as_lvotVti / v.as_avVti;
        if (ava <= 1.0 && v.as_mg < 40) {
          parts.push('⚠ AVA ≤1.0 而平均压差 <40 mmHg：属低流量低压差档，先查 SVi 是否 ≤35 mL/m²，' +
            '再决定低剂量多巴酚丁胺或 CT 钙化评分');
        }
      }
      if (has('as_avVmax') && v.as_avVmax >= 5) {
        parts.push('⚠ Vmax ≥5 m/s，属极重度线索');
      }
      put('aortic', parts.join('\n'));
    }
  }

  if ($('calcClear')) $('calcClear').addEventListener('click', function () {
    const g = calcGroupOf(curCalcGroup);
    const b = briefOf(curCalcGroup);
    const fields = g
      ? g.fields.map(function (f) { return f[0]; })
      : (b && b.fields
        ? b.fields.filter(function (f) { return f.k; }).map(function (f) { return f.k; })
        : []);
    if (!fields.length) return;
    fields.forEach(function (k) {
      delete calcVal[k];
      document.querySelectorAll('#calcGroups input[data-ck="' + k + '"]')
        .forEach(function (o) { o.value = ''; });
    });
    if (curCalcGroup === 'rv') {
      calcCollapse = '';
      calcSigns = '';
      setSeg('calccollapse', '');
      setSeg('calcsigns', '');
    }
    renderCalc();
  });

/*<<<END-CUT:calc>>>*/
/*<<<PUBLIC-CUT:valve>>>*/
  /* ══════════════════════════════════════════════════════════
     五C、瓣膜评估（AS / AR / MS / MR / TR）
     ══════════════════════════════════════════════════════════ */

  const VALVE_IDS = ['as', 'ar', 'ms', 'mr', 'tr'];
  const valveVal = {};   // 'as:lvotD' → 输入字符串
  let curValve = 'as';
  let valveIvc = '';

  function switchValve(id) {
    if (VALVE_IDS.indexOf(id) === -1) return;
    curValve = id;
    document.querySelectorAll('.vchip').forEach(function (c) {
      c.classList.toggle('vchip--on', c.dataset.valve === id);
    });
    document.querySelectorAll('.valve-sec').forEach(function (s) {
      s.hidden = s.dataset.sec !== id;
    });
    renderValves();
    window.scrollTo(0, 0);
  }

  /** 当前瓣膜：算结果 + 逐项分级 + 备注 */
  function renderValves() {
    if (!ValveCalc || !$('page-valves')) return;
    const v = {};
    Object.keys(valveVal).forEach(function (k) {
      const i = k.indexOf(':');
      if (k.slice(0, i) !== curValve) return;
      const n = parseFloat(valveVal[k]);
      if (valveVal[k] !== '' && !isNaN(n)) v[k.slice(i + 1)] = n;
    });
    if (curValve === 'tr') v.ivcCollapse = valveIvc;

    const r = ValveCalc.valveCalc(curValve, v, state.bsa);

    const sum = $('vsum-' + curValve);
    if (sum) {
      sum.textContent = '结果 · ' + r.summary;
      sum.className = 'vsum' + (r.level && r.level !== 'none' ? ' vsum--' + r.level : '');
    }

    let html = '';
    r.rows.forEach(function (row) {
      html += '<div class="vres__r"><span class="vres__k">' + esc(row.k) + '</span>' +
        '<span class="vres__v">' + esc(row.v) +
        (row.tag ? '<span class="lvl lvl--' + row.level + '">' + esc(row.tag) + '</span>' : '') +
        '</span></div>';
    });
    if (!r.rows.length) html = '<div class="vres__idle">填入任一指标即可看到结果与分级</div>';
    const box = $('vres-' + curValve);
    if (box) box.innerHTML = html;

    const nb = $('vnotes-' + curValve);
    if (nb) {
      nb.innerHTML = r.notes.map(function (t) { return '<div class="note">· ' + esc(t) + '</div>'; }).join('');
    }
  }

  /** 清空瓣膜页全部输入 */
  function clearValves() {
    Object.keys(valveVal).forEach(function (k) { delete valveVal[k]; });
    valveIvc = '';
    setSeg('valveivc', '');
    document.querySelectorAll('#page-valves input[data-vk]').forEach(function (i) { i.value = ''; });
    renderValves();
  }

  if ($('page-valves')) {
    $('page-valves').addEventListener('input', function (e) {
      const inp = e.target.closest('input[data-vk]');
      if (!inp) return;
      if (inp.value === '') delete valveVal[inp.dataset.vk];
      else valveVal[inp.dataset.vk] = inp.value;
      renderValves();
    });
    $('valveSwitch').addEventListener('click', function (e) {
      const chip = e.target.closest('.vchip');
      if (chip) switchValve(chip.dataset.valve);
    });
    $('valveClear').addEventListener('click', clearValves);
  }

/*<<<END-CUT:valve>>>*/
  /* ══════════════════════════════════════════════════════════
     六、Tab4 儿童 Z 值
     ══════════════════════════════════════════════════════════ */

  const QUICK_KEYS = ['LVEDD', 'LVESD', 'LVST', 'LVPWT', 'LVEDV', 'LVESV', 'LVM', 'ROOT'];
  const MORE_KEYS = Peds.PEDS_FIELDS.filter(function (k) {
    return QUICK_KEYS.indexOf(k) === -1;
  });

  const pdVal = {};     // 儿童页测量值（界面单位）
  let pdMoreOpen = false;

  /** 参数在界面上的显示单位 */
  function uiUnit(key) {
    return Peds.PEDS_Z[key].unit === 'cm' ? 'mm' : Peds.PEDS_Z[key].unit;
  }

  function buildPedsInputs() {
    const keys = pdMoreOpen ? QUICK_KEYS.concat(MORE_KEYS) : QUICK_KEYS;
    let html = '';
    for (let i = 0; i < keys.length; i += 2) {
      html += '<div class="row">';
      for (let j = i; j < i + 2 && j < keys.length; j++) {
        const k = keys[j];
        const def = Peds.PEDS_Z[k];
        html += '<div class="field">' +
          '<label class="field__l">' + esc(def.name) + ' / ' + uiUnit(k) + '</label>' +
          '<input class="field__i" type="number" inputmode="decimal" step="0.1" ' +
          'data-pk="' + k + '" placeholder="留空跳过" ' +
          'value="' + (pdVal[k] !== undefined ? pdVal[k] : '') + '">' +
          '</div>';
      }
      html += '</div>';
    }
    $('pdInputs').innerHTML = html;

    $('pdInputs').querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        const k = inp.dataset.pk;
        if (inp.value === '') delete pdVal[k];
        else pdVal[k] = inp.value;
        renderPeds();
      });
    });

    $('pdMore').textContent = pdMoreOpen ? '收起其他参数' : '展开其他参数（共 33 项）';
  }

  function renderPeds() {
    const h = parseFloat($('pdHeight').value);
    const w = parseFloat($('pdWeight').value);
    const age = parseFloat($('pdAge').value);
    const valid = h > 30 && h < 220 && w > 1 && w < 150;
    const bsa = valid ? Peds.bsaHaycock(h, w) : 0;

    $('pdBsa').textContent = valid ? bsa.toFixed(2) : '—';
    $('pdBmi').textContent = valid ? Core.bmi(h, w).toFixed(1) : '—';
    $('pdDesc').textContent = valid
      ? '体表面积 BSA = ' + bsa.toFixed(2) + ' m²　·　|Z| ≤ 2 视为正常'
      : '请先填写身高体重';

    // 警告
    const warns = [];
    if (!valid && $('pdHeight').value && $('pdWeight').value) {
      warns.push('身高体重超出常用范围（30–220 cm / 1–150 kg），请核对。');
    }
    if (!isNaN(age) && age > 18) {
      warns.push('本页适用于 0–18 岁儿童。成人请改用「参考值」页的中国成人或 ASE 标准。');
    }
    $('pdWarn').innerHTML = warns.map(function (t) { return '⚠ ' + esc(t); }).join('<br>');

    if (!valid) {
      $('pdList').innerHTML = '<div class="note">请先填写有效的身高体重（30–220 cm / 1–150 kg）。</div>';
      $('pdRanges').innerHTML = '';
      $('pdFuncCard').hidden = true;
      $('pdSumCard').hidden = true;
      state.peds = null;
      return;
    }

    // 组装实测值（引擎内部处理单位换算）
    const measured = {};
    Object.keys(pdVal).forEach(function (k) {
      const v = parseFloat(pdVal[k]);
      if (pdVal[k] !== '' && !isNaN(v)) measured[k] = v;
    });

    // ★ 收缩功能推算：输入了 LVEDD 与 LVESD 即计算 EF/FS/SV（Teichholz），
    //   推算出的 EDV/ESV 在未手动填容积时代入 Z 值对照
    let func = null;
    let zMeasured = measured;
    if (measured.LVEDD > 0 && measured.LVESD > 0 && measured.LVEDD > measured.LVESD) {
      func = Core.computeLVFunction(measured.LVEDD, measured.LVESD);
      zMeasured = Object.assign({}, measured);
      if (zMeasured.LVEDV === undefined) zMeasured.LVEDV = func.EDV;
      if (zMeasured.LVESV === undefined) zMeasured.LVESV = func.ESV;
    }

    const grouped = Peds.buildPedsGrouped(bsa, zMeasured);

    // ── 收缩功能卡 ──
    if (func) {
      const grade = Core.gradeEF(func.EF);
      const fsKey = func.FS < 28 ? 'low' : (func.FS > 44 ? 'high' : 'normal');
      const fsTxt = { normal: '正常', low: '↓ 偏低', high: '↑ 偏高' }[fsKey];
      const fsCls = { normal: 'tag--normal', low: 'tag--low', high: 'tag--high' }[fsKey];

      $('pdFuncCard').hidden = false;
      $('pdFuncDesc').textContent =
        '由左室舒张末期内径 ' + measured.LVEDD + ' 与收缩末期内径 ' + measured.LVESD +
        ' mm 经 Teichholz 公式推算。';
      $('pdFuncEf').textContent = func.EF + '%';
      $('pdFuncEfTag').textContent = grade.text;
      $('pdFuncEfTag').className = 'tag ' + gradeCls(grade.level);
      $('pdFuncKv').innerHTML =
        '<div class="kv__i"><div class="kv__k">缩短分数 FS（参考 28–44%）</div>' +
        '<div class="kv__v">' + func.FS + '% <span class="tag ' + fsCls + '">' + fsTxt + '</span></div></div>' +
        '<div class="kv__i"><div class="kv__k">每搏输出量 SV</div>' +
        '<div class="kv__v">' + func.SV + '<span class="kv__u">mL</span></div></div>';
      $('pdFuncNote').textContent =
        '推算的 EDV ' + func.EDV + ' mL / ESV ' + func.ESV +
        ' mL 已代入下方「左心室容积与质量」组的 Z 值对照（未手动填容积时）。';
    } else {
      $('pdFuncCard').hidden = true;
    }

    // ── 摘要 ──
    let normal = 0, mild = 0, severe = 0, cnt = 0, worst = null;
    grouped.forEach(function (g) {
      g.rows.forEach(function (r) {
        if (!r.hasValue) return;
        cnt++;
        if (r.status === 'normal') normal++;
        else if (r.status === 'mild') mild++;
        else if (r.status === 'severe') severe++;
        if (worst === null || Math.abs(r.z) > Math.abs(worst.z)) worst = r;
      });
    });

    if (cnt > 0) {
      $('pdSumCard').hidden = false;
      const lvl = severe > 0 ? 'severe' : (mild > 0 ? 'mild' : 'normal');
      $('pdSumBig').className = 'zbig zbig--' + lvl;
      $('pdSumV').textContent = cnt;
      $('pdSumLbl').textContent = '项已测量 · 正常 ' + normal + ' · 轻度 ' + mild + ' · 显著 ' + severe;
      $('pdWorst').innerHTML = worst
        ? '偏离最大：<b>' + esc(worst.name) + '</b>，Z = <b>' + esc(worst.zText) +
          '</b>（' + esc(worst.statusText) + '）'
        : '';
    } else {
      $('pdSumCard').hidden = true;
    }

    // ── Z 值表 ──
    let html = '';
    grouped.forEach(function (g) {
      html += '<div class="pgroup">' + esc(g.title) + '</div>';
      g.rows.forEach(function (r) {
        html += '<div class="zrow' + (r.hasValue ? '' : ' zrow--none') + '">' +
          '<div class="zrow__n">' + esc(r.name) + '（' + esc(r.key) + '）' +
            '<span class="zrow__sub">均值 ' + esc(r.meanText) + '</span></div>' +
          '<div class="zrow__v">' + (r.hasValue ? esc(r.value) + esc(r.unit) : '—') + '</div>' +
          '<div class="zrow__r">' + esc(r.rangeText) + '</div>' +
          '<div class="zrow__g">' + (r.hasValue
            ? '<span class="tag ' + r.statusCls + '">' + esc(r.zText) + '</span>'
            : '<span class="tag tag--none">—</span>') +
          '</div></div>';
      });
    });
    $('pdList').innerHTML = html;

    // ── 区间表 ──
    let rhtml = '';
    grouped.forEach(function (g) {
      rhtml += '<div class="pgroup">' + esc(g.title) + '</div>';
      g.rows.forEach(function (r) {
        rhtml += '<div class="zrow">' +
          '<div class="zrow__n">' + esc(r.name) + '（' + esc(r.key) + '）' +
            '<span class="zrow__sub">' + esc(r.alphaText) + ' · 均值 ' + esc(r.meanText) + '</span></div>' +
          '<div style="flex:2;text-align:right;font-size:12px;color:var(--sub);line-height:1.6">' +
            '±2SD　' + esc(r.rangeText) + '<br>' +
            '±3SD　' + esc(r.range3Text) +
          '</div></div>';
      });
    });
    $('pdRanges').innerHTML = rhtml;

    state.peds = { bsa: Peds.round(bsa, 3), measured: measured, age: $('pdAge').value };
  }

  ['pdHeight', 'pdWeight', 'pdAge'].forEach(function (id) {
    $(id).addEventListener('input', renderPeds);
  });

  $('pdMore').addEventListener('click', function () {
    pdMoreOpen = !pdMoreOpen;
    buildPedsInputs();
  });

  $('pdClear').addEventListener('click', function () {
    Object.keys(pdVal).forEach(function (k) { delete pdVal[k]; });
    pdMoreOpen = false;
    buildPedsInputs();
    renderPeds();
  });

  /* ══════════════════════════════════════════════════════════
     七、重置
     ══════════════════════════════════════════════════════════ */

  $('resetBtn').addEventListener('click', function () {
    if (!confirm('确定要清空全部输入与结果吗？')) return;

    $('inHeight').value = 170;
    $('inWeight').value = 65;
    state.sex = 'male';
    state.formula = 'dubois';
    state.standard = 'CN';
    setSeg('sex', 'male');
    setSeg('formula', 'dubois');
    setSeg('standard', 'CN');

    EF_IDS.forEach(function (id) { $(id).value = ''; });
    state.measurements = null;

    ['pdHeight', 'pdWeight', 'pdAge'].forEach(function (id) { $(id).value = ''; });
    Object.keys(pdVal).forEach(function (k) { delete pdVal[k]; });
    pdMoreOpen = false;
    buildPedsInputs();

    Object.keys(calcVal).forEach(function (k) { delete calcVal[k]; });
    calcCollapse = '';
    calcSigns = '';
    buildCalcInputs();

    clearValves();

    renderIndex();
    renderEF();
    renderPeds();
    renderCalc();
    renderValves();
    if (currentTab !== 'index') switchTab(currentTab);
  });

  /* ══════════════════════════════════════════════════════════
     工具
     ══════════════════════════════════════════════════════════ */

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * 行内标记：**加粗** → <b>加粗</b>
   * 解析器 InlineMd 来自 miniprogram/utils/inline-md.js（构建时注入），
   * 与小程序端同一份实现，两端表现一致。
   */
  function mdInline(s) {
    if (s === null || s === undefined) return '';
    if (window.InlineMd && window.InlineMd.inlineHtml) {
      return window.InlineMd.inlineHtml(s, esc);
    }
    return esc(s);
  }

/*<<<PUBLIC-CUT:seg>>>*/
  /* ── 节段划分页：节段选中 ↔ 所有切面及牛眼图同步高亮 ── */

  const SEG_TERR = {
    LAD: 'LAD · 左前降支',
    RCA: 'RCA · 右冠状动脉',
    LCx: 'LCx · 左回旋支',
  };
  const SEG_WALL_IDS = ['PLAX', 'PSAX-B', 'PSAX-M', 'PSAX-A', 'A4C', 'A2C', 'A3C'];
  let segHi = '';   // 高亮的冠脉分区
  let selSeg = null; // 选中的节段（1–17）

  function renderSegAll() {
    if (!window.SegSvg || !$('bullseyeBox')) return;
    const bull = $('bullseyeBox');
    if (bull) bull.innerHTML = SegSvg.bullseyeSvg({ hi: segHi, sel: selSeg });

    SEG_WALL_IDS.forEach(function (id) {
      const el = $('wd-' + id);
      if (el) el.innerHTML = SegSvg.wallDiagramSvg(id, { sel: selSeg });
    });

    document.querySelectorAll('.terr-chip').forEach(function (c) {
      c.classList.toggle('terr-chip--on', c.dataset.terr === segHi);
    });
    document.querySelectorAll('[data-selseg]').forEach(function (c) {
      c.classList.toggle('segchip--on', Number(c.dataset.selseg) === selSeg);
    });

    const hiLine = $('segHiLine');
    if (hiLine) {
      hiLine.hidden = !segHi;
      hiLine.textContent = segHi ? '当前高亮：' + SEG_TERR[segHi] + '供血区' : '';
    }
    const info = $('segSelInfo');
    if (info) {
      info.hidden = selSeg == null;
      info.textContent = selSeg ? SegSvg.segInfoText(selSeg) : '';
    }
  }

/*<<<END-CUT:seg>>>*/

  /* ══════════════════════════════════════════════════════════
     瓣膜解剖页：解剖分区选中 ↔ 所有示意图同步高亮
     ══════════════════════════════════════════════════════════ */

  let selValvePart = null;   // 选中的解剖分区（如 lcc / a2 / sep）

  function renderValveAna() {
    if (!window.ValveSvg) return;
    window.ValveSvg.VALVE_VIEWS.forEach(function (v) {
      const el = $('va-' + v.id);
      if (el) el.innerHTML = v.fn({ sel: selValvePart });
    });

    document.querySelectorAll('#page-valveana [data-vap]').forEach(function (c) {
      c.classList.toggle('segchip--on', c.dataset.vap === selValvePart);
    });

    const info = $('vaSelInfo');
    if (info) {
      info.hidden = !selValvePart;
      info.textContent = selValvePart ? ValveSvg.partInfoText(selValvePart) : '';
    }
  }

  /* ══════════════════════════════════════════════════════════
     启动
     ══════════════════════════════════════════════════════════ */

  function boot() {
    // 基本参数默认值
    $('inHeight').value = state.height;
    $('inWeight').value = state.weight;
    $('appbarTitle').textContent = TAB_TITLE[currentTab];

    buildCalcInputs();
    renderIndex();
    renderEF();
    buildPedsInputs();
    renderPeds();
    renderCalc();
    renderValves();

    // 带 hash 打开（如刷新页面 / 从分享链接进来）→ 恢复到对应视图
    const v0 = parseHash();
    if (v0 && v0.type !== 'calcIndex') {
      switchTab('calc');
      restoreView(v0);
      viewStack.push(v0);
    }

    // 节段划分页：渲染示意图 + 点击联动（事件委托，SVG 每次选中后整体重绘）
    /*<<<PUBLIC-CUT:segclick>>>*/
    renderSegAll();
    renderValveAna();
    document.addEventListener('click', function (e) {
      const segEl = e.target.closest('#page-segments g[data-seg]');
      if (segEl) {
        const i = Number(segEl.dataset.seg);
        if (i >= 1 && i <= 17) {
          selSeg = selSeg === i ? null : i;
          renderSegAll();
        }
        return;
      }
      const chip = e.target.closest('#page-segments [data-selseg]');
      if (chip) {
        const i = Number(chip.dataset.selseg);
        selSeg = selSeg === i ? null : i;
        renderSegAll();
        return;
      }
      const terr = e.target.closest('.terr-chip');
      if (terr) {
        segHi = segHi === terr.dataset.terr ? '' : terr.dataset.terr;
        renderSegAll();
      }
    });

    // 瓣膜解剖页：点击分区色块 / 按钮 → 所有示意图同步高亮
    document.addEventListener('click', function (e) {
      const partEl = e.target.closest('#page-valveana g[data-part]');
      if (partEl) {
        const id = partEl.dataset.part;
        selValvePart = selValvePart === id ? null : id;
        renderValveAna();
        return;
      }
      const chip = e.target.closest('#page-valveana [data-vap]');
      if (chip) {
        const id = chip.dataset.vap;
        selValvePart = selValvePart === id ? null : id;
        renderValveAna();
      }
    });
    /*<<<END-CUT:segclick>>>*/

    // 页面可见性变化时重绘（WebView 恢复前台）
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        if (currentTab === 'peds') renderPeds();
        /*<<<PUBLIC-CUT:visimport>>>*/
        if (currentTab === 'calc') renderCalc();
        /*<<<END-CUT:visimport>>>*/
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // 暴露给自检脚本
  window.__app = { state: state, switchTab: switchTab, renderIndex: renderIndex };
})();
