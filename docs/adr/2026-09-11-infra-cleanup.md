# ADR：基础设施清理边界（零调用 API 面 / 死字段 / 探针去留）

- **日期**：2026-09-11
- **状态**：**已裁决（待实现）**；PM 裁定：A1–A5 **同批一次删完**、A6 **延后**、B **保留**、C **另立单**
- **范围**：`packages/presentation`（**导出面收窄**）+ `scripts/electron-smoke/checks/**`（探针保留与状态注记）；**不动** `apps/mobile` / `presentation-react`
- **主改文件**：`packages/presentation/task/handlers/task.ts`、`packages/presentation/task/stores/task-details-store.ts`
- **相关**：`2026-09-11-task-02-subtask-row-layout.md`（C-R5 死代码纪律 / `common.edit` 零引用说明）、`2026-09-10-task-01-subtask-inherit.md`（C-T10 零调用死方法纪律）

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                                             |
| :----- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **r1** | **2026-09-11** | 首次成文：三条判据 + A/B/C 决策表（A1–A5 删 / A6 延后 / B 保留 / C 另立）+ 探针保留与状态注记 + 版本语义（`presentation 0.2.0`）+ 给 RD 的硬约束三条 |

## 1. 驱动与背景

TASK-01 / TASK-02 两单落定后，`packages/presentation` 上留下三类**零调用面**：① TASK-02 移除行内改名机制后新产生的零调用壳方法；② 更早已存在的零调用壳方法（TASK-02 同批登记）；③ 详情 store 的零引用死字段（TASK-01 期登记的 split 副作用之一）。

本单只做**去符号、不改行为**：删除零调用成员、保留有测试依赖的成员、把行为重构与产品决策**推给另立单**。清理的动机是**审计面**（死代码会稀释"零调用即死"的判据可信度，也干扰 DEF-STORE-01 一类的多副本排查），不是性能或体积。

## 2. 判据（三条，先立后判）

一个符号进入"可删"，必须**同时**满足：

1. **全仓代码零引用**：`packages/ apps/ scripts/` 全量检索（含测试与冒烟脚本）无调用/引用；**仅文档或注释提及不作为存活依据**。
2. **删除后无孤儿**：宿主 class 仍保留其它存活成员、导出链不因此断裂；且不残留孤儿 import / 未用类型（孤儿必须随删除一并清掉，见 §6 约束 3）。
3. **不改变运行时行为**：被删符号为不可达代码路径或纯委托，删除不产生任何可观测差异。

满足 1+2 但涉及**行为/结构/产品语义**者，不得进入本单 ⇒ 走 §3.3 另立单。

## 3. 决策表

### 3.1 可删（A 组；**同批一次删完，禁止半删**）

| 编号 | 符号                                              | 证据（零引用）                                                                                                          | 备注                                                                                                                                                           |
| :--- | :------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | `TaskHandler.updateTaskName`                      | `packages/presentation/task/handlers/task.ts:92`，**0 引用**；`task-details/main/index.vue:56` 是组件**局部同名函数**   | 1 行委托 `this.update(id, { name })`                                                                                                                           |
| A2   | `TaskHandler.updateTaskDescription`               | `task.ts:102`，**0 引用**；`main/index.vue:61` 同为组件局部函数                                                         | 1 行委托 `this.update(id, { description })`                                                                                                                    |
| A3   | `TaskHandler.updateTaskEndAt`                     | `task.ts:138`，**0 引用（全仓无任何形式引用）**                                                                         | 1 行委托 `this.update(id, { endAt })`                                                                                                                          |
| A4   | `TaskHandler.giveUp`                              | `task.ts:177`，**0 引用**；批量放弃走 `multi-select/use-batch-executor.ts:54-55` 的 `handler.update(id, { givenUpAt })` | **非**纯委托（含 `NueConfirm` + 成功/失败提示）⇒ 删除即移除死 UI 代码；与批量路径的语义差异见 §3.3 C2                                                          |
| A5   | `TaskDetailsStore.taskDetails` + `setTaskDetails` | `task/stores/task-details-store.ts:15`（字段）、`:18-20`（setter）、`:89-90`（暴露），**全仓零读零写**                  | **三处同删**；`main/pomodoro-info.vue:8` 的 `taskDetails` 是**组件 prop**（同名不同物，不受影响）；**必须连带删 `:11` 的 `TaskDetailsViewObject` 孤儿 import** |

