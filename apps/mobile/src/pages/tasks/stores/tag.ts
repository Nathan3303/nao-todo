import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { GetTagsOptions, Tag } from '@nao-todo/types'
import { tagStoreDefaults } from '@/pages/tasks/constants'
import { stringifyGetOptions } from '@nao-todo/utils'
import { doRequest } from '@/pages/tasks/stores/do-request'
import { ApiBaseURL } from '@/constants'

export const useTagStore = defineStore('tagStore', () => {
    const tags = ref<Tag[]>([])

    // 获取选项
    const getOptions = shallowRef<GetTagsOptions>(tagStoreDefaults.getOptions)

    // 智能标签列表
    const smartListData = computed<Tag[]>(() => {
        return tags.value.filter((tag) => {
            return !tag.isDeleted
        })
    })

    // 获取标签
    const getTags = async () => {
        const queryString = stringifyGetOptions(getOptions.value)
        const result = await doRequest({
            method: 'GET',
            url: ApiBaseURL + `/tags?${queryString}`
        })
        if (result.code !== 20000) return false
        tags.value = result.data as Tag[]
        return true
    }

    // 查找本地标签
    const getTagByIdFromLocal = (tagId: Tag['id']) => {
        return tags.value.find((tag) => tag.id === tagId) || null
    }

    return {
        tags,
        smartListData,
        getOptions,
        getTags,
        getTagByIdFromLocal
    }
})
