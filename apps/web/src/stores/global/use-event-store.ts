import { defineStore } from 'pinia'
import { ref } from 'vue'
import { unwrapError } from '@nao-todo/utils'
import { requester } from './requester'
import {
    createEventHandler,
    getEventsHandler,
    updateEventHandler,
    deleteEventHandler
} from '@nao-todo/handlers/v1'
import type {
    CreateEventOptions,
    Err,
    GetEventsOptions,
    Event,
    UpdateEventOptions
} from '@nao-todo/types'

const useEventStore = defineStore('EventStore', () => {
    // @state 检查事项列表（应该被应用于整个视图）
    const events = ref<Event[]>([])
    // const pagination = ref<ResponseData['pagination']>({ total: 0, page: 1, limit: 10, maxPage: 1 })

    // @method 进一步筛选检查事项列表
    const getEvents = async (options: GetEventsOptions): Promise<Err> => {
        // 获取检查事项列表
        const [res, err] = await getEventsHandler(options, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        events.value = res || []
        return null
    }

    // @method 创建检查事项
    const createEvent = async (createOptions: CreateEventOptions): Promise<Err> => {
        // 参数判断
        if (!createOptions.name) return '检查事项名称不能为空'
        // 创建检查事项
        const [res, err] = await createEventHandler(createOptions, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        events.value.push(res)
        return null
    }

    // @method 更新检查事项
    const updateEvent = async (eventId: Event['id'], options: UpdateEventOptions): Promise<Err> => {
        // 创建检查事项
        const [, err] = await updateEventHandler(eventId, options, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        events.value.forEach((event) => {
            if (event.id === eventId) {
                if (options.name) event.name = options.name
                if (options.description) event.description = options.description
                if (typeof options.isDone === 'boolean') event.isDone = options.isDone
                if (options.sortId) event.sortId = options.sortId
            }
        })
        return null
    }

    // @method 删除检查事项
    const deleteEvent = async (eventId: Event['id']): Promise<Err> => {
        // 参数判断
        if (!eventId) return '检查事项ID不能为空'
        // 删除检查事项
        const [, err] = await deleteEventHandler(eventId, requester)
        // 处理失败结果
        if (err) {
            console.error(unwrapError(err))
            return err
        }
        // 处理成功结果
        events.value = events.value.filter((event) => event.id !== eventId)
        return null
    }

    // @method 删除检查事项（带确认）
    // const deleteProjectWithConfirm = async (projectId: Project['id']): Promise<Err> => {
    //     return (await NueConfirm({
    //         title: '删除检查事项',
    //         content: '确定要删除此检查事项吗？',
    //         confirmButtonText: '删除',
    //         cancelButtonText: '取消',
    //         onConfirm: async () => {
    //             const err = await deleteProject(projectId)
    //             if (err) {
    //                 NueMessage.error(unwrapError(err))
    //                 return err
    //             }
    //             NueMessage.success('删除成功')
    //             return 'ok'
    //         }
    //     })) as Err
    // }

    // @method 清除必要的状态
    const __resetStates = () => {
        events.value = [] as Event[]
    }

    return {
        events,
        // pagination,
        getEvents,
        createEvent,
        updateEvent,
        deleteEvent,
        __resetStates
    }
})

export default useEventStore
