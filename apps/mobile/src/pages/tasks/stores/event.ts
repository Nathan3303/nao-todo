import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Event, GetEventsOptions } from '@nao-todo/types'
import { stringifyGetOptions } from '@nao-todo/utils'
import { doRequest } from '@/pages/tasks/stores/do-request'
import { ApiBaseURL } from '@/constants'

export const useEventStore = defineStore('eventStore', () => {
    const events = ref<Event[]>([])

    // 获取选项
    const getOptions = ref<GetEventsOptions>({})

    // 获取检查事项
    const getEvents = async () => {
        const queryString = stringifyGetOptions(getOptions.value)
        const result = await doRequest({
            method: 'GET',
            url: ApiBaseURL + `/events?${queryString}`
        })
        if (result.code !== 20000) return false
        events.value = result.data as Event[]
        return true
    }

    return {
        events,
        getOptions,
        getEvents
    }
})
