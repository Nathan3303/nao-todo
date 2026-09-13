import { describe, expect, it, vi } from 'vite-plus/test'
import {
    DEFAULT_TASKS_VIEW_TYPE,
    resolveTasksViewType,
    runBoundedTasksInitialize
} from '../view-type'

/**
 * SHELL-05 T5 / C-32：内容视图默认 viewType 自愈 + loading 有界
 */

describe('resolveTasksViewType - viewType 自愈（C-32）', () => {
    it('本地 preference 优先', () => {
        expect(resolveTasksViewType({ viewType: 'kanban' })).toBe('kanban')
        expect(resolveTasksViewType({ viewType: 'list' })).toBe('list')
    })

    it('preference 缺失/无 viewType → 硬默认 table（离线可用）', () => {
        expect(resolveTasksViewType(undefined)).toBe(DEFAULT_TASKS_VIEW_TYPE)
        expect(resolveTasksViewType(null)).toBe(DEFAULT_TASKS_VIEW_TYPE)
        expect(resolveTasksViewType({})).toBe(DEFAULT_TASKS_VIEW_TYPE)
        expect(resolveTasksViewType({ viewType: '' })).toBe(DEFAULT_TASKS_VIEW_TYPE)
        expect(DEFAULT_TASKS_VIEW_TYPE).toBe('table')
    })
})

describe('runBoundedTasksInitialize - loading 有界（C-31/C-33）', () => {
    it('成功路径：true → 执行 → false', async () => {
        const setLoading = vi.fn()
        const task = vi.fn(async () => {})
        await runBoundedTasksInitialize(task, setLoading)
        expect(setLoading.mock.calls.map((c) => c[0])).toEqual([true, false])
        expect(task).toHaveBeenCalledTimes(1)
    })

    it('异常路径：仍退出 loading 并回调 onError（不冒泡）', async () => {
        const setLoading = vi.fn()
        const onError = vi.fn()
        const boom = new Error('boom')
        await expect(
            runBoundedTasksInitialize(
                async () => {
                    throw boom
                },
                setLoading,
                onError
            )
        ).resolves.toBeUndefined()
        expect(onError).toHaveBeenCalledWith(boom)
        expect(setLoading.mock.calls.map((c) => c[0])).toEqual([true, false])
    })
})