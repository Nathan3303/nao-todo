# ADR：导出侧子任务检查项只读取数（`TaskCheckItemUseCase` 读写解耦）

- **日期**：2026-09-21
- **状态**：✅ **已采纳**（D1=A′ / D2=进入 `domain-task` 公共导出面；PM 拍板 2026-09-21，**待实现**）
- **范围**：`packages/domain-task/src/application/usecases/task-check-item.ts`（新增只读取数）+ `packages/presentation/task/components/task-details/use-export-task.ts`（改用只读取数）；**不改** store 端口、不改 `presentation-react`、不改 `export-markdown.ts`
- **相关**：TASK-13 导出任务文本对话框优化（`docs/prds/2026-09-21-task-export-editable-enriched.md` §5.3 / §9 D1）；评审编号 T32

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                               |
| :----- | :------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **r1** | **2026-09-21** | 首次成文：污染机制实证（`setList` 为整体替换）→ 裁决 A′（只读原语 + `list` 委托）→ 否决 B/C → 排序契约与 AC5 断言建议 → 证据索引       |
| **r2** | **2026-09-21** | PM 拍板留痕：D1=A′、D2=进入公共导出面 ⇒ 状态由「⏳ 有条件通过」改「✅ 已采纳」；路径引用复核（全部正确，无需修正）；C1–C3 技术内容不变 |

## 1. 背景与问题

PRD §5.3 要求导出**一级子任务的检查项**。现有取数入口 `TaskCheckItemUseCase.list(taskId)` 是**写型**用例——它把结果写进共享 store：

- `packages/domain-task/src/application/usecases/task-check-item.ts:43-56`：`list()` 末尾执行 `this.store.setCheckItems(checkItems)` + `this.store.setCheckItemIds(checkItemIds)`，返回 `id[]`。

而该 store 在 Vue 端是 **Pinia 单例** `TaskDetailsStore`（`packages/presentation/task/stores/task-details-store.ts`），任务详情面板的可见列表 `checkItems` 即由 `checkItemIdsCheckItems` 计算而来（`use-task-check-item-store-base.ts`）。

**污染不是"短暂抖动"，而是破坏性整体替换**，实证两点：

| 机制                         | 位置                                                                                 | 后果                                                                                                 |
| :--------------------------- | :----------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| `setCheckItems` 为整体替换   | `packages/shared/hooks/use-mapper-store-base.ts:17-18`（`map.value = new Map(...)`） | 清空**全部**已缓存检查项（不止根任务，其它任务缓存一并丢失）                                         |
| `setCheckItemIds` 为整体替换 | `packages/shared/hooks/use-list-store-base.ts:16-18`（`list.value = newList`）       | 把详情面板可见列表直接重指向**子任务**的检查项 ⇒ 面板渲染错误内容，`resort`/转任务等操作基准一并错位 |

补充事实：**离线/在线排序口径不一致**——本地仓储 `LocalTaskCheckItemRepoImpl.list` 显式 `entities.sort((a,b)=>a.sortId-b.sortId)`（`persistence-local/repos/task-check-item-repo-impl.ts:118`），Go 仓储 `TaskCheckItemRepoImpl.list` 直接返回接口顺序、**不排序**（`persistence-go/task/task-check-item-repo-impl.ts:117-131`）。任何新的只读取数若不定义排序，会导致同一任务**在线与离线导出的检查项顺序不同**。

## 2. 决策

**D1 — 采用 A′（只读取数原语 + 既有 `list` 委托），而非并列新增 A。**

1. 在 `TaskCheckItemUseCase` 内抽出**纯取数原语**（不触 store）：
    ```ts
    // 只读取数：repo.list → 转 VO → 归一排序（sortId ASC, id ASC）；不写 store
    async listByTask(taskId: TaskViewObject['id']): GoAsync<TaskCheckItemViewObject[]>
    ```
2. 既有 `list()` 改为**委托** `listByTask()` 后再写 store，**返回契约与副作用保持不变**：
    ```ts
    async list(taskId) {
        const [items, err] = await this.listByTask(taskId)
        if (err !== null) return [null, err]
        const ids = items.map((i) => i.id)
        this.store.setCheckItems(items)
        this.store.setCheckItemIds(ids)
        return [ids, null]
    }
    ```
3. 导出侧（`use-export-task.ts`）对子任务检查项**只调 `listByTask`**；根任务检查项沿用现有 `checkItems`（详情 store 已加载，无额外请求）。
4. **排序契约**：`listByTask` 返回 `sortId ASC, id ASC` 归一排序（与导出侧子任务排序 tiebreak 同构），**不依赖底层仓储顺序**。

## 3. 理由与被否方案

