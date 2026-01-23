import { ref } from 'vue'
import type { Event } from '@nao-todo/types'

const useEventsStoreBase = () => {
    // @state 检查事项 Map
    const eventMap = ref<Map<Event['id'], Event>>()

    // @method 添加检查事项
    const addEvent = (event: Event) => {
        eventMap.value?.set(event.id, event)
    }

    // @method 获取检查事项
    const getEvent = (eventId: Event['id']) => {
        return eventMap.value?.get(eventId)
    }

    // @method 设置检查事项 Map
    const setEvents = (events: Event[]) => {
        eventMap.value = new Map(events.map((event) => [event.id, event]))
    }

    // @returns
    return {
        addEvent,
        getEvent,
        setEvents
    }
}

export default useEventsStoreBase
export type EventsStoreBase = ReturnType<typeof useEventsStoreBase>
