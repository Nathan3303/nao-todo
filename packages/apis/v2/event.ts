import { stringifyGetOptions } from '@nao-todo/utils'
import type {
    CreateEventOptions,
    Event,
    GetEventsOptions,
    Requester,
    ResponseData,
    UpdateEventOptions
} from '@nao-todo/types'

export const createEventApiV2 = async (requester: Requester, options: CreateEventOptions) => {
    try {
        const response = await requester.post(`/event/`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/create-event-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const deleteEventApiV2 = async (requester: Requester, id: Event['id']) => {
    try {
        const response = await requester.delete(`/event/${id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/delete-event-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const updateEventApiV2 = async (
    requester: Requester,
    id: Event['id'],
    options: UpdateEventOptions
) => {
    try {
        const response = await requester.put(`/event/${id}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-event-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const getEventsApiV2 = async (requester: Requester, options: GetEventsOptions) => {
    try {
        let queryString = stringifyGetOptions(options)
        queryString = queryString ? `?${queryString}` : ''
        const response = await requester.get(`/events/${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-events-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}
