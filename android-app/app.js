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
    if (name === 'calc') { closeCalcGroup(); renderCalc(); }
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
    { id: 'dvi', title: '无量纲指数 DVI',
      fields: [['dlvti', 'LVOT VTI', 'cm'], ['davti', '主动脉瓣 VTI', 'cm']],
      note: 'DVI ≤0.25 支持重度 AS；不受体表面积与流量影响，低流量状态下比 AVA 更稳' },
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
    { id: 'dias', title: '舒张功能基础比值',
      fields: [['e', 'E 峰', 'cm/s'], ['a', 'A 峰', 'cm/s'], ['es', '间隔 e′', 'cm/s'], ['el', '侧壁 e′', 'cm/s']],
      note: 'E/e′ <8 左房压正常，>14 升高，8–14 为灰区；完整分级需结合 LAVI、肺静脉等' },
  ];

  const CALC_COLLAPSE = [['', 'IVC 塌陷未知'], ['yes', '吸气塌陷 >50%'], ['no', '吸气塌陷 ≤50%']];
  const CALC_SIGNS = [['', 'PH 征象未评估'], ['yes', '有（≥2 类）'], ['no', '无']];

  const calcVal = {};
  let calcCollapse = '';
  let calcSigns = '';

  /** 公式集目录里的瓣膜条目：点击跳到瓣膜页并预选该瓣膜（发布版无此页，故不渲染该组） */
  const VALVE_INDEX = [
    { id: 'as', title: 'AS 主动脉瓣狭窄', sub: 'AVA · 峰值流速 · 压差分级' },
    { id: 'ar', title: 'AR 主动脉瓣反流', sub: '反流束 · PHT · 压力减半时间' },
    { id: 'ms', title: 'MS 二尖瓣狭窄', sub: 'MVA · PHT · 平均压差' },
    { id: 'mr', title: 'MR 二尖瓣反流', sub: 'EROA · RVol · 反流分级' },
    { id: 'tr', title: 'TR 三尖瓣反流', sub: 'EROA · RVol · PASP' },
  ];

  /** 目录里每条公式的一句话说明 */
  const CALC_SUB = {
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
  };

  /** 评估类内容（器械支持 / 心腔与应变）与参考文献：来自 extra-data.js，与小程序同源 */
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

  /** 目录：分组标题 + 列表开标签 */
  function fxGroupHtml(title) {
    return '<div class="fx-group">' + esc(title) + '</div><div class="fx-list">';
  }

  /** 目录条目：kind = calc / brief / valve / link
   *  link 为纯外链条目：渲染成 <a target="_blank">，不加载任何图片或 iframe */
  function fxItemHtml(kind, id, title, sub, url) {
    const inner = '<span class="fx-item__main">' +
      '<span class="fx-item__n">' + esc(title) + '</span>' +
      '<span class="fx-item__d">' + esc(sub) + '</span>' +
      '</span><span class="fx-item__a">›</span>';
    if (kind === 'link') {
      return '<a class="fx-item" href="' + esc(url || '#') +
        '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
    }
    return '<button class="fx-item" data-kind="' + kind + '" data-id="' + id + '">' +
      inner + '</button>';
  }

  /** 评估类内容块 → HTML（与小程序 formula 页渲染一致） */
  function blocksHtml(blocks) {
    let h = '';
    (blocks || []).forEach(function (b) {
      if (b.kind === 'h') { h += '<div class="fx-h">' + esc(b.text) + '</div>'; return; }
      if (b.kind === 'note') { h += '<div class="fx-note">' + esc(b.text) + '</div>'; return; }
      if (b.kind === 'formula') { h += '<div class="fx-formula">' + esc(b.text) + '</div>'; return; }
      if (b.kind === 'table') {
        h += '<div class="fx-tbl fx-tbl--' + b.heads.length + '">';
        h += '<div class="fx-tbl__r fx-tbl__r--h">';
        b.heads.forEach(function (c) { h += '<span class="fx-tbl__c">' + esc(c) + '</span>'; });
        h += '</div>';
        (b.rows || []).forEach(function (r) {
          h += '<div class="fx-tbl__r">';
          r.forEach(function (c) { h += '<span class="fx-tbl__c">' + esc(c) + '</span>'; });
          h += '</div>';
        });
        h += '</div>';
        return;
      }
      h += '<div class="fx-text">' + esc(b.text) + '</div>';
    });
    return h;
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

  /** 目录底部的参考文献总表 */
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
        '</div></div>';
    });
    box.innerHTML = h;
  }

  /** 一组输入框（两两一行） */
  function fieldsHtml(fields) {
    let h = '';
    for (let i = 0; i < fields.length; i += 2) {
      h += '<div class="row">';
      for (let j = i; j < i + 2 && j < fields.length; j++) {
        const f = fields[j];
        h += '<div class="field"><label class="field__l">' + esc(f.n) +
          (f.u ? ' / ' + esc(f.u) : '') + '</label>' +
          '<input class="field__i" type="number" inputmode="decimal" step="any" ' +
          'data-ck="' + f.k + '" placeholder="未填写" value="' +
          (calcVal[f.k] !== undefined ? calcVal[f.k] : '') + '"></div>';
      }
      h += '</div>';
    }
    return h;
  }

  /**
   * 生成公式集目录 + 各条目的详情卡
   *
   * ★ 新增条目：在 CALC_GROUPS / VALVE_INDEX 加一条，或在
   *   miniprogram/utils/extra-data.js 的 BRIEF_SECTIONS 加一条即可，
   *   目录会自动出现，不必改别处。
   */
  function buildCalcInputs() {
    if (!$('calcList')) return;

    // ── 目录 ──
    const hasValvePage = !!$('page-valves');
    // mergeInto：并入同名组，避免「瓣膜评估」与「瓣膜疾病评估」两个相似组并存
    const MERGED = {};
    BRIEF.forEach(function (sec) {
      if (!sec.mergeInto) return;
      (MERGED[sec.mergeInto] = MERGED[sec.mergeInto] || []).push(sec);
    });
    let list = fxGroupHtml('血流动力学与心功能');
    CALC_GROUPS.forEach(function (g) {
      list += fxItemHtml('calc', g.id, g.title, CALC_SUB[g.id] || '');
    });
    list += '</div>';
    // 瓣膜评估组：完整版含 5 个瓣膜计算器，发布版只有判读条目；
    // 两种构建里组的位置一致（紧跟血流动力学），不再出现「瓣膜疾病评估」重复组
    list += fxGroupHtml('瓣膜评估');
    if (hasValvePage) {
      VALVE_INDEX.forEach(function (v) {
        list += fxItemHtml('valve', v.id, v.title, v.sub);
      });
    }
    (MERGED.valve || []).forEach(function (sec) {
      sec.items.forEach(function (it) {
        list += fxItemHtml('brief', it.id, it.title, it.sub || '');
      });
    });
    list += '</div>';
    BRIEF.forEach(function (sec) {
      if (sec.mergeInto) return;
      list += fxGroupHtml(sec.title);
      sec.items.forEach(function (it) {
        list += fxItemHtml('brief', it.id, it.title, it.sub || '');
      });
      list += '</div>';
    });
    LINKS.forEach(function (sec) {
      list += fxGroupHtml(sec.title);
      sec.items.forEach(function (it) {
        list += fxItemHtml('link', it.id, it.title, it.sub || '', it.url);
      });
      list += '</div>';
    });
    $('calcList').innerHTML = list;

    $('calcList').querySelectorAll('.fx-item').forEach(function (el) {
      el.addEventListener('click', function () {
        const kind = el.dataset.kind;
        if (kind === 'valve') {
          switchTab('valves');
          switchValve(el.dataset.id);
        } else {
          openCalcGroup(el.dataset.id);
        }
      });
    });

    renderRefs();

    // ── 详情：一次性渲染全部条目卡，按条目切换显示 ──
    let html = '';
    CALC_GROUPS.forEach(function (g) {
      html += '<div class="card" data-g="' + g.id + '" hidden>' +
        '<div class="card__t">' + esc(g.title) + '</div>' +
        fieldsHtml(g.fields.map(function (f) { return { k: f[0], n: f[1], u: f[2] }; }));
      html += '<div class="note">' + esc(g.note) + '</div>' +
        '<div class="calc-out" id="calcOut-' + g.id + '">' +
        '<span class="calc-out__lbl">结果</span><span class="calc-out__v">等待输入</span></div></div>';
    });

    BRIEF.forEach(function (sec) {
      sec.items.forEach(function (it) {
        html += '<div class="card" data-g="' + it.id + '" hidden>' +
          '<div class="card__t">' + esc(it.title) + '</div>' +
          blocksHtml(it.blocks);
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
        if (it.note) html += '<div class="note">' + esc(it.note) + '</div>';
        html += briefRefsHtml(it.source) + '</div>';
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

  /** 打开某条目（计算公式或评估内容） */
  function openCalcGroup(id) {
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
  }

  /** 回到公式集目录 */
  function closeCalcGroup() {
    if ($('calcIndex')) $('calcIndex').hidden = false;
    if ($('calcDetail')) $('calcDetail').hidden = true;
    $('appbarTitle').textContent = TAB_TITLE.calc;
    window.scrollTo(0, 0);
  }

  if ($('calcBack')) $('calcBack').addEventListener('click', closeCalcGroup);

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

    // ── 评估类条目（器械支持 / 心腔与应变）──

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

    // 心肌应变判读
    {
      const parts = [];
      if (v.gls !== undefined) {
        parts.push('GLS ' + Calc.fmt(v.gls, 1) + '% · ' +
          (v.gls <= -20 ? '正常' : v.gls < -18 ? '边缘（缩短减弱）' : '异常（缩短明显减低）'));
      }
      if (v.rvstrain !== undefined) {
        parts.push('右室游离壁应变 ' + Calc.fmt(v.rvstrain, 1) + '% · ' +
          (v.rvstrain <= -20 ? '正常' : '缩短减低'));
      }
      put('strain', partsOf(parts));
    }
  }

  if ($('calcClear')) $('calcClear').addEventListener('click', function () {
    const g = calcGroupOf(curCalcGroup);
    const b = briefOf(curCalcGroup);
    const fields = g
      ? g.fields.map(function (f) { return f[0]; })
      : (b && b.fields ? b.fields.map(function (f) { return f.k; }) : []);
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
