# 2026-09-29 文档规范上游化 PRD（事后补录：发版说明写作规范 + 慎用表格规范 ⇒ 上游 `nao-skill`）

> **状态**：**已实现并发布**（上游 `nao-skill@0.10.0`，2026-09-30）· 本文件为**事后补录的需求与决策留痕**。
> **依据**：用户 2026-09-30 的两项要求 · 上游仓 `nao-skills` 的 `PR #15`（合并 `76d7c81`）· `docs/releases/v0.10.0.md`（上游）· 四仓同步记录（`docs/tasks-state.md`）。
> **硬约束**：**下游不得为过 fmt 而格式化 `.agents/**`**（上游原始未格式化形态；「逐字节 sha 一致 = 同步唯一完整性判据」）· 类型安全由上游 `check:agents`（strict `tsc`）把关。
> **补录说明**：同 `2026-09-28-conflict-ux-finalization.md`。本批作业**跨仓**（本项目为下游消费者之一）。

## 1. 需求来源（用户要求）

1. 「把**发版说明写作规范**落地到 `nao-skill`，使其适用于所有使用 `nao-skill` 的仓库」
2. 「把**慎用表格规范（含 PRD）**一并落地」

背景：此前两项规范只在本仓实践（`AGENTS.md` 内的约定 + 本仓发布说明试行），用户要求**上游化**，让所有下游仓库自动获得。

## 2. 逐条需求与验收口径

**2.1 发版说明写作规范上游化（`T434`）**
- 新增 `.agents/common/release-notes.md`（58 行，通用化表述）
- 新增模板 `.agents/templates/release-notes.md.example`（53 行）
- 接线：`skills/github-flow.md` §发布 · `checklists/pm.md` 发布红线 · `templates/AGENTS.md.example` · `output-format.md` 指针
- 规范要点：**面向用户的简明版置顶**（GitHub Release 正文与仓库 `docs/releases/vX.Y.Z.md` 顶部一致）· ⛔ **不得出现内部术语/编号**（`DEF-xx` / `Txxx` / 提交哈希 / 守卫名 / 测试例数 ⇒ 移入末尾「技术细节（可略过）」）· 建议结构（一句话概括 → ✨ 更好用了 → 🐛 修好了 → ⚠️ 请留意 → 📦 更小更快 → 已知未处理 → 技术细节）· **行为变更必须写清用户视角后果** · **不追溯历史 Release**

**2.2 「默认不使用表格」规范上游化（含 PRD）（`T435`）**
- `.agents/checklists/deliverable-docs.md` 新增 **§七 排版：默认不使用表格** —— **PRD 显式点名**；列出三处最常误写（需求清单 / AC / 范围·非范围）；例外：≤5 行且 ≤4 列；⛔ 不追溯历史文档
- **自证**：把 `deliverable-docs.md` 自身那张超限表格**改成列表**

**2.3 版本与发布**
- 上游版本 **`0.9.5 → 0.10.0`**（MINOR：新增规范能力）
- 上游 `docs/releases/v0.10.0.md` **自身示范两条规范**（全程无表格 · 简明版置顶）
- 门禁：`check` rc=0（roles=6 / files=42）· `check:agents` rc=0 · `npm test` rc=0 · dry-run 显示 `public` · **失败演练**（删 `common/release-notes.md` ⇒ `check` rc=1 并列出 3 处缺失引用）
- 发布：`PR #15` 合并（`76d7c81`）· tag **`v0.10.0`** · Release 创建
- **PM 独立核验**（防 registry 传播延迟误判，连查 2–3 次带 `?t=` 穿透）：`sha256 = 3680ae52f6e3a70320e3a1f81c1bfdead51f474d210820dd0b3dffb9261aeda9`，与上游 dry-run **逐字节一致** · 46 文件 · 两条规范随包 · 全局 CLI 升 `0.10.0`

**2.4 四仓同步（`T436` / `T437` / `T438`）**
- `nao-todo`（`#156`）· `nao-todo-server`（`#44`）· `nue-ui`（直推）· 上游 `nao-skills` 自身
- 验收：四仓 `nao-fleet.sh` **sha 全等上游**；`nue-ui` 顺带修 fmt 缺口（`fmt.ignorePatterns` 补 `.agents/**`、`.codegraph/**`、`.pi/**`）⇒ 同步后「与上游不同」数 **31 → 0**

## 3. 决策与口径

- **规范放上游**：一次落地、全下游受益（不在每个下游各写一份）
- **不追溯历史文档**：规矩自生效日起适用（既有 `v1.12.3` 之前的 Release 不重写）
- **`.agents/**` 以上游「原始未格式化」形态发布** ⇒ 下游完整 `vp check`（含 fmt）报差异属**已知形态、非缺陷**；类型安全改由上游 `check:agents` 把关（`DEF-66` 教训）
- 上游资产完整性的**唯一判据 = 同步后脚本 sha 与上游逐字节一致**

## 4. 行为变更（下游可见）

- 下游仓库此后**发版说明必须有面向用户的简明版**（内部编号/术语须移到末尾技术段）
- 下游文档（含 **PRD**）**默认不使用表格**
- 下游同步 `.agents/**` 后，若跑完整 `vp check` 可能看到格式差异 ⇒ **属预期**，不得为过 fmt 而格式化

## 5. 范围外 / 显式不做

- 不追溯历史 Release 与历史文档 · 不为过 fmt 而格式化 `.agents/**` · 不把规范实现为 lint/守卫（本批只做文档 + 模板 + 接线）

## 6. 遗留

- 上游 `.agents/**` 内仍有写错的移动端路径 `apps/mobileapp`（应为 `apps/mobile`）⇒ 挂上游下一批修正
- 统一格式化 `.agents/**` 属**基线变更**（须通知全下游重同步 + 声明 sha 基线变化），本轮不做

## 7. 交付

- 上游：`nao-skills` `PR #15`（`76d7c81`）· tag `v0.10.0` · `@nathan33/nao-skill@0.10.0`（全局 CLI 已升级）
- 下游同步：`nao-todo` `#156` · `nao-todo-server` `#44` · `nue-ui`（直推 + fmt 缺口修复）
- 本仓配套：`AGENTS.md` 增「发版说明写作规范」与「文档默认不用表格」指引；`v1.12.3` 的 Release 正文**已就地回填通俗版**（属用户批准的一次性动作；此后不追溯）
