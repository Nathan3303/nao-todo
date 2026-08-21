import { useTasksStore } from '@nao-todo/presentation/task'
import { useTaskUseCase } from './use-task-usecase'

/**
 * 任务提醒用例装配（桌面版：本地仓储 + pinia store 适配，供 TaskReminderDialog 使用）
 */
export const useTaskReminder = () => useTaskUseCase(useTasksStore())