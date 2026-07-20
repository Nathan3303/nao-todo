import type { TaskViewObject, TaskProjectViewObject, TaskTagViewObject } from '@nao-todo/application/task/viewobjects'

// 任务详情面板视图对象
export type TaskDetailsViewObject = TaskViewObject & {
    id: TaskViewObject['id']
    projectName?: TaskProjectViewObject['name']
    tagList: TaskTagViewObject[]
    isDone: boolean
}

// 任务详情面板属性
export type TaskDetailsProps = {
    taskId?: TaskViewObject['id']
    // pomodoroCurrentTaskId: TaskViewObject['id'] | null
    // pomodoroTimerStatus: 'running' | 'paused'
    // pomodoroFocusStatus: 'idle' | 'running' | 'paused'
}

// 任务详情面板事件
export type TaskDetailsEmits = {
    (
        e: 'select-task-and-start-timer',
        taskId: TaskViewObject['id'],
        name: TaskViewObject['name']
    ): void
    (
        e: 'select-task-and-start-focus',
        taskId: TaskViewObject['id'],
        name: TaskViewObject['name']
    ): void
    (e: 'reset-timer'): void
    (e: 'reset-focus'): void
}
