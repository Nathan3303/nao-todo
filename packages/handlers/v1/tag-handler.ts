import { useAxios } from '@nao-todo/hooks/use-requester'
import { createTagApi, getTagsApi } from '@nao-todo/apis/v2'
import type { CreateTagOptions, GetTagOptions, GoLike } from '@nao-todo/types'

const CREATE_TAG_SUCCESS_CODE = 30010
const GET_TAGS_SUCCESS_CODE = 30050
const GET_TAG_SUCCESS_CODE = 30000
const UPDATE_TAG_SUCCESS_CODE = 30020
const DELETE_TAG_SUCCESS_CODE = 30030

const iReq = useAxios('http://localhost:3303/api/')

export const createTagHandler = async (
    options: CreateTagOptions,
    requester = iReq
): Promise<GoLike> => {
    // 参数判断
    if (options.name === '') return [null, '标签名称不能为空']
    if (options.color === '') return [null, '标签颜色不能为空']
    // 调用 API 创建标签
    const apiRes = await createTagApi(requester || iReq, options)
    // 处理成功结果
    if (apiRes.code === CREATE_TAG_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const getTagsHandler = async (options: GetTagOptions, request = iReq): Promise<GoLike> => {
    // 调用 API 获取标签
    const apiRes = await getTagsApi(request, options)
    // 处理成功结果
    if (apiRes.code === GET_TAGS_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}
