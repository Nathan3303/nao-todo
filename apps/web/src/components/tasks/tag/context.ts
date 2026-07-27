import type {
    TagPreferenceViewObject,
    TagUseCase,
    TagViewObject,
    TaskViewObject
} from '@nao-todo/application'
import type { TaskUseCase } from '@nao-todo/application/task/usecases'
import type { UserViewObject } from '@nao-todo/application/user/viewobjects'
import type { TagHandler } from '@nao-todo/presentation/tag'
import type { DialogManager, Subscriber, TaskColumnOptions } from '@nao-todo/shared'
import type { ComputedRef, InjectionKey } from 'vue'

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