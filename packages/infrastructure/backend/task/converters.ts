import {
    CreateTaskCheckItemValueObject,
    CreateTaskCommentValueObject,
    CreateTaskValueObject,
    TaskCheckItemEntity,
    TaskCommentEntity,
    TaskEntity,
    UpdateTaskCheckItemValueObject,
    UpdateTaskCommentValueObject
} from '@nao-todo/domain/task'
import type {
    CreateTaskRes,
    TaskRes,
    ListTaskRes,
    UpdateTaskReq,
    CreateTaskReq,
    TaskCheckItemRes,
    CreateTaskCheckItemReq,
    CreateTaskCheckItemRes,
    UpdateTaskCheckItemReq,
    ListTaskCheckItemRes,
    BatchUpdateTaskCheckItemRes,
    TaskCommentRes,
    CreateTaskCommentReq,
    CreateTaskCommentRes,
    UpdateTaskCommentReq,
    ListTaskCommentRes
} from '../models'
import { UpdateTaskValueObject } from '@nao-todo/domain/task'
import dayjs from 'dayjs'

// --- Task ---

/**
 * taskRes2TaskEntity 任务响应转换为任务实体
 * @param res 任务响应
 * @returns 任务实体
 */
export const taskRes2TaskEntity = (res: TaskRes): TaskEntity => {
    return new TaskEntity(
        res.id,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        // res.userId,
        res.parentTaskId,
        res.name,
        res.description,
        res.state,
        res.priority,
        res.startAt,
        res.endAt,
        res.projectId,
        res.tags,
        res.archivedAt,
        res.starMarkAt,
        res.givenUpAt,
        res.remindAt || '',
        res.remindRepeat || 'none',
        res.remindTime || '',
        res.remindWeekdays || []
    )
}

/**
 * createTaskValueObject2Req 创建任务值对象转换为创建任务请求
 * @param createVO 创建任务值对象
 * @returns 创建任务请求
 */
export const createTaskValueObject2Req = (createVO: CreateTaskValueObject): CreateTaskReq => {
    return {
        projectId: createVO.projectId,
        name: createVO.name,
        description: createVO.description,
        state: createVO.state,
        priority: createVO.priority,
        startAt: createVO.startAt || undefined,
        endAt: dayjs(createVO.endAt).toISOString(),
        tags: createVO.tags,
        remindAt: createVO.remindAt || undefined,
        remindRepeat: createVO.remindRepeat || undefined,
        remindTime: createVO.remindTime || undefined,
        remindWeekdays: createVO.remindWeekdays || undefined
    } as CreateTaskReq
}

/**
 * createTaskRes2TaskEntity 创建任务响应转换为任务实体
 * @param res 创建任务响应
 * @returns 任务实体
 */
export const createTaskRes2TaskEntity = (res: CreateTaskRes): TaskEntity => {
    return taskRes2TaskEntity(res)
}

/**
 * listTaskRes2TaskEntities 任务列表响应转换为任务实体列表
 * @param res 任务列表响应
 * @returns 任务实体列表
 */
export const listTaskRes2TaskEntities = (res: ListTaskRes): TaskEntity[] => {
    return res.map((task) => taskRes2TaskEntity(task))
}

/**
 * updateTaskValueObject2Req 更新任务值对象转换为更新任务请求
 * @param updateVO 更新任务值对象
 * @returns 更新任务请求
 */
export const updateTaskValueObject2Req = (updateVO: UpdateTaskValueObject): UpdateTaskReq => {
    const req = {} as UpdateTaskReq
    if (updateVO.name) req.name = updateVO.name
    if (updateVO.description) req.description = updateVO.description
    if (updateVO.state) req.state = updateVO.state
    if (updateVO.priority) req.priority = updateVO.priority
    if (updateVO.startAt !== void 0) req.startAt = updateVO.startAt
    if (updateVO.endAt !== void 0) req.endAt = updateVO.endAt
    if (updateVO.projectId) req.projectId = updateVO.projectId
    if (updateVO.tags) req.tags = updateVO.tags
    if (updateVO.givenUpAt !== void 0) req.givenUpAt = updateVO.givenUpAt
    if (updateVO.remindAt !== undefined) req.remindAt = updateVO.remindAt
    if (updateVO.remindRepeat !== undefined) req.remindRepeat = updateVO.remindRepeat
    if (updateVO.remindTime !== undefined) req.remindTime = updateVO.remindTime
    if (updateVO.remindWeekdays !== undefined) req.remindWeekdays = updateVO.remindWeekdays
    return req
}

// --- Task Check Item ---

/**
 * taskCheckItemRes2Entity 任务检查项响应转换为任务检查项实体
 * @param res 任务检查项响应
 * @returns 任务检查项实体
 */
export const taskCheckItemRes2Entity = (res: TaskCheckItemRes): TaskCheckItemEntity => {
    return new TaskCheckItemEntity(
        res.id,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        res.taskId,
        res.name,
        // res.description,
        res.isDone,
        res.sortId
    )
}

/**
 * createTaskCheckItemValueObject2Req 创建任务检查项值对象转换为创建任务检查项请求
 * @param createVO 创建任务检查项值对象
 * @returns 创建任务检查项请求
 */
