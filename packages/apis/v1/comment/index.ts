import $axios from '@nao-todo/utils/axios'
import { stringifyGetOptions } from '@nao-todo/utils'
import { defaultGetCommentsOptions } from './constants'
import type {
    Comment,
    CreateCommentOptions,
    ResponseData,
    UpdateCommentOptions,
    GetCommentsOptions
} from '@nao-todo/types'

// 添加评论
export const createComment = async (options: CreateCommentOptions) => {
    try {
        const response = await $axios.post(`/comment`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/comment] createComment:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 删除评论
export const deleteComment = async (id: Comment['id']) => {
    try {
        const response = await $axios.delete(`/comment?commentId=${id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/comment] deleteComment:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 更新评论
export const updateComment = async (id: Comment['id'], options: UpdateCommentOptions) => {
    try {
        const response = await $axios.put(`/comment?commentId=${id}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/comment] updateComment:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 获取评论（s）
export const getComments = async (options: GetCommentsOptions = defaultGetCommentsOptions) => {
    try {
        const queryString = stringifyGetOptions(options)
        const response = await $axios.get(`/comments?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/comment] getComments:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
