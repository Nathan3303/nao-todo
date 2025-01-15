import type {
    CreateEventOptions,
    Event,
    GetEventsOptions,
    Requester,
    ResponseData,
    UpdateEventOptions
} from '@nao-todo/types'
import { stringifyGetOptions } from '@nao-todo/utils'

export const defaultGetEventsOptions: GetEventsOptions = {}

export const createEventV2 = async (requester: Requester, options: CreateEventOptions) => {
    try {
        const response = await requester(`/event`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/create-event-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const deleteEventV2 = async (requester: Requester, id: Event['id']) => {
    try {
        const response = await requester(`/event?eventId=${id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/delete-event-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const updateEventV2 = async (
    requester: Requester,
    id: Event['id'],
    options: UpdateEventOptions
) => {
    try {
        const response = await requester(`/event?eventId=${id}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-event-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const getEventsV2 = async (
    requester: Requester,
    options: GetEventsOptions = defaultGetEventsOptions
) => {
    try {
        const queryString = stringifyGetOptions(options)
        const response = await requester(`/events?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-events-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
