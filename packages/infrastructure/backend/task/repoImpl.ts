import {
    createTaskRes2TaskEntity,
    getTaskRes2TaskEntity,
    listTaskRes2TaskEntities
} from './converters'
import type { Requester } from '../../requester/types'
import type { GoAsync } from '@nao-todo/types'
import type {
    CreateTaskReq,
    CreateTaskRes,
    GetTaskRes,
    ListTaskRes,
    ResponseData,
    ResponseDataPagination,
    UpdateTaskReq,
    UpdateTaskRes
} from '../types'
import {
    UpdateTaskValueObject,
    CreateTaskValueObject,
    TaskEntity,
    type TaskRepository
} from '@nao-todo/domain/task'

/**
 * 任务仓库实现
 * @param requester 请求器
 * @returns 任务仓库
 */
export const useTaskRepository = (requester: Requester): TaskRepository => {
    /**
     * 获取任务详情
     * @param taskId 任务ID
     * @returns 任务实体
     */
    const get = async (taskId: string): GoAsync<TaskEntity> => {
        // 1. 调用接口
        const response = await requester.get(`/tasks/${taskId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 40000) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const taskEntity = getTaskRes2TaskEntity(res.data as GetTaskRes)
        // 4. 返回
        return [taskEntity, null]
    }

    /**
     * 创建任务
     * @param createTaskValueObject 创建任务值对象
     * @returns 任务实体
     */
    const create = async (createTaskValueObject: CreateTaskValueObject): GoAsync<TaskEntity> => {
        // 1. 构建 rto
        const rto: CreateTaskReq = {
            projectId: createTaskValueObject.projectId,
            name: createTaskValueObject.name,
            description: createTaskValueObject.description,
            state: createTaskValueObject.state,
            priority: createTaskValueObject.priority,
            startAt: createTaskValueObject.startAt || undefined,
            endAt: createTaskValueObject.endAt,
            tags: createTaskValueObject.tags
        }
        // 2. 调用接口
        const response = await requester.post('/tasks/', rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 40010) {
            return [null, res.message]
        }
        // 4. 转换为实体
        const taskEntity = createTaskRes2TaskEntity(res.data as CreateTaskRes)
        // 5. 返回
        return [taskEntity, null]
    }

    /**
     * 更新任务
     * @param taskId 任务ID
     * @param updateTaskValueObject 更新任务值对象
     * @returns 任务ID
     */
    const update = async (
        taskId: string,
        updateTaskValueObject: UpdateTaskValueObject
    ): GoAsync<string> => {
        // 1. 构建 rto
        const rto: UpdateTaskReq = updateTaskValueObject
        // 2. 调用接口
        const response = await requester.put(`/tasks/${taskId}`, rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 40020) {
            return [null, res.message]
        }
        // 4. 返回
        const data = res.data as UpdateTaskRes
        return [data.taskId, null]
    }

    /**
     * 删除任务
     * @param taskId 任务ID
     * @returns 任务ID
     */
    const remove = async (taskId: string): GoAsync<void> => {
        // 1. 调用接口
        const response = await requester.delete(`/tasks/${taskId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 40030) {
            return res.message
        }
        // 3. 返回
        return null
    }

    /**
     * 恢复任务
     * @param taskId 任务ID
     * @returns 任务ID
     */
    const restore = async (taskId: string): GoAsync<void> => {
        // 1. 调用接口
        const response = await requester.put(`/tasks/restore/${taskId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 40040) {
            return res.message
        }
        // 3. 返回
        return null
    }

    /**
     * 获取任务列表
     * @param queryString 查询字符串
     * @returns 任务列表
     */
    const list = async (
        queryString?: string
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }> => {
        // 1. 调用接口
        const response = await requester.get(`/tasks/?${queryString}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 获取结果
        const res = response.data as ResponseData
        if (res.code !== 40050) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const taskEntities = listTaskRes2TaskEntities(res.data as ListTaskRes)
        // 4. 返回
        return [{ taskEntities, pagination: res.pagination }, null]
    }

    // @returns
    return { create, get, update, remove, restore, list }
}
