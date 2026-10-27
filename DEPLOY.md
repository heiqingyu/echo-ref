# GitHub Pages 上线指南

把「心脏超声参考值」这个网页版发布成一个公开链接，让别人也能打开。

> **你的账户信息**（本指南已按此填好命令）
>
> - GitHub 用户名：`heiqingyu`
> - 仓库名：`echo-ref`（已创建，公开）
> - 上线后的地址：**https://heiqingyu.github.io/echo-ref/**

> **进度：只剩最后一步**
>
> | 步骤 | 状态 |
> |---|---|
> | 建仓库 / 关联远端 | ✅ 已完成 |
> | 提交代码（108 个文件） | ✅ 已完成 |
> | 推送到 GitHub | ✅ 已完成 |
> | 清理 git 历史（AppID / 本地路径） | ✅ 已完成（见第七节） |
> | **开启 Pages** | ⬜ **← 你去点两下就行**（见第五节） |
>
> 开启后等 1～2 分钟即可访问：<https://heiqingyu.github.io/echo-ref/>

> **重要前提**：本指南发布的 `docs/` 目录里，**只包含你自己原创的两页** ——  
> EF·参考值 / 儿童 Z 值。  
> 转载自 `tte-quickref` 的三个页签（瓣膜评估 / 节段划分 / 公式集中的转载内容）已经在构建阶段  
> 被整块剥离（页签、页面、CSS 样式、JS 引擎全部删除），不会出现在公开网页里，  
> 也不会进入 git 仓库。

---

## 〇、先搞清楚要传什么

构建脚本 `build-www.js` 会同时产出两份：

| 文件                | 页签                          | 用途                        |
| ----------------- | --------------------------- | ------------------------- |
| `www/index.html`  | 5 个（多了「瓣膜评估」单页）            | 本地预览 / 存档，不进 git          |
| `docs/index.html` | 4 个（EF·参考值 / 节段划分 / 儿童 Z 值 / 公式集） | **发布用 + APK 打包源**         |

> 2026-10-20 定稿：**APK 与小程序、与公开站三者内容一致**，都是 4 个页签。
> 「瓣膜评估」不做单独页 —— 它的判读条目本来就在公式集的「瓣膜评估」组里，
> 只有 5 个瓣膜计算器依赖那个页面，去掉即可。
> 但「节段划分」（室壁划分）必须保留：这正是之前 app 内容比小程序少的原因。

`docs/` 目录就是 GitHub Pages 的「发布源」，同时也是 `build-apk.bat` 的打包源。
里面只有两个文件：

```
docs/
├── index.html    ← 4 页签的纯净版（约 430 KB）
└── .nojekyll     ← 空文件，告诉 GitHub「别用 Jekyll 处理，原样输出」
```

每次改完代码，重新跑一次构建即可刷新 `docs/`：

```bash
cd <project-directory>
node build-www.js
```

---

## 一、安装并配置 Git ✅ 已完成

> **这一步已经处理好了** —— 本地仓库的提交用的是内置身份，不影响推送。
>
> 如果你希望 GitHub 上显示的提交者是你自己的账号，建议顺手设一下全局身份：
>
> ```bash
> git config --global user.name "heiqingyu"
> git config --global user.email "你的GitHub注册邮箱"
> ```
>
> 设完后，以后的新提交就会挂在你的账号名下（已有两个提交的作者仍是内置身份，无妨）。

你已经装了 Git（版本 2.55）。确认身份信息是否已设置：

```bash
git config --global --get user.name
git config --global --get user.email
```

两条都打印出内容就说明配好了。

---

## 二、本地建仓库并提交

> **好消息**：这一步已经帮你做完了 —— 本地仓库已初始化并完成首次提交。  
> 你可以跳到第三步。下面留着是让你知道每一步在干什么，以及以后重建仓库时怎么操作。

在项目目录里执行：

```bash
cd <project-directory>

# 1. 初始化仓库
git init

# 2. 指定主干名称为 main（GitHub 默认用 main）
git branch -M main

# 3. 把文件加入暂存区
git add .

# 4. 看一眼要提交什么（确认没有参考素材、原型草图、签名私钥混进去）
git status

# 5. 提交
git commit -m "心脏超声参考值 · 网页版首次发布"
```

### `.gitignore` 已经排除了什么

