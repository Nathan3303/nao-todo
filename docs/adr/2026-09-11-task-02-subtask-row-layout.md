# ADR：TASK-02 子任务行布局精简（时间内联 / 移除行内改名 / 脱离按钮并入标题行）

- **日期**：2026-09-11
- **状态**：**已裁决（待实现）**；用户口径已批（①A / ②A / ③保持）
- **范围**：**仅 web + desktop**（均消费 `packages/presentation`）；**移动端 `presentation-react` 不动**（用户明确）
- **主改文件**：`packages/presentation/task/components/task-details/main/subtasks.vue`（唯一主要落点）
- **相关**：`2026-09-10-task-01-subtask-inherit.md`（C-T9 式跨端文档约束的先例；C-T10 死代码纪律的先例）

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                                                                                                 |
| :----- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **r1** | **2026-09-11** | 首次成文：① 时间移入标题行（α + 相对上限，含形式化理由）② 移除编辑按钮 ⇒ 一并删除整套行内改名机制，改名唯一入口收敛到详情页标题 ③ 脱离按钮移入标题行、actions 列消失；跨端差异表 + C-R1…C-R6 + U-R1…U-R4 |

## 1. 现状与证据（只读核查）

- 行结构（`subtasks.vue`）：`.subtask-row` = `__check`（`flex:none`）+ `__body`（`flex:1`，**纵向**：`__title-line` + `__meta`）+ `__actions`（**独立第三列**，`flex-shrink:0`，`:323-334`）。
- 时间与描述现**合并在一行 meta**：`metaText()`（`:40-48`）把时间用 `' ~ '` 拼接、再以 `' · '` 接描述，模板 `v-if="… && metaText(subTask)"`（`:176-180`）。
- 行内改名机制（**整体**）：状态 `editingId/editingName`（`:55-56`）、`startEditName`（`:69`）、`cancelEditName`（`:77`）、`submitEditName`（`:83`，唯一调用 `subTaskHandler.updateTaskName`，`:91`）、模板 editing 分支（`:155-175`）、check/clear 按钮（`:184` 的 `v-if` 兄弟分支 `:200-211`）、行属性 `:data-editing`（`:138`）、CSS `.subtask-row__input`（`:84-92`）与 `&[data-editing='true'] .subtask-row__actions`（`:334`）。
- **编辑按钮是行内改名的唯一入口**：`:185-190`（`@click="startEditName(subTask)"`，`:title="t('common.edit')"`）。移除后上述分支全部**不可达** ⇒ 必须一并删除（否则是死分支死状态）。
- **能力不丢**：点击名称 → `switchTaskDetails(subTask.id)`（`:37`）；详情页标题为可编辑 textarea（`main/index.vue:127-133` `theme="pure,name"`）→ 本地 `updateTaskName`（`index.vue:56`）→ `updateTaskDetails(id, { name })`。
- 移动端子任务行（`presentation-react/src/lynx/task-detail-screen.tsx:254-276`）：`checkbox + 名称 + 删除(✕)`；全仓仅有 `startEditDescription`（`use-task-detail.ts:57`）⇒ **无子任务改名入口、无时间展示、无脱离父任务**。

## 2. 裁决（用户已批口径）

- **①A**：开始/结束时间由第二行 meta **移入标题行末尾**（内联元素）。
- **②A**：**移除编辑按钮**，并**一并删除整套行内改名机制**（`C-R3` 列明边界）；改名能力**不丢**，唯一入口收敛到子任务详情页标题。
- **③保持**：脱离父任务按钮从 actions 列**移入标题行末尾**，该列整体消失；保持"hover/聚焦才可见"+ `flex:none` **预留位**（避免行内跳动）。
- **默认不变**：时间文案/格式（相对日期，仅非空显示）、描述留第二行（无描述则整行不渲染）、**不新增可见文案 ⇒ 不动 i18n**。

## 3. 布局判据：**α + 时间相对上限**（否决 β 与纯 α）

