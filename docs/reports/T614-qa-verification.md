# T614 QA 独立复验报告：看板分组切换移入右上角菜单

- 状态：**独立复验通过（`done(full)`）** —— 15 红基线全绿 · 16 回归全绿 · 3 处变异均红且已还原 · 批末全范围门禁 9 项全过 · 用户验收清单已产出
- 日期：2026-11-01 · Owner：qa · 分支：`feat/306-kanban-group-in-menu`（复验时 HEAD `26953669`）
- 指针：PRD `docs/prds/2026-11-01-kanban-group-switch-in-menu.md`（AC1–AC10）· ADR `docs/adr/2026-11-01-kanban-group-state-hoisting.md` · 评审 `docs/reports/T611-arch-review.md` · 用户清单 `docs/reports/306-user-acceptance.md`
- 口径：**独立复验 —— 不采信 RD 数字，全部命令自己跑**；本轮只改**测试与文档**（未改源码、未放宽任何断言）。RD 三步提交 `514d5013`（状态上提）/ `7de06d58`（控件搬家）/ `254ddf6a`（焦点归还）。

## 一、复验范围

| #   | 项                                                                                          | 结果                      |
| :-- | :------------------------------------------------------------------------------------------ | :------------------------ |
| 1   | 红基线 15 例（`t612-kanban-group-menu` 13 + `t612-ac5-payload-keys` 2）                     | **15 passed**             |
| 2   | 回归 16 例（`t608-ac1b` 4 / `ac2-ac3` 5 / `ac4` 5 / `ac5` 2）+ 看板目录（`t608-ac1a` 作废） | **20 passed / 6 skipped** |
| 3   | 读码核对三条不可放宽项（AC2 `v-if` / AC5 载荷键集合 / AC6 零持久化）                        | **三条均成立**            |
| 4   | 变异测试 3 处（`v-show` / 交叉写载荷 / `localStorage.setItem`）                             | **3 处均红，已还原**      |
| 5   | 批末全范围门禁 9 项                                                                         | **9/9 过**                |
| 6   | 顺带清：AC3 正向断言 · AC10 空看板用例 · harness 冗余导出                                   | **已完成**                |

## 二、红基线 15 例（AC1/AC2/AC4/AC6/AC7 + AC5 载荷）

```text
$ pnpm exec vp test --run \
    apps/web/src/components/tasks/__tests__/t612-kanban-group-menu.test.ts \
    packages/presentation/task/components/kanban/__tests__/t612-ac5-payload-keys.test.ts

 Test Files  2 passed (2)
      Tests  15 passed (15)          ← 13（三处菜单 × AC2/AC1+R-B/AC7/AC6 = 12 + AC4 三处一致 1）+ 2（AC5①②）
   Duration  4.41s
```

逐条命中：AC2 三处 `v-if` 条件渲染（表格/列表 ⇒ DOM 不存在）· AC1+R-B 位置（紧接「看板视图」下方、同属「视图切换」块、默认高亮「按状态」）· AC7+R-A（点分段弹层不关闭、状态跟随、可切回）· AC6+R-C（Storage 零写入 + 不发 `UpdatePreference`）· AC4（三处形态逐字一致）· AC5①②（注入 `priority`/`state` 各自只写一个键）。

## 三、回归 16 例 + 看板目录

```text
$ pnpm exec vp test --run packages/presentation/task/components/kanban/__tests__/

 Test Files  6 passed | 1 skipped (7)
      Tests  20 passed | 6 skipped (26)
   Duration  6.73s
```

- 16 回归例：`t608-ac1b`（4）+ `t608-ac2-ac3`（5）+ `t608-ac4`（5）+ `t608-ac5`（2）= **16 passed** ✅
- `t583`（2）+ `t612-ac5`（2）= 4 passed ⇒ 合计 20 passed，与命令一致
- `t608-ac1a`（AC1a 整组作废，`describe.skip` 保留断言原文）= **6 skipped** ✅（复查时含本轮新增的 AC3 用例后为 23 passed / 6 skipped，见 §七）

## 四、读码核对三条不可放宽项

### AC2 —— 真 `v-if`，不是 `v-show`

```text
$ grep -rn "kanban-group-switch" apps/web/src/components/tasks/*/header/operation-dropdown.vue
built-in-project/header/operation-dropdown.vue:58:  <kanban-group-switch v-if="preference.viewType === 'kanban'" />
project/header/operation-dropdown.vue:78:          <kanban-group-switch v-if="preference.viewType === 'kanban'" />
tag/header/operation-dropdown.vue:67:              <kanban-group-switch v-if="preference.viewType === 'kanban'" />

$ grep -rn "v-show" apps/web/src/components/tasks/*/header/operation-dropdown.vue
（仅 3 行注释文字「不是 v-show」，无任何 v-show 指令）
```

