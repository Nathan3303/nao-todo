import {
    createEventRes2EventEntity,
    getEventRes2EventEntity,
    listEventRes2EventEntities
} from './converters'
import type { EventEntity } from '@nao-todo/domain/event/entities'
import type { EventRepository } from '@nao-todo/domain/event/repositories'
import type { Requester } from '../../requester/types'
import type { GoAsync } from '@nao-todo/types'
import type {
    CreateEventReq,
    CreateEventRes,
    GetEventRes,
    ListEventRes,
    ResponseData,
    UpdateEventReq,
    UpdateEventRes
} from '../types'
import { CreateEventValueObject, UpdateEventValueObject } from '@nao-todo/domain/event'

/**
 * 检查事项仓库实现
 * @param requester 请求器
 * @returns 检查事项仓库
 */
export const useEventRepository = (requester: Requester): EventRepository => {
    /**
     * 获取检查事项
     * @param eventId 检查事项 ID
     * @returns 检查事项实体
     */
    const get = async (eventId: string): GoAsync<EventEntity> => {
        // 1. 调用接口
        const response = await requester.get(`/events/${eventId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 50000) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const eventEntity = getEventRes2EventEntity(res.data as GetEventRes)
        // 4. 返回
        return [eventEntity, null]
    }

    /**
     * 创建检查事项
     * @param createEventValueObject 创建检查事项值对象
     * @returns 检查事项实体
     */
    const create = async (createEventValueObject: CreateEventValueObject): GoAsync<EventEntity> => {
        // 1. 构建 rto
        const rto: CreateEventReq = {
            taskId: createEventValueObject.taskId,
            name: createEventValueObject.name
        }
        // 2. 调用接口
        const response = await requester.post('/events/', rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 50010) {
            return [null, res.message]
        }
        // 4. 转换为实体
        const eventEntity = createEventRes2EventEntity(res.data as CreateEventRes)
        // 5. 返回
        return [eventEntity, null]
    }

    /**
     * 更新检查事项
     * @param eventId 检查事项 ID
     * @param updateEventValueObject 更新检查事项值对象
     * @returns 检查事项 ID
     */
    const update = async (
        eventId: string,
        updateEventValueObject: UpdateEventValueObject
    ): GoAsync<string> => {
        // 1. 构建 rto
        const rto: UpdateEventReq = {}
        if (updateEventValueObject.name) rto.name = updateEventValueObject.name
        if (updateEventValueObject.isDone !== undefined) rto.isDone = updateEventValueObject.isDone
        if (updateEventValueObject.sortId !== undefined) rto.sortId = updateEventValueObject.sortId
        // 2. 调用接口
        const response = await requester.put(`/events/${eventId}`, rto, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 50020) {
            return [null, res.message]
        }
        // 4. 返回
        return [res.data as UpdateEventRes, null]
    }

    /**
     * 删除检查事项
     * @param eventId 检查事项 ID
     * @returns 无
     */
    const remove = async (eventId: string): GoAsync<void> => {
        // 1. 调用接口
        const response = await requester.delete(`/events/${eventId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 50030) {
            return res.message
        }
        // 3. 返回
        return null
    }

    /**
     * 获取任务下的检查事项列表
     * @param taskId 任务 ID
     * @returns 检查事项实体列表
     */
    const list = async (taskId: string): GoAsync<EventEntity[]> => {
        // 1. 调用接口
        const response = await requester.get(`/events/?taskId=${taskId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` }
        })
        // 2. 获取结果
        const res = response.data as ResponseData
        if (res.code !== 50040) {
            return [null, res.message]
        }
        // 3. 转换为实体
        const eventEntities = listEventRes2EventEntities(res.data as ListEventRes)
        // 4. 返回
        return [eventEntities, null]
    }

    return { create, get, update, remove, list }
}

