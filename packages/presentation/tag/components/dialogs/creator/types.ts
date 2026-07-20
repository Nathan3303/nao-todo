import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { TagUseCase } from '../../../usecases'

// 标签创建弹窗 props
export type TagCreatorDialogProps = {
    tagUseCase: TagUseCase
    subscriber: Subscriber
    dialogManager: DialogManager
}
