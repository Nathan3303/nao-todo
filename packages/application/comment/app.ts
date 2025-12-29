import { useCommentDomain } from '@nao-todo/domain/comment'
import { useCommentRepository } from '@nao-todo/infrastructure/backend/comment/repoImpl'
import { getRequesterImpl } from '@nao-todo/infrastructure/requester'
import type { GoAsync } from '@nao-todo/types'
import { reactive, type Reactive } from 'vue'
import { commentEntities2VOs, updateCommentVO2Entity } from './converters'
import type { CommentVO, UpdateCommentVO } from '@nao-todo/types/viewobjects/comment'

export type CommentAppStates = Reactive<{
    comments: CommentVO[]
}>

export interface CommentApp {
    states: CommentAppStates
    list: (taskId: string) => GoAsync<CommentVO[]>
    update: (commentId: string, updateVO: UpdateCommentVO) => GoAsync<void>
}

const useCommentApp = (): CommentApp => {
    // @domain Comment domain
    const commentDomain = useCommentDomain(useCommentRepository(getRequesterImpl()))

    // @states
    const states = reactive<CommentAppStates>({
        comments: []
    })

    // @method 获取评论列表
    const list = async (taskId: string): GoAsync<CommentVO[]> => {
        // 1. 参数检查
        if (!taskId) return [null, '参数错误']
        // 2. 获取数据
        const [commentEntities, err] = await commentDomain.list(taskId)
        if (err !== null) {
            return [null, err]
        }
        // 3. 转换为 VO
        const comments = commentEntities2VOs(commentEntities)
        states.comments = comments
        return [comments, null]
    }

    // @method 更新评论
    const update = async (commentId: string, updateVO: UpdateCommentVO): GoAsync<void> => {
        // 1. 参数检查
        if (!commentId || !updateVO) return '参数错误'
        // 2. vo 转 实体
        const updateEntity = updateCommentVO2Entity(updateVO)
        // 2. 更新数据
        const [, err] = await commentDomain.update(commentId, updateEntity)
        if (err !== null) {
            return err
        }
        return null
    }

    // @returns
    return { states, list, update }
}

export default useCommentApp
