# 任务状态（PM 维护，运行时事实）

> 每次派发 / 回执 / 验收 / 抢占后更新本文件；PM 会话重开（`ensure --force`）后**先读本文件重建状态**再继续调度，不依赖历史消息。
> 本文件只记**运行时**任务状态，**已终签批次只留一行 + 提交号**。2026-11-13 之前的完整流水已于 2026-11-20 归档到 `docs/archive/tasks-state-history-2026-11-20.md`（逐字保留，需要追溯时读它 + `CHANGELOG.md` + `docs/prds/` + `docs/adr/`）。

## 一、当前批次（在制）

**🔧 2026-11-20 全仓体检治理批（维护型 · Issue #354）** — 分支 `chore/2026-11-20-audit-governance`（自 `origin/main` `787b301b`，已并入机制 bump `e579d9de`）；体检报告 `docs/reports/2026-11-20-project-audit.md`。

- **范围**：AC1–AC2 锁 Node 版本（P1：Node 26 会产生 95 文件 / 597 例假红，Node 24 为 0 红）· AC3 删 10 个未使用依赖 · AC4 死组件 `apps/web/src/components/app/aside/**` 收口（两个测试先改挂 `aside-v2` 再删）· AC5 死配置 `VITE_SHOW_UNIMPLEMENTED_FEATURES` · AC6 root `workspaces` 遗留字段 · AC7 调试日志清理 · AC8 门禁。
- **范围外**：`apps/web` 不声明第三方依赖（phantom dependency），改动面大，另立卡。
- **派单**：`T730` → rd-infra（AC1/AC2/AC3/AC6）· `T731` → rd-fe（AC4/AC5/AC7）。两个会话同 worktree，各自 pathspec 提交、禁止全仓测试并发。
- **PM 已落**：`067206b4`→ 重做为 `4a31b686`（AGENTS.md 机制 pin/角色卡对齐 0.26.0 + 缺陷池 11 条状态回写 + 台账粘贴残留修复）· `0cba2044`（`DESIGN.md` 字段标签路径）· 体检报告 + 台账归档 + 本文件精简。
- **✅ 派单全部回执（2026-11-20）**：`T730` rd-infra（`756a4b78` 锁 Node 24.20.0 + 删 10 死依赖 + 删 npm `workspaces` 遗留字段 · `05af32cb` localStorage 兜底改「继承 `Storage.prototype`」（保住全仓 8 个 `vi.spyOn(Storage.prototype, …)` 判据）· `b7c0d0c0` 删 `pnpm-workspace.yaml` 死豁免）· `T731` rd-fe（`a2a1b95d` 删死组件/死配置/调试日志 · `5456da0f` `to` 判据升级为 props 级 · `5f4d66d9` 修回被带走的 float-aside 全局规则 · `8d5e1b09` 该规则的源级守卫）。
- **`T732` qa 独立复验 = 有条件 PASS（`7476e1e0`）**：逐 AC 成立；**独立证伪出新 P2** —— 删 `float-aside.vue` 连带删掉一条仍被 2 个抽屉使用的全局 CSS（构建产物 A/B：web/desktop `nue-drawer--float-aside` 命中 1 → 0）⇒ 已由 `5f4d66d9` 修回、`8d5e1b09` 加守卫（3 条断言各做过变异，全红）。另登记 `DEF-163`（移动端 JSDoc 悬空引用，红线待授权）· `DEF-164`（`engines` 无强制力，PM 裁定维持现状挂账）。
- **🎯 批末门禁（PM 亲自跑，node 24.20.0，工作区 0）**：`vp test --run` **451 文件 / 3494 例 / 3488 通过 / 6 跳过 / 0 红**（EXIT=0）· `vp check` **1989 文件格式 OK · 1583 文件 0 error** · 五守卫 rc=0 · `webapp build` rc=0 与 `desktop:build` rc=0（两端产物 `nue-drawer--float-aside` 各命中 **1**）· 移动端红线 **0 行**。
- **✅ 工程治理批已合并（2026-11-20）**：PR **#355 MERGED** ⇒ squash **`8f564ab5`**（`787b301b..origin/main` = 1、Issue **#354 CLOSED**、CI `check` + `test` 双绿、远端分支已删）；**qa `T732` = 有条件 PASS 且条件已闭环**（`P2 closed`）。发版决策待用户（建议 PATCH `v1.20.3`）。

## 一之二、2026-11-20 追加：桌面端打包产物残留源码注释（用户实报）

- **现象**：`apps/web/dist` 与 `apps/desktop/out/renderer` 的注释为 **0**，但 **`out/main/index.js`（492 行未压缩）与 `out/preload/index.js`（45 行）注释原样保留**，含内部编号 `R5/R13/T654` 与测试文件名 ⇒ electron-builder 打进 asar 后可直接读到。
- **根因**：`apps/desktop/electron.vite.config.ts` 只给 `renderer` 配了 terser，`main` / `preload` 两段**没有 `build` 配置**。
- **修复（分支 `fix/desktop-dist-comments` · 2 提交）**：`f9fc66b9` 给 main/preload 补 `minify: terser` + `compress:false / mangle:false / format:{comments:false, beautify:true}`（**beautify 是 rd-infra 的增补**：terser 即使不压缩也会重排成单行 ⇒ 崩溃栈退化成 `:1:col`；+4.5KB 换行号可读，PM 采纳）· `c201f0e3` 加两层守卫（`apps/desktop/src/__tests__/dist-comments-config.test.ts` 真读配置对象断言 + `scripts/guard-dist-comments.mjs` 扫产物，接在 `desktop:build` 之后）。
- **运行性证据（不是「构建 rc=0」）**：用 `scripts/electron-smoke/lib/cdp.mjs` 直连**构建产物**启动 —— 窗口存活 → `window.desktopAPI` 10 键、`ipcRenderer`/`require` 未泄漏 → IPC 往返 `getShellStatus()` / `setTrayTooltip()` → 可见性通道回放 → `quit()` 优雅退出；console error 0。
- **PM 复验**：`desktop:build`（含守卫）rc=0（116 产物、注释 9 条全为打包器标注/第三方 banner、无中文注释、无内部编号）· `vp check` 1990 格式 OK / 1585 文件 0 error · `vp test --run apps/desktop` 21 文件 / 189 例 0 红 · 变异（`format.comments:true` 重建）守卫 **exit 1** ⇒ 判据有牙。
- **口径提醒**：`desktop:build` 现在「构建 + 守卫」两段，rc=0 不再等价于「仅仅编译通过」；`.github/workflows/**` 未动。
- **✅ 产物注释修复已合并（2026-11-20）**：PR **#356 MERGED** ⇒ squash **`1fad3ff4`**（CI `check` + `test` 双绿、分支已删）。

