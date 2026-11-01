# T622 看板列内独立分页 —— 独立复验与批末门禁报告

- 状态：**通过**（7 条红线全守 · 变异 5 处全部被用例捕获 · 批末 9 项门禁全绿）
- 日期：2026-11-01 · Owner：qa · 任务：`T622`（独立复验 + 批末门禁，**不采信 RD 回执**）
- 关联：Issue **#309** · PRD `docs/prds/2026-11-01-kanban-column-paging.md` · ADR `docs/adr/2026-11-01-kanban-column-paging.md` · 缺陷 `DEF-126` · 上游 `T620`（红基线）/ `T621`（实现）
- 分支：`fix/309-kanban-column-paging` · 被测 HEAD = `0eed93f8`（RD 三提交 `ff01748a` / `4140a8f7` / `5866fe8f` + PM 文档提交）
- 本轮 qa 提交：**`ee65ca2e`**（只改 1 个测试文件、1 行删除；见 §一）

## 一、AC13① 修正（PM 裁定选项 A，只删 1 行）

文件：`packages/presentation/task/components/kanban/__tests__/t620-ac13-drag-no-skip.test.ts`

```diff
         // 前置：已加载 3 页（60 条）
         await scrollToBottom(h.wrapper, 'todo')
         await scrollToBottom(h.wrapper, 'todo')
-        await scrollToBottom(h.wrapper, 'todo')
         const loadedBefore = taskIdsIn(columnNode(h.wrapper, 'todo'))
         expect(loadedBefore, '前置：源列已加载 3 页').toHaveLength(60)
```

- **矛盾点**：口径「3 页 = 60 条 = 挂载第 1 页 + 触底 2 次」；原用例触底 **3 次** ⇒ 4 页 65 条（= 全部待办），与断言「前置 60 条」自相矛盾。
- **统计证据**：`git show ee65ca2e --stat` = `1 file changed, 1 deletion(-)`（`+0/−1`）。

### 断言保全清单（逐条原样，无放宽、无改写成 65）

| 断言                                              | 位置     | 保留情况 |
| ------------------------------------------------- | -------- | -------- |
| 前置已加载 60 条                                  | `:63`    | ✅ 原样  |
| 被拖走的 `todo-05` 在已加载区间内                 | `:64`    | ✅ 原样  |
| 拖后源列 `total` −1                               | `:67`    | ✅ 原样  |
| 被拖走的卡即时离开源列 / 出现在目标列             | `:68-73` | ✅ 原样  |
| 最终集合无重复卡片                                | `:77`    | ✅ 原样  |
| 缺项 = 空（报错文案点名「原第 61 条 `todo-61`」） | `:80-87` | ✅ 原样  |
| 多出项 = 空（含「被拖走的卡回魂」）               | `:88-91` | ✅ 原样  |

- ⛔ 未采用「改成 `toHaveLength(65)`」（会让用例退化为「全量已加载」，抓不到跳条）；⛔ 未让实现去凑 60。
- 该文件 **AC13① ②** 实测全绿；M3 变异证明本用例仍能精确抓到跳条（缺失项正是 `todo-61`，见 §四）。

## 二、七条红线读码结论（自读源码，逐条给 `文件:行`）

### 1. 筛选**求交**而非覆盖（R-I）✅

- `use-kanban-column-paging.ts:66-68`：`values = String(base[groupBy] ?? '').split(',').filter(Boolean)`。
- `:69`：`if (values.length > 0 && !values.includes(category)) return null` ⇒ 基础筛选已含该维度且不含本列值 ⇒ **求交为空**。
- `:70`：`return { ...base, [groupBy]: category }` ⇒ 只覆盖**列维度**，其余用户筛选（项目 / 标签 / 日期等）原样保留。
- 空集消费端（**不发请求**）：
    - `use-kanban-column.ts:33-41`：`queryOptions` 为 `null`，仅合并 `sort`；
    - `:85-93` `loadFirstPage`：`queryOptions === null` ⇒ 清空 `taskIds` / `total = 0` / `error = ''` / `loading = false` 并置 `loadedOnce`，**直接 return，不调 loader**；
    - `:104-105` `loadMore`：`options === null` ⇒ 直接 return。
