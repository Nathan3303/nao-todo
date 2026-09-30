import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vite-plus/test'
import { CreateTaskCommentValueObject } from '@nao-todo/domain-task'
import { newLocalTaskCommentRepository } from '../repos/task-comment-repo-impl'
import { setup } from './local-repos-test-helpers'

/**
 * DEF-69 本地新增评论携带作者信息
 * @description 本地优先（W2）下评论由 `LocalTaskCommentRepoImpl` 写入本地库。
 *              若入参不带昵称/头像，则新增评论「立即展示」（仓储回执）与
 *              「面板重开 / 刷新」（本地 `list`）都会缺作者信息（用户可见缺陷）。
 *              本用例锁：create 的入参作者信息写入实体、且 list 原样返回。
 */
describe('DEF-69 本地新增评论的作者信息', () => {
    beforeEach(async () => {
        await setup('user-1')
    })

    it('create 返回的实体带上入参昵称/头像，list（重开面板）仍可读到', async () => {
        const repo = newLocalTaskCommentRepository()
        const [created, createErr] = await repo.create(
            new CreateTaskCommentValueObject(
                'task-1',
                '第一条评论',
                [],
                false,
                '张三',
                '/static/uploads/avatars/me.png'
            )
        )
        expect(createErr).toBeNull()
        expect(created!.nickname).toBe('张三')
        expect(created!.avatar).toBe('/static/uploads/avatars/me.png')

        const [comments, listErr] = await repo.list('task-1')
        expect(listErr).toBeNull()
        expect(comments).toHaveLength(1)
        expect(comments?.[0]?.nickname).toBe('张三')
        expect(comments?.[0]?.avatar).toBe('/static/uploads/avatars/me.png')
    })
})