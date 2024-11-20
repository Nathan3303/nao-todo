import $axios from '@nao-todo/utils/axios'
import { stringifyGetOptions } from '@nao-todo/utils'
import { defaultGetEventsOptions } from './constants'
import type {
    Event,
    CreateEventOptions,
    ResponseData,
    UpdateEventOptions,
    GetEventsOptions
} from '@nao-todo/types'

// 添加检查事项
export const createEvent = async (options: CreateEventOptions) => {
    try {
        const response = await $axios.post(`/event`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/event] createEvent:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 删除检查事项
export const deleteEvent = async (id: Event['id']) => {
    try {
        const response = await $axios.delete(`/event?eventId=${id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/event] deleteEvent:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 更新待办
export const updateEvent = async (id: Event['id'], options: UpdateEventOptions) => {
    try {
        const response = await $axios.put(`/event?eventId=${id}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/event] updateEvent:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 获取待办（s）
export const getEvents = async (options: GetEventsOptions = defaultGetEventsOptions) => {
    try {
        const queryString = stringifyGetOptions(options)
        const response = await $axios.get(`/events?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/event] getEvents:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
