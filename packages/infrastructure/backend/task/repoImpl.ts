import {
    createTaskRes2TaskEntity,
    getTaskRes2TaskEntity,
    listTaskRes2TaskEntities
} from './converters'
import { TaskEntity } from '@nao-todo/domain/task/entities'
import type { TaskRepository } from '@nao-todo/domain/task/repositories'
import type { Requester } from '../../requester/types'
import type { Err, GoLike } from '@nao-todo/types'
import type {
    CreateTaskReq,
    CreateTaskRes,
    GetTaskRes,
    ListTaskRes,
    ResponseData,
    UpdateTaskReq,
    UpdateTaskRes
} from '../types'

export const useTaskRepository = (requester: Requester): TaskRepository => {
    const get = async (taskId: string): Promise<GoLike<TaskEntity | null>> => {
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
    const create = async (taskEntity: TaskEntity): Promise<GoLike<TaskEntity | null>> => {
        // 1. 构建 rto
        const rto: CreateTaskReq = {
            projectId: taskEntity.projectId,
            name: taskEntity.name,
            description: taskEntity.description,
            state: taskEntity.state,
            priority: taskEntity.priority,
            startAt: taskEntity.startAt,
            endAt: taskEntity.endAt,
            tags: taskEntity.tags
        }
        // 2. 调用接口
        const response = await requester.post('/tasks', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 40010) {
            return [null, res.message]
        }
        // 4. 转换为实体
        taskEntity = createTaskRes2TaskEntity(res.data as CreateTaskRes)
        // 5. 返回
        return [taskEntity, null]
    }

    const update = async (
        taskId: string,
        taskEntity: TaskEntity
    ): Promise<GoLike<string | null>> => {
        // 1. 构建 rto
        const rto: UpdateTaskReq = {}
        if (taskEntity.name) rto.name = taskEntity.name
        if (taskEntity.description) rto.description = taskEntity.description
        // 2. 调用接口
        const response = await requester.put(`/tasks/${taskId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
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

    const remove = async (taskId: string): Promise<Err> => {
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

    const restore = async (taskId: string): Promise<Err> => {
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

    const list = async (): Promise<GoLike<TaskEntity[] | null>> => {
        // 1. 调用接口
        const response = await requester.get('/tasks/', {
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
        return [taskEntities, null]
    }

    return { create, get, update, remove, restore, list }
}
