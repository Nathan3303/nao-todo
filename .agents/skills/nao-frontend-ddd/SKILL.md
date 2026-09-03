---
name: 'nao-frontend-ddd'
description: 'Frontend Domain-Driven Design architecture guide for Vue 3 + TypeScript and React + TypeScript. Provides a progressive 3-level framework (Level 1 Composable lightweight / Level 2 per-domain stores / Level 3 full DDD monorepo) with code patterns, serialization boundaries, and review red lines. Invoke when user wants to implement DDD, create new domains, or refactor frontend project structure.'
---

# Frontend DDD Architecture Skill (Vue 3 / React 通用)

## When Invoked

遵循以下决策工作流：

1. **评估项目规模**：代码量（LOC）、团队人数、业务领域数量、是否需要同时支持 Vue 与 React（多端/多应用）。
2. **选择对应的 DDD 等级**（Level 1 轻量 / Level 2 标准 / Level 3 完整 Monorepo）。
3. **应用该等级对应的最小化结构**，只对核心域做 DDD，避免过度设计。
4. **提供代码模式**（充血实体、UseCase、Composable/Hook、Store 端口）。
5. **当达到明确的量化指标时，建议升级**（见各 Level 的「量化升级指标」）。

---

## 1. 架构哲学：领域隔离与依赖倒置

### 五层经典分层（自外向内）

| 层级                             | 职责                                                                                             | 框架依赖                                         | 存放位置                                            |
| :------------------------------- | :----------------------------------------------------------------------------------------------- | :----------------------------------------------- | :-------------------------------------------------- |
| **Domain（领域层）**             | 聚合根、实体、值对象、仓储接口。**纯 TS 类**，包含业务方法。                                     | **零依赖**（无 Vue/React/JSX）                   | `packages/domain/` 或 `src/core/`                   |
| **Application（应用层）**        | UseCase、DTO、**出站端口**（如 `ITaskStateGateway`）。编排业务流，不包含 UI 状态。               | **零依赖**（仅引用 Domain）                      | `packages/application/` 或 `src/application/`       |
| **Infrastructure（基础设施层）** | 仓储接口实现（HTTP/LocalStorage）、**DTO ↔ 聚合根 Mapper**。负责 API 调用并实例化领域实体。      | 依赖 HTTP 客户端（如 axios），**无 UI 框架依赖** | `packages/infrastructure/` 或 `src/infrastructure/` |
| **Presentation（表现层）**       | **框架适配层**。包含 Store/Zustand、Hooks/Composables、领域组件。**唯一与 Vue/React 耦合的层**。 | **强依赖** Vue 或 React                          | `packages/presentation/` 或 `src/presentation/`     |
| **Views（视图层）**              | 路由页面（Pages）。组装领域组件，传递路由参数。**不含业务逻辑**。                                | 依赖路由库（Vue Router / React Router）          | `apps/*/src/views/` 或 `src/views/`                 |

**依赖方向**：`Views → Presentation → Application → Domain ← Infrastructure`（依赖倒置）

> **核心铁律**：Domain 层定义接口（`ITaskRepository`、`ITaskStateGateway`），Infrastructure 层实现仓储，Presentation 的 Store 实现状态端口。UseCase 只依赖端口，**不依赖任何 UI 框架 API**。高层模块依赖抽象，不依赖具体实现。

---

## 2. 项目结构（Level 3 完整版）

在 Monorepo 中，采用以下分包策略最大化复用：

