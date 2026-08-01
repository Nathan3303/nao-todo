import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { ProjectUseCase } from '@nao-todo/domain-project'

// 项目管理器对话框属性
export type ProjectManagerDialogProps = {
    projectUseCase: ProjectUseCase
    subscriber: Subscriber
    dialogManager: DialogManager
}

/**
 * 项目管理器状态
 * @description 项目管理器状态，包含筛选信息和当前选中的标签页
 */
export type ProjectManagerVO = {
    filterInfo: { name?: string }
    activeTab: 'all' | 'active' | 'deleted'
}