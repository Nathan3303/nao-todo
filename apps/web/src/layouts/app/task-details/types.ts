import {
    CreateTaskCheckItemViewObject,
    CreateTaskCommentViewObject,
    TaskCheckItemViewObject,
    TaskCommentViewObject,
    TaskViewObject,
    UpdateTaskCheckItemViewObject,
    UpdateTaskCommentViewObject,
    UpdateTaskViewObject
} from '@nao-todo/usecases/task'
import { ProjectViewObject } from '@nao-todo/usecases/project'
import { TagViewObject } from '@nao-todo/usecases/tag'

// 任务详情面板视图对象
export type TaskDetailsViewObject = TaskViewObject & {
    projectName?: ProjectViewObject['name']
    tagList: TagViewObject[]
    isDone: boolean
}

// 任务详情面板属性
export type TaskDetailsProps = {
    taskId?: TaskViewObject['id']
}

// 任务详情面板事件
export type TaskDetailsEmits = {
    (e: 'closeDetails'): void
    (e: 'updateTask', taskId: TaskViewObject['id'], update: UpdateTaskViewObject): void
    (e: 'deleteTask', taskId: TaskViewObject['id']): void
    (e: 'restoreTask', taskId: TaskViewObject['id']): void
    (e: 'deleteTaskPermanently', taskId: TaskViewObject['id']): void
    (e: 'duplicateTask', taskId: TaskViewObject['id']): void
    (e: 'createCheckItem', createViewObject: CreateTaskCheckItemViewObject): void
    (
        e: 'updateCheckItem',
        eventId: TaskCheckItemViewObject['id'],
        update: UpdateTaskCheckItemViewObject
    ): void
    (e: 'updateCheckItems', updates: UpdateTaskCheckItemViewObject[]): void
    (e: 'deleteCheckItem', eventId: TaskCheckItemViewObject['id']): void
    (e: 'createComment', create: CreateTaskCommentViewObject): void
    (
        e: 'updateComment',
        commentId: TaskCommentViewObject['id'],
        update: UpdateTaskCommentViewObject
    ): void
    (e: 'deleteComment', commentId: TaskCommentViewObject['id']): void
}

