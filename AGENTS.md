# AGENTS.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```text
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

<!-- NAO FLEET START（PM 按 .agents/prompts/product-manager.md §七 维护；如需移除，整块删除即可） -->

## nao 舰队接入（2026-09-21）

> 只写「在哪里」；角色级/团队级内容不复制到此处，留在 `.agents/`。

### 角色与流程（指针）

- 角色清单（单一事实来源）：`.agents/roles.yaml`（pm / arch-designer / rd-fe / rd-be / qa）
- 角色卡 `.agents/prompts/<role>.md`｜公共规范 `.agents/common/`｜交付核对清单 `.agents/checklists/`｜按需技能 `.agents/skills/`｜模板 `.agents/templates/`
- 舰队拉起与自检：`bash .agents/scripts/nao-fleet.sh check | status | ensure <role>`；`status` 在本机**不可靠**（pi 进程 argv 被清空，`pgrep --name` 恒失配）→ 在线判定以 `intercom list` 为准
- 运行时任务状态（PM 维护）：`docs/tasks-state.md`；需求与决策留痕：`docs/prds/`、`docs/adr/`；**缺陷池（单一登记源，PM 维护）：`docs/reports/defect-pool.md`**

### 机制衔接

- **PM 关键节点主动推送**（2026-09-25 用户批准，最小方案 / 常驻能力）：**`~/.pi/agent/bin/qq-notify "文本"`** —— QQ 官方机器人**主动消息**（默认收件人 = 配置 `ownerOpenId`；可选 `--to <openid>` / `--dry-run`；退出码 **0** 成功 / **1** 参数或配置错 / **2** 取 token 失败 / **3** 发送失败）。**仅用于关键节点**（批次进度汇总 · 验收结论 · 发版或合并完成 · 异常与阻塞），**禁刷屏**。**当前 `sandbox: true`（用户已决定不切正式环境）** ⇒ 受沙箱与「主动消息」配额限制，失败以非 0 退出码 + 错误体回报。实现 = 读 `~/.pi/agent/pi-agent-qqbot.json` → `POST bots.qq.com/app/getAppAccessToken` → `POST {sandbox|prod}.api.sgroup.qq.com/v2/users/{openid}/messages`（体 `{content,msg_type:0}`，**不带 `msg_id` = 主动消息**）。
- 代码结构检索：**CodeGraph** 索引位于 `.codegraph/`。结构性提问（谁调用谁 / 影响面 / 符号签名）优先 codegraph；grep 仅查字面文本
- UI 令牌 / UX playbook：本项目**尚未实例化**，模板见 `.agents/templates/frontend-ui/`

### 命令纪律

