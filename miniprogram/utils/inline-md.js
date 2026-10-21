/**
 * 行内标记解析（**加粗**）—— 小程序与网页/APK 共用
 *
 * 背景：正文数据（extra-data.js / calc-groups.js）里大量使用 Markdown 风格的
 * `**加粗**` 来强调关键结论。以前两端都直接原样输出，于是屏幕上出现
 * 字面量 `**`，非常刺眼（用户 2026-10-21 反馈）。
 *
 * 做法：把一段文本切成若干片段，每段带一个 b 标记（是否加粗）。
 *   - 小程序：<text class="fx-b">…</text>  逐段渲染
 *   - 网页：  段落拼成 <b>…</b>
 *
 * 只处理 `**成对加粗**`，不处理 *斜体*（正文里 `*` 多是数学乘号或
 * 「☆」类符号，处理容易误伤）。
 *
 * 单个未闭合的 `**` 会被当作普通文字保留，不会吞掉后面的内容。
 */
function parseInline(text) {
  const s = (text === null || text === undefined) ? '' : String(text);
  if (s.indexOf('**') === -1) return [{ t: s, b: false }];

  const out = [];
  let rest = s;
  while (rest.length) {
    const i = rest.indexOf('**');
    if (i === -1) { out.push({ t: rest, b: false }); break; }
    if (i > 0) out.push({ t: rest.slice(0, i), b: false });
    const j = rest.indexOf('**', i + 2);
    if (j === -1) {
      // 落单的 ** 当普通文字
      out.push({ t: rest.slice(i), b: false });
      break;
    }
    out.push({ t: rest.slice(i + 2, j), b: true });
    rest = rest.slice(j + 2);
  }
  return out.length ? out : [{ t: '', b: false }];
}

/**
 * 网页端用：把文本转成 HTML（先转义，再把加粗段包成 <b>）
 * 依赖调用方提供的 esc，避免本文件重复实现转义规则
 */
function inlineHtml(text, esc) {
  return parseInline(text).map(function (seg) {
    const t = esc(seg.t);
    return seg.b ? '<b>' + t + '</b>' : t;
  }).join('');
}

module.exports = { parseInline: parseInline, inlineHtml: inlineHtml };
