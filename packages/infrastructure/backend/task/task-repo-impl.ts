import type {
    CreateTaskValueObject,
    TaskEntity,
    TaskRepository,
    UpdateTaskValueObject
} from '@nao-todo/domain/task'
import type { GoAsync } from '@nao-todo/types'
import type { Requester } from '../../requester'
import type { ListTaskRes, ResponseData, ResponseDataPagination, TaskRes } from '../models'
import { getJWTFromLocalStorage } from '../utils'
import {
    createTaskValueObject2Req,
    listTaskRes2TaskEntities,
    taskRes2TaskEntity,
    updateTaskValueObject2Req
} from './converters'

/**
 * TaskRepoImpl 任务仓库实现
 */
export class TaskRepoImpl implements TaskRepository {
    /**
     * constructor 任务仓库构造函数
     * @param requester 请求器
     */
    constructor(private requester: Requester) {}

    /**
     * get 获取任务
     * @param id 任务 ID
     * @returns 任务实体
     */
    async get(id: string): GoAsync<TaskEntity> {
        // 1. 调用接口
        const response = await this.requester.get(`/tasks/${id}?isDeleted=true`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 40000) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const taskEntity = taskRes2TaskEntity(res.data as TaskRes)
        // 4. 返回
        return [taskEntity, null]
    }

    /**
     * create 创建任务
     * @param createVO 任务实体
     * @returns 任务实体
     */
    async create(createVO: CreateTaskValueObject): GoAsync<TaskEntity> {
        // 1. 转换为请求体
        const createTaskReq = createTaskValueObject2Req(createVO)
        // 2. 调用接口
        const response = await this.requester.post(`/tasks/`, createTaskReq, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 40010) {
            return [null, res.message]
        }
        // 4. 返回
        return [taskRes2TaskEntity(res.data as TaskRes), null]
    }

    /**
     * update 更新任务
     * @param id 任务 ID
     * @param updateVO 更新任务值对象
     * @returns 更新结果
     */
    async update(id: string, updateVO: UpdateTaskValueObject): GoAsync<void> {
        // 1. 转换为请求体
        const updateTaskReq = updateTaskValueObject2Req(updateVO)
        // 2. 调用接口
        const response = await this.requester.put(`/tasks/${id}`, updateTaskReq, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 40020) {
            return res.message
        }
        // 4. 返回
        return null
    }

    /**
     * remove 删除任务
     * @param id 任务 ID
     * @returns 错误信息
     */
    async remove(id: string): GoAsync<void> {
        // 1. 调用接口
        const response = await this.requester.delete(`/tasks/${id}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
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
     * restore 恢复任务
     * @param id 任务 ID
     * @returns 错误信息
     */
    async restore(id: string): GoAsync<void> {
        // 1. 调用接口
        const response = await this.requester.put(`/tasks/restore/${id}`, null, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
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
     * list 获取任务列表
     * @param queryString 查询字符串
     * @returns 任务实体列表和分页信息
     */
    async list(
        queryString?: string
    ): GoAsync<{ taskEntities: TaskEntity[]; pagination?: ResponseDataPagination }> {
        // 1. 调用接口
        const response = await this.requester.get(`/tasks/?${queryString}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 40050) {
            return [null, res.message]
        }
        // 3. 返回
        return [
            {
                taskEntities: listTaskRes2TaskEntities(res.data as ListTaskRes),
                pagination: res.pagination
            },
            null
        ]
    }

    /**
     * copy 复制任务
     * @param id 任务 ID
     * @returns 任务实体
     */
    async copy(id: string): GoAsync<TaskEntity> {
        // 1. 调用接口
        const response = await this.requester.post(`/tasks/copy/${id}`, null, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 40060) {
            return [null, res.message]
        }
        // 3. 返回
        return [taskRes2TaskEntity(res.data as TaskRes), null]
    }

    /**
     * snooze 稍后提醒
     * @param id 任务 ID
     * @param durationMinutes 延迟分钟数（1-1440）
     * @returns 新的提醒时间
     */
    async snooze(id: string, durationMinutes: number): GoAsync<string> {
        // 1. 调用接口
        const response = await this.requester.post(
            `/tasks/snooze/${id}`,
            { durationMinutes },
            { headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` } }
        )
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 40090) {
            return [null, res.message]
        }
        // 3. 返回
        return [res.data as string, null]
    }
}

/**
 * 创建任务仓库工厂方法
 * @param requester 请求器
 * @returns 任务仓库
 */
export const newTaskRepository = (requester: Requester) => {
    return new TaskRepoImpl(requester)
}

