import type { InjectionKey, Ref } from 'vue'
import type { TaskViewObject } from '@nao-todo/domain-task'

/**
 * 多选编辑上下文
 * @description 由 tasks 视图提供，任务视图（列表/表格）与多选编辑侧栏通过该上下文通信
 */
export type MultiSelectContext = {
    /**
     * 侧栏显隐
     */
    isOpen: Ref<boolean>
    /**
     * 已选任务 ID 列表
     */
    selectedIds: Ref<TaskViewObject['id'][]>
    /**
     * 多选清除信号
     * @description 递增该值以通知当前任务视图清空本地多选范围
     */
    clearSignal: Ref<number>
    /**
     * 打开侧栏
     * @param payload 多选载荷（含已选任务 ID）
     */
    openPanel: (payload: { selectedIds: TaskViewObject['id'][] }) => void
    /**
     * 关闭侧栏（保留多选范围）
     */
    closePanel: () => void
    /**
     * 请求清空多选（关闭侧栏 + 清空选择 + 通知视图清除范围）
     */
    requestClear: () => void
}

export const MULTI_SELECT_CONTEXT_KEY: InjectionKey<MultiSelectContext> =
    Symbol('MULTI_SELECT_CONTEXT')