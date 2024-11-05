import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import $axios from '@nao-todo/utils/axios'
import type { Tag, TagFilterOptions } from './types'
import type { TagBarEmits } from '@nao-todo/components/tag/bar/types'

export const useTagStore = defineStore('tagStore', () => {
    const tags = ref<Tag[]>([])
    const filterInfo = ref<TagFilterOptions>({})
    const pageInfo = reactive({ page: 1, limit: 10 })

    // Inner methods

    const _stringifyFilterInfo = (specFilterInfo?: TagFilterOptions) => {
        const query: string[] = []
        const _filterInfo = specFilterInfo || filterInfo.value
        Object.keys(_filterInfo).forEach((key) => {
            const value = _filterInfo[key as keyof TagFilterOptions]
            query.push(`${key}=${value}`)
        })
        return query.join('&')
    }

    const _mergeFilterInfo = (newOne: Partial<TagFilterOptions>) => {
        const newFilterInfo = { ...filterInfo.value, ...newOne }
        filterInfo.value = newFilterInfo
    }

    const _reset = () => {
        tags.value = []
        filterInfo.value = {}
    }

    const _get = async (userId: Tag['userId'], specFilterInfo?: TagFilterOptions) => {
        try {
            const { page, limit } = pageInfo
            const filterQueryString = _stringifyFilterInfo(specFilterInfo)
            const pageQueryString = `page=${page}&limit=${limit}`
            const URI = `/tags?userId=${userId}&${pageQueryString}&${filterQueryString}`
            const {
                data: { data, code }
            } = await $axios.get(URI)
            const res = code === '20000' ? data : null
            // console.log('[tagStore] _get:', URI, res);
            return res
        } catch (e) {
            console.warn('[tagStore] _get:', e)
        }
    }

    const _update = async (userId: Tag['userId'], tagId: Tag['id'], updateInfo: Partial<Tag>) => {
        try {
            const URI = `/tag?userId=${userId}&tagId=${tagId}`
            const {
                data: { data, code }
            } = await $axios.put(URI, updateInfo)
            const res = code === '20000' ? data : null
            // console.log('[tagStore] _update:', URI, updateInfo, res)
            return res
        } catch (e) {
            console.warn('[tagStore] _update:', e)
        }
    }

    const _remove = async (userId: Tag['userId'], tagId: Tag['id']) => {
        try {
            const URI = `/tag?userId=${userId}&tagId=${tagId}`
            const {
                data: { data, code }
            } = await $axios.delete(URI)
            return code === '20000' ? data : null
        } catch (e) {
            console.warn('[tagStore] _remove:', e)
        }
    }

    const _create = async (userId: Tag['userId'], createInfo: Partial<Tag>) => {
        try {
            createInfo = { ...createInfo, userId }
            const {
                data: { data, code }
            } = await $axios.post('/tag', createInfo)
            const res = code === '20000' ? data : null
            // console.log('[tagStore] _create:', createInfo, res)
            return res
        } catch (e) {
            console.warn('[tagStore] _create:', e)
        }
    }

    // Getter which from backend

    const get = async (userId: Tag['userId'], filterInfo?: Partial<TagFilterOptions>) => {
        if (filterInfo) _mergeFilterInfo(filterInfo)
        const getResult = await toGetted(userId)
        if (!getResult) return
        tags.value = getResult
        return getResult
    }

    const initialize = async (userId: Tag['userId'], filterInfo: Partial<TagFilterOptions>) => {
        _reset()
        await get(userId, filterInfo)
    }

    const update = async (userId: Tag['userId'], tagId: Tag['id'], updateInfo: Partial<Tag>) => {
        const updateResult = await _update(userId, tagId, updateInfo)
        if (!updateResult) return
        updateLocal(tagId, updateInfo)
        return updateResult
    }

    const remove = async (userId: Tag['userId'], tagId: Tag['id']) => {
        const removeResult = await _remove(userId, tagId)
        if (!removeResult) return
        removeLocal(tagId)
        return removeResult
    }

    const create = async (userId: Tag['userId'], createInfo: Partial<Tag>) => {
        const createResult = await _create(userId, createInfo)
        if (!createResult) return
        createLocal(createResult)
        return createResult
    }

    // Getter which from local

    const findIndexLocal = (tagId: Tag['id']) => {
        return tags.value.findIndex((tag) => tag.id === tagId)
    }

    const findLocal = (tagId: Tag['id']) => {
        const tagIndex = findIndexLocal(tagId)
        const res = tagIndex !== -1 ? tags.value[tagIndex] : null
        return res as Tag | null
    }

    const updateLocal = (tagId: Tag['id'], updateInfo: Partial<Tag>) => {
        const oldTagIndex = findIndexLocal(tagId)
        const oldTag = tags.value[oldTagIndex]
        if (!oldTag) return
        const newTag = { ...oldTag, ...updateInfo }
        tags.value[oldTagIndex] = newTag
    }

    const removeLocal = async (tagId: Tag['id']) => {
        const tagIndex = findIndexLocal(tagId)
        tags.value.splice(tagIndex, 1)
    }

    const createLocal = (createInfo: Partial<Tag>) => {
        const newTagTemplate: Tag = {
            id: '',
            userId: '',
            name: '',
            color: '',
            createdAt: '',
            updatedAt: '',
            isDeleted: false
        }
        const newTag = { ...newTagTemplate, ...createInfo }
        tags.value.push(newTag)
    }

    const filterLocal = (filterOptions: TagFilterOptions) => {
        const newTags: Tag[] = []
        if (Object.keys(filterOptions).length === 0) {
            return tags.value
        }
        tags.value.forEach((tag) => {
            const isMatched = Object.entries(filterOptions).every(([key, value]) => {
                if (key === 'name') {
                    return tag.name.includes(value as string)
                }
                return tag[key as keyof Tag] === value
            })
            if (isMatched) newTags.push(tag)
        })
        return newTags
    }

    // Getter which is pure function and from backend

    const toGetted = async (userId: Tag['userId']) => {
        const getted = await _get(userId)
        return getted as Tag[] | null
    }

    const toFinded = async (userId: Tag['userId'], filterInfo: TagFilterOptions) => {
        const finded = await _get(userId, filterInfo)
        return finded as Tag[] | null
    }

    const toFindedOne = async (userId: Tag['userId'], tagId: Tag['id']) => {
        const finded = await _get(userId, { id: tagId })
        const res = Array.isArray(finded) ? finded[0] : finded
        return res as Tag | null
    }

    // Other getters

    const smartListData = computed(() => {
        const filterOptions: TagFilterOptions = {
            isDeleted: false,
            page: 1,
            limit: 99
        }
        const newTags: Tag[] = []
        tags.value.forEach((tag) => {
            const isMatched = Object.keys(filterOptions).every((key) => {
                const value = filterOptions[key as keyof TagFilterOptions]
                return tag[key as keyof Tag] === value
            })
            if (isMatched) newTags.push(tag)
        })
        return newTags
    })

    return {
        tags,
        smartListData,
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
        filterLocal,
        toGetted,
        toFinded,
        toFindedOne
    }
})
