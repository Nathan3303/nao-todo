import { computed, ref } from 'vue'
import type { Event, UpdateEvent } from '@nao-todo/types'

const useEventsStoreBase = () => {
    // @state 检查事项数组
    const events = ref<Event[]>([])

    // @state 检查事项 Map
    const eventMap = computed(() => {
        return new Map(events.value.map((e) => [e.id, e]))
    })

    // @method 添加检查事项
    const addEvent = (event: Event) => {
        const idx = events.value.findIndex((e) => e.id === event.id)
        if (idx !== -1) return
        events.value.push(event)
    }

    // @method 获取检查事项
    const getEvent = (eventId: Event['id']) => {
        return eventMap.value?.get(eventId)
    }

    // @method 设置检查事项
    const setEvents = (newEvents: Event[]) => {
        events.value = newEvents
    }

    // @method 更新检查事项
    const updateEvent = (eventId: Event['id'], event: UpdateEvent) => {
        const idx = events.value.findIndex((e) => e.id === eventId)
        if (idx === -1) return
        events.value[idx] = { ...events.value[idx], ...event }
    }

    // @method 删除检查事项
    const deleteEvent = (eventId: Event['id']) => {
        events.value = events.value.filter((e) => e.id !== eventId)
    }

    // @returns
    return {
        events,
        addEvent,
        getEvent,
        setEvents,
        updateEvent,
        deleteEvent
    }
}

export default useEventsStoreBase
export type EventsStoreBase = ReturnType<typeof useEventsStoreBase>
