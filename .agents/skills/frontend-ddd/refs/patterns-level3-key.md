# Level 3: Key Patterns

## Cross-Domain Communication via Events

```typescript
// shared/utils/eventBus.ts
export const eventBus = createEventBus<{
    'task:completed': Task
}>()

// presentation/task/store/useTaskStore.ts
const toggleTask = (taskId: string) => {
    const task = tasks.value.find((t) => t.id === taskId)
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

## Domain Component Pattern

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

## Page Component Pattern (Thin Layer)

```vue
<template>
    <aside>
        <div
            v-for="list in taskStore.lists"
            :key="list.id"
            @click="taskStore.currentListId = list.id"
        >
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