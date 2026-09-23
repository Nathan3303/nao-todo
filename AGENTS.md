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

- 代码结构检索：**CodeGraph** 索引位于 `.codegraph/`。结构性提问（谁调用谁 / 影响面 / 符号签名）优先 codegraph；grep 仅查字面文本
- UI 令牌 / UX playbook：本项目**尚未实例化**，模板见 `.agents/templates/frontend-ui/`

### 命令纪律

- 校验与构建：`vp install` → `vp check`（格式 + lint + 类型）→ `vp test`；`pnpm run guard:ddd`（领域隔离）；`pnpm run desktop:build`、`pnpm webapp build`
- **`.agents/**` 是舰队资产，必须保持 `LF` + `roles.yaml` 嵌套缩进 2/4（角色 id 2 空格、字段 4 空格、禁 Tab）**：与 `nao-fleet.sh` 的 awk 解析器（`^---$` / `^  <role>:` / `^    <field>:`）兼容。**现状（2026-09-23 核实，原「危险警告」已失效，勿再据旧文报警）**：① **fmt 路径已关闭** —— `.agents/**` 在 `vite.config.ts` 的 `fmt.ignorePatterns` 内，**实测全仓 `vp check --fix` 前后 `.agents` 脏项恒为 0**、`roles.yaml` CR=0 且缩进 2/4 保持；② **守卫已有** —— `nao-fleet.sh check`（需 nao-skill ≥ **v0.6.1**）新增文本契约分组，校验 `.agents/**` EOL 全 LF（含 CR 即 fail 并列出文件，`.nao-obsolete/` 除外）+ `roles.yaml` 缩进 2/4 + 禁 Tab，失败 rc=1，且报告先于解析 die；③ **剩余唯一暴露面** —— 编辑器/IDE 按 `.editorconfig` 保存时可能把 `.agents/**` 转 CRLF，但**能被 `check` 发现**。**若真发生：把 `.agents/**` 转回 LF、`roles.yaml` 缩进改回 2/4，再复跑 `check`（应 exit 0）。** ⇒ **无需为避免 fmt 而局限 `--fix` 范围**（全仓 `--fix` 已安全）。
- **测试提速纪律（2026-09-23 新增，PM 维护）**：① **分级跑** —— 迭代期只跑**受影响文件/子包**（`pnpm exec vp test <paths>`），**全仓 `vp test --run` 只在批末**跑；② **禁并发跑全仓** —— **同一时刻只允许一个会话跑全仓门禁/全仓测试**（多会话并发跑会互相抢 CPU ⇒ 实测全仓耗时 **82s ↔ 156s** 抖动的主因）；③ 全仓耗时基线：**148 文件 / 约 82–156s**（随机器负载波动）；④ **配置现状**：`vite.config.ts` 的 `test` 为 vitest 默认（无 pool/maxWorkers/isolate 调优），提速剖析见 `T118`（qa，先测量后给方案）
- **会话收窗纪律（2026-09-23 新增，用户要求）**：**关会话（`tmux kill-pane`）前必须先确认该会话未在跑 turn** —— ① 先看是否已回**终态回执**（`[编号] done`；**未回执不得关**）；② 再 `tmux capture-pane -p -t <pane>` 看末 5 行状态行：**出现 `Working` / spinner = 正在跑 turn ⇒ 等它停**；③ 关前顺手确认其产物已落盘（`git log` 有提交、工作区干净、dev server / 探针已停），**避免丢失在制工作**
- 提交纪律：**精确 pathspec**，禁 `git add -A`；**`.agents/**` 已纳入版本管理**（2026-09-22 用户决定）；`.codegraph/**`、`.pi/**` 由 `.gitignore` 排除，不提交
- pre-commit 钩子 `vp staged` 会执行 `vp check --fix`：**以 `markdown` 为语言标记的代码围栏，其内部列表会被按 `.editorconfig` 的 `indent_size = 4` 重排**（曾静默改写 PRD 的冻结格式基准）。需原样保留缩进的示例，请用 `text` 作为围栏语言标记
- **「全范围门禁」= 本项目交付验收的完整口径（舰队角色卡所引用的就是本节，2026-09-23 新增）**：① `pnpm exec vp check`（格式 + lint + 类型，须 **0 error**）；② **全仓** `pnpm exec vp test --run`（**非子目录**；须报**文件数 / 例数 / 红数**）；③ `pnpm run guard:ddd`（领域隔离，exit 0）；④ `pnpm exec vp run webapp build` 与 `pnpm run desktop:build`（均 exit 0）；⑤ 移动端红线 `git status --porcelain -- packages/presentation-react apps/mobileapp` = **0**。**worker 回执口径（2026-09-23 精化，测试提速）**：worker **只跑/只报「受影响面 + 其依赖包」**（须给**精确数字/退出码**；**不得**只写「pass」；**只跑子目录而不说明面不算回执**）——**全仓 5 项由批末 PM/qa 统一跑 1–2 次，作为硬闸门**（PM 默认不重复跑 worker 已跑的项，仅异常时复跑/抽查）。**若批末全仓转红 ⇒ 定位到谁的面谁返工。**
- **提交纪律（2026-09-23 精化，承接上条 `paths` 要求）**：`git add <pathspec>` **只决定「进 index」**；**裸 `git commit` 提交的是整个 index**，会把他人已 `git add` 但未提交的改动一并带走（本项目 2026-09-23 发生过一次）。⇒ 只提自己文件时用 **`git commit --only <paths>`**，且**提交前必须 `git diff --cached --name-only` 核对 index 实际内容**；其他写者有 staged 未提交改动时，**等其提交完成再提交**（同 cwd 单写者）。

### 项目红线

- **移动端红线**：`packages/presentation-react` 与 `apps/mobileapp` 不随桌面端 / Web 需求改动，除非用户明确授权
- 服务端契约（如分页稳定排序）不得为展示层需求擅动

<!-- NAO FLEET END -->