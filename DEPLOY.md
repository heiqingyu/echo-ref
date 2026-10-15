# GitHub Pages 上线指南

把「心脏超声参考值」这个网页版发布成一个公开链接，让别人也能打开。

> **重要前提**：本指南发布的 `docs/` 目录里，**只包含你自己原创的三页** ——
> 参数·参考值 / EF 计算 / 儿童 Z 值。
> 转载自 `tte-quickref` 的三个页签（其他计算 / 瓣膜评估 / 节段划分）已经在构建阶段
> 被整块剥离（页签、页面、CSS 样式、JS 引擎全部删除），不会出现在公开网页里，
> 也不会进入 git 仓库。

---

## 〇、先搞清楚要传什么

构建脚本 `build-www.js` 会同时产出两份：

| 文件 | 页签 | 用途 |
|---|---|---|
| `www/index.html` | 6 个（含转载的 3 个） | **本地自用**，不进 git |
| `docs/index.html` | 3 个（仅原创） | **发布用**，只传这个 |

`docs/` 目录就是 GitHub Pages 的「发布源」。里面只有两个文件：

```
docs/
├── index.html    ← 3 页签的纯净版（约 94 KB）
└── .nojekyll     ← 空文件，告诉 GitHub「别用 Jekyll 处理，原样输出」
```

每次改完代码，重新跑一次构建即可刷新 `docs/`：

```bash
cd <project-directory>
node build-www.js
```

---

## 一、安装并配置 Git

你已经装了 Git（版本 2.55）。只需确认身份信息已填：

```bash
git config --global user.name "你的名字"
git config --global user.email "你的邮箱"
```

查一下是否已设置：

```bash
git config --global --get user.name
git config --global --get user.email
```

如果两条都打印出内容，就可以跳过这步。

---

## 二、本地建仓库并提交

在项目目录里执行：

```bash
cd <project-directory>

# 1. 初始化仓库
git init

# 2. 指定主干名称为 main（GitHub 默认用 main）
git branch -M main

# 3. 把文件加入暂存区
git add .

# 4. 看一眼要提交什么（确认没有参考素材、原型草图混进去）
git status

# 5. 提交
git commit -m "心脏超声参考值 · 网页版首次发布"
```

`.gitignore` 已经写好，会自动排除这些东西：

- `ref-tte/`、`_attic/` —— 第三方参考素材
- `prototype.html`、`prototype-peds.html` —— 原型草图
- `.debug-*` —— 调试临时文件
- `project.private.config.json` —— 微信开发者工具的本地配置

> 提交前请用 `git status` 确认一下列表里没有你不希望公开的文件。

---

## 三、在 GitHub 上新建仓库

1. 浏览器打开 <https://github.com/new>
2. 填写：
   - **Repository name**：比如 `echo-ref`（只能用英文/数字/连字符）
   - **Description**：可留空，或写「心脏超声参考值速查（学习用）」
   - **Public / Private**：⚠️ **必须选 Public**
     （免费账号的 Pages 只能从公开仓库发布）
3. **不要**勾选 "Add a README file" / "Add .gitignore" / "Choose a license"
   —— 本地已经有内容了，勾了会造成冲突
4. 点 **Create repository**

创建后会看到一个空仓库页面，上面有一段 `git remote add origin ...` 的命令。

---

## 四、把本地仓库推上去

把下面命令里的 `你的用户名` 和 `echo-ref`（仓库名）换成你自己的：

```bash
cd <project-directory>

# 关联远端仓库
git remote add origin https://github.com/你的用户名/echo-ref.git

# 推送
git push -u origin main
```

### 关于登录

推送时会要求认证。GitHub 从 2021 年起**不再支持账号密码**，要用下面两种方式之一：

**方式 A：Personal Access Token（推荐，最省事）**

1. 打开 <https://github.com/settings/tokens>
2. 点 **Generate new token** → 选 **Tokens (classic)**
3. Note 随便写；Expiration 建议选 90 天或 No expiration
4. 勾选权限：**`repo`**（整组）和 **`workflow`**
5. 点 Generate，**立刻把生成的 token 复制下来**（页面关掉就再也看不到了）
6. 推送时：
   - `Username`：填你的 GitHub 用户名
   - `Password`：**粘贴那个 token**（不是账号密码）

Windows 上第一次输入后，系统会调用「凭据管理器」把它存起来，之后就不用再输了。

**方式 B：用 GitHub Desktop / VS Code 登录**

如果你装了 GitHub Desktop，可以直接用它的图形界面推送，不需要手敲 token。

---

## 五、开启 GitHub Pages

推送成功后：

1. 打开仓库页面 `https://github.com/你的用户名/echo-ref`
2. 点顶部 **Settings**（设置）
3. 左侧栏找到 **Pages**（在 "Code and automation" 分组下）
4. **Build and deployment** 区域：
   - **Source**：选 `Deploy from a branch`
   - **Branch**：第一个下拉选 **`main`**，第二个下拉选 **`/docs`**
   - 点 **Save**
5. 等 1～2 分钟，刷新页面，顶部会出现绿色提示：

   > ✅ Your site is live at `https://你的用户名.github.io/echo-ref/`

### 你的访问地址

```
https://你的用户名.github.io/echo-ref/
```

比如用户名是 `bdrwss`、仓库名是 `echo-ref`，地址就是：