```text
project-root/
├── packages/
│   ├── domain/                                # 【领域层】零依赖，纯 TS
│   │   └── task/                              # 按限界上下文分目录
│   │       ├── Task.entity.ts                 # 聚合根 / 充血实体
│   │       ├── TaskStatus.enum.ts
│   │       ├── value-objects/                 # Money、Priority 等值对象
│   │       ├── repositories/                  # ITaskRepository 接口
│   │       └── events/                        # TaskCompletedEvent 等领域事件
│   ├── application/                           # 【应用层】零依赖（仅引用 domain）
│   │   └── task/
│   │       ├── usecases/                      # CompleteTaskUseCase.ts
│   │       ├── dtos/                          # TaskDto 输入/输出模型
│   │       └── ports/                         # ITaskStateGateway 出站端口
│   ├── infrastructure/                        # 【基础设施层】无 UI 框架依赖
│   │   ├── http/
│   │   │   └── TaskHttpRepository.ts          # 实现 ITaskRepository
│   │   ├── storage/
│   │   │   └── TaskLocalRepository.ts         # LocalStorage 实现
│   │   └── mappers/
│   │       └── TaskDtoMapper.ts               # DTO ↔ 聚合根 双向转换
│   ├── presentation-vue/                      # 【Vue 适配层】
│   │   ├── stores/                            # useTaskStore（Pinia）
│   │   ├── composables/                       # useTask.ts（DI 组装点）
│   │   └── components/                        # 领域组件
│   └── presentation-react/                    # 【React 适配层】
│       ├── stores/                            # useTaskStore（Zustand）
│       ├── hooks/                             # useTask.ts（DI 组装点）
│       └── components/                        # 领域组件
├── shared/
│   ├── ui-kit/                                # 纯 UI 组件库（Button、Modal…）
│   └── core-utils/                            # 纯 TS 工具函数
└── apps/
    ├── web-vue/                               # 应用入口（含 views/ 路由页面）
    ├── desktop-vue/
    ├── web-react/
    └── mobile-react/
```

包划分规则：

| 包类型                        | 内容                                             | 框架依赖                     | 被谁引用                                  |
| :---------------------------- | :----------------------------------------------- | :--------------------------- | :---------------------------------------- |
| `packages/domain`             | 聚合根、实体、仓储接口、领域事件                 | 无                           | Application、Infrastructure、Presentation |
| `packages/application`        | UseCase、DTO、端口定义                           | 无                           | Presentation                              |
| `packages/infrastructure`     | Http/Local 仓储实现、Mapper                      | axios（无 UI 框架）          | Presentation（通过 Composable 实例化）    |
| `packages/presentation-vue`   | **Vue 适配**：Pinia Store、Composables、领域组件 | Vue 3、Pinia                 | `apps/web-vue`、`apps/desktop-vue`        |
| `packages/presentation-react` | **React 适配**：Zustand Store、Hooks、领域组件   | React、Zustand               | `apps/web-react`、`apps/mobile-react`     |
| `packages/shared/ui-kit`      | 纯 UI 组件库（Button、Input、Modal）             | Vue 或 React（各自独立实现） | 对应的 Presentation 包                    |
| `packages/shared/core-utils`  | 纯 TS 工具函数                                   | 无                           | 所有包                                    |

> **原则**：若需同时支持 Vue 和 React，**Presentation 层必须拆分为两个独立包**，而 Domain/Application/Infrastructure 完全共享。非 Monorepo 的单一框架项目，将上述层级折叠为 `src/domain`、`src/application`、`src/infrastructure`、`src/presentation`、`src/views` 即可。

---

## 3. Level 1：轻量级 DDD（< 5k LOC / 1–2 开发者）

### 适用场景

- 小型应用，业务逻辑不复杂，但**必须保有核心业务规则**（如任务状态流转、截止时间校验）。
- 团队 1–2 人，无多端需求，无需 Monorepo。

### 最小化结构

```text
src/
├── domain/
│   └── task/
│       ├── Task.entity.ts        # 充血实体：complete(), isOverdue()
│       ├── TaskStatus.enum.ts
│       └── ITaskRepository.ts    # 仓储接口（定义在 Domain）
├── infrastructure/
│   └── TaskHttpRepository.ts     # axios 实现（依赖倒置的起点）
├── stores/
│   └── taskStore.ts              # 业务 Store（Pinia / Zustand），存聚合根
├── composables/                  # Vue 用 Composables；React 用 hooks/
│   └── useTask.ts                # DI 组装点：new UseCase(...)
└── views/
    └── TaskListView.vue          # 页面：仅组装，无业务分支
```

### 核心模式：充血实体 + Composable 组装

**严禁**在组件或 Store 中编写 `if (task.dueDate < now)`，必须在 `Task.complete()` 中封装。

```typescript
// domain/task/Task.entity.ts —— 纯 TS，零框架依赖
export class Task {
    constructor(
        public readonly id: string,
        public title: string,
        public status: TaskStatus,
        public dueDate: Date
    ) {}

    // 【领域业务规则】
    public complete(): void {
        if (this.status === TaskStatus.DONE) {
            throw new DomainError('Task already completed')
        }
        if (this.dueDate < new Date() && this.status !== TaskStatus.DONE) {
            throw new DomainError('Cannot complete overdue task without review')
        }
        this.status = TaskStatus.DONE
    }
}
```

