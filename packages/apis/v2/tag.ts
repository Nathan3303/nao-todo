import { stringifyGetOptions } from '@nao-todo/utils'
import type {
    Requester,
    CreateTagOptions,
    GetTagOptions,
    GetTagsOptions,
    ResponseData,
    Tag,
    UpdateTagOptions,
    TagPreference
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

export const updateTagPreferenceApi = async (
    requester: Requester,
    tagId: Tag['id'],
    preference: TagPreference
) => {
    const _preference: { [key in keyof TagPreference]?: string } = {}
    // 将对象偏好转为字符串
    try {
        _preference.getTodosOptions = preference.getTodosOptions
            ? JSON.stringify(preference.getTodosOptions)
            : ''
        _preference.columns = preference.columns ? JSON.stringify(preference.columns) : ''
    } catch (error) {
        console.error('[@nao-todo/apis/update-tag-preference-v2]', error)
        return { code: 400, message: '偏好数据解析失败' } as ResponseData
    }
    // 更新清单偏好
    try {
        const response = await requester.put(`/tag/preference/${tagId}`, _preference)
        return response.data as ResponseData
    } catch (error) {
        console.error('[@nao-todo/apis/update-tag-preference-v2]', error)
        return { code: 500, message: '服务器错误' } as ResponseData
    }
}
