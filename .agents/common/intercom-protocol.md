---
description: pi-intercom 多会话协作协议（常驻引用）
---

# 多会话协作协议（pi-intercom）

## 角色与接入

- **上下文分层与优先级**：`AGENTS.md`（项目级，PM 维护）**优先** → 本文件/roles.yaml（团队级）→ 角色卡（角色级）→ 技能（按需）。AGENTS.md 已由 pi 自动注入上下文，**所有角色必须遵循其中项目约束**（命令纪律/领域红线/机制衔接）；各层只写自己的内容，不互相复制。
- 会话由 `nao-fleet.sh` 以 `--name <别名>` 拉起，角色卡经 `--append-system-prompt` 启动期注入。
- **角色 id / 别名 / 卡片映射以 `.agents/roles.yaml` 为唯一事实来源**（下表为当前快照，改动先改 roles.yaml）。
- 被点名先回执：`已按 <role> 角色执行`。
- 仅当消息明确要求、且确认未注入时，才自行读取 `@.agents/prompts/<role>.md`（跨仓库会话用启动期注入的环境锚点绝对路径）。

## 别名与工作区（fleet.sh，以 .agents/roles.yaml 为准）

| 别名 | 角色卡 | 默认工作区 |
| :--- | :--- | :--- |
| `pm` | product-manager | 当前项目目录 |
| `arch` / `arch-designer`（同义） | architecture-designer | 当前项目目录 |
| `rd-fe` | frontend-developer | 当前项目目录 |
| `rd-be` | backend-developer | 前后端分离时显式 `rd-be@<repo>` |
| `qa` | test-engineer | 当前项目目录 |

拉起：`bash .agents/scripts/nao-fleet.sh ensure <别名>[@<repo>]`

- **任务派生**：`ensure --task <编号> <别名>[@<repo>]` 创建 `<角色>-<编号>` 独立会话（如 `rd-be-T1`），并行隔离、互不排队/打断，避免多任务同名冲突；任务闭环即**回收**：`nao-fleet.sh close --task <编号> <别名>`（内置在跑 turn / tasks-state 闸门）。

- **判重 / 在线判定**：脚本按 pi 自设的**终端标题**（`π - <会话名> - <仓库名>`）+ `pi-intercom` 名册判在线（**不用 `pgrep --name`**：pi 启动后 argv 被改写为 `pi`，会恒失配）；已运行则跳过并 warn。确需重开加 `--force`。
- **tmux 宿主**：`$TMUX` 存在时在当前窗口分屏拉起（默认布局 `main-row2`：
  首 pane 全高占左，后续每角色往右开列、每列上下 2 个）；不在 tmux 内则创建
  detached 会话，需 `tmux attach -t nao-<别名>`。
- **模型规则**：用户未指定则**禁止传 `--model`**，也禁止继承 PM 自身模型。
  显式指定时由 `NAO_MODEL_WHITELIST` 在**命令行入口解析阶段**即校验，
  不命中直接 `die`，无部分拉起；PM 只需如实转达用户 `-m` 指定。

## 开工前自检（派发闸门）

派发前跑一次：

```bash
bash .agents/scripts/nao-fleet.sh check
```

- 目录/角色卡/common/skills 齐备、roles.yaml 可解析且与卡片 frontmatter（role/version）一致、卡片交叉引用文件齐备、布局合法 → 继续
- 白名单脏（重复 / `*` / 空条目）→ 提醒用户清理
- 常驻卡超阈值 → 记 TODO，不阻塞
- **PR 模板缺失（仅 GitHub 远端时提示）** → 不阻塞；PM 立项时补建（见 @.agents/skills/github-flow.md）
- **退出码非 0**（硬错误：目录缺失 / manifest 或 frontmatter 非法 / 交叉引用缺失 / 布局非法）→ **停止派发**

## 线程纪律

- `ask` 提问 → `reply` 保持线程。
- 同会话一次只挂一个 `ask`；遇 `Already waiting` 降级 `send`。
- 长任务：`send` 分派 + worker 定期短汇报。
- 派发一条到位：`编号 + 范围 + 引用路径（docs/...md#section）+ AC 编号 + 回执级别`；**不贴 PRD/方案全文、不用附件传全文**（接收方自己读文件）。
- `ask` 默认超时 10 分钟。
- `list` 确认目标在线后再派发。

## 派发忙闲闸门