结论：三处均为 `v-if`；DOM 不存在（非隐藏）已由 AC2 用例实测（表格/列表 ⇒ 0 个 `[data-kanban-group-switch]`）。

### AC5 —— 载荷键集合仍各自唯一（`byPriority` 读注入 ref）

`packages/presentation/task/components/kanban/use-kanban.ts`：

| 行  | 代码                                                                                 | 说明                           |
| :-- | :----------------------------------------------------------------------------------- | :----------------------------- |
| 18  | `const groupBy = useKanbanGroup()`                                                   | 读**注入**的 ref（非本地副本） |
| 21  | `const kanbanColumns = computed(() => KANBAN_GROUP_BY_NAMES[groupBy.value] \|\| [])` | 列集合仍派生自单一来源         |
| 27  | `const byPriority = groupBy.value === 'priority'`                                    | 判据读注入 ref 的当前值        |
| 32  | `const payload = byPriority ? { priority: category } : { state: category }`          | 二选一，**无交叉写**           |

结论：键集合 `{priority}` / `{state}` 各自唯一；`T610` 起锁住的 `R2` 语义零变化（16 回归例 + `t612-ac5` 2 例实测通过）。

### AC6 —— 零持久化（唯一 provide 点、无 storage / `UpdatePreference`）

```text
$ grep -rn "provideKanbanGroup\|KANBAN_GROUP_BY_KEY" --include=*.ts --include=*.vue apps packages | grep -v __tests__
use-kanban-group.ts:13  export const KANBAN_GROUP_BY_KEY: InjectionKey<Ref<KanbanGroupBy>> = Symbol(...)
use-kanban-group.ts:21  export const provideKanbanGroup = () => { ... provide(KANBAN_GROUP_BY_KEY, groupBy) }   ← 唯一 provide 实现
built-in-project/built-in-project.ts:127:  provideKanbanGroup()
project/project.ts:111:                    provideKanbanGroup()
tag/tag.ts:106:                            provideKanbanGroup()

$ grep -rn "localStorage|sessionStorage|UpdatePreference|savePreference" \
    use-kanban-group.ts kanban-group-switch.vue use-kanban.ts
（无命中）
```

结论：**provide 实现唯一**（`use-kanban-group.ts:23`）、三处页面各调 1 次、分组状态纯内存 `ref`；`use-kanban-group.ts` / `kanban-group-switch.vue` / `use-kanban.ts` 三个文件零 Storage / 零偏好 handler 引用。**口径备注**：`useKanbanGroup()` 在缺 Provider 时有本地回退（`createKanbanGroup()`，ADR 风险①，dev 下 `console.error`）——那是**未 provide 时的降级**，不是第二个 provide 点，也不写任何存储。

## 五、变异测试（3 处，均做完即还原）

还原证据统一用 `git checkout -- <file>` + `git status --porcelain -- <file>` = 空 + 复跑转绿三项。

### M1 · `v-if` → `v-show`（普通清单菜单）⇒ AC2 必须红

```text
改：project/header/operation-dropdown.vue:78  v-if → v-show
$ pnpm exec vp test --run apps/web/src/components/tasks/__tests__/t612-kanban-group-menu.test.ts
     × AC2 条件渲染：看板视图 1 个 ⇒ 表格 / 列表 0 个（DOM 不存在，不是 v-show）…
AssertionError: 「普通清单」表格视图下 DOM 中必须不存在该分段（不是 v-show 隐藏）:
  expected [ <div …(2)>…(1)</div> ] to have a length of +0 but got 1
 Test Files  1 failed (1)     Tests  1 failed | 12 passed (13)      ← 红 ✅

还原：git checkout -- apps/web/src/components/tasks/project/header/operation-dropdown.vue
      git status --porcelain -- 该文件 ⇒ 0 行（干净）；第 78 行恢复 v-if
复跑：Tests 13 passed (13)                                             ← 绿 ✅
```

### M2 · `byPriority` 分支交叉写 `{ state: category }` ⇒ AC5 必须红

```text
改：use-kanban.ts:32
   const payload = byPriority ? { priority: category } : { state: category }
→  const payload = byPriority ? { state: category } : { state: category }
$ pnpm exec vp test --run .../t612-ac5-payload-keys.test.ts
     × AC5① 注入 groupBy='priority' ⇒ 四列生效，拖拽载荷只有 { priority: 'urgent' }
实测写入 = [{ "taskId": "t-mid", "payload": { "state": "urgent" } }]
  - Expected "priority": "urgent"     + Received "state": "urgent"
 Test Files  1 failed (1)     Tests  1 failed | 1 passed (2)          ← 红 ✅（AC5② 回归护栏仍绿，符合预期）

还原：git checkout -- packages/presentation/task/components/kanban/use-kanban.ts
      git status --porcelain -- 该文件 ⇒ 0 行；第 32 行恢复三元二选一
复跑：Tests 2 passed (2)                                              ← 绿 ✅
```

