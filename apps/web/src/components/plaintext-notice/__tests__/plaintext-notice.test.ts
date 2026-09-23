// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { PLAINTEXT_NOTICE_ACK_KEY, showPlaintextNoticeConfirm } from '../plaintext-notice'

/**
 * 明文姿态 · 首启一次性告知（ADR §4.5 / D1b / AC17）
 * @description 首启（无已读标记）⇒ 调 `NueConfirm`（单按钮，含标题/正文/确认文案）；
 *              确认 ⇒ 写设备级已读标记且之后不再弹；已读 ⇒ 不弹（含登出后不重复：标记为设备级）。
 */

const mocks = vi.hoisted(() => ({ confirm: vi.fn() }))

vi.mock('nue-ui', () => ({ NueConfirm: mocks.confirm }))

beforeEach(() => {
    localStorage.clear()
    mocks.confirm.mockReset()
    mocks.confirm.mockResolvedValue([false, undefined])
})

afterEach(() => {
    localStorage.clear()
})

describe('明文姿态首启告知（NueConfirm） - ADR §4.5', () => {
    it('首次进入（无已读标记）⇒ 弹单按钮 NueConfirm，文案含明文与设置指引', () => {
        showPlaintextNoticeConfirm()
        expect(mocks.confirm).toHaveBeenCalledTimes(1)
        const payload = mocks.confirm.mock.calls[0]![0] as {
            title: string
            content: string
            confirmButtonText: string
            unuseCancelButton: boolean
        }
        expect(payload.title).toContain('明文')
        expect(payload.content).toContain('明文')
        expect(payload.content).toContain('设置')
        expect(payload.confirmButtonText).toBe('我知道了')
        expect(payload.unuseCancelButton).toBe(true)
    })

    it('确认 ⇒ 写设备级已读标记；再次调用不再弹', () => {
        showPlaintextNoticeConfirm()
        const payload = mocks.confirm.mock.calls[0]![0] as { onConfirm: () => void }
        payload.onConfirm()
        expect(localStorage.getItem(PLAINTEXT_NOTICE_ACK_KEY)).toBe('1')

        showPlaintextNoticeConfirm()
        expect(mocks.confirm).toHaveBeenCalledTimes(1)
    })

    it('已读 ⇒ 不再弹出（刷新/再次进入不重复）', () => {
        localStorage.setItem(PLAINTEXT_NOTICE_ACK_KEY, '1')
        showPlaintextNoticeConfirm()
        expect(mocks.confirm).not.toHaveBeenCalled()
    })
})