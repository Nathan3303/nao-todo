import type { UserViewObject } from '@nao-todo/domain-identity'
import type { TagPreferenceViewObject, TagUseCase, TagViewObject } from '@nao-todo/domain-tag'
import type { TaskUseCase, TaskViewObject } from '@nao-todo/domain-task'
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