### M3 · 切段时顺手写一次 `localStorage.setItem` ⇒ AC6 必须红

```text
改：kanban-group-switch.vue handleGroupByChange 末尾加
   localStorage.setItem('kanban-group-by', value)
$ pnpm exec vp test --run apps/web/src/components/tasks/__tests__/t612-kanban-group-menu.test.ts
     × AC6 / R-C 零持久化…（内置清单 / 普通清单 / 标签页 三处同时红）
AssertionError: 分组切换不得写任何偏好存储（R-C：刷新回默认）:
  expected { setItem: [ [ …(2) ] ], …(2) } to deeply equal { setItem: [], removeItem: [], …(1) }
 Test Files  1 failed (1)     Tests  3 failed | 10 passed (13)         ← 红 ✅

还原：git checkout -- packages/presentation/task/components/kanban/kanban-group-switch.vue
      git status --porcelain -- 该文件 ⇒ 0 行；文件内已无 localStorage
复跑：Tests 13 passed (13)                                            ← 绿 ✅
```

> 变异期间源码的临时改动**全部**经 `git checkout --` 还原；本轮提交内容**不含**任何源码改动（`git status` 只剩测试与文档）。

## 六、批末全范围门禁（9 项，命令 + 精确数字）

| #   | 门禁                 | 命令                                                                         | 结果                                                                                                                     |
| :-- | :------------------- | :--------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- |
| 1   | 格式 + lint + 类型   | `pnpm exec vp check`                                                         | **exit 0** —— `All 1780 files are correctly formatted`；`Found no warnings, lint errors, or type errors in 1448 files`   |
| 2   | 全仓测试             | `NODE_OPTIONS=--no-experimental-webstorage pnpm exec vp test --run`          | **exit 0** —— **331 文件**（330 passed / 1 skipped）· **2775 例**（2769 passed / **6 skipped** / **0 failed**）· 161.18s |
| 3   | 领域隔离             | `pnpm run guard:ddd`                                                         | **exit 0** —— `OK - domain 包未引用 shared 根桶 / shared 展示层组件 / ResponseDataPagination`                            |
| 4   | 门禁 pathspec 存在性 | `pnpm run guard:gate-pathspec`                                               | **exit 0** —— `OK - 门禁命令 pathspec 均存在`                                                                            |
| 5   | 导入面可解析性       | `pnpm run guard:barrel-imports`                                              | **exit 0** —— 扫描 **1448 文件** / 校验 **1595 条** `@nao-todo` 导入 / **2330 个**命名                                   |
| 6   | 移动端红线（导入）   | `pnpm run guard:mobile-imports`                                              | **exit 0** —— 72 个源文件，未引 `persistence-local` / `persistence-sync` / `dexie` / `infrastructure` 根桶               |
| 7   | 测试文件位置         | `pnpm run guard:test-location`                                               | **exit 0** —— 323 个受检测试文件均在 `__tests__/`（另有 8 个移动端白名单未检查）                                         |
| 8   | 构建                 | `pnpm exec vp run webapp build` + `pnpm run desktop:build`                   | **均 exit 0** —— webapp `✓ built in 12.93s`；desktop `✓ built in 16.00s`                                                 |
| 9   | 移动端红线（目录）   | `git status --porcelain -- packages/presentation-react apps/mobile \| wc -l` | **0 行**                                                                                                                 |

> `NODE_OPTIONS=--no-experimental-webstorage` 说明：本机 Node **v24.22.1** 下该标志被接受且 `typeof localStorage === 'undefined'`（jsdom 环境正常生效）；按 PM 指定口径带上，防止新版 Node 的内建 `localStorage` 遮蔽 jsdom。

## 七、本轮新增 / 清理的测试（边界内：只动测试与文档）

| 文件                                                                                            | 变化                                                                                                                       | 用例数                                                |
| :---------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------- |
| `packages/presentation/task/components/kanban/__tests__/t614-ac3-kanban-toolbar-absent.test.ts` | **新增**（补 AC3 正向断言：旧位置移除后可写死）                                                                            | 3（AC3① 两档 × 状态/优先级 + AC3② 列区无占位行）      |
| `apps/web/src/components/tasks/__tests__/t614-ac10-empty-kanban-menu.test.ts`                   | **新增**（补 AC10 空看板菜单侧）                                                                                           | 3（空看板 3 空列 + 菜单切到优先级变 4 空列 + 零写入） |
| `packages/presentation/task/components/kanban/__tests__/t608-kanban-harness.ts`                 | **删除** 5 个冗余导出 `segmentNode` / `controlOf` / `selectedState` / `findSegment` / `labelNodes`（+ `CONTROL_SELECTOR`） | —                                                     |
| `packages/presentation/task/components/kanban/__tests__/t608-ac1a-grouping-switch.test.ts`      | 上述 5 个辅助函数**下移为本文件本地副本**（该组已整组作废、`describe.skip`）——**断言原文一字未改**                         | 仍 6 skipped                                          |