```typescript
// composables/useTask.ts —— Vue 3 组装点
export function useTask() {
    const taskStore = useTaskStore() // 业务 Store（持有聚合根）
    const repo: ITaskRepository = new TaskHttpRepository()
    const useCase = new CompleteTaskUseCase(repo, taskStore)

    const completeTask = async (id: string) => useCase.execute(id)

    return { tasks: computed(() => taskStore.tasks), completeTask }
}
```

### 量化升级指标（Level 1 → 2）

- 出现多个业务领域（任务、用户、项目），单一 `useTask.ts` 文件持续膨胀。
- 单个领域实体关联的子实体超过 **3 个**，需要引入聚合根。
- 团队人数超过 **3 人**，模块边界模糊导致合并冲突频繁。

---

## 4. Level 2：标准 DDD（5k–20k LOC / 3–5 开发者）

### 适用场景

- 中大型前端，具有明显的**限界上下文**（任务、用户、设置）。
- 业务编排逻辑复杂，需要把「调用 API + 更新 Store」从组件中完整剥离。

### 关键模式：UseCase 层 + 按领域拆分的 Store

UseCase 是纯 TS 的编排单元：获取聚合根 → 调用业务方法 → 保存 → 通过端口通知 UI 更新。**不包含 UI 状态**。

```typescript
// application/task/usecases/CompleteTaskUseCase.ts —— 零 UI 依赖
export class CompleteTaskUseCase {
    constructor(
        private repo: ITaskRepository, // Domain 接口，Infrastructure 实现
        private gateway: ITaskStateGateway // 出站端口，由 Store 实现
    ) {}

    async execute(id: string): Promise<void> {
        const task = await this.repo.findById(id)
        task.complete() // 业务规则在实体方法内
        await this.repo.save(task)
        this.gateway.updateTask(task) // 通知 UI 层更新（不感知 UI 框架）
    }
}
```

```typescript
// stores/taskStore.ts —— Pinia 实现出站端口
export const useTaskStore = defineStore('task', {
    state: () => ({ tasks: [] as Task[] }),
    actions: {
        // 实现 ITaskStateGateway 端口：用聚合根替换旧实例
        updateTask(task: Task) {
            const idx = this.tasks.findIndex((t) => t.id === task.id)
            if (idx >= 0) this.tasks[idx] = task
        }
    }
})
```

### 关键规则

- **业务 Store 与 UI Store 严格分离**：`loading`、`keyword`、`selectedId` 等界面状态放独立 UI Store 或组件局部 `ref`/`useState`，不与领域状态混存。
- Composable/Hook 是组件访问业务能力的**唯一入口**；组件不直接调用 UseCase 或 Repository。
- 组件内禁止直接修改聚合根属性（如 `task.status = 'done'`），必须调用公开方法。

### 量化升级指标（Level 2 → 3）

- 需要同时支持 Vue 与 React（或多端应用），共享 Domain/Application 收益显著。
- 业务规模超过 **20k LOC**，单包依赖混乱，进入 Monorepo。
- 不同领域由独立团队维护，需要清晰的包边界与发布节奏。

---

## 5. Level 3：完整 DDD（> 20k LOC / Monorepo）

### 核心原则：端口隔离 + 双框架适配

在 Level 3 中，UseCase 通过**出站端口**（`ITaskStateGateway`）与 UI 状态解耦，Presentation 层按框架拆分但遵循同一份逻辑规格。

### Presentation 与 Views 层的框架差异对照表

