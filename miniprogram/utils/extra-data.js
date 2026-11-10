/**
 * 公式集 · 评估类内容数据（切面与图像 / 心腔应变与负荷 / 器械与介入 / …）
 *
 * 本文件是**纯数据**，被小程序与网页/APK 共用：
 *   - 小程序：pages/calculators（目录）、pages/formula（详情）
 *   - 网页/APK：build-www.js 通过 wrapEngine 抽取后挂到 window.ExtraData
 *
 * blocks 的 kind：
 *   h       小节标题
 *   table   表格（heads / rows，cols 取自 heads 长度）
 *   text    正文
 *   note    提示；warn: true 时渲染为醒目提示
 *   formula 公式行
 *
 * 每条内容的 source 指向 REFS 编号，展示在详情页底部，
 * 全部参考文献在公式集目录页底部统一列出。
 *
 * ★ 新增条目：往 BRIEF_SECTIONS 对应分组里加一条即可，
 *   目录会自动出现并可跳转；引用新文献往 REFS 加一条。
 */

/** 分组 → 条目（目录顺序即本文件顺序） */
/* 判读条目 5 组数据分 3 个文件存放（见 utils/brief-a/b/c.js）
 * 原因：单文件超过 500KB 时开发者工具跳过 ES6 转译与压缩，真机上会加载失败 */
const BRIEF_A = require('./brief-a.js').SECTIONS;
const BRIEF_B = require('./brief-b.js').SECTIONS;
const BRIEF_C = require('./brief-c.js').SECTIONS;
const BRIEF_SECTIONS = BRIEF_A.concat(BRIEF_B, BRIEF_C);

/**
 * 切面学习与在线演示：**纯链接条目**（kind: 'link'）
 *
 * 不嵌图片、不嵌 iframe，点击由系统浏览器打开原站（省内存、零流量开销）。
 * 主要来源：多伦多大学 PIE（Perioperative Interactive Education）TEE/TTE 教学站，
 * 其余为公开的 TEE 切面在线演示站点（外链，不嵌入本站页面）。
 *
 * ★ 2025-10 调整：原「切面指南」分组（4 份 ASE 官方 PDF）已并入「参考文献」
 *   —— R9（TTE 中/英文）、R10（TEE 2013）、R38（TEE 介入筛查）。
 *   PDF 直链统一挂在参考文献条目下，点一下即复制，不再单独占一个分组。
 */

/**
 * 《实用超声规范化检查与操作》第三章（心血管系统）配套动图的 mp4 直链前缀。
 * 全套资源同目录、仅文件名（书内编号）不同，故统一用前缀拼接。
 * 直链已验证可访问（AliyunOSS，HTTP 200），无需登录。
 */
const BV_BASE = 'https://image.medonhand.com/E03DACD18D37A094/';

/**
 * PISA 那一场讲座的地址（v1.9.1 起改回**飞利浦 OSS 原片热链**）。
 *
 * ★★ 历史：v1.8.8 曾把这场转成 720p + faststart 托管到 GitHub Pages（echo-ref-media），
 *   理由是原片 `moov` 在文件末尾、担心小程序起播不了。**实测用户反馈自托管更卡**
 *   （GitHub Pages 本机带宽抖动大，30 KB/s ↔ 3 MB/s），而飞利浦 OSS 是阿里云 CDN、
 *   支持 Range，起播反而快 —— 所以 v1.9.1 改回原片直链，转存文件已从媒体仓库删除。
 *   ★ 以后别再「为了能播就转存」：先确认是不是编码/传参问题（v1.9.0 的
 *   「视频地址无效」就是 `?url=` 传中文地址失真，与 faststart 无关）。
 * ★ 原片备份在仓库外 videos/_raw2/pisa.mp4（692 MB，只做备份，不参与发布）。
 */
const PHILIPS_PISA = 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/2026.3.23%20PISA%E5%8E%9F%E7%90%86%EF%BC%8C%E8%AF%AF%E5%8C%BA%E5%8F%8A%E5%BA%94%E7%94%A8-%E5%BE%90%E5%AD%90%E7%89%B9.mp4';

/**
 * 飞利浦超声云课堂（poc.martech-global.com / app.ma.scrmtech.com）心脏类目全部课程。
 *
 * ★★ 数据来源：`POST /meetings/MeetingPc/meetingList`（cid = 类目 id，分页参数 page_no / page_size），
 *   返回的 `playback_url` 形如 `player.html?url=<base64>`，base64 解出来就是 OSS 直链。
 *   bucket 公开读、不可列举（ListObjects 返回 AccessDenied），只能走接口枚举。
 *   心脏类目 10 个：心血管 29877 / 心脏应用 30021 / 心功能定量 31829 / 食道超声 31828 /
 *   TEE 33083 / 心脏三维 32991 / 心脏应用-微课堂 32990 / 心血管-微课堂 30332 /
 *   心血管-非公 33681 / 心脏应用-非公频道 33690。
 *   去同题重复后 152 段 / 66 小时 / 原片 62 GB，按 8 个专题分组（`{ g: '…' }` 是组标题）。
 * ★ 地址是**热链**（philips-idp.oss-cn-shanghai.aliyuncs.com，公开读），不是转存：
 *   对方改权限 / 删文件即失效。别把它当成自有资源。
 * ★ 起播：原片 moov 在文件头（faststart）的小程序内可直接播，约 2/3 是；
 *   其余 moov 在尾部，理论上要等索引，但实测 OSS 支持 Range，多数也能起播。
 *   **不转存**——v1.8.8 转过一次，用户反馈自托管反而更卡，v1.9.1 全部改回热链。
 * ★ 3 条 HLS（.m3u8 分片）网页与小程序都播不了，url 直接指向飞利浦官方详情页。
 */
