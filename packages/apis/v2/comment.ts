import { stringifyGetOptions } from '@nao-todo/utils'
import type {
    Comment,
    CreateCommentOptions,
    GetCommentsOptions,
    UpdateCommentOptions,
    Requester,
    ResponseData
} from '@nao-todo/types'

export const createCommentApiV2 = async (requester: Requester, options: CreateCommentOptions) => {
    try {
        const response = await requester.post(`/comment/`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/create-comment-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const deleteCommentApiV2 = async (requester: Requester, id: Comment['id']) => {
    try {
        const response = await requester.delete(`/comment/${id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/delete-comment-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const updateCommentApiV2 = async (
    requester: Requester,
    id: Comment['id'],
    options: UpdateCommentOptions
) => {
    try {
        const response = await requester.put(`/comment/${id}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-comment-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const getCommentsApiV2 = async (requester: Requester, options: GetCommentsOptions) => {
    try {
        const queryString = stringifyGetOptions(options)
        const response = await requester.get(`/comments/?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-comments-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}