| 架构要素              | **Vue 3 实现方式**                                             | **React 实现方式**                                                | **核心职责（相同）**                                                         |
| :-------------------- | :------------------------------------------------------------- | :---------------------------------------------------------------- | :--------------------------------------------------------------------------- |
| **业务状态管理**      | Pinia Store（`defineStore`），持有聚合根实例。                 | Zustand / Jotai 的 Store 或 Atom，持有聚合根实例。                | **实现 Application 层定义的 `ITaskStateGateway` 端口**，存储领域状态。       |
| **UI 状态管理**       | 独立的 Pinia Store（如 `useTaskUiStore`）或组件内 `ref`。      | Zustand 切片（Slice）或 `useState` / `useReducer`。               | 仅存储 `loading`、`keyword`、`selectedId` 等界面状态，**不与业务状态混存**。 |
| **逻辑复用单元**      | Composables（`useTask.ts`），内部调用 Pinia Store 和 UseCase。 | Custom Hooks（`useTask.ts`），内部调用 Zustand Store 和 UseCase。 | **依赖注入组装点**：在此实例化 UseCase，注入 Repository 和 Store/Gateway。   |
| **响应式机制**        | Proxy 响应式（`ref`/`reactive`），直接修改属性触发更新。       | 不可变数据（Immer 或展开运算符），通过 Setter 触发重渲染。        | 组件通过调用 Hooks/Composables 返回的数据驱动 UI。                           |
| **领域组件定义**      | SFC（`<script setup>` + `<template>`）。                       | TSX / JSX 函数组件（`const Component = () => {}`）。              | **仅依赖 Hooks/Composables**，不直接调用 UseCase 或 Repository。             |
| **页面组件（Views）** | Vue Router 的 `router-view` 配合 `<script setup>`。            | React Router 的 `<Routes>` 配合函数组件。                         | 仅做路由参数读取和子组件编排，禁止写 `if/else` 业务分支。                    |
| **依赖注入机制**      | 通过 Composable 中的 `new UseCase(...)` 显式组装。             | 通过 Custom Hook 中的 `new UseCase(...)` 显式组装。               | **禁止**使用 Context 或 Provide/Inject 传递业务依赖（仅用于主题/语言）。     |

> **序列化与响应式**：无论哪种框架，Store 中持有的是**聚合根实例**（非裸 DTO）；数据进出边界与 Vue `reactive` 包裹聚合根的注意事项见第 7 章。

### 组件归属决策（框架无关）

| 条件                                                              | 归属位置                                                                            |
| :---------------------------------------------------------------- | :---------------------------------------------------------------------------------- |
| 组件**依赖**领域类型（Task、User）或业务状态。                    | `presentation/<framework>/<domain>/components/`                                     |
| 组件**无业务含义**，仅用于布局或通用交互（Button、Card、Modal）。 | `shared/ui-kit/<framework>/`                                                        |
| 逻辑包含业务编排（调用 API、更新 Store）。                        | 放入 UseCase 与全局 `Composables`（Vue）/`Hooks`（React）组装，**不放入组件内部**。 |
| 单个组件逻辑（非模板）**超过 200 行**。                           | 抽离为组件目录内的 `useXxx.ts`，组件只留模板与装配（见下方「组件逻辑抽离规则」）。  |
| 逻辑仅涉及 UI 交互（弹窗开关、滚动监听）。                        | 组件内局部状态；同样受 200 行阈值约束，超限即抽离为 `useXxx.ts`。                   |

> **单组件逻辑与共享逻辑的边界**：仅被一个组件使用的逻辑 → 组件目录内 `useXxx.ts`；跨组件/跨领域共享的逻辑 → 全局 `composables/`（Vue）或 `hooks/`（React）；业务编排（调 API、更新 Store）→ UseCase + 全局 Composable 组装（见第 6 章）。

### 组件逻辑抽离规则（200 行阈值）

**规则**：任何组件（`Xxx.vue` / `Xxx.tsx` / `Xxx.jsx`），只要**逻辑代码（非模板）超过 200 行**，就必须将逻辑抽离为 `useXxx.ts`（Composable / Custom Hook），组件内引入并执行。此规则**跨框架通用**，适用于 Level 1/2/3 所有项目形态。

**为什么是 200 行**：

- 超过 200 行逻辑的组件，难以在单个文件中快速定位状态来源与副作用，可读性显著下降。
- 逻辑独立成文件后，可以被单元测试直接覆盖（配合第 8 章「测试策略」），这是抽离最实在的收益。
- 抽离后组件文件只保留模板与装配，Code Review 时可快速判断「模板是否干净」、逻辑是否规整。

**「逻辑代码」的判定**：

| 计入逻辑行数                                                                                                                                                           | 不计入逻辑行数                                      |
| :--------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------- |
| 事件处理函数、状态声明（`ref`/`useState`/`storeToRefs`）、副作用（`watch`/`useEffect`/事件监听）、计算属性与派生状态（`computed`/`useMemo`）、条件分支、循环、工具函数 | 模板/JSX 标签、样式（style/scoped CSS）、注释、空行 |

**目录结构**：抽离时，将组件升级为**目录组件**——以组件名建目录，至少包含：

