# Level 2: Basic DDD Patterns

## Pinia Store with Business Rules

```typescript
export const useTaskStore = defineStore('task', () => {
    const lists = ref<List[]>([])
    const tasks = ref<Task[]>([])
    const currentListId = ref<string | null>(null)

    const currentTasks = computed(() => tasks.value.filter((t) => t.listId === currentListId.value))

    const addTask = (title: string, listId: string) => {
        if (!title.trim()) throw new Error('Task title cannot be empty')
        const newTask = { id: uuid(), title, listId, completed: false }
        tasks.value.push(newTask)
        const list = lists.value.find((l) => l.id === listId)
        if (list) list.taskIds.push(newTask.id)
    }

    return { lists, tasks, currentListId, currentTasks, addTask }
})
```