import { describe, expect, it, vi } from 'vite-plus/test'
import type { Subscriber } from '@nao-todo/shared'
import type { TaskUseCase, UpdateTaskViewObject } from '@nao-todo/domain-task'
import { useBatchExecutor } from '../../components/multi-select/use-batch-executor'
import { TaskHandler } from '../task'

/**
 * 取消放弃的清空载荷语义（T33：对齐服务端同步契约）
 * @description 服务端三态语义为 `nil`/JSON `null` = 缺省不写列、`''` = 清空置 NULL、
 *              合法时间 = 设值；故「取消放弃」必须以 `''` 表达清空，且批量入口
 *              （多选 → `useBatchExecutor` 的 `ungiveUp`）须与任务详情页 footer 路径一致。
 */

const GIVEN_UP_AT = '2026-09-21T05:00:00.000Z'

/** 取第 index 条捕获载荷（缺失即抛错，避免 noUncheckedIndexedAccess 下静默 undefined） */
const payloadAt = (captured: UpdateTaskViewObject[], index: number): UpdateTaskViewObject => {
    const payload = captured[index]
    if (!payload) throw new Error(`缺少第 ${index} 条更新载荷`)
    return payload
}

const setup = () => {
    const captured: UpdateTaskViewObject[] = []
    const taskUseCase = {
        update: vi.fn(async (_id: string, updateVO: UpdateTaskViewObject) => {
            captured.push(updateVO)
            return null
        })
    } as unknown as TaskUseCase
    const handler = new TaskHandler(taskUseCase, { emit: vi.fn() } as unknown as Subscriber)
    // 静默：跳过 nue-ui 消息提示，保持单测纯逻辑
    handler.silent = true
    return { handler, captured }
}

describe('TaskHandler.unGiveUp - 取消放弃的清空载荷', () => {
    it('以空串表达清空（而非 null，null 会被服务端按「缺省不改」处理）', async () => {
        const { handler, captured } = setup()

        await handler.unGiveUp('t1')

        expect(captured).toHaveLength(1)
        expect(payloadAt(captured, 0).isGivenUp).toBe(false)
        expect(typeof payloadAt(captured, 0).givenUpAt).toBe('string')
        expect(payloadAt(captured, 0).givenUpAt).toBe('')
    })

    it('与任务详情页 footer 路径载荷一致（同一清空语义）', async () => {
        const { handler, captured } = setup()

        await handler.unGiveUp('t1') // 批量入口
        await handler.update('t2', { givenUpAt: '' }) // footer 路径（use-task-view-object）

        expect(payloadAt(captured, 0).givenUpAt).toBe(payloadAt(captured, 1).givenUpAt)
        expect(payloadAt(captured, 0).givenUpAt).toBe('')
    })

    it('批量「取消放弃」经 useBatchExecutor 后载荷仍为空串', async () => {
        const { handler, captured } = setup()
        const { run } = useBatchExecutor({ handler, getTask: () => undefined })

        const result = await run({ kind: 'ungiveUp' }, ['t1'])

        expect(result.failed).toBe(0)
        expect(payloadAt(captured, 0).givenUpAt).toBe('')
    })
})

describe('TaskHandler 放弃设值 - 回归保护', () => {
    it('「放弃」仍以合法时间设值，未被清空语义影响', async () => {
        const { handler, captured } = setup()

        await handler.update('t1', { givenUpAt: GIVEN_UP_AT })

        expect(payloadAt(captured, 0).givenUpAt).toBe(GIVEN_UP_AT)
    })
})