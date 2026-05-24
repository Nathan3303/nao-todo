import { TaskEntity, UpdateTaskValueObject } from '@nao-todo/domain/task'
import { CreateTaskValueObject } from '@nao-todo/domain/task/valueobjects'
import type { CreateTaskViewObject, TaskViewObject, UpdateTaskViewObject } from '@nao-todo/types'
import dayjs from 'dayjs'

/**
 * 任务实体转换为任务视图对象
 * @param entity 任务实体
 * @returns 任务视图对象
 */
export const taskEntityToViewObject = (entity: TaskEntity): TaskViewObject => {
    const taskViewObject = {} as TaskViewObject
    taskViewObject.id = entity.id
    taskViewObject.userId = entity.userId
    taskViewObject.name = entity.name
    taskViewObject.description = entity.description
    taskViewObject.projectId = entity.projectId
    taskViewObject.state = ['todo', 'in-progress', 'done'].includes(entity.state)
        ? entity.state
        : 'todo'
    taskViewObject.priority = ['low', 'medium', 'high'].includes(entity.priority)
        ? entity.priority
        : 'low'
    taskViewObject.tags = entity.tags || []
    taskViewObject.startAt = entity.startAt
    taskViewObject.endAt = entity.endAt
    taskViewObject.archivedAt = entity.archivedAt
    taskViewObject.createdAt = entity.createdAt
    taskViewObject.updatedAt = entity.updatedAt
    taskViewObject.deletedAt = entity.deletedAt
    taskViewObject.givenUpAt = entity.givenUpAt
    taskViewObject.isStarMarked = dayjs(entity.starMarkAt).isValid()
    taskViewObject.isDeleted = dayjs(entity.deletedAt).isValid()
    taskViewObject.isArchived = dayjs(entity.archivedAt).isValid()
    taskViewObject.isGivenUp = dayjs(entity.givenUpAt).isValid()
    taskViewObject.remindAt = entity.remindAt || null
    taskViewObject.remindRepeat = (entity.remindRepeat || 'none') as TaskViewObject['remindRepeat']
    taskViewObject.remindTime = entity.remindTime || null
    taskViewObject.remindWeekdays = entity.remindWeekdays || []
    return taskViewObject
}

/**
 * 任务实体数组转换为任务视图对象数组
 * @param entities 任务实体数组
 * @returns 任务视图对象数组
 */
export const taskEntitiesToViewObjects = (entities: TaskEntity[]): TaskViewObject[] => {
    return entities.map(taskEntityToViewObject)
}

/**
 * 创建任务视图对象转换为创建任务值对象
 * @param createTaskViewObject 创建任务视图对象
 * @returns 创建任务值对象
 */
export const createTaskViewObjectToValueObject = (
    createTaskViewObject: CreateTaskViewObject
): CreateTaskValueObject => {
    return new CreateTaskValueObject(
        '', // userId
        createTaskViewObject.name,
        createTaskViewObject.description || '',
        createTaskViewObject.state,
        createTaskViewObject.priority,
        createTaskViewObject.startAt,
        createTaskViewObject.endAt,
        createTaskViewObject.projectId,
        createTaskViewObject.tags || [],
        createTaskViewObject.remindAt || null,
        createTaskViewObject.remindRepeat || 'none',
        createTaskViewObject.remindTime || null,
        createTaskViewObject.remindWeekdays || []
    )
}

/**
 * 更新任务视图对象转换为更新任务值对象
 * @param taskId 任务ID
 * @param viewObject 更新任务视图对象
 * @returns 更新任务值对象
 */
export const updateTaskViewObjectToValueObject = (
    taskId: UpdateTaskValueObject['id'],
    viewObject: UpdateTaskViewObject
): UpdateTaskValueObject => {
    const valueObject = new UpdateTaskValueObject(taskId)
    if (viewObject.name) valueObject.name = viewObject.name
    if (viewObject.description) valueObject.description = viewObject.description
    if (viewObject.state) valueObject.state = viewObject.state
    if (viewObject.priority) valueObject.priority = viewObject.priority
    if (viewObject.startAt) valueObject.startAt = viewObject.startAt
    if (viewObject.endAt) valueObject.endAt = viewObject.endAt
    if (viewObject.projectId) valueObject.projectId = viewObject.projectId
    if (viewObject.tags) valueObject.tags = viewObject.tags
    if (viewObject.givenUpAt !== undefined) valueObject.givenUpAt = viewObject.givenUpAt
    if (viewObject.remindAt !== undefined) valueObject.remindAt = viewObject.remindAt
    if (viewObject.remindRepeat !== undefined) valueObject.remindRepeat = viewObject.remindRepeat
    if (viewObject.remindTime !== undefined) valueObject.remindTime = viewObject.remindTime
    if (viewObject.remindWeekdays !== undefined)
        valueObject.remindWeekdays = viewObject.remindWeekdays
    return valueObject
}