删除前的引用清点（唯一消费者 = 已作废的 `t608-ac1a`）：

```text
$ grep -rn "segmentNode\|controlOf\|selectedState\|findSegment\|labelNodes" --include=*.ts --include=*.vue packages apps
（清理前：命中全部落在 t608-kanban-harness.ts 定义 + t608-ac1a-grouping-switch.test.ts 使用；
  无其它文件引用；`search-filter-bar` 的 `selectedStates` 为不同标识符）
```

为什么保留 `t608-ac1a` 文件而不删：PRD §八 与文件头都写明「**作废 ≠ 删断言**」，且 PM 本轮复验口径要求「看板目录应 **6 skipped**」。⇒ 把 5 个辅助函数下移进该文件，使 harness 去掉冗余导出、同时不破坏「断言原文保留 + 6 skipped」这条记账要求（`describe.skip` 不执行回调，编译与类型检查照常覆盖）。

新增用例复跑：

```text
$ pnpm exec vp test --run .../t614-ac3-kanban-toolbar-absent.test.ts .../t614-ac10-empty-kanban-menu.test.ts
 Test Files  2 passed (2)
      Tests  6 passed (6)
```

新增后看板目录：`Test Files 7 passed | 1 skipped (8)` · `Tests 23 passed | 6 skipped (29)`。

## 八、受影响面定位（三段阶梯）

① **原生入口 `codegraph_explore`**（`kanban-group-switch` / `use-kanban-group` / `provideKanbanGroup` / `useKanbanGroup` / `use-kanban` / `handleTaskDrop` / `kanbanColumns`）—— 返回的 verbatim 源码与下方读码结论逐行一致（`kanban-group-switch.vue:24-26` 只写 ref、`use-kanban-group.ts:21-25` 唯一 `provide`、`use-kanban.ts:18/27/32` 注入 + 判据 + 载荷二选一）。

② **CLI `codegraph affected`**（本单源码触点 5 个文件）：

```text
use-kanban-group.ts / kanban-group-switch.vue / project/header/operation-dropdown.vue
  → t612-kanban-group-menu.test.ts · t614-ac10-empty-kanban-menu.test.ts
  → 另：built-in-project.test.ts（provideKanbanGroup 的 caller 侧）· t608-kanban-harness.ts
kanban.vue / use-kanban.ts
  → t608-kanban-harness.ts（⇒ 经 harness 覆盖 t608-ac1b/ac2-ac3/ac4/ac5、t612-ac5、t614-ac3）
```

③ **`grep -rn` + 行段**：`grep -rn "segmentNode\|controlOf\|selectedState\|findSegment\|labelNodes"`（清理前引用清点）· `grep -rn "provideKanbanGroup\|KANBAN_GROUP_BY_KEY" apps packages`（provide 点清点）· `grep -rn "localStorage\|sessionStorage\|UpdatePreference"`（零持久化）· `grep -rn "kanban-group-switch" apps/web/src/components/tasks/*/header/operation-dropdown.vue`（三处 `v-if`）。

**受影响的自动化面全部已跑且绿**：`t612-kanban-group-menu`（13）· `t612-ac5-payload-keys`（2）· `t608-ac1b/ac2-ac3/ac4/ac5`（16）· `t614-ac3`（3）· `t614-ac10`（3）· `built-in-project.test.ts`（在全仓 331 文件 / 0 红内）。

## 九、结论与遗留

- **AC1–AC6、AC8（结构面）、AC10（自动化面）**：自动化已覆盖并全绿。
- **AC7（菜单手感）/ AC8（真机键盘）/ AC9（暗色 + 320px 窄屏）**：视觉 / 真机体感类，按项目分工**交用户人工走查**，清单见 `docs/reports/306-user-acceptance.md`（不做浏览器自动化）。
- **遗留（三出口）**：
    1. **`t608-ac1a` 文件仍以 6 skipped 存在** —— 出口：**接受（含到期日）**：随本批合并保留作历史断言存档；若下批仍无「旧位置」上下文需要，建议在后续文档批里转为 `docs/` 存档并删除文件（避免每次全仓门禁都显示 6 skipped）。
    2. **视觉 / 真机项（AC7 / AC8 / AC9）待用户勾选** —— 出口：**转办用户**（清单已交付，PM 派验收）。
    3. **本批未发版**（`v1.16.1` 待发）—— 出口：**转办 PM**（发布后如需在正式包上复评 AC9，以用户走查结论为准）。