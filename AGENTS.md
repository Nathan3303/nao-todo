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
- 运行时任务状态（PM 维护）：`docs/tasks-state.md`；需求与决策留痕：`docs/prds/`、`docs/adr/`

### 机制衔接

- 代码结构检索：**CodeGraph** 索引位于 `.codegraph/`。结构性提问（谁调用谁 / 影响面 / 符号签名）优先 codegraph；grep 仅查字面文本
- UI 令牌 / UX playbook：本项目**尚未实例化**，模板见 `.agents/templates/frontend-ui/`

### 命令纪律

- 校验与构建：`vp install` → `vp check`（格式 + lint + 类型）→ `vp test`；`pnpm run guard:ddd`（领域隔离）；`pnpm run desktop:build`、`pnpm webapp build`
- 提交纪律：**精确 pathspec**，禁 `git add -A`；**不得提交** `.agents/**`（在制品）、`.codegraph/**`、`.pi/**`
- pre-commit 钩子 `vp staged` 会执行 `vp check --fix`：**以 `markdown` 为语言标记的代码围栏，其内部列表会被按 `.editorconfig` 的 `indent_size = 4` 重排**（曾静默改写 PRD 的冻结格式基准）。需原样保留缩进的示例，请用 `text` 作为围栏语言标记

### 项目红线

- **移动端红线**：`packages/presentation-react` 与 `apps/mobileapp` 不随桌面端 / Web 需求改动，除非用户明确授权
- 服务端契约（如分页稳定排序）不得为展示层需求擅动

<!-- NAO FLEET END -->