## 一之三、`v1.20.3` 发版（PATCH · ✅ 已发布 2026-11-20）

- **范围**：两批合并后的事实（工程治理 PR #355 `8f564ab5` + 产物注释 PR #356 `1fad3ff4`）；用户 2026-11-20「发」= 授权发版。
- **已闭环（2026-11-20 实核）**：发版 PR **#357** ⇒ squash **`7cd26fb5`** · 注解 tag `v1.20.3` 指向该合并提交 · Release 已发布（8 产物含三份 `latest*.yml`）。

## 一之四、桌面端应用内自我更新（`feat` · ✅ 已合并 2026-11-22 · Issue #358）

- **需求**：Desktop 端内置「检查更新 + 立即更新」（用户 2026-11-20 提出；5 项澄清已答：Linux/Windows 原地更新 · macOS 与 deb 降级下载页 · 启动静默检查 + 手动入口 · 下载完提示重启/稍后 · 未同步改动需护栏）。
- **PRD**：`docs/prds/2026-11-20-desktop-self-update.md`（AC1–AC13 · RICE ≈0.29 · Must）。**分支** `feat/358-desktop-self-update`（自 `origin/main` `7cd26fb5`）。
- **开工确认（用户 2026-11-20）**：按卡开工 · arch 与 uiux 并行 · 设计稿验收模型 = **A 用户本人确认** · 范围**全量照 PRD**（含启动静默检查与侧栏弱提示）。
- **回执**：`T733` arch **done** `4a4d26ac` ⇒ `docs/adr/2026-11-20-desktop-self-update.md`（选官方 `electron-updater` 6.x + GitHub Releases 唯一源；构建/CI **本期不改**；平台矩阵 = 纯环境判定；护栏复用既有 `useSyncStatus()`；`autoDownload` / `autoInstallOnAppQuit` = false；坏包 = 撤资产 + 发更高 PATCH；`T733b` `fc64c6c0` 补 QA 六条可测性前置，**全部可满足**）· `T735` qa **done** ⇒ 接缝定稿 = **2 主接缝 + 1 轮一次性证据（不进 CI）** + 6 条可测性前置（已写入 PRD §七）· `T734` uiux **done**（`74094eb9`…`67a97f69`）：设计稿 73 行 + 双语文案 88 行 + `docs/designs/README.md` 索引，Penpot 9 画板（仓外）；AC1–AC13 逐条落点给出、AC12 一处受控偏离已自报。
- **用户设计稿验收（2026-11-20）＝ 通过**（模型 A）：Shadcn 桌面密度照旧、**按钮 30px 保留**、护栏取**文案 A（软提示）**。
- **三项遗留裁决（PM，2026-11-20）**：① AC12 `LoadingError` 仅 `checking` 用，`idle`/`failed` 走 DESIGN §4.1「动作级内联」⇒ **受控偏离采纳**，但须在 `DESIGN.md` §4.1 登记；② 30px **只在本块登记例外**（不改 §3 全局口径、不推全仓 30px），须在 `DESIGN.md` §3 已登记例外段补一行；③ 护栏文案事实已由 arch `T733c` 读码给出 ⇒ **队列跨重启保留**（Dexie `nao-todo-desktop.syncQueue`，冷启动 `syncService.start()`→`pushAllInner()`→`syncTracker.listDirty()` 重推），但 **`failedCount` 是内存态、重启清零** ⇒ 护栏判据必须用「队列非空」，⛔ 不得用 `failedCount`；文案 A 维持且禁「失败」措辞。
- **RD 派单（2026-11-20）**：`T736` rd-infra（主进程 electron 零依赖内核 + 五端口 + `resolveInstallMode` 纯函数 + preload 契约 + `electron-updater` 依赖；契约先落并通知 rd-fe；PR owner + Draft PR）· `T737` rd-fe（`data-panel` 版本行升级为卡 + `use-desktop-updater` 独立 hook + 卡 A + 侧栏 6px 弱提示 + i18n 双键）。Reviewer = qa。
- **RD 交付（2026-11-21）**：`T736` rd-infra（`84348874` 契约 · `f01d17a3` 内核五端口 + 八态 + adapter + preload · `d9dae92d` 惰性加载 · `354c9342` 装配去 electron · `0b3dd20f` 三条硬约束静态守卫）· `T737` rd-fe（`f3f3d939` 面板/hook/卡 A/弱提示/i18n · `415d8e35` 删死键）· **PR #359**（Draft，base main，46 文件）。
- **qa 独立复验（`T738`，`docs/reports/358-qa-report.md`）＝ 有条件 PASS**：全仓 464 文件 / 3662 例 / 0 红；15 个变异 14 杀 1 存活 ⇒ 4 项缺陷（QA-01 P2 判据缺维度 · QA-02 P3 注释过度承诺 · QA-03 P3 下载失败无 reason · QA-04 P3 adapter 零用例）。
- **缺陷闭环**：`T739` rd-fe `0b8d4d7a`（QA-01 补断言 + 反向对照，变异 1 红 40 绿）· `T740` rd-infra `026314d3`（QA-02 仅改注释 · QA-03 补 reason + 真实网络栈超时码 · QA-04 adapter 入库 28 例；三次变异 11/1/1 红）。
- **qa 复签中断（如实记）**：`T741` 三轮均被模型网络 `ECONNREFUSED` 打断（非任务问题）；缺交的 `358-qa-cases.md` 已由该轮写入并入库，缺陷编号 `DEF-01…04` → `QA-01…04`（避免与缺陷池撞名），末次机械复核由 PM 执行并在报告 §一 末如实标注（**qa 未复签**）。
- **批末门禁（PM 亲跑，`026314d3` 之后，独占无并发）**：`vp test --run` **465 文件 / 3692 例 / 3686 通过 / 6 跳过 / 0 红**（317.84s）· `vp check` 2022 文件格式 pass + 1609 文件 0 error · 五守卫 rc=0 · `webapp build` 17.44s rc=0 · `desktop:build` 19.59s rc=0（116 产物过注释守卫）· 移动端红线 **0 行**。
- **用户走查第一轮（2026-11-21）＝ 三条实报**：① 「关于与更新」标签/卡片比同面板其它行**左移 12px**（根因：`sd-row`/`sd-group__head` 带 `--nue-padding-sm`，新块未带）② 界面出现 `APPIMAGE env is not defined, current application is not an AppImage` 这类更新器原文 ③ 检查失败不该让用户「重试」，应引导下载页。
- **三条修复**：`T742` rd-fe `39a62102`（对齐：真实 Chromium 量 `rectLeft` 40/40/40，窄档 12/12/12，delta 0）· `T743` uiux `db696841`（稿 v3：对齐基准/`failed` 去重试/新增 `unsupported` 态 + 指出 `resolveInstallMode` 判定顺序 bug）· `T744` rd-infra `9b27e05e`（降级形态**零请求**（`checker.check` 调用数 0 有断言）· 状态载荷只留原因码、日志改脱敏摘要（原文含 `APPIMAGE`/路径/主机名零命中）· 判定先 `isPackaged` ⇒ `dev` · 变异 3 红 / 5 红）· `T745` rd-fe `1bf6e692`（渲染第九态 `unsupported` · `failed` 删行内「重试」、`打开下载页` 升 primary、R1 仍可点 · 变异 3 红 / 2 红）。PRD 同步：AC4 改、新增 AC4b / AC9b（`7598700c`）。
- **第二轮批末门禁（PM 亲跑 `1bf6e692`，独占无并发）**：`vp test --run` **465 文件 / 3708 例 / 3702 通过 / 6 跳过 / 0 红**（435s）· `vp check` 2022 文件格式 pass + 1609 文件 0 error · 五守卫 rc=0 · `webapp build` rc=0 · `desktop:build` rc=0（116 产物过注释守卫）· 移动端红线 **0 行**。
- **用户走查第二轮（2026-11-21）＝ 观感否决**：原话「还是很难看，不符合当前项目的风格」，点名参照**任务列表主视图**。诊断 = v3 自造了第三套盒子（1px 边框 + radius 8 + 卡内定高 + 自定义标签），而项目行语言是「有底色块 + 悬停描边 / 平铺行」。
- **v4 设计稿 + 重写**：`T746` uiux `26503e02`/`2f5d5d96`（组头 + 两条有底色行，逐字对齐 `.nue-div--todo-list-main__row` 的 `--small` 变体；控件回 `nue-button` 36px，**30px 例外撤回**（`DESIGN.md` §3 同步撤登记）；灰底对比度全部重算：`success-100` 5.29 · hint `-700` 6.77 · 轨 `-500` 3.16）· `T747` rd-fe `eaed4fcb`（**重写**而非修补：删盒式卡整套、行 40 最小高/`-100` 底/6px 圆角/hover 描边、整行不可点；真实 Chromium 实测 行高 56、按钮 36、`rectLeft` 与同步行同 28、窄屏 8/3）。B 备选方案 = 删行底色/圆角/内边距三条声明（用户走查时定）。
- **walkthrough 基建**：`T748` rd-infra `27e787dc`（开发态假更新源：`isPackaged === false` **且** `NAO_UPDATE_FAKE_FEED` 非空才生效，值为 JSON 配置绝对路径，每次点击重读 ⇒ 改文件即切场景；生产不生效有断言：端口对象同一性 + 配置文件零次读取 + 删守卫即 2 例红）。两处诚实偏离：① 假源把 env 报成「已打包 + win32」，否则 AC4b 前置 gate 恒 `unsupported`、其余八态物理不可达 ② `just-updated` 由「假安装后按真实重启语义重建内核」达成（生产路径不可达，`fake` 恒 `false`）。
- **第三轮批末门禁（PM 亲跑 `27e787dc`，独占无并发）**：`vp test --run` **466 文件 / 3744 例 / 3738 通过 / 6 跳过 / 0 红**（348.67s）· `vp check` 2024 文件格式 pass + 1611 文件 0 error · 五守卫 rc=0 · `webapp build` rc=0 · `desktop:build` rc=0 · 移动端红线 **0 行**。
- **✅ 已合并（2026-11-22）**：用户「所有走查通过」⇒ PR **#359** MERGED ⇒ squash **`3fea8458`**（`wip(` 残留 body/`subject` 各 0 · 远端分支已删 · Issue #358 CLOSED）。合并时 GitHub 报过一次 504，重试同一命令后落库（RD 如实记录）。
- **发布决策（用户 2026-11-22）：随下一个 PR 发，本批不单独发 `v1.21.0`**（台账更新随下个任务 PR 的首个文档提交带走）。发版检查项仍为：tag = `package.json` = `latest*.yml` 三者一致。
- **转办（QA 提出）**：Electron E2E 基建（Playwright / `_electron`）本期不建 ⇒ 进待派发队列（Owner：待定）；Windows 原地更新与 macOS 分支人工验收属已接受风险（PRD §八）。