| 排除项                                      | 原因                              |
| ---------------------------------------- | ------------------------------- |
| `ref-tte/`、`_attic/`                     | 第三方参考素材，版权风险                    |
| `prototype.html`、`prototype-peds.html`   | 原型草图                            |
| `android-app/keystore.jks`               | ⚠️ **APK 签名私钥**，泄露后他人可用你的名义签发应用 |
| `android-app/build/`、`android-app/dist/` | Android 编译中间产物，体积大且无必要          |
| `android-app/*.log`                      | 编译日志                            |
| `.debug-*`                               | 调试临时文件                          |
| `project.private.config.json`            | 微信开发者工具的本地配置                    |

实际入库 **108 个文件**。提交前请用 `git status` 再确认一遍，确保列表里没有你不希望公开的东西。

> ⚠️ **特别注意 `keystore.jks`**：它是 APK 的签名密钥，一旦推到公开仓库，  
> 任何人都能拿它签发冒牌 APK。`.gitignore` 已排除，但如果你手动 `git add -f` 强推过，  
> 需要从历史记录里彻底清除（用 `git filter-repo` 或直接重建仓库）。

---

## 三、在 GitHub 上新建仓库 ✅ 已完成

> **这一步你已经做完了** —— 仓库 `heiqingyu/echo-ref` 已存在，公开（Public），
> 默认分支 `main`，目前是空的。
>
> 下面留着是让你知道当时该注意什么，以及以后建别的仓库时怎么操作。

1. 浏览器打开 <https://github.com/new>
2. 填写：
   - **Repository name**：`echo-ref`（只能用英文/数字/连字符）
   - **Description**：可留空，或写「心脏超声参考值速查（学习用）」
   - **Public / Private**：⚠️ **必须选 Public**
     （免费账号的 Pages 只能从公开仓库发布）
3. **不要**勾选 "Add a README file" / "Add .gitignore" / "Choose a license"
   —— 本地已经有内容了，勾了会造成冲突
4. 点 **Create repository**

创建后会看到一个空仓库页面，上面有一段 `git remote add origin ...` 的命令。

> **关于 APK**：`EchoRef-v<版本号>.apk` **不进仓库**（已在 `.gitignore` 里）。
> 每次跑 `android-app/build-apk.bat` 都会在仓库根生成一份供本机安装，
> 版本号递增（`android-app/VERSION` 是唯一来源），同签名覆盖安装即可升级。
> APK 仅自用、不对外分发，所以也**不挂 GitHub Releases** ——
> 对外只发小程序，网页版是自用 / 测试。
> 若哪天要分享，`git add -f` 可临时提交（每份约占 1.1 MB 历史体积），
> 或直接单独把 APK 文件发给对方。

---

## 四、把本地仓库推上去 ✅ 已完成

> **全部完成** —— `origin` 已关联，`main` 已推到远端并建立跟踪关系。
> 远端最新提交 `db38e80`，仓库里能看到全部文件。
>
> 下面内容留档：记录**踩过的坑**和对应的解法，以后重新配置时会用到。

### ⚠️ 踩坑记录 1：PowerShell 里敲 `git` 报「无法识别」

**原因**：你机器上没装正式的 Git for Windows，`git` 来自集成环境自带的
PortableGit，而它的目录不在系统 PATH 里。所以：

```
PS> git push -u origin main
git : 无法将“git”项识别为 cmdlet、函数、脚本文件或可运行程序的名称。
```

**三种解法，任选一种。**

---

### ⚠️ 踩坑记录 2：`.bat` 文件中文乱码

**现象**：双击 `推送.bat` 后，命令被拆得七零八落：

```
'"<project-directory>\"' 不是内部或外部命令...
'晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲' 不是内部或外部命令...
```

**原因**：`.bat` 内容是 UTF-8 编码，但 cmd.exe 默认按 GBK（中文 ANSI 代码页）解析，
中文全变成乱码；乱码里又混进了类似引号的字符，把命令都拆坏了。

**解决**：脚本**内容全部改成英文/ASCII**，文件名也改成 ASCII 的 `push.bat`。
纯 ASCII 的文件在任何代码页下都不会乱码。

