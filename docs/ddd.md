# 前端领域驱动设计（DDD）架构实践指南

## 基于 Vue 3 + TypeScript + Pinia

---

### 1. 背景与目标

在后端开发中，领域驱动设计（Domain-Driven Design，DDD）通过**业务领域**而非**技术分层**来组织代码，有效解决了复杂业务逻辑的维护难题。前端应用同样面临业务逻辑日益复杂、多团队协作困难等问题。本指南旨在将 DDD 核心思想引入前端（特别是 Vue 3 生态），提供一套可落地的架构方案，达成以下目标：

- **业务内聚**：同一业务域的代码集中管理，降低认知负担。
- **清晰边界**：通过限界上下文隔离不同业务，避免耦合。
- **可测试性**：业务逻辑与 UI 解耦，易于单元测试。
- **可持续演进**：新需求可隔离在特定领域内，不影响全局。

---

### 2. 整体架构分层

本架构将代码分为四个层次（自底向上）：

| 层次                            | 职责                                                                   | 示例目录                 |
| ------------------------------- | ---------------------------------------------------------------------- | ------------------------ |
| **基础设施层 (Infrastructure)** | 提供通用工具、HTTP 客户端、本地存储等，与业务无关                      | `src/shared/`            |
| **领域层 (Domain)**             | 包含所有业务逻辑，按业务领域划分，每个领域内包含状态、服务、类型定义等 | `src/domains/`           |
| **应用层 (Application)**        | 负责页面路由、全局配置、应用初始化，协调领域层完成用户交互             | `src/app/`、`src/views/` |
| **展示层 (Presentation)**       | 仅负责 UI 渲染，不包含业务判断，从领域层获取数据并触发 action          | `src/views/*.vue`        |

**依赖方向**：展示层 → 应用层 → 领域层 → 基础设施层（单向依赖，上层可依赖下层，反之不可）。

---

### 3. 项目目录结构

```
src/
├── app/                          # 应用层：全局配置、初始化
│   ├── router/                   # 路由配置
│   ├── plugins/                  # 插件注册（如 Pinia、国际化）
│   └── App.vue                   # 根组件
│
├── shared/                       # 基础设施层：真正跨领域复用的代码
│   ├── components/               # 通用 UI 组件（按钮、输入框、模态框）
│   ├── composables/              # 全局组合式函数（如 useDebounce）
│   ├── utils/                    # 工具函数（日期格式化、校验）
│   ├── types/                    # 全局类型定义（如 API 响应结构）
│   └── http/                     # 封装 axios 等请求库
│
├── domains/                      # 领域层：按业务能力划分
│   ├── task/                     # 任务领域（核心域）
│   │   ├── types/                # 领域类型（Task, List, Tag 等）
│   │   ├── services/             # 领域服务（API 调用、复杂计算）
│   │   ├── store/                # Pinia store（状态 + 业务逻辑）
│   │   ├── components/           # 领域专用 UI 组件（仅该领域使用）
│   │   └── composables/          # 领域专用组合函数（如 useTaskFilters）
│   ├── user/                     # 用户领域（支撑域）
│   │   ├── types/
│   │   ├── services/
│   │   ├── store/
│   │   └── components/
│   └── ...                       # 其他领域（订单、商品等）
│
└── views/                        # 展示层：页面级组件，负责组装领域模块
    ├── TaskPage.vue              # 任务管理页面
    └── SettingsPage.vue          # 用户设置页面
```

> **说明**：`domains/` 下的每个子目录代表一个独立的**限界上下文**（Bounded Context），内部高内聚，外部通过明确的接口（如 store 的公共方法）通信。`views/` 中的页面组件是**薄层**，不包含业务逻辑，仅负责路由匹配和 UI 编排。

---

### 4. 领域划分原则（如何划分领域）

**严禁按页面划分领域**。页面是 UI 路由，领域是业务能力，二者没有必然对应关系。正确做法是：

1. **依据业务名词（限界上下文）**
   围绕核心实体（名词）聚合操作。例如：“订单”涉及创建、支付、取消，“商品”涉及上架、库存、搜索。

