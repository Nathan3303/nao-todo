import { ref } from 'vue'
import { defineStore } from 'pinia'
import { createEvent, deleteEvent, getEvents, updateEvent } from '@nao-todo/apis'
import type {
    CreateEventOptions,
    Event,
    GetEventsOptions,
    UpdateEventOptions,
    UpdateEventOptionsRaw
} from '@nao-todo/types'

export const useEventStore = defineStore('eventStore', () => {
    const events = ref<Event[]>([])

    // 获取选项
    const getOptions = ref<GetEventsOptions>({})

    // 创建检查事项
    const doCreateEvent = async (options: CreateEventOptions) => {
        const result = await createEvent(options)
        if (result.code !== 20000) return false
        const newEvent = result.data as Event
        events.value.push(newEvent)
        return true
    }

    // 更新检查事项
    const doUpdateEvent = async (eventId: Event['id'], options: UpdateEventOptions) => {
        const result = await updateEvent(eventId, options)
        if (result.code !== 20000) return false
        const index = events.value.findIndex((event) => event.id === eventId)
        if (index === -1) return false
        Object.keys(events.value[index]).forEach((key) => {
            if (key in options) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                events.value[index][key] = options[key as keyof UpdateEventOptionsRaw]
            }
        })
        return true
    }

    // 获取检查事项
    const doGetEvents = async () => {
        const result = await getEvents(getOptions.value)
        if (result.code !== 20000) return false
        events.value = result.data as Event[]
        return true
    }

    // 删除检查事项
    const doDeleteEvent = async (eventId: Event['id']) => {
        const result = await deleteEvent(eventId)
        if (result.code !== 20000) return false
        events.value = events.value.filter((event) => event.id !== eventId)
        return true
    }

    return {
        events,
        getOptions,
        doCreateEvent,
        doUpdateEvent,
        doDeleteEvent,
        doGetEvents
    }
})