## 一之五、设置面板改版（`feat` · ✅ 已合并 2026-11-22 · Issue #360 · PR #362）

- **需求**：用户 2026-11-22 走查四条 —— 左栏激活态去竖线改导航链接观感 · 账户删「更多信息」把注册时间归位、待注销时间迁危险区 · 密码修改升常驻分区且更明显 · 对话框内 padding/gap 全量治理 + `DESIGN.md` 补元素设计口径。
- **澄清（用户已答）**：左栏**只要视觉**（不动路由/URL）· 密码为账户内常驻分区（非第五分类）· 间距范围 = 对话框内全部模块 + `DESIGN.md` 口径 · 注册时间放身份区第三行 · 待注销时间进危险区。
- **PRD**：`docs/prds/2026-11-22-settings-polish.md`（AC1–AC12 + 附录 A 四项 PM 裁决：控件按组件档 36px 分层口径 / 密码块静止边框 1.36 属装饰可接受 / 左栏采用 A 方案 `nue-link--route` 四态 / 危险区间距 68→24）。**分支** `feat/360-settings-polish`（**叠在 #358 之上**，用户选 B；#358 合并后改指 main）。
- **设计（`T749` uiux `b03da9fe`）**：左栏四态 / 账户信息归位 / 密码常驻分区（`.sd-permission-notice` 三件套）/ 间距台阶 L0–L6（点名删 4 处双层内边距）/ `DESIGN.md` §4.9 增补草案（PM 已审定）；另附 copy 与画板指令（**未实际出图**，无绘图 MCP）。
- **文档归位（PM）**：uiux 原把 360 稿落在 #358 分支（跨需求混提）⇒ #358 上 revert（`c1e83642`），`feat/360-settings-polish` 重建并落 PRD + 三稿（`4820afc4`，因 README 冲突改用 reset+取文件而非硬解）。
- **实现（`T750` rd-fe）**：`1626cd9a`（四件事全落：左栏删 `inset 2px 0 0` 复用 `nue-link--route` 四态且 a11y 逐字未改 · 账户删 `UserInfoViewer`（全仓+移动端 0 引用，清理组件目录/barrel/3 个 locale 键）· 密码删折叠改常驻分区 · L0–L6 单处定义并删 5 类字面值）+ `a9973cd7`（`DESIGN.md` §4.9 + §8 一行，只加不改）。
- **门禁**：受影响面 36 文件 / 349 例 / 0 红；`presentation-identity` 11 文件 / 58 例 / 0 红；**全仓（PM 亲跑）466 文件 / 3772 例 / 3766 通过 / 6 跳过 / 0 红**（第二次；首次出现 **1 红但用例名未捕获**，随后两次全绿 + 受影响面 3 连绿 ⇒ 记疑似 flake，未定位，随 PR 观察）· `vp check` 0 error · 五守卫 rc=0 · `webapp build` rc=0 · 移动端红线 0 行。
- **PR**：#361（Draft，base 暂指 `feat/358-desktop-self-update`，待 #358 合并后改指 main）。
- **用户第二轮两条（2026-11-22）**：① 「登录设备」也算一个分区、每区需要副标题 ② 密码分区**不要背景色**。`T751` uiux `64b37687`（账户四分区 + 3 个新副标题键 zh/en；密码走 B 方案：删 padding/圆角/`-100` 底 + label `-700` 覆写，区分由组头字阶 + 24px 间距承担；回退路径写死）· `T752` rd-fe `b2f2f18f`（四分区落地 + `session-manager` 组件内同名小标题移除（移动端 0 引用）+ 密码表单左缘回同线、窄屏 +24px；几何实测四组头左缘 36/36/36/36、密码表单 Δ0.00px）。
- **测试卫生事故与修复（如实记录）**：`T752` 把 743 行几何探针写成了入库测试文件（`import 'node:child_process'` + spawn Chromium）⇒ ① 违反「探针放 `/tmp`」纪律 ② `@types/node` 被拉进 `apps/web` program ⇒ 全局 `setTimeout` 变 `NodeJS.Timeout` ⇒ 全仓 `vp check` **rc=1**（报在无关的番茄文件 `use-task-panel.ts:84`）。PM 用「切分支对照」定位到本分支引入 ⇒ `T753` rd-fe `402a54d8` 删除探针、判据迁到 jsdom 用例（`t752-account-sections.test.ts` 10→11 例，变异有牙），**全仓 `vp check` 回 rc=0**（2029 文件格式 pass / 1612 文件 0 error）。
- **批末门禁（PM 亲跑 `402a54d8`）**：`vp test --run` **469 文件 / 3789 例 / 3782 通过 / 6 跳过 / 1 红** —— 红点 = `persistence-sync/__tests__/t706-qa-prune-cap-probe.test.ts`（审计裁切限幅，**与本需求无关**；单文件连跑 5 次全绿 6/6 ⇒ 判为负载相关 flake，记缺陷池观察）· `vp check` rc=0 · 五守卫 rc=0 · `webapp build` rc=0 · `desktop:build` rc=0 · 移动端红线 0 行。
- **用户第三/四轮走查（2026-11-22）**：① 更设备「刷新」移到分区标题后 ② 危险区两按钮收进一个 `nue-div` 改 `nue-button` 水平排列 ⇒ `T754` rd-fe `87ffc494`（`defineExpose({refresh})` 暴露已节流版本 + 函数 ref 转发，包内不反向依赖面板；危险区两动作改库原生 `destructive`/`primary`，手写 `.sd-danger-row` 三套态删除；变异 3 红 / 4 红，含「空列表夹具漏杀 → 改两台设备夹具才杀掉」的自纠）。
- **✅ 已合并（2026-11-22）**：PR #361 因 base 分支随 #358 合并被删而**自动关闭且无法 reopen** ⇒ 把分支 rebase 到新 main（`git rebase --onto origin/main c1e83642`，9 提交干净落地、只留 #360 的 28 文件）、强推、新开 PR **#362**（base main）⇒ squash **`596d1b7f`**（`wip(` 各 0 · 远端分支已删 · Issue #360 CLOSED）。
- **发布决策（同 #358）：随下一个 PR 发**。

