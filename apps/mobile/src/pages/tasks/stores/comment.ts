import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Comment, GetCommentsOptions } from '@nao-todo/types'
import { useAuthStore } from '@/pages/auth/store'
import { stringifyGetOptions } from '@nao-todo/utils'
import { doRequest } from '@/pages/tasks/stores/do-request'
import { ApiBaseURL } from '@/constants'

export const useCommentStore = defineStore('commentStore', () => {
    const comments = ref<Comment[]>([])
    const authStore = useAuthStore()

    // 获取选项
    const getOptions = ref<GetCommentsOptions>({})

    // 获取检查事项
    const getComments = async () => {
        const queryString = stringifyGetOptions(getOptions.value)
        const result = await doRequest({
            method: 'GET',
            url: ApiBaseURL + `/comments?${queryString}`
        })
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
