// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import type { GetTasksOptions } from '@nao-todo/shared/constants'
import type { TaskUseCase } from '@nao-todo/domain-task'
import { useTasksLoader } from '../use-task-loader'

/**
 * `T664` / `DEF-148` —— **原地刷新失败**不得清空内容、也不得吞错（加载器契约）
 *
 * @description 分流口径（单一实现，视图只消费）：
 *              - `silent`（自动刷新）**且已有内容** ⇒ 失败落**非阻塞** `refreshError`
 *                （`taskIds` 原样保留；视图用提示条表达，下轮成功自动消除）；
 *              - 无内容可保（首进 / 空列）或用户主动加载 ⇒ 失败落**阻塞** `error`（AC-E4 不回退）。
 */

const page = (ids: string[]) => ({
    taskIds: ids,
    pagination: { total: ids.length, page: 1, limit: 20, maxPage: 1 }
})

type ListResult = [ReturnType<typeof page>, null] | [null, string]

const makeLoader = () => {
    const listMock = vi.fn<(options: GetTasksOptions) => Promise<ListResult>>()
    let pending: Array<(value: ListResult) => void> = []
    listMock.mockImplementation(() => new Promise<ListResult>((resolve) => pending.push(resolve)))
    const loader = useTasksLoader({ list: listMock } as unknown as TaskUseCase)
    return {
        loader,
        listMock,
        respond: (value: ListResult) => {
            const next = pending
            pending = []
            next.forEach((resolve) => resolve(value))
        }
    }
}

const waitTick = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
}

describe('T664 / DEF-148 · 原地刷新失败的加载器契约', () => {
    it('有内容 + silent 失败 ⇒ 内容保留、refreshError 可见、error 不落（不换分支）', async () => {
        const { loader, respond } = makeLoader()
        const boot = loader.loadAndReplace()
        respond([page(['t1', 't2']), null])
        await boot
        await waitTick()

        const refresh = loader.loadAndReplace(undefined, { silent: true })
        respond([null, '10051'])
        await refresh
        await waitTick()

        expect([...loader.states.taskIds], 'AC-E1：条目必须保留').toEqual(['t1', 't2'])
        expect(loader.states.refreshError, 'AC-E2：失败必须可见（非阻塞）').not.toBe('')
        expect(loader.states.error, 'AC-E1：不得落阻塞式错误分支').toBe('')
    })

    it('下轮成功 ⇒ refreshError 自动消除（AC-E3：不残留、不刷屏）', async () => {
        const { loader, respond } = makeLoader()
        const boot = loader.loadAndReplace()
        respond([page(['t1']), null])
        await boot
        await waitTick()

        const failed = loader.loadAndReplace(undefined, { silent: true })
        respond([null, '10051'])
        await failed
        await waitTick()
        expect(loader.states.refreshError).not.toBe('')

        const ok = loader.loadAndReplace(undefined, { silent: true })
        respond([page(['t1', 't9']), null])
        await ok
        await waitTick()
        expect(loader.states.refreshError).toBe('')
        expect(loader.states.error).toBe('')
        expect([...loader.states.taskIds]).toEqual(['t1', 't9'])
    })

    it('无内容 + silent 失败 ⇒ 仍落阻塞式 error（AC-E4：不得把失败静默掉）', async () => {
        const { loader, respond } = makeLoader()
        const refresh = loader.loadAndReplace(undefined, { silent: true })
        respond([null, '10051'])
        await refresh
        await waitTick()
        expect(loader.states.error).not.toBe('')
        expect(loader.states.refreshError).toBe('')
    })

    it('非 silent 失败 ⇒ 既有阻塞式 error 语义逐字不变（首进 / 重试）', async () => {
        const { loader, respond } = makeLoader()
        const boot = loader.loadAndReplace()
        respond([null, 'network'])
        await boot
        await waitTick()
        expect(loader.states.error).not.toBe('')
        expect(loader.states.refreshError).toBe('')
    })
})