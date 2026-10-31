# T584 独立复验：DEF-84 客户端识别「紧急」优先级

> **任务**：`T584`（qa）· **日期**：2026-10-31 · **分支**：`feat/287-priority-urgent`
> **基线**：红基线 `bcc41fc1`（T582）· 实现 `671d7cc5`（T583）· 复验时 HEAD = `e33a95a2`（PM 的 `DEF-114/115` 登记提交，**门禁均在其之后跑**）
> **性质**：只读复验 + 变异验证（**未改产品代码**；5 组变异均已还原，还原证据见 §三）。
> **不采信自述**：本文所有数字均为本会话独立重跑所得。

## 一、A 判定：`search-query.test.ts` 的口径同步是否可接受

**结论：可接受，负向强度未下降，属必要同步；有两处可选改进（不阻塞）。**

依据：

1. **必要性（旧断言必红且语义错误）**：`parseSearchQuery` 的白名单判定是 `isAllowed(TASK_PRIORITIES, value)`（`search-query.ts:64-73`）。`urgent` 进入 `TASK_PRIORITIES` 后，「`urgent` 被忽略」与 AC2「四档合法」**直接冲突** ⇒ 保留旧断言等于要求实现排除 urgent，必须改。
2. **负向强度保持不变（实测，非推断）**：把 `isAllowed` 变异为恒 `true`（= 白名单过滤失效），改后的负向断言立即转红 —— `search-query.test.ts` **3 红 / 13 绿**（含「AC9 非法枚举值被忽略」与「去重 + trim + 丢弃空段」）。还原后 **16/16 绿**。⇒ 该断言仍有牙齿。
3. **样本等价性**：新样本 `unknown-x` 与原样本 `urgent` 走**同一条** `isAllowed` 分支；单值与混值（`high,unknown-x`）两个形态都保留；且同文件另有独立非法样本 `bogus`（「去重 + trim」用例），负向样本不唯一。
4. **正向补充是净增覆盖**：新增 `urgent ⇒ ['urgent']` 锁住 AC2 在搜索层的落地（原无用例覆盖）。

**可选改进（供后续，不阻塞本单）**：

- 正向断言宜由 `TASK_PRIORITIES` 派生（`for (const p of TASK_PRIORITIES) …`），而非钉字面量 `'urgent'` —— 第五档出现时自动覆盖（R1 精神）。
- 负向可加**近失样本**（`'URGENT'` / `'urgent '`）以钉死「精确匹配、不做大小写/空白归一」；当前样本无法区分「精确匹配」与「宽松匹配」。

## 二、B 独立复跑（精确数字）

| 项                | 命令                                                                                                                                                                                                                                                                                                                                         | 结果                                                  | rc  |
| :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------- | :-- |
| 受影响面 + 依赖包 | `pnpm exec vp test --run packages/domain-task packages/presentation/task packages/shared/components packages/shared/locales packages/infrastructure/src/persistence-local packages/infrastructure/src/persistence-go apps/web/src/components/search apps/web/src/components/calendar apps/web/src/views/index apps/web/src/components/tasks` | **148 文件 / 1295 例 / 0 红**（70.91s）               | 0   |
| 全仓格式          | `pnpm exec vp check`                                                                                                                                                                                                                                                                                                                         | 1716 文件格式 ✓                                       | 0   |
| 全仓 lint + 类型  | 同上                                                                                                                                                                                                                                                                                                                                         | 1407 文件 **0 warning / 0 lint error / 0 type error** | 0   |
| 全仓测试          | `pnpm exec vp test --run`                                                                                                                                                                                                                                                                                                                    | **300 文件 / 2601 例 / 0 红**（151.66s）              | 0   |
| 守卫 ①            | `pnpm run guard:ddd`                                                                                                                                                                                                                                                                                                                         | OK                                                    | 0   |
| 守卫 ②            | `pnpm run guard:mobile-imports`                                                                                                                                                                                                                                                                                                              | OK（72 源文件）                                       | 0   |
| 守卫 ③            | `pnpm run guard:barrel-imports`                                                                                                                                                                                                                                                                                                              | OK（1405 文件 / 1513 导入 / 2216 命名）               | 0   |
| 守卫 ④            | `pnpm run guard:gate-pathspec`                                                                                                                                                                                                                                                                                                               | OK                                                    | 0   |
| 守卫 ⑤            | `pnpm run guard:test-location`                                                                                                                                                                                                                                                                                                               | OK（292 受检测试文件）                                | 0   |
| Web 构建          | `pnpm exec vp run webapp build`                                                                                                                                                                                                                                                                                                              | ✓ built in 13.67s                                     | 0   |
| 桌面构建          | `pnpm run desktop:build`                                                                                                                                                                                                                                                                                                                     | ✓ built in 16.03s                                     | 0   |
| 移动端红线        | `git status --porcelain -- packages/presentation-react apps/mobile`                                                                                                                                                                                                                                                                          | **0 行**                                              | —   |