```text
TaskCard/
├── TaskCard.vue        # 或 TaskCard.tsx / TaskCard.jsx：模板 + 极薄装配
├── useTaskCard.ts      # 抽离的全部逻辑（Composable / Custom Hook）
├── index.ts            # 统一导出入口（组件 + useTaskCard + 类型）
├── types.ts            # （按需）Props / Emits / 状态类型
└── styles.ts / .css    # （按需）样式
```

**代码骨架（Vue 3）**：

```typescript
// TaskCard/useTaskCard.ts —— 全部逻辑在此
export function useTaskCard(props: TaskCardProps, emit: TaskCardEmits) {
    const expanded = ref(false)
    const toggle = () => {
        expanded.value = !expanded.value
        emit('toggle', expanded.value)
    }
    // 事件处理、副作用、派生状态……
    return { expanded, toggle }
}
```

```vue
<!-- TaskCard/TaskCard.vue —— 仅模板与装配 -->
<script setup lang="ts">
import { useTaskCard } from './useTaskCard'
const props = defineProps<TaskCardProps>()
const emit = defineEmits<TaskCardEmits>()
const { expanded, toggle } = useTaskCard(props, emit)
</script>

<template>
    <!-- 模板仅消费 useTaskCard 返回的状态与方法 -->
</template>
```

**代码骨架（React）**：

```typescript
// TaskCard/useTaskCard.ts —— Custom Hook
export function useTaskCard(props: TaskCardProps) {
    const [expanded, setExpanded] = useState(false)
    const toggle = useCallback(() => setExpanded((v) => !v), [])
    // 副作用、派生状态……
    return { expanded, toggle }
}
```

```tsx
// TaskCard/TaskCard.tsx —— 仅模板与装配
export function TaskCard(props: TaskCardProps) {
    const { expanded, toggle } = useTaskCard(props)
    return <div>{/* JSX 仅消费 useTaskCard 返回的状态与方法 */}</div>
}
```

**index.ts 导出约定**：

```typescript
// TaskCard/index.ts —— 统一出口，外部只从此处导入
export { default as TaskCard } from './TaskCard.vue' // Vue：export default 组件
export { useTaskCard } from './useTaskCard'
export type { TaskCardProps, TaskCardEmits } from './types'
```

**与全局 Composables/Hooks 的边界**（与上方「组件归属决策」表呼应，避免混淆）：

- **单组件专用逻辑** → 组件目录内 `useXxx.ts`（本规则）。
- **跨组件/跨领域共享逻辑** → 全局 `composables/`（Vue）或 `hooks/`（React）。
- **业务编排（调 API、更新 Store）** → UseCase + 全局 Composable 组装（见第 6 章），组件目录内的 `useXxx.ts` 只做 UI 级编排与装配。

---

## 6. 依赖注入（DI）与模块组装

核心原则：**显式组装**。UseCase 的依赖在 Composable/Hook 中一次性 `new` 出来，不依赖全局容器。

```typescript
// presentation-vue/composables/useTask.ts —— Vue 3
export function useTask() {
    const store = useTaskStore()
    const repo: ITaskRepository = new TaskHttpRepository() // 可替换为 TaskLocalRepository
    const useCase = new CompleteTaskUseCase(repo, store) // 显式注入

    return {
        tasks: storeToRefs(store).tasks,
        completeTask: (id: string) => useCase.execute(id)
    }
}
```

```typescript
// presentation-react/hooks/useTask.ts —— React
export function useTask() {
    const tasks = useTaskStore((s) => s.tasks)
    const repo: ITaskRepository = new TaskHttpRepository()
    const useCase = new CompleteTaskUseCase(repo, useTaskStore.getState())

    return {
        tasks,
        completeTask: (id: string) => useCase.execute(id)
    }
}
```

**禁止事项（DI 相关）**：

- ❌ **禁止**用 Context / Provide/Inject 传递 UseCase、Repository 等业务依赖（仅可用于主题、语言等基础设施级信息）。
- ❌ **禁止**在组件或 Store 内部直接 `new TaskHttpRepository()`（必须在 Composable/Hook 组装）。
- ❌ **禁止** Store 直接调用 Repository 完成业务编排（编排职责在 UseCase）。

---

## 7. 前端特有：DTO ↔ 聚合根序列化边界与响应式封装

