import type {
    TaskProjectViewObject,
    TaskTagViewObject,
    TaskViewObject
} from '@nao-todo/domain-task'
import type { TaskHandler } from '../../handlers'

/**
 * 多选编辑面板属性
 */
export type TaskMultiSelectPanelProps = {
    /**
     * 任务操作器（批量操作专用实例）
     */
    taskHandler: TaskHandler
    /**
     * 可选清单列表
     */
    projects: TaskProjectViewObject[]
    /**
     * 可选标签列表
     */
    tags: TaskTagViewObject[]
    /**
     * 面板显隐
     */
    modelValue: boolean
    /**
     * 已选任务 ID 列表
     */
    selectedIds: TaskViewObject['id'][]
}

/**
 * 多选编辑面板事件
 */
export type TaskMultiSelectPanelEmits = {
    (e: 'update:modelValue', value: boolean): void
    /**
     * 破坏性批量操作成功后，请求外部清空多选范围
     */
    (e: 'cleared'): void
}

/**
 * 批量操作类型
 */
export type BatchOperation =
    | { kind: 'updateState'; payload: TaskViewObject['state'] }
    | { kind: 'updatePriority'; payload: TaskViewObject['priority'] }
    | { kind: 'updateEndAt'; payload: TaskViewObject['endAt'] }
    | { kind: 'updateProject'; payload: TaskProjectViewObject['id'] }
    | { kind: 'addTags'; payload: TaskTagViewObject['id'][] }
    | { kind: 'removeTags'; payload: TaskTagViewObject['id'][] }
    | { kind: 'giveUp' }
    | { kind: 'ungiveUp' }
    | { kind: 'delete' }
    | { kind: 'restore' }

/**
 * 批量操作结果
 */
export type BatchOpResult = {
    total: number
    succeeded: number
    failed: number
    errors: Array<{ taskId: string; message: string }>
}