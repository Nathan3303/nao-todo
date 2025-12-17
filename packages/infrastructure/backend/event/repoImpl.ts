import {
    createEventRes2EventEntity,
    getEventRes2EventEntity,
    listEventRes2EventEntities
} from './converters'
import { EventEntity } from '@nao-todo/domain/event/entities'
import type { EventRepository } from '@nao-todo/domain/event/repositories'
import type { Requester } from '../../requester/types'
import type { Err, GoLike } from '@nao-todo/types'
import type {
    CreateEventReq,
    CreateEventRes,
    GetEventRes,
    ListEventRes,
    ResponseData,
    UpdateEventReq,
    UpdateEventRes
} from '../types'

export const useEventRepository = (requester: Requester): EventRepository => {
    const get = async (eventId: string): Promise<GoLike<EventEntity | null>> => {
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
    const create = async (eventEntity: EventEntity): Promise<GoLike<EventEntity | null>> => {
        // 1. 构建 rto
        const rto: CreateEventReq = {
            taskId: eventEntity.taskId,
            name: eventEntity.name,
            description: eventEntity.description,
        }
        // 2. 调用接口
        const response = await requester.post('/events', {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 50010) {
            return [null, res.message]
        }
        // 4. 转换为实体
        eventEntity = createEventRes2EventEntity(res.data as CreateEventRes)
        // 5. 返回
        return [eventEntity, null]
    }

    const update = async (
        eventId: string,
        eventEntity: EventEntity
    ): Promise<GoLike<string | null>> => {
        // 1. 构建 rto
        const rto: UpdateEventReq = {}
        if (eventEntity.name) rto.name = eventEntity.name
        if (eventEntity.description) rto.description = eventEntity.description
        // 2. 调用接口
        const response = await requester.put(`/events/${eventId}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('USER_JWT')}` },
            data: rto
        })
        // 3. 判断结果
        const res = response.data as ResponseData
        if (res.code !== 50020) {
            return [null, res.message]
        }
        // 4. 返回
        const data = res.data as UpdateEventRes
        return [data.eventId, null]
    }

    const remove = async (eventId: string): Promise<Err> => {
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

    const list = async (): Promise<GoLike<EventEntity[] | null>> => {
        // 1. 调用接口
        const response = await requester.get('/events/', {
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
