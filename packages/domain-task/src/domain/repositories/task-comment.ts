import type { GoAsync } from '@nao-todo/shared'
import type { TaskCommentEntity } from '../entities'
import type { CreateTaskCommentValueObject, UpdateTaskCommentValueObject } from '../valueobjects'

export interface TaskCommentRepository {
    /**
     * 获取评论
     * @param id 评论ID
     * @returns 评论实体
     */
    get(id: string): GoAsync<TaskCommentEntity>

    /**
     * 创建评论
     * @param createVO 创建评论值对象
     * @returns 评论实体
     */
    create(createVO: CreateTaskCommentValueObject): GoAsync<TaskCommentEntity>

    /**
     * 更新评论
     * @param id 评论ID
     * @param updateVO 更新评论值对象
     * @returns 评论实体
     */
    update(updateVO: UpdateTaskCommentValueObject): GoAsync<void>

    /**
     * 删除评论
     * @param id 评论ID
     * @returns 无返回值
     */
    delete(id: string): GoAsync<void>

    /**
     * 查询所有评论
     * @param taskId 任务ID
     * @returns 评论实体列表
     */
    list(taskId: string): GoAsync<TaskCommentEntity[]>
}