- **忙闲信息**：`intercom({action:'list'})` 返回 live status（`idle`/`thinking`/`tool:<name>`），是判定依据。
- **`idle` 才派完整任务**：目标在线且空闲才投递任务细节。
- **忙 → 排队（不 send 任务内容）**：目标 `thinking`/`tool:*` 时，消息行为取决于目标形态——非交互/headless worker 忙时**消息会被拒收**（目标自动回一条说明），交互会话忙时 `send` 会触发 **steer 打断**当前任务。因此忙时**不要**投递任务细节，直接把任务记入待派发队列（`docs/tasks-state.md`），`list` 变 `idle` 后再派完整任务。
- **紧急例外**：交互会话可用 `send` **steer 注入**抢占（注明 `紧急抢占：暂停当前任务，优先本任务，回执须报告挂起任务状态`）；非交互会话忙时只能排队等空闲（抢占消息会被拒收）。
- **忙时禁 `ask`**：目标忙碌时 `ask` 会空等超时；一律走排队 + 后续 `send`。
- 不静默等待：不确定时先 `list` 确认形态与状态，避免「派发后无下文」。
- **状态外部化与恢复**：任务状态落盘 `docs/tasks-state.md`（PM 维护，见 PM 卡 §六）；PM 会话重开/降级恢复时**先读该文件重建状态**再继续调度，不依赖历史消息。
- **离线检测与恢复**：`list` 发现已派发目标从在线变离线（会话死亡/关闭）→ 任务标记「挂起（离线）」入 tasks-state → `ensure --force` 重拉该角色 → `send` 询问进度或按挂起快照重派。
- **队列唤醒（不单独轮询）**：每次收到回执/汇报/用户输入时，顺带 `list` 检查待派发队列目标是否 `idle`，是则派发——避免排队任务因无人唤醒而悬置。
- **降级回流**：降级交付（intercom 不可用）的结果经用户转交后，PM 补登记 tasks-state 与归档（`docs/`），标注「降级回流」，恢复状态机一致性。
- **单 PM 纪律**：同一项目同一时刻**仅一个 PM 调度会话**（fleet 按会话名 `pm` 判重；手动会话请用别名 `pm`），避免双头调度互相覆盖 tasks-state。

## 终态回执（硬性闸门，所有角色适用）

- **两级回执**（模板见 @.agents/checklists/comm-templates.md，回执前读取）：默认 `done(lite)` 单行（含门禁精确数字）；**出现阻塞/风险/需决策或 PM 指定时用 `done(full)`**。前缀 `[编号] done` 不变（PM 追讨/红线均按 `done` 匹配）。
- 每次派发的任务（含架构评审）**必须以终态回执结束**：按 @.agents/checklists/comm-templates.md `[编号] done(lite|full) | <role>`，经 intercom `send` 回 PM。
- **回执 = 已核对清单**：回执须声明已读 `checklists/<role>.md` 并逐项核对（未过项必须列出）；未核对不回执。
- **回执「测试」字段 = 全量门禁精确数字（硬性）**：必须给 `命令 + exit code + 文件数/例数/红数（或错误数）`；**只跑子目录、或只写「pass」不算回执** → PM 打回。**跑子目录不算验收**：全范围口径见项目 `AGENTS.md`。
- 短消息（≤150 字摘要 + 结论/决策点 + 详情落盘路径）；**禁止**把长报告全文 `send` 污染线程（output-format「反模式」）。
- arch 评审回执至少含：可行性结论、ADR 路径、待 PM 拍板决策点。
- `send` 失败（目标离线 / 会话不存在）→ 尝试 `ask`；仍失败 → 降级交付并注明，见「降级」。
- PM 侧：派发后未收到回执 → 主动追讨（`ask`/`send`），**不默认成功**；`nao-fleet.sh status` + `intercom list` 辅助确认在线名单。

## 角色卡版本与同步

- 每张卡 frontmatter 的 `version` / `updated` 是唯一事实；`.agents/roles.yaml` 只维护 aliases→id→card，不重复版本。
- 修改角色卡：bump `version`、更新 `updated`；PM 经 intercom 广播**短消息** `card <role> v<N+1>（摘要）`——不贴全文。
- worker 接任务前核对自身注入版本；发现 stale → 重读 `@.agents/prompts/<role>.md`（跨仓库会话用注入的环境锚点绝对路径）。
- `nao-fleet.sh check` 校验：manifest 可解析、frontmatter 与 manifest 一致、交叉引用文件存在；GitHub 远端下额外提示 PR 模板缺失（warn，不改退出码）。

### 缓存与 Token 纪律（省的是大头）

