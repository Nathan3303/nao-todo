# 前端领域驱动设计（DDD）架构使用指南

## 1. 设计理念与目标

本架构将**后端领域驱动设计（DDD）** 的思想引入前端开发，旨在解决传统“按技术分层”导致的业务逻辑分散、代码重复、难以维护等问题。

**核心原则：**

- **按业务领域（Domain）组织代码**，而非按技术角色（components, views, api）。
- **高内聚、低耦合**：每个领域独立封装自己的 UI、状态、业务逻辑和类型。
- **业务逻辑集中管理**：所有业务规则和状态变更必须通过领域内部的 Store（或 Service）操作，严禁在页面/组件中直接修改状态。
- **单向依赖**：领域之间不直接相互引用，只能通过明确的 Service/事件进行通信。
- **页面（View）为薄层**：仅负责路由、布局和 UI 组装，不包含任何业务逻辑。

---

## 2. 项目目录结构

```text
src/
├── app/                              # 应用级配置（全局初始化、路由、全局 store 等）
│   ├── router/
│   ├── store/                        # 全局 store（如主题、语言，非业务状态）
│   └── App.vue
│
├── shared/                           # 真正的跨领域共享资源
│   ├── components/                   # 纯 UI 组件（Button, Input, Modal 等，无业务感知）
│   ├── composables/                  # 通用组合式函数（如 useDebounce, useLocalStorage）
│   ├── utils/                        # 工具函数（日期格式化、正则校验等）
│   ├── types/                        # 全局类型（如 API 响应结构）
│   └── constants/                    # 全局常量
│
├── domains/                          # 核心：按业务领域组织
│   ├── task/                         # 任务领域（示例）
│   │   ├── components/               # 领域专用组件（TaskCard, TaskDetailEditor）
│   │   ├── views/                    # 领域专用页面（可选，也可统一放在上层 views）
│   │   ├── store/                    # Pinia store（业务状态 + action）
│   │   ├── services/                 # API 调用、领域服务（如跨领域协作）
│   │   ├── types/                    # 领域类型定义（Task, List, Tag）
│   │   ├── composables/              # 领域内组合式函数（如 useTaskFilters）
│   │   └── utils/                    # 领域内工具（如任务排序算法）
│   │
│   ├── user/                         # 用户领域
│   │   ├── store/
│   │   ├── services/
│   │   └── types/
│   │
│   └── ...                           # 其他领域
│
├── views/                            # 全局页面层（薄层，组装领域组件）
│   ├── TaskPage.vue
│   └── SettingsPage.vue
│
├── main.ts
└── env.d.ts
```

---

## 3. 领域划分指南

### 3.1 如何识别一个领域（限界上下文）

- **以核心业务实体（名词）为中心**：例如“订单”、“用户”、“产品”往往是一个独立领域。
- **判断数据的归属**：如果一个数据实体主要围绕某个业务概念变化（如“收货地址”属于“用户”），则放入该领域。
- **考虑变化频率**：经常一起变更的功能应划入同一领域，减少跨域修改。
- **避免按页面划分**：页面是 UI 路由，不是领域边界。同一个领域的数据可能出现在多个页面（如任务列表和任务详情页）。

### 3.2 领域大小控制

- 一个领域通常包含 1~3 个核心实体（聚合根）。
- 如果领域过于庞大（如 `task` 包含几十个实体），应考虑拆分子领域（如 `task-management`, `task-collaboration`）。
- 如果领域太小（仅一个简单类型），可考虑合并到相关领域。

---

## 4. 核心实现模式

### 4.1 类型定义（`types/index.ts`）

- 定义该领域的所有实体（Entity）、值对象（Value Object）和 DTO。
- 使用 TypeScript 接口（`interface`）或类型别名（`type`）明确数据结构。
- **重要**：区分**实体**（有唯一标识 `id`，可变）和**值对象**（不可变，无独立标识）。

**示例（`domains/task/types/index.ts`）：**

```typescript
// 值对象（标签）
export type Tag = string

// 实体（任务）
export interface Task {
    id: string
    title: string
    description?: string
    completed: boolean
    dueDate?: Date
    tags: Tag[]
    listId: string // 所属清单 ID
    createdAt: number
}

// 聚合根（清单）
export interface List {
    id: string
    name: string
    taskIds: string[] // 维护任务顺序
}
```

### 4.2 业务 Store（`store/useXxxStore.ts`）