- **β（时间 `flex:0 1 auto; min-width:0`，两侧按比例收缩）否决**：结果不稳定，时间可能被截成不可读片段，可读下限**不可断言**。
- **纯 α（时间 `flex:0 0 auto` 无上限）否决**：极端时间文案会把标题挤没、甚至把脱离按钮挤出。
- **采纳 α + 上限**（= 用户原话"最大宽度随文本、可溢出隐藏"的直译）：
    - 时间：`flex: 0 0 auto` + `max-width`（**相对上限**，CSS 变量、默认 `60%`）+ `overflow:hidden; white-space:nowrap; text-overflow:ellipsis`；
    - 名称：`flex: 1 1 auto; min-width: 0` + `overflow:hidden; white-space:nowrap; text-overflow:ellipsis`（**先截断**，全文在详情页可见）；
    - 脱离按钮：`flex: none`。
- **形式化理由（A，替代"经验之谈"）**：标题行内**可收缩项只有名称一处**，且名称可收缩到 `0` ⇒ 时间（≤ 上限）+ 按钮（固定宽）**必然放得下** ⇒ **不溢出、不挤出按钮、无隐式比例分配**（对比 β 的不可预测性）。
- 百分比 `max-width` 的包含块 = `.subtask-row__title-line` 的内容盒（该行已具备 `display:flex; align-items:center; min-width:0`，`:289-293`）⇒ 上限随行宽自适应，无需断点。
- **数值由 RD 取一个不变量（建议 CSS 变量，默认 `60%`）；验收断言行为，不写死数值。**

## 4. 交互与可达性（口径已定，不留默认）

- **导航点击保持在名称元素**（`@click="switchTaskDetails"` **不迁到行容器 / `title-line`**）⇒ 无需 `.stop`；
- **时间元素不设独立交互**：点击时间**不导航**、无 hover 样式；仅 `title` = **完整展示文案**（注意：`title` **不做绝对时间转换**，避免新增格式口径；如需绝对时间另单登记）。
- **脱离按钮的可见性必须保留 `:focus-within`**（设备/键盘可用性）：隐藏方式限 `opacity`（现状 `:326` 做法），**禁止**改为 `v-if` / `display:none` / `visibility:hidden`（否则键盘不可达或"聚焦即隐形"）；随 actions 列消失，`:hover` / `:focus-within` 选择器需**重挂**到新宿主元素（父选择器仍是 `.subtask-row`）。

## 5. 跨端差异（**先于本单存在且双向**；`C-R1`）

| 维度       | web/desktop 行（本单后）      | mobile 行（不动） |
| :--------- | :---------------------------- | :---------------- |
| 时间展示   | ✅ 名称末尾内联 `开始 ~ 结束` | ❌ 无             |
| 行内改名   | ❌ 移除（→ 详情页标题）       | ❌ 本就没有       |
| 脱离父任务 | ✅ 名称末尾                   | ❌ 无             |
| 删除子任务 | ❌ 无                         | ✅ `✕`            |

⇒ 本单在"改名"维度是在**收敛**差异；但**动作集仍完全不相交**（web 仅脱离 / mobile 仅删除）⇒ 跨端**动作集与时间展示**的收敛登记遗留、另单，**不得声称两端一致**。

## 6. 约束清单（可勾选验收）

- [ ] **C-R1 跨端声明**：本单仅 web/desktop；移动端行为如 §5 表，文档**不得**声称两端一致；动作集/时间展示收敛为遗留。
- [ ] **C-R2 改名唯一入口（可验收）**：行内改名移除后，子任务改名唯一入口 = 点击名称进入详情页标题（`index.vue:127-133` → `:56` → `updateTaskDetails(id,{name})`）；验收**必须演该路径可用**，"按钮消失"不算过。
- [ ] **C-R3 删除边界（仅限行内改名机制）**：`editingId`/`editingName`/`startEditName`/`submitEditName`/`cancelEditName` + 模板 editing 分支 + check/clear 按钮 + `:data-editing` + 仅其使用的 CSS（`.subtask-row__input`、`&[data-editing='true']` 分支）；**不得**顺带删除 `TaskHandler.updateTaskName`、**不得**改动其他相邻代码。
- [ ] **C-R4 i18n 不动**：不新增可见文案；`common.edit` 词典键（`types.ts:65`/`zh-CN.ts:68`/`en-US.ts:69`）**保留**——移除按钮后其唯一引用（`subtasks.vue:188`）消失 ⇒ 三处定义零引用属**预期**，**不得**据此判"死键清理"。同步清理 `metaText()` 的时间拼接死分支（`' ~ '`/`' · '`）与 `formatDateTime()` 的旧用法（时间元素的用法保留）。
- [ ] **C-R5 死代码纪律**：`TaskHandler.updateTaskName`（`handlers/task.ts:92`，`this.update(id,{name})` 的 1 行委托）保持**零调用**、**不得新增调用点**；删除与否交**独立 API 清理单**（同批评估既有零调用壳方法 `updateTaskDescription`/`updateTaskEndAt`/`giveUp`）。
- [ ] **C-R6 脱离按钮可达性**：`flex:none` 预留位 + `opacity` 隐藏 + `:hover`/`:focus-within` 两分支（见 §4），且点击脱离按钮**不触发**详情导航。

