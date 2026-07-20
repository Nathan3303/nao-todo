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

### Five Layers (Bottom-Up)

| Layer | Responsibility | Example Directory |
|-------|----------------|-------------------|
| **Infrastructure** | Generic utilities, HTTP client, local storage | `packages/infrastructure/`, `src/shared/` |
| **Domain** | Pure business logic, entities, value objects, repository interfaces | `packages/domain/` |
| **Application** | Use cases, view objects, coordinators | `packages/application/` |
| **Presentation** | Domain-specific components, stores, hooks | `packages/presentation/`, `src/domains/` |
| **Views** | Page orchestration, routing | `src/views/`, `src/app/` |

**Dependency Direction**: Views → Presentation → Application → Domain → Infrastructure (one-way)

---

## Monorepo Structure (Level 3+)

For large projects with multiple applications (Web, Desktop, Mobile), use this monorepo structure:

```
project-root/
├── packages/                          # Shared packages
│   ├── domain/                        # Pure domain layer
│   │   ├── task/
│   │   │   ├── entities/              # Task, TaskComment
│   │   │   ├── valueobjects/          # CreateTask, UpdateTask
│   │   │   ├── repositories/          # Repository interfaces
│   │   │   └── services/              # Domain services
│   │   └── ...
│   │
│   ├── application/                   # Application layer
│   │   ├── task/
│   │   │   ├── usecases/              # TaskUseCase
│   │   │   └── viewobjects/           # TaskViewObject
│   │   └── ...
│   │
│   ├── presentation/                  # Domain presentation layer
│   │   ├── task/
│   │   │   ├── components/            # TaskCard, TaskEditor
│   │   │   ├── store/                 # useTaskStore
│   │   │   ├── composables/           # useTaskFilters
│   │   │   └── services/              # API calls
│   │   └── ...
│   │
│   ├── infrastructure/                # Infrastructure layer
│   │   └── repositories/               # Repository implementations
│   │
│   └── shared/                        # Shared utilities
│       ├── components/                 # Pure UI components (Button, Input)
│       ├── utils/                     # Utility functions
│       └── hooks/                     # Generic hooks (useDebounce)
│
└── apps/
    ├── web/                           # Web application
    │   └── src/
    │       ├── app/                   # Router, plugins
    │       ├── views/                 # Pages
    │       └── main.ts
    └── desktop/                       # Desktop application
        └── src/
            ├── app/
            ├── views/
            └── main.ts
```

### Package Dependencies

```
packages/domain/          # No external dependencies (pure TypeScript)
        ↑
packages/application/     # Depends on domain
        ↑
packages/presentation/    # Depends on domain + application + shared
        ↑
packages/shared/          # No external dependencies
        ↑
packages/infrastructure/  # Depends on domain
        ↑
apps/web/                 # Depends on presentation + shared
apps/desktop/             # Depends on presentation + shared
```

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
- Need to share components across multiple applications

---

## Level 3: Full DDD (Large Projects)

### Entry Criteria

- > 20k LOC
- 5+ developers
- Multiple domains (task, user, payment, etc.)
- Complex cross-domain workflows
- Multiple applications (Web, Desktop, Mobile)

### Full Structure (Monorepo)

```text
packages/
├── domain/                    # Pure domain layer
│   ├── task/
│   │   ├── entities/          # Task, TaskComment
│   │   ├── valueobjects/      # CreateTask, UpdateTask
│   │   ├── repositories/      # TaskRepository interface
│   │   └── services/          # TaskService (business rules)
│   └── user/
│       ├── entities/          # User, UserConfig
│       ├── valueobjects/      # UpdateNickname
│       ├── repositories/      # UserRepository interface
│       └── services/          # UserService
│
├── application/               # Application layer
│   ├── task/
│   │   ├── usecases/          # TaskUseCase
│   │   └── viewobjects/       # TaskViewObject, CreateTaskViewObject
│   └── user/
│       ├── usecases/          # UserUseCase
│       └── viewobjects/       # UserViewObject
│
├── presentation/              # Domain presentation layer
│   ├── task/
│   │   ├── components/        # TaskCard, TaskEditor, TaskList
│   │   ├── store/             # useTaskStore
│   │   ├── composables/       # useTaskFilters
│   │   └── services/          # taskApi
│   └── user/
│       ├── components/        # UserAvatar, UserInfo
│       ├── store/             # useUserStore
│       └── services/          # userApi
│
└── shared/                    # Shared utilities
    ├── components/            # Pure UI components
    ├── utils/                 # Utility functions
    └── hooks/                 # Generic hooks
```