- **每个领域至少有一个 Store**，负责管理该领域的业务状态和业务逻辑。
- 使用 Pinia 的 `defineStore`（推荐 Setup 语法）。
- **所有状态变更必须通过 Action**，组件不得直接修改状态（如 `task.completed = true` 被禁止）。
- Action 中可包含业务规则校验、领域事件触发等。

**示例（`domains/task/store/useTaskStore.ts`）：**

```typescript
import { defineStore } from 'pinia'
import type { Task, List } from '../types'
import { fetchLists, saveTask } from '../services/taskApi'

export const useTaskStore = defineStore('task', () => {
    // State
    const lists = ref<List[]>([])
    const tasks = ref<Task[]>([])
    const currentListId = ref<string | null>(null)

    // Getters
    const currentTasks = computed(() => tasks.value.filter((t) => t.listId === currentListId.value))

    // Actions（业务逻辑）
    const loadData = async () => {
        const data = await fetchLists()
        lists.value = data.lists
        tasks.value = data.tasks
        currentListId.value = lists.value[0]?.id || null
    }

    const addTask = (title: string, listId: string, tags: Tag[] = []) => {
        // 业务校验
        if (!title.trim()) throw new Error('任务标题不能为空')
        const newTask: Task = {
            id: crypto.randomUUID(),
            title: title.trim(),
            completed: false,
            tags,
            listId,
            createdAt: Date.now()
        }
        tasks.value.push(newTask)
        // 更新聚合根
        const list = lists.value.find((l) => l.id === listId)
        if (list) list.taskIds.push(newTask.id)
    }

    const toggleTask = (taskId: string) => {
        const task = tasks.value.find((t) => t.id === taskId)
        if (task) {
            task.completed = !task.completed
            // 可触发事件：emit('task:toggled', task)
        }
    }

    const updateTask = (taskId: string, updates: Partial<Omit<Task, 'id'>>) => {
        const task = tasks.value.find((t) => t.id === taskId)
        if (!task) return
        // 业务校验：结束时间不能早于创建时间
        if (updates.dueDate && updates.dueDate < new Date(task.createdAt)) {
            throw new Error('结束时间不能早于创建时间')
        }
        Object.assign(task, updates)
    }

    return {
        lists,
        tasks,
        currentListId,
        currentTasks,
        loadData,
        addTask,
        toggleTask,
        updateTask
    }
})
```

### 4.3 领域服务（`services/`）

- 负责与外部通信（API 请求）、缓存、跨领域协调等。
- Store 调用 Service 获取数据，但不直接处理 HTTP 细节。
- 有利于测试和替换实现。

**示例（`domains/task/services/taskApi.ts`）：**

```typescript
import { http } from '@/shared/utils/http' // 封装好的 axios 实例
import type { List, Task } from '../types'

export const fetchLists = async () => {
    const res = await http.get<{ lists: List[]; tasks: Task[] }>('/api/lists')
    return res.data
}

export const saveTask = async (task: Task) => {
    await http.post('/api/tasks', task)
}
```

### 4.4 领域组件（`components/`）

- **容器型组件（Smart）**：从 Store 读取数据，处理交互事件，包含业务逻辑调用。
- **展示型组件（Dumb）**：仅接收 props，触发 emit，不直接依赖 Store。
- 推荐将复杂组件拆分为“展示 + 容器”组合。

**示例（`domains/task/components/TaskDetailEditor.vue`）：**

```vue
<template>
    <div v-if="localTask">
        <input v-model="localTask.title" placeholder="任务名称" />
        <textarea v-model="localTask.description" />
        <input type="datetime-local" v-model="localTask.dueDate" />
        <div>
            <span v-for="tag in localTask.tags" :key="tag">#{{ tag }}</span>
            <input v-model="newTag" @keyup.enter="addTag" placeholder="添加标签" />
        </div>
        <button @click="handleSave">保存</button>
        <button @click="emit('close')">取消</button>
    </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '../store/useTaskStore'
const props = defineProps<{ taskId: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const store = useTaskStore()
const localTask = ref(structuredClone(store.tasks.find((t) => t.id === props.taskId)))
const newTag = ref('')

const addTag = () => {
    if (newTag.value.trim() && localTask.value) {
        localTask.value.tags.push(newTag.value.trim())
        newTag.value = ''
    }
}

const handleSave = () => {
    try {
        store.updateTask(props.taskId, {
            title: localTask.value?.title,
            description: localTask.value?.description,
            dueDate: localTask.value?.dueDate,
            tags: localTask.value?.tags
        })
        emit('close')
    } catch (error) {
        alert(error.message)
    }
}
</script>
```

