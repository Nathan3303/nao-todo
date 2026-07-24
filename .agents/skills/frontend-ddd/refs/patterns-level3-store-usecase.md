# Level 3: Store & UseCase Implementation Patterns

## 1. Store Base Hook Pattern

Encapsulate `useMapperStoreBase<T>` to provide domain-specific naming and behavior.

```typescript
// packages/presentation/{domain}/hooks/use-{domain}-store-base.ts
import type { TaskViewObject } from '@nao-todo/application/{domain}/viewobjects'
import { useMapperStoreBase } from '@nao-todo/shared'

export const useTasksStoreBase = () => {
    const {
        list: tasks,
        setList: setTasks,
        patchItem: updateTask,
        addItem: addTask,
        getItem: getTask,
        removeItem: removeTask,
        addItems: addTasks
    } = useMapperStoreBase<TaskViewObject>()

    return { tasks, setTasks, updateTask, addTask, addTasks, getTask, removeTask }
}

export type TasksStoreBase = ReturnType<typeof useTasksStoreBase>
```

### With Domain-Specific Behavior

```typescript
// packages/presentation/{domain}/hooks/use-{domain}-record-store-base.ts
import type { PomodoroRecordViewObject } from '@nao-todo/application/{domain}/viewobjects'
import { useMapperStoreBase } from '@nao-todo/shared'

export const usePomodoroRecordStoreBase = () => {
    const {
        list: records,
        setList: setRecords,
        addItem: originalAddRecord,
        getItem: getRecord
    } = useMapperStoreBase<PomodoroRecordViewObject>()

    let onRecordCreated: ((record: PomodoroRecordViewObject) => void) | null = null

    const setOnRecordCreated = (cb: ((record: PomodoroRecordViewObject) => void) | null) => {
        onRecordCreated = cb
    }

    const addRecord = (record: PomodoroRecordViewObject) => {
        const exists = getRecord(record.id)
        originalAddRecord(record)
        if (!exists) {
            onRecordCreated?.(record)
        }
    }

    const addRecords = (newRecords: PomodoroRecordViewObject[]) => {
        newRecords.forEach((record) => addRecord(record))
    }

    return { records, setRecords, addRecord, getRecord, addRecords, setOnRecordCreated }
}
```

## 2. Thin Store Pattern

Pinia store should be a thin wrapper around store base hook.

```typescript
// packages/presentation/{domain}/stores/{domain}-store.ts
import { defineStore } from 'pinia'
import { useTasksStoreBase } from '../hooks'

export const useTasksStore = defineStore('TasksStore', () => {
    const { tasks, setTasks, updateTask, addTask, addTasks, getTask, removeTask } =
        useTasksStoreBase()

    return {
        tasks,
        setTasks,
        updateTask,
        addTask,
        addTasks,
        getTask,
        removeTask
    }
})
```

## 3. Store Responsibility Separation

Separate data store from session/UI state store.

```typescript
// Data store: manages records collection
export const usePomodoroRecordsStore = defineStore('PomodoroRecordsStore', () => {
    const { records, addRecord, addRecords, getRecord, setOnRecordCreated } = usePomodoroRecordStoreBase()
    return { records, addRecord, addRecords, getRecord, setOnRecordCreated }
})

// Session store: manages current session and settings
export const usePomodoroSessionStore = defineStore('PomodoroSessionStore', () => {
    const currentTaskId = ref<string | null>(null)
    const currentTaskName = ref('')
    const focusDuration = ref(25 * 60)
    // ... settings management
    return { currentTaskId, currentTaskName, focusDuration, ... }
})
```

## 4. Store Interface in Application Layer

Define store interfaces in `viewobjects.ts` to decouple UseCase from Presentation.

```typescript
// packages/application/{domain}/viewobjects.ts
export type TaskStore = {
    tasks: Map<string, TaskViewObject>
    setTasks: (tasks: TaskViewObject[]) => void
    updateTask: (id: string, update: Partial<TaskViewObject>) => void
    addTask: (task: TaskViewObject) => void
    addTasks: (tasks: TaskViewObject[]) => void
    getTask: (id: string) => TaskViewObject | undefined
    removeTask: (id: string) => void
}

export type PomodoroRecordStore = {
    records: Map<string, PomodoroRecordViewObject>
    addRecord: (record: PomodoroRecordViewObject) => void
    addRecords: (records: PomodoroRecordViewObject[]) => void
    getRecord: (id: string) => PomodoroRecordViewObject | undefined
}
```

## 5. Usecase Factory Function

Create usecase instances in application layer hooks, injecting store implementations.

```typescript
// apps/{app}/src/hooks/usecases/use-{domain}-usecase.ts
import { TaskDomain } from '@nao-todo/domain/task'
import { TaskUseCase } from '@nao-todo/application/task/usecases'
import type { TaskStore } from '@nao-todo/application/task/viewobjects'
import { TaskRepoImpl } from '@nao-todo/infrastructure/backend'
import { getRequesterImpl } from '@nao-todo/shared'

export const useTaskUseCase = (store: TaskStore) => {
    const requester = getRequesterImpl()
    const taskRepo = new TaskRepoImpl(requester)
    const taskDomain = new TaskDomain(taskRepo)
    return new TaskUseCase(taskDomain, taskRepo, store)
}
```

## 6. Callback Injection Pattern

For stores that need to trigger usecase operations, expose setter functions instead of direct imports.

```typescript
// packages/presentation/{domain}/stores/{domain}-timer-store.ts
export const usePomodoroTimerStore = defineStore('PomodoroTimerStore', () => {
    // ... timer state and logic

    let createRecordFn: ((record: CreatePomodoroRecordViewObject) => GoAsync<PomodoroRecordViewObject[]>) | null = null

    const setCreateRecordFn = (fn: ((record: CreatePomodoroRecordViewObject) => GoAsync<PomodoroRecordViewObject[]>) | null) => {
        createRecordFn = fn
    }

    const handlePhaseComplete = () => {
        // ...
        if (createRecordFn) {
            createRecordFn(record).then(([, err]) => {
                if (err !== null) console.error('Failed to create record:', err)
            })
        }
    }

    return { ..., setCreateRecordFn }
})
```

### Register callback in UI layer

```typescript
// apps/{app}/src/components/{domain}/use-{domain}-page.ts
const pomodoroRecordUseCase = usePomodoroRecordUseCase(recordsStore)

timerStore.setCreateRecordFn(async (record) => {
    const [result, err] = await pomodoroRecordUseCase.createRecord(record)
    if (err !== null) return [null, err]
    sessionStore.setNoteText('')
    return [[result], null]
})
```