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

## 一之四、桌面端应用内自我更新（`feat` · 在制 · Issue #358）

- **需求**：Desktop 端内置「检查更新 + 立即更新」（用户 2026-11-20 提出；5 项澄清已答：Linux/Windows 原地更新 · macOS 与 deb 降级下载页 · 启动静默检查 + 手动入口 · 下载完提示重启/稍后 · 未同步改动需护栏）。
- **PRD**：`docs/prds/2026-11-20-desktop-self-update.md`（AC1–AC13 · RICE ≈0.29 · Must）。**分支** `feat/358-desktop-self-update`（自 `origin/main` `7cd26fb5`）。
- **开工确认（用户 2026-11-20）**：按卡开工 · arch 与 uiux 并行 · 设计稿验收模型 = **A 用户本人确认** · 范围**全量照 PRD**（含启动静默检查与侧栏弱提示）。
- **回执**：`T733` arch **done** `4a4d26ac` ⇒ `docs/adr/2026-11-20-desktop-self-update.md`（选官方 `electron-updater` 6.x + GitHub Releases 唯一源；构建/CI **本期不改**；平台矩阵 = 纯环境判定；护栏复用既有 `useSyncStatus()`；`autoDownload` / `autoInstallOnAppQuit` = false；坏包 = 撤资产 + 发更高 PATCH；`T733b` `fc64c6c0` 补 QA 六条可测性前置，**全部可满足**）· `T735` qa **done** ⇒ 接缝定稿 = **2 主接缝 + 1 轮一次性证据（不进 CI）** + 6 条可测性前置（已写入 PRD §七）· `T734` uiux **done**（`74094eb9`…`67a97f69`）：设计稿 73 行 + 双语文案 88 行 + `docs/designs/README.md` 索引，Penpot 9 画板（仓外）；AC1–AC13 逐条落点给出、AC12 一处受控偏离已自报。
- **用户设计稿验收（2026-11-20）＝ 通过**（模型 A）：Shadcn 桌面密度照旧、**按钮 30px 保留**、护栏取**文案 A（软提示）**。
- **三项遗留裁决（PM，2026-11-20）**：① AC12 `LoadingError` 仅 `checking` 用，`idle`/`failed` 走 DESIGN §4.1「动作级内联」⇒ **受控偏离采纳**，但须在 `DESIGN.md` §4.1 登记；② 30px **只在本块登记例外**（不改 §3 全局口径、不推全仓 30px），须在 `DESIGN.md` §3 已登记例外段补一行；③ 护栏文案事实已由 arch `T733c` 读码给出 ⇒ **队列跨重启保留**（Dexie `nao-todo-desktop.syncQueue`，冷启动 `syncService.start()`→`pushAllInner()`→`syncTracker.listDirty()` 重推），但 **`failedCount` 是内存态、重启清零** ⇒ 护栏判据必须用「队列非空」，⛔ 不得用 `failedCount`；文案 A 维持且禁「失败」措辞。
- **RD 派单（2026-11-20）**：`T736` rd-infra（主进程 electron 零依赖内核 + 五端口 + `resolveInstallMode` 纯函数 + preload 契约 + `electron-updater` 依赖；契约先落并通知 rd-fe；PR owner + Draft PR）· `T737` rd-fe（`data-panel` 版本行升级为卡 + `use-desktop-updater` 独立 hook + 卡 A + 侧栏 6px 弱提示 + i18n 双键）。Reviewer = qa。
- **待办**：RD 回执 → 用户视觉走查（构建产物）+ qa 独立复验 → PM 逐 AC 验收 → RD 合并 → 发布（MINOR）→ 发版检查项加「tag = `package.json` = `latest*.yml` 三者一致」。
- **转办（QA 提出）**：Electron E2E 基建（Playwright / `_electron`）本期不建 ⇒ 进待派发队列（Owner：待定）；Windows 原地更新与 macOS 分支人工验收属已接受风险（PRD §八）。

## 二、上一批次终态

- **✅ `v1.20.2` 已发布（2026-11-13，批次终态）**：发版 PR **#352** ⇒ squash **`787b301b`** · 注解 tag `v1.20.2` · Release 已发布（正文与 `docs/releases/v1.20.2.md` 归一化逐字一致 1924/1924）· 8 产物齐全 · 打包 run `43392992600` 四 job 全绿；版本 root/web/desktop **1.20.2** · `presentation` **0.12.0** · `shared` **1.6.0**。服务端无改动。
- 代码冻结点：变更历史活动流改造 PR **#351** ⇒ `2b5f2cde`。

## 三、长期环境事实（滚动，跨批有效）

- **GitHub 出网**：HTTPS 间歇 135s 超时 / 偶发 `flush 包` 半包 ⇒ push（含 tag）**重试 2–4 次**，`gh` 侧不受影响；`git@github.com:22` 不通。
- **`gh` token 缺 `workflow` scope** ⇒ 改 `.github/workflows/**` 的提交会被拒（本批 `release.yaml` 改动需注意：**推送前先确认 token 是否已具 `workflow` scope，否则改走用户授权**）。
- **本机 mise**：全局 `node 24.22.3` **不提供 pnpm** ⇒ 用 `mise exec node@24.22.1 -- pnpm …`；本仓要求的 Node 版本见 `.node-version`（本批新增）。
- **本地栈**：`nao-todo-server` 的 `docker compose up -d`；web dev 用 `setsid nohup` 起（⛔ 不用 tmux 托管），日志 `/tmp/webdev.log`，地址固定 `http://localhost:5173`（后端 CORS 白名单只有 5173/5174）。
- **飞书桥接**：`pi-remote-feishu@0.1.6`，配置 `nao-todo/.pi/feishu.json`（600/已忽略），`setsid` 常驻、日志 `/tmp/feishu.log`；三坑（`allowUsers: []` = 谁都不允许 · `stream-card` 需 `cardkit:card:write` 且权限改动须发版 · `rendering.mode:"text"` 静默）与 `dist/feishu/channel.js` 的 `senderId` 本地补丁（升级会覆盖）见归档。
- **走查载体**：一律本地 dev ↔ 本地后端；⛔ 不用 Vercel 分支预览（有登录墙）。视觉 / 真机走查由用户本人执行，PM 只给可勾选清单。