> 注：全仓测试里有一条 jsdom 提示 `Not implemented: HTMLFormElement's requestSubmit()`，属既有环境噪声，非失败。

## 三、C 变异验证（5 组，全部还原）

> 每组流程：改一处 → 跑定向用例 → 记录红 → `git checkout -- <file>` → 复跑转绿 + `git status --porcelain` 为空。

| #         | 变异                                              | 定向用例                                                                    | 变异后                                                                 | 还原后                 |
| :-------- | :------------------------------------------------ | :-------------------------------------------------------------------------- | :--------------------------------------------------------------------- | :--------------------- |
| ①         | `converters.ts` 把 `urgent` 并入兜底 ⇒ 回落 `low` | `converters.test.ts` + `t582-urgent-priority-sync` + `use-task-view-object` | **1 红 / 33 绿**（AC1「四档合法 priority 原样保留」红）                | 26/26 绿 · 工作区 0 行 |
| ②         | `prioritySNMap` 去掉 `urgent`                     | `t582-priority-urgent` + `local-task-repos` + `calendar-sort`               | **7 红 / 44 绿**（rank 相对序、反向映射、列表排序 ×2、日历排序 ×2 等） | 51/51 绿 · 工作区 0 行 |
| ③         | `use-export-task.ts` 删 `urgent` 分支             | `t583-export-urgent-priority`                                               | **1 红**（实际输出 `- 优先级：低优先级`）                              | 1/1 绿 · 工作区 0 行   |
| ④         | `KANBAN_PRIORITY` 回退三档字面量                  | `t583-kanban-priority-columns`                                              | **1 红 / 1 绿**（AC8「列名单覆盖四档」红）                             | 2/2 绿 · 工作区 0 行   |
| ⑤（A 用） | `search-query.ts` 的 `isAllowed` 恒 `true`        | `search-query.test.ts`                                                      | **3 红 / 13 绿**                                                       | 16/16 绿 · 工作区 0 行 |

**最终还原证据**：`git status --porcelain` = **0 行**；`git rev-parse --short HEAD` = `e33a95a2`；上述 7 个测试文件合跑 **7 文件 / 96 例 / 0 红**。

## 四、D 逐条 AC 核对