- 实证：AC11① 断言「中 / 低 / 紧急」列 `listCalls` 为 **空数组**（非先查再过滤）。

### 2. `isDone = page * limit >= total`（R-K）✅

- `use-kanban-column.ts:52-56`：`loader.states.pagination.page * loader.states.pagination.limit >= loader.states.pagination.total`。
- 未沿用共享 loader 的 `taskIds.length < limit`（该式在 `use-task-loader.ts` 中仍为列表/表格口径，列组件不引用）。
- 实证：AC9②（恰好 20 条 ⇒ 首屏即到底，零额外请求）· AC9③（21 条 ⇒ 触底补第 2 页那 1 条后到底）。

### 3. `loadingFirst` / `loadingMore` 拆分（触底不换整列）✅

- `use-kanban-column.ts:70`：`loadingFirst = loading && taskIds.size === 0`。
- `use-kanban-column.ts:73`：`loadingMore = loading && taskIds.size > 0`。
- 模板 `kanban-column.vue:37`：`nue-infinite-scroll` 的 `:loading` 只吃 `loadingMore`；`:51` 整列占位 `loading-component v-if="loadingFirst"`。
- ⇒ 触底加载只显示列底加载条，**不把整列换成「正在加载任务」**。

### 4. CSS 隐藏已删 + `#disabled` 槽文案 + i18n 三处齐备（R-L）✅

- `kanban-column.vue`：**`<style` 块数 = 0**（原对 `__disable-bar` / `__loading-bar` 的 `display: none` 整块 `<style scoped>` 已移除）。
- `kanban-column.vue:42-46`：`<template #disabled>` 内渲染 `t('task.kanban.noMore')`（DOM 可见，不再被 CSS 隐藏）。
- i18n 三处：
    - `packages/shared/locales/zh-CN.ts:522` = `'没有更多了'`
    - `packages/shared/locales/en-US.ts:543` = `'No more tasks'`
    - `packages/shared/locales/types.ts:499` = `'task.kanban.noMore': string`
- 空态 `kanban-column.vue:56` 走既有键 `task.noTasksInColumn`（**无硬编码中文**）。

### 5. `:key` 含 `groupBy`（结构性重置，ADR 决策 3）✅

- `kanban.vue:32`：`:key="`${groupBy}:${groupName}`"`。
- 重置不依赖第三个 watch ⇒ 旧列不会先拿新分组字段发一次空转查询。

### 6. 本地仓储 `priority` 含 `low` 时纳入白名单外脏值（R-J）✅

- `task-repo-impl.ts:387-403`：命中 `priorities.includes(r.priority)` 先行返回 `true`；否则 `:398-399`
  `priorities.includes('low') && !(TASK_PRIORITIES as readonly string[]).includes(r.priority)`。
- **只对 `low` 放开**：`urgent` / `high` / `medium` 仍是精确匹配（脏值只在「低」列被纳入）。
- **不写库**：`:149` 仍只在 `updateVO.priority !== undefined` 时写；`use-kanban.ts:41` 同档拖拽直接 return（不写）；`:43` 仅真拖拽落列才写合法档位 ⇒「读取归类 ≠ 写回归一」成立。
- 实证：AC12①（仓储层）· AC12③（看板「低」列）。

### 7. 拖拽 `needsRefill` 补拉 + `newTaskId` 置顶插入（R-M）✅

- 源列标记：`use-kanban-column.ts:130-135` `removeTask`（`:134` `if (wasLoaded) needsRefill.value = true`，`total` 同步 −1）。
- 触底补拉：`:102-110` `loadMore`（`needsRefill` ⇒ 清标后**重取当前页** `loadAndPush`，`page` 不回退；Set 并集去重 ⇒ 不跳条、不重复、不塌页）。
- 目标列置顶：`:120-125` `insertTask`（`new Set([taskId, ...loaded])` + `total += 1`，**不重查**）。
- 命令通道：`use-kanban.ts:85-93` watch `props.newTaskId` → `categoryOf(task)` → `paging.insertTask`；来源 = adapter 订阅点 `use-kanban-view-adapter.ts:86` → prop `kanban-view-adapter.vue:101`。
- 登记状态：ADR `:16` 与 PRD R-M 均已记「命令通道 `newTaskId`（PM 2026-11-01 裁定接受 · **待 arch 追认**）」。

