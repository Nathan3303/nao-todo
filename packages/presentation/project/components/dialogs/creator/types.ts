import type { DialogManager } from '@nao-todo/shared'
import type { ProjectUseCase } from '@nao-todo/domain-project'

// 项目创建对话框属性
export type ProjectCreatorDialogProps = {
    projectUseCase: ProjectUseCase
    dialogManager: DialogManager
}