## 一之六、`v1.21.0` 发版（MINOR · ✅ 已发布 2026-11-22）

- **范围**：`3fea8458`（#358 应用内自我更新）+ `596d1b7f`（#360 设置面板改版）。用户 2026-11-22 先定「随下个 PR 发」，随后改口「还是发版吧」⇒ 本批直接发 MINOR。
- **分支** `nao/release-v1.21.0`：版本 root / `apps/web` / `apps/desktop` `1.20.3 → 1.21.0`；`CHANGELOG.md` + `docs/releases/v1.21.0.md`（C 端说人话；内部术语全部下沉「技术细节」段）；`packages/*` 有源码改动（`shared` 文案键 / `presentation-identity` 组件）按近批惯例**不单独 bump**。
- **待办**：PR → RD 合并 → 注解 tag `v1.21.0` 指向 main 合并提交 → 推送触发打包 → Release（正文与 `docs/releases/v1.21.0.md` 归一化逐字一致）→ **8 产物 + 三份 `latest*.yml` 实核 + 硬校验 tag = `package.json` = `latest*.yml` 三者一致**。
- **已发布事实（2026-11-22 实核）**：发版 PR **#363** ⇒ squash **`7e401ae2`** · 注解 tag `v1.21.0` 指向该提交 · 打包 run `45013552854` 四 job 全绿 · Release 已发布（非 draft / 非 prerelease）· **8 产物齐** + 三份 `latest*.yml` 的 `version` 均 = `1.21.0`（`path` 分别指向 x64.exe / arm64-mac.zip / x86_64.AppImage）· **三处版本一致性硬校验通过**：tag `v1.21.0` = root/web/desktop `package.json` `1.21.0` = `latest*.yml` `1.21.0` · Release 正文与 `docs/releases/v1.21.0.md` 归一化**逐字一致**（2470/2470）· Issue #358 / #360 CLOSED。
- **本批遗留（下批处理）**：① `t706-qa-prune-cap-probe` 负载 flake（未定位，单跑 5 次全绿）② 发版三版本一致校验目前只有人工清单、无自动化（加进 `release.yaml` 需 `gh` token 具备 `workflow` scope）。

## 一之七、命令面板 / 任务归档 / 搜索翻新 / 工程守卫批（`feat` · ✅ 已合并 2026-11-23）

