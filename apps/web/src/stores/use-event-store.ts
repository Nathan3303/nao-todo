import { ref } from 'vue'
import { defineStore } from 'pinia'
import { getEvents } from '@nao-todo/apis'
import type { GetEventsOptions, Event, Todo } from '@nao-todo/types'

export const useEventStore = defineStore('eventStore', () => {
    const events = ref<Event[]>([])

    // 获取选项
    const getOptions = ref<GetEventsOptions>({})

    // 获取待办
    const doGetEvents = async (todoId: Todo['id']) => {
        const result = await getEvents({ ...getOptions.value, todoId })
        if (result.code !== 20000) return false
        events.value = result.data as Event[]
        return true
    }

    return {
        events,
        doGetEvents
    }
})
