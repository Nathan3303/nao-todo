import { EventEntity } from '@nao-todo/domain/event/entities'
import type { CreateEventRes, GetEventRes, ListEventRes } from '../types'

export const getEventRes2EventEntity = (res: GetEventRes): EventEntity => {
    return new EventEntity(res.id, res.taskId, res.name, res.isDone, res.sortId)
}

export const createEventRes2EventEntity = (res: CreateEventRes): EventEntity => {
    return getEventRes2EventEntity(res)
}

export const listEventRes2EventEntities = (res: ListEventRes): EventEntity[] => {
    return res.map((event) => {
        return getEventRes2EventEntity(event)
    })
}