- **范围**：Issue #371 命令面板与快捷键帮助 · #372 任务级归档 · #373 搜索翻新 · #378 死代码与 README 口径 · #380 发版硬校验进 CI · #382 DEF-160 提交范围预检。另 #370（同类定时器）**排查结案无改动**（`preference-sync` 有清理入口且被调用；`sync-service` 三定时器实例级、机制不叠加；结论与约定见 issue 评论）。
- **合并**：`b570cd5e`(#371) · `829cd29c`(#372) · `bb724654`(#373) · `bade26ef`(#378) · `1313095d`(#380) · `4187f4ba`(#382)；均 squash、`wip(` 残留 0、远端分支已删、Issue CLOSED。
- **关键证据**：
    - #373 搜索 5 万条 **35.8s → 数据就绪 ~0.9s**（repo.list 758 · VO 77 · store 15 · 过滤 16 · 计数排序 31）；内存 +25.8MB ≈ 541B/条；**只绕开未治本**（仓储 `list()` 与 limit 无关地整表解密）⇒ 已开 **#376**。
    - #371 判据：面板/帮助**全部由注册表派生**；变异（去掉 `hidden` / 帮助改手写）均红；删死命令 `app.modal.close` 后零引用。
    - #372 口径冲突裁定 **A**：`archive` 清单归档时硬拒、`unarchive` 语义零改动（保留 ADR §15.1 逃生口），既有两个 unarchive 用例未被修改。
    - #380 workflow 步骤已进主干（release job 第 178 行）；`workflow` scope 已由用户授权。
    - #382 `guard:commit-scope` 真实仓库三场景：干净 rc=0 / 未暂存 rc=1 点名 / 未跟踪仅提示。
- **用户走查**：本批视觉/真机走查项已随各 PR 的 body 列明（面板观感、mac 键面、窄屏、归档只读态、搜索手感），**W1–W5 五项已于 2026-11-24 由用户走查通过**（Linux `Ctrl` 键面实看通过；mac 真机待验 —— `detectPlatform` 映射有单测覆盖，结构性已测）。
- **发布**：本批随 `v1.22.0`（MINOR）发布（见 §一之八）。
- **未关闭 Issue**：#376（仓储读取性能根因，P2）· #384（Actions v4 → v5，Node 20 弃用警告，用户已同意开单）。

## 一之八、`v1.22.0` 发版（MINOR · ✅ 已发布 2026-11-23）

- **分支** `nao/release-v1.22.0`：root / `apps/web` / `apps/desktop` `1.21.0 → 1.22.0`；`CHANGELOG.md` + `docs/releases/v1.22.0.md`；`packages/*` 有源码改动按近批惯例不单独 bump。
- **已用新闸门自证**：`node scripts/verify-release-versions.mjs v1.22.0` ⇒ 5 项 PASS / rc=0。
- **发版链路小事故与修复（如实记录）**：首次 tag 指向 `297f8182`（旧 workflow）⇒ 三个平台打包全绿，但 `release` job 的**新增校验步把发版拦下** —— 原因是我把 `actions/checkout`（默认 `clean: true`）放在 `download-artifact` **之后**，它把未跟踪的 `artifacts/` 删了 ⇒ 脚本报「--assets 目录不存在」。修复 = checkout 提前 + download 加 `merge-multiple: true`（PR #386 ⇒ `92eb163c`）；**另需知**：我误把 #386 当成 issue 写了 `Closes #386`，实际 #386 就是该 PR 自身（GitHub issue/PR 同号），无 issue 被关闭，RD 当场指出。
- **✅ 已发布事实（2026-11-23 实核）**：发版 PR **#385** ⇒ squash **`297f8182`**；tag `v1.22.0` 因上述修复**重打**并指向 **`92eb163c`**（含同版本应用代码 + 修复后 workflow）；打包 run `45181660676` 四 job 全绿；**新增 CI 闸门首次实战通过**（8 条 PASS：三处顶层 version / 与 tag 一致 / 三份 `latest*.yml`）；Release 已发布（非 draft / 非 prerelease）· **8 产物齐** · Release 正文与 `docs/releases/v1.22.0.md` 归一化**逐字一致（2779/2779）**。
- **本批遗留**：① #376 仓储 `list()` 整表解密（P2 根因，未修）② #384 Actions v4 → v5（Node 20 弃用警告，已开单）③ `DEF-160` 上游根因（现已有 `guard:commit-scope` 可执行防线）④ 用户视觉/真机走查（命令面板观感、mac 键面、窄屏、归档只读态、搜索手感）**W1–W5 已于 2026-11-24 走查通过**（Linux `Ctrl` 键面实看通过；mac 真机待验 —— `detectPlatform` 映射有单测覆盖，结构性已测）。

## 一之九、工程基座：Actions 升级（`chore` · ✅ 已合并 2026-11-23 · Issue #384）

- **范围**：`.github/workflows/**` 共 **11 处** `uses:` 升到最新主版本（PM 派单原写「7 处」是错的，RD 当场纠正）：`checkout` v4→**v7** ×5 · `setup-node` v4→**v7** ×4 · `upload-artifact` v4→**v7** · `download-artifact` v4→**v8** · `action-gh-release` v2→**v3**。
- **破坏性变更结论**：逐 action 读 release notes + 目标 tag 的 `action.yml` ⇒ **无一项需要改 `with:`**，diff 只有 11 行版本号。关键点：`checkout` 的 `clean: true` 默认**未变**（「checkout 必须在 download 之前」的既有约束照旧）；`setup-node` v6 起自动缓存收窄到仅 npm ⇒ 本仓 pnpm 行为同 v4；`download-artifact` v5 的「按 ID 下载路径变化」不适用（本仓走全量 + `merge-multiple: true`，v8 仍支持）。
- **合并**：PR #387 ⇒ squash **`f370175f`**；`wip(` 残留 0；远端分支已删；Issue #384 CLOSED；合并后核验：无残留 `@v4`/`@v2`（0 处）、release job 五步顺序不变、`merge-multiple` 仍 1 处。
- **验证层级（如实）**：① PR 的 `check`/`test` 真跑 `checkout@v7` + `setup-node@v7` ⇒ 双绿 ② 合并后 `workflow_dispatch` 预演 run `45189093750` 三平台 build + **`upload-artifact@v7` 全 success**（release job 按设计 skip）③ **`download-artifact@v8` 与 `action-gh-release@v3` 只能等下次发版验证**（PR 已写明 + 兜底：失败则 `git revert` 该提交）。
- **顺带发现（未处理）**：GitHub 报默认分支 **94 个依赖漏洞**（3 critical / 34 high / 37 moderate / 20 low，Dependabot 口径）⇒ 建议单独开单评估，不在本单内混入。

## 一之一〇、命令面板 / 任务归档 / 搜索翻新 / 依赖安全 / 文档治理 · 合并汇总（2026-11-23 夜间）

- **合并序列（v1.22.0 之后 6 个提交）**：`f370175f` Actions 升 v7/v8/v3（#384）· `2b822069` prod 依赖安全（#388 批一）· `349be03f` prod 清零（#388 批二）· `2d71fbd8` dev 面 Batch A（#388 批三，audit 70→10 / 0 critical）· `2c480a4b` ADR 索引整篇去重（#394 / DEF-165）· `e0a137da` 变更历史单层滚动（#393 / DEF-162）。
- **依赖现状**：`pnpm audit --prod` = **0**；全量 **10**（0c/1h/8m/1l）。剩余 = `vite-plus`×5（需换工具链，已开 **#391**）· `@vitest/mocker`×2 + `vitest`×1（工具链 pin）· `glob`×1 / `minimatch`×1（跨 major、上游无解）⇒ **接受至 2026-12-31 + 转办上游**。新增 `guard:audit`（critical=0 且总数 ≤12）。
- **本批事故与处置（如实）**：① 同一 worktree 两会话交叉改动（我的 ADR 分支里出现对方的 DEF-162 文件，且 `t717` 被整文件 LF 化）⇒ 按 pathspec 只提交自己的文件，对方随后切回本分支并修正 EOL；② 我的首次「ADR 去重」用截断法会丢掉只存在于后半份的 `T696`/`T673` ⇒ 改为行并集重建 + 守卫用例。
- **待用户**：发版 `v1.22.1`（本批铜基座，PATCH）· 视觉走查五项（**W1–W5 已于 2026-11-24 通过**；Linux `Ctrl` 键面实看通过，mac 真机待验 —— `detectPlatform` 映射有单测覆盖、结构性已测）· `#391` 换工具链决策 · `#376` 仓储读取性能 A/B 两步。
- **已清（`T802`，2026-11-24）**：`DEF-27`（已并入 `DEF-30`）/ `DEF-113`（`v1.15.2` 已清理）/ `DEF-111`（✅ 已修）/ `DEF-115`、`DEF-163`（维持挂账裁定）五行经逐行核对，均已带闭环标注或裁定，不再列入待收拾。

## 一之一一、走查修复批 + `v1.22.1` / `v1.22.2` 发版（2026-11-24）

- **`v1.22.1`（PATCH · ✅ 已发布 2026-11-24）**：发版 PR **#397** ⇒ squash **`dc9083c1`**；tag `v1.22.1`；打包 run `45310975312` 四 job 全绿；**CI 闸门 8 条 PASS**；**`download-artifact@v8` + `action-gh-release@v3` 首次实战通过**（v1.22.0 时只验到 upload）；8 产物齐；Release 正文与 `docs/releases/v1.22.1.md` 归一化逐字一致（2157/2157）。
- **用户走查（v1.22.1 之后四轮）与修复**：
    - `2a6ae1bd` **走查四项**（Issue #398 / PR #399）：搜索触发器不收缩（`filter-trigger.css` 单一来源）· 归档任务只读 + 灰阶（拖拽由「条件绑定」改「始终绑定 + 处理器内早退」，原写法使拖拽整体失效、`subtasks.test.ts` 3 例红）· 变更历史左缘贴齐（DEF-162 单层滚动未回退）· 窄屏更新卡内边距（12px / 28px）。
    - `8cf5e9dc` **截止日触发器渲染中断**（PR #400）：`nue-date-picker` 输出 ISO ⇒ `Number('01T00:00:00.000Z')` = NaN ⇒ `Intl.format(Invalid Date)` 抛 `RangeError`，该函数在渲染期跑 ⇒ 整颗触发器渲染中断、宽度塌成 padding（空胶囊）。修法：`dateKeyOfIso` 输入规整 + `shortLabel` 容错回退。
    - `6a0ff245` **跨年带年份 + 面板排版**（PR #401）：两端年份不同或非当年 ⇒ 带年份（走 i18n `date.monthDay` / `date.yearMonthDay`，**不用** `Intl` 自由格式、**不复用** `relative-date-parser`（带 `HH:mm` 且相对措辞随时间漂移））；触发器上限 `18rem` + `title`；面板「标签定宽 + 控件 flex」对齐、`tabular-nums`、动作组独立 + 分隔线。
- **口径教训（PM 自查）**：门禁判据 `grep "isReadOnly ? undefined"` 写宽了 —— 命中的是 `:data-*` **属性绑定**（语义正确），真正要清的是**事件监听器条件绑定**；以后同类判据须带 `@事件=` 前缀。
- **`v1.22.2`（PATCH · ✅ 已发布 2026-11-24）**：发版 PR **#402** ⇒ squash **`d72dbefd`**（含 `#403` 面板竖排定稿 `4076b7d2`）；注解 tag `v1.22.2` 指向该合并提交；打包 run **`45342681385`** 四 job 全绿（mac / win / linux + release）；workflow 内 `verify-release-versions` PASS（tag = 三处顶层 version = 三份 `latest*.yml`）；**8 产物齐**（`latest.yml` / `latest-mac.yml` / `latest-linux.yml` + `.exe` / `.dmg` / `-mac.zip` / `.deb` / `.AppImage`）；Release 正文已按 `docs/releases/v1.22.2.md` 补齐，归一化比对**逐字一致**（唯一差异 = 源文件末尾缺换行符，正文内容相同）。批末门禁（PM 自证，合并前 HEAD 实测）：`vp check` 0 error（2077 文件格式 / 1655 文件 0 error·0 warning）· 全仓 `vp test --run` **496 文件 / 4025 例 / 4019 通过 / 6 跳过 / 0 红**（326.5s）· 六守卫 rc=0 · `release-versions` rc=0 · `webapp build` + `desktop:build` rc=0 · 移动端红线 0 行 · 合并后 `git diff d6a4372e d72dbefd` **为空**（squash 内容 = 受门禁的内容）。`packages/*` 无变化。
- **`v1.22.2` 发版链的四处操作痕迹（PM 记录）**：① 分支 `nao/release-v1.22.2` 变基到 `4076b7d2` 后 `--force-with-lease` 推送（自己的分支，main 未动）；② 提交前用 `guard:commit-scope` 查出他人两处未暂存改动会被 `vp staged` 整树 stash 卷走 ⇒ 先 `git stash push -- <两文件>`、只提交自己 3 个文件、提交后 `pop` 回（`git stash list` 现为空，无 lint-staged 残留）；③ GitHub 推送时报 **9 vulnerabilities**（1 high / 7 moderate / 1 low），与 `guard:audit`（critical=0、总数 ≤12）口径一致，属已知接受集（`vite-plus`×5 待 #391、`@vitest/mocker`+`vitest`、`glob`、`minimatch`），非本批引入；④ Release 正文需**事后补**（workflow 的 `action-gh-release` 未传 `body`，v1.22.1 同此先例）⇒ 发版流程应固化为「workflow 建 Release → PM 补正文 → 归一化比对」三步。
- **待用户**：`#376` 仓储读取性能（索引下推 + 惰性解密）· `#391` 换工具链（vite-plus 1.3.0）· 视觉走查 **W1–W5 已于 2026-11-24 通过**（Linux `Ctrl` 键面实看通过；mac 真机待验，mac 键位仅单测覆盖、结构性已测）。
- **已清（`T802`，2026-11-24）**：`DEF-27`（已并入 `DEF-30`）/ `DEF-113`（`v1.15.2` 已清理）/ `DEF-111`（✅ 已修）/ `DEF-115`、`DEF-163`（维持挂账裁定）五行经逐行核对，均已带闭环标注或裁定，不再列入待收拾。
- **`T755` rd-fe · 截止日筛选面板竖排重构（Issue #403）**：面板改为**逐值复刻任务详情面板日期选择器**（`task-date-selector`：标签缩进 / 无框控件 / 分隔线分段 / 定宽 14rem）+ 提醒设置器的开关行（文字左、开关右、整行可点）+ 左对齐「清除日期」；即时生效链路与 `data-role` 契约不变 · 门禁：`vp check` 0 error（2076 文件格式 / 1655 文件 0 error）· 搜索面 19 文件 / 239 例 / 0 红（含 T755 19 例）· Chromium 同页对照参考件 **8/8 计算值相等**（224px / 4px 0 / 8px / 4px / `rgb(153,153,153)` / 8px / 0px / none；控件 padding-left = 标签 8px、左缘同为 37px）· 三视口（1280 / 360 / 320）面板 224px、横向溢出 0 · 清除键与日历图标间距 11px · 开关行 28px 内文字左 8px / 开关右 8px · 用户视觉走查**通过**（2026-11-24，C1–C5 全过；PR #404 squash 合并 `4076b7d2`）。
- **`T802` rd-fe · 文档债回写（缺陷池 + 走查台账，零源码）**：① `DEF-111` 跑用例复核后标 **✅ 已修（Issue #274 · 2026-10-29）**，证据逐条指行号（`t575-rounds-engine.test.ts`：M=4 `:83`/`:84`/`:87` · M=1 `:112`/`:113` · M=10 `:121`/`:122`/`:127` · skip 负向 `:143`/`:152`/`:161`/`:173`/`:176`）；② `DEF-115` 补用户裁定「维持挂账，移动端不改」；③ `DEF-163` 补裁定「用户撤回授权，维持挂账（移动端红线）」，**移动端零改动**；④ 走查台账第 94/104/119/132 行回写 **W1–W5 于 2026-11-24 用户走查通过**（口径：Linux `Ctrl` 键面实看通过；mac 真机待验 —— `detectPlatform` 映射有单测覆盖、结构性已测）。门禁：`vp check` 0 error（2077 文件格式 / 1655 文件 0 error·0 warning）· `vp test --run packages/presentation/pomodoro` **12 文件 / 109 例 / 0 红**（9.0s）· 守卫 `mobile-imports` / `test-location` / `barrel-imports` / `gate-pathspec` rc=0 · 移动端红线 `git status --porcelain -- packages/presentation-react apps/mobile` = **0 行**。本批 2 个文件全为文档，零源码 / 零测试改动。

## 一之一二、工具链升级：`vite-plus` 0.2.6 → 1.3.0（Issue #391 · `T801` spike + `T805` 实现，2026-11-24）

- **决策**：用户批准升到 **1.3.0**（2026-10-16 发布，39 天浸泡）；⛔ **不升 1.7/1.8** —— 1.8.0 当日发布会被本仓 `minimumReleaseAge` 冷却窗口拦，需开 `minimumReleaseAgeExclude` 例外 = 破自己的政策。前置 = `T801` 只读 spike（四数字）+ `T804` arch 确认（可行、无阻塞）。**本批替代 §一之一〇 的「`#391` 换工具链决策」待办项。**
- **分支** `chore/391-vite-plus-1.3.0`（自 `origin/main` `b36da9fb`）· 单提交 · PR **#407**（Draft，未合并 —— 等 PM 授权）。
- **改动面（6 类，应用侧依赖版本零变化）**：① `pnpm-workspace.yaml` catalog 两行（`vite: npm:@voidzero-dev/vite-plus-core@1.3.0` / `vite-plus: 1.3.0`）+ `pnpm-lock.yaml`（仅工具链：`oxfmt 0.60.0→0.73.0` · `oxlint 1.75.0→1.88.0` · `vitest 4.1.10→5.0.5` · `oxlint-tsgolint` / `chai` / `tinybench` / `std-env` 等传递依赖；`vue` / `axios` / `dexie` / `nue-ui` / `jsdom` / `typescript` / `electron` 版本**零变化**）；② `scripts/guard-dist-comments.mjs` 5 处 `U+200B` → `*\/`（1.3.0 的 `eslint(no-irregular-whitespace)` 会报 5 error；改法不提前闭合块注释、语义不变）；③ oxfmt 0.73 重排 2 文件（`docs/adr/2026-09-24-project-archive.md` 的 `****` → `\*\*\*\*`；`packages/domain-task/src/application/usecases/__tests__/task-archive.test.ts` 的 `vi.fn` 参数换行）—— **均语义零变化**（`****` 用 markdown-it 14 实测：改前/改后渲染 HTML 逐字相同）；④ `AGENTS.md` +11 行（1.x `vp config` 自动追加 `## Built-in Commands vs Scripts` / `## Tool Versions`，**必须提交**，否则每次 `pnpm install` 脏工作区 ⇒ `guard:commit-scope` 恒阻断）；⑤ `docs/qa/2026-09-23-task-export-multi-format-acceptance.md` 3 处伪围栏（单反引号 `` `text ``）→ 真 ` ```text `（开/闭各 3 行；另 2 处空行由 oxfmt 强制插入、1 处闭合行缩进 2→0 —— 第 41 行原在列表项内缩进 3 空格，1.3.0 会把围栏重排到 4 空格并把**围栏外**内容当正文折叠双空格，故只能提到顶层 0 缩进；**围栏内命令输出一字未动**，`Tests  1 failed` 的双空格与 `207:50  expect` 的双空格均在）；⑥ 本台账 + 缺陷池（新增 `DEF-167`）。
- **门禁（worktree `/tmp/t805-vp13`，node 24.22.3，独占无并发）**：`pnpm install` rc=0（未触发 `minimumReleaseAge`）· `vp fmt --check` **2077 文件 0 待改** · `vp check` **0 error / 63 warning**（1655 文件）· 全仓 `vp test --run` **496 文件 / 4025 例 / 4019 通过 / 6 跳过 / 0 红**（286.8s）· 七守卫 rc=0 + `guard:audit` rc=0 **advisory 2**（原 10，仅剩 `glob`×1 / `minimatch`×1）· `webapp build` rc=0 · `desktop:build` rc=0（含产物注释守卫：116 产物 / 注释 9 条全为打包器标注）· 移动端红线 `git status --porcelain -- packages/presentation-react apps/mobile` = **0 行**。
- **vitest 5 回归面（arch 指定三类，全绿 0 红）**：`not.toHaveBeenCalled` 104 文件 · `mock.calls[` 51 文件 · `mockClear` 32 文件 · `restoreAllMocks` 116 文件。**关键发现 = v5 把 `clearMocks` 默认值从 `false`（v4.1.10）改成 `true`**（`node_modules/vitest/dist/chunks/defaults.*.js` 实证 + 官方迁移指南「`clearMocks` is enabled by default」）。**A/B 探针有牙**：两例共享 `vi.fn`、第二例断言历史为 0 —— 默认下通过，显式 `clearMocks: false` 下**失败**。**再用 `clearMocks: false`（v4 语义）跑全仓 = 496 文件 / 4025 例 / 4019 通过 / 6 跳过 / 0 红**（与默认逐项相同）⇒ 本仓无用例依赖跨用例 mock 调用历史，**新默认语义中性、无假绿** ⇒ `vp migrate` 会加的 v4 兼容垫片 `test.clearMocks: false` **不需要**（已在 `vite.config.ts` 验证后回退，工作区无残留）。
- **`vitest.setup.ts` localStorage 兜底**：vitest 5 下**仍生效**。Node 24.22.3 与 **Node 26.12.1**（`mise exec node@26.12.1`，即历史上 95 文件 / 597 例假红的那个版本）各跑探针 **3/3 绿**：`localStorage` 可用 · `instanceof Storage` 成立 · `vi.spyOn(Storage.prototype,'getItem')` 仍能拦截 · 删掉后 `ensureLocalStorage()` 可重新注入（返回 `true`）。探针文件已删、未入库。
- **1.x 配置迁移项 = 无**（只列不改）：仓库未用 1.0 移除的 `vite-plus/test/{coverage,reporters,environments,snapshot,browser-webdriverio}`、无 `vitest/*` 直引、无 `test.browser` / `test.api` / coverage 阈值 / inline projects / `bench` / `test.sequential`；各 `tsconfig*` 无已废弃选项（`importsNotUsedAsValues` / `preserveValueImports` 等 0 命中）；`fmt` / `lint` / `staged` 三块在 1.3.0 下原样有效（`vp fmt` 与 `vp check` 实跑即证）。唯一「迁移项」是 opt-in 的 v4 兼容垫片，已按上条实证不需要。
- **运维事实（新增，跨批有效）**：`pnpm install` 会自动跑 `prepare: vp config`，1.x 会**往 `AGENTS.md` 追加 11 行**（`## Built-in Commands vs Scripts` + `## Tool Versions`）。⇒ ① 每次 install 后先看 `git status`；② 若这两节缺失，`guard:commit-scope` 会因「AGENTS.md 脏」阻断提交；③ ⛔ 不要为过 fmt 手工删这两节。
- **`docs/` 下真 ` ```text ` 围栏准数（本批实测，一条命令口径）**：**138 处 / 56 文件**（本批新增 3 处 / 1 文件 ⇒ 改动前 **135 处 / 55 文件**，与 PM 实测一致；arch 报的 152/70 **口径不同**，不入账）。

## 二、上一批次终态

- **✅ `v1.20.2` 已发布（2026-11-13，批次终态）**：发版 PR **#352** ⇒ squash **`787b301b`** · 注解 tag `v1.20.2` · Release 已发布（正文与 `docs/releases/v1.20.2.md` 归一化逐字一致 1924/1924）· 8 产物齐全 · 打包 run `43392992600` 四 job 全绿；版本 root/web/desktop **1.20.2** · `presentation` **0.12.0** · `shared` **1.6.0**。服务端无改动。
- 代码冻结点：变更历史活动流改造 PR **#351** ⇒ `2b5f2cde`。

## 三、长期环境事实（滚动，跨批有效）

- **GitHub 出网**：HTTPS 间歇 135s 超时 / 偶发 `flush 包` 半包 ⇒ push（含 tag）**重试 2–4 次**，`gh` 侧不受影响；`git@github.com:22` 不通。
- **`gh` token 已补 `workflow` scope（2026-11-23 用户执行 `gh auth refresh -s workflow`）** ⇒ 现可直接改 `.github/workflows/**`；scopes 实测 = `admin:public_key / gist / read:org / repo / workflow`。
- **本机 mise**：全局 `node 24.22.3` **不提供 pnpm** ⇒ 用 `mise exec node@24.22.1 -- pnpm …`；本仓要求的 Node 版本见 `.node-version`（本批新增）。
- **本地栈**：`nao-todo-server` 的 `docker compose up -d`；web dev 用 `setsid nohup` 起（⛔ 不用 tmux 托管），日志 `/tmp/webdev.log`，地址固定 `http://localhost:5173`（后端 CORS 白名单只有 5173/5174）。
- **飞书桥接**：`pi-remote-feishu@0.1.6`，配置 `nao-todo/.pi/feishu.json`（600/已忽略），`setsid` 常驻、日志 `/tmp/feishu.log`；三坑（`allowUsers: []` = 谁都不允许 · `stream-card` 需 `cardkit:card:write` 且权限改动须发版 · `rendering.mode:"text"` 静默）与 `dist/feishu/channel.js` 的 `senderId` 本地补丁（升级会覆盖）见归档。
- **走查载体**：一律本地 dev ↔ 本地后端；⛔ 不用 Vercel 分支预览（有登录墙）。视觉 / 真机走查由用户本人执行，PM 只给可勾选清单。