- **system prompt 稳定 = 前缀缓存命中**（命中按 cacheRead 计费，约全价 1/10）：改卡要**批量一次到位**，避免频繁改导致全部会话缓存失效；易变内容（任务/进度）放消息体，不进卡片。
- 红线/检查清单/速查表已按需化到 `@.agents/checklists/<role>.md`，**只在交付/评审前读取**，不要日常轮次主动展开。
- **上下文生命周期**：worker **任务闭环即重开会话**（`fleet.sh ensure --force <role>`）优于等自动压缩（压缩要花 token 重写且丢细节）；**PM 是唯一常驻长寿会话**，改按批次边界重开，见下「会话生命周期」。
- **会话体检（可回归）**：每次归档后在归档文件「派发记录」记一行 `contextTokens / 压缩次数 / cacheRead 占比`（`/session`）——上下文纪律有数字才能判定何时该重开。
- 观察：`showCacheMissNotices: true` + `cacheWarming: "idle"`，用 `/session` 看缓存命中/失效与成本。

## 会话生命周期（worker 与 PM 分治）

- **worker**：任务闭环即**回收**派生会话（`close --task <编号> <别名>`）或重开常驻会话（`ensure --force`，优于自动压缩）。
- **PM（唯一常驻长寿会话）**：按**批次边界**重开（归档完成 / 用户换需求 / `/session` contextTokens 超窗口 40%）+ 落盘接续 + 重开后**回读确认**；细则见 PM 卡 §六，快照骨架见 @.agents/templates/tasks-state.md.example。
- **自动压缩只作兜底**：LLM 摘要**有损且不可审计**（决策点最易丢）、额外花 token、禁用该次 prompt-cache 写、打断缓存预热——它救的是溢出，不是记忆。

## 输入信封（凡评审/派发前核对，缺项先索要）

- 主题/编号、范围与非范围
- 引用路径（PRD/方案给 `docs/...md#section`，禁贴全文）
- AC 编号 + 回执级别（lite 默认 / full）
- **需求分支** `feat/<issue-id>-<slug>`（降级 `nao/<批次-slug>`）+ PR owner + Reviewer + 预览环境（有/无）
- 提交与合并纪律：工作期只落分支、路径级暂存禁 `-A`；**PM 验收通过后由 RD squash 合并**（见 `@.agents/skills/github-flow.md`）
- NFR 基线（缺失必须反问）
- 约束清单（成本/团队/时间/合规）
- 目标里程碑
- 关联仓库路径（前后端分离时给双根）

## 输出信封

- 评审类：① 可行性结论（可行/有条件可行/不可行）② 风险清单（影响+应对）③ 技术取舍及理由 ④ **需 PM 拍板的决策点列表**
- 设计类：需求分析 → 架构模式 → 技术选型 → 分阶段里程碑
- 实现类：`回执模板`（见 @.agents/checklists/comm-templates.md）

## 降级

- **前置判定**：先 `status`/`list` 确认 PM 是否可达；**PM 可达必须回执，不降级**；仅当 intercom 不可用或无法送达 PM 时才降级。
- intercom 不可用或未被调度：
  - PM → 直接输出 PRD/人工分派清单，**绝不亲自写码**。
  - 架构师 → 本会话直接输出完整评审报告，由用户转交 PM。
  - RD/测试 → 本会话正常执行，产出交用户转交。

## 归档约定

- PRD：`docs/prds/YYYY-MM-DD-<主题>.md`，索引 `docs/prds/README.md`。
- ADR：`docs/adr/YYYY-MM-DD-<主题>.md`，索引 `docs/adr/README.md`。
- 评审/测试报告：`docs/reports/<编号>-<主题>.md`（按需）。
- 业界调研：`docs/research/YYYY-MM-DD-<主题>.md`（协议与引用格式见 @.agents/skills/research.md）。
- 发布说明：`docs/releases/<version>.md`（PM 维护，Tag Release 前落盘；gh 不可用时作 Release notes 正文）。
- PR 模板：`.github/pull_request_template.md`（PM 从 `.agents/templates/github/pull_request_template.md.example` 复制建立）。
- 所有 `docs/` 长文（PRD/ADR/报告/调研）的正文规范（长度上限、骨架、必写/可省/禁写）见 @.agents/checklists/deliverable-docs.md。

## 跨会话反模式

- 粘贴 PRD/角色卡/输入信封全文。
- 无信封直接派发。
- 对未标角色的会话猜测前后端/测试身份。
- PM/RD/QA 越权改代码。
- 工作期把 WIP 提交落 main，或绕过 PR 合并。
- 未过 PM 验收就合并 PR；PM 亲自合并 / `push` main；PM 手改源码或冲突内容。
- Issue 与 `docs/` 双源（正文抄进 Issue / 状态只留平台）。
- 未过验收就打 tag / release，或 tag 指向非 main 合并提交。
- `check` 非 0 仍强行派发。
- 在 tmux 内拉起前未评估宿主窗口被重排的影响。
- 派发后静默消失（无终态回执）。
- 改卡不 bump `version` / 不广播变更。