const PHILIPS_CLASS = [
  { g: '① 探头清洁 · 消毒 · 保养' },
  {
    id: 'ph-001', title: '围手术期经食道探头消毒及保养', sub: '2024.03.14 · 操作短片 · 18 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/%E4%BF%AE%E6%94%B9.mp4',
  },
  {
    id: 'ph-002', title: '探头消毒-X8-2t操作手柄使用', sub: '2024.03.07 · 操作短片 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/X8-2t%E6%93%8D%E4%BD%9C%E6%89%8B%E6%9F%84%E4%BD%BF%E7%94%A8.mp4',
  },
  {
    id: 'ph-003', title: '经食道探头消毒九步法和存放', sub: '2024.01.24 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/us_0627_TEE%E6%88%90%E5%93%81.mp4',
  },
  {
    id: 'ph-004', title: '患者温度设置及探头温度保护', sub: '2024.01.23 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/%E6%82%A3%E8%80%85%E6%B8%A9%E5%BA%A6%E8%AE%BE%E7%BD%AE%E5%8F%8A%E6%8E%A2%E5%A4%B4%E6%B8%A9%E5%BA%A6%E4%BF%9D%E6%8A%A4.mp4',
  },
  {
    id: 'ph-005', title: 'TEE探头保养', sub: '2024.01.20 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/%E6%8E%A2%E5%A4%B4%E4%BF%9D%E5%85%BB.mp4',
  },
  { g: '② 标准切面与血流频谱（1–3 分钟）' },
  {
    id: 'ph-006', title: '心脏超声常规检查规范（切面及测量）', sub: '2018.05.01 · 云教室 · 12 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/%E5%BF%83%E8%84%8F%E8%B6%85%E5%A3%B0%E5%B8%B8%E8%A7%84%E6%A3%80%E6%9F%A5%E8%A7%84%E8%8C%83%EF%BC%88%E5%88%87%E9%9D%A2%E5%8F%8A%E6%B5%8B%E9%87%8F%EF%BC%89.mp4',
  },
  {
    id: 'ph-007', title: '心尖四腔切面', sub: '2024.03.07 · 操作短片 · 3 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0928_%E5%BF%83%E5%B0%96%E5%9B%9B%E8%85%94%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-008', title: 'S9-2儿科心脏探头介绍', sub: '2024.01.26 · 微课堂 · 3 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/S9-2%E5%84%BF%E7%A7%91%E5%BF%83%E8%84%8F%E6%8E%A2%E5%A4%B4%E4%BB%8B%E7%BB%8D.mp4',
  },
  {
    id: 'ph-009', title: '左室流出道血流频谱', sub: '2024.04.05 · 操作短片 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0907_D2%E5%B7%A6%E5%AE%A4%E6%B5%81%E5%87%BA%E9%81%93%E8%A1%80%E6%B5%81%E9%A2%91%E8%B0%B1.mp4',
  },
  {
    id: 'ph-010', title: '胸骨旁主动脉瓣水平短轴切面', sub: '2024.07.03 · 操作短片 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_XGP4%E8%83%B8%E9%AA%A8%E6%97%81%E4%B8%BB%E5%8A%A8%E8%84%89%E7%93%A3%E6%B0%B4%E5%B9%B3%E7%9F%AD%E8%BD%B4%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-011', title: '胸骨旁左心室长轴切面', sub: '2024.07.04 · 操作短片 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_XGP1%E8%83%B8%E9%AA%A8%E6%97%81%E5%B7%A6%E5%BF%83%E5%AE%A4%E9%95%BF%E8%BD%B4%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-012', title: '胸骨上窝主动脉弓短轴切面', sub: '2024.03.07 · 操作短片 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/%E8%83%B8%E9%AA%A8%E4%B8%8A%E7%AA%9D%E4%B8%BB%E5%8A%A8%E8%84%89%E5%BC%93%E7%9F%AD%E8%BD%B4%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-013', title: '肺动脉瓣血流频谱', sub: '2024.03.14 · 操作短片 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0907_D3%E8%82%BA%E5%8A%A8%E8%84%89%E7%93%A3%E8%A1%80%E6%B5%81%E9%A2%91%E8%B0%B1.mp4',
  },
  {
    id: 'ph-014', title: 'M型心室波群', sub: '2024.01.01 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_M1%E5%BF%83%E5%AE%A4%E6%B3%A2%E7%BE%A4.mp4',
  },
  {
    id: 'ph-015', title: '主动脉瓣血流频谱', sub: '2024.03.14 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0907_D1%E4%B8%BB%E5%8A%A8%E8%84%89%E7%93%A3%E8%A1%80%E6%B5%81%E9%A2%91%E8%B0%B1.mp4',
  },
  {
    id: 'ph-016', title: 'M型超声心动图总论', sub: '2024.02.06 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0907_M%E5%9E%8B%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E6%80%BB%E8%AE%BA%E6%94%B9.mp4',
  },
  {
    id: 'ph-017', title: '升主动脉和降主动脉血流频谱', sub: '2024.03.07 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_D8%E5%8D%87%E4%B8%BB%E5%8A%A8%E8%84%89%E5%92%8C%E9%99%8D%E4%B8%BB%E5%8A%A8%E8%84%89%E8%A1%80%E6%B5%81.mp4',
  },
  {
    id: 'ph-018', title: '胸骨旁二尖瓣水平短轴切面', sub: '2024.07.03 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_XGP5%E8%83%B8%E9%AA%A8%E6%97%81%E4%BA%8C%E5%B0%96%E7%93%A3%E6%B0%B4%E5%B9%B3%E7%9F%AD%E8%BD%B4%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-019', title: '三尖瓣血流频谱', sub: '2024.03.07 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0907_D6%E4%B8%89%E5%B0%96%E7%93%A3%E8%A1%80%E6%B5%81%E9%A2%91%E8%B0%B1.mp4',
  },
  {
    id: 'ph-020', title: 'M型肺动脉瓣波群', sub: '2024.07.11 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_M5%E8%82%BA%E5%8A%A8%E8%84%89%E7%93%A3%E6%B3%A2%E7%BE%A4.mp4',
  },
  {
    id: 'ph-021', title: '剑突下四腔切面', sub: '2024.04.06 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_JX1%E5%89%91%E4%B8%8B%E5%9B%9B%E8%85%94%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-022', title: '右室流出道血流频谱', sub: '2024.03.07 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0907_D4%E5%8F%B3%E5%AE%A4%E6%B5%81%E5%87%BA%E9%81%93%E8%A1%80%E6%B5%81%E9%A2%91%E8%B0%B1.mp4',
  },
  {
    id: 'ph-023', title: '心尖五腔切面', sub: '2024.03.07 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_XJ2%E5%BF%83%E5%B0%96%E4%BA%94%E8%85%94%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-024', title: '剑突下下腔静脉长轴切面', sub: '2024.02.08 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_JX2%E5%89%91%E4%B8%8B%E4%B8%8B%E8%85%94%E9%9D%99%E8%84%89%E9%95%BF%E8%BD%B4%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-025', title: '下腔静脉波群', sub: '2024.03.09 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0928_%E4%B8%8B%E8%85%94%E9%9D%99%E8%84%89%E6%B3%A2%E7%BE%A4.mp4',
  },
  {
    id: 'ph-026', title: '心尖左室长轴切面', sub: '2024.03.07 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_XJ4%E5%BF%83%E5%B0%96%E5%B7%A6%E5%AE%A4%E9%95%BF%E8%BD%B4%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-027', title: '胸骨旁右心室流出道切面', sub: '2024.09.16 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E4%B8%B4%E5%BA%8A/us_0904_XGP3%E8%83%B8%E9%AA%A8%E6%97%81%E5%8F%B3%E5%BF%83%E5%AE%A4%E6%B5%81%E5%87%BA%E9%81%93%E5%88%87%E9%9D%A2%E6%94%B9.mp4',
  },
  {
    id: 'ph-028', title: '胸骨旁左心室乳头肌水平短轴切面', sub: '2024.03.07 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_XGP6%E8%83%B8%E9%AA%A8%E6%97%81%E5%B7%A6%E5%BF%83%E5%AE%A4%E4%B9%B3%E5%A4%B4%E8%82%8C%E6%B0%B4%E5%B9%B3%E7%9F%AD%E8%BD%B4%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-029', title: '心尖二腔切面', sub: '2024.03.07 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0928_%E5%BF%83%E5%B0%96%E4%BA%8C%E8%85%94%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-030', title: '剑突下双心房切面', sub: '2024.03.07 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E4%B8%B4%E5%BA%8A/us_0904_JX5%E5%89%91%E4%B8%8B%E5%8F%8C%E5%BF%83%E6%88%BF%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-031', title: '剑突下右心室流出道切面', sub: '2024.03.07 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_JX4%E5%89%91%E4%B8%8B%E5%8F%B3%E5%BF%83%E5%AE%A4%E6%B5%81%E5%87%BA%E9%81%93%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-032', title: '胸骨旁切面体位', sub: '2024.08.08 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_XGP0%E8%83%B8%E9%AA%A8%E6%97%81%E5%88%87%E9%9D%A2%E4%BD%93%E4%BD%8D.mp4',
  },
  {
    id: 'ph-033', title: '剑突下左心室流出道长轴切面', sub: '2024.03.07 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_JX3%E5%89%91%E4%B8%8B%E5%B7%A6%E5%BF%83%E5%AE%A4%E6%B5%81%E5%87%BA%E9%81%93%E9%95%BF%E8%BD%B4%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-034', title: '胸骨旁左心室心尖水平短轴切面', sub: '2024.03.07 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0904_XGP7%E8%83%B8%E9%AA%A8%E6%97%81%E5%B7%A6%E5%BF%83%E5%AE%A4%E5%BF%83%E5%B0%96%E6%B0%B4%E5%B9%B3%E7%9F%AD%E8%BD%B4%E5%88%87%E9%9D%A2.mp4',
  },
  {
    id: 'ph-035', title: '剑下切面体位', sub: '2024.02.08 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/us_0928_%E5%89%91%E4%B8%8B%E5%88%87%E9%9D%A2%E4%BD%93%E4%BD%8D.mp4',
  },
  { g: '③ 定量与应变快捷操作（1–5 分钟）' },
  {
    id: 'ph-036', title: 'Heart Model三维心功能定量系统', sub: '2024.02.29 · 操作短片 · 4 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/%E6%88%90%E5%93%81-%E4%B8%80%E4%B8%AA.mp4',
  },
  {
    id: 'ph-037', title: 'PISA(MR)操作流程', sub: '2024.01.31 · 微课堂 · 3 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/PISA(MR)%E6%93%8D%E4%BD%9C%E6%B5%81%E7%A8%8B.mp4',
  },
  {
    id: 'ph-038', title: 'AutoStrain LV操作', sub: '2024.10.23 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/AutoStrain%20LV/AutoStrain%20LV%E6%93%8D%E4%BD%9C.mp4',
  },
  {
    id: 'ph-039', title: '左房容积指数', sub: '2024.01.31 · 操作短片 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/08-%E5%B7%A6%E6%88%BF%E5%AE%B9%E7%A7%AF%E6%8C%87%E6%95%B0-HD.mp4',
  },
  {
    id: 'ph-040', title: 'TMAD快捷操作', sub: '2024.01.29 · 操作短片 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/TMAD%E5%BF%AB%E6%8D%B7%E6%93%8D%E4%BD%9C.mp4',
  },
  {
    id: 'ph-041', title: 'a2DQ快捷操作', sub: '2024.01.29 · 操作短片 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/a2DQ%E5%BF%AB%E6%8D%B7%E6%93%8D%E4%BD%9C.mp4',
  },
  {
    id: 'ph-042', title: '整体纵向应变（GLS）快捷操作', sub: '2024.01.30 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/3.%20%E6%95%B4%E4%BD%93%E7%BA%B5%E5%90%91%E5%BA%94%E5%8F%98(GLS)%E5%BF%AB%E6%8D%B7%E6%93%8D%E4%BD%9C.mp4',
  },
  {
    id: 'ph-043', title: 'Heart Model 快捷操作', sub: '2024.02.24 · 操作短片 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/1.HeartModel%20%E5%BF%AB%E6%8D%B7%E6%93%8D%E4%BD%9C.mp4',
  },
  {
    id: 'ph-044', title: 'Tei指数公式的添加', sub: '2024.01.27 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/Tei%E6%8C%87%E6%95%B0%E5%85%AC%E5%BC%8F%E7%9A%84%E6%B7%BB%E5%8A%A0.mp4',
  },
  {
    id: 'ph-045', title: '超声心动图扫查', sub: '2024.01.26 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/us_0627_%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E6%88%90%E5%93%81.mp4',
  },
  {
    id: 'ph-046', title: 'E/E’测量的快捷操作', sub: '2024.10.24 · 讲座 · 2 分钟',
    url: 'https://img02.ma.scrmtech.com/cms/1744274886015_E%E6%AF%94E%27%E7%9A%84%E5%BF%AB%E6%8D%B7%E6%93%8D%E4%BD%9C.mp4',
  },
  {
    id: 'ph-047', title: '心脏彩色M型的快捷操作', sub: '2024.01.27 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/%E5%BF%83%E8%84%8F%E5%BD%A9%E8%89%B2M%E5%9E%8B%E7%9A%84%E5%BF%AB%E6%8D%B7%E6%93%8D%E4%BD%9C.mp4',
  },
  {
    id: 'ph-048', title: 'AutoStrain RV操作', sub: '2024.01.03 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/AutoStrain%20RV/AutoStrain%20RV%E6%93%8D%E4%BD%9C.mp4',
  },
  {
    id: 'ph-049', title: 'AutoStrain RV简介', sub: '2024.03.07 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/AutoStrain%20RV/AutoStrain%20RV%E7%AE%80%E4%BB%8B.mp4',
  },
  {
    id: 'ph-050', title: 'AutoStrain LA操作', sub: '2024.06.19 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/AutoStrain%20LA/AutoStrain%20LA%E6%93%8D%E4%BD%9C.mp4',
  },
  {
    id: 'ph-051', title: 'AutoStrain LA简介', sub: '2024.05.26 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/AutoStrain%20LA/AutoStrain%20LA%E7%AE%80%E4%BB%8B.mp4',
  },
  {
    id: 'ph-052', title: 'AutoStrain LV简介', sub: '2024.02.13 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/AutoStrain%20LV/AutoStrain%20LV%E7%AE%80%E4%BB%8B.mp4',
  },
  {
    id: 'ph-053', title: '双屏术中模式的使用方法', sub: '2024.01.21 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/%C3%8B%C2%AB%C3%86%C3%81%C3%8A%C3%B5%C3%96%C3%90%C3%84%C2%A3%C3%8A%C2%BD%C2%B5%C3%84%C3%8A%C2%B9%C3%93%C3%83%C2%B7%C2%BD%C2%B7%C2%A8.mp4',
  },
  {
    id: 'ph-054', title: 'AutoStrain RV总结', sub: '2024.03.06 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/AutoStrain%20RV/AutoStrain%20RV%E6%80%BB%E7%BB%93.mp4',
  },
  {
    id: 'ph-055', title: 'AutoStrain LV总结', sub: '2024.03.07 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/AutoStrain%20LV/AutoStrain%20LV%20%E6%80%BB%E7%BB%93.mp4',
  },
  {
    id: 'ph-056', title: 'AutoStrain LA总结', sub: '2024.03.14 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/AutoStrain%20LA/AutoStrain%20LA%E6%80%BB%E7%BB%93.mp4',
  },
  { g: '④ 三维 · 多平面 · 心腔重建' },
  {
    id: 'ph-057', title: '3D 多平面技术的临床应用及操作技巧', sub: '2022.07.25 · 云教室 · 45 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/%E9%A3%9E%E5%88%A9%E6%B5%A63D%E5%A4%9A%E5%B9%B3%E9%9D%A2%E6%8A%80%E6%9C%AF%E7%9A%84%E4%B8%B4%E5%BA%8A%E5%BA%94%E7%94%A8%E5%8F%8A%E6%93%8D%E4%BD%9C%E6%8A%80%E5%B7%A7_v2.mp4',
  },
  {
    id: 'ph-058', title: '矩阵心脏三维图像获取及切割', sub: '2022.10.24 · 云教室 · 37 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/%E7%9F%A9%E9%98%B5%E5%BF%83%E8%84%8F%E4%B8%89%E7%BB%B4%E8%8E%B7%E5%8F%96%E5%8F%8A%E5%88%87%E5%89%B2.mp4',
  },
  {
    id: 'ph-059', title: 'TEE三维图像存图及格式说明', sub: '2025.12.08 · 微课堂 · 5 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/2025%E5%B9%B4%E5%BE%AE%E8%AF%BE%E5%A0%82%20-TEE%E4%B8%89%E7%BB%B4%E5%9B%BE%E5%83%8F%E5%AD%98%E5%9B%BE%E5%8F%8A%E6%A0%BC%E5%BC%8F%E8%AF%B4%E6%98%8E.mp4',
  },
  {
    id: 'ph-060', title: 'MultiVue- AutoDepth&Layout操作步骤2', sub: '2024.02.27 · 微课堂 · 4 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/MultiVue-2%EF%BC%9AResference%E6%93%8D%E4%BD%9C%E6%AD%A5%E9%AA%A4-1.mp4',
  },
  {
    id: 'ph-061', title: 'MultiVue- AutoDepth&Layout操作步骤1', sub: '2024.02.27 · 微课堂 · 3 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/MultiVue-1%EF%BC%9AAuto%20Depth&Layout%E6%93%8D%E4%BD%9C%E6%AD%A5%E9%AA%A4.mp4',
  },
  {
    id: 'ph-062', title: 'xPlane-双平面Simpson心功能测量步骤', sub: '2024.02.26 · 微课堂 · 3 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/xPlane-2%EF%BC%9A%E5%8F%8C%E5%B9%B3%E9%9D%A2Simpson%E5%BF%83%E5%8A%9F%E8%83%BD%E6%B5%8B%E9%87%8F%E6%AD%A5%E9%AA%A4.mp4',
  },
  {
    id: 'ph-063', title: 'TrueVue- TouchVue操作步骤', sub: '2024.02.25 · 微课堂 · 3 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/TrueVue-2%EF%BC%9ATouchVue%E6%93%8D%E4%BD%9C%E6%AD%A5%E9%AA%A4_1.mp4',
  },
  {
    id: 'ph-064', title: 'TrueVue- Glass采图要点及操作步骤', sub: '2024.02.25 · 微课堂 · 3 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/TrueVue-1%EF%BC%9AGlass%E9%87%87%E5%9B%BE%E8%A6%81%E7%82%B9%E5%8F%8A%E6%93%8D%E4%BD%9C%E6%AD%A5%E9%AA%A4.mp4',
  },
  {
    id: 'ph-065', title: 'DHM单心动周期操作流程', sub: '2024.02.24 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/2022%E5%B9%B4%E4%B8%8A%E6%96%B0/DHM%E5%8D%95%E5%BF%83%E5%8A%A8%E5%91%A8%E6%9C%9F%E6%93%8D%E4%BD%9C%E6%B5%81%E7%A8%8B.mp4',
  },
  {
    id: 'ph-066', title: 'xPlane-基本操作步骤及应用实例介绍', sub: '2024.02.26 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/xPlane-1%EF%BC%9A%E5%9F%BA%E6%9C%AC%E6%93%8D%E4%BD%9C%E6%AD%A5%E9%AA%A4%E5%8F%8A%E5%BA%94%E7%94%A8%E5%AE%9E%E4%BE%8B%E4%BB%8B%E7%BB%8D.mp4',
  },
  {
    id: 'ph-067', title: 'MaxVue快捷操作', sub: '2024.01.22 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/MaxVue%E5%BF%AB%E6%8D%B7%E6%93%8D%E4%BD%9C.mp4',
  },
  {
    id: 'ph-068', title: 'iCrop的快捷应用', sub: '2024.02.25 · 操作短片 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/iCrop%E7%9A%84%E5%BF%AB%E6%8D%B7%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-069', title: '3D ZOOM快捷应用', sub: '2024.02.25 · 操作短片 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/3D%20ZOOM%E5%BF%AB%E6%8D%B7%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-070', title: '3D AutoRV操作', sub: '2024.02.23 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/3D%20AutoRV/3D%20AutoRV%E6%93%8D%E4%BD%9C.mp4',
  },
  {
    id: 'ph-071', title: '3D AutoRV简介', sub: '2024.02.23 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/3D%20AutoRV/3D%20AutoRV%E7%AE%80%E4%BB%8B.mp4',
  },
  {
    id: 'ph-072', title: 'xPlane的快捷应用', sub: '2024.02.26 · 微课堂 · 2 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/%E6%8A%80%E6%9C%AF/xPlane%E7%9A%84%E5%BF%AB%E6%8D%B7%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-073', title: 'DHM操作流程', sub: '2024.02.24 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/2022%E5%B9%B4%E4%B8%8A%E6%96%B0/DHM%E6%93%8D%E4%BD%9C%E6%B5%81%E7%A8%8B.mp4',
  },
  {
    id: 'ph-074', title: 'iRotate的快捷应用', sub: '2024.02.25 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/iRotate%E7%9A%84%E5%BF%AB%E6%8D%B7%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-075', title: '3D AutoRV总结', sub: '2024.02.23 · 微课堂 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E5%BE%AE%E8%AF%BE%E5%A0%82/3D%20AutoRV/3D%20AutoRV%E6%80%BB%E7%BB%93.mp4',
  },
  {
    id: 'ph-076', title: '导出心脏三维AVI格式数据', sub: '2024.02.22 · 操作短片 · 1 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/%E5%AF%BC%E5%87%BA%E5%BF%83%E8%84%8F%E4%B8%89%E7%BB%B4AVI%E6%A0%BC%E5%BC%8F%E6%95%B0%E6%8D%AE.mp4',
  },
  { g: '⑤ 瓣膜病 · TEE · 结构性心脏病介入' },
  {
    id: 'ph-077', title: '瓣膜之声', sub: '2025.03.19 · 百家讲坛 · 1 小时 54 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/3.19-%E7%93%A3%E8%86%9C%E4%B9%8B%E5%A3%B0.mp4',
  },
  {
    id: 'ph-078', title: '结构性心脏病介入治疗 经食管超声心动图术前筛查规范建议 ASE指南解读', sub: '2021.09.08 · 百家讲坛 · 1 小时 31 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E7%BB%93%E6%9E%84%E6%80%A7%E5%BF%83%E8%84%8F%E7%97%85%E4%BB%8B%E5%85%A5%E6%B2%BB%E7%96%97%20%E7%BB%8F%E9%A3%9F%E7%AE%A1%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E6%9C%AF%E5%89%8D%E7%AD%9B%E6%9F%A5%E8%A7%84%E8%8C%83%E5%BB%BA%E8%AE%AE%20ASE%E6%8C%87%E5%8D%97%E8%A7%A3%E8%AF%BB.mp4',
  },
  {
    id: 'ph-079', title: '经食道超声在二尖瓣成形中的临床应用', sub: '2024.02.16 · 操作短片 · 1 小时 16 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/1583926250_1583930820.mp4',
  },
  {
    id: 'ph-080', title: '右心瓣膜反流的超声评价与治疗策略', sub: '2021.10.20 · 百家讲坛 · 1 小时 8 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E5%8F%B3%E5%BF%83%E7%93%A3%E8%86%9C%E5%8F%8D%E6%B5%81%E7%9A%84%E8%B6%85%E5%A3%B0%E8%AF%84%E4%BB%B7%E4%B8%8E%E6%B2%BB%E7%96%97%E7%AD%96%E7%95%A5.mp4',
  },
  {
    id: 'ph-081', title: 'TEE在介入术中应用', sub: '2024.02.09 · 操作短片 · 1 小时 3 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/1542799835_1542803681.mp4',
  },
  {
    id: 'ph-082', title: '经食管超声心动图基础及规范', sub: '2024.01.03 · 操作短片 · 1 小时 2 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/1568201651_1568205420.mp4',
  },
  {
    id: 'ph-083', title: 'TEE与非心脏手术-非诊断性应用前景', sub: '2024.02.05 · 操作短片 · 60 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/1583753370_1583756937.mp4',
  },
  {
    id: 'ph-084', title: '经食道超声心动图（TEE）在二尖瓣手术中的应用', sub: '2022.05.25 · 百家讲坛 · 59 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/Medvcom/2022.5.25%20%E7%BB%8F%E9%A3%9F%E9%81%93%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%EF%BC%88TEE%EF%BC%89%E5%9C%A8%E4%BA%8C%E5%B0%96%E7%93%A3%E6%89%8B%E6%9C%AF%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-085', title: '心腔视界，豁然开朗—实时三维超声心动图在结构性心脏病的应用价值', sub: '2020.03.18 · 百家讲坛 · 58 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E5%BF%83%E8%85%94%E8%A7%86%E7%95%8C%EF%BC%8C%E8%B1%81%E7%84%B6%E5%BC%80%E6%9C%97%E2%80%94%E5%AE%9E%E6%97%B6%E4%B8%89%E7%BB%B4%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E5%9C%A8%E7%BB%93%E6%9E%84%E6%80%A7%E5%BF%83%E8%84%8F%E7%97%85%E7%9A%84%E5%BA%94%E7%94%A8%E4%BB%B7%E5%80%BC.mp4',
  },
  {
    id: 'ph-086', title: '结构性心脏病介入时代对三尖瓣反流的新认识', sub: '2023.08.02 · 百家讲坛 · 54 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E7%BB%93%E6%9E%84%E6%80%A7%E5%BF%83%E8%84%8F%E7%97%85%E4%BB%8B%E5%85%A5%E6%97%B6%E4%BB%A3%E5%AF%B9%E4%B8%89%E5%B0%96%E7%93%A3%E5%8F%8D%E6%B5%81%E7%9A%84%E6%96%B0%E8%AE%A4%E8%AF%86.mp4',
  },
  {
    id: 'ph-087', title: '三维食管超声在新型二尖瓣支架瓣膜植入手术中的应用', sub: '2022.03.16 · 百家讲坛 · 54 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E4%B8%89%E7%BB%B4%E9%A3%9F%E7%AE%A1%E8%B6%85%E5%A3%B0%E5%9C%A8%E6%96%B0%E5%9E%8B%E4%BA%8C%E5%B0%96%E7%93%A3%E6%94%AF%E6%9E%B6%E7%93%A3%E8%86%9C%E6%A4%8D%E5%85%A5%E6%89%8B%E6%9C%AF%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-088', title: '实时三维经食道超声在瓣膜病介入治疗中的应用', sub: '2024.01.09 · 操作短片 · 53 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/1575459195_1575462420.mp4',
  },
  {
    id: 'ph-089', title: 'TEE引导下结构性心脏病介入治疗', sub: '2022.10.19 · 百家讲坛 · 53 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/TEE%E5%BC%95%E5%AF%BC%E4%B8%8B%E7%BB%93%E6%9E%84%E6%80%A7%E5%BF%83%E8%84%8F%E7%97%85%E4%BB%8B%E5%85%A5%E6%B2%BB%E7%96%97.mp4',
  },
  {
    id: 'ph-090', title: '超声心动图在二尖瓣介入术中的应用-昨天· 今天· 明天', sub: '2021.05.19 · 百家讲坛 · 51 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E5%9C%A8%E4%BA%8C%E5%B0%96%E7%93%A3%E4%BB%8B%E5%85%A5%E6%9C%AF%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8-%E6%98%A8%E5%A4%A9%C2%B7%20%E4%BB%8A%E5%A4%A9%C2%B7%20%E6%98%8E%E5%A4%A9.mp4',
  },
  {
    id: 'ph-091', title: '经食道超声心动图在心脏手术中应用的体会', sub: '2024.03.07 · 操作短片 · 50 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/%E6%A2%81%E6%9D%B0%E8%B4%A4222222mp4.mp4',
  },
  {
    id: 'ph-092', title: '经食道超声在急危重症麻醉手术中的应用', sub: '2022.04.13 · 百家讲坛 · 47 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/Medvcom/2022.4.13%20%E7%BB%8F%E9%A3%9F%E9%81%93%E8%B6%85%E5%A3%B0%E5%9C%A8%E6%80%A5%E5%8D%B1%E9%87%8D%E7%97%87%E9%BA%BB%E9%86%89%E6%89%8B%E6%9C%AF%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-093', title: '3DTEE在瓣膜病微创介入治疗中的应用', sub: '2021.08.11 · 百家讲坛 · 45 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/3DTEE%E5%9C%A8%E7%93%A3%E8%86%9C%E7%97%85%E5%BE%AE%E5%88%9B%E4%BB%8B%E5%85%A5%E6%B2%BB%E7%96%97%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-094', title: '经食管超声心动图TEE-在心血管急重症的应用', sub: '2023.09.20 · 百家讲坛 · 45 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E7%BB%8F%E9%A3%9F%E7%AE%A1%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BETEE-%E5%9C%A8%E5%BF%83%E8%A1%80%E7%AE%A1%E6%80%A5%E9%87%8D%E7%97%87%E7%9A%84%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-095', title: '经导管主动脉瓣置入术超声心动图检查指南解读', sub: '2024.04.24 · 百家讲坛 · 45 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E7%BB%8F%E5%AF%BC%E7%AE%A1%E4%B8%BB%E5%8A%A8%E8%84%89%E7%93%A3%E7%BD%AE%E5%85%A5%E6%9C%AF%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E6%A3%80%E6%9F%A5%E6%8C%87%E5%8D%97%E8%A7%A3%E8%AF%BB.mp4',
  },
  {
    id: 'ph-096', title: '3D-TEE在临床及科研中的应用', sub: '2023.03.15 · 百家讲坛 · 38 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/3D-TEE%E5%9C%A8%E4%B8%B4%E5%BA%8A%E5%8F%8A%E7%A7%91%E7%A0%94%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-097', title: '超声心动图在TAVR中的应用', sub: '2022.06.15 · 百家讲坛 · 36 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/Medvcom/2022.6.15%20%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E5%9C%A8TAVR%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-098', title: '二尖瓣缘对缘修复(TEER)术前经食道超声筛查要点', sub: '2025.12.03 · 百家讲坛 · 32 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/2025-12-03%20%E9%A3%9E%E5%88%A9%E6%B5%A6-%E8%B5%B5%E5%BD%A9%E6%98%8E%E8%80%81%E5%B8%88.mp4',
  },
  {
    id: 'ph-099', title: '超声在纯主动脉反流TAVI中的应用', sub: '2024.09.11 · 百家讲坛 · 32 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/2024.9.11-%E8%B6%85%E5%A3%B0%E5%9C%A8%E7%BA%AF%E4%B8%BB%E5%8A%A8%E8%84%89%E5%8F%8D%E6%B5%81TAVI%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-100', title: '主动脉瓣反流临床评估和超声心动图指南解析', sub: '2025.03.12 · 百家讲坛 · 31 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E5%89%AA%E8%BE%91-3.12-%E5%AD%99%E9%B9%8F%E6%B6%9B-%E4%B8%BB%E5%8A%A8%E8%84%89%E7%93%A3%E5%8F%8D%E6%B5%81%E4%B8%B4%E5%BA%8A%E8%AF%84%E4%BC%B0%E5%92%8C%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E6%8C%87%E5%8D%97%E8%A7%A3%E6%9E%90.mp4',
  },
  {
    id: 'ph-101', title: '经导管左心耳封堵术（LAAC）TEE 解决方案', sub: '2025.03.24 · 云教室 · 28 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/2025.3.24%E7%BB%8F%E5%AF%BC%E7%AE%A1%E5%B7%A6%E5%BF%83%E8%80%B3%E5%B0%81%E5%A0%B5%E6%9C%AF%EF%BC%88LAAC%EF%BC%89%E9%A3%9E%E5%88%A9%E6%B5%A6TEE%E8%A7%A3%E5%86%B3%E6%96%B9%E6%A1%88%20%E9%BB%84%E5%B0%8F%E6%9D%BE.mp4',
  },
  {
    id: 'ph-102', title: '二尖瓣结构评估的临床价值及操作流程', sub: '2025.05.26 · 云教室 · 25 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/%E4%BA%8C%E5%B0%96%E7%93%A3%E7%BB%93%E6%9E%84%E8%AF%84%E4%BC%B0%E7%9A%84%E4%B8%B4%E5%BA%8A%E4%BB%B7%E5%80%BC%E5%8F%8A%E6%93%8D%E4%BD%9C%E6%B5%81%E7%A8%8B-%E5%AD%9F%E5%BA%86%E4%BD%B3.mp4',
  },
  { g: '⑥ 心功能定量 · 应变 · 心腔测量' },
  {
    id: 'ph-103', title: '左心房功能的超声评价与心房衰竭和相关疾病', sub: '2025.05.14 · 百家讲坛 · 1 小时 10 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/5.14-%E5%8D%97%E9%98%B3%E5%B8%82%E4%B8%AD%E5%BF%83%E5%8C%BB%E9%99%A2-%E4%B8%81%E6%97%AD%E8%90%8C-%E8%A7%86%E9%A2%91.mp4',
  },
  {
    id: 'ph-104', title: '中国成人超声心动图正常参考值', sub: '2018.09.19 · 百家讲坛 · 1 小时 4 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E4%B8%AD%E5%9B%BD%E6%88%90%E4%BA%BA%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E6%AD%A3%E5%B8%B8%E5%8F%82%E8%80%83%E5%80%BC.mp4',
  },
  {
    id: 'ph-105', title: '中国健康孕妇超声心动图正常参考值及TMAD应用初步探讨', sub: '2024.05.29 · 讲座 · 54 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/bizconf/2024.5.29%E9%A3%9E%E5%88%A9%E6%B5%A6-%E4%B8%AD%E5%9B%BD%E5%81%A5%E5%BA%B7%E5%AD%95%E5%A6%87%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E6%AD%A3%E5%B8%B8%E5%8F%82%E8%80%83%E5%80%BC%E5%8F%8ATMAD%E5%BA%94%E7%94%A8%E5%88%9D%E6%AD%A5%E6%8E%A2%E8%AE%A8%E7%9B%B4%E6%92%AD%E8%A7%86%E9%A2%91.mp4',
  },
  {
    id: 'ph-106', title: '超声评估心脏功能', sub: '2020.09.02 · 百家讲坛 · 52 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E8%B6%85%E5%A3%B0%E8%AF%84%E4%BC%B0%E5%BF%83%E8%84%8F%E5%8A%9F%E8%83%BD.mp4',
  },
  {
    id: 'ph-107', title: '超声心动图心腔定量评价的指南与进展', sub: '2024.02.02 · 操作短片 · 49 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/1547033397_1547036399.mp4',
  },
  {
    id: 'ph-108', title: 'PISA 原理、误区及应用（35 分钟）',
    sub: '2026.03.23 · 云教室 · 36 分钟 · 1080p 原片（692 MB，热链）',
    url: PHILIPS_PISA,
  },
  {
    id: 'ph-109', title: '心脏同步性超声造影评估方法及定量工具', sub: '2024.03.14 · 操作短片 · 37 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/PoC/1577102422_1577104652.mp4',
  },
  {
    id: 'ph-110', title: '右心功能评价及测量的标准化建议', sub: '2022.07.20 · 百家讲坛 · 36 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/Medvcom/2022.7.20%20%E5%8F%B3%E5%BF%83%E5%8A%9F%E8%83%BD%E8%AF%84%E4%BB%B7%E5%8F%8A%E6%B5%8B%E9%87%8F%E7%9A%84%E6%A0%87%E5%87%86%E5%8C%96%E5%BB%BA%E8%AE%AE.mp4',
  },
  {
    id: 'ph-111', title: 'LV/LA/RV应变分析图像采集要求及操作规范', sub: '2024.10.28 · 云教室 · 36 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/10.28-LV%20LA%20RV%20%E5%BA%94%E5%8F%98%E5%88%86%E6%9E%90%E5%9B%BE%E5%83%8F%E9%87%87%E9%9B%86%E8%A6%81%E6%B1%82%E5%8F%8A%E6%93%8D%E4%BD%9C%E8%A7%84%E8%8C%83--%E7%8E%8B%E5%AE%9C%E5%90%9B_1.mp4',
  },
  {
    id: 'ph-113', title: 'Heart model的存图与分析', sub: '2018.10.11 · 云教室 · 35 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/Heart%20model%E7%9A%84%E5%AD%98%E5%9B%BE%E4%B8%8E%E5%88%86%E6%9E%90.mp4',
  },
  {
    id: 'ph-114', title: '心功能的评价方法及操作流程', sub: '2018.08.16 · 云教室 · 35 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/%E5%BF%83%E5%8A%9F%E8%83%BD%E7%9A%84%E8%AF%84%E4%BB%B7%E6%96%B9%E6%B3%95%E5%8F%8A%E6%93%8D%E4%BD%9C%E6%B5%81%E7%A8%8B.mp4',
  },
  {
    id: 'ph-115', title: '左室功能评估与定量技术应用', sub: '2022.06.27 · 云教室 · 34 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/%E5%B7%A6%E5%AE%A4%E5%8A%9F%E8%83%BD%E8%AF%84%E4%BC%B0%E5%8F%8A%E9%A3%9E%E5%88%A9%E6%B5%A6%E5%AE%9A%E9%87%8F%E6%8A%80%E6%9C%AF%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-116', title: 'TMAD的操作规范及临床应用', sub: '2024.05.27 · 云教室 · 28 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/TMAD%E7%9A%84%E6%93%8D%E4%BD%9C%E8%A7%84%E8%8C%83%E5%8F%8A%E4%B8%B4%E5%BA%8A%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-117', title: 'a2DQ 左心功能定量参数解读', sub: '2019.04.22 · 云教室 · 26 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/a2DQ%20%E5%B7%A6%E5%BF%83%E5%8A%9F%E8%83%BD%E5%AE%9A%E9%87%8F%E5%8F%82%E6%95%B0%E8%A7%A3%E8%AF%BB.mp4',
  },
  {
    id: 'ph-118', title: 'AutoStrain的临床应用思考（黄鹤）', sub: '2024.01.03 · 讲座 · HLS 分片，需浏览器打开',
    url: 'https://app.ma.scrmtech.com/meetings/MeetingPc/Detail?pf_uid=37564_2395&pf_type=3&id=99334',
  },
  {
    id: 'ph-119', title: '新超声定量技术在心脏功能评估中的应用（许迪）', sub: '2024.01.16 · 讲座 · HLS 分片，需浏览器打开',
    url: 'https://app.ma.scrmtech.com/meetings/MeetingPc/Detail?pf_uid=37564_2395&pf_type=3&id=99332',
  },
  { g: '⑦ 心肌病 · 造影 · 负荷与急重症' },
  {
    id: 'ph-120', title: '心肌病超声诊断', sub: '2019.06.05 · 百家讲坛 · 1 小时 39 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E5%BF%83%E8%82%8C%E7%97%85%E8%B6%85%E5%A3%B0%E8%AF%8A%E6%96%AD.mp4',
  },
  {
    id: 'ph-121', title: '以科研之矛攻临床之盾——Liwen术式治疗肥厚型心肌病的成长之路', sub: '2020.09.11 · 百家讲坛 · 1 小时 26 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E4%BB%A5%E7%A7%91%E7%A0%94%E4%B9%8B%E7%9F%9B%E6%94%BB%E4%B8%B4%E5%BA%8A%E4%B9%8B%E7%9B%BE%E2%80%94%E2%80%94Liwen%E6%9C%AF%E5%BC%8F%E6%B2%BB%E7%96%97%E8%82%A5%E5%8E%9A%E5%9E%8B%E5%BF%83%E8%82%8C%E7%97%85%E7%9A%84%E6%88%90%E9%95%BF%E4%B9%8B%E8%B7%AF.mp4',
  },
  {
    id: 'ph-122', title: '2023欧洲负荷超声心动图共识解读', sub: '2024.06.26 · 百家讲坛 · 1 小时 15 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/2024.6.26-%E5%BC%A0%E5%8D%9A-2023%E6%AC%A7%E6%B4%B2%E8%B4%9F%E8%8D%B7%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E5%85%B1%E8%AF%86%E8%A7%A3%E8%AF%BB.mp4',
  },
  {
    id: 'ph-123', title: '从宏观到微观：心脏造影的临床应用', sub: '2018.10.24 · 百家讲坛 · 1 小时 10 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E4%BB%8E%E5%AE%8F%E8%A7%82%E5%88%B0%E5%BE%AE%E8%A7%82%EF%BC%9A%E5%BF%83%E8%84%8F%E9%80%A0%E5%BD%B1%E7%9A%84%E4%B8%B4%E5%BA%8A%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-124', title: '冠心病不容忽视的问题——冠脉微循环障碍', sub: '2020.07.15 · 百家讲坛 · 1 小时 5 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E5%86%A0%E5%BF%83%E7%97%85%E4%B8%8D%E5%AE%B9%E5%BF%BD%E8%A7%86%E7%9A%84%E9%97%AE%E9%A2%98%E2%80%94%E2%80%94%E5%86%A0%E8%84%89%E5%BE%AE%E5%BE%AA%E7%8E%AF%E9%9A%9C%E7%A2%8D.mp4',
  },
  {
    id: 'ph-125', title: '心脏超声造影的临床应用', sub: '2020.06.12 · 百家讲坛 · 1 小时 5 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E5%BF%83%E8%84%8F%E8%B6%85%E5%A3%B0%E9%80%A0%E5%BD%B1%E7%9A%84%E4%B8%B4%E5%BA%8A%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-126', title: '心脏急症超声应用价值', sub: '2020.04.24 · 百家讲坛 · 1 小时 3 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E5%BF%83%E8%84%8F%E6%80%A5%E7%97%87%E8%B6%85%E5%A3%B0%E5%BA%94%E7%94%A8%E4%BB%B7%E5%80%BC.mp4',
  },
  {
    id: 'ph-127', title: 'TOMTEC智能心血管解决方案在临床科研中的应用与展望', sub: '2022.06.24 · 百家讲坛 · 58 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/Medvcom/2022.6.24%20TOMTEC%E6%99%BA%E8%83%BD%E5%BF%83%E8%A1%80%E7%AE%A1%E8%A7%A3%E5%86%B3%E6%96%B9%E6%A1%88%E5%9C%A8%E4%B8%B4%E5%BA%8A%E7%A7%91%E7%A0%94%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8%E4%B8%8E%E5%B1%95%E6%9C%9B.mp4',
  },
  {
    id: 'ph-128', title: '超声在肥厚型心肌病诊治中的价值', sub: '2022.02.16 · 百家讲坛 · 57 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E8%B6%85%E5%A3%B0%E5%9C%A8%E8%82%A5%E5%8E%9A%E5%9E%8B%E5%BF%83%E8%82%8C%E7%97%85%E8%AF%8A%E6%B2%BB%E4%B8%AD%E7%9A%84%E4%BB%B7%E5%80%BC.mp4',
  },
  {
    id: 'ph-129', title: '左心室辅助装置治疗终末期心力衰竭围术期超声心动图评价指南 (2025版)解读', sub: '2025.02.26 · 百家讲坛 · 56 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/2.26%E5%B7%A6%E5%BF%83%E5%AE%A4%E8%BE%85%E5%8A%A9%E8%A3%85%E7%BD%AE%E6%B2%BB%E7%96%97%E7%BB%88%E6%9C%AB%E6%9C%9F%E5%BF%83%E5%8A%9B%E8%A1%B0%E7%AB%AD%E5%9B%B4%E6%9C%AF%E6%9C%9F%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E8%AF%84%E4%BB%B7%E6%8C%87%E5%8D%97%EF%BC%882025%E7%89%88%EF%BC%89%E8%A7%A3%E8%AF%BB.mp4',
  },
  {
    id: 'ph-130', title: '心脏超声造影在慢性冠脉综合征诊疗决策中的作用', sub: '2020.07.08 · 百家讲坛 · 55 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E5%BF%83%E8%84%8F%E8%B6%85%E5%A3%B0%E9%80%A0%E5%BD%B1%E5%9C%A8%E6%85%A2%E6%80%A7%E5%86%A0%E8%84%89%E7%BB%BC%E5%90%88%E5%BE%81%E8%AF%8A%E7%96%97%E5%86%B3%E7%AD%96%E4%B8%AD%E7%9A%84%E4%BD%9C%E7%94%A8.mp4',
  },
  {
    id: 'ph-131', title: '超声人工智能在心脏功能评价中的应用及展望', sub: '2022.07.27 · 百家讲坛 · 54 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/Medvcom/2022.7.27%20%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B_%E8%B6%85%E5%A3%B0%E4%BA%BA%E5%B7%A5%E6%99%BA%E8%83%BD%E5%9C%A8%E5%BF%83%E8%84%8F%E5%8A%9F%E8%83%BD%E8%AF%84%E4%BB%B7%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8%E5%8F%8A%E5%B1%95%E6%9C%9B.mp4',
  },
  {
    id: 'ph-132', title: 'ASE心脏造影指南解读及发展', sub: '2019.03.27 · 百家讲坛 · 53 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/ASE%E5%BF%83%E8%84%8F%E9%80%A0%E5%BD%B1%E6%8C%87%E5%8D%97%E8%A7%A3%E8%AF%BB%E5%8F%8A%E5%8F%91%E5%B1%95.mp4',
  },
  {
    id: 'ph-133', title: '心脏白塞病的超声诊断体会', sub: '2024.08.07 · 百家讲坛 · 51 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/2024.8.7-%E7%8E%8B%E7%BB%A7%E4%BC%9F-%E5%BF%83%E8%84%8F%E7%99%BD%E5%A1%9E%E7%97%85%E7%9A%84%E8%B6%85%E5%A3%B0%E8%AF%8A%E6%96%AD.mp4',
  },
  {
    id: 'ph-134', title: 'LVAD围术期的超声心动图评估', sub: '2024.10.16 · 百家讲坛 · 50 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/2024.10.16-%E9%BB%84%E9%B9%A4-LVAD%E5%9B%B4%E6%9C%AF%E6%9C%9F%E7%9A%84%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E8%AF%84%E4%BC%B0.mp4',
  },
  {
    id: 'ph-135', title: '肥厚型心肌病激发/负荷超声心动图临床应用指南(2024版)解读', sub: '2025.08.13 · 百家讲坛 · 49 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/2025.8.13-%E4%BB%BB%E5%BB%BA%E4%B8%BD-%E8%82%A5%E5%8E%9A%E5%9E%8B%E5%BF%83%E8%82%8C%E7%97%85%E6%BF%80%E5%8F%91%20%E8%B4%9F%E8%8D%B7%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E4%B8%B4%E5%BA%8A%E5%BA%94%E7%94%A8%E6%8C%87%E5%8D%97(2024%E7%89%88)%E8%A7%A3%E8%AF%BB.mp4',
  },
  {
    id: 'ph-136', title: '超声北斗星，启航“心”征程', sub: '2022.09.15 · 百家讲坛 · 45 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/Medvcom/2022.9.15%20%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B-%E8%B6%85%E5%A3%B0%E5%8C%97%E6%96%97%E6%98%9F%EF%BC%8C%E5%90%AF%E8%88%AA%E2%80%9C%E5%BF%83%E2%80%9D%E5%BE%81%E7%A8%8B.mp4',
  },
  {
    id: 'ph-137', title: '负荷超声心动图操作流程', sub: '2024.03.25 · 云教室 · 38 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/%E8%B4%9F%E8%8D%B7%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E6%93%8D%E4%BD%9C%E6%B5%81%E7%A8%8B.mp4',
  },
  {
    id: 'ph-138', title: '心脏超声造影的操作流程参数调节及定量分析', sub: '2023.08.28 · 云教室 · 37 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/%E5%BF%83%E8%84%8F%E8%B6%85%E5%A3%B0%E9%80%A0%E5%BD%B1%E7%9A%84%E6%93%8D%E4%BD%9C%E6%B5%81%E7%A8%8B%E5%8F%82%E6%95%B0%E8%B0%83%E8%8A%82%E5%8F%8A%E5%AE%9A%E9%87%8F%E5%88%86%E6%9E%90.mp4',
  },
  {
    id: 'ph-139', title: '主动脉夹层的超声诊断技巧', sub: '2024.09.18 · 百家讲坛 · 33 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/2024.9.18-%E9%99%88%E6%B5%B7%E7%87%95-%E4%B8%BB%E5%8A%A8%E8%84%89%E5%A4%B9%E5%B1%82%E7%9A%84%E8%B6%85%E5%A3%B0%E8%AF%8A%E6%96%AD%E6%8A%80%E5%B7%A7.mp4',
  },
  {
    id: 'ph-140', title: '负荷超声临床应用', sub: '2019.07.22 · 云教室 · 32 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E4%BA%91%E6%95%99%E5%AE%A4/%E9%A3%9E%E5%88%A9%E6%B5%A6%E8%B4%9F%E8%8D%B7%E8%B6%85%E5%A3%B0%E4%B8%B4%E5%BA%8A%E5%BA%94%E7%94%A8.mp4',
  },
  {
    id: 'ph-141', title: '主动脉根部病变的超声诊断思路', sub: '2020.12.23 · 百家讲坛',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E4%B8%BB%E5%8A%A8%E8%84%89%E6%A0%B9%E9%83%A8%E7%97%85%E5%8F%98%E7%9A%84%E8%B6%85%E5%A3%B0%E8%AF%8A%E6%96%AD%E6%80%9D%E8%B7%AF.mp4',
  },
  {
    id: 'ph-142', title: '人工智能在超声心动图应用的发展与未来（马春燕）', sub: '2024.02.08 · 讲座 · HLS 分片，需浏览器打开',
    url: 'https://app.ma.scrmtech.com/meetings/MeetingPc/Detail?pf_uid=37564_2395&pf_type=3&id=99333',
  },
  {
    id: 'ph-143', title: '多模态超声在心脏占位性病变诊断中的应用', sub: '2020.05.13 · 百家讲坛',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E5%A4%9A%E6%A8%A1%E6%80%81%E8%B6%85%E5%A3%B0%E5%9C%A8%E5%BF%83%E8%84%8F%E5%8D%A0%E4%BD%8D%E6%80%A7%E7%97%85%E5%8F%98%E8%AF%8A%E6%96%AD%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8.mp4',
  },
  { g: '⑧ 先心 · 胎儿 · 妊娠 · 其他' },
  {
    id: 'ph-144', title: '心脏超声远程教学与远程会诊——自媒体的作用', sub: '2025.06.11 · 百家讲坛 · 1 小时 9 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/6.11-%E5%BF%83%E8%84%8F%E8%B6%85%E5%A3%B0%E8%BF%9C%E7%A8%8B%E6%95%99%E5%AD%A6%E4%B8%8E%E8%BF%9C%E7%A8%8B%E4%BC%9A%E8%AF%8A-%E6%9D%A8%E5%A5%BD%E6%84%8F.mp4',
  },
  {
    id: 'ph-145', title: '胎儿心脏连接关系异常的产前诊断思路', sub: '2020.12.23 · 百家讲坛 · 1 小时 9 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E8%83%8E%E5%84%BF%E5%BF%83%E8%84%8F%E8%BF%9E%E6%8E%A5%E5%85%B3%E7%B3%BB%E5%BC%82%E5%B8%B8%E7%9A%84%E4%BA%A7%E5%89%8D%E8%AF%8A%E6%96%AD%E6%80%9D%E8%B7%AF.mp4',
  },
  {
    id: 'ph-146', title: '室间隔缺损的分型诊断与术后评估', sub: '2024.10.30 · 百家讲坛 · 1 小时 7 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/10%E6%9C%8830%E6%97%A5-%E8%8B%9F%E4%B8%AD%E5%B1%B1-%E5%AE%A4%E9%97%B4%E9%9A%94%E7%BC%BA%E6%8D%9F%E7%9A%84%E5%88%86%E5%9E%8B%E8%AF%8A%E6%96%AD%E4%B8%8E%E6%9C%AF%E5%90%8E%E8%AF%84%E4%BC%B0.mp4',
  },
  {
    id: 'ph-147', title: '心脏和大血管3D打印——超人读心', sub: '2020.06.27 · 百家讲坛 · 1 小时 2 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E5%BF%83%E8%84%8F%E5%92%8C%E5%A4%A7%E8%A1%80%E7%AE%A13D%E6%89%93%E5%8D%B0%E2%80%94%E2%80%94%E8%B6%85%E4%BA%BA%E8%AF%BB%E5%BF%83.mp4',
  },
  {
    id: 'ph-148', title: '先心病诊断思路', sub: '2018.07.25 · 百家讲坛 · 1 小时 0 分',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E5%85%88%E5%BF%83%E7%97%85%E8%AF%8A%E6%96%AD%E6%80%9D%E8%B7%AF.mp4',
  },
  {
    id: 'ph-149', title: '肺静脉异位引流分型及超声诊断技巧（小儿及胎儿）', sub: '2021.09.22 · 百家讲坛 · 54 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E8%82%BA%E9%9D%99%E8%84%89%E5%BC%82%E4%BD%8D%E5%BC%95%E6%B5%81%E5%88%86%E5%9E%8B%E5%8F%8A%E8%B6%85%E5%A3%B0%E8%AF%8A%E6%96%AD%E6%8A%80%E5%B7%A7%EF%BC%88%E5%B0%8F%E5%84%BF%E5%8F%8A%E8%83%8E%E5%84%BF%EF%BC%89.mp4',
  },
  {
    id: 'ph-151', title: '超声心动图在妊娠期心血管疾病中的应用思考', sub: '2023.02.22 · 百家讲坛 · 47 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E5%9C%A8%E5%A6%8A%E5%A8%A0%E6%9C%9F%E5%BF%83%E8%A1%80%E7%AE%A1%E7%96%BE%E7%97%85%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8%E6%80%9D%E8%80%83.mp4',
  },
  {
    id: 'ph-152', title: '改良乏氏动作在cTTE规范检测PFO的应用', sub: '2022.10.26 · 百家讲坛 · 47 分钟',
    url: 'https://philips-idp.oss-cn-shanghai.aliyuncs.com/live_broadcast/%E8%B6%85%E5%A3%B0/%E7%99%BE%E5%AE%B6%E8%AE%B2%E5%9D%9B/%E6%94%B9%E8%89%AF%E4%B9%8F%E6%B0%8F%E5%8A%A8%E4%BD%9C%E5%9C%A8cTTE%E8%A7%84%E8%8C%83%E6%A3%80%E6%B5%8BPFO%E7%9A%84%E5%BA%94%E7%94%A8.mp4',
  },
];


/**
 * 第三章 25 段切面视频。作为「实用超声规范化检查与操作」专辑的子条目：
 * 只在专辑页展开，不进目录 setData（体积大、目录页用不到）。
 */
