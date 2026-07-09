import type { PomodoroType, PomodoroViewObject } from '@nao-todo/usecases/pomodoro'
import type { TaskViewObject } from '@nao-todo/usecases/task'

/**
 * 专注依赖选择下拉菜单组件属性
 */
export type PomodoroFocusDependDropdownProps = {
    type: PomodoroType
}

/**
 * 专注依赖选择下拉菜单组件事件
 * @description selectPreset 的 preset 为 null 表示「不关联」常用专注
 */
export type PomodoroFocusDependDropdownEmits = {
    (e: 'selectPreset', preset: PomodoroViewObject | null): void
    (e: 'selectTask', task: TaskViewObject): void
}

/**
 * 专注依赖下拉的 Tab 类型
 */
export type FocusDependTab = 'preset' | 'task'
