// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import type { GetTasksOptions } from '@nao-todo/shared/constants'
import type { TaskUseCase } from '@nao-todo/domain-task'
import { useTasksLoader } from '../use-task-loader'

/**
 * `T662` / `DEF-144` —— 加载器的「原地刷新」契约（`silent`）
 *
 * @description 同步拉取落库后的视图刷新（`RefreshData`）必须**不置 `loading`**：否则表格/列表把
 *              已渲染内容整块换成加载态（用户看到的「突然变加载又变回去」）。
 *              首次进入 / 翻页 / 重试保持原语义（`loading = true`，AC-A3 不得“永不显示 loading”）。
 *              在飞中到达的静默刷新走单槽重跑时，静默属性必须一并带走（不得重跑时又闪一次）。
 */

const page = (ids: string[]) => ({
    taskIds: ids,
    pagination: { total: ids.length, page: 1, limit: 20, maxPage: 1 }
})

type ListResult = [ReturnType<typeof page>, null] | [null, string]

const makeLoader = () => {
    let resolve: ((value: ListResult) => void) | null = null
    const listMock = vi
        .fn<(options: GetTasksOptions) => Promise<ListResult>>()
        .mockImplementation(
            () => new Promise<ListResult>((r) => (resolve = r)) as Promise<ListResult>
        )
    const loader = useTasksLoader({ list: listMock } as unknown as TaskUseCase)
    return {
        loader,
        listMock,
        settle: (ids: string[]) => {
            resolve?.([page(ids), null])
            resolve = null
        }
    }
}

/** 等待 loader 的 `disabled` 复位（`setTimeout(delay)`） */
const waitTick = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
}

describe('useTasksLoader · silent 原地刷新（DEF-144 / AC-A1）', () => {
    it('silent：在飞期间 loading 保持 false，完成后替换列表', async () => {
        const { loader, settle } = makeLoader()
        // 前置：首屏已加载完成（生产：`loadFirstPage` 非 silent ⇒ loading 已回落 false）
        const first = loader.loadAndReplace()
        settle(['t0'])
        await first
        await waitTick()
        expect(loader.states.loading).toBe(false)

        const run = loader.loadAndReplace(undefined, { silent: true })
        expect(loader.states.loading).toBe(false)
        settle(['t1', 't2'])
        await run
        await waitTick()
        expect(loader.states.loading).toBe(false)
        expect([...loader.states.taskIds]).toEqual(['t1', 't2'])
    })

    it('非 silent（首次进入 / 翻页 / 重试）：在飞期间 loading = true（AC-A3 不回退）', async () => {
        const { loader, settle } = makeLoader()
        const run = loader.loadAndReplace()
        expect(loader.states.loading).toBe(true)
        settle(['t1'])
        await run
        await waitTick()
        expect(loader.states.loading).toBe(false)
    })

    it('在飞中的静默刷新走单槽重跑时，重跑仍静默（不得重跑时又闪一次）', async () => {
        const { loader, listMock, settle } = makeLoader()
        const boot = loader.loadAndReplace()
        settle(['t0'])
        await boot
        await waitTick()
        expect(loader.states.loading).toBe(false)

        const first = loader.loadAndReplace()
        const queued = loader.loadAndReplace(undefined, { silent: true })
        expect(loader.states.pendingRefresh).toEqual({ requested: {}, silent: true })
        settle(['t1'])
        await first
        await queued
        await waitTick() // 重跑
        expect(listMock).toHaveBeenCalledTimes(3)
        expect(loader.states.loading).toBe(false)
        settle(['t1', 't2'])
        await waitTick()
        expect([...loader.states.taskIds]).toEqual(['t1', 't2'])
    })
})