**A 组为什么"一次删完"**：`TaskHandler` 的 5 个 `updateXxx` 壳方法（含存活的 `updateTaskState` / `updateTaskPriority`）语义同构，只删其中一部分会留下"为何这 3 个死方法留着、那 2 个活着"的**无解释半成品 API**；TASK-02 的 C-R5 已明确规定"删除与否交独立 API 清理单批量评估"，本单即该批量评估的落点。

### 3.2 保留（B 组）

| 编号 | 符号                   | 证据                                                                                                                                                                                                          | 保留理由                                                                             |
| :--- | :--------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------- |
| B1   | 词典键 `common.edit`   | 定义于 `packages/shared/locales/zh-CN.ts:68`、`en-US.ts:69`、`types.ts:65`；**被测试反向断言引用**：`task-details/main/__tests__/subtasks.test.ts:144` 以 `t('common.edit')` 过滤按钮并断言 `toHaveLength(0)` | 属**测试依赖**（TASK-02"无行内改名按钮"的断言基线）；删除会**静默弱化**该断言 ⇒ 保留 |
| B2   | `TaskHandler` 其余方法 | 存活：`create`、`update`、`updateTaskState`(3)、`updateTaskPriority`(1)、`delete`(79)、`restore`(14)、`unGiveUp`(1)、`copyTask`(1)                                                                            | 有真实调用点；同时保证 A 组删除后 class **无孤儿**                                   |

### 3.3 另立单（C 组；**不得混入本单**）

| 编号 | 事项                                                                                          | 证据 / 理由                                                                                                                            |
| :--- | :-------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| C1   | **DEF-STORE-01 单一权威源重构**（`TaskDetailsStore` 退化为"关系 + 加载态"）                   | `TasksStore` / `TaskDetailsStore` 各持独立 `useMapperStoreBase` Map（`use-mapper-store-base.ts`）⇒ **行为重构**，需设计 + 回归，非清理 |
| C2   | `giveUp()`（含确认弹窗 + 提示）↔ 批量 `update({ givenUpAt })`（静默）的**行为差异**           | `task.ts:177-201` vs `use-batch-executor.ts:54-55` ⇒ **产品语义决策**（是否统一提示），不是死代码                                      |
| C3   | TASK-01 遗留：移动端继承未覆盖、继承规则升级 B（判据 B-1…B-6）、子任务行内日期编辑            | `presentation-react/.../compose-task-usecase.ts:129`；README 遗留登记                                                                  |
| C4   | SHELL-02/03 遗留：`nue-ui` 版本对齐、infrastructure 硬编码中文 i18n、离线写入口径、壳耦合扫描 | README 遗留登记                                                                                                                        |

## 4. 探针去留（结论：**保留 + 状态注记**）

- **`qaKit` 是活资产**：定义在 `scripts/electron-smoke/checks/task-01-subtask-inherit.mjs:1317-1335`（含新增 4 导出 `readViaApi` / `readCopies` / `storeConsistencyProbe` / `apiUpdateTask`），被 `task-02-subtask-row-layout.mjs:45,62` 导入复用 ⇒ 两条检查链均在用，**不得删除**。
- **`defsync05` / `defui01` 不是独立文件**：函数体分别在 `task-02-subtask-row-layout.mjs:1380` / `:1509`，注册于 `:1782-1789`；顶层注册表为 `scripts/electron-smoke/run.mjs:24-27`（静态 import）⇒ 任何探针增删**必须同步改 run.mjs**。
- **保留理由**：① `defsync05` 在 DEF-SYNC-05 修复后即**回归资产**；② `storeConsistencyProbe` 是 DEF-STORE-01 的复现工具；③ `defui01` 保留为**驳回记录的可复跑反证**（防再报）。
- **须加状态注记**（文件头）：`DEF-UI-01 已驳回：原判系探针误报（pickDates 误找 creator 式按钮 + 误用无效区间）；DEF-SYNC-05 待修复后转正。` —— 目的是避免后人把"已驳回"误读为"缺陷仍在"。
- **`readTasks().find()` 单副本读法**：仍被 task-01（13 处）/ task-02（4 处，defsync05 内）调用 ⇒ **不物理删除**，仅加 `@deprecated` 注释（qaKit 注释第 4 条已自标"不作强断言依据"；多副本场景会误判，见 DEF-STORE-01）。

## 5. 版本语义与理由

