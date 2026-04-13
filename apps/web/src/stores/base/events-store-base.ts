import { computed, ref } from 'vue'
import type { EventViewObject, UpdateEventViewObject } from '@nao-todo/types'

const useEventsStoreBase = () => {
    // @state 检查事项数组
    const events = ref<EventViewObject[]>([])

    // @state 检查事项 Map
    const eventMap = computed(() => {
        return new Map(events.value.map((e) => [e.id, e]))
    })

    // @method 添加检查事项
    const addEvent = (event: EventViewObject) => {
        const idx = events.value.findIndex((e) => e.id === event.id)
        if (idx !== -1) return
        events.value.push(event)
    }

    // @method 获取检查事项
    const getEvent = (eventId: EventViewObject['id']) => {
        if (!eventMap.value) return void 0
        return eventMap.value.get(eventId)
    }

    // @method 设置检查事项
    const setEvents = (newEvents: EventViewObject[]) => {
        events.value = newEvents
    }

    // @method 更新检查事项
    const updateEvent = (eventId: EventViewObject['id'], event: UpdateEventViewObject) => {
        const idx = events.value.findIndex((e) => e.id === eventId)
        if (idx === -1) return
        events.value[idx] = { ...events.value[idx], ...event }
        console.log(events.value)
    }

    // @method 删除检查事项
    const deleteEvent = (eventId: EventViewObject['id']) => {
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