const BOOK_CH3_VIDEOS = [
          { id: 'bv-3-1-8', title: '胸骨旁长轴系列切面', sub: '动图 3-1-8 · 常规切面', url: BV_BASE + '3-1-8.mp4' },
          { id: 'bv-3-1-16', title: '左心室短轴系列切面', sub: '动图 3-1-16 · 常规切面', url: BV_BASE + '3-1-16.mp4' },
          { id: 'bv-3-1-24', title: '心尖系列切面', sub: '动图 3-1-24 · 常规切面', url: BV_BASE + '3-1-24.mp4' },
          { id: 'bv-3-1-28', title: '剑下系列切面', sub: '动图 3-1-28 · 常规切面', url: BV_BASE + '3-1-28.mp4' },
          { id: 'bv-3-1-31', title: '胸骨上窝系列切面', sub: '动图 3-1-31 · 常规切面', url: BV_BASE + '3-1-31.mp4' },
          { id: 'bv-3-1-35', title: 'M 型超声心动图', sub: '动图 3-1-35 · 常规切面', url: BV_BASE + '3-1-35.mp4' },
          { id: 'bv-3-1-41', title: '二尖瓣口彩色多普勒', sub: '动图 3-1-41 · 瓣口血流', url: BV_BASE + '3-1-41.mp4' },
          { id: 'bv-3-1-43', title: '三尖瓣口血流', sub: '动图 3-1-43 · 瓣口血流', url: BV_BASE + '3-1-43.mp4' },
          { id: 'bv-3-1-45', title: '主动脉瓣口血流', sub: '动图 3-1-45 · 瓣口血流', url: BV_BASE + '3-1-45.mp4' },
          { id: 'bv-3-1-47', title: '肺动脉瓣口彩色多普勒', sub: '动图 3-1-47 · 瓣口血流', url: BV_BASE + '3-1-47.mp4' },
          { id: 'bv-3-1-48', title: '心尖四腔心切面组织多普勒', sub: '动图 3-1-48 · 组织多普勒', url: BV_BASE + '3-1-48.mp4' },
          { id: 'bv-3-1-66a', title: '房间隔缺损 A：胸骨旁四腔心', sub: '动图 3-1-66A · 先心病', url: BV_BASE + '3-1-66A.mp4' },
          { id: 'bv-3-1-66b', title: '房间隔缺损 B：胸骨旁四腔心', sub: '动图 3-1-66B · 先心病', url: BV_BASE + '3-1-66B.mp4' },
          { id: 'bv-3-1-68a', title: '典型病例：风湿性心脏病（一）', sub: '动图 3-1-68A · 典型病例', url: BV_BASE + '3-1-68A.mp4' },
          { id: 'bv-3-1-68b', title: '典型病例：风湿性心脏病（二）', sub: '动图 3-1-68B · 典型病例', url: BV_BASE + '3-1-68B.mp4' },
          { id: 'bv-3-1-68c', title: '典型病例：风湿性心脏病（三）', sub: '动图 3-1-68C · 典型病例', url: BV_BASE + '3-1-68C.mp4' },
          { id: 'bv-3-1-68d', title: '典型病例：风湿性心脏病（四）', sub: '动图 3-1-68D · 典型病例', url: BV_BASE + '3-1-68D.mp4' },
          { id: 'bv-3-1-70a', title: '典型病例：冠心病（一）', sub: '动图 3-1-70A · 典型病例', url: BV_BASE + '3-1-70A.mp4' },
          { id: 'bv-3-1-70b', title: '典型病例：冠心病（二）', sub: '动图 3-1-70B · 典型病例', url: BV_BASE + '3-1-70B.mp4' },
          { id: 'bv-3-1-70c', title: '典型病例：冠心病（三）', sub: '动图 3-1-70C · 典型病例', url: BV_BASE + '3-1-70C.mp4' },
          { id: 'bv-3-1-70d', title: '典型病例：冠心病（四）', sub: '动图 3-1-70D · 典型病例', url: BV_BASE + '3-1-70D.mp4' },
          { id: 'bv-3-1-72a', title: '典型病例：致心律失常性右室心肌病（一）', sub: '动图 3-1-72A · 典型病例', url: BV_BASE + '3-1-72A.mp4' },
          { id: 'bv-3-1-72b', title: '典型病例：致心律失常性右室心肌病（二）', sub: '动图 3-1-72B · 典型病例', url: BV_BASE + '3-1-72B.mp4' },
          { id: 'bv-3-1-72c', title: '典型病例：致心律失常性右室心肌病（三）', sub: '动图 3-1-72C · 典型病例', url: BV_BASE + '3-1-72C.mp4' },
          { id: 'bv-3-1-72d', title: '典型病例：致心律失常性右室心肌病（四）', sub: '动图 3-1-72D · 典型病例', url: BV_BASE + '3-1-72D.mp4' },
];

/**
 * 《心脏超声术语及标准切面》上下篇 —— GE 心课堂「心脏超声基础规范学习班」学习笔记，
 * 2021-07-25 发布于微信公众号「GE超声」，共 17 段演示（上篇 7 段讲术语与手法，下篇 10 段逐个过标准切面）。
 *
 * ★ 为什么视频不在这里直接引用公众号原文：
 *   mpvideo.qpic.cn 的直链带 auth_info / auth_key 签名，HTML 里那条地址在页面加载后很快就 403，
 *   去掉签名参数同样 403；单视频页（readtemplate?t=pages/video_player_tmpl&vid=…）在普通浏览器里是白屏，
 *   只在微信客户端内工作。唯一可行的取法是用浏览器加载文章、由微信现场签发新链接后立刻下载。
 *   原片 1080p 共 420 MB，转 720p 后约 101 MB，托管在独立仓库 echo-ref-media 的 GitHub Pages，
 *   不占本仓库体积（本仓库 35 MB 的底线不动）。
 */
const KT_VID_BASE = 'https://heiqingyu.github.io/echo-ref-media/videos/';

const KT_VIDEOS = [
  { id: 'kt-01', title: '探头标记', sub: '上篇 1/7 · 方向标记与屏幕方位', url: KT_VID_BASE + 'kt-01-mark.mp4' },
  { id: 'kt-02', title: '常用声窗', sub: '上篇 2/7 · 胸骨旁 / 心尖 / 剑突下 / 胸骨上窝', url: KT_VID_BASE + 'kt-02-windows.mp4' },
  { id: 'kt-03', title: '探头手法总览与扫查 Sweep', sub: '上篇 3/7 · 六种基本手法 · 连续扫查剪辑', url: KT_VID_BASE + 'kt-03-maneuvers.mp4' },
  { id: 'kt-04', title: '探头手法：旋转 Rotate', sub: '上篇 4/7 · 指示标记转到新方位', url: KT_VID_BASE + 'kt-04-rotate.mp4' },
  { id: 'kt-05', title: '探头手法：滑行 Slide', sub: '上篇 5/7 · 在体表移到新位置', url: KT_VID_BASE + 'kt-05-slide.mp4' },
  { id: 'kt-06', title: '探头手法：摆动 Rock', sub: '上篇 6/7 · 同一切面内远离 / 靠近', url: KT_VID_BASE + 'kt-06-rock.mp4' },
  { id: 'kt-07', title: '探头手法：成角 Angle', sub: '上篇 7/7 · 声束指向目标结构', url: KT_VID_BASE + 'kt-07-angle.mp4' },
  { id: 'kt-08', title: '胸骨旁左室长轴 PLAX', sub: '下篇 1/10 · 含 LVOT / 主动脉瓣放大', url: KT_VID_BASE + 'kt-08-plax.mp4' },
  { id: 'kt-09', title: '右室流出道 RVOT', sub: '下篇 2/10 · PV · 主肺动脉 · 右室流入道', url: KT_VID_BASE + 'kt-09-rvot.mp4' },
  { id: 'kt-10', title: '胸骨旁短轴 PSAX 系列', sub: '下篇 3/10 · 大血管 → 二尖瓣 → 乳头肌 → 心尖', url: KT_VID_BASE + 'kt-10-psax.mp4' },
  { id: 'kt-11', title: '心尖切面：窗口定位', sub: '下篇 4/10 · 心尖位置与四腔心入路', url: KT_VID_BASE + 'kt-11-apical.mp4' },
  { id: 'kt-12', title: '关注右室的心尖四腔心 RV-focused A4C', sub: '下篇 5/10 · TAPSE 与右室应变测量切面', url: KT_VID_BASE + 'kt-12-rv-a4c.mp4' },
  { id: 'kt-13', title: '心尖五腔心与冠状静脉窦', sub: '下篇 6/10 · 5C View · CS View', url: KT_VID_BASE + 'kt-13-5c-cs.mp4' },
  { id: 'kt-14', title: '心尖二腔心 / 长轴 A2C · A3C', sub: '下篇 7/10 · 全扇形 + 聚焦双剪辑', url: KT_VID_BASE + 'kt-14-a2c.mp4' },
  { id: 'kt-15', title: '关注肺静脉的心尖切面', sub: '下篇 8/10 · 肺静脉入左房 · 房颤评估', url: KT_VID_BASE + 'kt-15-pulvns.mp4' },
  { id: 'kt-16', title: '剑突下切面 Subcostal', sub: '下篇 9/10 · IVC · 肝静脉 · 腹部大血管', url: KT_VID_BASE + 'kt-16-subcostal.mp4' },
  { id: 'kt-17', title: '胸骨上窝主动脉弓长轴 SSN', sub: '下篇 10/10 · 弓部三支 · 右肺动脉', url: KT_VID_BASE + 'kt-17-ssn.mp4' },
];

const LINK_SECTIONS = [
  {
    id: 'views',
    title: '切面学习（视频）',
    items: [
      {
        id: 'bookvid',
        title: '实用超声规范化检查与操作',
        sub: '王辉、王小丛 主编 · 第 3 章心血管系统 25 段 · 点开选切面',
        album: true,
        // ★ v1.15.8：专辑条目也挂 source——这本就是 R37 的配套动图，此前只在 note 里写了书名，
        //   REFS 里 R37 因此成了「无人引用」的孤儿（2026-11-06 审计发现）
        source: ['R37'],
        note: '王辉、王小丛 主编 · 科学技术文献出版社 2021 年 9 月北京 · ISBN 978-7-5189-8028-4 · 参考文献 R37',
        children: BOOK_CH3_VIDEOS,
      },
      {
        id: 'ktvid',
        title: '心脏超声术语及标准切面',
        sub: '上下篇 17 段 · 探头手法 + 逐个标准切面',
        album: true,
        note: 'GE 心课堂「心脏超声基础规范学习班」学习笔记（上 / 下篇）· 微信公众号「GE超声」· 720p 转存。'
          + '★ 这批视频托管在国外静态站点（GitHub Pages），国内打开与拖动都偏慢，点开请先等几秒缓冲；'
          + '实在卡就点下方「公众号原文」到微信里看。',
        // ★ v1.8.5：补公众号原文出处（视频为转存，原文才是第一手）
        links: [
          { n: '公众号原文 · 上篇', url: 'https://mp.weixin.qq.com/s/majT0NAFGIFEd1SAB5TGUw' },
          { n: '公众号原文 · 下篇', url: 'https://mp.weixin.qq.com/s/DLmT3C8YW9Obb97KvVGmBg' },
        ],
        children: KT_VIDEOS,
      },
      {
        id: 'philips',
        title: '心脏超声讲座',
        sub: '150 段 / 65 小时 · 十个心脏类目 · 按 8 个专题分组 · 可搜索',
        album: true,
        note: '飞利浦超声云课堂公开回放，按 8 个专题排列：探头维护 / 标准切面 / 定量操作 / 三维与多平面 / '
          + '瓣膜病与结构性心脏病介入 / 心功能定量 / 心肌病与造影 / 先心与胎儿。地址是飞利浦 OSS 原片直链'
          + '（1080p 热链，非转存）；标注「HLS 分片」的 3 条需在浏览器打开官方页。',
        links: [
          {
            n: '课程总目录（原站）',
            url: 'https://app.ma.scrmtech.com/meetings/MeetingPc/index?category_id=30021&pf_uid=37564_2395&pf_type=3',
          },
        ],
        children: PHILIPS_CLASS,
      },
      {
        id: 'tee-sv',
        title: 'TEE 标准 20 视图（中文）',
        sub: 'ASE/SCA 标准切面 · 带过场视频',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/assets/applications/standardViewsHTML5/TEE-HTML5-SV-CH/',
      },
      {
        id: 'tee-av',
        title: 'TEE 备选 19 视图',
        sub: '非常用但实用的 2D 切面',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/assets/applications/alternateViewsHTML5/TEE-HTML5-AV/',
      },
      {
        id: 'tee-cd',
        title: 'TEE 彩色多普勒对比',
        sub: '哪些结构该用彩色看 · 对比演示',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/assets/applications/colourCompareHTML5/TEE-HTML5-CD/',
      },
      {
        id: 'tte-sv',
        title: 'TTE 经胸标准切面',
        sub: '胸骨旁 / 心尖 / 剑下 · 直达交互应用',
        url: 'https://pie.med.utoronto.ca/TTE/TTE_content/assets/applications/TTE-HTML5-SV/index.html',
      },
      {
        id: 'tee-cheat',
        title: 'TEE 标准视图速查表',
        sub: '探头角度 · 平面 · 对应结构 · 可打印 · 需 360 极速浏览器兼容模式打开',
        url: 'https://pie.med.utoronto.ca/TEE/TEE_content/assets/applications/TEE-cheat-sheet/index.htm',
      },
    ],
  },

  {
    id: 'sim',
    title: 'TEE 切面在线演示',
    items: [
      {
        id: 'sim-toronto',
        title: '多伦多 TEE 交互演示',
        sub: '标准切面全流程交互演示',
        url: 'https://pie.med.utoronto.ca/tee/TEE_content/assets/applications/teeSimulation/index.html',
      },
      {
        id: 'sim-ct2tee',
        title: 'CT2TEE 在线演示',
        sub: 'CT 重建驱动 · 旋转 / 俯仰 / 成角操控',
        url: 'https://www.ct2tee.agh.edu.pl/',
      },
      {
        id: 'sim-atlas',
        title: 'TEE 切面交互图谱',
        sub: '交互式切面图谱（英文）· 三维操作演示 · 分段标注仅供参考',
        url: 'https://tee-simulator.anesthbeta.com/atlas?lang=en',
      },
    ],
  },

];

