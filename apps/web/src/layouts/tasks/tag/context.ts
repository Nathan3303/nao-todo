import type { ComputedRef, InjectionKey } from 'vue'
import type { Subscriber } from '@nao-todo/infrastructure/hooks/use-subscriber'
import { TaskColumnOptions, TaskUseCase, TaskViewObject } from '@nao-todo/usecases/task'
import { TagPreferenceViewObject, TagUseCase, TagViewObject } from '@nao-todo/usecases/tag'
import { TagHandler } from '@/infrastructure/handlers/tag'
import { UserViewObject } from '@nao-todo/usecases/user'
import DialogManager from '@/infrastructure/hooks/use-dialog-manager'

export type TagViewContext = {
    taskUseCase: TaskUseCase
    tagUseCase: TagUseCase

    subscriber: Subscriber
    dialogManager: DialogManager

    tagHandler: TagHandler

    tag: ComputedRef<TagViewObject | undefined>
    preference: ComputedRef<TagPreferenceViewObject | undefined>
    tags: ComputedRef<TagViewObject[]>
    isHideCompletedAlready: ComputedRef<boolean>
    profile: ComputedRef<UserViewObject | undefined>

    getColumnLabel: (key: keyof TaskColumnOptions) => string
    getProjectName: (projectId: string) => string
    showTaskDetails: (taskId: TaskViewObject['id']) => void
    showTaskCreator: () => void
    switchViewTypeToTable: () => void
    switchViewTypeToKanban: () => void
    switchViewTypeToList: () => void
}

export const TAG_VIEW_CONTEXT_KEY: InjectionKey<TagViewContext> = Symbol('TAG_VIEW_CONTEXT')




