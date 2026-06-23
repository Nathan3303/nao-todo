import { TaskViewObject } from '@nao-todo/types'

/**
 * 任务选择下拉菜单组件事件
 */
export type PomodoroTaskSelectDropdownEmits = {
    (e: 'selectTask', task: TaskViewObject): void
}