## 7. 测试口径（4 单测 + 冒烟；请勿扩大）

- **U-R1**：时间文案与格式不变（相对日期、仅非空显示；仅开始 / 仅结束 / 两者 / 皆无 四态）。
- **U-R2**：时间由 meta 行移入标题行；无描述 ⇒ meta 行不渲染（有描述 ⇒ 仅描述，无悬空分隔符）。
- **U-R3**：行内改名全套不可达/已删除（无 editing 分支、无 input CSS、无 `data-editing`），且 `TaskHandler.updateTaskName` 无新增调用点（`C-R5`）。
- **U-R4**：截断行为断言 —— ① 常规文案：时间**完整**（含 `~` 两侧文案）、名称完整；② 空间不足（窄容器/长名称）：**名称省略号截断、时间仍完整**；③ 极端时间文案或极窄：时间被截断为省略号且**不超过行宽上限**（不得硬裁切、不得挤出脱离按钮）；④ 时间被截断时**完整文案可由 `title` 取得**。
- **冒烟**：点击名称进详情并改名往返成功；点击时间不导航；点击脱离按钮不导航且功能不变；hover/键盘聚焦可揭示脱离按钮。
- **已知接受**：时间整体截断**可能切在 `~` 中间** ⇒ 属预期，**不**拆分段 `span`。

## 8. 裁决与知会

- **D1 落点**：`subtasks.vue` 单文件为主（presentation 层展示调整，**不涉领域/应用层**）。
- **D2 改名路径收敛**：**接受**"行内改名移除、改名唯一点击进详情标题"；理由：能力不丢、入口唯一可述、维护面收敛。
- **D3 跨端**：mobile **不修**（用户明确）；差异以文档约束 `C-R1` 显式登记。
- **D4 死代码**：`C-R5`（登记 + 禁新增），批量清理另单。
- **知会**：RD 需在实现后回填 §7 的四例结果与四个截断断言；QA 按 `C-R2`/`C-R6` 演"路径可用"与"不误导航"。

## 9. 遗留登记（跨篇，需同步 `docs/adr/README.md`）

| 来源    | 事项                                                                                             | 处置                            |
| :------ | :----------------------------------------------------------------------------------------------- | :------------------------------ |
| TASK-02 | 跨端**动作集/时间展示**不一致（web 脱离 ↔ mobile 删除；时间仅 web 展示）                         | 遗留（另单）                    |
| TASK-02 | 行内改名能力收敛到详情页标题                                                                     | **决策记录（非缺陷）**          |
| TASK-02 | `TaskHandler.updateTaskName` 零调用（+ 既有 `updateTaskDescription`/`updateTaskEndAt`/`giveUp`） | 遗留（独立 API 清理单批量评估） |
| TASK-02 | `common.edit` 词典键三处定义零引用（预期）；时间 `title` 若需**绝对时间**                        | 观察 / 另单登记                 |

## 10. 证据索引

- `packages/presentation/task/components/task-details/main/subtasks.vue`（`:40-48` metaText；`:55-95` 改名机制含 `:91` 唯一调用；`:138/:153-211` 模板结构；`:289-334` CSS，含 `:323-334` actions 列与 `:84-92` input）
- `packages/presentation/task/components/task-details/main/index.vue`（`:56` 本地 `updateTaskName`；`:127-133` 标题 textarea `theme="pure,name"`）
- `packages/presentation/task/handlers/task.ts:92`（`updateTaskName` 1 行委托）
- `packages/presentation-react/src/lynx/task-detail-screen.tsx:254-276`（移动端子任务行）；`packages/presentation-react/src/lynx/use-task-detail.ts:57`（仅描述改名）
- `packages/shared/locales/{types.ts:65,zh-CN.ts:68,en-US.ts:69}`（`common.edit`）