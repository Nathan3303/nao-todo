import {
    TaskEntity,
    UpdateTaskValueObject,
    type CreateTaskValueObject
} from '@nao-todo/domain/task'
import type { TaskModel } from '../models'
import { nanoid } from 'nanoid'
import dayjs from 'dayjs'
import {
    parseTaskPriority,
    parseTaskPriorityBackward,
    parseTaskState,
    parseTaskStateBackward
} from '@nao-todo/infrastructure/utils/task-attributes-parser'
import { GetTasksOptions } from '@nao-todo/types'
import { Collection } from 'dexie'
import { LocalDB } from '../db'

/**
 * 将创建任务值对象转换为任务模型
 * @param createTaskValueObject 创建任务值对象
 * @returns 任务模型
 */
export const createTaskValueObjectToModel = (
    createTaskValueObject: CreateTaskValueObject
): TaskModel => {
    // 创建任务模型
    const taskModel = {} as TaskModel
    // 处理本地属性
    taskModel._id = nanoid()
    taskModel._dbVersion = 1
    taskModel._createdAt = dayjs().toISOString()
    taskModel._updatedAt = dayjs().toISOString()
    taskModel._deletedAt = null
    // 处理通用属性
    taskModel.userId = createTaskValueObject.userId
    taskModel.name = createTaskValueObject.name
    taskModel.description = createTaskValueObject.description
    taskModel.state = parseTaskState(createTaskValueObject.state)
    taskModel.priority = parseTaskPriority(createTaskValueObject.priority)
    taskModel.startAt = createTaskValueObject.startAt
    taskModel.endAt = createTaskValueObject.endAt
    taskModel.projectId = createTaskValueObject.projectId
    taskModel.tags = [...createTaskValueObject.tags]
    // 返回
    return taskModel
}

/**
 * 将任务模型转换为任务实体
 * @param taskModel 任务模型
 * @returns 任务实体
 */
export const taskModelToEntity = (taskModel: TaskModel): TaskEntity => {
    return new TaskEntity(
        taskModel.id,
        taskModel._id,
        taskModel.userId,
        taskModel.parentTaskId || '',
        taskModel.name,
        taskModel.description || '',
        parseTaskStateBackward(taskModel.state),
        parseTaskPriorityBackward(taskModel.priority),
        taskModel.startAt || '',
        taskModel.endAt || '',
        taskModel.projectId || '',
        taskModel.tags || [],
        taskModel._createdAt,
        taskModel._updatedAt,
        taskModel._deletedAt,
        taskModel.archivedAt,
        taskModel.starMarkAt,
        taskModel.givenUpAt
    )
}

/**
 * 将更新任务值对象转换为部分任务模型
 * @param updateTaskValueObject 更新任务值对象
 * @returns 部分任务模型
 */
export const updateTaskValueObjectToPartialModel = (
    updateTaskValueObject: UpdateTaskValueObject
): Partial<TaskModel> => {
    // 创建任务模型
    const taskModel = {} as Partial<TaskModel>
    // 处理通用属性
    if (updateTaskValueObject.name !== undefined) {
        taskModel.name = updateTaskValueObject.name
    }
    if (updateTaskValueObject.description !== undefined) {
        taskModel.description = updateTaskValueObject.description || ''
    }
    if (updateTaskValueObject.state !== undefined) {
        taskModel.state = parseTaskState(updateTaskValueObject.state)
    }
    if (updateTaskValueObject.priority !== undefined) {
        taskModel.priority = parseTaskPriority(updateTaskValueObject.priority)
    }
    if (updateTaskValueObject.startAt !== undefined) {
        taskModel.startAt = updateTaskValueObject.startAt
    }
    if (updateTaskValueObject.endAt !== undefined) {
        taskModel.endAt = updateTaskValueObject.endAt
    }
    if (updateTaskValueObject.projectId !== undefined) {
        taskModel.projectId = updateTaskValueObject.projectId
    }
    if (updateTaskValueObject.tags !== undefined) {
        taskModel.tags = updateTaskValueObject.tags || []
    }
    if (updateTaskValueObject.givenUpAt !== undefined) {
        taskModel.givenUpAt = updateTaskValueObject.givenUpAt
    }
    // 返回
    return taskModel
}

/**
 * 构建任务列表查询条件
 * @param localDB 本地数据库
 * @param userId 用户ID
 * @param getOptions 任务列表查询选项
 * @returns 查询条件
 */
export const buildListQuery = (
    localDB: LocalDB,
    userId: string,
    getOptions: GetTasksOptions
): Collection => {
    // 构建初始查询
    let query = localDB.tasks.orderBy(getOptions.sort!.field)
    // 处理排序方向
    query = getOptions.sort!.order === 'desc' ? query.reverse() : query
    // 处理筛选
    query = query
        .and((task) => {
            return task.userId === userId
        })
        .and((task) => {
            // console.log(getOptions.projectId === undefined)
            return getOptions.projectId === undefined || task.projectId === getOptions.projectId
        })
        .and((task) => {
            // console.log(getOptions.name === undefined)
            return getOptions.name === undefined || task.name.includes(getOptions.name)
        })
        .and((task) => {
            // console.log(getOptions.state === undefined)
            return getOptions.state === undefined || task.state === parseTaskState(getOptions.state)
        })
        .and((task) => {
            // console.log(getOptions.priority === undefined)
            return (
                getOptions.priority === undefined ||
                task.priority === parseTaskPriority(getOptions.priority)
            )
        })
        .and((task) => {
            // console.log(getOptions.isDeleted === undefined)
            return getOptions.isDeleted === undefined || task._deletedAt !== null
        })
        .and((task) => {
            // console.log(getOptions.isGivenUp === undefined)
            return getOptions.isGivenUp === undefined || task.givenUpAt !== null
        })
    // 处理分页
    query = query.offset((getOptions.page! - 1) * getOptions.limit!).limit(getOptions.limit!)
    // 返回查询
    return query
}