这是前端 DDD 落地**最大的坑**：API 返回的是扁平的 DTO，而领域层需要的是带业务方法的聚合根。

### 序列化边界：Mapper 只属于 Infrastructure

```typescript
// infrastructure/mappers/TaskDtoMapper.ts
export class TaskDtoMapper {
    static toEntity(dto: TaskDto): Task {
        return new Task(
            dto.id,
            dto.title,
            dto.status as TaskStatus,
            new Date(dto.dueDate) // 字符串 → 值对象/Date
        )
    }
    static toDto(entity: Task): TaskDto {
        return {
            id: entity.id,
            title: entity.title,
            status: entity.status,
            dueDate: entity.dueDate.toISOString()
        }
    }
}
```

**数据流**：API DTO → `Mapper.toEntity()` → 聚合根 → 存入 Store → 组件展示；修改时 → `entity.complete()` → `Mapper.toDto()` → 提交 API。

### 响应式封装（Vue 特有）

`reactive` 可以包裹聚合根，但必须遵守两条纪律：

1. **只通过公开方法修改**：`task.complete()`，严禁在组件中 `task.status = 'done'`。业务不变量由实体方法校验。
2. **整体替换优于就地打洞**：在 Store 中更新时，用新聚合根实例替换旧实例（`updateTask(task)`），避免 `reactive` 代理深入到实体私有字段引发不可预期的联动。

### 红线速查

- [ ] DTO 类型是否只出现在 Infrastructure 层，**未泄漏到 Domain**？
- [ ] Store 持有的是聚合根实例，而非裸 DTO？
- [ ] 反序列化（字符串 → Date / 嵌套对象 → 值对象）是否收敛在 Mapper 中？

### 领域事件（轻量，可选）

前端领域事件用于**进程内解耦**：跨模块/跨组件通知（如任务完成后刷新统计面板），避免组件间直接调用对方 Store。与后端不同，前端事件**不需要持久化、不涉及最终一致性**。

```typescript
// domain/task/events/TaskCompletedEvent.ts —— 事件定义在 Domain，纯 TS
export class TaskCompletedEvent {
    constructor(public readonly taskId: string) {}
}

// application/task/usecases/CompleteTaskUseCase.ts —— 用例成功后发布
this.gateway.updateTask(task)
this.eventBus.publish(new TaskCompletedEvent(task.id))

// presentation-vue/composables/useTaskStats.ts —— 监听并刷新其他模块
eventBus.on(TaskCompletedEvent, (e) => statsStore.refresh(e.taskId))
```

**约定**：事件只携带 `id` 与必要数据（如 `taskId`），**不要携带整个聚合根**；事件总线用轻量实现即可（一个 20 行的 EventEmitter 或 `mitt`），无需引入重型消息库。

---

## 8. 测试策略

DDD 在前端最实在的收益就是**可测试性**：业务规则脱离 UI 框架后可以纯单测。

| 层               | 工具                             | 测试内容                                  |
| :--------------- | :------------------------------- | :---------------------------------------- |
| `domain`         | Vitest / Jest（纯单测）          | 实体方法业务规则、不变量校验、值对象运算  |
| `application`    | Vitest + mock 仓储/端口          | UseCase 编排顺序、端口调用参数、异常传播  |
| `infrastructure` | Vitest + MSW                     | Mapper 双向转换、HTTP 仓储请求/响应映射   |
| `presentation`   | Vue Test Utils / Testing Library | 组件渲染与交互（Store 注入真实/内存实现） |

```typescript
// domain/task/Task.entity.spec.ts —— 纯单测，无框架
describe('Task.complete', () => {
    it('逾期任务不允许直接完成', () => {
        const task = new Task('1', 't', TaskStatus.PENDING, new Date('2024-01-01'))
        expect(() => task.complete()).toThrow(DomainError)
    })

    it('正常任务可完成并改变状态', () => {
        const task = new Task('1', 't', TaskStatus.PENDING, new Date('2099-01-01'))
        task.complete()
        expect(task.status).toBe(TaskStatus.DONE)
    })
})
```

```typescript
// application/task/usecases/CompleteTaskUseCase.spec.ts
it('保存成功后通过端口通知 UI 更新', async () => {
    const repo = { findById: vi.fn().mockResolvedValue(task), save: vi.fn() }
    const gateway = { updateTask: vi.fn() }
    await new CompleteTaskUseCase(repo, gateway).execute('1')
    expect(repo.save).toHaveBeenCalled()
    expect(gateway.updateTask).toHaveBeenCalledWith(task)
})
```

