import $axios from '@nao-todo/utils/axios'
import { stringifyGetOptions } from '@nao-todo/utils'
import { defaultGetTagsOptions } from './constants'
import type {
    Tag,
    GetTagOptions,
    GetTagsOptions,
    UpdateTagOptions,
    CreateTagOptions,
    ResponseData
} from '@nao-todo/types'

// 添加标签
export const createTag = async (options: CreateTagOptions) => {
    try {
        const response = await $axios.post(`/tag`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/tag] createTag:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 删除标签
export const deleteTag = async (id: Tag['id']) => {
    try {
        const response = await $axios.delete(`/tag?tagId=${id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/tag] deleteTag:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 更新标签
export const updateTag = async (id: Tag['id'], options: UpdateTagOptions) => {
    try {
        const response = await $axios.put(`/tag?tagId=${id}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/tag] updateTag:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 获取标签
export const getTag = async (options: GetTagOptions) => {
    try {
        const response = await $axios.get('/tag?tagId=' + options.id)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/tag] getTag:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

// 获取标签（s）
export const getTags = async (options: GetTagsOptions = defaultGetTagsOptions) => {
    try {
        const queryString = stringifyGetOptions(options)
        const response = await $axios.get(`/tags?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/tag] getTags:', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
