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
    index: '参数·参考值',
    ef: 'EF 计算',
    calc: '其他计算',
    valves: '瓣膜评估',
    segments: '节段划分',
    peds: '儿童 Z 值',
  };

  let currentTab = 'index';

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
    if (name === 'calc') renderCalc();
    if (name === 'valves') renderValves();
    if (name === 'index') renderIndex();

    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.tab').forEach(function (el) {
    el.addEventListener('click', function () { switchTab(el.dataset.tab); });
  });

  document.querySelectorAll('[data-go]').forEach(function (el) {
    el.addEventListener('click', function () { switchTab(el.dataset.go); });
  });

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
      setText('calcBsaNote', 'BSA —（请先在上方填写有效身高体重）');
      renderReference();
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
      'BSA ' + state.bsa.toFixed(2) + ' m²（来自本页上方）· 各组结果独立计算，留空跳过');

    // 参考值列表与计算页都依赖 BSA，一并刷新
    renderReference();
    renderValves();
  }

  ['inHeight', 'inWeight'].forEach(function (id) {
    $(id).addEventListener('input', renderIndex);
  });

  // 「查看下方参考值」平滑滚动
  if ($('jumpRef')) $('jumpRef').addEventListener('click', function () {
    $('refBlock').scrollIntoView({ behavior: 'smooth' });
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
      ? '已关联「EF 计算」页的测量值，下表显示实测值与参考范围的对照结果。'
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
      const nameCell = '<div class="list-row__n">' + esc(r.name) +
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
     五、Tab3 EF 计算
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
  }

  function gradeCls(level) {
    return { normal: 'tag--normal', mild: 'tag--mild', moderate: 'tag--moderate', severe: 'tag--severe' }[level] || 'tag--none';
  }

  EF_IDS.forEach(function (id) {
    $(id).addEventListener('input', renderEF);
  });

/*<<<PUBLIC-CUT:calc>>>*/
  /* ══════════════════════════════════════════════════════════
     五B、Tab3 其他计算（血流动力学与瓣膜）
     ══════════════════════════════════════════════════════════ */

  const CALC_GROUPS = [
    { id: 'flow', title: 'LVOT · 每搏量与心排量',
      fields: [['ld', 'LVOT 直径', 'cm'], ['lvti', 'LVOT VTI', 'cm'], ['hr', '心率', '次/min']],
      note: 'SV = πd²/4 × VTI；CO = SV × HR ÷ 1000' },
    { id: 'shunt', title: 'Qp/Qs 肺体循环血流比',
      fields: [['rd', 'RVOT 直径', 'cm'], ['rvti', 'RVOT VTI', 'cm']],
      note: '使用上方 LVOT 的 SV 作为体循环流量；反流、多处梗阻会影响结果' },
    { id: 'bernoulli', title: '简化伯努利压差',
      fields: [['v2', '远端峰速 V₂', 'm/s'], ['v1', '近端峰速 V₁（可选）', 'm/s']],
      note: 'ΔP = 4(V₂² − V₁²)；缺省 V₁ 按 0 处理。瓣膜狭窄 / 反流定量见「瓣膜评估」页' },
    { id: 'atrial', title: '心房容积指数',
      fields: [['lav', '左房容积', 'mL'], ['rav', '右房容积', 'mL']],
      note: '容积 ÷ BSA；LAVI 正常 ≤34 mL/m²；右房正常值需匹配测量方法' },
    { id: 'pressure', title: '右心压力与 PH 概率',
      fields: [['tr', 'TR 峰速', 'm/s'], ['ivc', 'IVC 内径', 'mm'], ['prend', 'PR 舒张末速度（可选）', 'm/s'], ['rvti2', 'RVOT VTI（PVR 用，可选）', 'cm']],
      note: 'RAP 估算仅适用自主呼吸；PASP 估算要求无 RVOT/肺动脉瓣梗阻' },
    { id: 'rvcalc', title: '右室功能',
      fields: [['eda', 'RV 舒张末面积', 'cm²'], ['esa', 'RV 收缩末面积', 'cm²'], ['rvs', '右室 S′（可选）', 'cm/s']],
      note: 'FAC 正常 >35%；右室 S′ 正常 >9.5 cm/s' },
    { id: 'dias', title: '舒张功能基础比值',
      fields: [['e', 'E 峰', 'cm/s'], ['a', 'A 峰', 'cm/s'], ['es', '间隔 e′', 'cm/s'], ['el', '侧壁 e′', 'cm/s']],
      note: 'E/e′ <8 左房压正常，>14 升高，8–14 为灰区；完整分级需结合 LAVI、肺静脉等' },
  ];

  const CALC_COLLAPSE = [['', 'IVC 塌陷未知'], ['yes', '吸气塌陷 >50%'], ['no', '吸气塌陷 ≤50%']];
  const CALC_SIGNS = [['', 'PH 征象未评估'], ['yes', '有（≥2 类）'], ['no', '无']];

  const calcVal = {};
  let calcCollapse = '';
  let calcSigns = '';

  /** 生成计算页的分组卡片与输入框（发布版无此页，直接跳过） */
  function buildCalcInputs() {
    if (!$('calcGroups')) return;
    let html = '';
    CALC_GROUPS.forEach(function (g) {
      html += '<div class="card"><div class="card__t">' + esc(g.title) + '</div>';
      for (let i = 0; i < g.fields.length; i += 2) {
        html += '<div class="row">';
        for (let j = i; j < i + 2 && j < g.fields.length; j++) {
          const f = g.fields[j];
          html += '<div class="field"><label class="field__l">' + esc(f[1]) + ' / ' + esc(f[2]) + '</label>' +
            '<input class="field__i" type="number" inputmode="decimal" step="any" ' +
            'data-ck="' + f[0] + '" placeholder="未填写" value="' + (calcVal[f[0]] !== undefined ? calcVal[f[0]] : '') + '"></div>';
        }
        html += '</div>';
      }
      if (g.id === 'pressure') {
        html += segHtml('calccollapse', CALC_COLLAPSE, calcCollapse) +
          segHtml('calcsigns', CALC_SIGNS, calcSigns);
      }
      html += '<div class="note">' + esc(g.note) + '</div>' +
        '<div class="calc-out" id="calcOut-' + g.id + '">' +
        '<span class="calc-out__lbl">结果</span><span class="calc-out__v">等待输入</span></div></div>';
    });
    $('calcGroups').innerHTML = html;

    // 绑定输入
    $('calcGroups').querySelectorAll('input[data-ck]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (inp.value === '') delete calcVal[inp.dataset.ck];
        else calcVal[inp.dataset.ck] = inp.value;
        renderCalc();
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
  }

  function segHtml(group, opts, cur) {
    let h = '<div class="field"><label class="field__l">' +
      (group === 'calccollapse' ? 'IVC 吸气塌陷' : 'PH 支持征象（≥2 类）') + '</label>' +
      '<div class="seg" data-seg="' + group + '">';
    opts.forEach(function (o) {
      h += '<div class="seg__i' + (o[0] === cur ? ' seg__i--on' : '') + '" data-v="' + o[0] + '">' + esc(o[1]) + '</div>';
    });
    return h + '</div></div>';
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
      if (qs > 0) put('shunt', 'Qp/Qs = ' + Calc.fmt(Calc.strokeVolume(v.rd, v.rvti) / qs));
      else put('shunt');
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

    // pressure
    {
      const parts = [];
      let rap = null;
      if (has('ivc')) {
        rap = Calc.rapFromIvc(v.ivc, calcCollapse);
        parts.push('RAP 估计 ' + rap + ' mmHg');
      }
      if (has('tr') && rap !== null) parts.push('PASP ≈ ' + Calc.fmt(Calc.pasp(v.tr, rap), 1) + ' mmHg');
      if (has('tr', 'rvti2')) parts.push('PVR ≈ ' + Calc.fmt(Calc.pvrEstimate(v.tr, v.rvti2)) + ' WU');
      if (has('prend') && rap !== null) parts.push('PADP ≈ ' + Calc.fmt(Calc.padp(v.prend, rap), 1) + ' mmHg');
      if (has('tr')) {
        const signs = calcSigns === '' ? null : calcSigns === 'yes';
        parts.push('PH 超声概率：' + Calc.phProbability(v.tr, signs));
      }
      put('pressure', partsOf(parts));
    }

    // rvcalc
    {
      let s = '';
      if (has('eda', 'esa')) {
        s = v.esa > v.eda ? 'ESA 不可大于 EDA'
          : 'FAC ' + Calc.fmt(Calc.fac(v.eda, v.esa), 1) + '%（正常 >35%）';
      }
      if (has('rvs')) s += (s ? '；' : '') + 'S′ ' + Calc.fmt(v.rvs, 1) + ' cm/s（正常 >9.5）';
      put('rvcalc', s);
    }

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
  }

  if ($('calcClear')) $('calcClear').addEventListener('click', function () {
    Object.keys(calcVal).forEach(function (k) { delete calcVal[k]; });
    calcCollapse = '';
    calcSigns = '';
    buildCalcInputs();
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
          '<div class="zrow__n">' + esc(r.name) +
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
          '<div class="zrow__n">' + esc(r.name) +
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

    // 节段划分页：渲染示意图 + 点击联动（事件委托，SVG 每次选中后整体重绘）
    /*<<<PUBLIC-CUT:segclick>>>*/
    renderSegAll();
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