> 顺带：`.bat` 必须用 **CRLF** 换行；`.ps1` 若要写中文，必须存成
> **UTF-8 with BOM**（PowerShell 5.1 读无 BOM 的 UTF-8 会按 ANSI 解析）。

两者的最终版本均为**纯 ASCII**，无此问题。

---

#### 解法 ①（最省事）：双击项目里的 `push.bat`

项目根目录有个 **`push.bat`**，双击即可。它会自动：

1. 自动定位 git（先查系统 PATH，再查常见安装目录，最后查集成环境自带的 PortableGit）
2. 重新构建网页（`node build-www.js`）
3. 提交改动并推送
4. 完成后显示上线地址

以后每次更新网页，**双击它就行**，不用碰命令行。

> 若想用 PowerShell 版本，也可以跑 `.\push.ps1`（探测逻辑与 `push.bat` 相同）。

---

#### 解法 ②：在 PowerShell 里手动推送

先找到 git 的完整路径：

```powershell
Get-ChildItem "$env:USERPROFILE\.workbuddy\binaries\PortableGit\versions\*\cmd\git.exe" |
  Select-Object -First 1 -ExpandProperty FullName
```

拿到路径后，复制下面**整段**粘进 PowerShell 回车（把 `<git-path>` 换成上面查到的路径）：

```powershell
cd <project-directory>
& "<git-path>" push -u origin main
```

推送成功应该看到：

```
Enumerating objects: ...
Writing objects: 100% (...)
To https://github.com/heiqingyu/echo-ref.git
 * [new branch]      main -> main
branch 'main' set up to track 'origin/main'.
```

> 觉得路径太长，可以先设个别名（**只在当前 PowerShell 窗口有效**）：
>
> ```powershell
> function git { & "<git-path>" @args }
> git push -u origin main
> ```

---

#### 解法 ③：把 git 永久加进 PATH（一劳永逸）

在 PowerShell 里执行一次：

```powershell
[Environment]::SetEnvironmentVariable(
  "Path",
  [Environment]::GetEnvironmentVariable("Path","User") + ";<git-dir>",
  "User"
)
```

**然后关掉 PowerShell 重新打开**（必须重开才生效）。之后就能直接敲 `git` 了：

```powershell
git push -u origin main
```

> 注意：这个目录由集成环境管理，将来环境升级时版本号（`1.3.0`）
> 可能变化，届时 PATH 会失效。若追求稳定，建议装正式的 Git for Windows：
> <https://git-scm.com/download/win>（装完自带图形化登录，认证体验最好）。

---

### 关于登录 ✅ 已验证可用

**实测结果**：推送时终端显示了一行

```
info: please complete authentication in your browser...
```

然后自动打开浏览器完成授权 —— **不需要手动创建 token**。
你机器上的 Git 自带凭据管理器（Git Credential Manager），会弹浏览器走 GitHub 的
OAuth 流程。授权一次后凭据被存进 Windows 凭据管理器，以后不用再登录。

> 如果哪天浏览器授权失败、或者它改回让你输用户名密码，再用下面的 token 方式兜底。

**兜底方式：Personal Access Token**

GitHub 从 2021 年起**不支持账号密码**，必须用 token：

1. 打开 <https://github.com/settings/tokens>
2. 点 **Generate new token** → 选 **Tokens (classic)**
3. Note 随便写；Expiration 建议选 90 天或 No expiration
4. 勾选权限：**`repo`**（整组）和 **`workflow`**
5. 点 Generate，**立刻把生成的 token 复制下来**（页面关掉就再也看不到了）
6. 推送时：
   - `Username`：填你的 GitHub 用户名
   - `Password`：**粘贴那个 token**（不是账号密码）

Windows 上第一次输入后，系统会调用「凭据管理器」把它存起来，之后就不用再输了。

---

## 五、开启 GitHub Pages ← ★ 你现在只需要做这一步

> **推送已经完成了** ✅ 本地 `main` 已跟踪 `origin/main`，远端最新提交 `db38e80`，
> 仓库里能看到 `docs/index.html` 和 `docs/.nojekyll`。
> **只差最后一步：在网页上开启 Pages。**

操作步骤：

1. 打开 <https://github.com/heiqingyu/echo-ref/settings/pages>
   （或：仓库页面 → 顶部 **Settings** → 左侧栏 **Pages**）
