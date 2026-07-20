import type { DialogManager, Subscriber } from "@nao-todo/shared"
import type { TagUseCase } from '@nao-todo/application/tag/usecases'

// 标签管理弹窗属性
export type TagManagerDialogProps = {
    dialogManager: DialogManager
    subscriber: Subscriber
    tagUseCase: TagUseCase
}