// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { NueMessage } from 'nue-ui'
import { ARCHIVED_READONLY_ERROR } from '@nao-todo/presentation/task/archive-gate'
import { OFFLINE_READONLY_ERROR } from '@nao-todo/presentation/offline/write-gate'
import { runProjectArchive } from '../archive-project-action'

/**
 * T193 · 归档入口（`archive-project-action`）只读码静默（ADR §15.3 漏点 ①）
 *
 * 在已归档清单视图上再点「归档」⇒ `archive` 被守卫拦截，返回稳定码 `ARCHIVED_READONLY`。
 * 守卫已弹唯一本地化提示 ⇒ 本入口**不得**再弹 `dialog.projectArchiveFailed`（否则原始码外泄 + 双提示）。
 * 只收敛失败路径，成功路径仍弹成功提示；其它错误码原样透出（防过度静默）。
 */

vi.mock('nue-ui', async (importOriginal) => {
    const actual = await importOriginal<typeof import('nue-ui')>()
    // `runProjectArchive` 先经二次确认；固定「未取消」以便走到归档执行分支
    return { ...actual, NueConfirm: vi.fn(async () => [false]) }
})

afterEach(() => {
    vi.restoreAllMocks()
})

const makeTaskUseCase = () => ({
    list: vi.fn(async () => [{ pagination: { total: 3 } }, null])
})

describe('T193 · 归档入口只读码静默（漏点 ①）', () => {
    it('归档码 ⇒ 不弹失败提示、不弹成功提示', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const success = vi.spyOn(NueMessage, 'success').mockImplementation(() => {})

        await runProjectArchive({
            taskUseCase: makeTaskUseCase() as never,
            projectId: 'p-archived',
            archive: async () => ARCHIVED_READONLY_ERROR
        })

        expect(error).not.toHaveBeenCalled()
        expect(success).not.toHaveBeenCalled()
    })

    it('其它错误码 ⇒ 原样透出（含原始码，防过度静默）', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})

        await runProjectArchive({
            taskUseCase: makeTaskUseCase() as never,
            projectId: 'p1',
            archive: async () => OFFLINE_READONLY_ERROR
        })

        expect(error).toHaveBeenCalledTimes(1)
        expect(String(error.mock.calls[0]?.[0] ?? '')).toContain(OFFLINE_READONLY_ERROR)
    })

    it('成功路径仍弹成功提示', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const success = vi.spyOn(NueMessage, 'success').mockImplementation(() => {})

        await runProjectArchive({
            taskUseCase: makeTaskUseCase() as never,
            projectId: 'p1',
            archive: async () => null
        })

        expect(success).toHaveBeenCalledTimes(1)
        expect(error).not.toHaveBeenCalled()
    })
})