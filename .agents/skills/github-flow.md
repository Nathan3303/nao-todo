---
description: 按需技能——新需求落地流水线（Issue → 分支 → PR → 验收 → squash 合并 → Release；GitHub Flow / trunk-based）
---

# 新需求落地流水线（GitHub Flow）

## 触发时机

PM 在**立项 / 终签 / 发布**时读取；RD 在**起分支 / 开 PR / 合并**时读取；QA 在 **PR 验证**时读取。日常轮次不加载。

## 原则

- **main 始终可发布**：main 只接收经 PR + 验收的 **squash 合并（1 条 = 1 需求）**。
- **短生命周期分支**：一个需求一条分支，存活 ≤ 一个批次；跨天过长就拆需求。
- **边界对齐**：一个批次 ≡ 一个需求 ≡ 一个父 Issue ≡ 一条分支 ≡ 一个 PR（前后端分离则每仓库一条）。
- **合并权在 RD，闸门在 PM**：PM **验收通过前不得合并**；合并由 RD 在 PR 上执行，**PM 不亲自合并**。

## 八阶段

| # | 阶段 | 主责 | 动作 | 产出 |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 立项 | PM | 建 Issue（用户故事 / AC / 优先级 / 里程碑）+ PRD 正文落 `docs/prds` | 可追踪 Issue |
| 2 | 拆分排期 | PM | 拆任务、定 PR owner / Reviewer / 分支名 | 开工确认卡 |
| 3 | 起分支 | RD | 从 main 拉 `feat/<issue-id>-<slug>`，开 **Draft PR** | Draft PR + CI |
| 4 | 开发提交 | RD | 小步 `wip(<编号>):` 提交，push 触发 CI | 增量代码 + CI 结果 |
| 5 | 评审测试 | RD / QA / Reviewer | 填 PR 模板、QA 跑全量门禁、预览环境验证 | Review 通过 |
| 6 | 验收合并 | PM → RD | PM 逐条核 AC 并在 PR 评论；**通过后由 RD squash 合并、删分支** | main 上 1 条提交 |
| 7 | 发布 | PM | 版本号 + tag + Release notes（优先 `gh`） | Release 记录 |
| 8 | 复盘 | PM | 监控指标、关 Issue、归档 PRD | 复盘 + 归档 |

## 分支与提交

- 命名：`feat/<issue-id>-<slug>`；无 Issue 时降级 `nao/<批次-slug>`；hotfix 用 `hotfix/<issue-id>`。
- **禁止** `git push` 到 main、**禁止绕过 PR 合并**；feature 分支允许 `--force-with-lease`（改基 / 压缩历史时）。
- 提交规范、`wip()` 前缀、路径级暂存、可读性：见 @.agents/skills/commit.md。
- **squash 后 main 上的提交信息 = PR 标题 + PR 正文** → **可读性硬性落在 PR 标题**（用户可见行为，禁纯编号/类名/路径）。

## Issue 与状态（避免双源）

- **Issue = 入口 / 摘要 + 指针**：body 只放 TL;DR、AC 编号、优先级、`docs/prds/...md` 指针。
- **`docs/` = 正文权威**（PRD 全文、`tasks-state.md` 运行时状态）：离线可用、会话重开读本地。
- **同步时机（仅 5 个节点）**：立项、派发、验收通过、合并、发布——其余不动 Issue，省 gh 往返。
- Issue 上的业务讨论由 PM **摘录进 `docs/`**，不留在平台。

## PR 模板与 Reviewer

- 模板 `.github/pull_request_template.md`（PM 从 `.agents/templates/github/pull_request_template.md.example` 复制建立）。
- Reviewer 由 PM 在开工确认卡指定（默认 `arch-designer`；纯 CRUD 可写「无」并注明理由）。
- QA 在 PR 评论贴**门禁精确数字**；PM 在 PR 评论核 AC。

## 发布（阶段 7）

- 版本号：SemVer，PM 按批次范围定（feat→MINOR / fix→PATCH / 破坏性→MAJOR）；项目 `AGENTS.md` 有约定则从之。
- 门禁：AC 全过 + 验收闭环 + main 门禁全绿 + 工作区干净 + PR 已合并。
- **优先 `gh`**：`gh release create <tag> --title "<用户可读标题>" --notes-file docs/releases/<version>.md`。
- 探测：`gh auth status` 按 **exit code** 判定（`keyring` 警告但 exit 0 **仍可用**，可 `gh api user` 复核）；**不自动 `gh auth login`**（涉用户凭证）。
- release notes 落盘 `docs/releases/<version>.md`（规范见 @.agents/checklists/deliverable-docs.md）。
- 回滚：未 push → `git tag -d`；已 push → **不删远端 tag**，改发下一个 PATCH 修正（用户明确要求才删）。

## 离线 / 无远端降级

无 `gh` / 无远端 / 未认证时**不阻断交付**，按同构降级（**保持「main = 1 条/需求」不变**）：

| 环节 | 正常 | 降级 |
| :--- | :--- | :--- |
| 立项 | GitHub Issue | 摘要写 `docs/prds` + tasks-state，跳过 Issue |
| 分支 | `feat/<issue-id>-<slug>` | `nao/<批次-slug>` |
| 评审 | PR + CI + 预览环境 | 本地全量门禁 + PM 读 diff |
| 合并 | PR squash merge | PM 验收通过后，RD 本地 `git merge --squash feat/… && git commit` + 删分支 |
| 发布 | `gh release create` | `git tag -a` + notes 落 `docs/releases/` |

降级须在 `tasks-state` 与回执中标注「降级」。

## 红线

- [ ] 未过 PM 验收就合并 PR，或直推 main？
- [ ] main 上出现多条本需求提交，或出现 `wip()` 提交（未 squash）？
- [ ] PM 亲自执行合并 / `push` main？
- [ ] Issue 与 `docs/` 双源（正文抄进 Issue，或状态只留平台）？
- [ ] 未过验收 / 门禁未绿就打 tag，或 tag 指向非 main 提交？
- [ ] PR 标题 / release notes 不可读（纯编号 / 类名 / 路径）？
- [ ] 降级未标注？
