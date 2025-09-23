import { stringifyGetOptions } from '@nao-todo/utils'
import type {
    Requester,
    CreateTagOptions,
    GetTagOptions,
    GetTagsOptions,
    ResponseData,
    Tag,
    UpdateTagOptions
} from '@nao-todo/types'

export const createTagApi = async (requester: Requester, options: CreateTagOptions) => {
    try {
        const response = await requester.post(`/tag/`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/create-tag-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const deleteTagApi = async (requester: Requester, id: Tag['id'], isHard: boolean) => {
    try {
        const response = await requester.delete(`/tag/${id}?hard=${isHard}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/delete-tag-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const updateTagApi = async (
    requester: Requester,
    id: Tag['id'],
    options: UpdateTagOptions
) => {
    try {
        const response = await requester.put(`/tag/${id}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-tag-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const getTagApi = async (requester: Requester, options: GetTagOptions) => {
    try {
        const response = await requester.get(`/tag/${options.id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-tag-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}

export const getTagsApi = async (requester: Requester, options: GetTagsOptions) => {
    try {
        let queryString = stringifyGetOptions(options)
        queryString = queryString ? `?${queryString}` : ''
        const response = await requester.get(`/tags/${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-tags-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}