2. **Build and deployment** 区域：
   - **Source**：选 `Deploy from a branch`
   - **Branch**：第一个下拉选 **`main`**，第二个下拉选 **`/docs`**
   - 点 **Save**
3. 等 1～2 分钟，刷新页面，顶部会出现绿色提示：
   > ✅ Your site is live at `https://heiqingyu.github.io/echo-ref/`

> ⚠️ **两个下拉框都要动**：第一个选分支 `main`，第二个选目录 `/docs`。
> 只选分支不选目录的话，Pages 会去找仓库根目录的 `index.html`（那里没有），结果 404。

### 你的访问地址

```
https://heiqingyu.github.io/echo-ref/
```

> 注意末尾的 `/`，不加也能访问，但加上更稳。可以直接收藏，分享给别人也用它。
> 仓库名若取作 `heiqingyu.github.io`，地址就会变成 `https://heiqingyu.github.io/`（根路径）——
> 但本项目用的是普通仓库名，所以地址带 `echo-ref` 子路径。

---

## 六、以后怎么更新

### 最简单：双击 `push.bat`

改完代码（或什么都没改、只想重新构建），**双击项目根目录的 `push.bat`** 即可。
它会自动：重新构建 → 提交 → 推送 → 显示结果。

### 或者手动三步

```bash
cd <project-directory>

# 1. 重新构建（刷新 www/ 与 docs/）
node build-www.js

# 2. 提交
git add .
git commit -m "更新：xxx"

# 3. 推送
git push
```

> 若 PowerShell 里 `git` 报「无法识别」，见第四节的解法 ③（加 PATH），
> 或把上面的 `git` 换成完整路径：
> `& "<git-path>" push`

推上去之后，GitHub 会在 **1～2 分钟内**自动重新部署。刷新网页即可看到新版本。

> 如果改了没生效：先强制刷新浏览器（`Ctrl + F5`）清缓存；
> 再到仓库的 **Actions** 标签页看部署有没有报错。

---

## 七、敏感信息清理 ✅ 已完成

> **背景**：仓库是公开的，任何人都能翻看。除了当前文件，GitHub 还会保留
> **每一次提交的完整历史**（点开任意 commit 就能看到当时的文件内容 diff）。
> 所以光把文件改掉是不够的 —— 必须**重写 commit 历史**。

### 清掉了什么

| 敏感项 | 原位置 | 处理 |
|---|---|---|
| 小程序 **AppID** | `README.md`（8 个提交）、`project.config.json`（全部提交） | README 中的行整行删除；`project.config.json` **从全部历史移除** |
| **本机用户名** | `DEPLOY.md` / `push.ps1` / `verify-docs.js` | 替换为 `<user-home>` 等占位符 |
| **本地绝对路径** | 同上 | 替换为 `<project-directory>` |
| **工具品牌名** | `DEPLOY.md` 的说明文字 | 改为「集成环境」中性表述 |

### 怎么做的

用 `git filter-branch --tree-filter` 逐提交重放，对每个历史快照跑一遍清洗脚本：

```bash
# 清洗脚本放在仓库外，避免自身被扫进历史
git filter-branch --force \
  --tree-filter '"<python>" /path/to/scrub.py' \
  --tag-name-filter cat -- --all

# 清掉 filter-branch 留下的原始引用备份，并回收对象
rm -rf .git/refs/original
git reflog expire --expire=now --all
git gc --prune=now
```

分三轮跑（AppID → 用户名/路径 → 品牌名），每轮后重新扫描确认。

### 现在的状态

**全历史零残留**，逐项已用 `git log --all -p` 全文扫描确认：

```
[OK]  AppID（wx92 开头）      零残留
[OK]  本机用户名              零残留
[OK]  project.config.json     文件已移除
[OK]  keystore 私钥           未进历史
[OK]  工具品牌名              零残留
```

### ⚠️ `project.config.json` 现在不上传了

它是微信开发者工具**编译必需**的，内含 AppID，所以：

- **本地文件保留**（你机器上照常能编译），已加入 `.gitignore`
- 仓库里放了一份 `project.config.example.json` 模板
- 别人从仓库克隆后，需自己复制成 `project.config.json` 并填入自己的 AppID

> 如果哪天你换了小程序 AppID，记得同时更新本地 `project.config.json`。

### ⚠️ 关于强推与缓存