---

## 9. 代码审查红线（框架无关 + 框架特定）

**通用红线（所有框架）**：

- [ ] `packages/domain/` 或 `src/core/` 中是否有 `import { ref } from 'vue'` 或 `import { useState } from 'react'`？（应为零）
- [ ] 实体类是否为**充血模型**（包含 `complete()`、`isOverdue()` 方法），而非贫血接口？
- [ ] 应用层 UseCase 是否只依赖仓储接口和端口，未直接引用 Pinia/Zustand 的 API？
- [ ] 页面组件（Views）是否仅做组装，不包含 `if (task.status === 'done')` 业务分支？
- [ ] DTO 类型是否未泄漏到 Domain 层（反序列化是否收敛在 Infrastructure 的 Mapper）？
- [ ] Store 是否持有聚合根实例（而非裸 DTO），更新是否通过实体公开方法？
- [ ] 组件文件逻辑（非模板）是否超过 200 行未抽离？应抽离为组件目录内的 `useXxx.ts`（见第 5 章「组件逻辑抽离规则」）。

**Vue 特定红线**：

- [ ] Pinia Store 是否严格区分为业务 Store（存聚合根）和 UI Store（存 loading）？
- [ ] Composable 是否作为依赖注入的唯一入口（`new UseCase(...)` 在此完成）？
- [ ] 是否避免了在组件中用 `watch` 监听路由变化并直接修改 Store（应通过 Composable 封装）？
- [ ] 是否避免了 `reactive` 包裹聚合根后直接在组件内改属性（必须调用实体方法）？

**React 特定红线**：

- [ ] Zustand/Jotai Store 是否仅存储领域状态，UI 状态是否用 `useState` 或独立 Slice 隔离？
- [ ] Custom Hook 是否作为依赖注入的唯一入口（`new UseCase(...)` 在此完成）？
- [ ] 是否避免了在 JSX 中直接调用 UseCase 方法（必须通过 Hook 暴露的方法触发）？

---

## 10. 常见误区澄清与框架选择

### 误区澄清

- **误区一**：DDD 的前端实现必须依赖特定状态库（如 Pinia 或 Redux）。
  **纠正**：状态库是 Presentation 层的**适配器**，而非核心。Domain 层根本不关心状态如何响应式更新，它只负责业务规则。

- **误区二**：React 的 Context 可以用来传递业务依赖（如 UseCase）。
  **纠正**：Context 适合传递主题、语言等**基础设施级**信息。业务依赖（UseCase、Repository）应在 Custom Hook 中显式组装，避免 Context 导致的性能陷阱和测试困难。

- **误区三**：Vue 的 `reactive` 可以直接包裹聚合根实例。
  **纠正**：可以包裹，但严禁在组件中直接修改聚合根内部属性（如 `task.status = 'done'`）。必须通过聚合根的公开方法（`task.complete()`）修改，以保障业务不变量。

- **误区四**：Vue 和 React 的 Presentation 层无法共享任何代码。
  **纠正**：领域组件虽然无法共享，但**领域组件的逻辑规格**（如 Props 定义、事件回调命名）可以抽象为 `presentation/shared/types.ts`，供两个框架的组件共同遵循，保证跨应用交互的一致性。

- **误区五**：前端 DDD 就是「把后端分层照搬过来」。
  **纠正**：前端没有数据库事务、不需要 CQRS/事件溯源。前端的重点是把业务规则从组件和 Store 中抽离到**可单测的纯类**里，并约束数据流方向。

- **误区六**：所有状态都应该放进 Store。
  **纠正**：`loading`、`keyword`、`selectedId` 等 UI 状态应留在组件局部或独立 UI Store；Store 只保存需要跨组件共享的**领域状态**。

- **误区七**：组件逻辑直接写在组件文件里没什么大不了。
  **纠正**：逻辑（非模板）超过 200 行的组件应抽离为组件目录内的 `useXxx.ts`，组件只留模板与装配（见第 5 章「组件逻辑抽离规则」）。抽离后逻辑可单测、可独立 Review，避免组件文件膨胀为难以维护的「上帝组件」。

### 框架选择决策速查

