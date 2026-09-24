# ADR：收集箱哨兵单一真源（`'inbox'` ↔ `''` 的归一化边界）

- **日期**：2026-09-21
- **状态**：**已裁决（已实现 / 已复核）**
- **范围**：Web 搜索域——`apps/web/src/components/search/search-tasks.ts`、`apps/web/src/components/search/use-search.ts`；**不改** URL 契约、内建清单查询、`shared`/`domain`/`infrastructure`/`presentation-react`
- **相关**：`apps/web/src/components/search/search-query.ts`（URL 深链编解码，D1 收件箱 token）；`packages/infrastructure/src/built-in/project/default.ts`（内建清单 `projectId:'inbox'`）

## 修订记录

| 版本   | 日期           | 变更摘要                                                                                                                                       |
| :----- | :------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| **r1** | **2026-09-21** | 首次成文：事实（两套哨兵并存）→ 缺陷（v1.7.8「收集箱搜不到」）→ 决策 Fix B（入口归一）+ Fix A（过滤两端归一）→ 否决全局 VO 边界归一 → 证据索引 |

## 1. 背景与问题

**事实：收集箱在系统内存在两套哨兵**：

| 场景                                                                          | 取值      |
| :---------------------------------------------------------------------------- | :-------- |
| 真实数据（任务 `projectId`）、服务端、列表/内建清单查询、移动端（React/Lynx） | `'inbox'` |
| 搜索**内部**状态 + **URL** token                                              | `''`      |

证据：

- 内建清单 `packages/infrastructure/src/built-in/project/default.ts:48`（`id:'inbox'`）、`:135,139`（`projectId:'inbox'`）；移动端 `packages/presentation-react/src/logic/task-filter-core.ts:15,124`。
- 服务端 `nao-todo-server/application/task/converters.go:128`（`""` 或 `"inbox"` 归一为默认收件箱）、`:201`（列表过滤把字面量 `inbox` 解析为收件箱）。
- 搜索侧 `apps/web/src/components/search/search-query.ts:7,36`（收件箱哨兵 `projectId=''` 编码为 `inbox` token）。

**缺陷（v1.7.8「收集箱搜不到」）**：搜索本地过滤 `matchTaskFilters` 用**等值比较** `projectIds.includes(task.projectId || '')`。真实任务的 `projectId` 为 `'inbox'`，而筛选集合里收集箱是 `''` ⇒ `'inbox' !== ''` ⇒ **收集箱筛选恒不命中**（URL 深链 `?project=inbox` 能还原出 `''` 筛选，但本地任务数据仍是 `'inbox'`）。

## 2. 决策

**D1（Fix B，主）— 搜索入口归一**：`use-search.ts` 构建 `flatTasks` 时把真实数据的 `projectId === 'inbox'` 归一为内部哨兵 `''`（`use-search.ts:144-149`）。搜索域内此后只存在 `''` 一种收集箱表示。

**D2（Fix A，防御）— 过滤两端归一**：`search-tasks.ts` 抽出 `normalizeProjectId`（`'inbox'→''`，保留 `null`），`matchTaskFilters` 对**任务侧与筛选侧**都归一后再比较（`search-tasks.ts:178-201`）。即使入口归一被绕过（其它调用方直接喂原始任务），过滤仍正确。

**D3 — 对外契约不动**：

- URL 深链保持 `?project=inbox`（`parse` → `''`，`serialize` → `inbox`），`search-query.ts:36` 不变；
- 内建清单查询保持 `projectId:'inbox'`（`default.ts`）；
- 不触碰 `shared`/`domain`/`infrastructure`/`presentation-react`。

## 3. 理由与被否方案

**为什么用「入口归一 + 过滤归一」双层而非单点**：Fix B 覆盖搜索主链路（性能与语义都干净）；Fix A 是纯函数防御，成本极低（一次字符串映射），可防止 `matchTaskFilters` 的其它调用方/测试绕过入口时回归。两层都只作用于**搜索域**，不外溢。

**否决「全局在 VO 边界归一 `'inbox'`↔`''`」**：

- blast radius 大——`TaskViewObject.projectId` 的写侧/读侧遍布 `domain`/`infrastructure`/`presentation`/移动端；服务端已把 `''`/`'inbox'` 都视作收件箱，全局改写会引入跨端不一致与同步往返风险；
- 与内建清单 `'inbox'`、移动端 `'inbox'` 的既有契约冲突，需多端联动改造；
- 本缺陷本质是**搜索本地过滤的表示不一致**，搜索域内归一即可闭合，无需动全局模型。

**否决「改 URL token 为 `''`」**：URL 需要可读且非空 token；`?project=` 空值会被 `toTokens` 丢弃，无法表达收集箱。`inbox` token 是既定 URL 契约（D1），不动。

## 4. 影响与约束

- 搜索域内部（`flatTasks`、`matchTaskFilters`）统一以 `''` 表示收集箱；`normalizeProjectId` 保留 `null` 语义（不强制转 `''`，由调用方按需兜底）。
- URL/内建清单/移动端/服务端契约**不变**；无 Dexie 结构变更、无同步载荷变更。
- 约束：搜索域新增任何清单比较逻辑，必须经 `normalizeProjectId` 归一后再比较；**不得**在搜索域引入 `'inbox'` 字面量比较。

## 5. 证据索引

| 类别              | 位置 / 提交                                                                                                       |
| :---------------- | :---------------------------------------------------------------------------------------------------------------- |
| 修复提交          | `c2b22384`（fix(search): 修复收集箱（projectId='inbox'）搜索不命中）                                              |
| 回归测试          | `dc8bafa2`（收集箱搜索回归 7 项 T28）                                                                             |
| 入口归一（Fix B） | `apps/web/src/components/search/use-search.ts:144-149`                                                            |
| 过滤归一（Fix A） | `apps/web/src/components/search/search-tasks.ts:178-201`（`normalizeProjectId:184-185`，两端归一 `:195-198`）     |
| URL 契约          | `apps/web/src/components/search/search-query.ts:7,36`（`INBOX_TOKEN='inbox'`；`parse`→`''`，`serialize`→`inbox`） |
| 内建清单          | `packages/infrastructure/src/built-in/project/default.ts:48,135,139`                                              |
| 移动端            | `packages/presentation-react/src/logic/task-filter-core.ts:15,124`                                                |
| 服务端            | `nao-todo-server/application/task/converters.go:128,201`                                                          |
| 回归测试文件      | `apps/web/src/components/search/__tests__/search-tasks.test.ts`（+109 行）                                        |

## 6. 遗留项

- **跨端表示不一致登记（非缺陷，显式接受）**：搜索域用 `''`、其余端用 `'inbox'`。若未来引入第三处比较（如搜索新增“项目维”以外维度），须复用 `normalizeProjectId`，**不得**扩散 `'inbox'` 字面量比较。
- 若后续产品决定统一全局哨兵（例如全面改用 `'inbox'`），须另立 ADR 并评估 URL 契约、移动端、服务端 `splitProjectIds` 的联动面，本单不预埋。