2. **识别聚合根（Aggregate Root）**
   每个领域至少有一个聚合根，作为访问内部实体的唯一入口。例如在任务领域，“清单 (List)” 是聚合根，所有对“任务 (Task)”的操作必须通过清单。

3. **考量变化频率与耦合度**
   经常一起变更的逻辑应放在同一领域。如果修改“折扣”必然影响“价格计算”，则它们同属订单或促销领域。

4. **明确价值（核心/支撑/通用）**
    - **核心域**：公司核心竞争力，投入最多资源（如任务管理）。
    - **支撑域**：辅助核心域（如用户偏好设置）。
    - **通用域**：可外包或使用现成方案（如身份认证，可单独拆分为 `auth` 领域）。

**示例**：

- 任务管理（核心）→ `domains/task`
- 用户设置（支撑）→ `domains/user`
- 不要将“清单”单独作为领域，因为它是任务的聚合根，天然属于任务领域。

---

### 5. 各模块职责与协作

#### 5.1 领域层 (`domains/*`)

- **`types/`**：定义该领域的 TypeScript 接口、类型别名、枚举等，确保类型安全。
- **`services/`**：封装与后端 API 的交互，或执行复杂领域计算（如根据规则生成任务优先级）。通常返回 `Promise`，供 store 调用。
- **`store/`**：使用 Pinia 定义 store，包含状态（`state`）、派生状态（`getters`）和业务操作（`actions`）。**所有业务逻辑必须放在 action 中**，不能泄露到组件。
- **`components/`**：仅在该领域内部复用的 UI 组件（如任务卡片、清单下拉菜单）。若组件可被多个领域复用，应提升至 `shared/components`。
- **`composables/`**：抽取可复用的组合逻辑（如监听任务列表变化并自动保存），仅在该领域内使用。

**依赖规则**：

- 领域之间**禁止直接引用**对方的内部实现（如 store、types）。必须通过明确的**服务接口**或**事件总线**通信。
- 领域可以依赖 `shared` 层。

#### 5.2 展示层 (`views/`)

- 每个页面组件（`.vue`）只负责：
    1. 从对应领域 store 中获取数据。
    2. 将用户操作（点击、输入）映射为 store action 调用。
    3. 传递数据给子组件（领域组件或共享组件）进行渲染。
- **严禁在页面组件中出现 `if (xxx) { ... }` 之类的业务判断**，应全部下沉到 store 或 service 中。

#### 5.3 应用层 (`app/`)

- 路由配置（`router`）只需定义页面路径与 `views/*.vue` 的映射，不涉及业务。
- 全局状态（如主题、语言）应放在 `domains/user` 的 store 中，而非 `app/` 下，因为它是用户偏好的业务概念。

---

### 6. 状态管理（Pinia）最佳实践

- **按领域拆分 store**：每个领域拥有独立的 store，例如 `useTaskStore`、`useUserStore`。避免创建 `useCommonStore` 这种技术性 store。
- **使用 Setup 语法**：推荐使用 `defineStore(id, () => { ... })` 的组合式 API，更贴合 Vue 3 组合式函数风格，方便逻辑复用。
- **分离 UI 状态与业务状态**：纯 UI 状态（如侧边栏展开、弹窗可见）应使用组件自身的 `ref` 或单独的非领域 store（如 `useUiStore`），避免污染业务 store。
- **避免“巨石 store”**：单个 store 超过 500 行代码时，考虑将内部逻辑抽离到 `composables` 或 `services` 中，保持 action 简洁。

示例 store 模板（以任务领域为例）：

```typescript
// domains/task/store/useTaskStore.ts
import { defineStore } from 'pinia'
import type { List, Task } from '../types'
import { fetchLists, saveTask } from '../services/taskApi'

export const useTaskStore = defineStore('task', () => {
    // 状态
    const lists = ref<List[]>([])
    const tasks = ref<Task[]>([])
    const currentListId = ref<string | null>(null)

    // 派生
    const currentTasks = computed(() => tasks.value.filter((t) => t.listId === currentListId.value))

    // 业务操作
    const loadData = async () => {
        /* ... */
    }
    const addTask = (title: string, listId: string) => {
        /* ... */
    }
    const toggleTask = (taskId: string) => {
        /* ... */
    }

    return { lists, tasks, currentListId, currentTasks, loadData, addTask, toggleTask }
})
```