| 项目特征                                | 推荐框架               | 配套状态方案                                    |
| :-------------------------------------- | :--------------------- | :---------------------------------------------- |
| 团队熟悉 Vue 生态，中小型项目           | **Vue 3**              | Pinia（业务） + 组件内 `ref`（UI）              |
| 团队熟悉 React 生态，需要强类型和灵活性 | **React + TypeScript** | Zustand（业务） + `useState`/`useReducer`（UI） |
| 需要极高性能和细粒度渲染控制            | **React**              | Jotai（原子化状态）                             |
| 快速原型开发，需内置状态管理            | **Vue 3**              | Pinia（开箱即用）                               |

---

## 11. 迁移路径

### Level 1 → 2

1. 识别**限界上下文**，按领域拆分 `composables/`（如 `useTask.ts`、`useUser.ts`）。
2. 引入 **UseCase 层**：把「调用 API + 更新 Store」的编排逻辑从 Composable 中抽出到 `application/<domain>/usecases/`。
3. 将 Repository 接口从 `infrastructure` **抽取到 `domain/repositories/`**，实现依赖倒置。
4. 拆分业务 Store 与 UI Store，明确 Store 只存聚合根。

### Level 2 → 3

1. 评估是否同时支持 Vue 与 React（或多端），决定是否拆分 Monorepo。
2. 拆分 `packages/domain`、`packages/application`、`packages/infrastructure`、`packages/presentation-vue`、`packages/presentation-react`。
3. 引入**出站端口**（`ITaskStateGateway`），让 UseCase 与 Store 解耦。
4. 建立 `shared/core-utils` 与 `shared/ui-kit`，沉淀跨包复用代码。
5. 在 Infrastructure 层补齐 **DTO Mapper**，收敛所有序列化/反序列化逻辑。

---

## FAQ

**Q1：Composable/Hook 和 UseCase 的分工是什么？**
A：**UseCase** 是纯 TS 的领域编排（取数据、调实体方法、保存、通知），属于 Application 层，可脱离框架单测。**Composable/Hook** 是 UI 框架侧的组装器：实例化 UseCase、注入 Repository 与 Store，并把结果以响应式数据暴露给组件。

**Q2：数据从 API 进来后应该先变成聚合根吗？**
A：**是**。在 Infrastructure 层用 Mapper 把 DTO 转为聚合根，Store 中只保存聚合根。这样组件和 UseCase 面对的都是带业务方法的对象，业务规则不会散落在组件里。查询型（只读、无规则）接口可以例外，直接用只读 DTO 视图，不必强行建模。

**Q3：聚合根在 Pinia 里被 `reactive` 代理后，`private` 字段还有意义吗？**
A：代理不影响 TS 的访问控制语义，但会失去对内部字段的直接隐藏。务实做法：**不依赖 `private` 做运行时保护**，而是约定「只通过公开方法修改」并在 Code Review 中把关；复杂不变量尽量在实体方法内校验并抛出 `DomainError`。

**Q4：表单提交、分页加载这类异步流程要不要进 UseCase？**
A：**进**。异步请求状态机（`idle → loading → success/error`）属于用例编排，适合放在 UseCase 内部；但**请求中状态**（`loading` 布尔值）本身是 UI 状态，由 UI Store 承载。UseCase 只负责「执行并返回结果/抛错」，UI Store 负责「展示什么状态」。

**Q5：Next.js / Nuxt 的 SSR 下这套分层还适用吗？**
A：适用。分层不变，只需注意两点：① Repository 的实例化按「服务端/客户端」环境分流（如用 axios 实例切换 baseURL）；② 不要在模块顶层 `new` 依赖（SSR 多实例会串状态），所有组装都放在 Composable/Hook 或 `useNuxtApp()`/Provider 生命周期内完成。

**Q6：什么时候应该放弃 DDD 只写事务脚本？**
A：当业务规则只是简单 CRUD、无状态流转、无核心不变量时（典型的管理后台），用组件 + API 直调即可。DDD 的价值来自**核心域的业务规则**，对非核心域强行分层是过度设计。

**Q7：为什么组件逻辑的抽离阈值是 200 行？**
A：这是经验阈值而非硬性规范：超过 200 行逻辑的组件，状态来源与副作用已难以快速定位。抽离本身不改变架构分层，只是把逻辑从组件文件挪到 `useXxx.ts`，使其可单测、可复用。**低于阈值也鼓励抽离**（如表单校验、倒计时等纯逻辑），阈值是强制下限而非上限。