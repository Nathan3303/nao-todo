import { defineStore } from 'pinia'
import { ref } from 'vue'
import { unwrapError } from '@nao-todo/utils'
import { requester } from './requester'
import type { CreateEventOptions, Err, GetEventsOptions, Event, ResponseData } from '@nao-todo/types'
import { createEventHandler, getEventsHandler } from '@nao-todo/handlers/v1'

const useEventStore = defineStore('EventStore', () => {
    // @state 检查事项列表（应该被应用于整个视图）
    const events = ref<Event[]>([])
    const pagination = ref<ResponseData['pagination']>({ total: 0, page: 1, limit: 10, maxPage: 1 })

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
        if (res) {
            events.value = res.events
            pagination.value = res.pagination
        }
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

    // @method 删除检查事项
    // const deleteProject = async (projectId: Project['id']): Promise<Err> => {
    //     // 参数判断
    //     if (!projectId) return '检查事项ID不能为空'
    //     // 删除检查事项
    //     const [, err] = await deleteProjectHandler(projectId)
    //     // 处理失败结果
    //     if (err) {
    //         console.error(unwrapError(err))
    //         return err
    //     }
    //     // 处理成功结果
    //     // projects.value = projects.value.filter((project) => project.id !== projectId)
    //     projects.value.forEach((project) => {
    //         if (project.id === projectId) {
    //             project.isDeleted = true
    //         }
    //     })
    //     return null
    // }

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

    return {
        events,
        pagination,
        getEvents,
        createEvent
    }
})

export default useEventStore
