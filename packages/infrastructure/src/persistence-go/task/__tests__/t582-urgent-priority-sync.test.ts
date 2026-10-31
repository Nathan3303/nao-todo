import { describe, expect, it } from 'vite-plus/test'
import { CreateTaskValueObject, UpdateTaskValueObject } from '@nao-todo/domain-task'
import {
    createTaskValueObject2Req,
    taskRes2TaskEntity,
    updateTaskValueObject2Req
} from '../converters'
import type { TaskRes } from '../../models'

/**
 * T582 / DEF-84 跨端 `urgent` 保真（PRD `docs/prds/2026-10-30-priority-urgent.md` AC5）
 * @description 断言「pull 落库」与「本地 → push」两端都不把 `urgent` 降级：
 *              ① `taskRes2TaskEntity` 原样保留 `urgent`（现状即绿 ⇒ **回归护栏**，防实现时顺手加白名单校验）；
 *              ② push 请求体原样带 `urgent`（现状即绿 ⇒ **回归护栏**，AC5「再次 push 不产生优先级变更」）。
 *              「落库实体 → 视图对象」的降级点（真缺陷）由
 *              `packages/domain-task/.../__tests__/converters.test.ts` 的 AC1 红基线覆盖。
 */

const urgentRes = {
    id: 't-urgent',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    deletedAt: null,
    parentTaskId: '',
    name: '紧急任务',
    description: '',
    state: 'todo',
    priority: 'urgent',
    startAt: '',
    endAt: '',
    tags: [],
    projectId: 'p-1',
    archivedAt: null,
    starMarkAt: null,
    givenUpAt: null,
    remindAt: null,
    remindRepeat: 'none',
    remindTime: null,
    remindWeekdays: [],
    checkItemCount: 0,
    commentCount: 0,
    subtaskCount: 0
} as unknown as TaskRes

describe('T582 跨端 urgent 保真', () => {
    it('AC5（已绿，回归护栏）：pull 结果落库为实体时保留 urgent（不写成 low）', () => {
        expect(taskRes2TaskEntity(urgentRes).priority).toBe('urgent')
    })

    it('AC5（已绿，回归护栏）：push 请求体保留 urgent（不产生优先级变更）', () => {
        const createVO = new CreateTaskValueObject(
            null,
            null,
            '紧急任务',
            '',
            'todo',
            'urgent',
            null,
            null,
            'p-1',
            [],
            null,
            'none',
            null,
            []
        )
        expect(createTaskValueObject2Req(createVO).priority).toBe('urgent')

        const updateVO = new UpdateTaskValueObject('t-urgent')
        updateVO.priority = 'urgent'
        expect(updateTaskValueObject2Req(updateVO).priority).toBe('urgent')
    })
})