**为什么 A′ 优于"并列新增 A"**：A 会让 `list` 与 `listByTask` 各持一份「repo 取数 + `taskCheckItemEntityToViewObject` 转换 + 排序」逻辑，二者可静默漂移（例如未来只改 `list` 的转换）。A′ 让写型 `list` 成为只读原语 + 副作用的一层薄封装，**单一转换/排序真源**，且 `list` 的对外行为零变化。

**为什么不是"导出直接用 repo"**：`TaskCheckItemRepository` 是 domain 层端口，presentation 不得越过用例直连仓储（破坏分层与本地/Go 仓储可替换性）。

**否决 B（调 `list` 后重列根任务还原）**：

- 破坏面被 PRD 低估：`setCheckItems` 整表替换会**清空其它任务的检查项缓存**，B 只能还原根任务一项，无法还原其余；
- 多一轮网络请求，且**还原请求失败即留下永久脏 store**（无事务/回滚语义）；
- 还原期间用户可交互（面板可见列表被指向子任务）⇒ 竞态与误操作；
- 与 AC5「未污染 store」的"负向"验收语义相悖——B 只能证明"最终一致"，无法证明"从未污染"。

**否决 C（本单不含子任务检查项）**：与 grill-me Q1 用户澄清直接冲突，仅在 A/A′ 均不可行时启用；本评审已证 A′ 可行，C 不成立。

## 4. 影响与约束

- **additive only**：仅新增 `listByTask`，不删除/不改签名 ⇒ `presentation-react`（`packages/presentation-react/src/logic/compose-task-usecase.ts:97,107`）无需改动，符合 PRD「不动 presentation-react」红线。
- `TaskCheckItemStore` 端口与 `TaskDetailsStore` 结构**不变**，无 Dexie/同步载荷变更。
- `export-markdown.ts` 保持纯函数（无 Vue / i18n 依赖），本决策不涉及其实现。
- 约束 C1：导出路径**禁止**调用任何写型检查项用例（`list`/`create`/`update`/`delete`/`resort*`）。
- 约束 C2：`listByTask` 必须自带归一排序；新增只读查询类方法均须定义返回顺序，禁止依赖仓储顺序。
- 约束 C3：未来若再出现"导出/统计等旁路读共享 store 数据"，一律走只读取数路径，不得复用写型用例。
- **AC5 断言建议**（负向 + 工程）：在导出前后快照 `TaskDetailsStore.checkItems`（映射内容）与 `checkItemIds`，断言**深度相等**；并补一条「Go 仓储无序返回 → 导出顺序稳定」的用例。

## 5. 证据索引

| 类别                   | 位置 / 提交                                                                                                                                                                                           |
| :--------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 写型用例（根因）       | `packages/domain-task/src/application/usecases/task-check-item.ts:43-56`                                                                                                                              |
| store 整体替换         | `packages/shared/hooks/use-mapper-store-base.ts:17-18`；`packages/shared/hooks/use-list-store-base.ts:16-18`                                                                                          |
| 详情 store（单例）     | `packages/presentation/task/stores/task-details-store.ts:16-19,31-35`；`packages/presentation/task/hooks/use-task-check-item-store-base.ts`                                                           |
| 在线/离线排序分歧      | `packages/infrastructure/src/persistence-local/repos/task-check-item-repo-impl.ts:109-124`（排序）vs `packages/infrastructure/src/persistence-go/task/task-check-item-repo-impl.ts:117-131`（不排序） |
| 导出调用点（待改）     | `packages/presentation/task/components/task-details/use-export-task.ts`（`fetchChildren`/`buildMarkdown`）                                                                                            |
| 跨端消费者（须零改动） | `packages/presentation-react/src/logic/compose-task-usecase.ts:97,107`                                                                                                                                |
| 现有写型调用方         | `packages/presentation/task/components/task-details/use-check-items.ts:55`（详情页，合法）                                                                                                            |

## 6. 遗留项与变更管理

- 实现期若偏离 C1–C3 任一约束，**须回到架构评审**并修订本 ADR。
- 本 ADR 的公共 API 面承诺（`listByTask` 进入 `domain-task` 导出）**已拍板 = 进入公共导出面**（见 §7）；原备选「实现层私有化」不再适用。

## 7. 决策留痕（拍板）

| 决策点 | 议题                                           | 架构建议 | 拍板结论         | 拍板人 | 拍板时间   |
| :----- | :--------------------------------------------- | :------- | :--------------- | :----- | :--------- |
| **D1** | 子任务检查项取数落点（A′ / A / B / C）         | A′       | **A′**（采纳）   | PM     | 2026-09-21 |
| **D2** | `listByTask` 是否进入 `domain-task` 公共导出面 | 进入     | **进入**（采纳） | PM     | 2026-09-21 |

- C1–C3（实现约束）已同步写入 PRD §9，技术内容未变更。
- 状态变更：`⏳ 有条件通过` → `✅ 已采纳`；实现完成后请回本 ADR 追加实现留痕（提交号 / 回归测试）。