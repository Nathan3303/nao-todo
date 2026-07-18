import { DialogManager } from "@nao-todo/shared"
import { ProjectUseCase } from "../../../usecases"

// 项目更新器对话框属性
export type ProjectUpdaterDialogProps = {
    projectUseCase: ProjectUseCase
    dialogManager: DialogManager
}