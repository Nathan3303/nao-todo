---
name: 'frontend-ddd'
description: 'Frontend Domain-Driven Design architecture guide based on Vue 3 + TypeScript + Pinia. Invoke when user wants to implement DDD, create new domains, or refactor project structure.'
---

# Frontend DDD Architecture Skill

## When Invoked

Follow this decision workflow:

1. **Assess project size** (lines of code, team size, feature count)
2. **Select appropriate DDD level** based on assessment
3. **Apply the minimal structure** for that level
4. **Provide code patterns** for the selected level
5. **Explain graduation criteria** for when to level up

---

## Architecture Overview

### Four Layers (Bottom-Up)

| Layer | Responsibility | Example Directory |
|-------|----------------|-------------------|
| **Infrastructure** | Generic utilities, HTTP client, local storage | `src/shared/` |
| **Domain** | Business logic, organized by bounded context | `src/domains/` |
| **Application** | Routing, global config, initialization | `src/app/`, `src/views/` |
| **Presentation** | UI rendering only, no business logic | `src/views/*.vue` |

**Dependency Direction**: Presentation → Application → Domain → Infrastructure (one-way)

---

## Level 1: Lightweight (Small Projects)

### Entry Criteria

- < 5k LOC
- 1-2 developers
- 5-10 pages/features
- Simple data flow (mostly API → UI)

### Minimal Structure

```text
src/
├── composables/          # Business logic in composables
│   └── useTask.ts
├── services/             # API calls
│   └── taskApi.ts
├── types/                # Shared types
│   └── task.ts
├── components/           # All components
├── views/                # Pages
└── main.ts
```

### Key Pattern: Composable-Based Business Logic

```typescript
export function useTask() {
    const tasks = ref<Task[]>([])
    
    const loadTasks = async () => {
        tasks.value = await fetchTasks()
    }
    
    const addTask = (title: string) => {
        if (!title.trim()) throw new Error('Title required')
        tasks.value.push({ id: uuid(), title, completed: false })
    }
    
    return { tasks, loadTasks, addTask }
}
```

### Graduation Signals

- Business logic scattered across components
- Duplicate API calls in multiple places
- Team grows beyond 2 developers
- Complex state management needed

---

## Level 2: Basic DDD (Medium Projects)

### Entry Criteria

- 5k-20k LOC
- 3-5 developers
- 10-30 features
- Multiple related entities (Task + List + Tag)

### Minimal Structure

```text
src/
├── domains/
│   └── task/
│       ├── types/
│       │   └── index.ts
│       ├── services/
│       │   └── taskApi.ts
│       └── store/
│           └── useTaskStore.ts
├── shared/
│   ├── components/       # Pure UI components
│   └── utils/
├── views/                # Pages assemble domain components
└── main.ts
```

### Domain Division Principles

1. **依据业务名词（限界上下文）**：围绕核心实体聚合操作
2. **识别聚合根（Aggregate Root）**：每个领域至少有一个聚合根
3. **考量变化频率与耦合度**：经常一起变更的逻辑放在同一领域
4. **明确价值**：核心域（核心竞争力）、支撑域（辅助）、通用域（可外包）

### Key Pattern: Pinia Store with Business Rules

```typescript
export const useTaskStore = defineStore('task', () => {
    const lists = ref<List[]>([])
    const tasks = ref<Task[]>([])
    const currentListId = ref<string | null>(null)
    
    const currentTasks = computed(() => 
        tasks.value.filter(t => t.listId === currentListId.value)
    )
    
    const addTask = (title: string, listId: string) => {
        if (!title.trim()) throw new Error('任务标题不能为空')
        const newTask = { id: uuid(), title, listId, completed: false }
        tasks.value.push(newTask)
        const list = lists.value.find(l => l.id === listId)
        if (list) list.taskIds.push(newTask.id)
    }
    
    return { lists, tasks, currentListId, currentTasks, addTask }
})
```

### Graduation Signals

- Multiple domains with cross-cutting concerns
- Need for explicit cross-domain communication
- Testing becomes critical
- Complex business rules spanning domains

---

## Level 3: Full DDD (Large Projects)

### Entry Criteria

- > 20k LOC
- 5+ developers
- Multiple domains (task, user, payment, etc.)
- Complex cross-domain workflows

### Full Structure

```text
src/
├── app/                          # Application layer
│   ├── router/                   # Routing configuration
│   ├── plugins/                  # Plugin registration
│   └── App.vue                   # Root component
│
├── shared/                       # Infrastructure layer
│   ├── components/               # Generic UI components
│   ├── composables/              # Global composables (useDebounce)
│   ├── utils/                    # Utility functions
│   ├── types/                    # Global types
│   └── http/                     # HTTP client wrapper
│
├── domains/                      # Domain layer
│   ├── task/                     # Task domain (core)
│   │   ├── types/                # Domain types
│   │   ├── services/             # Domain services/API
│   │   ├── store/                # Pinia store
│   │   ├── components/           # Domain-specific components
│   │   └── composables/          # Domain-specific composables
│   └── user/                     # User domain (supporting)
│       ├── types/
│       ├── services/
│       ├── store/
│       └── components/
│
└── views/                        # Presentation layer
    ├── TaskPage.vue
    └── SettingsPage.vue
```