| AC                            | 结论                           | 证据（独立复跑/读码）                                                                                                                                                                                                                                                                                                                                                                      |
| :---------------------------- | :----------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1 主路径                    | ✅                             | 转换层 `urgent ⇒ urgent`（用例绿 + 变异①可证）；渲染 `TaskPriorityInfo` 显示「紧急优先级」且不含「低」（用例绿）。该组件是列表 / 表格 / 看板列表项的**共用渲染点**                                                                                                                                                                                                                         |
| AC2 选择器四档 + 保存后不回落 | ✅                             | `TaskPrioritySelectOptions` 由 `TASK_PRIORITIES` 派生（4 档，用例绿）；`Create/UpdateTaskValueObject.validate` 接受 `urgent`（原判 `PRIORITY_INVALID`，用例绿）；仓储 `create → list` 保留 `urgent`（排序用例建了 urgent 任务并读回）                                                                                                                                                      |
| AC3 排序                      | ✅                             | 列表排序 + 日历排序双向（紧急→高→中→低 / 反向）均绿；rank 依赖 `prioritySNMap`（变异②可证）；脏值 / 空值仍与 `low` 同档（绿）                                                                                                                                                                                                                                                              |
| AC4 脏值 / null               | ✅                             | `unknown-x`、`URGENT` ⇒ `low`；`null` / `''` ⇒ `DEFAULT_TASK_PRIORITY`；渲染脏值不再抛错、无空白标签（修复前为 `TypeError: reading '0'`）                                                                                                                                                                                                                                                  |
| AC5 跨端保真                  | ✅                             | pull `taskRes2TaskEntity` 保留 `urgent`；push 载荷保留 `urgent`；视图转换保留（变异①可证）                                                                                                                                                                                                                                                                                                 |
| AC6 设计一致性                | ⚠ **部分**                     | 见 §4.1 对比度计算：**urgent 达标**（浅 6.08 / 暗 5.28）；但**「中」档文本浅色 3.45:1 < 4.5** 为**既有**问题（`warning-60` 作文本色，T582 前即如此，`DESIGN.md` §2 已注明 `-60/-70` 文本不达标）。三重冗余成立（图标 + 文案 + 颜色），但 urgent 与 high **颜色通道区分度弱**（ΔE76 8.8 / 暗 10.1；红绿色盲模拟 8.6 / **6.6**，暗色低于仓内 7.4 的「几乎重合」参考线）⇒ 只能靠图标/文案区分 |
| AC7 移动端红线                | ✅                             | 0 行 + `guard:mobile-imports` rc=0                                                                                                                                                                                                                                                                                                                                                         |
| AC8 看板                      | ⚠ **部分（只兑现「列名单」）** | 见 §4.2                                                                                                                                                                                                                                                                                                                                                                                    |
| AC9 导出文案                  | ✅                             | 导出 Markdown 含「紧急优先级」且不含「低优先级」（用例绿 + 变异③可证）                                                                                                                                                                                                                                                                                                                     |

### 4.1 AC6 对比度（静态计算，可复现）

token 取值（`node_modules/nue-ui-theme-shadlike/dist/global/variables.css`）：`error` 色相 10、饱和度 `-s80`；`-60` = `l45`、`-70` = `l40`；暗色开关把 `l45 → 55%`、`l40 → 60%`、`s80 → 70%`。页面底色：浅 `#ffffff`、暗 `--nue-primary-color-0` = `hsl(0,0%,10%)` = `#1a1a1a`。

| 档位 | 文本色 token                            | 浅色                  | 暗色                 | 判定（文本 ≥4.5）        |
| :--- | :-------------------------------------- | :-------------------- | :------------------- | :----------------------- |
| 紧急 | `--nue-error-color-70`                  | `#b83014` **6.08:1**  | `#e06952` **5.28:1** | ✓                        |
| 高   | `--nue-error-color-60`                  | `#cf3617` **5.03:1**  | `#dd573c` **4.56:1** | ✓（暗色贴线）            |
| 中   | `--nue-warning-color-60`                | `#cf7317` **3.45:1**  | `#dd8c3c` **6.57:1** | ✗ 浅色不达标（**既有**） |
| 低   | `inherit`（`--nue-primary-text-color`） | `#333333` **12.63:1** | 同源                 | ✓                        |

**紧急 vs 高**（同一色相、仅亮度差 5pp）：ΔE76 = 8.8（浅）/ 10.1（暗）；红绿色盲模拟 ΔE76 = 8.6（浅）/ 6.6（暗）。⇒ **颜色不足以单独区分**，R4 依赖图标（`warning` vs `priority-3`）+ 文案（「紧急优先级」vs「高优先级」）成立；`warning` 图标存在、`priority-4` 确不存在（`nue-ui-iconfont/dist/iconfont.css` 仅有 `priority-1/2/3` + `warning`），rd-fe 声明属实。

### 4.2 AC8 实际生效面（PM 要的一句话结论）

**一句话：AC8 只兑现了「列名单覆盖四档」；用户可见的看板「按优先级分组」仍不可用 —— 且该路径本身是 state 语义，接线需整体改造。**