- 校验与构建：`vp install` → `vp check`（格式 + lint + 类型）→ `vp test`；`pnpm run guard:ddd`（领域隔离 + **domain 禁引 `@nao-todo/shared/components`**）；**`pnpm run guard:mobile-imports`**（**移动端红线守卫** —— 移动端禁引 `persistence-local`/`persistence-sync`）**；**`pnpm run guard:barrel-imports`**（**导入面可解析性守卫** —— 覆盖 `.vue` 的 **type-only 导入**，补 `vp check` 盲区；纯静态 0.6s）**；**`pnpm run guard:gate-pathspec`**（**门禁 pathspec 存在性守卫** —— 防「**路径写错 ⇒ git 静默忽略 ⇒ 门禁恒 0**」；文档若确需引用错误路径示例 ⇒ 该行加 `<!-- gate-pathspec:ignore -->` 跳过校验）；`pnpm run desktop:build`、`pnpm webapp build`
- **`.agents/**` 是舰队资产，必须保持 `LF` + `roles.yaml` 嵌套缩进 2/4（角色 id 2 空格、字段 4 空格、禁 Tab）**：与 `nao-fleet.sh` 的 awk 解析器（`^---$` / `^  <role>:` / `^    <field>:`）兼容。**现状（2026-09-23 核实，原「危险警告」已失效，勿再据旧文报警）**：① **fmt 路径已关闭** —— `.agents/**` 在 `vite.config.ts` 的 `fmt.ignorePatterns` 内，**实测全仓 `vp check --fix` 前后 `.agents` 脏项恒为 0**、`roles.yaml` CR=0 且缩进 2/4 保持；② **守卫已有** —— `nao-fleet.sh check`（需 nao-skill ≥ **v0.6.1**）新增文本契约分组，校验 `.agents/**` EOL 全 LF（含 CR 即 fail 并列出文件，`.nao-obsolete/` 除外）+ `roles.yaml` 缩进 2/4 + 禁 Tab，失败 rc=1，且报告先于解析 die；③ **剩余唯一暴露面** —— 编辑器/IDE 按 `.editorconfig` 保存时可能把 `.agents/**` 转 CRLF，但**能被 `check` 发现**。**若真发生：把 `.agents/**` 转回 LF、`roles.yaml` 缩进改回 2/4，再复跑 `check`（应 exit 0）。** ⇒ **无需为避免 fmt 而局限 `--fix` 范围**（全仓 `--fix` 已安全）。
- **测试提速纪律（2026-09-23 新增，PM 维护）**：① **分级跑** —— 迭代期只跑**受影响文件/子包**（`pnpm exec vp test <paths>`），**全仓 `vp test --run` 只在批末**跑；② **禁并发跑全仓** —— **同一时刻只允许一个会话跑全仓门禁/全仓测试**（多会话并发跑会互相抢 CPU ⇒ 实测全仓耗时 **82s ↔ 156s** 抖动的主因）；③ 全仓耗时基线：**148 文件 / 约 82–156s**（随机器负载波动）；④ **配置现状**：`vite.config.ts` 的 `test` 为 vitest 默认（无 pool/maxWorkers/isolate 调优），提速剖析见 `T118`（qa，先测量后给方案）
- **测试提速实测结论（2026-09-23，qa `T118`，详见 `docs/qa/2026-09-23-test-speed-profiling.md`）**：**最快单文件验证 = `pnpm exec vp test --run <test 路径>`（实测 4.8s）**；`--changed`（10.1s）/ `related --run <src>`（16.1s）都更慢 —— 改 src 用 `related --run`，但 ⚠️ **barrel 盲区**（仅经 `packages/*/index.ts` 间接可达的 src **返回 0 文件** ⇒ 必须 grep 兜底）。套件是**聚合工作量**驱动（聚合 243.5s ÷ wall 90s ⇒ 并发 2.7/3 ≈90% 利用率）⇒ **加 worker 无益**；**真跑测试仅占 3%，主成本是 `import`**（根因：内部包 barrel `export *` × `isolate:true` ⇒ 每文件重付整个 infrastructure 层 ≈2.6s）；`packages/infrastructure` 的 **top 8 文件占全仓测试量 75.4%**，`persistence-local/__tests__/local-repos.test.ts`（24.29s）是**唯一关键路径**；jsdom **固定税 ≈0.82s/文件 × 65 ≈ 53s**（是「环境搭建」非「测试慢」）。**已证无效/有害（勿重复试）**：`--pool=threads`（+4%）· `--maxWorkers=4`（+10%）· 全仓 `--no-isolate`（−36% 但 **37 红/9 文件泄漏**）· `--changed` 追速度 · 在 `css?raw`/CSS 上优化 · 并发跑全仓 · **「拆分超大测试文件以降全仓 wall」**（**T119 实测：全仓 90.0s→92.7s = +1%，证伪 T118 方案#2**；但对「**受影响面迭代**」有效：关键路径 **24.3s→10.1s（−58%）**、4 文件合跑 **−46%**）⇒ **拆分只为迭代速度，不为全仓 wall**（套件是聚合工作量驱动，拆分新增 ~10s 聚合固定成本）。 **「测试侧改深路径导入」（T120a）实测 = 不做**：受控探针证实 barrel 确实贵（`shared` import **2.07–2.79s** vs 深路径 **53–88ms**），但**真实收益 <0.3%**（真可受益面仅 **4 个 `packages/domain-task` 包内测试** ≈ ≤0.5s wall）—— 根因：**生产侧仍引 barrel**（shared：infra 29 / presentation 112 / web 93 / desktop 5）⇒ **测试侧深导入消不掉已被生产闭包拉入的 barrel** ⇒ **唯一真杠杆在生产侧**（见 `T122` W1+W2）。⚠️ **方法论**：单跑曾显示 −4.5s，**stash 3× 对照后证实为冷缓存假象** ⇒ **提速结论必须多次对照，单跑不可用**。 **最终实测（`T122` 生产侧收窄 W1+W2，commit `92c153b2`，已保留）**：**硬指标** —— 关键闭包 **ΣVue SFC 68 → 0**（`persistence-sync/sync-service` 317/68→**165/0**；`apps/web/.../offline-prerequisites` 392/68→**40/0（−90%）**；desktop binding −55%；`@nao-todo/infrastructure` 桶 **−39%**）· **import 聚合 −11~~13%（−6.7~~−8.2s）** · 全仓 `vp test` **151 文件 / 1254 例 / 0 红**；**wall −1.4~−2.6s**（跨在阈值上 ⇒ 因 82–156s 噪声带 + jsdom 固定税**不可判**）⇒ **判据更正：以硬指标（import 聚合 / 模块图）为准，wall 不作判据**。**W2 的 14 个测试 mock 注册是「生产改深路径后 barrel `vi.mock` 失效」的必要连带**（否则测试失效/漏测），**非范围扩大**。 **「前后对照」测量纪律（2026-09-23 新增，qa `T125` 教训）**：**对照类测量（提速 / 体积 / 任何 pre-post 比较）必须用 `git worktree` 固定 commit 检出后构建/运行**（`git worktree add /tmp/x <commit>`），**禁止直接在主工作区构建** —— 否则其他 worker 推进 HEAD / 写入工作区时，**测到的会是别人的在制代码，口径会漂**；测完 `git worktree remove`。**`T125` 实测（生产 bundle 对照，报告 `docs/qa/2026-09-23-t122-production-bundle-compare.md`）**：**W1/W2 在生产侧无体积收益**（web **+845 B / +0.015%**、desktop **+18 B**、首屏同幅微增）⇒ **ADR §8 未过项② 可关闭、ADR §0 Q2「生产侧 ≈0（Rollup tree-shake）」由推定升级为实测确认**；唯一可测的结构收益 = **web bundle 模块数 1200 → 1183（−17，全为 `renderedLength=0` 纯 re-export 桶）**；chunk 有**搬家**（≈41 KB 模块 `offline`→`hooks`，均在首屏 preload 名单内 ⇒ 首屏构成不变）。**可信度加固**：同 commit 两次构建**逐字节相同** + **受控 A/B（回退 T122 生产改动后重建 ⇒ 与 pre 逐字节一致）** ⇒ 差异**只**来自生产改动、**14 个测试 mock 对产物零影响**。⚠️ **副作用**：chunk 哈希变化 ⇒ **已缓存用户需重下 ≈120 KB**（发布策略问题，一次性）。
- **会话收窗纪律（2026-09-23 新增，用户要求）**：**关会话（`tmux kill-pane`）前必须先确认该会话未在跑 turn** —— ① 先看是否已回**终态回执**（`[编号] done`；**未回执不得关**）；② 再 `tmux capture-pane -p -t <pane>` 看末 5 行状态行：**出现 `Working` / spinner = 正在跑 turn ⇒ 等它停**；③ 关前顺手确认其产物已落盘（`git log` 有提交、工作区干净、dev server / 探针已停），**避免丢失在制工作**
- 提交纪律：**精确 pathspec**，禁 `git add -A`；**`.agents/**` 已纳入版本管理**（2026-09-22 用户决定）；`.codegraph/**`、`.pi/**` 由 `.gitignore` 排除，不提交
- pre-commit 钩子 `vp staged` 会执行 `vp check --fix`：**以 `markdown` 为语言标记的代码围栏，其内部列表会被按 `.editorconfig` 的 `indent_size = 4` 重排**（曾静默改写 PRD 的冻结格式基准）。需原样保留缩进的示例，请用 `text` 作为围栏语言标记
- **「全范围门禁」= 本项目交付验收的完整口径（舰队角色卡所引用的就是本节，2026-09-23 新增）**：① `pnpm exec vp check`（格式 + lint + 类型，须 **0 error**）；② **全仓** `pnpm exec vp test --run`（**非子目录**；须报**文件数 / 例数 / 红数**）；③ `pnpm run guard:ddd`（领域隔离，exit 0）；④ `pnpm exec vp run webapp build` 与 `pnpm run desktop:build`（均 exit 0）；⑤ 移动端红线 `git status --porcelain -- packages/presentation-react apps/mobile` = **0**；⑥ **`pnpm run guard:gate-pathspec`**（**门禁 pathspec 存在性**，exit 0 —— 防「路径写错 ⇒ git 静默忽略 ⇒ 门禁恒 0」，2026-09-23 新增）。⑦ **`pnpm run guard:barrel-imports`**（**导入面可解析性**，exit 0 —— 覆盖 **`.vue` 的 type-only 导入**，补 `vp check` 的盲区（`TS2305` 场景），2026-09-23 新增）。⑧ **`pnpm run guard:mobile-imports`**（**移动端红线**：`packages/presentation-react` / `apps/mobile` 禁引 `persistence-local` / `persistence-sync`（拖入 **Dexie**），exit 0，2026-09-23 新增）。**（⑥⑦⑧ 为用户 2026-09-23 确认保留项）**。**worker 回执口径（2026-09-23 精化，测试提速）**：worker **只跑/只报「受影响面 + 其依赖包」**（须给**精确数字/退出码**；**不得**只写「pass」；**只跑子目录而不说明面不算回执**）——**全仓 5 项由批末 PM/qa 统一跑 1–2 次，作为硬闸门**（PM 默认不重复跑 worker 已跑的项，仅异常时复跑/抽查）。**若批末全仓转红 ⇒ 定位到谁的面谁返工。**
- **提交纪律（2026-09-23 精化，承接上条 `paths` 要求）**：`git add <pathspec>` **只决定「进 index」**；**裸 `git commit` 提交的是整个 index**，会把他人已 `git add` 但未提交的改动一并带走（本项目 2026-09-23 发生过一次）。⇒ 只提自己文件时用 **`git commit --only <paths>`**，且**提交前必须 `git diff --cached --name-only` 核对 index 实际内容**；其他写者有 staged 未提交改动时，**等其提交完成再提交**（同 cwd 单写者）。

