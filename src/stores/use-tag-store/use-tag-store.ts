import { reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { naoTodoServer as $axios } from '@/axios'
import type { Tag, TagFilterOptions } from './types'
import type { User } from '..'

export const useTagStore = defineStore('tagStore', () => {
    const tags = ref<Tag[]>([])
    const filterInfo = ref<TagFilterOptions>({})
    const pageInfo = reactive({ page: 1, limit: 10 })

    const parseFilterInfoToQuery = (specFilterInfo?: TagFilterOptions) => {
        const query: string[] = []
        const _filterInfo = specFilterInfo || filterInfo.value
        Object.keys(_filterInfo).forEach((key) => {
            const value = _filterInfo[key as keyof TagFilterOptions]
            query.push(`${key}=${value}`)
        })
        const queryString = query.join('&')
        return queryString
    }

    const mergeFilterInfo = (newOne: TagFilterOptions) => {
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
        const URI = `/tags?userId=${userId}&${pageQueryString}&${filterQueryString}`
        const response = await $axios.get(URI)
        return response.data
    }

    const reset = () => {
        tags.value = []
        filterInfo.value = {}
    }

    const init = async (userId: User['id'], filterInfo: TagFilterOptions) => {
        reset()
        mergeFilterInfo(filterInfo)
        return await reload(userId)
    }

    const reload = async (userId: User['id']) => {
        const { page, limit } = pageInfo
        const filterQueryString = parseFilterInfoToQuery()
        const pageQueryString = `page=${page}&limit=${limit}`
        const response = await getData(userId, filterQueryString, pageQueryString)
        if (response.code === '20000') {
            tags.value = response.data
        }
        return response
    }

    const get = async (userId: User['id'], filterInfo?: TagFilterOptions) => {
        const { page, limit } = pageInfo
        const filterQueryString = parseFilterInfoToQuery(filterInfo)
        const pageQueryString = `page=${page}&limit=${limit}`
        return await getData(userId, filterQueryString, pageQueryString)
    }

    const create = async (userId: User['id'], name: Tag['name'], color: Tag['color']) => {
        const data = { userId, name, color }
        const response = await $axios.post('/tag', data)
        if (response.data.code === '20000') {
            tags.value.push(response.data.data)
        }
        return response.data
    }

    const toFindLocally = (tagId: Tag['id']) => {
        return tags.value.find((tag) => tag.id === tagId)
    }

    const update = async (userId: User['id'], tagId: Tag['id'], updateInfo: Partial<Tag>) => {
        const response = await $axios.put(`/tag?userId=${userId}&tagId=${tagId}`, updateInfo)
        if (response.data.code === '20000') {
            console.log(response.data.data)
            const tag = tags.value.find((tag) => tag.id === tagId)
            if (tag) {
                Object.assign(tag, updateInfo)
            }
        }
        return response.data
    }

    return {
        tags,
        filterInfo,
        pageInfo,
        init,
        get,
        reload,
        create,
        toFindLocally,
        update
    }
})
