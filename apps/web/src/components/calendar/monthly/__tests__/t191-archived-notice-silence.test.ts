// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { NueMessage } from 'nue-ui'
import type { TaskViewObject } from '@nao-todo/domain-task'
import {
    ARCHIVED_READONLY_ERROR,
    TASK_ARCHIVE_WRITE_METHODS,
    resetArchiveGateForTest,
    withArchivedReadOnlyGuard
} from '@nao-todo/presentation/task/archive-gate'
import { OFFLINE_READONLY_ERROR } from '@nao-todo/presentation/offline/write-gate'
import { useCalendarSchedule } from '../use-calendar-schedule'

/**
 * T191 · 归档只读码在日历排期静默（ADR §15.3「提示唯一来源」）
 *
 * 归档目标改期被守卫拦截时，唯一用户可见提示来自守卫（本地化 `archive.readOnlyHint`）；
 * 日历写回路径不得再弹第二条、也不得透出原始错误码 `ARCHIVED_READONLY`（只约束展示，不约束返回值）。
 */

vi.mock('@/hooks', () => ({ useTaskUseCase: () => ({}) }))

const makeTask = (): TaskViewObject =>
    ({
        id: 't1',
        name: '任务 A',
        state: 'todo',
        priority: 'low',
        startAt: null,
        endAt: '2026-09-25T10:00:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z'
    }) as unknown as TaskViewObject

/** 组合式需组件上下文（内部 `onUnmounted`）；用极小宿主挂载后取回 API */
const setup = (taskUseCase: unknown): ReturnType<typeof useCalendarSchedule> => {
    let api: ReturnType<typeof useCalendarSchedule> | undefined
    mount(
        defineComponent({
            setup() {
                api = useCalendarSchedule({ taskUseCase } as never)
                return () => h('div')
            }
        })
    )
    return api!
}

beforeEach(() => {
    resetArchiveGateForTest()
})

afterEach(() => {
    resetArchiveGateForTest()
    vi.restoreAllMocks()
})

describe('T191 · 归档只读码在日历排期静默（守卫已提示）', () => {
    it('归档任务改期被拦 → 仅守卫 warn 1 条、无原始错误码', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const guarded = withArchivedReadOnlyGuard(
            { update: vi.fn(async () => null) } as unknown as object,
            TASK_ARCHIVE_WRITE_METHODS,
            { isArchivedTarget: async () => true }
        )
        const api = setup(guarded)

        const ok = await api.applyTimePatch(makeTask(), { startAt: '2026-09-26T10:00:00.000Z' })

        expect(ok).toBe(false)
        expect(warn).toHaveBeenCalledTimes(1)
        expect(error).not.toHaveBeenCalled()
        expect(warn.mock.calls.length + error.mock.calls.length).toBe(1) // 恰好 1 条
        expect(String(warn.mock.calls[0]?.[0] ?? '')).not.toContain(ARCHIVED_READONLY_ERROR)
    })

    it('其它错误码仍原样透出（防过度静默）', async () => {
        const warn = vi.spyOn(NueMessage, 'warn').mockImplementation(() => {})
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const api = setup({ update: vi.fn(async () => OFFLINE_READONLY_ERROR) })

        const ok = await api.applyTimePatch(makeTask(), { startAt: '2026-09-26T10:00:00.000Z' })

        expect(ok).toBe(false)
        expect(warn).not.toHaveBeenCalled()
        expect(error).toHaveBeenCalledTimes(1)
        expect(String(error.mock.calls[0]?.[0] ?? '')).toContain(OFFLINE_READONLY_ERROR)
    })
})