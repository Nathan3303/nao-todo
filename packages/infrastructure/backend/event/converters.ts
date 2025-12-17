import { EventEntity } from '@nao-todo/domain/event/entities'
import type { CreateEventRes, GetEventRes, ListEventRes } from '../types'

export const getEventRes2EventEntity = (res: GetEventRes): EventEntity => {
    const e = new EventEntity()
    e.id = res.id
    e.taskId = res.taskId
    e.name = res.name
    e.description = res.description
    e.isDone = res.isDone
    e.sortId = res.sortId
    return e
}

export const createEventRes2EventEntity = (res: CreateEventRes): EventEntity => {
    return getEventRes2EventEntity(res)
}

export const listEventRes2EventEntities = (res: ListEventRes): EventEntity[] => {
    return res.map((event) => {
        return getEventRes2EventEntity(event)
    })
}