```
https://bdrwss.github.io/echo-ref/
```

> 注意末尾的 `/`，不加也能访问，但加上更稳。
> 仓库名若取作 `你的用户名.github.io`，地址就是 `https://你的用户名.github.io/`（根路径）。
> 本项目建议用普通仓库名，地址带子路径，更清晰。

---

## 六、以后怎么更新

每次改完代码，走这三步：

```bash
cd <project-directory>

# 1. 重新构建（刷新 docs/index.html）
node build-www.js

# 2. 提交
git add .
git commit -m "更新：xxx"

# 3. 推送
git push
```

推上去之后，GitHub 会在 **1～2 分钟内**自动重新部署。刷新网页即可看到新版本。

> 如果改了没生效：先强制刷新浏览器（`Ctrl + F5`）清缓存；
> 再到仓库的 **Actions** 标签页看部署有没有报错。

---

## 七、费用问题

**完全免费，不需要绑银行卡。** 个人用这种规模绰绰有余。

| 项目 | 免费额度 | 本项目的实际占用 |
|---|---|---|
| 托管费用 | 永久免费 | — |
| 仓库容量 | 建议 ≤ 1 GB | 约 100 KB |
| 月访问流量 | 软上限 100 GB/月 | 单次打开约 94 KB |
| 构建次数 | 软上限 10 次/小时 | 只有你推送时才触发 |

「软上限」的意思是：超了不会立刻收费，而是会给你发提醒邮件；真有异常流量时 GitHub 会先联系你，不会直接扣钱。

**使用条款上要注意的**：GitHub Pages 允许个人项目、作品集、文档站点，甚至允许一定的商业用途，但**不允许把它当成电商或 SaaS 类经营站点**（比如挂支付、做在线商城）。你这个是个人速查工具，完全没问题。

---

## 八、三个要提醒你的点

### 1. 仓库是公开的，代码所有人可见

免费版必须用 Public 仓库。这意味着：

- `docs/index.html` 里的**全部源码**（包括 JS 引擎、参考值数据）任何人都能查看和下载
- 好在发布版里已经**完全不含**转载自 `tte-quickref` 的三个页签 —— 这点已通过自动化校验确认（`verify-docs.js` 会检查 `节段划分` / `瓣膜评估` / `PISA` / `Wilkins` 等关键词零残留）

### 2. 免责声明已经在页面里

发布版顶部会自动插入一段说明：

> **关于本页** —— 本页为个人整理的成人经胸超声（TTE）参考值速查工具……
> **本页内容为自行整理，非任何学会或机构的官方产品**，仅供医学教育与速查使用；
> 参考值需结合患者体型、血流状态及测量方法，**不能单凭一个指标作出诊断**。

如果想改措辞，编辑 `build-www.js` 里 `buildPublicHtml()` 末尾那段 `<div class="pubnote">` 即可，重新构建就会生效。

### 3. 国内访问 `github.io` 不稳定

这是客观情况：`*.github.io` 在国内没有 CDN 节点，**时快时慢，偶尔会打不开**。

如果只是自己和同事看，问题不大。若想给更多人稳定访问，可以考虑：

- **腾讯云 / 阿里云对象存储 + CDN**（静态托管，有免费额度，国内访问快）
- **Cloudflare Pages**（免费，全球 CDN，国内比 github.io 稍好）
- **Gitee Pages**（码云，国内快，但需要实名认证，且免费版功能受限）

这些方案的文件都是一样的 —— 上传 `docs/index.html` 这一个文件就行。

---

## 九、常见问题

**Q：Push 报 `remote: Support for password authentication was removed`**
A：用了账号密码。改用 Personal Access Token（见第四步「方式 A」）。

**Q：Pages 设置里找不到 `/docs` 这个选项**
A：说明 `docs/` 目录还没推上去。先确认 `git push` 成功、仓库里能看到 `docs/index.html`。

**Q：打开网址是 404**
A：三种可能 —— ① 刚推送，还没部署完（等 2 分钟）；② Pages 的 Branch 没选 `/docs`；③ `docs/` 里没有 `index.html`。
先到仓库 **Actions** 标签页看部署记录有没有红色❌。

**Q：网页样式全乱了 / 布局错位**
A：可能是 `.nojekyll` 没推上去。GitHub 默认会用 Jekyll 处理站点，它会忽略下划线开头的文件、并可能改动输出。确认 `docs/.nojekyll` 在仓库里存在（空文件也算）。

**Q：想换仓库名 / 换用户名**
A：换仓库名后旧网址会失效，Pages 会给出新地址；换用户名同理。改完记得重新设置远端：
```bash
git remote set-url origin https://github.com/新用户名/新仓库名.git
```

**Q：想停止公开访问**
A：仓库 Settings → Pages → 把 Source 改回 `None`，或在 Settings 最下方 **Delete this repository**。

---

## 附：一页速查

```bash
# 首次发布
cd <project-directory>
node build-www.js
git init && git branch -M main
git add . && git commit -m "首次发布"
git remote add origin https://github.com/你的用户名/echo-ref.git
git push -u origin main
# → 然后到 GitHub 仓库 Settings → Pages → main /docs → Save
# → 地址：https://你的用户名.github.io/echo-ref/

# 后续更新
node build-www.js && git add . && git commit -m "更新" && git push
```
