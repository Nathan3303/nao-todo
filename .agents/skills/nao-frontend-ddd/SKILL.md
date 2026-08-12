---
name: 'nao-frontend-ddd'
description: 'Frontend Domain-Driven Design architecture guide based on Vue 3 + TypeScript + Pinia. Invoke when user wants to implement DDD, create new domains, or refactor project structure.'
---

# Frontend DDD Architecture

## 1. 核心架构分层（框架无关）

| 层级                             | 职责                                                                                             | 框架依赖                                         | 存放位置                                            |
| :------------------------------- | :----------------------------------------------------------------------------------------------- | :----------------------------------------------- | :-------------------------------------------------- |
| **Domain（领域层）**             | 聚合根、实体、值对象、仓储接口。**纯 TS 类**，包含业务方法。                                     | **零依赖**（无 Vue/React/JSX）                   | `packages/domain/` 或 `src/core/`                   |
| **Application（应用层）**        | UseCase、DTO、**出站端口**（如 `ITaskStateGateway`）。编排业务流，不包含 UI 状态。               | **零依赖**（仅引用 Domain）                      | `packages/application/` 或 `src/application/`       |
| **Infrastructure（基础设施层）** | 仓储接口实现（HTTP/LocalStorage）。负责 API 调用并实例化领域实体。                               | 依赖 HTTP 客户端（如 axios），**无 UI 框架依赖** | `packages/infrastructure/` 或 `src/infrastructure/` |
| **Presentation（表现层）**       | **框架适配层**。包含 Store/Zustand、Hooks/Composables、领域组件。**唯一与 Vue/React 耦合的层**。 | **强依赖** Vue 或 React                          | `packages/presentation/` 或 `src/presentation/`     |
| **Views（视图层）**              | 路由页面（Pages）。组装领域组件，传递路由参数。**不含业务逻辑**。                                | 依赖路由库（Vue Router / React Router）          | `apps/*/src/views/` 或 `src/views/`                 |

## 2. Presentation 与 Views 层的框架差异对照表

| 架构要素              | **Vue 3 实现方式**                                             | **React 实现方式**                                                | **核心职责（相同）**                                                         |
| :-------------------- | :------------------------------------------------------------- | :---------------------------------------------------------------- | :--------------------------------------------------------------------------- |
| **业务状态管理**      | Pinia Store（`defineStore`），持有聚合根实例。                 | Zustand / Jotai 的 Store 或 Atom，持有聚合根实例。                | **实现 Application 层定义的 `ITaskStateGateway` 端口**，存储领域状态。       |
| **UI 状态管理**       | 独立的 Pinia Store（如 `useTaskUiStore`）或组件内 `ref`。      | Zustand 切片（Slice）或 `useState` / `useReducer`。               | 仅存储 `loading`、`keyword`、`selectedId` 等界面状态，**不与业务状态混存**。 |
| **逻辑复用单元**      | Composables（`useTask.ts`），内部调用 Pinia Store 和 UseCase。 | Custom Hooks（`useTask.ts`），内部调用 Zustand Store 和 UseCase。 | **依赖注入组装点**：在此实例化 UseCase，注入 Repository 和 Store/Gateway。   |
| **响应式机制**        | Proxy 响应式（`ref`/`reactive`），直接修改属性触发更新。       | 不可变数据（Immer 或展开运算符），通过 Setter 触发重渲染。        | 组件通过调用 Hooks/Composables 返回的数据驱动 UI。                           |
| **领域组件定义**      | SFC（`<script setup>` + `<template>`）。                       | TSX / JSX 函数组件（`const Component = () => {}`）。              | **仅依赖 Hooks/Composables**，不直接调用 UseCase 或 Repository。             |
| **页面组件（Views）** | Vue Router 的 `router-view` 配合 `<script setup>`。            | React Router 的 `<Routes>` 配合函数组件。                         | 仅做路由参数读取和子组件编排，禁止写 `if/else` 业务分支。                    |
| **依赖注入机制**      | 通过 Composable 中的 `new UseCase(...)` 显式组装。             | 通过 Custom Hook 中的 `new UseCase(...)` 显式组装。               | **禁止**使用 Context 或 Provide/Inject 传递业务依赖（仅用于主题/语言）。     |

## 3. 跨框架共享策略（Monorepo 实践）

在 Level 3（Monorepo）中，采用以下分包策略最大化复用：

