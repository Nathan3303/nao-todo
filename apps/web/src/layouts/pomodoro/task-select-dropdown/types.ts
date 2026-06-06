import { TaskViewObject } from '@nao-todo/types'

/**
 * 任务选择下拉菜单组件属性
 */
// export type PomodoroTaskSelectDropdownProps = {}

/**
 * 任务选择下拉菜单组件事件
 */
export type PomodoroTaskSelectDropdownEmits = {
    (e: 'selectTask', taskId: TaskViewObject['id']): void
    // (e: 'showTaskDetails', taskId: TaskViewObject['id']): void
}