历史重写后必须强推：

```powershell
& "<git-path>" push --force origin main
```

注意两点：

1. **旧 commit 的网页可能短暂缓存**。GitHub 对被强推覆盖的 commit 页面通常会删除，
   但 CDN 缓存可能滞后几分钟到几小时。
2. **若曾有人 fork 或在强推前拉取过**，他们本地仍有旧历史 —— 这种情况**重写历史无法追回**。
   唯一彻底的办法是在微信公众平台**重置该小程序的 AppID**（或直接不用那个小程序了）。
   本仓库当时没有协作者、也没有 fork，所以重写是足够的。

---

## 八、费用问题

**完全免费，不需要绑银行卡。** 个人用这种规模绰绰有余。

| 项目    | 免费额度         | 本项目的实际占用    |
| ----- | ------------ | ----------- |
| 托管费用  | 永久免费         | —           |
| 仓库容量  | 建议 ≤ 1 GB    | 约 100 KB    |
| 月访问流量 | 软上限 100 GB/月 | 单次打开约 94 KB |
| 构建次数  | 软上限 10 次/小时  | 只有你推送时才触发   |

「软上限」的意思是：超了不会立刻收费，而是会给你发提醒邮件；真有异常流量时 GitHub 会先联系你，不会直接扣钱。

**使用条款上要注意的**：GitHub Pages 允许个人项目、作品集、文档站点，甚至允许一定的商业用途，但**不允许把它当成电商或 SaaS 类经营站点**（比如挂支付、做在线商城）。你这个是个人速查工具，完全没问题。

---

## 九、三个要提醒你的点

### 1. 仓库是公开的，代码所有人可见

免费版必须用 Public 仓库。这意味着：

- `docs/index.html` 里的**全部源码**（包括 JS 引擎、参考值数据）任何人都能查看和下载
- 好在发布版里已经**完全不含**转载自 `tte-quickref` 的三个页签 —— 这点已通过自动化校验确认（`verify-docs.js` 会检查 `节段划分` / `瓣膜评估` / `PISA` / `Wilkins` 等关键词零残留）

### 2. 免责声明已经在页面里

发布版顶部会自动插入一段说明：

> **关于本页** —— 本页为个人整理的心脏超声（TTE）参考速查工具，四个页签……  
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

## 十、常见问题

**Q：PowerShell 里敲 `git` 报「无法将“git”项识别为 cmdlet…」** ⭐ 最常见

A：你的机器上没装独立的 Git for Windows，`git` 来自集成环境自带的 PortableGit，
其目录不在系统 PATH 里。三种解法：

- **双击 `push.bat`**（最省事，脚本已内置完整路径）
- 用完整路径：`& "<git-path>" push`
- 永久加 PATH（见第四节解法 ③），或干脆装 <https://git-scm.com/download/win>

详见 **[第四节](#四把本地仓库推上去)** 开头的专门说明。

**Q：Push 报 `remote: Support for password authentication was removed`**  
A：用了账号密码。改用 Personal Access Token（见第四步「关于登录」）。

**Q：Pages 设置里找不到 `/docs` 这个选项**  
A：说明 `docs/` 目录还没推上去。先确认推送成功、仓库里能看到 `docs/index.html`。

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

```text
════════════════════════════════════════════════════════
 你现在只需做一件事：开启 Pages
════════════════════════════════════════════════════════

  打开  https://github.com/heiqingyu/echo-ref/settings/pages
  Source : Deploy from a branch
  Branch : main   ／   目录: /docs
  点 Save

  → 等 1~2 分钟
  → 访问 https://heiqingyu.github.io/echo-ref/

════════════════════════════════════════════════════════
 以后每次更新网页：双击 push.bat 即可
════════════════════════════════════════════════════════
 （它会自动：构建 → 提交 → 推送）

 不想双击，就在 PowerShell 里跑：
   cd <project-directory>
   powershell -ExecutionPolicy Bypass -File .\push.ps1

════════════════════════════════════════════════════════
 已完成，留档备查
════════════════════════════════════════════════════════
 建仓库 / 关联 origin / 首次提交 / 推送     → 全部完成
 git 历史清理（AppID / 用户名 / 本地路径）   → 全部完成
 project.config.json 已从仓库移除（本地保留）
```