### Domain Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `entities/` | Domain entities with identity and behavior |
| `valueobjects/` | Immutable value objects |
| `repositories/` | Repository interfaces (no implementation) |
| `services/` | Domain services (pure business logic) |

### Application Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `usecases/` | Application services that orchestrate domain operations |
| `viewobjects/` | DTOs for UI layer, convert domain entities to view models |

### Presentation Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `components/` | Domain-specific UI components |
| `store/` | Pinia stores (state + getters + actions) |
| `composables/` | Domain-specific composition logic |
| `services/` | API interactions (implementation of repository interfaces) |

### Dependency Rules

- ❌ Domains **cannot directly import** each other's store/types
- ✅ Presentation layer can depend on Domain + Application + Shared
- ✅ Application layer can depend on Domain
- ✅ Domain layer has **no external dependencies**
- ✅ Cross-domain communication via **events** or **application layer coordinator**

### Key Patterns

**Cross-Domain Communication via Events:**

```typescript
// shared/utils/eventBus.ts
export const eventBus = createEventBus<{
    'task:completed': Task
}>()

// presentation/task/store/useTaskStore.ts
const toggleTask = (taskId: string) => {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
        task.completed = !task.completed
        if (task.completed) eventBus.emit('task:completed', task)
    }
}

// presentation/user/store/useUserStore.ts
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
import { useTaskStore } from '@nao-todo/presentation/task/store'

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
import { TaskItem } from '@nao-todo/presentation/task/components'
import { useTaskStore } from '@nao-todo/presentation/task/store'

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

1. Create `packages/domain/` — extract pure entities, valueobjects, repositories, services
2. Create `packages/application/` — extract usecases, viewobjects
3. Create `packages/presentation/` — extract components, stores, hooks, services
4. Configure pnpm workspace and tsconfig path aliases
5. Update import paths across the codebase
6. Implement domain event system
7. Establish testing infrastructure

### Mixed Structure → Layered Structure

If you have a mixed structure where domain, application, and presentation code are all in one folder:

1. **Phase 1: Identify and extract pure domain code**
   - Move entities, valueobjects, repositories, services to `packages/domain/`
   - Ensure no frontend dependencies

2. **Phase 2: Extract application layer**
   - Move usecases, viewobjects to `packages/application/`
   - Update imports to depend on `@nao-todo/domain`

3. **Phase 3: Extract presentation layer**
   - Move components, stores, hooks, services to `packages/presentation/`
   - Update imports to depend on `@nao-todo/domain` and `@nao-todo/application`

4. **Phase 4: Clean up shared layer**
   - Move domain-specific components from `packages/shared/` to `packages/presentation/`
   - Ensure shared only contains pure UI components

---

## Quick Start Guide

### Creating a New Domain (Level 3+)

**Step 1: Create domain layer** (`packages/domain/<domain-name>/`)

```typescript
// packages/domain/task/entities/task.ts
export class Task {
    constructor(public id: string, public title: string, public completed: boolean = false) {}
    
    toggle() {
        this.completed = !this.completed
    }
}

// packages/domain/task/repositories/task.ts
export interface TaskRepository {
    findById(id: string): Promise<Task | null>
    findAll(): Promise<Task[]>
    save(task: Task): Promise<Task>
    delete(id: string): Promise<void>
}
```

**Step 2: Create application layer** (`packages/application/<domain-name>/`)

```typescript
// packages/application/task/usecases/task.ts
import { TaskRepository } from '@nao-todo/domain/task/repositories'
import { Task } from '@nao-todo/domain/task/entities'

export class TaskUseCase {
    constructor(private repo: TaskRepository) {}
    
    async create(title: string): Promise<Task> {
        if (!title.trim()) throw new Error('任务标题不能为空')
        const task = new Task(uuid(), title)
        return this.repo.save(task)
    }
}
```

**Step 3: Create presentation layer** (`packages/presentation/<domain-name>/`)

```typescript
// packages/presentation/task/store/useTaskStore.ts
import { defineStore } from 'pinia'
import { TaskUseCase } from '@nao-todo/application/task/usecases'
import { taskRepository } from '@nao-todo/infrastructure/repositories/task'