| 包                       | 变更            | 语义                                                           |
| :----------------------- | :-------------- | :------------------------------------------------------------- |
| `@nao-todo/presentation` | `0.1.3 → 0.2.0` | **移除包导出面成员 = 破坏性变更**；0.x 下按惯例走 **minor 位** |
| `@nao-todo/desktopapp`   | `1.4.2 → 1.4.3` | 依赖 bump（patch）                                             |
| root                     | `1.4.2 → 1.4.3` | 版本协同                                                       |
| tag                      | `v1.4.3`        | 与 `DEF-SYNC-05` 修复**同批发布**                              |

- **"实际破坏为 0"的澄清（必须与语义分开写）**：`TaskHandler` 确实位于包导出面 —— `packages/presentation/index.ts` → `task/handlers/index.ts` → `task.ts:15`（`export class TaskHandler`），且被以**深路径**消费（`apps/web/src/hooks/usecases/use-app-handlers.ts:3` 从 `@nao-todo/presentation/task` 导入）⇒ 删除是**语义上的破坏性变更**，版本必须如实标注；但 A1–A4 在**全部在仓消费者**（仅 `apps/web`、`apps/desktop` 依赖该包）中**零引用** ⇒ **可观测破坏 = 0**。两者不矛盾：**语义如实 + 事实说明**，不得以"没人用"为由跳过版本位。
- **out-of-repo 消费者风险评估**：该包**未公开发布**（`private`/内部工作区消费；`files` 白名单只覆盖仓库内子目录）⇒ 假定无仓外消费者。**若未来发布**，A 组删除必须在 CHANGELOG 的 Breaking 段落显式列出。

## 6. 硬约束（给 RD）

1. **只删 A 组列明的符号**：不得借机删除包导出面上仍存活的任何成员（B2 清单为存活基线）。
2. **本单不做行为/结构重构**：C1（单一权威源）、C2（放弃任务的提示语义）等**一律另单**；本单 diff 只应出现删除行与孤儿 import 清理行。
3. **A5 必须连带处理孤儿**：删字段/setter/暴露三处的同时删 `task-details-store.ts:11` 的 `TaskDetailsViewObject` import（否则 lint 报未用导入）；**A6（`fillStartAt()`）本单不动** —— 它是 DEF-SYNC-04 服务端修复的语义参考（客户端守卫 `if (this.startAt || !this.endAt) return` = **不覆盖已提供的 startAt**），待该单引用关系记录完毕后再另行处理。
4. **提交信息与 CHANGELOG**：记"API 收窄（`TaskHandler` 4 个零调用方法移除）+ 版本协同"，版本位按 §5。

## 7. 遗留

- **A6 延后项**：`CreateTaskValueObject.fillStartAt()`（`packages/domain-task/src/domain/valueobjects/create-task.ts:98`，零调用）—— 与 `DEF-SYNC-04` 的记录引用绑定时点后另处理；在此之前 **不得新增调用点**（沿用 C-T10 纪律）。
- **C1–C4** 见 §3.3，各自另立单。
- **A7（无动作）**：`metaText` 死分支已在 TASK-02 实现期消除（现为 `timeText`，全仓 0 处 `metaText`）⇒ 无残留，仅作记录。

## 8. 证据索引

| 类别                     | 位置                                                                                                                                                                                                 |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 可删符号                 | `packages/presentation/task/handlers/task.ts:92,102,138,177`                                                                                                                                         |
| 死字段                   | `packages/presentation/task/stores/task-details-store.ts:11,15,18-20,89-90`                                                                                                                          |
| 疑似调用（实为局部函数） | `packages/presentation/task/components/task-details/main/index.vue:56,61`；`.../main/pomodoro-info.vue:8`（组件 prop）                                                                               |
| 保留依据                 | `packages/presentation/task/components/task-details/main/__tests__/subtasks.test.ts:144`；`packages/shared/locales/{zh-CN.ts:68,en-US.ts:69,types.ts:65}`                                            |
| 批量路径                 | `packages/presentation/task/components/multi-select/use-batch-executor.ts:54-55,57`                                                                                                                  |
| 导出面                   | `packages/presentation/index.ts` → `packages/presentation/task/handlers/index.ts` → `packages/presentation/task/handlers/task.ts:15`；深路径消费 `apps/web/src/hooks/usecases/use-app-handlers.ts:3` |
| 探针                     | `scripts/electron-smoke/checks/task-01-subtask-inherit.mjs:1317-1335`；`.../task-02-subtask-row-layout.mjs:45,62,1380,1509,1782-1789`；注册表 `scripts/electron-smoke/run.mjs:24-27`                 |
| 延后项                   | `packages/domain-task/src/domain/valueobjects/create-task.ts:98`                                                                                                                                     |