// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { sendNotification } from '../notification'

/**
 * T525 · AC6（通知权限被拒 / 不支持系统通知）+ AC9（通知点击回调）
 *
 * @description `sendNotification` 是既有封装（`packages/shared/utils/notification.ts`）：
 *              权限守卫 + 点击聚焦 + 关闭。本文件锁定其契约（**非新增实现**），
 *              用于证明「应用内弹窗不受系统通知可用性影响」，并约束调用方必须经
 *              `onClick` 承载「聚焦 + 打开详情」（AC9 的引擎侧只负责派发 notify 事件）。
 */

const BaseNotification = (globalThis as { Notification?: unknown }).Notification

class NotificationStub {
    static permission: NotificationPermission = 'granted'
    static instances: NotificationStub[] = []
    static requestPermission = vi.fn(async () => 'granted' as NotificationPermission)

    onclick: (() => void) | null = null
    closed = false

    constructor(
        readonly title: string,
        readonly options: { body?: string; icon?: string }
    ) {
        NotificationStub.instances.push(this)
    }

    close(): void {
        this.closed = true
    }
}

const installNotification = (permission: NotificationPermission): void => {
    NotificationStub.permission = permission
    NotificationStub.instances = []
    ;(globalThis as { Notification?: unknown }).Notification = NotificationStub
    Object.defineProperty(window, 'Notification', {
        configurable: true,
        writable: true,
        value: NotificationStub
    })
}

beforeEach(() => {
    installNotification('granted')
})

afterEach(() => {
    vi.restoreAllMocks()
    if (BaseNotification === undefined) {
        delete (globalThis as { Notification?: unknown }).Notification
        delete (window as { Notification?: unknown }).Notification
    } else {
        ;(globalThis as { Notification?: unknown }).Notification = BaseNotification
    }
})

describe('T525 · 系统通知封装（AC6 / AC9）', () => {
    it('AC9 granted ⇒ 以 title/body 构造通知；点击触发 onClick + 聚焦 + 关闭', () => {
        const focus = vi.spyOn(window, 'focus').mockImplementation(() => {})
        const onClick = vi.fn()

        sendNotification('任务提醒', '买菜', { onClick })

        const notification = NotificationStub.instances[0]
        expect(notification?.title).toBe('任务提醒')
        expect(notification?.options.body).toBe('买菜')

        notification?.onclick?.()

        expect(onClick).toHaveBeenCalledTimes(1)
        expect(focus).toHaveBeenCalled()
        expect(notification?.closed).toBe(true)
    })

    it('AC6 权限被拒（denied）⇒ 不构造通知、不抛错（应用内弹窗仍由引擎派发）', () => {
        installNotification('denied')

        expect(() => sendNotification('任务提醒', '买菜')).not.toThrow()
        expect(NotificationStub.instances).toHaveLength(0)
    })

    it('AC6 浏览器不支持系统通知（无 `Notification` 全局）⇒ 不抛错', () => {
        // 「不支持」= 全局**不存在**（`'Notification' in window` 为 false）；置为 undefined 仍算存在
        delete (globalThis as { Notification?: unknown }).Notification
        delete (window as { Notification?: unknown }).Notification

        expect('Notification' in window).toBe(false)
        expect(() => sendNotification('任务提醒', '买菜')).not.toThrow()
    })
})