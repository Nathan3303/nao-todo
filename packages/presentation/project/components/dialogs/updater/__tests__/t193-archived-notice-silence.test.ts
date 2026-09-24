// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createPinia, setActivePinia } from 'pinia'
import { NueMessage } from 'nue-ui'
import { ARCHIVED_READONLY_ERROR } from '../../../../../task/archive-gate'
import { OFFLINE_READONLY_ERROR } from '../../../../../offline/write-gate'
import useProjectUpdater from '../use-project-updater'

/**
 * T193 · 清单更新器只读码静默（ADR §15.3 漏点 ②）
 *
 * 在归档清单上改名称/描述 ⇒ `update` 被守卫拦截，返回 `ARCHIVED_READONLY`。
 * 守卫已弹唯一本地化提示 ⇒ 本入口不得再弹 `'清单更新失败：' + 原始码`；
 * 但「未找到清单 / 名称为空」等既有非归档码提示必须保留（防过度静默）。
 */

afterEach(() => {
    vi.restoreAllMocks()
})

beforeEach(() => {
    setActivePinia(createPinia())
})

const makeApi = (updateResult: unknown) => {
    const api = useProjectUpdater({
        projectUseCase: { update: vi.fn(async () => updateResult) } as never,
        dialogManager: {} as never
    })
    api.states.projectId = 'p1'
    api.states.name = '名称'
    return api
}

describe('T193 · 清单更新器只读码静默（漏点 ②）', () => {
    it('归档码 ⇒ 不弹提示，返回值仍为 false', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const success = vi.spyOn(NueMessage, 'success').mockImplementation(() => {})

        const ok = await makeApi(ARCHIVED_READONLY_ERROR).updateProject()

        expect(ok).toBe(false)
        expect(error).not.toHaveBeenCalled()
        expect(success).not.toHaveBeenCalled()
    })

    it('其它错误码 ⇒ 原样透出（含原始码，防过度静默）', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})

        const ok = await makeApi(OFFLINE_READONLY_ERROR).updateProject()

        expect(ok).toBe(false)
        expect(error).toHaveBeenCalledTimes(1)
        expect(String(error.mock.calls[0]?.[0] ?? '')).toContain(OFFLINE_READONLY_ERROR)
    })

    it('名称为空的既有校验提示保留（非归档码提示不静默）', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const api = makeApi(null)
        api.states.name = ''

        const ok = await api.updateProject()

        expect(ok).toBe(false)
        expect(error).toHaveBeenCalledTimes(1)
        expect(String(error.mock.calls[0]?.[0] ?? '')).toContain('清单名称不能为空')
    })

    it('成功路径仍弹成功提示', async () => {
        const error = vi.spyOn(NueMessage, 'error').mockImplementation(() => {})
        const success = vi.spyOn(NueMessage, 'success').mockImplementation(() => {})

        const ok = await makeApi(null).updateProject()

        expect(ok).toBe(true)
        expect(success).toHaveBeenCalledTimes(1)
        expect(error).not.toHaveBeenCalled()
    })
})