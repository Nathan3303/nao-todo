import useRequester from '@nao-todo/hooks/use-requester'
import { stringifyGetOptions } from '@nao-todo/utils'
import type {
    Comment,
    CreateCommentOptions,
    GetCommentsOptions,
    ResponseData,
    UpdateCommentOptions
} from '@nao-todo/types'

export const defaultGetCommentsOptions: GetCommentsOptions = {}

const requester = useRequester()

export const createCommentV2 = async (options: CreateCommentOptions) => {
    try {
        const response = await requester.post(`/comment`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/create-comment-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const deleteCommentV2 = async (id: Comment['id']) => {
    try {
        const response = await requester.delete(`/comment?commentId=${id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/delete-comment-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const updateCommentV2 = async (id: Comment['id'], options: UpdateCommentOptions) => {
    try {
        const response = await requester.put(`/comment?commentId=${id}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-comment-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const getCommentsV2 = async (options: GetCommentsOptions = defaultGetCommentsOptions) => {
    try {
        const queryString = stringifyGetOptions(options)
        const response = await requester.get(`/comments?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-comments-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
