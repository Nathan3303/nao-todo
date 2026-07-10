import {
    CreateTaskCheckItemValueObject,
    CreateTaskCommentValueObject,
    CreateTaskValueObject,
    TaskCheckItemEntity,
    TaskCommentEntity,
    TaskEntity,
    UpdateTaskCheckItemValueObject,
    UpdateTaskCommentValueObject,
    UpdateTaskValueObject
} from '@nao-todo/domain/task'
import type {
    CreateTaskCheckItemViewObject,
    CreateTaskCommentViewObject,
    CreateTaskViewObject,
    TaskCheckItemViewObject,
    TaskCommentViewObject,
    TaskViewObject,
    UpdateTaskCheckItemViewObject,
    UpdateTaskCommentViewObject,
    UpdateTaskViewObject
} from './viewobjects'
import dayjs from 'dayjs'

// --- Task ---

/**
 * 任务实体转换为任务视图对象
 * @param entity 任务实体
 * @returns 任务视图对象
 */
export const taskEntityToViewObject = (entity: TaskEntity): TaskViewObject => {
    const taskViewObject = {} as TaskViewObject
    taskViewObject.id = entity.id
    taskViewObject.parentTaskId = entity.parentTaskId
    // taskViewObject.userId = entity.userId
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
        createTaskViewObject.projectId || '',
        createTaskViewObject.tags || [],
        createTaskViewObject.remindAt,
        createTaskViewObject.remindRepeat || 'none',
        createTaskViewObject.remindTime,
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
    if (viewObject.parentTaskId) valueObject.parentTaskId = viewObject.parentTaskId
    if (viewObject.name) valueObject.name = viewObject.name
    if (viewObject.description) valueObject.description = viewObject.description
    if (viewObject.state) valueObject.state = viewObject.state
    if (viewObject.priority) valueObject.priority = viewObject.priority
    if (viewObject.startAt) valueObject.startAt = viewObject.startAt
    if (viewObject.endAt) valueObject.endAt = viewObject.endAt
    if (viewObject.projectId) valueObject.projectId = viewObject.projectId
    if (viewObject.tags) valueObject.tags = viewObject.tags
    if (viewObject.givenUpAt !== void 0) valueObject.givenUpAt = viewObject.givenUpAt
    if (viewObject.remindAt !== void 0) valueObject.remindAt = viewObject.remindAt
    if (viewObject.remindRepeat !== void 0) valueObject.remindRepeat = viewObject.remindRepeat
    if (viewObject.remindTime !== void 0) valueObject.remindTime = viewObject.remindTime
    if (viewObject.remindWeekdays !== void 0) valueObject.remindWeekdays = viewObject.remindWeekdays
    return valueObject
}

// --- Task Check Item ---

/**
 * 创建任务检查项视图对象转换为值对象
 * @param createTaskCheckItem 创建任务检查项视图对象
 * @returns 创建任务检查项值对象
 */
export const createTaskCheckItemViewObjectToValueObject = (
    createTaskCheckItem: CreateTaskCheckItemViewObject
): CreateTaskCheckItemValueObject => {
    return new CreateTaskCheckItemValueObject(
        createTaskCheckItem.taskId,
        createTaskCheckItem.name,
        false,
        false
    )
}

/**
 * 任务检查项实体转换为任务检查项视图对象
 * @param taskCheckItemEntity 任务检查项实体
 * @returns 任务检查项视图对象
 */
export const taskCheckItemEntityToViewObject = (
    taskCheckItemEntity: TaskCheckItemEntity
): TaskCheckItemViewObject => {
    return {
        id: taskCheckItemEntity.id,
        taskId: taskCheckItemEntity.taskId,
        name: taskCheckItemEntity.name,
        isDone: taskCheckItemEntity.isDone,
        sortId: taskCheckItemEntity.sortId
    } as TaskCheckItemViewObject
}

/**
 * 更新任务检查项视图对象转换为值对象
 * @param updateTaskCheckItemId 更新任务检查项ID
 * @param updateTaskCheckItemViewObject 更新任务检查项视图对象
 * @returns 更新任务检查项值对象
 */
export const updateTaskCheckItemViewObjectToValueObject = (
    updateTaskCheckItemId: TaskCheckItemViewObject['id'],
    updateTaskCheckItemViewObject: UpdateTaskCheckItemViewObject
): UpdateTaskCheckItemValueObject => {
    const updateTaskCheckItemValueObject = new UpdateTaskCheckItemValueObject(updateTaskCheckItemId)
    updateTaskCheckItemValueObject.name = updateTaskCheckItemViewObject.name
    updateTaskCheckItemValueObject.isDone = updateTaskCheckItemViewObject.isDone
    updateTaskCheckItemValueObject.sortId = updateTaskCheckItemViewObject.sortId
    return updateTaskCheckItemValueObject
}

// --- Task Comment ---

/**
 * 将任务评论实体转换为任务评论视图对象
 * @param entity 评论实体
 * @returns 评论视图对象
 */
export const taskCommentEntityToViewObject = (entity: TaskCommentEntity): TaskCommentViewObject => {
    const commentViewObject = {} as TaskCommentViewObject
    commentViewObject.id = entity.id
    commentViewObject.taskId = entity.taskId
    commentViewObject.content = entity.content
    commentViewObject.attachments = entity.attachments
    commentViewObject.isTopUp = entity.isTopUp
    commentViewObject.createdAt = entity.createdAt
    commentViewObject.avatar = entity.avatar
    commentViewObject.nickname = entity.nickname
    return commentViewObject
}

/**
 * 将创建任务评论视图对象转换为任务评论实体
 * @param createCommentViewObject 创建任务评论视图对象
 * @returns 任务评论实体
 */
export const createTaskCommentViewObjectToValueObject = (
    createCommentViewObject: CreateTaskCommentViewObject
): CreateTaskCommentValueObject => {
    return new CreateTaskCommentValueObject(
        createCommentViewObject.taskId,
        createCommentViewObject.content,
        createCommentViewObject.attachments || [],
        createCommentViewObject.isTopUp || false
    )
}

/**
 * 将更新任务评论视图对象转换为更新任务评论值对象
 * @param commentId 评论 ID
 * @param updateCommentViewObject 更新任务评论视图对象
 * @returns 更新任务评论值对象
 */
export const updateTaskCommentViewObjectToValueObject = (
    commentId: TaskCommentViewObject['id'],
    updateCommentViewObject: UpdateTaskCommentViewObject
): UpdateTaskCommentValueObject => {
    const valueObject = new UpdateTaskCommentValueObject(commentId)
    if (updateCommentViewObject.content !== void 0)
        valueObject.content = updateCommentViewObject.content
    if (updateCommentViewObject.isTopUp !== void 0)
        valueObject.isTopUp = updateCommentViewObject.isTopUp
    return valueObject
}