---

### 7. 详细示例：Todo List 应用

#### 7.1 领域模型

- **聚合根**：`List`（清单），包含 `id`、`name`、`taskIds`（有序列表）。
- **实体**：`Task`（任务），包含 `id`、`title`、`completed`、`tags`、`listId`。
- **值对象**：`Tag`（标签），使用字符串表示，无独立标识。

#### 7.2 目录与文件

```
domains/task/
├── types/index.ts           # 定义 Task, List, Tag
├── services/taskApi.ts      # 模拟 API：fetchLists, addTask, deleteTask
├── store/useTaskStore.ts    # 核心业务逻辑
└── components/              # 内部组件（如 TaskItem, ListSelector）

domains/user/
├── types/index.ts           # UserSettings
├── services/userApi.ts
└── store/useUserStore.ts    # 主题、语言偏好

views/
├── TaskPage.vue             # 任务管理页面（组装任务领域）
└── SettingsPage.vue         # 设置页面（组装用户领域）
```

#### 7.3 核心代码片段

**类型定义 (`domains/task/types/index.ts`)**：

```typescript
export type Tag = string

export interface Task {
    id: string
    title: string
    completed: boolean
    tags: Tag[]
    listId: string
    createdAt: number
}

export interface List {
    id: string
    name: string
    taskIds: string[] // 有序任务 ID 列表
}
```

**任务 Store (`domains/task/store/useTaskStore.ts`)**：

```typescript
import { defineStore } from 'pinia'
import { fetchLists, addTaskApi, deleteTaskApi, updateTaskApi } from '../services/taskApi'
import type { List, Task, Tag } from '../types'

export const useTaskStore = defineStore('task', () => {
    const lists = ref<List[]>([])
    const tasks = ref<Task[]>([])
    const currentListId = ref<string | null>(null)

    const currentTasks = computed(() => tasks.value.filter((t) => t.listId === currentListId.value))

    const loadData = async () => {
        const data = await fetchLists()
        lists.value = data.lists
        tasks.value = data.tasks
        if (lists.value.length) currentListId.value = lists.value[0].id
    }

    const addTask = (title: string, listId: string, tags: Tag[] = []) => {
        const newTask: Task = {
            id: crypto.randomUUID(),
            title,
            completed: false,
            tags,
            listId,
            createdAt: Date.now()
        }
        tasks.value.push(newTask)
        const list = lists.value.find((l) => l.id === listId)
        if (list) list.taskIds.push(newTask.id)
        // 可选：调用 API 持久化
        addTaskApi(newTask)
    }

    const toggleTask = (taskId: string) => {
        const task = tasks.value.find((t) => t.id === taskId)
        if (task) {
            task.completed = !task.completed
            updateTaskApi(task)
            // 可以触发领域事件，如 taskCompleted
        }
    }

    const moveTaskToList = (taskId: string, targetListId: string) => {
        const task = tasks.value.find((t) => t.id === taskId)
        if (!task) return
        const oldList = lists.value.find((l) => l.id === task.listId)
        if (oldList) oldList.taskIds = oldList.taskIds.filter((id) => id !== taskId)
        const newList = lists.value.find((l) => l.id === targetListId)
        if (newList) newList.taskIds.push(taskId)
        task.listId = targetListId
        updateTaskApi(task)
    }

    return {
        lists,
        tasks,
        currentListId,
        currentTasks,
        loadData,
        addTask,
        toggleTask,
        moveTaskToList
    }
})
```

**页面组件 (`views/TaskPage.vue`)**：