export const useTaskStore = defineStore('task', () => {
    const tasks = ref<Task[]>([])
    const useCase = new TaskUseCase(taskRepository)
    
    const loadTasks = async () => {
        tasks.value = await useCase.findAll()
    }
    
    const addTask = async (title: string) => {
        const task = await useCase.create(title)
        tasks.value.push(task)
    }
    
    return { tasks, loadTasks, addTask }
})
```

**Step 4: Create domain component** (`packages/presentation/<domain-name>/components/`)

```vue
<!-- packages/presentation/task/components/TaskCard.vue -->
<template>
    <div :class="{ completed: task.completed }">
        <input type="checkbox" :checked="task.completed" @change="$emit('toggle')" />
        <span>{{ task.title }}</span>
    </div>
</template>

<script setup lang="ts">
import type { Task } from '@nao-todo/domain/task/entities'

defineProps<{
    task: Task
}>()

defineEmits<{
    toggle: []
}>()
</script>
```

**Step 5: Use in application** (`apps/web/src/views/TaskPage.vue`)

```vue
<template>
    <TaskCard 
        v-for="task in taskStore.tasks" 
        :key="task.id" 
        :task="task" 
        @toggle="taskStore.toggleTask(task.id)" 
    />
</template>

<script setup lang="ts">
import { TaskCard } from '@nao-todo/presentation/task/components'
import { useTaskStore } from '@nao-todo/presentation/task/store'

const taskStore = useTaskStore()
taskStore.loadTasks()
</script>
```

### Component Ownership Decision

| Condition | Location |
|-----------|----------|
| Depends on domain types | `packages/presentation/<domain>/components/` |
| No business meaning | `packages/shared/components/` |
| Used by ≥2 domains | `packages/shared/components/` |
| Need to share across applications | `packages/presentation/<domain>/components/` |

### Forbidden Practices

- ❌ Direct state modification in components
- ❌ Domain imports in shared components
- ❌ Cross-domain store imports
- ❌ Business logic in page components
- ❌ Creating "common" technical stores
- ❌ Mixing domain models with frontend code in the same package
- ❌ Including domain-specific components in `packages/shared/`

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
- [ ] packages/domain/ has no frontend dependencies
- [ ] packages/presentation/ correctly depends on domain and application
- [ ] packages/shared/ contains only pure UI components

---

## Pinia Best Practices

- **按领域拆分 store**：每个领域拥有独立的 store，避免 `useCommonStore`
- **使用 Setup 语法**：`defineStore(id, () => { ... })`
- **分离 UI 状态与业务状态**：UI 状态使用组件 `ref` 或 `useUiStore`
- **避免"巨石 store"**：超过 500 行时抽离到 `composables` 或 `services`
- **Store 应依赖 UseCase**：通过 UseCase 操作领域模型，避免直接操作

---

## Extension Suggestions

- **Testing Strategy**: Unit tests for domain services with vitest, integration tests for use cases, component tests for presentation layer
- **Domain Events**: Use `mitt` or `EventEmitter` for pub/sub pattern
- **Micro-frontends**: Each sub-app can have its own `domains/` or share `packages/presentation/`
- **Type-safe APIs**: Use OpenAPI or Zod for type-safe API contracts

---

## Common FAQ

**Q1: 如果业务很简单，有必要采用 DDD 吗？**
A: 不必要。DDD 适合中大型项目。小项目可按功能目录划分，但保持逻辑内聚原则。

**Q2: Pinia store 是否就是领域模型？**
A: 不完全是。Pinia store 承载状态和行为，是领域模型的实现载体。复杂规则应放在 Domain Service 或 UseCase 中。

**Q3: 如何划分领域与子领域？**
A: 一个业务模块就是一个限界上下文。强关联的子模块可放在领域内的子目录，但不建议嵌套过深。

**Q4: 全局状态（主题、语言）放哪里？**
A: 放在 `packages/presentation/user/store/` 中，因为它是用户偏好的业务概念。

**Q5: 包含业务代码的组件如何在应用之间共享？**
A: 创建 `packages/presentation/` 包，专门存放领域表示层代码（components、stores、hooks），可被多个应用（Web、Desktop、Mobile）共享。

**Q6: packages/domain/ 和 packages/presentation/ 的区别是什么？**
A: packages/domain/ 是纯领域模型（无前端依赖），可被任何技术栈使用；packages/presentation/ 是领域的前端实现（依赖 Vue/Pinia），只能被 Vue 应用使用。