## 三、测试数字（自跑；`NODE_OPTIONS=--no-experimental-webstorage`，本机 Node v24.22.1）

| 范围         | 路径                                                                                                                                                                                                                 | 文件   | 例      | 结果                                                                                                                   |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| 指定 3 路径  | `packages/presentation/task/components/kanban/__tests__` + `.../view-adapters/kanban-view-adapter/__tests__` + `packages/infrastructure/src/persistence-local/__tests__/t620-ac12-low-filter-includes-dirty.test.ts` | **20** | **67**  | **0 红** = `61 passed + 6 skipped`（1 个 skipped 文件 = `t608-ac1a-grouping-switch`「T612 作废」整组 `describe.skip`） |
| 更宽受影响面 | `packages/presentation/task` + `packages/infrastructure/src/persistence-local` + `apps/web/src/components/tasks`                                                                                                     | **84** | **514** | **0 红** = `508 passed + 6 skipped`（56.23s）                                                                          |

**对照 T620 红基线（2026-11-01，`7d163a8e`）**：`27 failed | 34 passed | 6 skipped (67 例)`
⇒ **27 红全部转绿**（26 例凭 RD 实现转绿 + **1 例凭本文 §一的用例前置修正转绿**），无一例被删除、跳过或放宽。

## 四、变异测试（5 处；每处：红 → 还原 → 复跑绿，附还原证据）

还原方式：`git checkout -- <源码文件>`，并以 `sha1sum` 与变异前的备份逐字节比对。

| #   | 变异内容                                                                                | 目标 AC | 实测结果（红）                                                                   | 还原后                                                              |
| --- | --------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| M1  | `isDone` 回退为 `taskIds.size < limit`（共享 loader 口径）                              | AC9②    | **AC9② 红 + AC9③ 红**（`2 failed / 1 passed`）                                   | `sha1` `0f28687cc6a701a9c19303caaa439db18154bdc0` 一致 · **3/3 绿** |
| M2  | 求交改覆盖：`if (false && values.length > 0 && !values.includes(category)) return null` | AC11    | **AC11① 红**（该列发出了查询，`listCalls = []` 断言失败；`1 failed / 1 passed`） | `sha1` `e76918166c927f7660b806bd1060dbef1643cd3a` 一致 · **2/2 绿** |
| M3  | 去掉源列 `needsRefill`：`if (wasLoaded && false) needsRefill.value = true`              | AC13    | **AC13① 红**，缺失项正是 `["todo-61"]`（`1 failed / 1 passed`）                  | `sha1` `0f28687cc6a701a9c19303caaa439db18154bdc0` 一致 · **2/2 绿** |
| M4  | 恢复隐藏：追加 `.kanban-column__disable-bar { display: none }`                          | AC4③    | **AC4③ 红**（源码守卫命中隐藏规则；`1 failed / 2 passed`）                       | `sha1` `06cef21e4bd4fffbb3883846726d22b3ba36a831` 一致 · **3/3 绿** |
| M5  | `:key` 去掉 `groupBy`：`:key="groupName"`                                               | AC6③③   | **AC6③③ 红**（源码守卫 `:key` 不含 `groupBy`；`1 failed / 5 passed`）            | `sha1` `44f708e8f911220efdd39c58916c3fac5e7de32c` 一致 · **6/6 绿** |

### M5 诚实申报（不返工，但需记账）

M5 变异下 **AC6③①（切分组 ⇒ 各列按新分组字段回第 1 页）仍为绿**。原因：`state` 与 `priority` 两套列名集合无交集（`KANBAN_GROUP_BY_NAMES`），`:key="groupName"` 同样触发旧列卸载 / 新列重建，**行为上等价**。

⇒ 结论：`groupBy` 出现在 `:key` 中当前属**防御性冗余**，**唯一探测器是 AC6③③ 源码守卫**（运行时用例抓不到）。保留守卫即可，本轮不做实现调整；若未来两种分组出现同名列，该校验才转为行为必需。

## 五、批末全范围门禁（9 项，精确数字）

