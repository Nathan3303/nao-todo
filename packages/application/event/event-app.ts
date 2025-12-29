import { useEventDomain } from '@nao-todo/domain/event'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import { useEventRepository } from '@nao-todo/infrastructure/backend/event/repoImpl'
import type { GoAsync } from '@nao-todo/types'
import type {
    // CreateEventVO,
    EventVO,
    TaskVO
    // UpdateEventVO
} from '@nao-todo/types'
import { eventEntities2VOs } from './converters'
import { ref, type Ref } from 'vue'
import useListMapper from '@nao-todo/infrastructure/hooks/use-list-mapper'

export interface EventApp {
    events: Ref<EventVO[]>
    listEvent: (taskId: TaskVO['id']) => GoAsync<EventVO[]>
    // createEvent: (createVO: CreateEventVO) => GoAsync<EventVO>
    // updateEvent: (id: EventVO['id'], updateVO: UpdateEventVO) => GoAsync<void>
    // deleteEvent: (id: EventVO['id']) => GoAsync<void>
    getByIdFromMap: (id: EventVO['id']) => EventVO | undefined
}

export default (): EventApp => {
    // @domain Event domain
    const eventDomain = useEventDomain(useEventRepository(getRequesterImpl()))

    /**
     * 清单列表以及相关方法
     */

    // @state
    const events = ref<EventVO[]>([])

    // @method 获取检查事项列表
    const listEvent = async (taskId: TaskVO['id']): GoAsync<EventVO[]> => {
        // 1. 参数检查
        if (!taskId) return [null, '参数错误']
        // 2. 调用域服务 - 获取检查事项列表
        const [eventEntities, err] = await eventDomain.list(taskId)
        if (err !== null) return [null, err]
        // 3. 转换
        events.value = eventEntities2VOs(eventEntities)
        // 4. 返回
        return [events.value, null]
    }

    /**
     * 检查事项 Mapper 以及相关方法
     * 主要提供 O(1) 时间复杂度的查询，用于在视图层快速获取检查事项详情
     * Computed 实现响应式变化
     */

    // @hook useListMapper
    const {
        get: getByIdFromMap
        // remove: removeFromMap,
        // add: addToMap
    } = useListMapper(events)

    /**
     * 返回
     */
    return { events, listEvent, getByIdFromMap }
}