### 项目红线

> **⚠️ 2026-09-23 修正（arch `T121` 发现，PM 核实）**：移动端门禁 pathspec 原写 `apps/mobileapp`，**该目录不存在**（实际是 **`apps/mobile`**）⇒ **`git status --porcelain -- apps/mobileapp` 被 git 静默忽略、门禁恒为 0**（**验收口径漏洞**）。已全部改为 **`apps/mobile`**。**核实结论：本批（近 40 提交）未触碰 `apps/mobile` / `packages/presentation-react`** ⇒ **红线未被违反**，但**门禁此前是空转**。`.agents/**`（舰队角色卡）内的同一路径亦须修 ⇒ **挂 nao-skills 下一批**。

- **移动端红线**：`packages/presentation-react` 与 `apps/mobile` 不随桌面端 / Web 需求改动，除非用户明确授权
- 服务端契约（如分页稳定排序）不得为展示层需求擅动
- **流程（2026-09-24 用户启用）：GitHub flow** —— 一个需求 = 一个 **Issue** + 一条分支 `feat/<issue-id>-<slug>` + 一个 **PR**（**squash 合并**，main 上 1 条 = 1 需求）；**`main` 为始终可发布的主干**；**合并由 RD 在 PR 上执行**，**PM 不亲自合并、不 `push` main**（PM 只验收授权 + 发布）；**tag 指向 main 的合并提交**；Issue 只放 TL;DR/AC/优先级/`docs/` 指针（**正文权威在 docs，禁双源**）；细则 `.agents/skills/github-flow.md`，运行时状态见 `docs/tasks-state.md`「需求分支 / PR / 发布」。**唯一例外（须登记白名单）**：历史积压追平的 baseline 合并可用 **merge commit**（一次性），其后严格 squash；无 `gh`/无远端时按该技能「降级」表执行并在台账标注。

<!-- NAO FLEET END -->