### Domain Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `types/` | TypeScript interfaces, type aliases, enums |
| `services/` | API interactions, complex calculations |
| `store/` | State + getters + actions (all business logic here) |
| `components/` | Domain-specific UI components |
| `composables/` | Domain-specific composition logic |

### Dependency Rules

- ❌ Domains **cannot directly import** each other's store/types
- ✅ Domains can depend on `shared` layer
- ✅ Cross-domain communication via **events** or **application layer coordinator**

### Key Patterns

**Cross-Domain Communication via Events:**

```typescript
// shared/utils/eventBus.ts
export const eventBus = createEventBus<{
    'task:completed': Task
}>()

// domains/task/store/useTaskStore.ts
const toggleTask = (taskId: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
        task.completed = !task.completed
        if (task.completed) eventBus.emit('task:completed', task)
    }
}

// domains/user/store/useUserStore.ts
eventBus.on('task:completed', () => {
    userStore.increasePoints(10)
})
```

**Domain Component Pattern:**

```vue
<template>
    <input v-model="localTitle" @keyup.enter="handleAdd" />
</template>

<script setup lang="ts">
import { useTaskStore } from '../store/useTaskStore'

const store = useTaskStore()
const localTitle = ref('')

const handleAdd = () => {
    if (localTitle.value.trim() && store.currentListId) {
        store.addTask(localTitle.value, store.currentListId)
        localTitle.value = ''
    }
}
</script>
```

**Page Component Pattern (Thin Layer):**

```vue
<template>
    <aside>
        <div v-for="list in taskStore.lists" :key="list.id"
             @click="taskStore.currentListId = list.id">
            {{ list.name }}
        </div>
    </aside>
    <main>
        <input @keyup.enter="handleAdd" />
        <TaskItem v-for="task in taskStore.currentTasks" :key="task.id" :task="task" />
    </main>
</template>

<script setup lang="ts">
import { useTaskStore } from '@/domains/task/store/useTaskStore'
import TaskItem from '@/domains/task/components/TaskItem.vue'

const taskStore = useTaskStore()
taskStore.loadData()

const handleAdd = (e: Event) => {
    const input = e.target as HTMLInputElement
    if (input.value.trim() && taskStore.currentListId) {
        taskStore.addTask(input.value, taskStore.currentListId)
        input.value = ''
    }
}
</script>
```

### Graduation Signals

- Monorepo needed for independent domain deployment
- Microservices backend architecture
- Domain-driven frontend with separate deployments

---

## Migration Path

### Level 1 → Level 2

1. Identify core business entities and group related logic
2. Create `domains/` folder
3. Move types, composables, services into domain subfolders
4. Replace composables with Pinia stores

### Level 2 → Level 3

1. Create `shared/` folder for cross-domain utilities
2. Add `app/` folder for global configuration
3. Implement domain event system
4. Add domain-specific components
5. Establish testing infrastructure

---

## Quick Start Guide

### Creating a New Domain (Level 2+)

1. Create directory: `src/domains/<domain-name>/`
2. Create `types/index.ts` — define domain entities
3. Create `services/xxxApi.ts` — API communication
4. Create `store/useXxxStore.ts` — business state and actions
5. Create `components/` as needed
6. Create `composables/` as needed
7. Import and use in views

### Component Ownership Decision

| Condition | Location |
|-----------|----------|
| Depends on domain types | `domains/xxx/components/` |
| No business meaning | `shared/components/` |
| Used by ≥2 domains | `shared/components/` |

### Forbidden Practices

- ❌ Direct state modification in components
- ❌ Domain imports in shared components
- ❌ Cross-domain store imports
- ❌ Business logic in page components
- ❌ Creating "common" technical stores

---

## Architecture Checklist

For code review, verify:

- [ ] No domains are divided by page
- [ ] All business logic is in store actions, not components
- [ ] No cross-domain direct imports of stores
- [ ] No store exceeds 500 lines (consider splitting)
- [ ] Shared components are truly reusable across domains
- [ ] Page components only do orchestration, no business if/else
- [ ] Domain types are strictly defined with TypeScript

---

## Pinia Best Practices

- **按领域拆分 store**：每个领域拥有独立的 store，避免 `useCommonStore`
- **使用 Setup 语法**：`defineStore(id, () => { ... })`
- **分离 UI 状态与业务状态**：UI 状态使用组件 `ref` 或 `useUiStore`
- **避免"巨石 store"**：超过 500 行时抽离到 `composables` 或 `services`

---

## Extension Suggestions

- **Testing Strategy**: Unit tests for store actions with vitest, integration tests for pages
- **Domain Events**: Use `mitt` or `EventEmitter` for pub/sub pattern
- **Micro-frontends**: Each sub-app can have its own `domains/`

---

## Common FAQ

**Q1: 如果业务很简单，有必要采用 DDD 吗？**
A: 不必要。DDD 适合中大型项目。小项目可按功能目录划分，但保持逻辑内聚原则。

**Q2: Pinia store 是否就是领域模型？**
A: 不完全是。Pinia store 承载状态和行为，是领域模型的实现载体。复杂规则可抽离到 Service 类。

**Q3: 如何划分领域与子领域？**
A: 一个业务模块就是一个限界上下文。强关联的子模块可放在领域内的子目录，但不建议嵌套过深。

**Q4: 全局状态（主题、语言）放哪里？**
A: 放在 `domains/user` 的 store 中，因为它是用户偏好的业务概念。