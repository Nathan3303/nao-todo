import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { TagUseCase } from '@nao-todo/application/tag/usecases'

// 标签颜色更新器对话框属性
export type TagColorUpdaterDialogProps = {
    tagUseCase: TagUseCase
    subscriber: Subscriber
    dialogManager: DialogManager
}
