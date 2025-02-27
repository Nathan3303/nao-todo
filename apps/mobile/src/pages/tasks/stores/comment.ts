import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Comment, GetCommentsOptions } from '@nao-todo/types'
import { stringifyGetOptions } from '@nao-todo/utils'
import { doRequest } from '@/pages/tasks/stores/do-request'
import { ApiBaseURL } from '@/constants'

export const useCommentStore = defineStore('commentStore', () => {
    const comments = ref<Comment[]>([])
    const getOptions = ref<GetCommentsOptions>({})

    const getComments = async () => {
        const queryString = stringifyGetOptions(getOptions.value)
        const result = await doRequest({
            method: 'GET',
            url: ApiBaseURL + `/comments?${queryString}`
        })
        // const result = await getCommentsV2(getOptions.value)
        if (result.code !== 20000) return false
        comments.value = result.data as Comment[]
        return true
    }

    return {
        comments,
        getOptions,
        getComments
    }
})
