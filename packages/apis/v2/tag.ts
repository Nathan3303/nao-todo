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

const defaultGetTagsOptions: GetTagsOptions = {
    page: 1,
    limit: 10
    // sort: { field: 'createdAt', order: 'desc' }
}

export const createTagV2 = async (requester: Requester, options: CreateTagOptions) => {
    try {
        const response = await requester(`/tag`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/create-tag-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const deleteTagV2 = async (requester: Requester, id: Tag['id']) => {
    try {
        const response = await requester(`/tag?tagId=${id}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/delete-tag-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const updateTagV2 = async (
    requester: Requester,
    id: Tag['id'],
    options: UpdateTagOptions
) => {
    try {
        const response = await requester(`/tag?tagId=${id}`, options)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-tag-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const getTagV2 = async (requester: Requester, options: GetTagOptions) => {
    try {
        const response = await requester('/tag?tagId=' + options.id)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-tag-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}

export const getTagsV2 = async (
    requester: Requester,
    options: GetTagsOptions = defaultGetTagsOptions
) => {
    try {
        const queryString = stringifyGetOptions(options)
        const response = await requester(`/tags?${queryString}`)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/get-tags-v2]', error)
        return { code: 50001, message: '服务器错误' } as ResponseData
    }
}
