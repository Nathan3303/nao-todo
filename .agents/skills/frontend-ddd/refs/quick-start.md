# Quick Start: Creating a New Domain

## Step 1: Create domain layer

```typescript
// packages/domain/task/entities/task.ts
export class Task {
    constructor(
        public id: string,
        public title: string,
        public completed: boolean = false
    ) {}

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

## Step 2: Create application layer

```typescript
// packages/application/task/usecases/task.ts
import { TaskRepository } from '@nao-todo/domain/task/repositories'
import { Task } from '@nao-todo/domain/task/entities'

export class TaskUseCase {
    constructor(private repo: TaskRepository) {}

    async create(title: string): Promise<Task> {
        if (!title.trim()) throw new Error('Task title cannot be empty')
        const task = new Task(uuid(), title)
        return this.repo.save(task)
    }
}
```

## Step 3: Create presentation layer

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

## Step 4: Create domain component

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

## Step 5: Use in application

```vue
<!-- apps/web/src/views/TaskPage.vue -->
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