| #   | 命令                                                                           | 结果                                                                                                                  |
| --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 1   | `pnpm exec vp check`                                                           | **exit 0** · 格式 1802 文件全通过（9500ms）· lint/type **1464 文件 0 warning / 0 error**（4.6s）                      |
| 2   | **全仓** `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vp test --run`   | **exit 0** · **344 文件 / 2816 例 / 0 红** = `343 passed + 1 skipped(文件)` / `2810 passed + 6 skipped` · **175.26s** |
| 3   | `pnpm run guard:ddd`                                                           | **exit 0**（domain 未引 shared 根桶 / 展示层组件）                                                                    |
| 4   | `pnpm run guard:gate-pathspec`                                                 | **exit 0**（门禁命令 pathspec 均存在）                                                                                |
| 5   | `pnpm run guard:barrel-imports`                                                | **exit 0**（扫描 1464 文件 · 校验 1616 条 `@nao-todo` 导入 / 2357 个命名）                                            |
| 6   | `pnpm run guard:mobile-imports`                                                | **exit 0**（`packages/presentation-react` / `apps/mobile` 共 72 个源文件）                                            |
| 7   | `pnpm run guard:test-location`                                                 | **exit 0**（336 个受检测试文件均位于 `__tests__/`）                                                                   |
| 8   | `pnpm exec vp run webapp build`                                                | **exit 0**（13.57s）                                                                                                  |
| 9   | `pnpm run desktop:build`                                                       | **exit 0**（15.91s）                                                                                                  |
| —   | 移动端红线 `git status --porcelain -- packages/presentation-react apps/mobile` | **0 行**                                                                                                              |

## 六、遗留三出口

| #   | 遗留项                                                                            | 出口                          | 依据                                                                                                                          |
| --- | --------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | **「桶导入顺序坑」**（深路径 `kanban.vue` 先于桶导入 ⇒ 桶内 `TaskKanban` 不可用） | **接受（续期至 2026-11-08）** | 本轮实测**仍有效**，且比原记录更严重（见下方探针）；属**测试/导入顺序侧约束**，非产品缺陷（全仓 344 文件 0 红，无生产面影响） |
| 2   | 批末全范围门禁                                                                    | **关闭**                      | §五 9 项全跑全绿                                                                                                              |
| 3   | T620 遗留「27 红」                                                                | **关闭**                      | §三 27 红全部转绿（26 凭实现 + 1 凭用例前置修正）                                                                             |

### 遗留 1 的探针证据（临时用例，跑完即删，工作区已 clean）

| 导入顺序                                                                                                              | 实测输出     |
| --------------------------------------------------------------------------------------------------------------------- | ------------ |
| **深路径先**：`import KanbanDeep from '../../../kanban/kanban.vue'` 后 `import { TaskKanban } from '../../../kanban'` | `deep=object | barrel=undefined | same=false | deepName=TaskKanban`⇒ **桶内导出为`undefined`**（原记录为「空对象」，实际更严重） |
| **桶先**：`import { TaskKanban } from '../../../kanban'` 后深路径                                                     | `deep=object | barrel=object    | same=true  | deepName=TaskKanban` ⇒ 正常                                                       |

- **约束维持**：⛔ 不得为绕开该坑改动 adapter 导入风格（现有生产/测试代码全部「桶先」或只走桶，实测无影响）。
- **根因未定位**。候选方向（PM 已记为**后续候选**，本轮不做）：`packages/presentation/task/components/kanban/index.ts:1-5` 的 `const TaskKanban = Kanban` 改为 `export { default as TaskKanban } from './kanban.vue'`。若后续清理，须**单独立项**并先验证不破坏桶导入语义。

## 七、环境与口径

- 本机 Node **v24.22.1**（`--no-experimental-webstorage` 为跑测试的必需口径）。
- 测试/变异/门禁**全部在主工作区串行执行**（同一时刻仅本会话跑全仓，避免并发抢 CPU 造成的时长抖动）。
- 变异还原证据：每次 `git checkout -- <源码>` 后 `sha1sum` 与备份比对一致，且复跑目标用例转绿；工作区最终 `git status --porcelain` 仅剩本轮测试文件改动（已提交 `ee65ca2e`）。
- 未修改任何功能代码；本轮唯一改动 = AC13① 用例的 1 行删除。