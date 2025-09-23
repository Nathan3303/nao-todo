import { createEventApiV2, getEventsApiV2 } from '@nao-todo/apis/v2'
import type {
    CreateEventOptions,
    GetEventsOptions,
    ResponseData,
    GoLike,
    Requester,
    Event
} from '@nao-todo/types'

const CREATE_EVENT_SUCCESS_CODE = 50010
const GET_EVENTS_SUCCESS_CODE = 50050
// const GET_EVENT_SUCCESS_CODE = 50000
// const UPDATE_EVENT_SUCCESS_CODE = 50020
// const DELETE_EVENT_SUCCESS_CODE = 50030
// const RESTORE_EVENT_SUCCESS_CODE = 50040

export const createEventHandler = async (
    options: CreateEventOptions,
    requester: Requester
): Promise<GoLike> => {
    // 参数判断
    if (options.name === '') return [null, '检查事项名称不能为空']
    // 调用 API 创建检查事项
    const apiRes = await createEventApiV2(requester, options)
    // 处理成功结果
    if (apiRes.code === CREATE_EVENT_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const getEventsHandler = async (
    getOptions: GetEventsOptions,
    requester: Requester
): Promise<GoLike<{ events: Event[]; pagination: ResponseData['pagination'] } | null>> => {
    // 调用 API 获取检查事项列表
    const apiRes = await getEventsApiV2(requester, getOptions)
    // 处理成功结果
    if (apiRes.code === GET_EVENTS_SUCCESS_CODE) {
        return [
            {
                events: apiRes.data as Event[],
                pagination: apiRes.pagination
            },
            null
        ]
    }
    // 处理失败结果
    return [null, apiRes.message]
}
