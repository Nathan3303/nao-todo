---
name: 'frontend-ddd'
description: 'Progressive Frontend DDD architecture guide with actionable workflow. Invoke when user wants to implement DDD, create new domains, or refactor project structure.'
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
// composables/useTask.ts
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
│       ├── store/
│       │   └── useTaskStore.ts
│       └── services/
│           └── taskApi.ts
├── shared/
│   ├── components/       # Pure UI components
│   └── utils/
├── views/                # Pages assemble domain components
└── main.ts
```

### Key Pattern: Pinia Store with Business Rules

```typescript
// domains/task/store/useTaskStore.ts
export const useTaskStore = defineStore('task', () => {
    const tasks = ref<Task[]>([])

    const addTask = (title: string, listId: string) => {
        if (!title.trim()) throw new Error('任务标题不能为空')
        tasks.value.push({ id: uuid(), title, listId, completed: false })
    }

    return { tasks, addTask }
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
├── app/
│   ├── router/
│   └── store/            # Global state (theme, language)
├── shared/
│   ├── components/       # Pure UI components
│   ├── composables/      # useDebounce, useLocalStorage
│   ├── utils/
│   └── types/            # Global types
├── domains/
│   ├── task/
│   │   ├── components/   # TaskCard, TaskEditor
│   │   ├── store/
│   │   ├── services/
│   │   ├── types/
│   │   ├── composables/  # Domain-specific composables
│   │   └── utils/        # Domain-specific utils
│   └── user/
│       ├── store/
│       ├── services/
│       └── types/
├── views/                # Thin pages, only routing/layout
└── main.ts
```

### Key Patterns

**Cross-Domain Communication via Events:**

```typescript
// shared/utils/eventBus.ts
export const eventBus = createEventBus<{
    'task:completed': Task
}>()

// domains/task/store/useTaskStore.ts
const toggleTask = (taskId: string) => {
    const task = tasks.value.find((t) => t.id === taskId)
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
    if (localTitle.value.trim()) {
        store.addTask(localTitle.value, store.currentListId!)
        localTitle.value = ''
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
3. Create `store/useXxxStore.ts` — business state and actions
4. Create `services/xxxApi.ts` — API communication
5. Create components as needed
6. Import and use in views

### Component Ownership Decision

| 条件               | 位置                      |
| ------------------ | ------------------------- |
| 依赖领域类型       | `domains/xxx/components/` |
| 无业务含义         | `shared/components/`      |
| Used by ≥2 domains | `shared/components/`      |

### Forbidden Practices

- ❌ Direct state modification in components
- ❌ Domain imports in shared components
- ❌ Cross-domain store imports

---

## Common FAQ

**Q1: 我的领域只有一个 Store，但包含大量 Action？**
A: 使用 Composition 函数在 Store 内部按功能分组。

**Q2: 表单验证和临时状态如何处理？**
A: 临时状态放在组件内部，提交时调用 Store Action。

**Q3: 领域间的共享类型放哪里？**
A: 归为对应领域，其他领域通过 `import type` 引入。

**Q4: 子组件需要调用 Store？**
A: 通过 props 传递，或直接 import（领域内允许），或使用 provide/inject。
