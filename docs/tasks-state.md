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
- **待办**：push 分支 → PR → RD 合并 → 发版决策（本批含 `pnpm-lock` −227 包与测试 setup 新增，建议 PATCH）。

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