export const createTaskCheckItemValueObject2Req = (
    createVO: CreateTaskCheckItemValueObject
): CreateTaskCheckItemReq => {
    return {
        taskId: createVO.taskId,
        name: createVO.name
    }
}

/**
 * createTaskCheckItemRes2Entity 创建任务检查项响应转换为创建任务检查项实体
 * @param res 创建任务检查项响应
 * @returns 创建任务检查项实体
 */
export const createTaskCheckItemRes2Entity = (res: CreateTaskCheckItemRes): TaskCheckItemEntity => {
    return taskCheckItemRes2Entity(res)
}

/**
 * updateTaskCheckItemValueObject2Req 更新任务检查项值对象转换为更新任务检查项请求
 * @param updateVO 更新任务检查项值对象
 * @returns 更新任务检查项请求
 */
export const updateTaskCheckItemValueObject2Req = (
    updateVO: UpdateTaskCheckItemValueObject
): UpdateTaskCheckItemReq => {
    const req = {} as UpdateTaskCheckItemReq
    if (updateVO.name) req.name = updateVO.name
    if (updateVO.isDone !== void 0) req.isDone = updateVO.isDone
    if (updateVO.sortId !== void 0) req.sortId = updateVO.sortId
    return req
}

/**
 * listTaskCheckItemRes2Entities 任务检查项列表响应转换为任务检查项实体列表
 * @param res 任务检查项列表响应
 * @returns 任务检查项实体列表
 */
export const listTaskCheckItemRes2Entities = (res: ListTaskCheckItemRes): TaskCheckItemEntity[] => {
    return res.map((taskCheckItem) => taskCheckItemRes2Entity(taskCheckItem))
}

/**
 * batchUpdateTaskCheckItemValueObjects2Req 批量更新任务检查项值对象转换为批量更新任务检查项请求
 * @param updateVOs 批量更新任务检查项值对象列表
 * @returns 批量更新任务检查项请求列表
 */
export const batchUpdateTaskCheckItemValueObjects2Req = (
    updateVOs: UpdateTaskCheckItemValueObject[]
): UpdateTaskCheckItemReq[] => {
    return updateVOs.map((updateVO) => updateTaskCheckItemValueObject2Req(updateVO))
}

/**
 * batchUpdateTaskCheckItemRes2Entities 批量更新任务检查项响应转换为批量更新任务检查项实体列表
 * @param res 批量更新任务检查项响应
 * @returns 批量更新任务检查项实体列表
 */
export const batchUpdateTaskCheckItemRes2Entities = (
    res: BatchUpdateTaskCheckItemRes
): TaskCheckItemEntity[] => {
    return res.checkItems.map((taskCheckItem) => taskCheckItemRes2Entity(taskCheckItem))
}

// --- Task Comment ---

/**
 * taskCommentRes2Entity 任务评论响应转换为任务评论实体
 * @param res 任务评论响应
 * @returns 任务评论实体
 */
export const taskCommentRes2Entity = (res: TaskCommentRes): TaskCommentEntity => {
    return new TaskCommentEntity(
        res.id,
        res.createdAt,
        res.updatedAt,
        res.deletedAt,
        res.taskId,
        res.content,
        res.attachments,
        res.isTopUp,
        res.avatar,
        res.nickname
    )
}

/**
 * createTaskCommentValueObject2Req 创建任务评论值对象转换为创建任务评论请求
 * @param createVO 创建任务评论值对象
 * @returns 创建任务评论请求
 */
export const createTaskCommentValueObject2Req = (
    createVO: CreateTaskCommentValueObject
): CreateTaskCommentReq => {
    return {
        taskId: createVO.taskId,
        content: createVO.content
    }
}

/**
 * createTaskCommentRes2Entity 创建任务评论响应转换为创建任务评论实体
 * @param res 创建任务评论响应
 * @returns 创建任务评论实体
 */
export const createTaskCommentRes2Entity = (res: CreateTaskCommentRes): TaskCommentEntity => {
    return taskCommentRes2Entity(res)
}

/**
 * updateTaskCommentValueObject2Req 更新任务评论值对象转换为更新任务评论请求
 * @param updateVO 更新任务评论值对象
 * @returns 更新任务评论请求
 */
export const updateTaskCommentValueObject2Req = (
    updateVO: UpdateTaskCommentValueObject
): UpdateTaskCommentReq => {
    const req = {} as UpdateTaskCommentReq
    if (updateVO.content) req.content = updateVO.content
    // if (updateVO.attachments !== void 0) req.attachments = updateVO.attachments
    if (updateVO.isTopUp !== void 0) req.isTopUp = updateVO.isTopUp
    return req
}

/**
 * listTaskCommentRes2Entities 任务评论列表响应转换为任务评论实体列表
 * @param res 任务评论列表响应
 * @returns 任务评论实体列表
 */
export const listTaskCommentRes2Entities = (res: ListTaskCommentRes): TaskCommentEntity[] => {
    return res.map((taskComment) => taskCommentRes2Entity(taskComment))
}

