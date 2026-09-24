import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { ProjectUseCase } from '@nao-todo/domain-project'

// 项目管理器对话框属性
export type ProjectManagerDialogProps = {
    projectUseCase: ProjectUseCase
    subscriber: Subscriber
    dialogManager: DialogManager
    /**
     * 已归档清单的任务数加载器（可选）
     * @description 需求口径（DP-3）：归档面板展示的任务数取「已归档且未删除」
     *              （= 取消归档时将恢复的任务数）；不传则不展示任务数。
     */
    countArchivedTasks?: (projectId: string) => Promise<number>
}

/**
 * 项目管理器状态
 * @description 项目管理器状态，包含筛选信息和当前选中的标签页
 */
export type ProjectManagerVO = {
    filterInfo: { name?: string }
    activeTab: 'all' | 'active' | 'deleted' | 'archived'
}