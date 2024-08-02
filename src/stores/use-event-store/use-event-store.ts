import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { naoTodoServer as $axios } from '@/axios'
import type { Event, EventFilterOptions } from './types'
import type { User } from '../use-user-store'
import type { Todo } from '../use-todo-store'

export const useEventStore = defineStore('eventStore', () => {
    const events = ref<Event[]>([])
    const filterInfo = ref<EventFilterOptions>({})
    const pageInfo = reactive({ page: 1, limit: 10 })

    const parseFilterInfoToQuery = (specFilterInfo?: EventFilterOptions) => {
        const query: string[] = []
        const _filterInfo = specFilterInfo || filterInfo.value
        Object.keys(_filterInfo).forEach((key) => {
            const value = _filterInfo[key as keyof EventFilterOptions]
            query.push(`${key}=${value}`)
        })
        const queryString = query.join('&')
        return queryString
    }

    const mergeFilterInfo = (newOne: EventFilterOptions) => {
        filterInfo.value = {
            ...filterInfo.value,
            ...newOne
        }
    }

    const getData = async (
        userId: User['id'],
        pageQueryString: string,
        filterQueryString: string
    ) => {
        const URI = `/events?userId=${userId}&${pageQueryString}&${filterQueryString}`
        const response = await $axios.get(URI)
        return response.data
    }

    const reset = () => {
        events.value = []
        filterInfo.value = {}
    }

    const init = async (userId: User['id'], filterInfo: EventFilterOptions) => {
        // reset()
        mergeFilterInfo(filterInfo)
        return await reload(userId)
    }

    const reload = async (userId: User['id']) => {
        const { page, limit } = pageInfo
        const filterQueryString = parseFilterInfoToQuery()
        const pageQueryString = `page=${page}&limit=${limit}`
        const response = await getData(userId, filterQueryString, pageQueryString)
        if (response.code === '20000') {
            events.value = response.data
        }
        return response
    }

    const get = async (userId: User['id'], filterInfo?: EventFilterOptions) => {
        const { page, limit } = pageInfo
        const filterQueryString = parseFilterInfoToQuery(filterInfo)
        const pageQueryString = `page=${page}&limit=${limit}`
        return await getData(userId, filterQueryString, pageQueryString)
    }

    const create = async (userId: User['id'], todoId: Todo['id'], title: Event['title']) => {
        const data = { userId, todoId, title }
        const response = await $axios.post('/event', data)
        if (response.data.code === '20000') {
            events.value.push(response.data.data)
        }
        return response.data
    }

    const toFindLocally = (eventId: Event['id']) => {
        return events.value.find((event) => event.id === eventId)
    }

    const update = async (userId: User['id'], eventId: Event['id'], updateInfo: Partial<Event>) => {
        const response = await $axios.put(`/event?userId=${userId}&id=${eventId}`, updateInfo)
        if (response.data.code === '20000') {
            console.log(response.data.data)
            const event = events.value.find((event) => event.id === eventId)
            if (event) {
                Object.assign(event, updateInfo)
            }
        }
        return response.data
    }

    const remove = async (userId: User['id'], eventId: Event['id']) => {
        const response = await $axios.delete(`/event?userId=${userId}&id=${eventId}`)
        if (response.data.code === '20000') {
            const index = events.value.findIndex((event) => event.id === eventId)
            if (index !== -1) {
                events.value.splice(index, 1)
            }
        }
    }

    return {
        events,
        filterInfo,
        pageInfo,
        init,
        get,
        reload,
        create,
        toFindLocally,
        update,
        remove
    }
})
