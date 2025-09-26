import {
    createEventApiV2,
    getEventsApiV2,
    updateEventApiV2,
    deleteEventApiV2
} from '@nao-todo/apis/v2'
import type {
    CreateEventOptions,
    GetEventsOptions,
    GoLike,
    Requester,
    Event,
    UpdateEventOptions
} from '@nao-todo/types'

const CREATE_EVENT_SUCCESS_CODE = 50010
const GET_EVENTS_SUCCESS_CODE = 50000
const UPDATE_EVENT_SUCCESS_CODE = 50020
const DELETE_EVENT_SUCCESS_CODE = 50030
// const GET_EVENT_SUCCESS_CODE = 50000
// const RESTORE_EVENT_SUCCESS_CODE = 50040

export const createEventHandler = async (
    createOptions: CreateEventOptions,
    requester: Requester
): Promise<GoLike> => {
    // 参数判断
    if (createOptions.name === '') return [null, '检查事项名称不能为空']
    // 调用 API 创建检查事项
    const apiRes = await createEventApiV2(requester, createOptions)
    // 处理成功结果
    if (apiRes.code === CREATE_EVENT_SUCCESS_CODE) {
        return [apiRes.data as Event, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const getEventsHandler = async (
    getOptions: GetEventsOptions,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 获取检查事项列表
    const apiRes = await getEventsApiV2(requester, getOptions)
    // 处理成功结果
    if (apiRes.code === GET_EVENTS_SUCCESS_CODE) {
        return [apiRes.data as Event[], null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const updateEventHandler = async (
    eventId: Event['id'],
    options: UpdateEventOptions,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 更新检查事项
    const apiRes = await updateEventApiV2(requester, eventId, options)
    // 处理成功结果
    if (apiRes.code === UPDATE_EVENT_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const deleteEventHandler = async (
    eventId: Event['id'],
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 删除检查事项
    const apiRes = await deleteEventApiV2(requester, eventId)
    // 处理成功结果
    if (apiRes.code === DELETE_EVENT_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}