读码证据（不止「无调用点」）：

1. 无调用点：`getKanbanColumns(groupBy)` 唯一调用是 `kanban.vue:22` 的 `getKanbanColumns()`（取默认 `state`）；全仓无 `getKanbanColumns('priority')`。
2. 列头是状态语义：`kanban-column.vue:23` 恒渲染 `<task-state-info :state="category" />` ⇒ 即便传入 `'urgent'` 也会渲染成「状态」标签。
3. 过滤是状态语义：`use-kanban-column.ts:14` `columnTasks = props.tasks.filter(task => task.state === props.category)` ⇒ 优先级分组下每列都是**空列**（没有任务的 `state` 等于 `'urgent'`）。
4. 拖拽写回是状态语义：`use-kanban.ts:19-25` 形参类型 `TaskViewObject['state']`，落库 `update(taskId, { state: category })` ⇒ 接线后拖到「紧急」列会写 `state = 'urgent'`（非法值）。
5. 默认按状态分组下 **urgent 任务不消失**：落在 todo / in-progress / done 列，且 `columns.priority` 开启时列表项经 `TaskPriorityInfo` 显示「紧急」标签 ⇒ AC8 的「不得凭空消失」在**可见的那条路径**上成立。

⇒ 已由 PM 登记 `DEF-114`；建议把上述 2/3/4 三条（列头、过滤、拖拽写回）补进 `DEF-114` 详情，否则后续按「只加列名」修会得到四个空列 + 写坏 state。

### 4.3 rd-fe 三处「可见面扩展」核查

| 可见面                   | 位置                                                                                                                         | token 使用                                                             | 新增硬编码色值 | 移动端 |
| :----------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------- | :------------- | :----- |
| 搜索行优先级圆点 + title | `apps/web/src/views/index/search/entry.vue:238-250`                                                                          | `--nue-error-color-70/-60`、`--nue-warning-color-60`（均为既有 token） | 无             | 未触碰 |
| 日历任务条左缘色         | `apps/web/src/components/calendar/monthly/task-bar.vue:47-53`                                                                | 同上                                                                   | 无             | 未触碰 |
| 搜索筛选栏优先级短名     | `apps/web/src/components/search/search-filter-bar.vue:66-71` + i18n `task.priority.short.urgent`（zh「紧急」/ en「Urgent」） | 仅 i18n                                                                | 无             | 未触碰 |

机器核对：实现 diff 内 `#hex` / `rgb(` / `hsl(` 新增行 = **0**；新增 `--nue-*:` 变量定义 = **0**（未新造 token）；`bcc41fc1..HEAD` 触碰 `packages/presentation-react` / `apps/mobile` = **0 文件**。

**缺口**：三处可见面**均无自动化断言**（全仓测试无 `priorityDotOf` / `barColor` / 短名映射覆盖）⇒ 逻辑面只靠读码 + 用户视觉，属可补强项。

## 五、结论与遗留

**结论**：AC1/AC2/AC3/AC4/AC5/AC7/AC9 全部成立；AC6 与 AC8 **部分成立**（AC6 的「中」档文本对比度为既有缺陷、urgent 达标；AC8 只兑现列名单）。全仓门禁 0 红、五守卫 rc=0、两端构建 rc=0、移动端 diff 0 行。

**遗留（三出口）**：

1. `AC6`「中」档文本浅色 3.45:1（既有，非本单引入）→ **接受**（不在 DEF-84 范围；如需修，与 `DESIGN.md` §2「三态文本用 `-90`」的收敛批合并）。
2. `AC8` 看板优先级分组不可用（列头/过滤/拖拽写回均为 state 语义）→ **转办**：`DEF-114`（建议补三条细节）。
3. 三处可见面（搜索圆点/日历色条/筛选短名）无自动化断言 → **接受**（并入用户视觉验收清单）；如需逻辑面锁定，下批补 3 条轻量断言。
4. 观感提示：`urgent` 与 `high` 同色相、暗色红绿色盲模拟 ΔE 6.6 → **接受**（三重冗余已成立）；用户视觉验收时请重点看暗色下两档可辨性。