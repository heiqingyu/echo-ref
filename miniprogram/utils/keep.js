/**
 * 「记住输入」小工具（2026-11-06）
 *
 * 用户反馈：页面重新加载后输入框一律清空，希望手动点一下才保留。
 * 约定（三端同一套键名，网页端读 localStorage）：
 *   - `echoref:keep:<page>`  —— 开关，true 才写数据
 *   - `echoref:data:<page>`  —— 记住的那份输入
 *
 * 开关关着时一律不写、也不读，所以「重置」只要清掉这两个键就回到
 * 「默认清空」的行为，不会留下半份旧数据。
 */

function on(key) {
  try { return wx.getStorageSync(key) === true; } catch (e) { return false; }
}

function setOn(key, v) {
  try { wx.setStorageSync(key, !!v); } catch (e) { /* 存不下就算了 */ }
}

function read(key) {
  try {
    const s = wx.getStorageSync(key);
    return (s && typeof s === 'object') ? s : null;
  } catch (e) { return null; }
}

function write(key, obj) {
  try { wx.setStorageSync(key, obj); } catch (e) { /* 存不下就算了 */ }
}

function drop(key) {
  try { wx.removeStorageSync(key); } catch (e) { /* 没有就没有 */ }
}

module.exports = { on, setOn, read, write, drop };
