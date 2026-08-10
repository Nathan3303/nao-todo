import type { TaskUseCase } from '@nao-todo/domain-task'
import type { GetTasksOptions } from '@nao-todo/shared'

// 重新安排任务面板属性
export type TaskReschedulePanelProps = {
    taskUseCase: TaskUseCase
    getTasksOptions: GetTasksOptions
}

// 重新安排任务面板事件
export type TaskReschedulePanelEmits = {
    (e: 'refresh'): void
}