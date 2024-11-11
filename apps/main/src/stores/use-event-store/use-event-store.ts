import { reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import $axios from '@nao-todo/utils/axios'
import type { Event, EventFilterOptions } from './types'
import type { User } from '../use-user-store'

export const useEventStore = defineStore('eventStore', () => {
    const events = ref<Event[]>([])
    const filterInfo = ref<EventFilterOptions>({})
    const pageInfo = reactive({ page: 1, limit: 10 })

    // Inner methods

    const _stringifyFilterInfo = (specFilterInfo?: EventFilterOptions) => {
        const query: string[] = []
        const _filterInfo = specFilterInfo || filterInfo.value
        Object.keys(_filterInfo).forEach((key) => {
            const value = _filterInfo[key as keyof EventFilterOptions]
            query.push(`${key}=${value}`)
        })
        const queryString = query.join('&')
        return queryString
    }

    const _mergeFilterInfo = (newOne: EventFilterOptions) => {
        filterInfo.value = {
            ...filterInfo.value,
            ...newOne
        }
    }

    const _reset = () => {
        events.value = []
        filterInfo.value = {}
    }

    const _get = async (userId: User['id'], specFilterInfo?: EventFilterOptions) => {
        try {
            const { page, limit } = pageInfo
            const filterQueryString = _stringifyFilterInfo(specFilterInfo)
            const pageQueryString = `page=${page}&limit=${limit}`
            const URI = `/events?userId=${userId}&${pageQueryString}&${filterQueryString}`
            const {
                data: { data, code }
            } = await $axios.get(URI)
            const res = code === 20000 ? data : null
            // console.log('[EventStore] _get:', URI, res)
            return res
        } catch (e) {
            console.warn('[EventStore] _get:', e)
        }
    }

    const _update = async (
        userId: User['id'],
        eventId: Event['id'],
        updateInfo: Partial<Event>
    ) => {
        try {
            const URI = `/event?userId=${userId}&eventId=${eventId}`
            const {
                data: { data, code }
            } = await $axios.put(URI, updateInfo)
            const res = code === 20000 ? data : null
            // console.log('[EventStore] _update:', URI, updateInfo, res)
            return res
        } catch (e) {
            console.warn('[EventStore] _update:', e)
        }
    }

    const _remove = async (userId: User['id'], eventId: Event['id']) => {
        try {
            const URI = `/event?userId=${userId}&eventId=${eventId}`
            const {
                data: { data, code }
            } = await $axios.delete(URI)
            return code === 20000 ? data : null
        } catch (e) {
            console.warn('[EventStore] _remove:', e)
        }
    }

    const _create = async (userId: User['id'], createInfo: Partial<Event>) => {
        try {
            createInfo = { ...createInfo, userId }
            const {
                data: { data, code }
            } = await $axios.post('/event', createInfo)
            const res = code === 20000 ? data : null
            // console.log('[EventStore] _create:', createInfo, res)
            return res
        } catch (e) {
            console.warn('[EventStore] _create:', e)
        }
    }

    // Getter which from backend

    const get = async (userId: User['id'], filterInfo?: EventFilterOptions) => {
        if (filterInfo) _mergeFilterInfo(filterInfo)
        const getResult = await toGetted(userId)
        if (!getResult) return
        events.value = getResult
        return getResult
    }

    const initialize = async (userId: User['id'], filterInfo: EventFilterOptions) => {
        _reset()
        return await get(userId, filterInfo)
    }

    const update = async (userId: User['id'], eventId: Event['id'], updateInfo: Partial<Event>) => {
        const updateResult = await _update(userId, eventId, updateInfo)
        if (!updateResult) return
        updateLocal(eventId, updateInfo)
        return updateResult
    }

    const remove = async (userId: User['id'], eventId: Event['id']) => {
        const removeResult = await _remove(userId, eventId)
        if (!removeResult) return
        removeLocal(eventId)
        return removeResult
    }

    const create = async (userId: User['id'], createInfo: Partial<Event>) => {
        const createResult = await _create(userId, createInfo)
        if (!createResult) return
        createLocal(createResult)
        return createResult
    }

    // Getter which from local

    const findIndexLocal = (eventId: Event['id']) => {
        return events.value.findIndex((event) => event.id === eventId)
    }

    const findLocal = (eventId: Event['id']) => {
        const eventIndex = findIndexLocal(eventId)
        const res = eventIndex !== -1 ? events.value[eventIndex] : null
        return res as Event | null
    }

    const updateLocal = (eventId: Event['id'], updateInfo: Partial<Event>) => {
        const oldEventIndex = findIndexLocal(eventId)
        const oldEvent = events.value[oldEventIndex]
        if (!oldEvent) return
        const newEvent = { ...oldEvent, ...updateInfo }
        events.value[oldEventIndex] = newEvent
    }

    const removeLocal = async (eventId: Event['id']) => {
        const eventIndex = findIndexLocal(eventId)
        events.value.splice(eventIndex, 1)
    }

    const createLocal = (createInfo: Partial<Event>) => {
        const newEventTemplate: Event = {
            id: '',
            userId: '',
            todoId: '',
            title: '',
            createdAt: '',
            updatedAt: '',
            isDone: false,
            isTopped: false
        }
        const newEvent = { ...newEventTemplate, ...createInfo }
        events.value.push(newEvent)
    }

    // Getter which is pure function and from backend

    const toGetted = async (userId: User['id']) => {
        const getted = await _get(userId)
        return getted as Event[] | null
    }

    const toFinded = async (userId: User['id'], filterInfo: EventFilterOptions) => {
        const finded = await _get(userId, filterInfo)
        return finded as Event[] | null
    }

    const toFindedOne = async (userId: User['id'], eventId: Event['id']) => {
        const finded = await _get(userId, { id: eventId })
        const res = Array.isArray(finded) ? finded[0] : finded
        return res as Event | null
    }

    return {
        events,
        filterInfo,
        pageInfo,
        get,
        initialize,
        update,
        remove,
        create,
        findIndexLocal,
        findLocal,
        updateLocal,
        removeLocal,
        createLocal,
        toGetted,
        toFinded,
        toFindedOne
    }
})
