# Level 1: Lightweight Patterns

## Composable-Based Business Logic

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