/** 全部引用文献（公式集目录页底部统一列出） */
const REFS = [
  {
    id: 'R1',
    zh: '中国成年人超声心动图检查测量指南',
    en: '中华医学会超声医学分会超声心动图学组. 中国成年人超声心动图检查测量指南.',
    where: '中华超声影像学杂志, 2016, 25(8): 645–666',
    dl: [
      { t: '全文阅读页（不可下载）', u: 'https://rs.yiigle.com/cmaid/908663' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zhcsyx201608001' },
    ],

    use: '成人径线 / 面积 / 容积参考范围、瓣膜环与大动脉内径；EMINCA 中国人群正常值来源',
  },
  {
    id: 'R2',
    zh: '成人心腔超声心动图定量指南（2015）',
    en: 'Lang RM, Bierig SM, Devereux RB, et al. Recommendations for Cardiac Chamber Quantification by Echocardiography in Adults: An Update from the American Society of Echocardiography and the European Association of Cardiovascular Imaging.',
    where: 'J Am Soc Echocardiogr, 2015, 28(1): 1–39.e14',
    use: 'EF、LVEDVi、LVMI、LAVi 的测量规范与分级',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/2015_ChamberQuantificationREV.pdf' },
      { t: '中文 PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/Chamber-Quantification-2015-Chinese.pdf' },
    ],
  },
  {
    id: 'R3',
    zh: '超声二维斑点追踪应变成像标准化共识（EACVI/ASE/Industry 2015）',
    en: 'Voigt JU, Pedrizzetti G, Lysyansky P, et al. Definitions for a Common Standard for 2D Speckle Tracking Echocardiography: Consensus Document of the EACVI/ASE/Industry Task Force to Standardize Deformation Imaging.',
    where: 'Eur Heart J Cardiovasc Imaging, 2015, 16(1): 1–11',
    dl: [
      { t: '官网 PDF', u: 'https://academic.oup.com/ehjcimaging/article-pdf/16/1/1/7140604/jeu184.pdf' },
    ],

    use: '应变采集、追踪与报告规范',
  },
  {
    id: 'R4',
    zh: '左心房应变正常参考值（EACVI NORRE 研究，2018）',
    en: 'Sugimoto T, Robinet S, Dulgheru R, et al. Echocardiographic Reference Ranges for Normal Left Atrial Function Parameters: Results from the EACVI NORRE Study.',
    where: 'Eur Heart J Cardiovasc Imaging, 2018, 19(6): 630–638',
    dl: [
      { t: '官网 PDF', u: 'https://academic.oup.com/ehjcimaging/article-pdf/19/6/630/24834097/jey018.pdf' },
    ],

    use: 'LASr / LASa / LASc 的阈值与临床意义',
  },
  {
    id: 'R5',
    zh: '成人右心超声心动图评估指南（ASE 2025）',
    en: 'Mukherjee M, Rudski LG, Addetia K, et al. Guidelines for the Echocardiographic Assessment of the Right Heart in Adults and Special Considerations in Pulmonary Hypertension: Recommendations from the American Society of Echocardiography. J Am Soc Echocardiogr, 2025, 38(3): 141–186.',
    where: 'J Am Soc Echocardiogr, 2025, 38(3): 141–186. DOI: 10.1016/j.echo.2025.01.006',
    use: 'TAPSE、FAC、RV S′、右房面积等右心定量；RAP 四档（0–4 / 5–9 / 10–14 / ≥15）与 IVC 判读；肺高压右心评估',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2026/08/ASE-Right-Heart-Guidelines-May-2025.pdf' },
      { t: 'DOI', u: 'https://doi.org/10.1016/j.echo.2025.01.006' },
    ],
  },
  {
    id: 'R6',
    zh: '心脏生理性起搏与 CRT 指南（HRS/APHRS/LAHRS 2023）',
    en: 'Chung MK, Patton KK, Lau CP, et al. 2023 HRS/APHRS/LAHRS Guideline on Cardiac Physiologic Pacing for the Avoidance and Mitigation of Heart Failure.',
    where: 'Heart Rhythm, 2023, 20(9): e17–e91',
    dl: [
      { t: 'PMC 全文', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11062890/' },
    ],

    use: 'CRT 适应证分级（LVEF / QRS 宽度 / 形态）、超声不同步指标（SPWMD、纵向应变延迟）的现状与疗效随访',
  },
  {
    id: 'R7',
    zh: '成人经胸超声心动图标准化报告建议（ASE 2002）',
    en: 'Gardin JM, Adams DB, Douglas PS, et al. Recommendations for a Standardized Report for Adult Transthoracic Echocardiography: A Report from the American Society of Echocardiography.',
    where: 'J Am Soc Echocardiogr, 2002, 15(3): 275–290（现行报告规范见 R41，TTE 操作见 R9）',
    dl: [
      { t: '官网 PDF', u: 'https://www.onlinejase.com/article/S0894731702594712/pdf' },
    ],

    use: '报告结构与必填条目的历史依据、测量时相与切面命名的统一写法',
  },
  {
    id: 'R8',
    zh: '儿童心脏 Z 值（PHN 正常值数据库）',
    en: 'Lopez L, Colan S, Stylianou M, et al. Relationship of Echocardiographic Z Scores Adjusted for Body Surface Area to Age, Sex, Race, and Ethnicity: The Pediatric Heart Network Normal Echocardiogram Database.',
    where: 'Circ Cardiovasc Imaging, 2017, 10(11): e006979',
    dl: [
      { t: '免费页面', u: 'https://www.pediatricheartnetwork.org/echo-z-scores/' },
      { t: 'PMC 全文', u: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5812349/' },
    ],
    use: '儿童心脏尺寸按体表面积（Haycock 公式）标准化后的 Z 值判读（见「儿童 Z 值」页）',
  },
  {
    id: 'R9',
    zh: '成人完整经胸超声心动图操作指南（ASE 2019）',
    en: 'Mitchell C, Rahko PS, Blauwet LAB, et al. Guidelines for Performing a Comprehensive Transthoracic Echocardiographic Examination in Adults: Recommendations from the American Society of Echocardiography.',
    where: 'J Am Soc Echocardiogr, 2019, 32(1): 1–64（ASE 官网提供官方中文翻译版）',
    use: '经胸标准切面命名、采集顺序与测量规范（本条附官方中英文 PDF 直链，原「切面指南」入口已并入此）',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/2019_Comprehensive-TTE.pdf' },
      { t: '中文 PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/Adult-CompTTE_Chinese.pdf' },
    ],
  },
  {
    id: 'R10',
    zh: '成人经食管超声心动图完整检查指南（ASE/SCA）',
    en: 'Hahn RT, Abraham T, Adams MS, et al. Guidelines for Performing a Comprehensive Transesophageal Echocardiographic Examination: Recommendations from the American Society of Echocardiography and the Society of Cardiovascular Anesthesiologists.',
    where: 'J Am Soc Echocardiogr, 2013, 26(9): 921–964（含 28 个标准切面）',
    use: 'TEE 28 标准切面命名与采集规范（本条附官方 PDF 直链，原「切面指南」入口已并入此）',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2014/05/2013_Performing-Comprehensive-TEE.pdf' },
    ],
  },
  {
    id: 'R11',
    zh: '肺动脉高压诊断与治疗指南（ESC/ERS 2022）',
    en: 'Humbert M, Kovacs G, Hoeper MM, et al. 2022 ESC/ERS Guidelines for the Diagnosis and Treatment of Pulmonary Hypertension.',
    where: 'Eur Respir J, 2023, 61(1): 2200879',
    use: 'PH 血流动力学分型、超声概率与右心导管定义',
    dl: [
      { t: '免费页面', u: 'https://publications.ersnet.org/content/erj/61/1/2200879' },
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1183/13993003.00879-2022' },
    ],
  },
  {
    id: 'R12',
    zh: '成人右心超声评估指南（ASE 2010）',
    en: 'Rudski LG, Lai WW, Afilalo J, et al. Guidelines for the Echocardiographic Assessment of the Right Heart in Adults: A Report from the American Society of Echocardiography.',
    where: 'J Am Soc Echocardiogr, 2010, 23(7): 685–713',
    use: '右室功能、右房压与 PH 超声评估的金标准参考',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/05/Archive-2010-Echo-Assessment-of-Right-Heart-in-Adults.pdf' },
      { t: '中文 PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/05/Archive-2010-Right-heart-guidelines_Chinese.pdf' },
    ],
  },
  {
    id: 'R13',
    zh: '心包疾病超声心动图评估指南（2013）',
    en: 'Klein AL, Abbara S, Agler DA, et al. American Society of Echocardiography Clinical Recommendations for Multimodality Cardiovascular Imaging of Patients with Pericardial Disease.',
    where: 'J Am Soc Echocardiogr, 2013, 26(9): 965–1012.e15',
    use: '心包积液半定量、心脏压塞与缩窄性心包炎征象',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/2013_Multimodality-CV-Imaging-for-Pericardial-Disease.pdf' },
      { t: '中文 PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/Pericardial-Disease-Multimodality-ASE-guideline_Chinese.pdf' },
    ],
  },
  {
    id: 'R14',
    zh: '左心室舒张功能评估指南（2016）',
    en: 'Nagueh SF, Smiseth OA, Appleton CP, et al. Recommendations for the Evaluation of Left Ventricular Diastolic Function by Echocardiography: An Update from the American Society of Echocardiography and the European Association of Cardiovascular Imaging.',
    where: 'J Am Soc Echocardiogr, 2016, 29(4): 277–314',
    use: '舒张功能分级四步法与灰区处理（ASE 2025 已发布更新，见 R39）',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/07/Eval-of-Left-Ventricular-Diastolic-Function-by-Echo-superseded.pdf' },
    ],
  },
  {
    id: 'R15',
    zh: '人工心脏瓣膜功能评估指南（2024 版）',
    en: 'Zoghbi WA, Jone PN, Chamsi-Pasha MA, et al. Guidelines for the Evaluation of Prosthetic Valves by Echocardiography.',
    where: 'J Am Soc Echocardiogr, 2024, 37(1): 2–63（替代 2017 版）',
    use: '人工瓣膜正常压差、PPM 与瓣周漏判读',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/PIIS0894731723005333.pdf' },
    ],
  },
  {
    id: 'R16',
    zh: 'TAPSE/PASP 比值：右室-肺动脉耦联指标',
    en: 'Guazzi M, Bandera F, Pelissero G, et al. Tricuspid Annular Plane Systolic Excursion and Pulmonary Arterial Systolic Pressure Relationship in Heart Failure: An Index of Right Ventricular Contractile Function and Prognosis.',
    where: 'Am J Physiol Heart Circ Physiol, 2013, 305(9): H1373–H1381',
    dl: [
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1152/ajpheart.00157.2013' },
    ],

    use: '右室-肺动脉耦联比值 0.55 / 0.36 切点与预后意义',
  },
  {
    id: 'R17',
    zh: '感染性心内膜炎管理指南（2023 ESC）',
    en: 'Delgado V, Ajmone Marsan N, de Waha S, et al. 2023 ESC Guidelines for the Management of Endocarditis.',
    where: 'Eur Heart J, 2023, 44(39): 3948–4042',
    use: '赘生物大小与栓塞风险、TEE 指征、重复超声时机',
    dl: [
      { t: '官网 PDF', u: 'https://academic.oup.com/eurheartj/advance-article-pdf/doi/10.1093/eurheartj/ehad193/51716381/ehad193.pdf' },
    ],
  },
  {
    id: 'R18',
    zh: '肥厚型心肌病诊断与治疗指南（2020 AHA/ACC）',
    en: 'Ommen SR, Mital S, Burke MA, et al. 2020 AHA/ACC Guideline for the Diagnosis and Treatment of Patients with Hypertrophic Cardiomyopathy.',
    where: 'Circulation, 2020, 142(25): e558–e631',
    use: '最大壁厚诊断阈值、LVOT 梗阻分级与猝死风险因素',
    dl: [
      { t: '官网 PDF', u: 'https://www.ahajournals.org/doi/pdf/10.1161/CIR.0000000000000937' },
    ],
  },
  {
    id: 'R19',
    zh: '心脏淀粉样变诊断与治疗立场声明（2021 ESC）',
    en: 'Garcia-Pavia P, Rapezzi C, Adler Y, et al. Diagnosis and Treatment of Cardiac Amyloidosis: A Position Statement of the ESC Working Group on Myocardial and Pericardial Diseases.',
    where: 'Eur Heart J, 2021, 42(16): 1554–1568',
    use: '心肌「苹果核」应变、心尖保留比值与确诊路径',
    dl: [
      { t: 'PMC 全文', u: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8060056' },
    ],
  },
  {
    id: 'R20',
    zh: '瓣膜性心脏病管理指南（2020 ACC/AHA）',
    en: 'Otto CM, Nishimura RA, Bonow RO, et al. 2020 ACC/AHA Guideline for the Management of Patients with Valvular Heart Disease.',
    where: 'Circulation, 2021, 143(5): e72–e227',
    use: '低流量低压差 AS 的负荷试验、钙化评分与手术时机',
    dl: [
      { t: '官网 PDF', u: 'https://www.ahajournals.org/doi/pdf/10.1161/CIR.0000000000000923' },
      // ★ 2026-11-06：中文解读（《华西医学》2021 年刊出，全文可读），链接实测 200
      { t: '文章页（中文解读）', u: 'https://www.gensurg.cn/article/10.7507/1002-0179.202108248' },
    ],
  },
  {
    id: 'R21',
    zh: '心包疾病诊断与管理指南（2015 ESC）',
    en: 'Adler Y, Charron P, Imazio M, et al. 2015 ESC Guidelines for the Diagnosis and Management of Pericardial Diseases.',
    where: 'Eur Heart J, 2015, 36(42): 2921–2964',
    use: '缩窄性心包炎的呼吸变异、瓣环反转与鉴别路径',
    dl: [
      { t: 'PMC 全文', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7539677/' },
      { t: '官网 PDF', u: 'https://academic.oup.com/eurheartj/article-pdf/36/42/2921/33342779/ehv318.pdf' },
    ],
  },
  {
    id: 'R22',
    zh: '三尖瓣反流学术研究联盟（TVARC）定义与分级',
    en: 'Hahn RT, Lawlor MK, Davidson CJ, et al. Tricuspid Valve Academic Research Consortium Definitions for Tricuspid Regurgitation and Trial Endpoints.',
    where: 'Eur Heart J, 2023, 44(43): 4508–4532',
    dl: [
      { t: 'PMC 全文', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10645050/' },
    ],

    use: 'TR 五级严重度、机制分型与经导管介入终点定义',
  },
  {
    id: 'R23',
    zh: '瓣膜性心脏病管理指南（2021 ESC/EACTS）',
    en: 'Vahanian A, Beyersdorf F, Praz F, et al. 2021 ESC/EACTS Guidelines for the Management of Valvular Heart Disease.',
    where: 'Eur Heart J, 2022, 43(7): 561–632',
    use: '二尖瓣 TEER 适应证、解剖适配与介入时机',
    dl: [
      { t: 'PMC 全文', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9725093/' },
      { t: '官网 PDF', u: 'https://academic.oup.com/eurheartj/advance-article-pdf/doi/10.1093/eurheartj/ehab395/40340593/ehab395.pdf' },
      // ★ 2026-11-06：中文解读（张倩 / 王墨扬 / 吴永健，中华心血管病杂志 2021 年 12 期），链接实测 200
      { t: '文章页（中文解读）', u: 'https://cmab.yiigle.com/uploads/guide_html/4194.html' },
    ],
  },
  {
    id: 'R24',
    zh: '左房与右心应变成像标准化（2018 ASE/EACVI）',
    en: 'Badano LP, Kolias TJ, Muraru D, et al. Standardization of Left Atrial, Right Ventricular, and Right Atrial Deformation Imaging Using Two-Dimensional Speckle Tracking Echocardiography: A Consensus Document of the EACVI/ASE/Industry Task Force.',
    where: 'Eur Heart J Cardiovasc Imaging, 2018, 19(6): 591–600',
    use: '左房应变三时相（LASr / LAScd / LASct）的正常值与测量规范',
    dl: [
      { t: '官网 PDF', u: 'https://academic.oup.com/ehjcimaging/article-pdf/19/6/591/24834126/jey042.pdf' },
    ],
  },
  {
    id: 'R25',
    zh: 'HFpEF 诊断算法 HFA-PEFF（2019 ESC HFA）',
    en: 'Pieske B, Tschöpe C, de Boer RA, et al. How to Diagnose Heart Failure with Preserved Ejection Fraction: The HFA-PEFF Diagnostic Algorithm: A Consensus Recommendation from the Heart Failure Association of the ESC.',
    where: 'Eur Heart J, 2019, 40(40): 3297–3317',
    use: '形态学 + 功能两大类计分、总分判读与负荷试验指征',
    dl: [
      { t: '官网 PDF', u: 'https://academic.oup.com/eurheartj/article-pdf/40/40/3297/30195412/ehz641.pdf' },
    ],
  },
  {
    id: 'R26',
    zh: '负荷超声心动图应用指南（2020 ASE）',
    en: 'Pellikka PA, Arruda-Olson A, Chaudhry FA, et al. Guidelines for Performance, Interpretation, and Application of Stress Echocardiography in Ischemic Heart Disease.',
    where: 'J Am Soc Echocardiogr, 2020, 33(1): 1–41.e8',
    use: '室壁运动评分、阳性标准、WMSI 与负荷方式选择',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/Stress-Echo-2020.pdf' },
      { t: '中文 PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/Guidelines-for-Performance-Interpretationand-Application-of-Stress-Echocardiography-in-Ischemic-Heart-Disease-Chinese-version.pdf' },
    ],
  },
  {
    id: 'R27',
    zh: '胸主动脉疾病多模态影像评估指南（2015 ASE）',
    en: 'Goldstein SA, Evangelista A, Abbara S, et al. Multimodality Imaging of Diseases of the Thoracic Aorta in Adults: From the American Society of Echocardiography and the European Association of Cardiovascular Imaging.',
    where: 'J Am Soc Echocardiogr, 2015, 28(2): 119–182',
    use: '主动脉根部测量位点、扩张分级、二叶式瓣与夹层征象',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/2015_Thoracic-Aorta.pdf' },
      { t: '中文 PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/MM-Imaging-in-Thoracic-Aortic-Diseases-2015_Chinese.pdf' },
    ],
  },
  {
    id: 'R28',
    zh: '急性肺栓塞诊断与管理指南（2019 ESC）',
    en: 'Konstantinides SV, Meyer G, Becattini C, et al. 2019 ESC Guidelines for the Diagnosis and Management of Acute Pulmonary Embolism Developed in Collaboration with the European Respiratory Society (ERS).',
    where: 'Eur Heart J, 2020, 41(4): 543–603',
    use: '右心功能不全的危险分层地位、McConnell 征与随访',
    dl: [
      { t: '官网 PDF', u: 'https://academic.oup.com/eurheartj/article-pdf/41/4/543/34306708/ehz405.pdf' },
    ],
  },
  {
    id: 'R29',
    zh: '肿瘤心脏病学指南（2022 ESC）',
    en: 'Lyon AR, López-Fernández T, Couch LS, et al. 2022 ESC Guidelines on Cardio-Oncology Developed in Collaboration with the EACVI, EHA, ESTRO and ESC Council of Cardio-Oncology.',
    where: 'Eur Heart J, 2022, 43(41): 4229–4361',
    use: 'CTRCD 三级分档、GLS 相对下降 15% 阈值与监测节点',
    dl: [
      { t: '文章页（中文解读）', u: 'https://cmab.yiigle.com/uploads/guide_html/4909.html' },
      { t: '官网 PDF', u: 'https://academic.oup.com/eurheartj/article-pdf/43/41/4229/51099586/ehac244.pdf' },
    ],
  },
  {
    id: 'R30',
    zh: '经导管瓣膜介入术后瓣膜反流评估指南（2019 ASE）',
    en: 'Zoghbi WA, Asch FM, Bruce C, et al. Guidelines for the Evaluation of Valvular Regurgitation after Percutaneous Valve Repair or Replacement.',
    where: 'J Am Soc Echocardiogr, 2019, 32(4): 431–475',
    use: 'TAVR 术后跨瓣压差、瓣周漏半定量与随访基线',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/Percutaneous-VR_2019.pdf' },
    ],
  },
  {
    id: 'R31',
    zh: '心尖保留比值诊断心脏淀粉样变（Phelan 等）',
    en: 'Phelan D, Collier P, Thavendiranathan P, et al. Relative Apical Sparing of Longitudinal Strain Using Two-Dimensional Speckle-Tracking Echocardiography Is Both Sensitive and Specific for the Diagnosis of Cardiac Amyloidosis.',
    where: 'Heart, 2012, 98(19): 1442–1448',
    dl: [
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1136/heartjnl-2012-302353' },
    ],

    use: '心尖保留比值（RAR）的算法与 0.94 阈值',
  },
  {
    id: 'R32',
    zh: '成人先天性心脏病管理指南（2018 AHA/ACC）',
    en: 'Stout KK, Daniels CJ, Aboulhosn JA, et al. 2018 AHA/ACC Guideline for the Management of Adults with Congenital Heart Disease.',
    where: 'Circulation, 2019, 139(14): e698–e800',
    use: 'ASD / VSD / PDA 的分型、干预指征与随访节点',
    dl: [
      { t: '官网 PDF', u: 'https://www.ahajournals.org/doi/pdf/10.1161/CIR.0000000000000603' },
    ],
  },
  {
    id: 'R33',
    zh: '成人先天性心脏病管理指南（2020 ESC）',
    en: 'Baumgartner H, De Backer J, Babu-Narayan SV, et al. 2020 ESC Guidelines for the Management of Adult Congenital Heart Disease.',
    where: 'Eur Heart J, 2021, 42(6): 563–645',
    use: '分流性肺高压的可手术性评估、艾森曼格综合征管理',
    dl: [
      { t: '官网 PDF', u: 'https://academic.oup.com/eurheartj/article-pdf/42/6/563/39353654/ehaa554.pdf' },
    ],
  },
  {
    id: 'R34',
    zh: '左心室辅助装置患者的超声心动图管理建议（2015 ASE）',
    en: 'Stainback RF, Estep JD, Agler DA, et al. Echocardiography in the Management of Patients with Left Ventricular Assist Devices: Recommendations from the American Society of Echocardiography.',
    where: 'J Am Soc Echocardiogr, 2015, 28(8): 853–909',
    use: '入血道 / 出血道评估、泵速优化与抽吸事件的超声识别',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/2015_EchoLVAD.pdf' },
      { t: '中文 PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/ASE-LVAD-Guideline_Chinese.pdf' },
    ],
  },
  {
    id: 'R35',
    zh: '法洛四联症根治术后的 CMR 评估与肺动脉瓣置换决策',
    en: 'Geva T. Repaired Tetralogy of Fallot: The Roles of Cardiovascular Magnetic Resonance in Evaluating Pathophysiology and for Pulmonary Valve Replacement Decision Support.',
    where: 'J Cardiovasc Magn Reson, 2011, 13(1): 9',
    use: 'RVEDVi >160 / RVESVi >80 mL/m² 等 PVR 容量阈值的来源',
    dl: [
      { t: '免费全文 PDF', u: 'https://jcmr-online.biomedcentral.com/counter/pdf/10.1186/1532-429X-13-9.pdf' },
    ],
  },
  {
    id: 'R36',
    zh: '多巴酚丁胺负荷评估肺动脉高压患者的右室收缩储备',
    en: 'Sharma T, Lau EM, Choudhary P, et al. Dobutamine Stress for Evaluation of Right Ventricular Reserve in Pulmonary Arterial Hypertension.',
    where: 'Eur Respir J, 2015, 45(3): 700–708',
    use: '低剂量多巴酚丁胺下 RVFWS 变化与右室收缩储备的判读标准',
    dl: [
      { t: '免费页面', u: 'https://publications.ersnet.org/content/erj/45/3/700' },
    ],
  },
  {
    id: 'R37',
    zh: '实用超声规范化检查与操作',
    en: '王辉, 王小丛 主编. 实用超声规范化检查与操作.',
    where: '北京: 科学技术文献出版社, 2021. ISBN 978-7-5189-8028-4',
    use: '第三章心血管系统配套动图（切面扫查 / 瓣口血流 / 典型病例）',
  },
  {
    id: 'R38',
    zh: '经食道超声结构性心脏病介入筛查标准（ASE 2021）',
    en: 'Hahn RT, Saric M, Faletra FF, et al. Recommended Standards for the Performance of Transesophageal Echocardiographic Screening for Structural Heart Intervention.',
    where: 'J Am Soc Echocardiogr, 2022, 35(1): 1–76',
    use: 'TEE 介入筛查的切面清单与评估要点（原「切面指南」入口已并入此）',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/PIIS0894731721005940.pdf' },
    ],
  },
  {
    id: 'R39',
    zh: '左室舒张功能与 HFpEF 诊断更新（ASE 2025）',
    en: 'Nagueh SF, Sanborn DY, Oh JK, et al. Recommendations for the Evaluation of Left Ventricular Diastolic Function by Echocardiography and Assessment of Left Ventricular Filling Pressures: 2025 Update from the American Society of Echocardiography.',
    where: 'J Am Soc Echocardiogr, 2025, 38(7): 537–569',
    use: '舒张功能与左房压评估的最新口径（本工具四步法仍按 2016 版组织，见 R14）',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/07/Left-Ventricular-Diastolic-Function.pdf' },
    ],
  },
  {
    id: 'R40',
    zh: '应变成像临床应用指南（ASE/EACVI 2025）',
    en: 'Thomas JD, Edvardsen T, Abraham T, et al. Clinical Applications of Strain Echocardiography: A Clinical Consensus Statement from the American Society of Echocardiography Developed in Collaboration with the European Association of Cardiovascular Imaging.',
    where: 'J Am Soc Echocardiogr, 2025, 38(11): 985–1020',
    use: 'GLS / RV 应变 / 左房应变的采集与报告规范（官网现行版）',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/11/Strain-2025-Guideline-2.pdf' },
    ],
  },
  {
    id: 'R41',
    zh: '成人超声心动图报告标准化建议（ASE 2025）',
    en: 'Taub CC, Stainback RF, Abraham T, et al. Guidelines for the Standardization of Adult Echocardiography Reporting: Recommendations from the American Society of Echocardiography.',
    where: 'J Am Soc Echocardiogr, 2025, 38(9): 735–774',
    use: '报告结构与必填项（写报告时的条目清单）',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/09/PIIS0894731725002925.pdf' },
    ],
  },
  {
    id: 'R42',
    zh: '风湿性心脏病超声评估建议（ASE 2022）',
    en: 'Pandian NG, Kim JK, Arias-Godinez JA, et al. Recommendations for the Use of Echocardiography in the Evaluation of Rheumatic Heart Disease.',
    where: 'J Am Soc Echocardiogr, 2023, 36(1): 3–28',
    use: '风湿性二尖瓣形态与狭窄分级（Wilkins 评分的风湿病因背景）',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/PIIS0894731722005211.pdf' },
    ],
  },
  {
    id: 'R43',
    zh: '主动脉瓣狭窄超声评估更新（ASE/EACVI 2017）',
    en: 'Baumgartner H, Hung J, Bermejo J, et al. Recommendations on the Echocardiographic Assessment of Aortic Valve Stenosis: A Focused Update from the European Association of Cardiovascular Imaging and the American Society of Echocardiography.',
    where: 'J Am Soc Echocardiogr, 2017, 30(4): 372–392',
    use: 'AS 压差 / AVA / DVI 的测法与低流量低压差状态识别',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/2017ValveStenosisGuideline.pdf' },
      { t: '中文 PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/Aortic-stenosis-2017-update_Chinese.pdf' },
    ],
  },
  {
    id: 'R44',
    zh: '自体瓣膜反流无创评估建议（ASE 2017）',
    en: 'Zoghbi WA, Adams D, Bonow RO, et al. Recommendations for Noninvasive Evaluation of Native Valvular Regurgitation: A Report from the American Society of Echocardiography.',
    where: 'J Am Soc Echocardiogr, 2017, 30(4): 303–371',
    use: 'AR / MR / TR 的多参数分级与 PISA / VCW 口径',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/2017VavularRegurgitationGuideline.pdf' },
    ],
  },
  {
    id: 'R45',
    zh: 'LVAD 与临时机械支持多模态影像建议（ASE 2024）',
    en: 'Estep JD, Nicoara A, Cavalcante J, et al. Recommendations for Multimodality Imaging of Patients with Left Ventricular Assist Devices and Temporary Mechanical Support: An Update from the American Society of Echocardiography.',
    where: 'J Am Soc Echocardiogr, 2024, 37(9): 820–871',
    use: '入 / 出血道、泵速优化与抽吸事件识别（替代 2015 版，见 R34）',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/PIIS0894731724003183_2024-LVAD.pdf' },
    ],
  },
  {
    id: 'R46',
    zh: '感染性心内膜炎 Duke-ISCVID 诊断标准（2023 更新）',
    en: 'Fowler VG, Durack DT, Selton-Suty C, et al. The 2023 Duke-International Society for Cardiovascular Infectious Diseases Criteria for Infective Endocarditis: Updating the Modified Duke Criteria.',
    where: 'Clin Infect Dis, 2023, 77(8): 1097–1106',
    use: 'ie 判读页的诊断标准表：超声 / 心脏 CT / PET/CT / 术中直视各自算哪一级',
    dl: [
      { t: 'PMC 全文', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10681650/pdf/ciad271.pdf' },
    ],
  },
  {
    id: 'R47',
    zh: '超声造影剂临床应用 ASE 共识声明',
    en: 'Mulvagh SL, Rakowski H, Vannan MA, et al. American Society of Echocardiography Consensus Statement on the Clinical Applications of Ultrasonic Contrast Agents in Echocardiography.',
    where: 'J Am Soc Echocardiogr, 2008, 21(11): 1179–1201',
    use: 'contrast-echo 判读页：制剂与适应证（LVO / EBD）、禁忌证、30 分钟监护与安全性数据',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/ASE-Consensus-Statement-on-Clinical-App-of-Ultrasonic-Contrast-Agents-in-Echo.pdf' },
    ],
  },
  {
    id: 'R48',
    zh: '心脏超声技师造影检查操作指南（2014 聚焦更新）',
    en: 'Porter TR, Abdelmoneim S, Belcik JT, et al. Guidelines for the Cardiac Sonographer in the Performance of Contrast Echocardiography: A Focused Update from the American Society of Echocardiography.',
    where: 'J Am Soc Echocardiogr, 2014, 27(8): 797–810',
    use: 'contrast-echo 判读页：MI 分级与机器设置、团注剂量、EBD 增敏三招、TEE 采集 10 个心动周期、图像欠佳的判定标准',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/2014_Contrast-Sonography.pdf' },
      { t: '中文 PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/Constrast-Performance-Guidelines-for-Cardiac-Sonographers_Chinese.pdf' },
    ],
  },
  {
    id: 'R49',
    zh: '超声引导下有创操作指南（TTE / TEE / ICE）',
    en: 'Silvestry FE, Kerber RE, Brook MM, et al. Echocardiography-Guided Interventions.',
    where: 'J Am Soc Echocardiogr, 2009, 22(3): 213–231',
    use: 'echo-interv 判读页：12 类操作 × TTE/TEE/ICE 对照表、心包穿刺成功率与并发症率、心肌活检取材部位、房间隔封堵与 ICE 风险清单',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/2009_Echo-Guided-Interventions.pdf' },
      { t: '中文 PDF', u: 'https://www.asecho.org/wp-content/uploads/2025/04/ASE-Echo-Guided-Interventions_Chinese.pdf' },
    ],
  },
  {
    id: 'R50',
    zh: '心脏超声伪影的识别与规避指南（2026）',
    en: 'Saric M, Sadeghpour A, Alizade L, et al. Recommendations for the Identification and Mitigation of Cardiac Ultrasound Artifacts.',
    where: 'J Am Soc Echocardiogr, 2026, 39(5): 435–475',
    use: 'artifact-guide 判读页：伪影分类框架（按被打破的机器假设）、混响与升主动脉 44–55% 发生率、镜像与侧瓣的误判陷阱、声影掩盖赘生物、多普勒增益与壁滤波、3D 与造影伪影',
    dl: [
      { t: '免费全文 PDF', u: 'https://www.asecho.org/wp-content/uploads/2026/05/PIIS0894731726000386.pdf' },
    ],
  },
  {
    id: 'R51',
    zh: '瓣膜狭窄超声评估建议（EAE/ASE 2009 联合文件）',
    en: 'Baumgartner H, Hung J, Bermejo J, et al. Echocardiographic Assessment of Valve Stenosis: EAE/ASE Recommendations for Clinical Practice.',
    where: 'J Am Soc Echocardiogr, 2009, 22(1): 1–23',
    use: 'asload 判读页：能量损失指数 ELI = (EOA×AAo)/(AAo−EOA)/BSA 的原始出处与 ≤0.6 cm²/m² 切点、每搏做功损失 SWL 与瓣-动脉阻抗 Zva 的定义',
    dl: [
      { t: 'ASE PDF', u: 'https://www.asecho.org/wp-content/uploads/2020/08/2009_Echo-Assessment-of-Valve-Stenosis_note_added.pdf' },
    ],
  },
  {
    id: 'R52',
    zh: '瓣-动脉阻抗（Zva）预测无症状主动脉瓣狭窄的不良结局',
    en: 'Hachicha Z, Dumesnil JG, Bogaty P, Pibarot P. Usefulness of the Valvuloarterial Impedance to Predict Adverse Outcome in Asymptomatic Aortic Stenosis.',
    where: 'J Am Coll Cardiol, 2009, 54(11): 1003–1011',
    dl: [
      { t: '需订阅（ScienceDirect）', u: 'https://www.sciencedirect.com/science/article/pii/S0735109709020592/pdf' },
    ],

    use: 'asload 判读页：Zva =（收缩压 + 平均跨瓣压差）/ 每搏量指数；Zva > 3.5 提示总负荷（瓣膜 + 动脉）升高，> 4.5 组心血管死亡风险约为低 Zva 组的 3.7 倍',
  },
  {
    id: 'R53',
    zh: '妊娠期心脏超声评估立场声明（BSE / UK Maternal Cardiology Society）',
    en: 'Curtis SL, Belham M, Bennett S, et al. Transthoracic Echocardiographic Assessment of the Heart in Pregnancy: A Position Statement on Behalf of the British Society of Echocardiography and the UK Maternal-Cardiac Working Group.',
    where: 'Echo Res Pract, 2023, 10(1): 7',
    use: 'pregnancy-echo 判读页：妊娠期生理性血流动力学改变（血容量 +40%、心排量 +30–50%、体循环阻力 −20–50%）、各类瓣膜病在孕期的超声重点、二尖瓣狭窄球囊成形可行性评估、机械瓣靠 DVI 序列对比',
    dl: [
      { t: 'PMC 全文', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10116662/' },
    ],
  },
  {
    id: 'R54',
    zh: '心血管疾病与妊娠管理指南（2025 ESC）',
    en: 'De Backer J, Haugaa KH, Hasselberg NE, et al. 2025 ESC Guidelines for the Management of Cardiovascular Disease and Pregnancy.',
    where: 'Eur Heart J, 2025, 46(43): 4462–4568',
    use: 'pregnancy-echo 判读页：mWHO 2.0 风险分级与随访强度（I 级 1–2 次 / II–III 级每季度 / IV 级劝阻妊娠）、妊娠 Heart Team 职责、围产期心肌病章节、主动脉病与妊娠',
    dl: [
      { t: 'ESC 指南页', u: 'https://www.escardio.org/guidelines/clinical-practice-guidelines/all-esc-practice-guidelines/cardiovascular-diseases-during-pregnancy-management-of/' },
    ],
  },
  {
    id: 'R55',
    zh: '应激性心肌病（Takotsubo）国际专家共识 Part I（ESC 2018）',
    en: 'Ghadri JR, Wittstein IS, Prasad A, et al. International Expert Consensus Document on Takotsubo Syndrome (Part I): Clinical Characteristics, Diagnostic Criteria, and Pathophysiology.',
    where: 'Eur Heart J, 2018, 39(22): 2032–2046',
    dl: [
      { t: 'PMC 全文', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5991216/' },
    ],

    use: 'takotsubo 判读页：心尖球形形态、基底段应变保留与 RAS ≥2.0 的鉴别思路、左室流出道梗阻的识别与处理禁忌、随访时间表',
  },
  {
    id: 'R56',
    zh: '睡眠呼吸暂停与心血管疾病（AHA/ACC 科学声明）',
    en: 'Somers VK, White DP, Amin R, et al. Sleep Apnea and Cardiovascular Disease: An American Heart Association/American College of Cardiology Foundation Scientific Statement.',
    where: 'Circulation, 2008, 118(10): 1080–1111',
    dl: [
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1161/circulationaha.107.189420' },
    ],

    use: 'osa 判读页：OSA 造成右心后负荷升高与慢性容量负荷的机制、右心负荷与容量过重的超声线索、把 OSA 相关肺高压误当原发性 PAH 的陷阱、CPAP 依从性对心衰结局的影响',
  },
  {
    id: 'R57',
    zh: '左室心肌做功的压力–应变环测量方法（EACVI 方法学文件 2021）',
    en: 'Smiseth OA, Donal E, Penicka M, Sletten OJ. How to Measure Left Ventricular Myocardial Work by Pressure-Strain Loops.',
    where: 'Eur Heart J Cardiovasc Imaging, 2021, 22(3): 259–261',
    dl: [
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1093/ehjci/jeaa301' },
    ],

    use: 'myowork 判读页：GWI / GCW / GWE 的定义与正常参考值、压力 - 应变环对软件与血压测量的依赖性、无法获得做功时的替代负荷评估（每搏功 + RWS）',
  },
  {
    id: 'R58',
    zh: '成人体外膜肺氧合（ECMO）期间的超声评估',
    en: 'Platts DG, Sedgwick JF, Burstow DJ, et al. The Role of Echocardiography in the Management of Patients Supported by Extracorporeal Membrane Oxygenation.',
    where: 'J Am Soc Echocardiogr, 2012, 25(2): 131–141',
    dl: [
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1016/j.echo.2011.11.009' },
    ],

    use: 'ecmo 判读页：心室卸载过度（室间隔运动异常、左室被抽空）、主动脉瓣不开放与根部血栓倾向、插管贴壁与心包积液的鉴别、减流量撤机前的超声评估要点',
  },

  // ── 本站托管的中文指南 PDF（用户 2026-10-21 上传，链接到 docs/materials/） ──
  {
    id: 'R59',
    zh: '经导管三尖瓣环成形术中国专家共识（试行版）',
    en: '中国医师协会心血管内科医师分会结构性心脏病学组, 国家放射与治疗临床医学研究中心, 苏州工业园区东方华夏心血管健康研究院. 经导管三尖瓣环成形术中国专家共识（试行版）.',
    where: '中国介入心脏病学杂志, 2025, 33(12): 675–686',
    use: '三尖瓣反流分级、TEE 经胃底短轴三叶定位、环成形 / 夹合术前超声评估要点',
    dl: [
      { t: 'DOI 官方页', u: 'https://doi.org/10.3969/j.issn.1004-8812.2025.12.002' },
      { t: '中文 PDF', u: 'https://heiqingyu.github.io/echo-ref/materials/2512%2B%E7%BB%8F%E5%AF%BC%E7%AE%A1%E4%B8%89%E5%B0%96%E7%93%A3%E7%8E%AF%E6%88%90%E5%BD%A2%E6%9C%AF%E4%B8%AD%E5%9B%BD%E4%B8%93%E5%AE%B6%E5%85%B1%E8%AF%86%EF%BC%88%E8%AF%95%E8%A1%8C%E7%89%88%EF%BC%89.pdf' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zgjrxzbxzz202512002' },
    ],
  },
  {
    id: 'R60',
    zh: '浙江省经食管超声心动图实践应用专家共识（一）',
    en: '浙江省超声医学工程学会心脏超声专业委员会. 浙江省经食管超声心动图实践应用专家共识（一）.',
    where: '心电与循环, 2024, 43(1): 1–8',
    use: 'TEE 适应证、禁忌与 20 个标准切面的操作规范',
    dl: [
      { t: '中文 PDF', u: 'https://heiqingyu.github.io/echo-ref/materials/%E6%B5%99%E6%B1%9F%E7%9C%81%E7%BB%8F%E9%A3%9F%E7%AE%A1%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E5%AE%9E%E8%B7%B5%E5%BA%94%E7%94%A8%E4%B8%93%E5%AE%B6%E5%85%B1%E8%AF%86(%E4%B8%80).pdf' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/xdxzz202401002' },
    ],
  },
  {
    id: 'R61',
    zh: '浙江省经食管超声心动图实践应用专家共识（二）',
    en: '浙江省超声医学工程学会心脏超声专业委员会. 浙江省经食管超声心动图实践应用专家共识（二）.',
    where: '心电与循环, 2024, 43(2): 101–109',
    use: 'TEE 术中监测、并发症识别与围术期评估',
    dl: [
      { t: '中文 PDF', u: 'https://heiqingyu.github.io/echo-ref/materials/%E6%B5%99%E6%B1%9F%E7%9C%81%E7%BB%8F%E9%A3%9F%E7%AE%A1%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E5%AE%9E%E8%B7%B5%E5%BA%94%E7%94%A8%E4%B8%93%E5%AE%B6%E5%85%B1%E8%AF%86(%E4%BA%8C).pdf' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/xdxzz202402001' },
    ],
  },
  {
    id: 'R62',
    zh: '经导管主动脉瓣置换术临床路径（2024 全文版）',
    en: '中国医师协会心血管内科医师分会结构性心脏病学组, 亚太结构性心脏病俱乐部. 经导管主动脉瓣置换术临床路径（2024 全文版）.',
    where: '中华心血管病杂志（网络版）, 2025, 8: e1000191',
    use: 'TAVR 术前超声 / CT 评估、瓣环与冠脉高度测量、术后随访节点',
    dl: [
      { t: 'DOI 官方页', u: 'https://doi.org/10.3760/cma.j.cn116031.2025.1000191' },
      { t: '中文 PDF', u: 'https://heiqingyu.github.io/echo-ref/materials/%E7%BB%8F%E5%AF%BC%E7%AE%A1%E4%B8%BB%E5%8A%A8%E8%84%89%E7%93%A3%E7%BD%AE%E6%8D%A2%E6%9C%AF%E4%B8%B4%E5%BA%8A%E8%B7%AF%E5%BE%84%EF%BC%882024%E5%85%A8%E6%96%87%E7%89%88%EF%BC%89.pdf' },
    ],
  },
  {
    id: 'R63',
    zh: '经导管二尖瓣介入修复技术临床实践指南',
    en: '国家结构性心脏病质量管理与控制中心专业委员会, 国家心血管病专家委员会结构性心脏病专业委员会. 经导管二尖瓣介入修复技术临床实践指南.',
    where: '中国循环杂志, 2025, 40(12): 1148–1163',
    use: 'TEER 适应证与禁忌、TEE 引导流程、术后反流与压差评估',
    dl: [
      
      { t: '中文 PDF', u: 'https://heiqingyu.github.io/echo-ref/materials/%E7%BB%8F%E5%AF%BC%E7%AE%A1%E4%BA%8C%E5%B0%96%E7%93%A3%E4%BB%8B%E5%85%A5%E4%BF%AE%E5%A4%8D%E6%8A%80%E6%9C%AF%E4%B8%B4%E5%BA%8A%E5%AE%9E%E8%B7%B5%E6%8C%87%E5%8D%97.pdf' },
          { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zgxhzz202512002' },
    ],
  },
  {
    id: 'R64',
    zh: '经胸超声心动图检查规范化应用中国专家共识（2024 版）',
    en: '中华医学会超声医学分会超声心动图学组, 国家超声诊断专业医疗质量控制中心专家委员会. 经胸超声心动图检查规范化应用中国专家共识（2024 版）.',
    where: '中华超声影像学杂志, 2024, 33(1): 1–13',
    use: 'TTE 测量切面、规范化操作与报告要素',
    dl: [
      { t: '中文 PDF', u: 'https://heiqingyu.github.io/echo-ref/materials/%E7%BB%8F%E8%83%B8%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E6%A3%80%E6%9F%A5%E8%A7%84%E8%8C%83%E5%8C%96%E5%BA%94%E7%94%A8%E4%B8%AD%E5%9B%BD%E4%B8%93%E5%AE%B6.pdf' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zhcsyx202401001' },
    ],
  },
  {
    id: 'R65',
    zh: '肥厚型心肌病激发/负荷超声心动图临床应用指南（2024 版）',
    en: '中国超声心动图学会, 中华医学会超声医学分会, 国家超声诊断专业质控中心, 等. 肥厚型心肌病激发/负荷超声心动图临床应用指南（2024 版）.',
    where: '中华超声影像学杂志, 2024, 33(8): 645–658',
    use: 'HCM 激发试验适应证、简易激发（Valsalva 与 20 次蹲起）、餐后与体位对压差的影响、运动/药物负荷的阳性判断与终止标准、SAM 与隐匿性梗阻判读',
    dl: [
      { t: '中文 PDF', u: 'https://heiqingyu.github.io/echo-ref/materials/%E8%82%A5%E5%8E%9A%E5%9E%8B%E5%BF%83%E8%82%8C%E7%97%85%E6%BF%80%E5%8F%91%E8%B4%9F%E8%8D%B7%E8%B6%85%E5%A3%B0%E5%BF%83%E5%8A%A8%E5%9B%BE%E4%B8%B4%E5%BA%8A%E5%BA%94%E7%94%A8%E6%8C%87%E5%8D%97(2024%E7%89%88).pdf' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zhcsyx202408001' },
    ],
  },
  {
    id: 'R66',
    zh: '法布雷病心脏受累（JACC 综述）',
    en: 'Pieroni M, Moon JC, Arbustini E, et al. Cardiac Involvement in Fabry Disease: JACC Review Topic of the Week.',
    where: 'J Am Coll Cardiol, 2021, 77(7): 922–936',
    dl: [
      { t: '免费页面', u: 'https://doi.org/10.1016/j.jacc.2020.12.024' },
    ],

    use: '法布雷病心肌病的超声与 CMR 表型、基底下侧壁应变减低、与 HCM / 淀粉样变的鉴别、酶替代与分子伴侣治疗的随访要点',
  },
  {
    id: 'R67',
    zh: '致心律失常性心肌病诊断标准（Padua 标准 2020）',
    en: 'Corrado D, Perazzolo Marra M, Zorzi A, et al. Diagnosis of Arrhythmogenic Cardiomyopathy: The Padua Criteria.',
    where: 'Int J Cardiol, 2020, 319: 106–114',
    dl: [
      { t: '官网 PDF', u: 'https://www.internationaljournalofcardiology.com/article/S0167527320332939/pdf' },
    ],

    use: 'ACM 的右优势 / 双室 / 左优势三种表型、形态功能与结构异常的分层标准、超声局部运动异常的判读与随访',
  },
  {
    id: 'R68',
    zh: '中国肺动脉高压诊断与治疗指南（2021 版）',
    en: '中华医学会呼吸病学分会肺栓塞与肺血管病学组, 中国医师协会呼吸医师分会肺栓塞与肺血管病工作委员会, 全国肺栓塞与肺血管病防治协作组, 等. 中国肺动脉高压诊断与治疗指南（2021 版）.',
    where: '中华医学杂志, 2021, 101(1): 11–51',
    use: 'PH 的超声可能性三档分层（TRV + 支持指标）、右心功能与预后、病因分类的超声线索',
    dl: [
      { t: '全文阅读页（不可下载）', u: 'https://video.yiigle.com/uploads/guide_html/%E4%B8%AD%E5%9B%BD%E8%82%BA%E5%8A%A8%E8%84%89%E9%AB%98%E5%8E%8B%E8%AF%8A%E6%96%AD%E4%B8%8E%E6%B2%BB%E7%96%97%E6%8C%87%E5%8D%97%EF%BC%882021%E7%89%88%EF%BC%89.html' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zhyx202101002' },
    ],
  },
  {
    id: 'R69',
    zh: '急性 ST 段抬高型心肌梗死诊断和治疗指南（2019）',
    en: '中华医学会心血管病学分会, 中华心血管病杂志编辑委员会. 急性 ST 段抬高型心肌梗死诊断和治疗指南（2019）.',
    where: '中华心血管病杂志, 2019, 47(10): 766–783',
    dl: [
      { t: '全文阅读页（不可下载）', u: 'https://rs.yiigle.com/cmaid/1166130' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zhxxgb201910005' },
    ],

    use: '再灌注策略与机械并发症（乳头肌断裂 / 室间隔穿孔 / 游离壁破裂）的识别与外科时机',
  },
  {
    id: 'R70',
    zh: '成人暴发性心肌炎诊断与治疗中国专家共识',
    en: '中华医学会心血管病学分会精准医学学组, 中华心血管病杂志编辑委员会, 成人暴发性心肌炎工作组. 成人暴发性心肌炎诊断与治疗中国专家共识.',
    where: '中华心血管病杂志, 2017, 45(9): 742–752',
    dl: [
      { t: '全文阅读页（不可下载）', u: 'https://rs.yiigle.com/cmaid/1006823' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zhxxgb201709004' },
    ],

    use: '暴发性心肌炎的早期识别、机械循环支持时机与超声随访节点',
  },
  {
    id: 'R71',
    zh: '心力衰竭早期筛查与一级预防中国专家共识（2024 年）',
    en: '中国老年医学学会心电与心功能分会, 中国心衰中心联盟专家委员会, 中华医学会《中华全科医师杂志》编辑委员会. 心力衰竭早期筛查与一级预防中国专家共识（2024 年）.',
    where: '中华全科医师杂志, 2024, 23(1): 7–18',
    use: '心衰 A / B 阶段的超声筛查指标、瓣膜病与心肌病家系的随访要点',
    dl: [
      { t: '全文阅读页（不可下载）', u: 'https://gpedu.yiigle.com/uploads/guide_html/6020.html' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zhqkyszz202401001' },
    ],
  },
  {
    id: 'R72',
    zh: '终末期左心疾病相关肺高血压中国专家共识',
    en: '中国医师协会心血管外科分会重症专业委员会. 终末期左心疾病相关肺高血压中国专家共识.',
    where: '中华胸心血管外科杂志, 2019, 35(12): 705–716',
    use: 'PH-LHD 的超声一线评估（ⅠC）、容量负荷与右心充盈压判断、移植 / LVAD 前评估',
    dl: [
      { t: '全文阅读页（不可下载）', u: 'https://medphy.yiigle.com/uploads/guide_html/%E7%BB%88%E6%9C%AB%E6%9C%9F%E5%B7%A6%E5%BF%83%E7%96%BE%E7%97%85%E7%9B%B8%E5%85%B3%E8%82%BA%E9%AB%98%E8%A1%80%E5%8E%8B%E4%B8%AD%E5%9B%BD%E4%B8%93%E5%AE%B6%E5%85%B1%E8%AF%86.html' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zhxxxgwk201912001' },
    ],
  },
  {
    id: 'R73',
    zh: '脓毒症与脓毒性休克管理国际指南（2021 SSC）',
    en: 'Evans L, Rhodes A, Alhazzani W, et al. Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2021.',
    where: 'Crit Care Med, 2021, 49(11): e1063–e1143',
    dl: [
      { t: '文章页（中文解读）', u: 'https://rs.yiigle.com/cmaid/1413904' },
      { t: 'SCCM 官网指南页', u: 'https://www.sccm.org/clinical-resources/guidelines/guidelines/surviving-sepsis-guidelines-2021' },
      { t: '第三方全文', u: 'https://pure.amsterdamumc.nl/files/142155987/Surviving-sepsis-campaign.pdf' },
      { t: '需订阅（DOI）', u: 'https://doi.org/10.1097/CCM.0000000000005337' },
    ],

    use: '感染性休克的液体复苏策略、容量反应性评估的地位、去甲肾上腺素与强心药的时机',
  },
  {
    id: 'R74',
    zh: '心脏结节病诊断与管理专家共识（HRS 2014）',
    en: 'Birnie DH, Sauer WH, Bogun F, et al. HRS Expert Consensus Statement on the Diagnosis and Management of Arrhythmias Associated with Cardiac Sarcoidosis.',
    where: 'Heart Rhythm, 2014, 11(7): 1304–1323',
    dl: [
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1016/j.hrthm.2014.03.043' },
    ],

    use: '心脏结节病的诊断标准（超声 / CMR / PET / 活检）、ICD 适应证与免疫抑制治疗后的随访',
  },
  {
    id: 'R75',
    zh: '中国成人心脏瓣膜病超声心动图规范化检查专家共识',
    en: '中华医学会心血管病学分会心血管影像学组, 北京医学会心血管病学会影像学组. 中国成人心脏瓣膜病超声心动图规范化检查专家共识.',
    where: '中国循环杂志, 2021, 36(2): 109–125',
    dl: [
      { t: '中文 PDF', u: 'https://heiqingyu.github.io/echo-ref/materials/valve-echo-consensus-2021.pdf' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zgxhzz202102002' },
    ],
    use: '国内成人瓣膜病超声规范化检查与严重程度评估的权威共识；MS 按 MVA <1.0 cm² 为重度（与 ESC/EACTS 2021 一致），AS 按 AVA <1.0 cm² 或 Vmax ≥4.0 m/s 或平均压差 ≥40 mmHg 提示重度',
  },
  {
    id: 'R76',
    zh: '儿童 M 型超声心动图正常值（2036 例，1 天–18 岁）',
    en: 'Kampmann C, Wiethoff CM, Wenzel A, et al. Normal Values of M Mode Echocardiographic Measurements of More Than 2000 Healthy Infants and Children in Central Europe.',
    where: 'Heart, 2000, 83(6): 667–672',
    dl: [
      { t: 'PMC 全文', u: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC1760862/' },
    ],
    use: '儿童左房前后径、右室舒张末内径、右室前壁厚度按 BSA 分组的正常值（均值 ± 2SD），用于「儿童 Z 值」页「左房与右心」组',
  },
  {
    id: 'R77',
    zh: '中国汉族健康儿童左心结构超声心动图 Z 值回归方程',
    en: 'Wang SS, Hong WJ, Zhang YQ, et al. Regression Equations for Calculation of z Scores for Echocardiographic Measurements of Left Heart Structures in Healthy Han Chinese Children.',
    where: 'J Clin Ultrasound, 2018, 46(5): 328–333',
    dl: [
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1002/jcu.22579' },
    ],
    use: '儿童左房左右径（心尖四腔）按 BSA 的三次多项式 Z 值方程（n=545，上海儿童医学中心多中心），用于「儿童 Z 值」页「左房与右心」组',
  },
  {
    id: 'R78',
    zh: '中国汉族健康儿童右心结构超声心动图 Z 值回归方程',
    en: 'Wang SS, Zhang YQ, Chen SB, et al. Regression Equations for Calculation of z Scores for Echocardiographic Measurements of Right Heart Structures in Healthy Han Chinese Children.',
    where: 'J Clin Ultrasound, 2017, 45(5): 293–303',
    dl: [
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1002/jcu.22436' },
    ],
    use: '儿童右房左右径、右室流入道内径按 BSA 的三次多项式 Z 值方程（n=515，与 R77 同一多中心队列），用于「儿童 Z 值」页「左房与右心」组',
  },
  {
    id: 'R79',
    zh: '中国儿童冠状动脉超声 Z 值回归方程（842 例多中心）',
    en: 'Fan SM, Xia B, Liu WX, et al. Establishing an Appropriate Z Score Regression Equation for Chinese Pediatric Coronary Artery Echocardiography: A Multicenter Prospective Cohort Study.',
    where: 'BMC Pediatrics, 2021, 21: 429',
    dl: [
      { t: '免费全文 PDF', u: 'https://bmcpediatr.biomedcentral.com/counter/pdf/10.1186/s12887-021-02877-9.pdf' },
    ],
    use: '儿童冠状动脉（LCA / LAD / RCA）按 Haycock BSA 的对数线性 Z 值方程（n=842，6 省 9 中心，1 月龄–17 岁）；用于「儿童 Z 值」页冠脉组的「SZ 法」行（论文自称 SZ 法）',
  },
  {
    id: 'R80',
    zh: '新生儿（0–28 天）超声心动图正常参考值及 Z 值回归方程（288 例，按体重）',
    en: 'Lin Z, Xia B, Xu N, et al. The Reference Values and Z Scores Regression Equations of Normal Newborns Undergoing Echocardiography.',
    where: '中华医学超声杂志(电子版), 2014, 11(2): 142–154',
    dl: [
      { t: '需订阅（万方核验）', u: 'https://doi.org/10.3877/cma.j.issn.1672-6448.2014.02.012' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zhyxcszz201402012' },
    ],
    use: '新生儿 17 项按体重的一次三次多项式 Z 值方程（n=288，0–28 d）；用于「儿童 Z 值」页「新生儿（0–28 天）· 体重法」区块',
  },
  {
    id: 'R81',
    zh: '瓣膜性心脏病管理指南（2025 ESC/EACTS）',
    en: '2025 ESC/EACTS Guidelines for the Management of Valvular Heart Disease.',
    where: 'Eur Heart J, 2025（在线先发）',
    dl: [
      { t: '文章页（中文解读）', u: 'https://zhxzyxldzzz.cma-cmc.com.cn/CN/10.3877/cma.j.issn.2095-6568.2025.03.001' },
      { t: '免费页面', u: 'https://www.escardio.org/Guidelines/Clinical-Practice-Guidelines/Valvular-Heart-Disease' },
    ],
    use: '替代 R23（2021 版）。新增 / 变更：TR 五级（mild / moderate / severe / massive / torrential）、TR 介入升为 Ⅱa / Level A、孤立三尖瓣手术纳入 TRI-SCORE 风险分层、纯 AR 可考虑 TAVI（Ⅱb）、AR 反流分数双阈值（超声 ≥50% / CMR ≥40%）、AS 极重度（Vmax ≥5 m/s 或平均压差 ≥60 mmHg）、TAVI 年龄下限由 ≥75 降至 ≥70 岁；用于 aortic / tr-interv / tavr / prosthetic 四条',
  },
  {
    id: 'R82',
    zh: '左心室辅助装置治疗终末期心力衰竭围术期超声心动图评价指南',
    en: 'Guideline for Perioperative Echocardiographic Evaluation of Left Ventricular Assist Device Therapy in End-Stage Heart Failure.',
    where: '中华超声影像学杂志, 2025',
    dl: [
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zhcsyx202501001' },
    ],
    use: 'LVAD 术前右心功能与瓣膜反流评估、术中入血道 / 出血道确认、术后泵速优化与抽吸事件的国内口径；与 R45（ASE 2024）并用，用于「LVAD」条目',
  },
  {
    id: 'R83',
    zh: '儿童冠状动脉经胸超声心动图规范化检查中国专家共识（2025 版）',
    en: 'Chinese Expert Consensus on Standardized Transthoracic Echocardiographic Examination of the Coronary Arteries in Children.',
    where: '中华超声影像学杂志, 2025, 34(11): 921–931',
    dl: [
      { t: '文章页（看订阅）', u: 'https://doi.org/10.3760/cma.j.cn131148-20250919-00508' },
      { t: '全文阅读页（不可下载）', u: 'https://rs.yiigle.com/cmaid/1608694' },
    ],
    use: '儿童冠脉 AHA 15 分段法与可显示的 9 段、舒张早期（T 波终点）测量、内膜至内膜、图像放大 2–4 倍、BSA 校正 Z 值、AHA 2017 川崎病冠脉分级口径；用于「儿童 Z 值」页冠脉组说明与判读',
  },
  {
    id: 'R84',
    zh: '左心室 17 节段标准化命名（AHA 科学声明 2002）',
    en: 'Cerqueira MD, Weissman NJ, Dilsizian V, et al. Standardized myocardial segmentation and nomenclature for tomographic imaging of the heart: a statement for healthcare professionals from the Cardiac Imaging Committee of the Council on Clinical Cardiology of the American Heart Association.',
    where: 'Circulation, 2002, 105(4): 539–542',
    dl: [
      { t: '免费页面', u: 'https://doi.org/10.1161/hc0402.102975' },
      { t: '免费页面', u: 'https://pubmed.ncbi.nlm.nih.gov/11815441/' },
    ],
    use: '17 节段的编号、英文名称（anteroseptal / inferoseptal / anterolateral / inferolateral）、供血分区与心尖帽 17 的定义。节段页的编号与供血分区以此为准；中文名称不逐条直译，采用 R86 的 17 节段名称表',
  },
  {
    id: 'R85',
    zh: '超声心动图评估心脏收缩和舒张功能临床应用指南',
    en: '中华医学会超声医学分会超声心动图学组, 中国医师协会心血管分会超声心动图专业委员会.',
    where: '中华超声影像学杂志, 2020, 29(6): 461–477',
    dl: [
      { t: '全文阅读页（不可下载）', u: 'https://rs.yiigle.com/cmaid/1206166' },
      { t: '文章页（看订阅）', u: 'https://doi.org/10.3760/cma.j.cn131148-20200227-00115' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zhcsyx202006001' },
    ],
    use: '国内采用 17 节段模式的依据：局部功能评估用 17 节段法，但室壁运动只观察 16 节段、不含心尖帽（该处正常无运动）；五级定性描述与 WMSI 记分。用于节段页「17 与 16 的关系」及室壁运动评分',
  },
  {
    id: 'R86',
    zh: '慢性冠状动脉综合征负荷超声心动图检查临床实践指南（2023 版）',
    en: '中国超声心动图学会, 中华医学会超声医学分会浅表组织和血管学组, 中国医药教育学会超声医学专业委员会.',
    where: '中华超声影像学杂志, 2023, 32(11): 921–945',
    dl: [
      { t: '中文 PDF', u: 'https://heiqingyu.github.io/echo-ref/materials/ccs-stress-echo-2023.pdf' },
      { t: '文章页（看订阅）', u: 'https://doi.org/10.3760/cma.j.cn131148-20230511-00267' },
      { t: '万方（需登录）', u: 'https://d.wanfangdata.com.cn/periodical/zhcsyx202311001' },
    ],
    use: '负荷超声采用 17 节段（含心尖帽）评估局部功能；缺血判读为 ≥2 个相邻节段新出现或加重的室壁运动异常；WMSI 与五级评分口径。★ 该指南正文附有 17 节段中文名称表（1 前壁基底段 … 5 下侧壁基底段 … 16 侧壁心尖段 … 17 心尖）与心尖四腔/两腔/长轴示意图，节段页的中文名称、A3C 显示 5-11-16 与 2-8-14 的读图依据均取自此（2026-10-28 核对）',
  },
  {
    id: 'R87',
    zh: '瓣膜学术研究联盟主动脉瓣临床研究终点定义（VARC-3）',
    en: 'Genereux P, Piazza N, Alu MC, et al. Valve Academic Research Consortium 3: Updated Endpoint Definitions for Aortic Valve Clinical Research.',
    where: 'Eur Heart J, 2021, 42(19): 1825–1857（同时发表于 J Am Coll Cardiol 2021; 77(21): 2717–2746）',
    dl: [
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1093/eurheartj/ehaa799' },
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1016/j.jacc.2021.02.038' },
    ],
    use: '生物瓣结构衰败（SVD）的三级定义：Stage 1 形态学 SVD，Stage 2 / 3 为中度 / 重度血流动力学 SVD，判定用与术后基线的 Δ平均压差、ΔEOA、ΔDVI 门槛；瓣周漏与瓣膜血栓的终点定义。用于「人工瓣膜评估」的 SVD 分期表',
  },
  {
    id: 'R88',
    zh: '心肌病管理指南（2023 ESC）',
    en: 'Arbelo E, Protonotarios A, Gimeno JR, et al. 2023 ESC Guidelines for the management of cardiomyopathies.',
    where: 'Eur Heart J, 2023, 44(37): 3503–3626',
    dl: [
      { t: '文章页（中文解读）', u: 'https://cmab.yiigle.com/uploads/guide_html/5934.html' },
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1093/eurheartj/ehad194' },
    ],
    use: '心肌病的形态功能表型分类（HCM / DCM / NDLVC / ARVC / RCM）；把左室心肌致密化不全定为「左室小梁化表型」而非独立心肌病，以及小梁化表型的诊断、家族筛查与随访口径',
  },
  {
    id: 'R89',
    zh: '左室心肌致密化不全的超声与病理特征（Jenni 标准）',
    en: 'Jenni R, Oechslin E, Schneider J, et al. Echocardiographic and pathoanatomical characteristics of isolated left ventricular non-compaction: a step towards classification as a distinct cardiomyopathy.',
    where: 'Heart, 2001, 86(6): 666–671',
    dl: [
      { t: '免费页面（PMC）', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1730012/' },
      { t: '免费全文（BMJ）', u: 'https://heart.bmj.com/content/heartjnl/86/6/666.full.pdf' },
    ],
    use: '超声 NC/C > 2.0（收缩末期、短轴）的原始出处，以及「两层结构分明 + 深陷隐窝与左室腔血流相通」两条附加条件',
  },
  {
    id: 'R90',
    zh: '左室心肌致密化不全的心血管磁共振特征（Petersen 标准）',
    en: 'Petersen SE, Selvanayagam JB, Wiesmann F, et al. Left ventricular non-compaction: insights from cardiovascular magnetic resonance imaging.',
    where: 'J Am Coll Cardiol, 2005, 46(1): 101–105',
    dl: [
      { t: '免费页面', u: 'https://doi.org/10.1016/j.jacc.2005.03.045' },
    ],
    use: 'CMR 舒张末期 NC/C > 2.3 的原始出处；该阈值特异度偏低、健康人群亦可符合，是「过度诊断」讨论的主要依据',
  },
  {
    id: 'R91',
    zh: '超声心动图学（第 5 版，专著）',
    en: '王新房, 谢明星, 主编. 超声心动图学[M]. 5 版.',
    where: '北京: 人民卫生出版社, 2016. ISBN 978-7-117-21712-5',
    use: '先心病各论（ASD / VSD / PDA 的分型与解剖）、瓣膜病分型与测量口径；PDA「管型最多见」等形态学分型表述的来源',
  },
  {
    id: 'R92',
    zh: '2–6 kg 婴儿经导管动脉导管未闭封堵的结局（多中心）',
    en: 'Malekzadeh-Milani S, Padovani P, Sivakumar K, et al. Outcomes of transcatheter patent ductus arteriosus closure in infants weighing 2 to 6 kg.',
    where: 'Rev Esp Cardiol, 2025（在线优先）',
    dl: [
      { t: 'DOI', u: 'https://doi.org/10.1016/j.rec.2025.09.011' },
    ],
    use: '1231 例 2–6 kg 婴儿 PDA 的形态分布随体重反转：全队列 A 43.6% / C 41.7%；2–2.9 kg 组 C 64.6%、A 13.4%；5–6 kg 组 A 54.0%、C 25.5%（P<.0001）',
  },
  {
    id: 'R93',
    zh: 'ACC 三尖瓣反流评估与管理决策路径（10 问）',
    en: "O'Gara PT, Lindenfeld J, Hahn RT, et al. 10 Issues for the Clinician in Tricuspid Regurgitation Evaluation and Management: 2025 ACC Expert Consensus Decision Pathway. J Am Coll Cardiol, 2026, 87(4): 447–486.",
    where: 'J Am Coll Cardiol, 2026, 87(4): 447–486',
    use: 'ACC 2025 决策路径：TR 评估与管理 10 问，含扩展五级严重度量表、TVARC 右室功能分级与转诊/时机',
    dl: [
      { t: 'DOI', u: 'https://doi.org/10.1016/j.jacc.2025.07.002' },
      { t: '官网', u: 'https://www.jacc.org/doi/10.1016/j.jacc.2025.07.002' },
    ],
  },
  {
    id: 'R94',
    zh: 'KSE 瓣膜病诊治立场（二）：二尖瓣与三尖瓣',
    en: 'Shim CY, Kim EK, Cho DH, et al. 2023 Korean Society of Echocardiography position paper for the diagnosis and management of valvular heart disease, part II: mitral and tricuspid valve disease. J Cardiovasc Imaging, 2024, 32: 10.',
    where: 'J Cardiovasc Imaging, 2024, 32: 10',
    use: '韩国超声学会 2023 立场文件第二部分，二尖瓣与三尖瓣疾病诊治（东亚数据，TR 定量与继发 TR 处理）',
    dl: [
      { t: '第三方全文', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11218416/' },
      { t: 'DOI', u: 'https://doi.org/10.1186/s44348-024-00021-6' },
    ],
  },
  {
    id: 'R95',
    zh: '中国经导管二尖瓣缘对缘修复术临床路径（2022 版）',
    en: '中国医师协会心血管内科医师分会结构心脏病学组, 亚太结构心脏病俱乐部. 中国经导管二尖瓣缘对缘修复术临床路径（2022 版）. 中国循环杂志, 2023, 38(3): 272–283.',
    where: '中国循环杂志, 2023, 38(3): 272–283. DOI: 10.3969/j.issn.1000-3614.2023.03.002',
    use: '中国 TEER 临床路径：MR 分级阈值、PMR/SMR 适应证禁忌、解剖绿/黄/红区、股静脉+心尖流程、随访',
    dl: [
      { t: '需订阅（万方核验）', u: 'https://doi.org/10.3969/j.issn.1000-3614.2023.03.002' },
    ],
  },
  {
    id: 'R96',
    zh: '二尖瓣反流介入治疗超声心动图评价中国专家共识',
    en: '中国医师协会超声医师分会超声心动图专业委员会, 等. 二尖瓣反流介入治疗超声心动图评价中国专家共识. 中华超声影像学杂志, 2019, 28(1): 1–6.',
    where: '中华超声影像学杂志, 2019, 28(1): 1–6. DOI: 10.3760/cma.j.issn.1004-4477.2019.01.001',
    use: 'MR 介入超声评价：六分法(0+~5+)定量、VCW 为主指标、Carpentier 分型、MitraClip 术中切面',
    dl: [
      { t: '全文阅读页（不可下载）', u: 'https://rs.yiigle.com/cmaid/1115196' },
      { t: '需订阅', u: 'https://doi.org/10.3760/cma.j.issn.1004-4477.2019.01.001' },
    ],
  },
  {
    id: 'R97',
    zh: '二尖瓣经导管缘对缘修复超声心动图操作规范中国专家共识',
    en: '中国医师协会超声医师分会超声心动图专业委员会, 中国医师协会心血管内科医师分会结构心脏病学组. 二尖瓣经导管缘对缘修复超声心动图操作规范中国专家共识. 中国介入心脏病学杂志, 2022, 30(10): 721–733.',
    where: '中国介入心脏病学杂志, 2022, 30(10): 721–733. DOI: 10.3969/j.issn.1004-8812.2022.10.001',
    use: 'TEER 术中超声操作规范：解剖/功能(Ⅳ型)分型、准入三区、房间隔穿刺高度、X-plane/工作三切面、随访',
    dl: [
      { t: '需订阅（万方核验）', u: 'https://doi.org/10.3969/j.issn.1004-8812.2022.10.001' },
    ],
  },
  {
    id: 'R98',
    zh: '三尖瓣反流的治疗（Management of Tricuspid Regurgitation，JAMA 2025）',
    en: 'Asgar AW. Management of Tricuspid Regurgitation. JAMA, 2025, 334(14): 1292–1293.',
    where: 'JAMA, 2025, 334(14): 1292–1293',
    use: 'JAMA Insights 三尖瓣反流治疗综述（库内为英文原件）：药物与介入管理路径、TR 五级分度、原发/继发/CIED 相关分类',
    dl: [
      { t: 'DOI', u: 'https://doi.org/10.1001/jama.2025.12946' },
      { t: '官网', u: 'https://jamanetwork.com/journals/jama/article-abstract/2838191' },
    ],
  },
  {
    id: 'R99',
    zh: '先天性心脏病外科治疗中国专家共识（十）：法洛四联症',
    en: '国家心血管疾病临床医学研究中心 先心病专业委员会, 王辉山, 李守军. 先天性心脏病外科治疗中国专家共识（十）：法洛四联症. 中国胸心血管外科临床杂志, 2020, 27(11): 1247–1254.',
    where: '中国胸心血管外科临床杂志, 2020, 27(11): 1247–1254. DOI: 10.7507/1007-4848.202007065',
    use: 'TOF 外科治疗共识：手术时机与术式、术后 PR 处理及肺动脉瓣置换（PVR）指征、RVOT 解除标准与随访',
    dl: [
      { t: '需订阅', u: 'https://doi.org/10.7507/1007-4848.202007065' },
      { t: '免费全文', u: 'https://www.cjebm.com/article/10.7507/1007-4848.202007065' },
    ],
  },
  {
    id: 'R100',
    zh: '先天性右室双出口新解剖分型超声心动图诊断规范专家共识',
    en: '中国超声医学工程学会超声心动图专业委员会, 逄坤静, 李守军. 先天性右室双出口新解剖分型超声心动图诊断规范专家共识. 中国超声医学杂志, 2022, 38(7): 721–729.',
    where: '中国超声医学杂志, 2022, 38(7): 721–729',
    use: 'DORV 新解剖分型（3 要素 8 型）的超声诊断规范、骑跨率判定阈值与每型对应术式',
    dl: [
      { t: '仓储详情页', u: 'https://pubnr.napstic.cn/periodicalArticle/010zgcsyxzz202207001' },
      { t: 'DOI（中文期刊）', u: 'https://doi.org/10.3969/j.issn.1002-0101.2022.07.001' },
    ],
  },
  {
    id: 'R101',
    zh: '人工心脏瓣膜功能多模态影像评估指南（ASE/SCMR/SCCT）',
    en: 'Zoghbi WA, Jone P-N, Chamsi-Pasha MA, et al. Guidelines for the Evaluation of Prosthetic Valve Function With Cardiovascular Imaging: A Report From the American Society of Echocardiography Developed in Collaboration With the Society for Cardiovascular Magnetic Resonance and the Society of Cardiovascular Computed Tomography. J Am Soc Echocardiogr, 2024, 37(1): 2–63.',
    where: 'J Am Soc Echocardiogr, 2024, 37(1): 2–63. DOI: 10.1016/j.echo.2023.10.004',
    use: '人工瓣（机械/生物/经导管）功能评估多模态指南：正常跨瓣压差、PPM(EOAi)、瓣周漏分级、梗阻与正常高跨瓣压差鉴别、CMR/CT 角色',
    dl: [
      { t: 'DOI', u: 'https://doi.org/10.1016/j.echo.2023.10.004' },
      { t: '文章页（看订阅）', u: 'https://doi.org/10.1016/j.echo.2023.10.004' },
      { t: '官网', u: 'https://www.asecho.org/' },
    ],
  },
  {
    id: 'R102',
    zh: '二尖瓣经导管缘对缘修复术中成像指南（ASE）',
    en: 'Little SH, Quader N, Brady MB, et al. Guidelines for the Intraprocedural Imaging for Mitral Valve Transcatheter Edge-to-Edge Repair (M-TEER): Recommendations from the American Society of Echocardiography. J Am Soc Echocardiogr, 2026, 39(6): 529–550.',
    where: 'J Am Soc Echocardiogr, 2026, 39(6): 529–550. DOI: 10.1016/j.echo.2026.03.003',
    use: 'M-TEER 术中成像统一流程：基线解剖准入、房间隔穿刺高度、引导步骤、夹合充分四征象、残余 MR/跨瓣压差、iASD 处理',
    dl: [
      { t: '官网', u: 'https://www.asecho.org/guideline/intraprocedural-imaging-for-mitral-valve-transcatheter-edge-to-edge-repair/' },
      { t: 'DOI', u: 'https://doi.org/10.1016/j.echo.2026.03.003' },
    ],
  },
  {
    id: 'R103',
    zh: '儿童经胸超声心动图完整检查指南（ASE）',
    en: 'Lopez L, Saurers DL, Barker PCA, et al. Guidelines for Performing a Comprehensive Pediatric Transthoracic Echocardiogram: Recommendations From the American Society of Echocardiography. J Am Soc Echocardiogr, 2024, 37(2): 119–170.',
    where: 'J Am Soc Echocardiogr, 2024, 37(2): 119–170. DOI: 10.1016/j.echo.2023.11.015',
    use: '儿童经胸超声完整检查规范：标准切面、Z 值方法（PHN 模型、±2 SD）、年龄/BSA 标化、节段性先心协议、报告与质控',
    dl: [
      { t: 'PDF 直链', u: 'https://www.asecho.org/wp-content/uploads/2024/02/2024-Peds-TTE_PIIS0894731723006223.pdf' },
      { t: 'DOI', u: 'https://doi.org/10.1016/j.echo.2023.11.015' },
      { t: '检索', u: 'https://pubmed.ncbi.nlm.nih.gov/38309834/' },
    ],
  },
  {
    id: 'R104',
    zh: '肺动脉高压治疗指南（JCS 2017/JPCPHS 2017，日本循环学会与日本肺循环·肺高血压学会）',
    en: 'Fukuda K, Date H, Doi S, et al. Guidelines for the Treatment of Pulmonary Hypertension (JCS 2017/JPCPHS 2017). Circ J, 2019, 83(4): 842–945.',
    where: 'Circulation Journal, 2019, 83(4): 842–945. DOI: 10.1253/circj.CJ-66-0158',
    use: '肺高压定义沿革与 RAP 估法演变：mPAP ≥25 时代定义、健康人 14±3（上限 20）、21–24 意义未明；RAP 由「固定值 5 或 10」改为按 IVC 直径与呼吸变化三档估（3 / 8 / 15）',
    dl: [
      { t: 'PDF 直链', u: 'https://www.jstage.jst.go.jp/article/circj/83/4/83_CJ-66-0158/_pdf' },
      { t: 'DOI', u: 'https://doi.org/10.1253/circj.CJ-66-0158' },
    ],
  },
  {
    id: 'R105',
    zh: '超声轻度肺动脉收缩压升高门诊患者的长期随访（上海中山医院单中心队列，BMJ Open 2024）',
    en: 'Weng Z, Zhang L, Lin D, et al. Long-term follow-up in outpatients with mildly elevated pulmonary artery systolic pressure on echocardiography: a single-centre retrospective cohort study in Shanghai, China. BMJ Open, 2024, 14(7): e086516.',
    where: 'BMJ Open, 2024, 14(7): e086516. DOI: 10.1136/bmjopen-2024-086516',
    use: '超声侧 PH 定义为 PASP ≥40 mmHg（40–49 轻 / 50–69 中 / ≥70 重），RAP 按 IVC 吸气塌陷三档取 5 / 10 / 15；910 例随访 5–6 年：无器质性心脏病者轻度升高不预测全因死亡',
    dl: [
      { t: 'DOI', u: 'https://doi.org/10.1136/bmjopen-2024-086516' },
      { t: '检索', u: 'https://pubmed.ncbi.nlm.nih.gov/39025813/' },
    ],
  },
  {
    id: 'R106',
    zh: '下腔静脉直径呼吸变异预测机械通气脓毒症患者的容量反应性（Barbier 2004）',
    en: 'Barbier C, Loubières Y, Schmit C, et al. Respiratory changes in inferior vena cava diameter are helpful in predicting fluid responsiveness in ventilated septic patients. Intensive Care Med, 2004, 30(9): 1740–1746.',
    where: 'Intensive Care Medicine, 2004, 30(9): 1740–1746. DOI: 10.1007/s00134-004-2259-8',
    use: '机械通气患者用 IVC 扩张指数 dIVC = (Dmax − Dmin) ÷ Dmin 预测容量反应性，经典切点 18%',
    dl: [
      { t: 'DOI', u: 'https://doi.org/10.1007/s00134-004-2259-8' },
      { t: '检索', u: 'https://pubmed.ncbi.nlm.nih.gov/15034650/' },
    ],
  },
  {
    id: 'R107',
    zh: '呼吸系统疾病床旁超声诊断与评估专家共识（2026 版）',
    en: 'Expert Consensus on Point-of-Care Ultrasound for Diagnosis and Assessment of Respiratory Diseases Editorial Board. Expert consensus on point-of-care ultrasound for diagnosis and assessment of respiratory diseases (2026 edition). Int J Respir, 2026, 46(4): 277–300.',
    where: '国际呼吸杂志, 2026, 46(4): 277–300. DOI: 10.3760/cma.j.cn131368-20251117-00657；同期转载：河北医科大学学报, 2026, 47(7): 849–868（本文所据版本）',
    use: 'IVC 估 RAP 的 2×2 四格表（表 3）、cIVC / dIVC 公式与分通气状态阈值（控制通气 >12–18%）、小潮气量 <8 mL/kg 时呼气末 IVCd <1.2–1.5 cm 判前负荷不足、肝静脉舒张期 AR 波 >25 cm/s 提示 CVP ≥15、舒张期 vs 收缩期 D 字征、机械通气时只做定性目测（Ⅱa，C）',
    dl: [
      { t: 'DOI', u: 'https://doi.org/10.3760/cma.j.cn131368-20251117-00657' },
    ],
  },
  {
    id: 'R108',
    zh: '2025 ACC/AHA/ASE/HFSA/HRS/SCAI/SCCT/SCMR 植入式心律转复除颤器、心脏再同步治疗与起搏适用标准',
    en: 'Russo AM, Desai MY, Do MM, Butler J, et al. ACC/AHA/ASE/HFSA/HRS/SCAI/SCCT/SCMR 2025 Appropriate Use Criteria for Implantable Cardioverter-Defibrillators, Cardiac Resynchronization Therapy, and Pacing. J Am Coll Cardiol, 2025, 85(11): 1213–1285.',
    where: 'Journal of the American College of Cardiology, 2025, 85(11): 1213–1285（2025-03-25 期）. DOI: 10.1016/j.jacc.2024.11.023',
    dl: [
      { t: '第三方全文', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11998028/' },
      { t: 'PMC PDF', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11998028/pdf/' },
    ],
    use: 'CRT 的 A / M / R 三级评级（表 7.1 缺血性、表 7.2 非缺血性、表 7.3 LVEF 36%–50%、表 7.5 预期右室起搏负荷、表 7.6 血运重建 / GDMT 不满 3 个月）；「≥3 个月优化 GDMT 后再评 LVEF」与「新发 LBBB 先等 3 个月」的时机依据；房颤需维持 ≥98% 起搏',
  },
  {
    id: 'R109',
    zh: '儿童超声心动图报告标准化与测量解读（EACVI / AEPC 临床共识声明）',
    en: 'Cantinotti M, Di Salvo G, Voges I, et al. Standardization in paediatric echocardiographic reporting and critical interpretation of measurements, functional parameters, and prediction scores: a clinical consensus statement of the European Association of Cardiovascular Imaging of the European Society of Cardiology and the Association for European Paediatric and Congenital Cardiology. Eur Heart J Cardiovasc Imaging, 2024, 25(8): 1029–1050.',
    where: 'European Heart Journal - Cardiovascular Imaging, 2024, 25(8): 1029–1050. DOI: 10.1093/ehjci/jeae147',
    use: '节段分析法被列为先心评估金标准；报告应「一致性 / 灵活性 / 完整性 / 简洁 / 可重复 / 实用 / 可演进 / 数字兼容」八项（表 1）；表 4 按「基础 / 高级」列出每个腔室与瓣膜该测什么，并逐项标 (mm; Z-score)。同时承认三处未验证：成人瓣膜定量参数在儿童未完全验证、分流（ASD/VSD）分级参数尚未完全确定、儿童舒张功能分型未清楚定义（新生儿婴儿成人定义不适用，E/A 可生理性倒置）；新生儿与婴幼儿不推荐 3D 定量；复杂先心 prediction scores 仍有争议',
    dl: [
      { t: 'DOI', u: 'https://doi.org/10.1093/ehjci/jeae147' },
      { t: '文章页', u: 'https://academic.oup.com/ehjcimaging/article/25/8/1029/7687697' },
      { t: '检索', u: 'https://pubmed.ncbi.nlm.nih.gov/38833586/' },
    ],
  },
  {
    id: 'R110',
    zh: '儿童心力衰竭管理指南（ISHLT 2025，2014 版更新）',
    en: 'Irving C, Azeka E, Adorisio R, et al. The International Society for Heart and Lung Transplantation Guidelines for the Management of Pediatric Heart Failure (Update From 2014). J Heart Lung Transplant, 2025, 44(10): e21–e71.',
    where: 'The Journal of Heart and Lung Transplantation, 2025, 44(10): e21–e71. DOI: 10.1016/j.healun.2025.06.003',
    use: '儿童心衰分级用哪套：ACC/AHA 的 A–D 期（表 1），婴幼儿用 Ross 分级替代 NYHA（表 2）；按 EF 分类改称 EF 不写 LVEF——原文理由是先心体循环心室形态变异，并去掉了「EF 改善」一档（表 3：HFrEF ≤40%、HFmrEF 41%–49%、HFpEF ≥50% 且有充盈压升高证据）；「按体循环心室 EF 分类」仅为 Ⅱb/C，属探索性；严重度与分期的记录为 Ⅰ/C',
    dl: [
      { t: 'DOI', u: 'https://doi.org/10.1016/j.healun.2025.06.003' },
      { t: '文章页', u: 'https://www.jhltonline.org/article/S1053-2498(25)02030-3/fulltext' },
      { t: '检索', u: 'https://pubmed.ncbi.nlm.nih.gov/40838915/' },
    ],
  },
  {
    id: 'R111',
    zh: '先天性心脏病完整经胸超声心动图操作指南（BSE 共识建议）',
    en: 'Corbett L, Forster J, Gamlin W, et al. A practical guideline for performing a comprehensive transthoracic echocardiogram in the congenital heart disease patient: consensus recommendations from the British Society of Echocardiography. Echo Res Pract, 2022, 9(1): 10.',
    where: 'Echo Research & Practice, 2022, 9(1): 10. DOI: 10.1186/s44156-022-00006-5；PMCID: PMC9578224',
    use: '先心 TTE 的顺序与测量纪律：未确立诊断者「不建议从胸骨旁起手」，应先剑下由腹腔内脏 situs 推心房 arrangement（TTE 看不到心耳，静脉回流侧与心房位置都不定义心房形态）；每项测量必须同时写明边缘约定（i2i 内缘对內缘 / L2L 前缘对前缘）、时相（舒张末 / 收缩末）与所用 Z 值数据集；并列给出 BSE 身高指数（mm/m，舒张末）与 BSA 校正（cm/m²）；房室间隔缺损等病变「瓣膜定量方法常不适用」',
    dl: [
      { t: 'PDF 直链', u: 'https://link.springer.com/content/pdf/10.1186/s44156-022-00006-5.pdf' },
      { t: '第三方全文', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9578224/' },
      { t: 'PMC PDF', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9578224/pdf/' },
      { t: 'DOI', u: 'https://doi.org/10.1186/s44156-022-00006-5' },
    ],
  },
  {
    id: 'R112',
    zh: '负荷超声心动图指南（巴西心科学会 DIC/SBC 与 SISIAC 2026）',
    en: 'Camarozano AC, Spina SV, Matos Souza JR, et al. Guideline on Stress Echocardiography – 2026. Arq Bras Cardiol, 2026, 123(4): e20260223.',
    where: 'Arquivos Brasileiros de Cardiologia, 2026, 123(4): e20260223. DOI: 10.36660/abc.20260223i',
    use: '国家学会级指南，只作补充与对照：补齐本库缺的四种负荷方式——腺苷 / 瑞加腺苷加冠脉血流储备（CFR）、麦角新碱与过度通气（冠脉痉挛激发）、起搏负荷（不能运动又不能用药时）、舒张期负荷（HFpEF 看运动时 E/e′ 与 TRV 反应）；DSE 与低剂量方案、阳性标准与 ASE 2020（R26）同向，数值一律以 R26 为准',
    dl: [
      { t: '文章页', u: 'https://abccardiol.org/en/article/guideline-on-stress-echocardiography-2026/' },
      { t: 'DOI', u: 'https://doi.org/10.36660/abc.20260223i' },
    ],
  },
  {
    id: 'R113',
    zh: '肥厚型心肌病管理指南（2024 AHA/ACC 等七学会）',
    en: 'Ommen SR, Ho CY, Asif IM, et al. 2024 AHA/ACC/AMSSM/HRS/PACES/SCMR Guideline for the Management of Hypertrophic Cardiomyopathy: A Report of the American Heart Association/American College of Cardiology Joint Committee on Clinical Practice Guidelines. Circulation, 2024, 149(23): e1239–e1311.',
    where: 'Circulation, 2024, 149(23): e1239–e1311. DOI: 10.1161/CIR.0000000000001250',
    use: '2020 版（R18）的替代版：维持 ≥15 mm 诊断阈值、家族成员 13–14 mm 可诊断、峰值 LVOT 压差 ≥30 mmHg 为梗阻、静息或激发 ≥50 mmHg 为高级治疗门槛；新增心肌肌球蛋白抑制剂（mavacamten）、LVEF <50% 应停药（Ⅰ 类）、有症状而静息/可激发压差 <50 mmHg 者运动负荷 TTE 为 Ⅰ 类推荐',
    dl: [
      { t: 'DOI（需订阅）', u: 'https://doi.org/10.1161/CIR.0000000000001250' },
      { t: '官网文章页（需订阅）', u: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001250' },
    ],
  },
  {
    id: 'R114',
    zh: '梗阻性 HCM 肌球蛋白抑制剂治疗的经胸超声评估指南（BSE 2025）',
    en: 'Culshaw CM, Augustine D, Coats CJ, et al. British Society of Echocardiography guideline for the transthoracic echocardiographic assessment of adult patients with obstructive hypertrophic cardiomyopathy receiving myosin-inhibitor therapy. Echo Res Pract, 2025, 12(1): 15.',
    where: 'Echo Research & Practice, 2025, 12(1): 15. DOI: 10.1186/s44156-025-00078-z',
    use: 'Mavacamten 治疗期的超声安全监测：起始后第 4、8、12 周各一次、之后每 24 周一次，任何剂量调整后 4 周加查；LVEF <50% 中断治疗；剂量滴定看 LVEF 50–55% 与 Valsalva LVOTG 30 mmHg；基线查 CYP2C19 代谢型；左侧卧位静息 + Valsalva 测压差、在 LVOT 与左房之间扫角度以区分 MR 频谱',
    dl: [
      { t: 'PDF 直链', u: 'https://link.springer.com/content/pdf/10.1186/s44156-025-00078-z.pdf' },
      { t: '文章页', u: 'https://link.springer.com/article/10.1186/s44156-025-00078-z' },
      { t: 'DOI', u: 'https://doi.org/10.1186/s44156-025-00078-z' },
    ],
  },
  {
    id: 'R115',
    zh: '心脏超声造影实用指南（BSE 2023）',
    en: 'Hampson R, Senior R, Ring L, et al. Contrast echocardiography: a practical guideline from the British Society of Echocardiography. Echo Res Pract, 2023, 10(1): 23.',
    where: 'Echo Research & Practice, 2023, 10(1): 23. DOI: 10.1186/s44156-023-00034-9',
    use: '左心造影操作规范：推荐 Low MI（<0.2）基波预设、聚焦点置于二尖瓣水平；SonoVue 说明书 2 ml + 5 ml 盐水，但国际指南认可的临床经验是静息/负荷 0.5 ml 慢团注通常足够，持续输注 4.0 ml/min 起、不超过 10 ml/min；凡心尖室壁瘤或四个心尖节段（含心尖帽）全部无运动者，不论图像质量都应考虑造影；MCE flash 后 5 s 内均匀显影为正常',
    dl: [
      { t: 'PDF 直链', u: 'https://link.springer.com/content/pdf/10.1186/s44156-023-00034-9.pdf' },
      { t: '文章页', u: 'https://link.springer.com/article/10.1186/s44156-023-00034-9' },
      { t: 'DOI', u: 'https://doi.org/10.1186/s44156-023-00034-9' },
    ],
  },
  {
    id: 'R116',
    zh: '心脏超声增强剂临床应用规范专家共识（2019）',
    en: '朱天刚, 靳文英, 张梅, 等. 心脏超声增强剂临床应用规范专家共识.',
    where: '中华医学超声杂志(电子版), 2019, 16(10): 731–734. DOI: 10.3877/cma.j.issn.1672-6448.2019.10.004',
    use: '国内可及制剂与操作流程：SonoVue 0.5–1.0 ml 慢推 + 3–5 ml 盐水 20 s 冲管，或 1–2 ml 以 1 ml/min 输注；低 MI（<0.3）用于 LVO、极低 MI（<0.2）用于 MCE，聚焦点二尖瓣环、帧频 >25 Hz、20 G 留置针走肘正中静脉；振荡盐水 9 ml 生理盐水 + 1 ml 空气（或 8 ml 盐水 + 1 ml 空气 + 1 ml 回抽血），三通对推 20 余次；肺动脉高压所致严重右向左分流为右心造影相对禁忌',
    dl: [
      { t: 'DOI（中文期刊）', u: 'https://doi.org/10.3877/cma.j.issn.1672-6448.2019.10.004' },
    ],
  },
  {
    id: 'R117',
    zh: '心脏超声造影规范化评估心源性卒中专家共识（2026）',
    en: '中国卒中学会超声医学分会, 周青, 马春燕, 刘娅妮, 等. 心脏超声造影规范化评估心源性卒中：专家共识.',
    where: '中国医学影像技术, 2026, 42(7): 977–985. 文章编号: 1003-3289(2026)07-0977-09. DOI: 10.13929/j.issn.1003-3289.2026.07.001',
    use: '右心声学造影 RLS 分级第二套口径：0 / Ⅰ 1–9 / Ⅱ 10–30 / Ⅲ >30 个微泡每帧（或左心腔几乎充满）；右房显影后 ≤3 个心动周期为心内、>6 个为肺内、4–6 个两者皆可能；报告须写静息与充分 Valsalva 后微泡出现时刻及持续时间；TEE 结合充分激发是识别心内 RLS 的金标准。左心造影增益 60%–70%、flash 帧频 5–15 帧/s 且 MI 0.8–1.2、MCE 再充盈 ≤4 s / 4–10 s / ≥10 s 三级评分',
    dl: [
      { t: '中文全文（学会公众号转载）', u: 'https://mp.weixin.qq.com/s?__biz=MjM5MTU4OTQ5Mw==&mid=2247500860&idx=3&sn=dbb0b195fb8722d0cf1f6830a5999157' },
      { t: '期刊官网摘要页', u: 'https://www.cjmit.com/cjmit/ch/reader/view_abstract.aspx?flag=1&file_no=20260701&journal_id=cjmit' },
      { t: 'DOI（中文期刊）', u: 'https://doi.org/10.13929/j.issn.1003-3289.2026.07.001' },
    ],
  },
  {
    id: 'R118',
    zh: '斑点追踪应变评估左室结构与功能（AHA 2025 科学声明）',
    en: 'Mihos CG, Liu JE, Anderson KM, et al. Speckle-Tracking Strain Echocardiography for the Assessment of Left Ventricular Structure and Function: A Scientific Statement From the American Heart Association.',
    where: 'Circulation, 2025, 152(10)（在线优先 2025-08-06；手头 PDF 为校样，页码 e00–e00，最终页码待定）. DOI: 10.1161/CIR.0000000000001354; PMID: 40765507',
    use: '患者水平 meta 把 GLS > −16% 定为不分厂商、不受临床协变量影响的心肌功能异常绝对阈值，−16%~−18% 为灰区（borderline / low normal）；年龄、性别、负荷状态、肥胖是最常见的临床修饰因素；分层纵向应变证据不足、不推荐常规使用，全层 midwall GLS 为首选；厂商/软件标准化尚未完成，须结合人口学、厂商差异与纵向趋势。2022 AHA/ACC 指南在 LVEF >50% 时以 GLS > −16% 诊断 stage B 心衰（最多重分期 14% 患者）；ESC 把 GLS > −16% 列为 HFpEF 次要诊断标准。帧率 40–90 帧/s，与 R3/R40 的 ≥60（推荐 80–100）并列',
    dl: [
      { t: 'DOI', u: 'https://doi.org/10.1161/CIR.0000000000001354' },
      { t: '官网文章页（需订阅）', u: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001354' },
      { t: '检索（PubMed）', u: 'https://pubmed.ncbi.nlm.nih.gov/40765507/' },
      { t: '官网要点页（免费）', u: 'https://professional.heart.org/en/science-news/speckle-tracking-strain-echocardiography-for-the-assessment-of-left-ventricular-structure/top-things-to-know' },
    ],
  },

  /* ★ 2026-11-08：四川 2025 冠脉 Z 值方程，用户把原文 PDF 放进 refs/ 后逐项核对入库。
     逐字核过：式(1)–(4) 的 a / b / √MSE 与表 3–6 幂函数行完全一致（见 use）。 */
  {
    id: 'R119',
    zh: '四川地区儿童冠状动脉内径 Z 值回归方程（744 例）',
    en: 'Wang Y, Jiang JY, Deng Y, et al. Diagnosis of Coronary Artery Lesions in Children Based on Z-Score Regression Model.',
    where: '中国当代儿科杂志, 2025, 27(2): 176–183. DOI: 10.7499/j.issn.1008-8830.2405030',
    use: '四川省人民医院 2020–2022 年 744 名 0–18 岁健康儿童建模、2018–2022 年 251 例川崎病验证；' +
      '与 BSA 相关系数最高（LMCA 0.815 / LAD 0.793 / LCX 0.704 / RCA 0.802），七种回归中幂函数 R² 最优、MSE 最小。' +
      '式(1)–(4)：Z=[ln(实测) − a − b·ln(BSA)] / √MSE，' +
      'LMCA a=0.96623 b=0.358 √MSE=0.111616；LAD 0.64763 / 0.353 / 0.126832；' +
      'LCX 0.44340 / 0.319 / 0.145414；RCA 0.78299 / 0.378 / 0.126883。' +
      '四段齐全（含 LCX，深圳 SZ 队列无 LCX）。★ 单中心地区性常模，不宜与深圳 SZ、' +
      'Kobayashi ZSP、AHA/PHN 跨套比较；同一患儿随访固定一套。' +
      '★ 原文方法段写 Z=(M−y)/√MSE，式(1)–(4) 实际用 ln 尺度，本页按式(1)–(4) 实现。',
    dl: [
      { t: '中文全文（期刊官网）', u: 'https://www.zgddek.com/fileup/1008-8830/HTML/2025-2-176.htm' },
      { t: 'PMC 全文', u: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11838035/' },
      { t: 'DOI', u: 'https://doi.org/10.7499/j.issn.1008-8830.2405030' },
    ],
  },

];

/* ══════════════════════════════════════════════════════════════
   判读页 ↔ 计算器的桥（结构性解耦）
   ──────────────────────────────────────────────────────────────
   设计原则：**判读页只放阈值与处理原则，量化公式独立存在于公式集**。
   这里给每个判读条目挂一行「相关计算（通用量）」，指向公式集里对应的
   计算器，让用户不必离开判读语境就能找到算法入口。
   只写真实存在的计算器；没有对应算法的条目（如感染性心内膜炎、
   Fontan 术后）故意不挂，避免指错路。
   ══════════════════════════════════════════════════════════════ */
var CALC_HINTS = {
  'ped-base': '介入尺寸与先心 · 主动脉分节段 Z 值；McGoon 比值与 Nakata 指数',
  /* 大血管与急症 */
  aorta: '介入尺寸与先心 · 主动脉分节段 Z 值；重构与心肌功能 · 升主动脉直径指数',
  pe: '右心与肺循环 · 右室容积指数 RVEDVi/RVESVi；PAPi 肺动脉搏动指数',
  /* 心肌病变 */
  /* ★ 2026-11-09 体检：删掉孤儿键 ph（无对应条目 id，attachCalcHints 永远取不到，
     残留的纯文字桥接不会渲染也不会出胶囊）。肺高压相关桥接在 zh-ph / pht-rev 两条上。 */
  bav: '瓣膜评估 · 主动脉瓣疾病评估；介入尺寸与先心 · 主动脉分节段 Z 值；TAVR 瓣环尺寸与 oversizing',
  dcm: '血流动力学与心功能 · 左室容积与射血分数；重构与心肌功能 · 致密化不全 NC/C 比；左室重构四联',
  'nc-lv': '重构与心肌功能 · 左室重构四联；血流动力学与心功能 · 左室容积与射血分数',
  athlete: '血流动力学与心功能 · 左室容积与射血分数；重构与心肌功能 · 左室重构四联；左室质量与几何构型',
  hcm: '重构与心肌功能 · 左室重构四联；左室质量与几何构型；心尖保留比值 RAS；每搏功 SW / SWi',
  infiltr: '重构与心肌功能 · 心尖保留比值 RAS；左房应变三值；左室重构四联；应变离散度 MDS',
  /* 心腔与应变 */
  lv: '血流动力学与心功能 · 左室容积与射血分数；LVOT 每搏量与心排量；M 型三合一；左室舒张功能（舒张与左房压专条）',
  rv: '右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP）；PAPi 肺动脉搏动指数；右室容积指数 RVEDVi/RVESVi；快速比值 RV/LV',
  ivc: '右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP，RAP 由 IVC 取值）；右心评估',
  rvfun: '右心与肺循环 · 右室收缩功能三合一；右室容积指数 RVEDVi / RVESVi',
  strain: '重构与心肌功能 · 应变离散度 MDS；左室重构四联',
  'la-strain': '重构与心肌功能 · 左房应变三值；左房排空分数 LAEF',
  prosthetic: '瓣膜评估 · 人工瓣 EOAi 与 PPM',
  /* 瓣膜评估 */
  mitral: '瓣膜评估 · 人工瓣 EOAi 与 PPM；TR 三尖瓣反流定量',
  aortic: '瓣膜评估 · AS 负荷量化（ELI · Zva · SWL）；人工瓣 EOAi 与 PPM',
  asload: '瓣膜评估 · 主动脉瓣疾病评估；人工瓣 EOAi 与 PPM',
  /* 先天性心脏病 */
  asd: '血流动力学与心功能 · Qp/Qs 肺体循环血流比；介入尺寸与先心 · McGoon 比值与 Nakata 指数',
  vsd: '血流动力学与心功能 · Qp/Qs 肺体循环血流比；右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP）',
  pda: '血流动力学与心功能 · Qp/Qs 肺体循环血流比；介入尺寸与先心 · 主动脉分节段 Z 值',
  caf: '血流动力学与心功能 · Qp/Qs；介入尺寸与先心 · McGoon 比值与 Nakata 指数',
  'tof-pr': '右心与肺循环 · 右室容积指数；右室收缩功能三合一',
  'pht-rev': '右心与肺循环 · 血管阻力三合一；肺动脉压（sPAP·dPAP·mPAP）',
  /* 负荷与介入 */
  'stress-echo': '血流动力学与心功能 · 肺动脉压（sPAP·dPAP·mPAP）；右心与肺循环 · PAPi',
  tavr: '介入尺寸与先心 · TAVR 瓣环尺寸与 oversizing；主动脉分节段 Z 值',
  'mv-interv': '瓣膜评估 · 二尖瓣疾病评估；人工瓣 EOAi 与 PPM',
  'tr-interv': '瓣膜评估 · TR 三尖瓣反流定量',
  /* 特殊临床场景 */
  takotsubo: '重构与心肌功能 · 心尖相对基底段应变保留比 RAS；左室重构四联',
  osa: '右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP，RAP 由 IVC 取值）；右室容积指数 RVEDVi/RVESVi',
  myowork: '重构与心肌功能 · 每搏做功与每搏功指数；左室重构四联',
  ecmo: '右心与肺循环 · 右室收缩功能三合一；TAPSE/肺动脉压耦联比',
  /* 图像质控与规范（原「切面、图像与质控」，3 条切面速查已移入「切面学习」页签） */
  'tee-20': '瓣膜评估 · 二尖瓣疾病评估；主动脉瓣疾病评估；介入尺寸与先心 · TAVR 瓣环尺寸与 oversizing',
  'tte-std': '血流动力学与心功能 · 左室容积与射血分数；左室质量与几何构型；MAPSE 长轴收缩',
  'tee-safety': '血流动力学与心功能 · 左室容积与射血分数；右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP）',
  'artifact-guide': '血流动力学与心功能 · 简化伯努利压差；无量纲指数 DVI；瓣膜评估 · 缩流颈宽度 VCW 分级',
  mimic: '血流动力学与心功能 · 简化伯努利压差；瓣膜评估 · 二尖瓣疾病评估；缩流颈宽度 VCW 分级',
  'contrast-echo': '血流动力学与心功能 · 左室容积与射血分数；Qp/Qs 肺体循环血流比',
  '3d-tee': '瓣膜评估 · 二尖瓣疾病评估；介入尺寸与先心 · TAVR 瓣环尺寸与 oversizing',
  'report-std': '评分与室壁运动 · WMSI 室壁运动积分；血流动力学与心功能 · 左室容积与射血分数',
  critical: '右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP）；血流动力学与心功能 · 左室容积与射血分数',
  'doppler-basics': '血流动力学与心功能 · 简化伯努利压差；无量纲指数 DVI；瓣膜评估 · 缩流颈宽度 VCW 分级',
  peri: '右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP，RAP 由 IVC 取值）；TAPSE/PASP 耦联比',
  'cp-rm': '舒张功能定量 · 左室舒张功能（E/A · E/e′ · E/Vp · 分级）；重构与心肌功能 · 左房僵硬度',
  ctrcd: '血流动力学与心功能 · 左室容积与射血分数；重构与心肌功能 · 应变离散度 MDS；左房应变三值',
  'zh-normal': '血流动力学与心功能 · 心房容积指数；重构与心肌功能 · 左室重构四联',
  mass: '血流动力学与心功能 · 左室容积与射血分数；右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP，RAP 由 IVC 取值）',
  dse: '瓣膜评估 · 主动脉瓣疾病评估；血流动力学与心功能 · 无量纲指数 DVI；左室容积与射血分数',
  ie: '瓣膜评估 · 主动脉瓣疾病评估；缩流颈宽度 VCW 分级；血流动力学与心功能 · 左室容积与射血分数',
  'aortic-root': '介入尺寸与先心 · 主动脉分节段 Z 值；重构与心肌功能 · 升主动脉直径指数；TAVR 瓣环尺寸与 oversizing',
  rheumatic: '瓣膜评估 · 二尖瓣疾病评估（含 Wilkins 形态评分）；右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP）',
  arvc: '右心与肺循环 · 右室容积指数 RVEDVi / RVESVi；右室收缩功能三合一',
  myocarditis: '右心与肺循环 · 右室收缩功能三合一；血流动力学与心功能 · 左室容积与射血分数；重构与心肌功能 · 应变离散度 MDS',
  sarcoid: '血流动力学与心功能 · 左室容积与射血分数；重构与心肌功能 · 应变离散度 MDS；心尖保留比值 RAS',
  ebstein: '瓣膜评估 · TR 三尖瓣反流定量；右心与肺循环 · 右室收缩功能三合一；肺动脉压（sPAP·dPAP·mPAP，RAP 由 IVC 取值）',
  dorv: '血流动力学与心功能 · Qp/Qs 肺体循环血流比；介入尺寸与先心 · McGoon 比值与 Nakata 指数；瓣膜评估 · TR 三尖瓣反流定量',
  'coa-echo': '介入尺寸与先心 · 主动脉缩窄压差与拖尾；McGoon 比值与 Nakata 指数；主动脉分节段 Z 值',
  iaa: '介入尺寸与先心 · 主动脉分节段 Z 值；主动脉缩窄压差与拖尾；McGoon 比值与 Nakata 指数',
  alt: '血流动力学与心功能 · 左室容积与射血分数；瓣膜评估 · 主动脉瓣疾病评估；简化伯努利压差',
  'cor-tri': '瓣膜评估 · 二尖瓣疾病评估；血流动力学与心功能 · 简化伯努利压差；右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP）',
  dbv: '右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP）；瓣膜评估 · TR 三尖瓣反流定量；血流动力学与心功能 · Qp/Qs 肺体循环血流比',
  'pa-origin': '血流动力学与心功能 · Qp/Qs 肺体循环血流比；介入尺寸与先心 · McGoon 比值与 Nakata 指数；右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP）',
  bubble: '血流动力学与心功能 · Qp/Qs 肺体循环血流比；介入尺寸与先心 · McGoon 比值与 Nakata 指数；右心与肺循环 · 血管阻力三合一',
  mustard: '右心与肺循环 · 右室容积指数 RVEDVi / RVESVi；右室收缩功能三合一；肺动脉压（sPAP·dPAP·mPAP）',
  fontan: '右心与肺循环 · PAPi 肺动脉搏动指数；血管阻力三合一',
  aca: '重构与心肌功能 · 左室重构四联；右心与肺循环 · 血管阻力三合一',
  pvai: '血流动力学与心功能 · Qp/Qs 肺体循环血流比；介入尺寸与先心 · McGoon 比值与 Nakata 指数',
  'as-switch': '瓣膜评估 · 主动脉瓣疾病评估；TR 三尖瓣反流定量；血流动力学与心功能 · 左室容积与射血分数',
  tga: '血流动力学与心功能 · Qp/Qs 肺体循环血流比；介入尺寸与先心 · McGoon 比值与 Nakata 指数；瓣膜评估 · 主动脉瓣疾病评估',
  truncus: '血流动力学与心功能 · Qp/Qs 肺体循环血流比；介入尺寸与先心 · McGoon 比值与 Nakata 指数；右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP）',
  'echo-interv': '右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP，RAP 由 IVC 取值）；血流动力学与心功能 · 左室容积与射血分数',
  crt: '血流动力学与心功能 · 左室容积与射血分数；右心与肺循环 · 右室收缩功能三合一',
  la: '血流动力学与心功能 · 心房容积指数；重构与心肌功能 · 左房应变三值；左房排空分数 LAEF',
  lvad: '血流动力学与心功能 · 左室容积与射血分数；右心与肺循环 · PAPi 肺动脉搏动指数；右室收缩功能三合一',
  thrombus: '血流动力学与心功能 · 左室容积与射血分数；重构与心肌功能 · 左室重构四联；评分与室壁运动 · WMSI 室壁运动积分',
  'zh-ph': '右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP）；血管阻力三合一',
  'ami-comp': '评分与室壁运动 · WMSI 室壁运动积分；血流动力学与心功能 · 左室容积与射血分数；瓣膜评估 · 二尖瓣疾病评估',
  'pregnancy-echo': '右心与肺循环 · 肺动脉压（sPAP·dPAP·mPAP，RAP 由 IVC 取值）；血流动力学与心功能 · 左室容积与射血分数',
  ppcm: '血流动力学与心功能 · 左室容积与射血分数；右心与肺循环 · TAPSE/PASP 耦联比；肺动脉压（sPAP·dPAP·mPAP）',
  sepsis: '血流动力学与心功能 · LVOT 每搏量与心排量；左室容积与射血分数；右心与肺循环 · PAPi 肺动脉搏动指数',
  'postop-icu': '血流动力学与心功能 · LVOT 每搏量与心排量；左室容积与射血分数；右心与肺循环 · PAPi 肺动脉搏动指数',
  'tte-measure': '血流动力学与心功能 · 左室容积与射血分数；左室质量与几何构型；MAPSE 长轴收缩',

};

/* ══════════════════════════════════════════════════════════════
   判读条目 → 计算器 id（供小程序渲染成可点胶囊）
   ──────────────────────────────────────────────────────────────
   只存 id，名称由 calc-groups 的 title 运行时取，避免两处文案漂移。
   与 CALC_HINTS 是同一批条目：CALC_HINTS 给网页/APK 出纯文字，
   CALC_LINKS 给小程序出可点胶囊。改一处必须同改另一处（校验会查）。
   ══════════════════════════════════════════════════════════════ */
var CALC_LINKS = {
  'ped-base': ['aortaz', 'paidx'],
  /* 心腔与应变 */
  lv: ['ef', 'flow', 'mtype', 'dfun'],
  rv: ['rvvol', 'quickratio', 'mpap', 'papi'],
  ivc: ['mpap', 'rv'],
  rvfun: ['rvsyst', 'rvvol'],
  strain: ['mdsv', 'lvgeom'],
  'la-strain': ['lastrain', 'laef'],
    prosthetic: ['ppm'],
  /* 瓣膜 */
  mitral: ['ppm', 'tr'],
  aortic: ['asload', 'ppm'],
  asload: ['aortic', 'ppm'],
  bav: ['aortic', 'aortaz', 'tavrsz'],
  /* 心肌病变 */
  hcm: ['lvgeom', 'lvmass', 'ras', 'swv'],
  infiltr: ['ras', 'lastrain', 'lvgeom', 'mdsv'],
  dcm: ['ef', 'lvnc', 'lvgeom'],
  'nc-lv': ['ef', 'lvgeom'],
  athlete: ['ef', 'lvgeom', 'lvmass'],
  /* 大血管与急症 */
  aorta: ['aortaz', 'aortaidx'],
  pe: ['rvvol', 'papi'],
  /* 先心病 */
  asd: ['shunt', 'paidx'],
  vsd: ['shunt', 'mpap'],
  pda: ['shunt', 'aortaz'],
  caf: ['shunt', 'paidx'],
  'pht-rev': ['resist', 'mpap'],
  'tof-pr': ['rvvol', 'rvsyst'],
  /* 负荷与介入 */
  'stress-echo': ['mpap', 'papi'],
  tavr: ['tavrsz', 'aortaz'],
  'mv-interv': ['mitral'],
  'tr-interv': ['tr'],
  /* 特殊临床场景 */
  takotsubo: ['ras', 'lvgeom'],
  osa: ['mpap', 'rvvol'],
  myowork: ['swv', 'lvgeom'],
  ecmo: ['rvsyst', 'rv'],
  'tee-20': ['mitral', 'aortic', 'tavrsz'],
  'tte-std': ['ef', 'lvmass', 'mapse'],
  'tte-measure': ['ef', 'lvmass', 'mapse'],
  'tee-safety': ['ef', 'mpap'],
  'artifact-guide': ['bernoulli', 'aortic'],
  mimic: ['bernoulli', 'mitral'],
  'contrast-echo': ['ef', 'shunt'],
  '3d-tee': ['mitral', 'tavrsz'],
  'report-std': ['wmsi', 'ef'],
  critical: ['mpap', 'ef'],
  'doppler-basics': ['bernoulli', 'aortic'],
  peri: ['mpap', 'rv'],
  'cp-rm': ['dfun', 'lastiff'],
  ctrcd: ['ef', 'mdsv', 'lastrain'],
  'zh-normal': ['atrial', 'lvgeom'],
  mass: ['ef', 'mpap'],
  dse: ['aortic', 'ef'],
  ie: ['aortic', 'ef'],
  'aortic-root': ['aortaz', 'aortaidx', 'tavrsz'],
  rheumatic: ['mitral', 'mpap'],
  arvc: ['rvvol', 'rvsyst'],
  myocarditis: ['rvsyst', 'ef', 'mdsv'],
  sarcoid: ['ef', 'mdsv', 'ras'],
  ebstein: ['tr', 'mpap', 'rvsyst'],
  dorv: ['shunt', 'paidx', 'tr'],
  'coa-echo': ['coa', 'paidx', 'aortaz'],
  iaa: ['aortaz', 'coa', 'paidx'],
  alt: ['ef', 'aortic', 'bernoulli'],
  'cor-tri': ['mitral', 'mpap'],
  dbv: ['mpap', 'tr', 'shunt'],
  'pa-origin': ['shunt', 'paidx', 'mpap'],
  bubble: ['shunt', 'paidx', 'resist'],
  mustard: ['rvvol', 'rvsyst', 'mpap'],
  fontan: ['papi', 'resist'],
  aca: ['wmsi', 'ef', 'lvgeom'],
  pvai: ['shunt', 'paidx', 'mpap'],
  'as-switch': ['aortic', 'tr', 'ef'],
  tga: ['shunt', 'paidx', 'aortic'],
  truncus: ['shunt', 'paidx', 'mpap'],
  'echo-interv': ['mpap', 'ef'],
  crt: ['ef', 'rvsyst'],
  la: ['atrial', 'lastrain', 'laef'],
  lvad: ['ef', 'papi', 'rvsyst'],
  thrombus: ['ef', 'lvgeom', 'wmsi'],
  'zh-ph': ['mpap', 'resist'],
  'ami-comp': ['wmsi', 'ef', 'mitral'],
  'pregnancy-echo': ['mpap', 'ef'],
  ppcm: ['ef', 'rv', 'mpap'],
  sepsis: ['flow', 'ef', 'papi'],
  'postop-icu': ['flow', 'ef', 'papi'],

};

(function attachCalcHints() {
  BRIEF_SECTIONS.forEach(function (sec) {
    (sec.items || []).forEach(function (it) {
      var hint = CALC_HINTS[it.id];
      if (!hint || !it.blocks || !it.blocks.length) return;
      it.blocks.push({
        kind: 'note',
        text: '**相关计算（通用量）**：公式集 → ' + hint +
          '。本页给判读阈值，公式集给算法，两者口径一致、可互相印证。',
        // 小程序把这串 id 渲染成可点胶囊，点了直接进对应计算器
        links: CALC_LINKS[it.id] || [],
      });
    });
  });
})();

/* ═══════════════════════════════════════════════════════════════════
   ★ v1.11.2  缩写表：判读条目顶部自动列出「本文出现的缩写 → 中文全称」
   起因：用户从搜索或交叉链接直接进详情页时，看不到别处解释过的缩写，
        TOF / LVNC / PVR 这类词在跨页面阅读时就成了「只认识字母」。
   做法：只维护这一张表，渲染时按条目正文里**实际出现**的缩写生成一行，
        新增条目自动受益，不必在每条内容里重复写全称。
   ★ 匹配用「非字母数字边界」，避免 PART 命中 AR、pressure 命中 PR。
   ★ PVR 有歧义（肺血管阻力 / 肺动脉瓣置换），按上下文无法自动判别，
      所以全称写成「肺血管阻力 / 肺动脉瓣置换（按上下文）」，不做单一映射。
   ═══════════════════════════════════════════════════════════════════ */
var ABBR = [
  /* 疾病与综合征 */
  ['LVNC', '左室心肌致密化不全', 'd'],
  ['HCM', '肥厚型心肌病', 'd'],
  ['MVP', '二尖瓣脱垂', 'd'],
  ['AVP', '主动脉瓣脱垂', 'd'],
  ['MAC', '二尖瓣环钙化', 'd'],
  ['Barlow', '弥漫性瓣叶增厚冗余型脱垂', 'd'],
  ['FED', '纤维弹性缺陷', 'd'],
  ['DCM', '扩张型心肌病', 'd'],
  ['ARVC', '致心律失常性右室心肌病', 'd'],
  ['ACM', '致心律失常性心肌病', 'd'],
  ['TOF', '法洛四联症', 'd'],
  ['DORV', '右室双出口', 'd'],
  ['TGA', '大动脉转位', 'd'],
  ['ASD', '房间隔缺损', 'd'],
  ['VSD', '室间隔缺损', 'd'],
  ['PDA', '动脉导管未闭', 'd'],
  ['ALCAPA', '左冠状动脉异常起源于肺动脉', 'd'],
  ['AAOCA', '冠状动脉异常主动脉起源', 'd'],
  ['TAPVC', '完全性肺静脉异位引流', 'd'],
  ['PAPVC', '部分性肺静脉异位引流', 'd'],
  ['TCPC', '全腔静脉-肺动脉连接', 'd'],
  ['FALD', 'Fontan 相关肝病', 'd'],
  ['PLE', '蛋白丢失性肠病', 'd'],
  ['LSVC', '永存左上腔静脉', 'd'],
  ['PPHN', '新生儿持续性肺动脉高压', 'd'],
  ['CoA', '主动脉缩窄', 'd'],
  ['CAF', '冠状动脉瘘', 'd'],
  ['PFO', '卵圆孔未闭', 'd'],
  ['IE', '感染性心内膜炎', 'd'],
  ['CTRCD', '肿瘤治疗相关心功能不全', 'd'],
  ['HFpEF', '射血分数保留的心力衰竭', 'd'],
  ['HFrEF', '射血分数降低的心力衰竭', 'd'],
  ['AMI', '急性心肌梗死', 'd'],
  ['PPCM', '围产期心肌病', 'd'],
  ['OSA', '阻塞性睡眠呼吸暂停', 'd'],
  ['SVD', '生物瓣结构衰败', 'd'],
  ['PPM', '患者-人工瓣不匹配', 'd'],

  /* 瓣膜与术式 */
  ['AS', '主动脉瓣狭窄', 'd'],
  ['AR', '主动脉瓣反流', 'd'],
  ['MS', '二尖瓣狭窄', 'd'],
  ['MR', '二尖瓣反流', 'd'],
  ['TR', '三尖瓣反流', 'd'],
  ['PR', '肺动脉瓣反流', 'd'],
  ['PS', '肺动脉瓣狭窄', 'd'],
  ['TAVR', '经导管主动脉瓣置换', 'd'],
  ['TEER', '经导管缘对缘修复', 'd'],
  ['PVR', '肺血管阻力 / 肺动脉瓣置换（按上下文）', 'd'],
  ['SMR', '继发性二尖瓣反流', 'd'],
  ['ASMR', '心房性二尖瓣反流', 'd'],
  ['VSMR', '心室性二尖瓣反流', 'd'],

  /* 测量与血流动力学 */
  ['EF', '射血分数', 'm'],
  ['FS', '缩短分数', 'm'],
  ['GLS', '整体纵向应变', 'm'],
  ['RVFWS', '右室游离壁应变', 'm'],
  ['TAPSE', '三尖瓣环收缩期位移', 'm'],
  ['MAPSE', '二尖瓣环收缩期位移', 'm'],
  ['FAC', '面积变化分数', 'm'],
  ['LVOT', '左室流出道', 'm'],
  ['RVOT', '右室流出道', 'm'],
  ['AVA', '主动脉瓣口面积', 'm'],
  ['EOA', '有效瓣口面积', 'm'],
  ['EROA', '有效反流口面积', 'm'],
  ['RVol', '反流量', 'm'],
  ['RF', '反流分数', 'm'],
  ['VC', '缩流颈', 'm'],
  ['PISA', '近端等速表面积', 'm'],
  ['DVI', '无量纲指数', 'm'],
  ['SVi', '每搏量指数', 'm'],
  ['BSA', '体表面积', 'm'],
  ['PASP', '肺动脉收缩压', 'm'],
  ['RAP', '右房压', 'm'],
  ['IVC', '下腔静脉', 'm'],
  ['RWT', '相对室壁厚度', 'm'],
  ['LVMI', '左室质量指数', 'm'],
  ['WMSI', '室壁运动积分指数', 'm'],
  ['PHT', '压力减半时间', 'm'],
  ['MPI', '心肌做功指数（Tei 指数）', 'm'],
  ['MDSV', '机械离散度', 'm'],
  ['RAS', '心尖保留比值', 'm'],
  ['DSE', '多巴酚丁胺负荷超声', 'm'],
  ['CMR', '心脏磁共振', 'm'],
  ['TEE', '经食管超声心动图', 'm'],
  ['TTE', '经胸超声心动图', 'm'],
  ['LVAD', '左室辅助装置', 'm'],
  ['ECMO', '体外膜肺氧合', 'm'],
];

/** 文本里实际出现的缩写（默认只返回疾病 / 术式类，最多 6 个；参数类缩写正文里一般自带中文） */
function abbrHits(text, withMeasure) {
  var out = [];
  if (!text) return out;
  for (var i = 0; i < ABBR.length; i++) {
    if (!withMeasure && ABBR[i][2] !== 'd') continue;
    var ab = ABBR[i][0];
    // 前后不能紧邻英文字母或数字：AR 不会命中 PART，PR 不会命中 pressure
    var re = new RegExp('(^|[^A-Za-z0-9])' + ab.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&') + '([^A-Za-z0-9]|$)');
    if (re.test(text)) out.push({ ab: ab, zh: ABBR[i][1] });
    if (out.length >= 6) break;
  }
  return out;
}

/* ══════════ 统一小节序号（2026-11-08）══════════
   起因：用户截图对比发现「感染性心内膜炎赘生物评估」的小节标题都带
   「一、二、三…」，而「TR 三尖瓣反流量」等条目（多为 calc-notes 生成的
   计算器说明块）标题是裸的，小节目录里前者还叠成「1 一、xxx」双重编号。

   做法：不在 637 处数据里逐个补前缀（改不全、也容易和已有编号打架），
   改由渲染时统一生成：
     - 顶层 h  → 按出现顺序统一给「一、二、三…」，并剥掉数据里原有的中文序号；
     - 子级 h  → 以 ① / 2.1 / （一）开头的保持原样、不占顶层序号；
     - 目录弹层 → 顶层显示与正文同一个阿拉伯序号，子级显示「·」并缩进。
   小程序与网页/APK 共用本函数，保证三端一致。
   ══════════════════════════════════════════════════════════════ */
var CN_ONES = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function cnNo(n) {
  if (n < 10) return CN_ONES[n];
  if (n < 20) return '十' + (n % 10 ? CN_ONES[n % 10] : '');
  if (n < 100) return CN_ONES[Math.floor(n / 10)] + '十' + (n % 10 ? CN_ONES[n % 10] : '');
  return String(n);
}

/** 返回与 blocks 里每个 h 一一对应的序号信息（顺序对齐，非 h 不占位） */
function secList(blocks) {
  var out = [];
  var top = 0;
  var numRe = /^[一二三四五六七八九十百]+[、．.]\s*/;
  var heads = (blocks || []).filter(function (b) { return b && b.kind === 'h'; });
  // ★ 2026-11-08：条目里只要已有中文编号，就保留原编号体系，无编号小标题一律降为
  //   子级（不补号）。否则像人工瓣那样，一个「尺寸决定本底压差」的无编号小标题
  //   会把后面 12 节整体挤后一位，正文「见第 X 节」交叉引用全部错位。
  //   只有整条都没有编号时，才统一自动编号（用户反馈「有的有序号、有的没有」）。
  var hasNum = heads.some(function (b) {
    return numRe.test(String(b.text || '').replace(/\*\*/g, ''));
  });
  (blocks || []).forEach(function (b) {
    if (!b || b.kind !== 'h') return;
    var raw = String(b.text || '');
    var plain = raw.replace(/\*\*/g, '');
    var m = plain.match(numRe);
    // 子级：圈号 ① …、小数编号 2.1 …、括号中文（一）…
    var sub = /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/.test(plain) ||
              /^\d+\.\d/.test(plain) ||
              /^（[一二三四五六七八九十]+）/.test(plain);
    if (hasNum && !m) sub = true;   // 已有编号体系里的无编号小标题，保持原样不加号
    var no = '', text = raw, listNo = '·';
    if (!sub) {
      top += 1;
      no = hasNum ? m[0] : (cnNo(top) + '、');
      listNo = String(top);
      text = m ? raw.replace(numRe, '') : raw;
    }
    var label = String(text).replace(/\*\*/g, '');
    out.push({
      no: no,
      text: text,                                  // 正文用（保留 ** 加粗）
      label: label,                                // 目录用（去 **）
      short: label.split(/[：:]/)[0] || label,     // 目录只显示冒号前主标题
      sub: sub,
      top: top,
      listNo: listNo,
    });
  });
  return out;
}

/** 把一个条目的全部文本拼起来（表格按行列展开） */
function blockText(blocks) {
  return (blocks || []).map(function (b) {
    if (b.text) return b.text;
    var t = (b.heads || []).join(' ');
    (b.rows || []).forEach(function (r) { t += ' ' + r.join(' '); });
    return t;
  }).join(' ');
}

/* ────────── 中英对照（v1.12.5）──────────
   [缩写, 英文全称, 中文, 关联条目id]
   ★ 用途：搜索时单列一组「中英对照」，平时不进目录、不渲染详情卡。
   第 4 列关联条目 id 必须真实存在（verify-mp 有断言）；无关联写 ''。
   匹配口径见 enAliasMatch：缩写整词命中（不分大小写）；英文全称包含匹配
   仅在关键词 ≥3 字符时启用，防止「as / pe」这类短词过度命中。 */
var EN_ALIAS = [
  ['TTE', 'transthoracic echocardiography', '经胸超声心动图', 'tte-std', '/trænzˈθɔræsɪk ˌekoʊkɑːrdiˈɑːɡrəfi/'],
  ['TEE', 'transesophageal echocardiography', '经食管超声心动图', 'tee-20', '/trænzɪˌsɑfəˈdʒiːəl ˌekoʊkɑːrdiˈɑːɡrəfi/'],
  ['LVEF', 'left ventricular ejection fraction', '左室射血分数', 'lv', '/lɛft vɛnˈtrɪkjələr ɪˈdʒɛkʃn ˈfrækʃn/'],
  ['EF', 'ejection fraction', '射血分数', 'lv', '/ɪˈdʒɛkʃn ˈfrækʃn/'],
  ['GLS', 'global longitudinal strain', '整体纵向应变', 'strain', '/ˈɡloʊbl ˌlɑndʒɪˈtuːdɪnl streɪn/'],
  ['LVMI', 'left ventricular mass index', '左室质量指数', 'lv', '/lɛft vɛnˈtrɪkjələr mæs ˈɪndɛks/'],
  ['LAVI', 'left atrial volume index', '左房容积指数', 'la', '/lɛft ˈeɪtriəl ˈvɑljum ˈɪndɛks/'],
  ['TAPSE', 'tricuspid annular plane systolic excursion', '三尖瓣环收缩期位移', 'rvfun', '/traɪˈkʌspɪd ˈænjələr pleɪn sɪsˈtɑlɪk ɪkˈskɜrʒn/'],
  ['MR', 'mitral regurgitation', '二尖瓣反流', 'mitral', '/ˈmaɪtrəl rɪˌɡɜrdʒɪˈteɪʃn/'],
  ['MS', 'mitral stenosis', '二尖瓣狭窄', 'mitral', '/ˈmaɪtrəl stəˈnoʊsɪs/'],
  ['AR', 'aortic regurgitation', '主动脉瓣反流', 'aortic', '/eɪˈɔrtɪk rɪˌɡɜrdʒɪˈteɪʃn/'],
  ['AS', 'aortic stenosis', '主动脉瓣狭窄', 'aortic', '/eɪˈɔrtɪk stəˈnoʊsɪs/'],
  ['TR', 'tricuspid regurgitation', '三尖瓣反流', 'tr-interv', '/traɪˈkʌspɪd rɪˌɡɜrdʒɪˈteɪʃn/'],
  ['TS', 'tricuspid stenosis', '三尖瓣狭窄', '', '/traɪˈkʌspɪd stəˈnoʊsɪs/'],
  ['PS', 'pulmonary stenosis', '肺动脉瓣狭窄', '', '/ˈpʌlməˌnɛri stəˈnoʊsɪs/'],
  ['PR', 'pulmonary regurgitation', '肺动脉瓣反流', '', '/ˈpʌlməˌnɛri rɪˌɡɜrdʒɪˈteɪʃn/'],
  ['ASD', 'atrial septal defect', '房间隔缺损', 'asd', '/ˈeɪtriəl ˈsɛptl ˈdiːfɛkt/'],
  ['VSD', 'ventricular septal defect', '室间隔缺损', 'vsd', '/vɛnˈtrɪkjələr ˈsɛptl ˈdiːfɛkt/'],
  ['PDA', 'patent ductus arteriosus', '动脉导管未闭', 'pda', '/ˈpeɪtnt ˈdʌktəs ɑrˌtɪriˈoʊsəs/'],
  ['PFO', 'patent foramen ovale', '卵圆孔未闭', 'bubble', '/ˈpeɪtnt fəˈreɪmən oʊˈvɑːli/'],
  ['TOF', 'tetralogy of Fallot', '法洛四联症', 'tof-pr', '/təˈtrælədʒi əv fæˈloʊ/'],
  ['DORV', 'double outlet right ventricle', '右室双出口', 'dorv', '/ˈdʌbl ˈaʊtlɛt raɪt ˈvɛntrɪkl/'],
  ['TGA', 'transposition of the great arteries', '大动脉转位', 'tga', '/ˌtrænspəˈzɪʃn əv ðə ɡreɪt ˈɑrtəriz/'],
  ['TrA', 'truncus arteriosus', '共同动脉干（永存动脉干）', 'truncus', '/ˈtrʌŋkəs ɑrˌtɪriˈoʊsəs/'],
  ['CoA', 'coarctation of the aorta', '主动脉缩窄', 'coa-echo', '/ˌkoʊɑrkˈteɪʃn əv ði eɪˈɔrtə/'],
  ['IAA', 'interrupted aortic arch', '主动脉弓离断', 'iaa', '/ˌɪntəˈrʌptɪd eɪˈɔrtɪk ɑrtʃ/'],
  ['TAPVC', 'total anomalous pulmonary venous connection', '完全型肺静脉异位引流', 'pvai', '/ˈtoʊtl æˈnɑmələs ˈpʌlməˌnɛri ˈviːnəs kəˈnɛkʃn/'],
  ['ALCAPA', 'anomalous left coronary artery from the pulmonary artery', '左冠状动脉异常起源于肺动脉', 'aca', '/æˈnɑmələs lɛft ˈkɔrnəˌnɛri ˈɑrtəri frʌm ðə ˈpʌlməˌnɛri ˈɑrtəri/'],
  ['CAF', 'coronary artery fistula', '冠状动脉瘘', 'caf', '/ˈkɔrnəˌnɛri ˈɑrtəri ˈfɪstʃələ/'],
  ['BAV', 'bicuspid aortic valve', '主动脉瓣二叶式畸形', 'bav', '/baɪˈkʌspɪd eɪˈɔrtɪk vælv/'],
  ['PH', 'pulmonary hypertension', '肺高血压', 'zh-ph', '/ˈpʌlməˌnɛri ˌhaɪpərˈtɛnʃn/'],
  ['PE', 'pulmonary embolism', '肺栓塞', 'pe', '/ˈpʌlməˌnɛri ˈɛmbəlɪzəm/'],
  ['DVT', 'deep vein thrombosis', '深静脉血栓形成', 'pe', '/diːp veɪn θrɑmˈboʊsɪs/'],
  ['CTEPH', 'chronic thromboembolic pulmonary hypertension', '慢性血栓栓塞性肺高血压', 'pe', '/ˈkrɑnɪk ˌθrɑmboʊˈɛmbəlɪk ˈpʌlməˌnɛri ˌhaɪpərˈtɛnʃn/'],
  ['HCM', 'hypertrophic cardiomyopathy', '肥厚型心肌病', 'hcm', '/ˌhaɪpərˈtroʊfɪk ˌkɑrdioʊmaɪˈɑpəθi/'],
  ['DCM', 'dilated cardiomyopathy', '扩张型心肌病', 'dcm', '/daɪˈleɪtɪd ˌkɑrdioʊmaɪˈɑpəθi/'],
  ['ARVC', 'arrhythmogenic right ventricular cardiomyopathy', '致心律失常性右室心肌病', 'arvc', '/əˌrɪðməˈdʒɛnɪk raɪt vɛnˈtrɪkjələr ˌkɑrdioʊmaɪˈɑpəθi/'],
  ['LVNC', 'left ventricular noncompaction', '左室心肌致密化不全', 'nc-lv', '/lɛft vɛnˈtrɪkjələr ˌnɑnkəmˈpækʃn/'],
  ['PPCM', 'peripartum cardiomyopathy', '围产期心肌病', 'ppcm', '/ˌpɛrɪˈpɑrtəm ˌkɑrdioʊmaɪˈɑpəθi/'],
  ['CTRCD', 'cancer therapy-related cardiac dysfunction', '肿瘤治疗相关心功能不全', 'ctrcd', '/ˈkænsər ˈθɛrəpi rɪˈleɪtɪd ˈkɑrdiæk dɪsˈfʌŋkʃn/'],
  ['IE', 'infective endocarditis', '感染性心内膜炎', 'ie', '/ɪnˈfɛktɪv ˌɛndoʊkɑːrdaɪˈaɪtɪs/'],
  ['CRT', 'cardiac resynchronization therapy', '心脏再同步化治疗', 'crt', '/ˈkɑrdiæk riˌsɪŋkrənəˈzeɪʃn ˈθɛrəpi/'],
  ['LVAD', 'left ventricular assist device', '左室辅助装置', 'lvad', '/lɛft vɛnˈtrɪkjələr əˈsɪst dɪˈvaɪs/'],
  ['ECMO', 'extracorporeal membrane oxygenation', '体外膜肺氧合', 'ecmo', '/ˌɛkstrəkɔrˈpiːriəl ˈmɛmbreɪn ˌɑksɪdʒəˈneɪʃn/'],
  ['TAVR', 'transcatheter aortic valve replacement', '经导管主动脉瓣置换', 'tavr', '/trænsˈkæθətər eɪˈɔrtɪk vælv rɪˈpleɪsmənt/'],
  ['TEER', 'transcatheter edge-to-edge repair', '经导管缘对缘修复', 'mv-interv', '/trænsˈkæθətər ɛdʒ tə ɛdʒ rɪˈpɛr/'],
  ['IVC', 'inferior vena cava', '下腔静脉', 'rv', '/ɪnˈfɪriər ˈviːnə ˈkeɪvə/'],
  ['RAP', 'right atrial pressure', '右房压', 'rv', '/raɪt ˈeɪtriəl ˈprɛʃər/'],
  ['PASP', 'pulmonary artery systolic pressure', '肺动脉收缩压', 'zh-ph', '/ˈpʌlməˌnɛri ˈɑrtəri sɪsˈtɑlɪk ˈprɛʃər/'],
  ['PVR', 'pulmonary vascular resistance', '肺血管阻力', 'zh-ph', '/ˈpʌlməˌnɛri ˈvæskjələr rɪˈzɪstəns/'],
  ['LVOT', 'left ventricular outflow tract', '左室流出道', 'lv', '/lɛft vɛnˈtrɪkjələr ˈaʊtfloʊ trækt/'],
  ['RVOT', 'right ventricular outflow tract', '右室流出道', 'rv', '/raɪt vɛnˈtrɪkjələr ˈaʊtfloʊ trækt/'],
  ['EROA', 'effective regurgitant orifice area', '有效反流口面积', 'mitral', '/ɪˈfɛktɪv rɪˈɡɜrdʒɪtənt ˈɔrɪfɪs ˈɛriə/'],
  ['PISA', 'proximal isovelocity surface area', '近端等速表面积', 'mitral', '/ˈprɑksəməl ˌaɪsoʊvəˈlɑsəti ˈsɜrfɪs ˈɛriə/'],
  ['VTI', 'velocity time integral', '速度时间积分', 'doppler-basics', '/vəˈlɑsəti taɪm ˈɪntɪɡrəl/'],
  ['SAM', 'systolic anterior motion', '收缩期前向运动', 'hcm', '/sɪsˈtɑlɪk ænˈtɪriər ˈmoʊʃn/'],
  ['RWMA', 'regional wall motion abnormality', '节段性室壁运动异常', 'stress-echo', '/ˈriːdʒənl wɔl ˈmoʊʃn ˌæbnɔrˈmæləti/'],
  ['MVA', 'mitral valve area', '二尖瓣口面积', 'mitral', '/ˈmaɪtrəl vælv ˈɛriə/'],
  ['BSA', 'body surface area', '体表面积', '', '/ˈbɑdi ˈsɜrfɪs ˈɛriə/'],
  ['SV', 'stroke volume', '每搏输出量', '', '/stroʊk ˈvɑljum/'],
  ['CO', 'cardiac output', '心输出量', '', '/ˈkɑrdiæk ˈaʊtpʊt/'],
  ['ASO', 'arterial switch operation', '大动脉调转术', 'as-switch', '/ɑrˈtɪriəl swɪtʃ ˌɑpəˈreɪʃn/'],
  ['CEUS', 'contrast-enhanced ultrasound', '超声造影', 'contrast-echo', '/ˈkɑntræst ɪnˈhænst ˈʌltrəsaʊnd/'],
  ['DSE', 'dobutamine stress echocardiography', '多巴酚丁胺负荷超声', 'dse', '/ˌdoʊˈbjuːtəmiːn strɛs ˌekoʊkɑːrdiˈɑːɡrəfi/'],
  ['NYHA', 'New York Heart Association functional class', '纽约心脏协会心功能分级', '', '/nuː jɔrk hɑrt əˌsoʊsiˈeɪʃn ˈfʌŋkʃənl klæs/'],
  ['Qp/Qs', 'pulmonary-to-systemic flow ratio', '肺循环与体循环血流比', 'asd', '/ˈpʌlməˌnɛri tə sɪsˈtɛmɪk floʊ ˈreɪʃioʊ/'],
  ['IVRT', 'isovolumetric relaxation time', '等容舒张时间', 'lv', '/ˌaɪsoʊˌvɑljʊˈmɛtrɪk ˌriːlækˈseɪʃn taɪm/'],
  ['TDI', 'tissue Doppler imaging', '组织多普勒成像', '', '/ˈtɪʃu ˈdɑplər ˈɪmədʒɪŋ/'],
  ['CP', 'constrictive pericarditis', '缩窄性心包炎', 'cp-rm', '/kənˈstrɪktɪv ˌpɛrɪkɑːrˈdaɪtɪs/'],
  ['RCM', 'restrictive cardiomyopathy', '限制型心肌病', 'cp-rm', '/rɪˈstrɪktɪv ˌkɑrdioʊmaɪˈɑpəθi/'],
  ['PW', 'pulsed wave Doppler', '脉冲波多普勒', 'doppler-basics', '/pʌlst weɪv ˈdɑplər/'],
  ['CW', 'continuous wave Doppler', '连续波多普勒', 'doppler-basics', '/kənˈtɪnjuəs weɪv ˈdɑplər/'],
  // ── v1.13.7：补充常用切面 / 腔室 / 瓣膜 / 测量术语 ──
  ['PLAX', 'parasternal long-axis view', '胸骨旁左室长轴切面', '', '/ˌpærəˈstɜrnl lɔŋ ˈæksɪs vjuː/'],
  ['PSAX', 'parasternal short-axis view', '胸骨旁短轴切面', '', '/ˌpærəˈstɜrnl ʃɔrt ˈæksɪs vjuː/'],
  ['A4C', 'apical four-chamber view', '心尖四腔心切面', '', '/ˈæpɪkl fɔr ˈtʃeɪmbər vjuː/'],
  ['A2C', 'apical two-chamber view', '心尖二腔心切面', '', '/ˈæpɪkl tu ˈtʃeɪmbər vjuː/'],
  ['A3C', 'apical long-axis (three-chamber) view', '心尖长轴（三腔心）切面', '', '/ˈæpɪkl lɔŋ ˈæksɪs vjuː/'],
  ['A5C', 'apical five-chamber view', '心尖五腔心切面', '', '/ˈæpɪkl faɪv ˈtʃeɪmbər vjuː/'],
  ['SSN', 'suprasternal notch view', '胸骨上窝切面', '', '/ˌsuprəˈstɜrnl nɑtʃ vjuː/'],
  ['SubC', 'subcostal view', '剑突下切面', '', '/sʌbˈkɑstl vjuː/'],
  ['LV', 'left ventricle', '左心室', 'lv', '/lɛft ˈvɛntrɪkl/'],
  ['RV', 'right ventricle', '右心室', 'rv', '/raɪt ˈvɛntrɪkl/'],
  ['LA', 'left atrium', '左心房', 'la', '/lɛft ˈeɪtriəm/'],
  ['RA', 'right atrium', '右心房', '', '/raɪt ˈeɪtriəm/'],
  ['AO', 'aorta', '主动脉', 'aorta', '/eɪˈɔrtə/'],
  ['PA', 'pulmonary artery', '肺动脉', '', '/ˈpʌlməˌnɛri ˈɑrtəri/'],
  ['MV', 'mitral valve', '二尖瓣', 'mitral', '/ˈmaɪtrəl vælv/'],
  ['AV', 'aortic valve', '主动脉瓣', 'aortic', '/eɪˈɔrtɪk vælv/'],
  ['TV', 'tricuspid valve', '三尖瓣', 'tr-interv', '/traɪˈkʌspɪd vælv/'],
  ['PV', 'pulmonary valve', '肺动脉瓣', '', '/ˈpʌlməˌnɛri vælv/'],
  ['LVEDD', 'left ventricular end-diastolic diameter', '左室舒张末期内径', 'lv', '/lɛft vɛnˈtrɪkjələr ɛnd ˌdaɪəˈstɑlɪk daɪˈæmətər/'],
  ['FS', 'fractional shortening', '左室短轴缩短率', 'lv', '/ˈfrækʃənl ˈʃɔrtnɪŋ/'],
  ['RF', 'regurgitant fraction', '反流分数', 'mitral', '/rɪˈɡɜrdʒɪtənt ˈfrækʃn/'],
  ['RVol', 'regurgitant volume', '反流量', 'mitral', '/rɪˈɡɜrdʒɪtənt ˈvɑljum/'],
  ['VC', 'vena contracta', '缩流颈', 'mitral', '/ˈviːnə kənˈtræktə/'],
  // ── v1.13.14：补血流动力学 / 容量指数 / 影像模态类缩写（用户反馈「看不懂」）──
  // ★ 这批多是右心导管或报告里常见的量，超声只能「估」，中文列已注明口径
  ['RVSP', 'right ventricular systolic pressure', '右室收缩压（超声估）', 'vsd', '/raɪt vɛnˈtrɪkjələr sɪsˈtɑlɪk ˈprɛʃər/'],
  ['sPAP', 'systolic pulmonary artery pressure', '肺动脉收缩压（同 PASP）', 'pht-rev', '/sɪsˈtɑlɪk ˈpʌlməˌnɛri ˈɑrtəri ˈprɛʃər/'],
  ['dPAP', 'diastolic pulmonary artery pressure', '肺动脉舒张压', 'pht-rev', '/ˌdaɪəˈstɑlɪk ˈpʌlməˌnɛri ˈɑrtəri ˈprɛʃər/'],
  ['mPAP', 'mean pulmonary artery pressure', '肺动脉平均压', 'pht-rev', '/miːn ˈpʌlməˌnɛri ˈɑrtəri ˈprɛʃər/'],
  ['PVRI', 'pulmonary vascular resistance index', '肺血管阻力指数（需右心导管）', 'pht-rev', '/ˈpʌlməˌnɛri ˈvæskjələr rɪˈzɪstəns ˈɪndɛks/'],
  ['WU', 'Wood unit', 'Wood 单位（mmHg·min/L）', 'pht-rev', '/wʊd ˈjuːnɪt/'],
  ['PCWP', 'pulmonary capillary wedge pressure', '肺毛细血管楔压', 'zh-ph', '/ˈpʌlməˌnɛri ˈkæpəˌlɛri wɛdʒ ˈprɛʃər/'],
  ['CI', 'cardiac index', '心指数（CO ÷ BSA）', '', '/ˈkɑrdiæk ˈɪndɛks/'],
  ['SVi', 'stroke volume index', '每搏量指数', '', '/stroʊk ˈvɑljum ˈɪndɛks/'],
  ['PHT', 'pressure half-time', '压力减半时间', 'mitral', '/ˈprɛʃər hæf taɪm/'],
  ['DT', 'deceleration time', '减速时间', 'lv', '/diːˌsɛləˈreɪʃn taɪm/'],
  ['PG', 'pressure gradient', '压差', 'doppler-basics', '/ˈprɛʃər ˈɡreɪdiənt/'],
  ['Vmax', 'peak velocity', '峰值流速', 'doppler-basics', '/piːk vəˈlɑsəti/'],
  ['TR Vmax', 'tricuspid regurgitation peak velocity', '三尖瓣反流峰值流速', 'pht-rev', '/traɪˈkʌspɪd rɪˌɡɜrdʒɪˈteɪʃn piːk vəˈlɑsəti/'],
  ['RVOT VTI', 'right ventricular outflow tract velocity-time integral', '右室流出道速度时间积分', 'pht-rev', '/raɪt vɛnˈtrɪkjələr ˈaʊtfloʊ trækt vəˈlɑsəti taɪm ˈɪntɪɡrəl/'],
  ['LVEDVi', 'left ventricular end-diastolic volume index', '左室舒张末期容积指数', 'lv', '/lɛft vɛnˈtrɪkjələr ɛnd ˌdaɪəˈstɑlɪk ˈvɑljum ˈɪndɛks/'],
  ['LVESVi', 'left ventricular end-systolic volume index', '左室收缩末期容积指数', 'lv', '/lɛft vɛnˈtrɪkjələr ɛnd sɪsˈtɑlɪk ˈvɑljum ˈɪndɛks/'],
  ['LVESDi', 'left ventricular end-systolic dimension index', '左室收缩末期内径指数', 'aortic', '/lɛft vɛnˈtrɪkjələr ɛnd sɪsˈtɑlɪk daɪˈmɛnʃn ˈɪndɛks/'],
  ['RVEDVi', 'right ventricular end-diastolic volume index', '右室舒张末期容积指数', 'rv', '/raɪt vɛnˈtrɪkjələr ɛnd ˌdaɪəˈstɑlɪk ˈvɑljum ˈɪndɛks/'],
  ['FAC', 'fractional area change', '面积变化分数', 'rvfun', '/ˈfrækʃənl ˈɛriə tʃeɪndʒ/'],
  ['MAPSE', 'mitral annular plane systolic excursion', '二尖瓣环收缩期位移', 'lv', '/ˈmaɪtrəl ˈænjələr pleɪn sɪsˈtɑlɪk ɪkˈskɜrʒn/'],
  ['MPI', 'myocardial performance index (Tei index)', '心肌做功指数（Tei 指数）', 'rvfun', '/ˌmaɪəˈkɑrdiəl pərˈfɔrməns ˈɪndɛks/'],
  ['AVA', 'aortic valve area', '主动脉瓣口面积', 'aortic', '/eɪˈɔrtɪk vælv ˈɛriə/'],
  ['EOA', 'effective orifice area', '有效瓣口面积', 'prosthetic', '/ɪˈfɛktɪv ˈɔrɪfɪs ˈɛriə/'],
  ['DVI', 'dimensionless index', '无量纲指数', 'aortic', '/dɪˈmɛnʃənləs ˈɪndɛks/'],
  ['ICE', 'intracardiac echocardiography', '心腔内超声', 'tee-20', '/ˌɪntrəˈkɑrdiæk ˌekoʊkɑːrdiˈɑːɡrəfi/'],
  ['CCT', 'cardiac computed tomography', '心脏 CT', 'aorta', '/ˈkɑrdiæk kəmˈpjutɪd toʊˈmɑɡrəfi/'],
  ['LGE', 'late gadolinium enhancement', '延迟钆增强', '', '/leɪt ˌɡædəˈlɪniəm ɪnˈhænsmənt/'],
  ['6MWD', 'six-minute walk distance', '六分钟步行距离', 'zh-ph', '/sɪks ˈmɪnɪt wɔk ˈdɪstəns/'],
  ['RVFWS', 'right ventricular free wall strain', '右室游离壁应变', 'rvfun', '/raɪt vɛnˈtrɪkjələr friː wɔl streɪn/'],
];

/**
 * 搜索关键词补充表（v1.14.1）
 *
 * ★ 为什么需要：公式集目录只按「标题 + 一句话说明」匹配，而临床口语与标题常对不上
 *   ——用户搜「平均压」时，条目叫「肺动脉压 · 肺高压评估」，一个字都不重合，结果 0 条
 *   （2026-11-03 用户反馈）。这里给每条补一行同义词/口语别名，只参与搜索，不进目录、不影响计数。
 * ★ 键 = calc 组 id 或 brief 条目 id；值 = 空格分隔的关键词（小写，含中文与英文缩写）。
 */
var SEARCH_KW = {
  /* TEE 检查流程（2026-11-10 新增，依据 R60 浙江省专家共识 1 TEE 规范操作） */
  'tee-safety': 'TEE 检查流程 经食管超声 检查前准备 禁食 禁水 口咽麻醉 利多卡因 咬嘴 探头置入 吞咽 梨状隐窝 监护 血氧饱和度 复苏室 术后禁食 禁忌证 并发症发生率 tee',
  /* ── 右心与肺循环：压力/阻力类，口语叫法最多 ── */
  mpap: '平均压 平均压差 平均肺动脉压 肺动脉平均压 肺动脉压 收缩压 舒张压 肺高压 肺动脉高压 压力分度 压力分级 右房压 中心静脉压 cvp 右房压力',
  pvrv: '肺血管阻力 肺阻力 阻力指数 肺高压 手术可根治性',
  residx: '阻力 体循环阻力 肺循环阻力',
  papi: '肺动脉搏动指数 搏动指数 失耦联 右室 肺高压',
  /* ★ 2026-11-09 体检：原键 rapv 指向已删除的旧计算器，kwOf 按条目 id 查表，
     同义词永远读不到 → 搜「右房压 / 中心静脉压」0 结果。现挂到真实条目 ivc 与 mpap。 */
  ivc: '右房压 中心静脉压 cvp 右房压力 下腔静脉估压',
  rvvol: '右室容积 右室扩大 容积指数',
  rvfacv: '右室面积变化分数 右室收缩功能',
  rvfws: '右室游离壁应变 右室应变',
  quickratio: '右室左室比 右室扩大 比值',
  svrv: '右室每搏量 每搏输出量',
  tr: '三尖瓣反流 反流定量 缩流颈',
  paidx: '肺动脉指数 肺动脉发育',
  /* ── 瓣膜：狭窄/反流的口语说法（★ 2026-11-09 由旧 as/ar/ms/mr 四个孤儿键
     迁到真实的 aortic / mitral 条目；旧 id 已不在任何目录里，kwOf 读不到） ── */
  aortic: '主动脉瓣狭窄 主动脉瓣反流 平均压差 瓣口面积 跨瓣压差 反流分数 缩流颈',
  mitral: '二尖瓣狭窄 二尖瓣反流 瓣口面积 平均压差 反流定量 缩流颈',
  dfun: '舒张功能 e/a 舒张性心衰',
  laasz: '左房僵硬 左房应变',
  /* ── 判读条目：疾病/术式别名 ── */
  rv: '右心 右室 右心功能 肺高压 肺动脉压',
  'pht-rev': '肺高压 肺动脉高压 肺血管阻力 可手术性 靶向药',
  'zh-ph': '中国肺高血压指南 肺高压 肺动脉高压',
  critical: '危急值 急诊 床旁 肺高压',
  osa: '睡眠呼吸暂停 肺高压',
  rheumatic: '风湿性 二尖瓣狭窄 介入',
  'ped-base': '儿童 z 值 节段分析 situs 剑下',
  /* ── 造影双条目：口语叫法（用户 2026-11-05 反馈搜「左心造影」0 条） ── */
  'contrast-echo': '左心造影 左心超声造影 左室腔显影 左室造影 心内膜边界 心肌灌注 声诺维 造影剂 超声造影 心脏超声造影 lvo ebd mce sonovue definity optison ceus 心尖血栓',
  bubble: '右心声学造影 右心造影 右心声学 发泡试验 振荡盐水 震荡盐水 微泡 卵圆孔未闭 右向左分流 肺内分流 肺动静脉瘘 声学造影 气泡 pfo valsalva',
};


/** 取某条目的补充搜索词（小写；无则空串） */
function kwOf(id) {
  var s = SEARCH_KW[id];
  return s ? s.toLowerCase() : '';
}

/** 中英对照搜索匹配：返回 [{ab, en, zh, to}]；q 为空返回 [] */
function enAliasMatch(q) {
  q = (q || '').trim().toLowerCase();
  if (!q) return [];
  var out = [];
  // ★ v1.14.1：中文也能搜（「平均压」→ 肺动脉平均压 mPAP）。
  //   只对含中文的关键词启用，否则 'as' 这类两字英文会命中 zh 里的 PASP 等缩写。
  var hasCJK = /[\u4e00-\u9fff]/.test(q);
  for (var i = 0; i < EN_ALIAS.length; i++) {
    var a = EN_ALIAS[i];
    var hitAb = a[0].toLowerCase() === q;
    // 英文全称包含匹配只在关键词 ≥3 字符时启用，防止「as / pe」这类短词过度命中
    var hitEn = q.length >= 3 && a[1].toLowerCase().indexOf(q) !== -1;
    var hitZh = hasCJK && q.length >= 2 && a[2].toLowerCase().indexOf(q) !== -1;
    if (hitAb || hitEn || hitZh) {
      out.push({ ab: a[0], en: a[1], zh: a[2], to: a[3] || '' });
    }
  }
  return out;
}

/**
 * 长段落 → 短段落（v1.14.2，三端共用）
 *
 * ★ 起因：用户 2026-11-03 反馈「文字多的地方很挤，排版很乱」。
 *   排查发现 775 个正文 text 块里，317 块在 120–249 字、14 块 250–399 字、
 *   最长 563 字，全部**一次性连排**成一个 <div>（行高 1.65、无段间距）——
 *   手机上就是一堵墙。数据本身没错，是**排版缺了分段的层次**。
 *
 * ★ 所以不逐条手改内容（会漏、会破坏医学术语），而是在渲染层统一切段：
 *   ① 显式 `\n` 仍优先（作者手写的换行必须尊重）；
 *   ② 出现 ≥2 个 ①②③ 枚举 → 每项独立成段（这类几乎都是并列清单）；
 *   ③ 否则按「。」「！」「？」聚合成 55–80 字的自然段；
 *   ④ 单句仍 >90 字 → 再按「；」拆（并列的定量口径适合一行一条）。
 *
 * ★ 安全约束：断点处**不加任何字符**，段间拼接后与原文完全一致（verify 的文本检索断言不受影响）；
 *   且只在 `**` 计数为偶数的位置断，避免粗体标记被切到两段里各漏一半。
 */
var ENUM_MARKS = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

/** 位置 pos 之前出现的 `**` 是否为奇数（奇数＝在粗体内部，不能断） */
function boldOpenAt(s, pos) {
  var n = 0;
  for (var i = 0; i + 1 < pos; i++) {
    if (s.charAt(i) === '*' && s.charAt(i + 1) === '*') { n++; i++; }
  }
  return n % 2 === 1;
}

/** 按分隔符切，但跳过粗体内部 / 括号内部的切点 */
function safeSplit(s, sep) {
  var out = [], last = 0, depth = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charAt(i);
    if (c === '（' || c === '(') depth++;
    else if ((c === '）' || c === ')') && depth > 0) depth--;
    if (c !== sep) continue;
    if (depth > 0) continue;
    if (boldOpenAt(s, i)) continue;
    var piece = s.slice(last, i + 1).trim();
    if (piece) out.push(piece);
    last = i + 1;
  }
  var tail = s.slice(last).trim();
  if (tail) out.push(tail);
  return out;
}

/** 把碎片聚合回 60–85 字的自然段（分号/逗号切出来的碎片太短，连着读更自然） */
function reglue(pieces, limit) {
  var out = [], acc = '';
  for (var i = 0; i < pieces.length; i++) {
    var x = pieces[i];
    if (acc && (acc.length + x.length) > limit) { out.push(acc); acc = ''; }
    acc += x;
  }
  if (acc) out.push(acc);
  return out;
}

/** 该段是否以枚举符号起头（渲染时给悬挂缩进） */
function isHangPara(s) {
  if (!s) return false;
  if (ENUM_MARKS.indexOf(s.charAt(0)) !== -1) return true;
  return /^\d+[.、)）]/.test(s);
}

function paraSplit(t) {
  var s = String(t == null ? '' : t);
  if (!s) return [];
  var out = [];

  s.split(/\n/).forEach(function (line) {
    var p = line.trim();
    if (!p) return;
    if (p.length <= 55) { out.push(p); return; }

    // ② 枚举清单：从第二个序号起断开，每项一段（括号内的序号不切）
    var idxs = [], dep = 0;
    for (var i = 0; i < p.length; i++) {
      var _c = p.charAt(i);
      if (_c === '（' || _c === '(') dep++;
      else if ((_c === '）' || _c === ')') && dep > 0) dep--;
      if (ENUM_MARKS.indexOf(_c) !== -1 && dep === 0 && !boldOpenAt(p, i)) idxs.push(i);
    }
    if (idxs.length >= 2) {
      var start = 0;
      for (var k = 1; k < idxs.length; k++) {
        out.push(p.slice(start, idxs[k]).trim());
        start = idxs[k];
      }
      out.push(p.slice(start).trim());
      return;
    }

    // ③ 按句末标点切句 → 聚合成自然段
    var sents = [], buf = '';
    for (var j = 0; j < p.length; j++) {
      var ch = p.charAt(j);
      buf += ch;
      if (ch === '*' && p.charAt(j + 1) === '*') { buf += '*'; j++; continue; }
      if ((ch === '。' || ch === '！' || ch === '？') && !boldOpenAt(p, j)) {
        sents.push(buf); buf = '';
      }
    }
    if (buf) sents.push(buf);

    var cur = '';
    for (var q = 0; q < sents.length; q++) {
      var one = sents[q];
      if (one.length > 90) {
        if (cur) { out.push(cur); cur = ''; }
        // 长主句（没有句号可断）→ 按分号拆，再聚合回 60–85 字；仍超长再退到逗号
        var pieces = safeSplit(one, '；');
        if (pieces.length === 1) pieces = safeSplit(one, '，');
        reglue(pieces, 85).forEach(function (x) { out.push(x); });
        continue;
      }
      if (cur && (cur.length + one.length) > 80) { out.push(cur); cur = ''; }
      cur += one;
    }
    if (cur) out.push(cur);
  });

  // ④ 兜底：极少数「必须写明：A、B、C、D…」式长顿号列举，按顿号再切一层
  var fin = [];
  out.forEach(function (p) {
    if (p.length <= 110) { fin.push(p); return; }
    if ((p.match(/、/g) || []).length < 4) { fin.push(p); return; }
    reglue(safeSplit(p, '、'), 62).forEach(function (x) { fin.push(x); });
  });

  return fin.filter(function (x) { return !!x; });
}

/**
 * 计算类条目 → 参考来源（v1.13.8）
 *
 * ★ 为什么单独一张表：计算器组（calc-groups.js）只有字段和公式、没有 source 字段，
 *   所以「公式集」里 40 个计算条目的详情页此前一个文献都不显示，而判读条目全都有。
 *   这里按公式的原始出处逐条指定，详情页复用与判读条目相同的「本条目引用」块。
 * ★ 只放真的算出这个公式/阈值的文献，不为凑数挂不相干的条目。
 */
const CALC_SRC = {
  flow: ['R2'],                    // SV / CO：2015 定量指南的流出道测量
  ef: ['R2'],                      // Simpson 双平面 EF 与容积指数
  lvmass: ['R2', 'R1'],            // Devereux 公式 + 中国成人正常值
  mapse: ['R2'],                   // 长轴缩短
  tei: ['R2', 'R12'],              // Tei 指数（左心 / 右心）
  mpap: ['R11', 'R68', 'R12', 'R104', 'R105'],  // 肺动脉压与 PH 概率（ESC/ERS + 中国指南 + 右心指南 + JCS 2017 + 上海轻度 PASP 队列）
  ivc: ['R5', 'R104', 'R105', 'R106', 'R107'],    // 下腔静脉（ASE 2025 判读 + JCS 2017 沿革 + 上海队列 + 容量反应性 + 2026 呼吸床旁共识）
  bernoulli: ['R2'],               // 简化伯努利方程
  atrial: ['R2', 'R1'],            // LAVI / RAVI
  rvvol: ['R5'],                   // 右室容积指数（ASE 2025 右心）
  papi: ['R11', 'R12'],            // 肺动脉搏动指数
  tr: ['R44', 'R22', 'R81'],       // TR 定量（自体瓣反流 + TVARC + 2025 ESC/EACTS）
  laef: ['R2', 'R4'],              // 左房排空分数
  quickratio: ['R1'],              // LA/Ao、RV/LV 半定量比值
  paidx: ['R32'],                  // McGoon / Nakata（先心根治可行性）
  ras: ['R19', 'R31'],             // 心尖保留比值（淀粉样变）
  ea: ['R2'],                      // 有效动脉弹性
  coa: ['R32', 'R27'],             // 主动脉缩窄（先心指南 + 胸主动脉影像）
  aortaz: ['R27', 'R1'],           // 主动脉分节段内径参考区间
  lastiff: ['R4', 'R24'],          // 左房僵硬度（LASr 相关）
  vtir: ['R32', 'R33'],            // RVOT/LVOT VTI 比替代分流
  ppm: ['R15'],                    // EOAi 与 PPM（人工瓣 2024）
  dfun: ['R14', 'R39', 'R71'],     // 舒张功能四步法 + 2025 更新 + 心衰 A/B 阶段筛查指标
  sync: ['R6', 'R2', 'R108'],              // CRT 与机械不同步
  lastrain: ['R4', 'R24', 'R40'],  // 左房应变三时相
  aortaidx: ['R27', 'R1'],         // 升主动脉直径指数
  mdsv: ['R40', 'R3'],             // 应变离散度
  swv: ['R2'],                     // 每搏功
  mtype: ['R2'],                   // FS / Teichholz / EPSS
  wmsi: ['R26', 'R85', 'R84'],     // 室壁运动积分 + 17 节段模式依据（AHA 2002 命名）
  h2fpef: ['R25', 'R39'],          // H2FPEF 评分
  hfapeff: ['R25', 'R39'],         // HFA-PEFF 评分
  tavrsz: ['R62', 'R30'],          // TAVR 瓣环尺寸与 oversizing
  laasz: ['R38'],                  // 左心耳封堵尺寸（TEE 介入筛查）
  aortagrow: ['R27'],              // 主动脉扩张速率
  pvfu: ['R15', 'R30'],            // 人工瓣跨瓣血流
  cfr: ['R86'],                    // 冠脉血流储备（负荷超声）
  resist: ['R11', 'R72'],          // PVR / SVR 合并页
  rvsyst: ['R5', 'R12'],           // FAC / RVFWS / dP/dt 合并页
  lvgeom: ['R2', 'R1'],            // 质量 · 应力 · 球形度 · 容积 合并页
  tapse: ['R5', 'R16'],            // TAPSE 与 RV-PA 耦联
};

module.exports = {
  BRIEF_SECTIONS: BRIEF_SECTIONS,
  LINK_SECTIONS: LINK_SECTIONS,
  REFS: REFS,
  CALC_SRC: CALC_SRC,
  CALC_LINKS: CALC_LINKS,
  ABBR: ABBR,
  EN_ALIAS: EN_ALIAS,
  enAliasMatch: enAliasMatch,
  paraSplit: paraSplit,
  isHangPara: isHangPara,
  SEARCH_KW: SEARCH_KW,
  kwOf: kwOf,
  abbrHits: abbrHits,
  blockText: blockText,
  secList: secList,
  cnNo: cnNo,
};