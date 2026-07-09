import type { TaskViewObject } from '@nao-todo/usecases/task'

/**
 * 任务选择下拉菜单组件事件
 */
export type PomodoroTaskSelectDropdownEmits = {
    (e: 'selectTask', task: TaskViewObject): void
}

