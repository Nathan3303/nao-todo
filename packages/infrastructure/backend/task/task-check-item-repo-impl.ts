import {
    CreateTaskCheckItemValueObject,
    TaskCheckItemEntity,
    TaskCheckItemRepository,
    UpdateTaskCheckItemValueObject
} from '@nao-todo/domain/task'
import type { GoAsync } from '@nao-todo/types'
import type { Requester } from '../../requester'
import { getJWTFromLocalStorage } from '../utils'
import type { BatchUpdateTaskCheckItemRes, ResponseData, TaskCheckItemRes } from '../models'
import {
    batchUpdateTaskCheckItemRes2Entities,
    createTaskCheckItemValueObject2Req,
    listTaskCheckItemRes2Entities,
    taskCheckItemRes2Entity,
    updateTaskCheckItemValueObject2Req,
    updateTaskCheckItemValueObjects2BatchUpdateReq
} from './converters'

/**
 * 任务检查项仓库实现类
 */
export class TaskCheckItemRepoImpl implements TaskCheckItemRepository {
    /**
     * 任务检查项仓库实现类构造函数
     * @param requester 请求器
     */
    constructor(
        private requester: Requester // 请求器
    ) {}

    /**
     * get 获取任务检查项
     * @param id 任务检查项ID
     * @returns 任务检查项实体
     */
    async get(id: string): GoAsync<TaskCheckItemEntity> {
        // 1. 调用接口
        const response = await this.requester.get(`/events/${id}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 50000) {
            return [null, res.message]
        }
        // 4. 返回
        return [taskCheckItemRes2Entity(res.data as TaskCheckItemRes), null]
    }

    /**
     * create 创建任务检查项
     * @param createVO 创建任务检查项值对象
     * @returns 任务检查项实体
     */
    async create(createVO: CreateTaskCheckItemValueObject): GoAsync<TaskCheckItemEntity> {
        // 1. 转换为请求体
        const createRto = createTaskCheckItemValueObject2Req(createVO)
        // 2. 调用接口
        const response = await this.requester.post('/events/', createRto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 50010) {
            return [null, res.message]
        }
        // 4. 返回
        return [taskCheckItemRes2Entity(res.data as TaskCheckItemRes), null]
    }

    /**
     * update 更新任务检查项
     * @param id 任务检查项ID
     * @param updateVO 更新任务检查项值对象
     * @returns 更新结果
     */
    async update(id: string, updateVO: UpdateTaskCheckItemValueObject): GoAsync<void> {
        // 1. 转换为请求体
        const updateRto = updateTaskCheckItemValueObject2Req(updateVO)
        // 2. 调用接口
        const response = await this.requester.put(`/events/${id}`, updateRto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 50020) {
            return res.message
        }
        // 4. 返回
        return null
    }

    /**
     * delete 删除任务检查项
     * @param id 任务检查项ID
     * @returns 删除结果
     */
    async delete(id: string): GoAsync<void> {
        // 1. 调用接口
        const response = await this.requester.delete(`/events/${id}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 50030) {
            return res.message
        }
        // 4. 返回
        return null
    }

    /**
     * list 获取任务检查项列表
     * @param taskId 任务ID
     * @returns 任务检查项实体列表
     */
    async list(taskId: string): GoAsync<TaskCheckItemEntity[]> {
        // 1. 调用接口
        const response = await this.requester.get(`/events/?taskId=${taskId}`, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 50040) {
            return [null, res.message]
        }
        // 4. 返回
        return [listTaskCheckItemRes2Entities(res.data as TaskCheckItemRes[]), null]
    }

    /**
     * batchUpdate 批量更新任务检查项
     * @param updateVOs 更新任务检查项值对象列表
     * @returns 更新计数 + 更新结果列表
     */
    async batchUpdate(updateVOs: UpdateTaskCheckItemValueObject[]): GoAsync<TaskCheckItemEntity[]> {
        // 1. 转换为请求体
        const updateRto = updateTaskCheckItemValueObjects2BatchUpdateReq(updateVOs)
        // 2. 调用接口
        const response = await this.requester.put('/events/', updateRto, {
            headers: { Authorization: `Bearer ${getJWTFromLocalStorage()}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 50050) {
            return [null, res.message]
        }
        // 4. 返回
        return [batchUpdateTaskCheckItemRes2Entities(res.data as BatchUpdateTaskCheckItemRes), null]
    }
}

/**
 * 创建任务检查项仓库工厂方法
 * @param requester 请求器
 * @returns 任务检查项仓库
 */
export const newTaskCheckItemRepository = (requester: Requester) => {
    return new TaskCheckItemRepoImpl(requester)
}