### 4.5 页面层（`views/`）

- 页面（路由对应的 Vue 文件）仅负责布局、路由参数解析、组合多个领域组件。
- **页面中不得包含业务逻辑**，所有操作通过调用 Store 的 Action 完成。
- 页面可以跨领域组合（如任务页面调用用户 Store 显示用户信息，但必须通过明确的 API，禁止直接引用其他领域的内部实现）。

**示例（`views/TaskPage.vue`）：**

```vue
<template>
    <div>
        <aside>
            <div v-for="list in taskStore.lists" :key="list.id" @click="selectList(list.id)">
                {{ list.name }}
            </div>
            <button @click="addNewList">新建清单</button>
        </aside>
        <main>
            <input v-model="newTaskTitle" placeholder="添加任务" @keyup.enter="handleAddTask" />
            <div v-for="task in taskStore.currentTasks" :key="task.id" class="task-item">
                <input
                    type="checkbox"
                    :checked="task.completed"
                    @change="taskStore.toggleTask(task.id)"
                />
                <span @click="openDetail(task.id)">{{ task.title }}</span>
                <span v-for="tag in task.tags" :key="tag">#{{ tag }}</span>
                <button @click="taskStore.moveTaskToList(task.id, targetListId)">移动</button>
            </div>
        </main>
        <TaskDetailEditor
            v-if="editingTaskId"
            :task-id="editingTaskId"
            @close="editingTaskId = null"
        />
    </div>
</template>

<script setup lang="ts">
import { useTaskStore } from '@/domains/task/store/useTaskStore'
import TaskDetailEditor from '@/domains/task/components/TaskDetailEditor.vue'

const taskStore = useTaskStore()
const newTaskTitle = ref('')
const editingTaskId = ref<string | null>(null)

const handleAddTask = () => {
    if (newTaskTitle.value.trim() && taskStore.currentListId) {
        taskStore.addTask(newTaskTitle.value, taskStore.currentListId)
        newTaskTitle.value = ''
    }
}

const selectList = (listId: string) => {
    taskStore.currentListId = listId
}

const openDetail = (id: string) => {
    editingTaskId.value = id
}

// 初始化
onMounted(() => {
    taskStore.loadData()
})
</script>
```

---

## 5. 组件归属决策：领域组件 vs 共享组件

| 判断维度     | 领域组件                    | 共享组件                                       |
| ------------ | --------------------------- | ---------------------------------------------- |
| **业务依赖** | 强依赖领域类型（如 `Task`） | 不依赖任何业务类型（仅接收 string, number 等） |
| **业务语义** | 包含“任务”“订单”等业务术语  | 无业务含义（如 Button, Input, DatePicker）     |
| **复用范围** | 仅在本领域或特定领域使用    | 任何领域都可能使用                             |
| **存放位置** | `domains/xxx/components/`   | `shared/components/`                           |

**原则**：宁可放在领域内，也不要过早放入共享层。只有当组件真正被至少两个领域复用，且不包含业务逻辑时，才迁移至 `shared`。

---

## 6. 跨领域通信与依赖规则

### 6.1 依赖方向（重要）

```text
shared ← domains ← app/views
```

- `shared` 不依赖任何领域。
- 领域之间**不直接相互导入**，避免紧耦合。
- 页面层可以组合多个领域的 Store，但不得直接访问其他领域的内部状态（如 `taskStore.userInfo` 不允许）。

### 6.2 跨领域协作方式

- **通过页面/应用层协调**：页面层同时调用多个领域的 Store Action 来完成跨域操作。
- **使用领域事件**：一个领域 Store 可以触发事件（如 `task:completed`），由全局事件总线或观察者模式通知其他领域。
- **通过服务层调用**：在 `services/` 中定义跨域 API，由 Store 调用。

**示例（跨域操作）**：当任务完成时，用户领域增加积分。在 `TaskPage.vue` 中：

```typescript
const handleToggle = (taskId: string) => {
    taskStore.toggleTask(taskId)
    // 假设任务已完成，增加用户积分
    if (taskStore.tasks.find((t) => t.id === taskId)?.completed) {
        userStore.increasePoints(10)
    }
}
```

