// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    showLegacyCipherBlockedNotice,
    showLegacyCipherRebuiltNotice
} from '../legacy-cipher-notice'

/**
 * 旧密文自愈 · 可见告知（DEF-35 / C-68）
 * @description 自愈/阻塞均弹**单按钮一次性模态**，文案中英齐备（走 i18n）；
 *              阻塞告知正文含未回传项数插值。
 */

const mocks = vi.hoisted(() => ({ confirm: vi.fn() }))

vi.mock('nue-ui', () => ({ NueConfirm: mocks.confirm }))

beforeEach(() => {
    mocks.confirm.mockReset()
    mocks.confirm.mockResolvedValue([false, undefined])
})

describe('旧密文自愈可见告知（NueConfirm）', () => {
    it('已重建 ⇒ 单按钮模态，文案说明不可读/重建/已同步数据不受影响', () => {
        showLegacyCipherRebuiltNotice()
        expect(mocks.confirm).toHaveBeenCalledTimes(1)
        const payload = mocks.confirm.mock.calls[0]![0] as {
            title: string
            content: string
            confirmButtonText: string
            unuseCancelButton: boolean
        }
        expect(payload.title).toContain('重建')
        expect(payload.content).toContain('无法读取')
        expect(payload.content).toContain('不受影响')
        expect(payload.confirmButtonText).toBe('我知道了')
        expect(payload.unuseCancelButton).toBe(true)
    })

    it('阻塞 ⇒ 单按钮模态，正文含未回传项数且提示先同步', () => {
        showLegacyCipherBlockedNotice(3)
        expect(mocks.confirm).toHaveBeenCalledTimes(1)
        const payload = mocks.confirm.mock.calls[0]![0] as { content: string }
        expect(payload.content).toContain('3')
        expect(payload.content).toContain('同步')
    })
})