```vue
<template>
    <div class="task-page">
        <aside class="list-sidebar">
            <div
                v-for="list in taskStore.lists"
                :key="list.id"
                :class="{ active: list.id === taskStore.currentListId }"
                @click="taskStore.currentListId = list.id"
            >
                {{ list.name }} ({{ taskStore.tasks.filter((t) => t.listId === list.id).length }})
            </div>
            <button @click="createNewList">新建清单</button>
        </aside>

        <main class="task-main">
            <input placeholder="新增任务" @keyup.enter="handleAddTask" />
            <TaskItem
                v-for="task in taskStore.currentTasks"
                :key="task.id"
                :task="task"
                @toggle="taskStore.toggleTask"
                @move="taskStore.moveTaskToList"
            />
        </main>
    </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '@/domains/task/store/useTaskStore'
import TaskItem from '@/domains/task/components/TaskItem.vue' // 内部组件

const taskStore = useTaskStore()
taskStore.loadData()

const handleAddTask = (e: Event) => {
    const input = e.target as HTMLInputElement
    if (input.value.trim() && taskStore.currentListId) {
        taskStore.addTask(input.value, taskStore.currentListId)
        input.value = ''
    }
}

const createNewList = () => {
    // 通过 store 的方法创建新清单（略）
}
</script>
```

#### 7.4 跨领域通信

若任务完成时需要增加用户积分（积分属于 `user` 领域），**不应**在任务 store 中直接调用 `useUserStore`，而应通过**事件**或**服务**解耦：

- 方式一（推荐）：在 `task` 领域内定义事件总线，用户领域监听事件。
- 方式二：在 `app/` 层编写一个协调器（如 `TaskCompletionHandler`），同时引入两个 store，在页面组件中调用。

核心原则：**领域之间保持隔离，通过应用层或事件机制协调**。

---

### 8. 架构约束与检查清单

为确保团队遵守架构，建议在代码评审时核对：

- [ ] 是否按页面划分了领域？（应整改）
- [ ] 业务逻辑是否全部在 store action 中，而非组件内？
- [ ] 是否存在跨领域直接 import 另一个领域 store 的情况？（禁止）
- [ ] 某个 store 是否超过 500 行？若是，考虑拆分。
- [ ] `shared/` 下的组件是否真正被多个领域复用？
- [ ] 页面组件是否只做编排，无 `if/else` 业务分支？
- [ ] 是否使用 TypeScript 严格定义了领域类型？

---

### 9. 扩展建议

- **测试策略**：针对 store action 编写单元测试（使用 `vitest`），模拟 API 服务，验证业务逻辑的正确性。页面组件可使用 `@testing-library/vue` 进行集成测试。
- **领域事件**：对于复杂场景，可引入 `mitt` 或 `EventEmitter` 实现领域事件发布订阅，进一步增强解耦。
- **微前端适配**：若采用微前端架构，每个子应用可拥有自己的 `domains/`，并通过共享依赖（如 `shared`）保持一致性。

---

### 10. 常见问题 FAQ

**Q1：如果业务很简单（几个页面），有必要采用 DDD 吗？**
A：不必要。DDD 适合中大型项目或长期演进的产品。小项目可按功能目录划分，但建议保持“逻辑内聚”的原则，为未来扩展留有余地。

**Q2：Pinia store 是否就是 DDD 中的“领域模型”？**
A：不完全是。领域模型包含行为、规则、事件，Pinia store 承载了状态和行为，是领域模型的一种实现载体。但复杂的规则可以进一步抽离到独立的 Service 类中。

**Q3：如何划分“领域”与“子领域”？**
A：通常一个业务模块（如订单、用户）就是一个限界上下文，作为一个顶层领域。若内部有强关联的子模块（如订单下的退款、评价），可放在该领域内的子目录（如 `domains/order/refund/`），但一般不建议嵌套过深。

---

### 11. 总结

本架构融合了领域驱动设计的思想与 Vue 3 技术栈，通过**按业务领域组织代码**、**明确分层职责**、**严格控制依赖**，使前端代码具备更好的可维护性和可扩展性。团队应结合自身业务，灵活调整细节，但核心原则不变：**业务逻辑收拢到领域，UI 保持薄层，领域之间松耦合**。

---

_文档版本：1.0_
_更新日期：2026-07-19_