| 包类型                        | 内容                                             | 框架依赖                     | 被谁引用                                  |
| :---------------------------- | :----------------------------------------------- | :--------------------------- | :---------------------------------------- |
| `packages/domain`             | 聚合根、实体、仓储接口                           | 无                           | Application、Infrastructure、Presentation |
| `packages/application`        | UseCase、DTO、端口定义                           | 无                           | Presentation                              |
| `packages/infrastructure`     | Http/Local 仓储实现                              | axios（无 UI 框架）          | Presentation（通过 Composable 实例化）    |
| `packages/presentation-vue`   | **Vue 适配**：Pinia Store、Composables、领域组件 | Vue 3、Pinia                 | `apps/web-vue`、`apps/desktop-vue`        |
| `packages/presentation-react` | **React 适配**：Zustand Store、Hooks、领域组件   | React、Zustand               | `apps/web-react`、`apps/mobile-react`     |
| `packages/shared/ui-kit`      | 纯 UI 组件库（Button、Input、Modal）             | Vue 或 React（各自独立实现） | 对应的 Presentation 包                    |
| `packages/shared/core-utils`  | 纯 TS 工具函数                                   | 无                           | 所有包                                    |

> **原则**：若需同时支持 Vue 和 React，**Presentation 层必须拆分为两个独立包**，而 Domain/Application/Infrastructure 完全共享。

## 4. 组件归属决策（框架无关）

| 条件                                                              | 归属位置                                                           |
| :---------------------------------------------------------------- | :----------------------------------------------------------------- |
| 组件**依赖**领域类型（Task、User）或业务状态。                    | `presentation/<framework>/<domain>/components/`                    |
| 组件**无业务含义**，仅用于布局或通用交互（Button、Card、Modal）。 | `shared/ui-kit/<framework>/`                                       |
| 逻辑包含业务编排（调用 API、更新 Store）。                        | 放入 `Composables`（Vue）或 `Hooks`（React），**不放入组件内部**。 |
| 逻辑仅涉及 UI 交互（弹窗开关、滚动监听）。                        | 放入 `Composables`/`Hooks` 的 `ui` 子目录或组件内局部状态。        |

## 5. 代码审查红线（框架无关 + 框架特定）

**通用红线（所有框架）**：

- [ ] `packages/domain/` 或 `src/core/` 中是否有 `import { ref } from 'vue'` 或 `import { useState } from 'react'`？（应为零）
- [ ] 实体类是否为**充血模型**（包含 `complete()`、`isOverdue()` 方法），而非贫血接口？
- [ ] 应用层 UseCase 是否只依赖仓储接口和端口，未直接引用 Pinia/Zustand 的 API？
- [ ] 页面组件（Views）是否仅做组装，不包含 `if (task.status === 'done')` 业务分支？

**Vue 特定红线**：

- [ ] Pinia Store 是否严格区分为业务 Store（存聚合根）和 UI Store（存 loading）？
- [ ] Composable 是否作为依赖注入的唯一入口（`new UseCase(...)` 在此完成）？
- [ ] 是否避免了在组件中用 `watch` 监听路由变化并直接修改 Store（应通过 Composable 封装）？

**React 特定红线**：

- [ ] Zustand/Jotai Store 是否仅存储领域状态，UI 状态是否用 `useState` 或独立 Slice 隔离？
- [ ] Custom Hook 是否作为依赖注入的唯一入口（`new UseCase(...)` 在此完成）？
- [ ] 是否避免了在 JSX 中直接调用 UseCase 方法（必须通过 Hook 暴露的方法触发）？

## 6. 框架选择决策速查

| 项目特征                                | 推荐框架               | 配套状态方案                                    |
| :-------------------------------------- | :--------------------- | :---------------------------------------------- |
| 团队熟悉 Vue 生态，中小型项目           | **Vue 3**              | Pinia（业务） + 组件内 `ref`（UI）              |
| 团队熟悉 React 生态，需要强类型和灵活性 | **React + TypeScript** | Zustand（业务） + `useState`/`useReducer`（UI） |
| 需要极高性能和细粒度渲染控制            | **React**              | Jotai（原子化状态）                             |
| 快速原型开发，需内置状态管理            | **Vue 3**              | Pinia（开箱即用）                               |

## 7. 常见误区澄清（框架视角）

- **误区一**：DDD 的前端实现必须依赖特定状态库（如 Pinia 或 Redux）。
  **纠正**：状态库是 Presentation 层的**适配器**，而非核心。Domain 层根本不关心状态如何响应式更新，它只负责业务规则。

- **误区二**：React 的 Context 可以用来传递业务依赖（如 UseCase）。
  **纠正**：Context 适合传递主题、语言等**基础设施级**信息。业务依赖（UseCase、Repository）应在 Custom Hook 中显式组装，避免 Context 导致的性能陷阱和测试困难。

- **误区三**：Vue 的 `reactive` 可以直接包裹聚合根实例。
  **纠正**：可以包裹，但严禁在组件中直接修改聚合根内部属性（如 `task.status = 'done'`）。必须通过聚合根的公开方法（`task.complete()`）修改，以保障业务不变量。

- **误区四**：Vue 和 React 的 Presentation 层无法共享任何代码。
  **纠正**：领域组件虽然无法共享，但**领域组件的逻辑规格**（如 Props 定义、事件回调命名）可以抽象为 `presentation/shared/types.ts`，供两个框架的组件共同遵循，保证跨应用交互的一致性。