---

## 7. 测试策略

- **单元测试**：针对 Store 和 Service 中的业务逻辑，使用 Vitest 或 Jest，模拟依赖。
- **组件测试**：使用 Vue Test Utils 对领域组件进行测试，验证交互和状态更新。
- **集成测试**：测试页面组合和跨域协作。

**示例（Store 单元测试）**：

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/domains/task/store/useTaskStore'

describe('task store', () => {
    beforeEach(() => setActivePinia(createPinia()))

    it('adds task correctly', () => {
        const store = useTaskStore()
        store.lists = [{ id: 'l1', name: 'Test', taskIds: [] }]
        store.addTask('New Task', 'l1')
        expect(store.tasks.length).toBe(1)
        expect(store.tasks[0].title).toBe('New Task')
        expect(store.lists[0].taskIds).toContain(store.tasks[0].id)
    })
})
```

---

## 8. 常见问题与 FAQ

**Q1：我的领域只有一个 Store，但包含大量 Action，如何组织？**
A：可以将 Action 按功能分组，使用 Composition 函数在 Store 内部组合，或拆分为多个 Composables，但仍通过同一个 Store 对外暴露。

**Q2：如何处理表单验证和临时状态？**
A：表单的临时输入状态放在组件内部（`ref`），提交时调用 Store Action 进行业务校验，不要将临时状态存入 Store。

**Q3：领域间的共享类型（如 `User` 被多个领域使用）放哪里？**
A：如果 `User` 是全局通用实体，可放在 `shared/types/`；但更推荐将 `User` 归为 `domains/user/types/`，其他领域通过 `import type` 引入（仅类型，不导入逻辑）。

**Q4：子组件需要调用 Store 怎么办？**
A：通过 props 传递需要的状态或事件处理函数，或直接在子组件中 `import` 相关 Store（对于领域内组件是允许的）。但避免深层嵌套传递，可使用 provide/inject。

**Q5：如何管理全局状态（如用户登录信息）？**
A：放在 `app/store/` 下（或单独领域 `user`），作为应用级状态，在页面层注入到领域组件。

**Q6：如果项目很小（几个页面），还需要这么复杂的结构吗？**
A：可采用简化版——使用 `pages/` 替代 `domains/`，但仍遵守“业务逻辑在 composables 或 service”的原则。一旦业务增长，可平滑迁移。

---

## 9. 开发规范与代码风格

1. **命名约定**：
    - 领域目录：使用 kebab-case（`task-management`）或 camelCase（`task`），保持一致即可。
    - Store：`useXxxStore`，文件名为 `useXxxStore.ts`。
    - Service：`xxxApi.ts` 或 `xxxService.ts`。
    - 组件：PascalCase（`TaskCard.vue`）。
    - 类型：接口不加 `I` 前缀，使用 PascalCase。

2. **导入规则**：
    - 领域内部导入：使用相对路径（`./store/useTaskStore`）。
    - 跨领域导入（仅类型）：`import type { User } from '@/domains/user/types'`。
    - 共享层导入：`@/shared/utils/...`。

3. **禁止事项**：
    - ❌ 在组件中直接修改 Store 的 state（除非通过 action）。
    - ❌ 在 `shared` 组件中引入任何 `domains` 的代码。
    - ❌ 跨领域直接 import 其他领域的 store 或 service。

---

## 10. 快速开始（新领域创建步骤）

1. 在 `src/domains/` 下新建领域目录（如 `payment`）。
2. 创建 `types/index.ts`，定义领域实体。
3. 创建 `store/usePaymentStore.ts`，实现业务状态和操作。
4. 创建 `services/paymentApi.ts`，定义 API 调用。
5. 根据需要创建 `components/`、`views/`、`composables/`。
6. 在页面层（`views/`）组合该领域与其他领域。
7. 编写单元测试（可选）。

---

## 11. 总结

本架构通过引入 DDD 思想，使得前端代码与业务领域对齐，显著提升了大型应用的可维护性和可扩展性。遵循本指南，团队可以在开发过程中始终保持对业务模型的清晰认知，降低变更成本，提高交付质量。

**核心要诀：**

- 业务逻辑在 Store，UI 在组件，页面做组装。
- 领域内聚，跨域解耦。
- 共享谨慎，测试先行。

如有其他实践问题，欢迎团队内部讨论完善。Happy coding! 🚀
