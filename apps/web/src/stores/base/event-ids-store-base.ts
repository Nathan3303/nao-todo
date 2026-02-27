import { computed, ref } from 'vue'
import type { EventsStoreBase } from './events-store-base'
import type { Event } from '@nao-todo/types'

const useEventIdsStoreBase = (getEvent: EventsStoreBase['getEvent']) => {
    // @state 检查事项 ID 数组
    const eventIds = ref<Event['id'][]>([])

    // @state 检查事项数组 - 用于展示
    const events = computed(() => {
        const _events = eventIds.value.map((id) => getEvent(id)!).filter(Boolean)
        if (_events.length === 0) return []
        return _events.sort((a, b) => a.sortId - b.sortId)
    })

    // @method 设置检查事项 ID 数组
    const setEventIds = (newEventIds: Event['id'][]) => {
        eventIds.value = newEventIds
    }

    // @method 添加检查事项 ID
    const addEventId = (newEventId: Event['id']) => {
        // 检查是否已存在
        if (eventIds.value.includes(newEventId)) {
            return
        }
        eventIds.value.push(newEventId)
    }

    // @method 删除检查事项 ID
    const removeEventId = (eventId: Event['id']) => {
        eventIds.value = eventIds.value.filter((id) => id !== eventId)
    }

    // @return
    return {
        eventIds,
        events,
        setEventIds,
        addEventId,
        removeEventId
    }
}

export default useEventIdsStoreBase
export type EventIdsStoreBase = ReturnType<typeof useEventIdsStoreBase>
