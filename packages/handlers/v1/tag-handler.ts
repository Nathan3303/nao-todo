import { createTagApi, deleteTagApi, getTagsApi, updateTagApi } from '@nao-todo/apis/v2'
import type {
    CreateTagOptions,
    GetTagOptions,
    GoLike,
    Requester,
    Tag,
    UpdateTagOptions
} from '@nao-todo/types'

const CREATE_TAG_SUCCESS_CODE = 30010
const GET_TAGS_SUCCESS_CODE = 30050
// const GET_TAG_SUCCESS_CODE = 30000
const UPDATE_TAG_SUCCESS_CODE = 30020
const DELETE_TAG_SUCCESS_CODE = 30030

export const createTagHandler = async (
    options: CreateTagOptions,
    requester: Requester
): Promise<GoLike> => {
    // 参数判断
    if (options.name === '') return [null, '标签名称不能为空']
    if (options.color === '') return [null, '标签颜色不能为空']
    // 调用 API 创建标签
    const apiRes = await createTagApi(requester, options)
    // 处理成功结果
    if (apiRes.code === CREATE_TAG_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const getTagsHandler = async (
    options: GetTagOptions,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 获取标签
    const apiRes = await getTagsApi(requester, options)
    // 处理成功结果
    if (apiRes.code === GET_TAGS_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const deleteTagHandler = async (
    tagId: Tag['id'],
    isHard: boolean,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 删除（更新）清单
    const apiRes = await deleteTagApi(requester, tagId, isHard || false)
    // 处理成功结果
    if (apiRes.code === DELETE_TAG_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const updateTagHandler = async (
    tagId: Tag['id'],
    options: UpdateTagOptions,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 更新标签
    const apiRes = await updateTagApi(requester, tagId, options)
    // 处理成功结果
    if (apiRes.code === UPDATE_TAG_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}
