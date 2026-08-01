import type { DialogManager, Subscriber } from '@nao-todo/shared'
import type { TagUseCase } from '@nao-todo/domain-tag'

// 标签更新器弹窗属性
export type TagUpdaterDialogProps = {
    dialogManager: DialogManager
    subscriber: Subscriber
    tagUseCase: TagUseCase
}