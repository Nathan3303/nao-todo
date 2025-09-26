import {
    createCommentApiV2,
    getCommentsApiV2,
    updateCommentApiV2,
    deleteCommentApiV2
} from '@nao-todo/apis/v2'
import type {
    CreateCommentOptions,
    GetCommentsOptions,
    ResponseData,
    GoLike,
    Requester,
    Comment,
    UpdateCommentOptions
} from '@nao-todo/types'

const CREATE_COMMENT_SUCCESS_CODE = 60010
const GET_COMMENTS_SUCCESS_CODE = 60000
const UPDATE_COMMENT_SUCCESS_CODE = 60020
const DELETE_COMMENT_SUCCESS_CODE = 60030
// const GET_COMMENT_SUCCESS_CODE = 60000
// const RESTORE_COMMENT_SUCCESS_CODE = 60040

export const createCommentHandler = async (
    options: CreateCommentOptions,
    requester: Requester
): Promise<GoLike> => {
    // 参数判断
    if (options.content === '') return [null, '评论内容不能为空']
    // 调用 API 创建评论
    const apiRes = await createCommentApiV2(requester, options)
    // 处理成功结果
    if (apiRes.code === CREATE_COMMENT_SUCCESS_CODE) {
        return [apiRes.data as Comment, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const getCommentsHandler = async (
    getOptions: GetCommentsOptions,
    requester: Requester
): Promise<GoLike<{ comments: Comment[]; pagination: ResponseData['pagination'] } | null>> => {
    // 调用 API 获取评论列表
    const apiRes = await getCommentsApiV2(requester, getOptions)
    // 处理成功结果
    if (apiRes.code === GET_COMMENTS_SUCCESS_CODE) {
        return [
            {
                comments: apiRes.data as Comment[],
                pagination: apiRes.pagination
            },
            null
        ]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const updateCommentHandler = async (
    id: Comment['id'],
    updateOptions: UpdateCommentOptions,
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 更新待办任务
    const apiRes = await updateCommentApiV2(requester, id, updateOptions)
    // 处理成功结果
    if (apiRes.code === UPDATE_COMMENT_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}

export const deleteCommentHandler = async (
    id: Comment['id'],
    requester: Requester
): Promise<GoLike> => {
    // 调用 API 删除待办任务
    const apiRes = await deleteCommentApiV2(requester, id)
    // 处理成功结果
    if (apiRes.code === DELETE_COMMENT_SUCCESS_CODE) {
        return [apiRes.data, null]
    }
    // 处理失败结果
    return [null, apiRes.message]
}
