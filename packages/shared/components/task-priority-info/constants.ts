import { computed } from 'vue'
import type { TaskPriority } from '@nao-todo/domain-task'
import { t } from '@nao-todo/shared/locales'

/**
 * 优先级预设：图标 + 文案 + 颜色（三元组顺序被 `TaskPriorityInfo` / 详情子任务着色共用）
 * @description 键集合以 domain `TASK_PRIORITIES` 为准（Record 类型 ⇒ 缺档位 / 多档位由 `vp check` 拦住）。
 *              「紧急」（T582）沿用既有 `error` 语义色（不新造 token），并与「高」区分：
 *              **图标（warning）+ 文案（紧急优先级）+ 颜色（error-70）三重冗余**，不依赖单一颜色通道。
 */
export const TaskPriorityPresets = computed<Record<TaskPriority, [string, string, string]>>(() => ({
    urgent: ['warning', t('task.priority.urgent'), 'var(--nue-error-color-70)'],
    high: ['priority-3', t('task.priority.high'), 'var(--nue-error-color-60)'],
    medium: ['priority-2', t('task.priority.medium'), 'var(--nue-warning-color-60)'],
    low: ['priority-1', t('task.priority.low'), 'inherit']
}))