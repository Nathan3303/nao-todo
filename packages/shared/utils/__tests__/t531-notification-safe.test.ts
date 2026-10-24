// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { sendNotification } from '../notification'

/**
 * T531 · 通知适配层「永不抛」+ 静音开关（AC3 / AC10 · 红基线）
 *
 * 契约（`packages/shared/utils/notification.ts`）：
 * - `SendNotificationOptions` 增加 `silent?: boolean`（声音开关映射 `silent: !sound`；
 *   用系统通知自带声音，不新增音频素材）；
 * - 返回值改为 **`boolean`**：`true` = 已交给系统通知；`false` = 未发出（无 API / 未授权 /
 *   构造抛错）。**永不抛错**（`new Notification` 在 Android Chrome 页面通知被禁用时抛
 *   `TypeError`；现状异常会穿透引擎 `notify` ⇒ 已 claim 未 consume ⇒ 该条永久丢）。
 *
 * 硬约束（架构报告 §8 R1 / PRD §三 范围 7 / §七 AC10）：本层是「通知失败 ≠ 提醒丢失」的唯一兜底，
 * 因此所有分支（无 API / denied / 构造抛错 / 配额等）都必须是**值返回**而非异常。
 *
 * @see docs/prds/2026-10-24-reminder-settings.md §七 AC3/AC10
 */

const BaseNotification = (globalThis as { Notification?: unknown }).Notification

type StubOptions = { body?: string; icon?: string; silent?: boolean }

class NotificationStub {
    static permission: NotificationPermission = 'granted'
    static instances: NotificationStub[] = []
    static throwOnConstruct = false
    static requestPermission = vi.fn(async () => 'granted' as NotificationPermission)

    onclick: (() => void) | null = null
    closed = false

    constructor(
        readonly title: string,
        readonly options: StubOptions
    ) {
        if (NotificationStub.throwOnConstruct) {
            throw new TypeError('Illegal constructor')
        }
        NotificationStub.instances.push(this)
    }

    close(): void {
        this.closed = true
    }
}

const installNotification = (
    permission: NotificationPermission,
    options: { throwing?: boolean } = {}
): void => {
    NotificationStub.permission = permission
    NotificationStub.instances = []
    NotificationStub.throwOnConstruct = options.throwing === true
    ;(globalThis as { Notification?: unknown }).Notification = NotificationStub
    Object.defineProperty(window, 'Notification', {
        configurable: true,
        writable: true,
        value: NotificationStub
    })
}

const removeNotification = (): void => {
    delete (globalThis as { Notification?: unknown }).Notification
    delete (window as { Notification?: unknown }).Notification
}

beforeEach(() => {
    installNotification('granted')
})

afterEach(() => {
    vi.restoreAllMocks()
    if (BaseNotification === undefined) {
        removeNotification()
    } else {
        ;(globalThis as { Notification?: unknown }).Notification = BaseNotification
    }
})

describe('T531 · AC3 静音开关（silent）', () => {
    it('AC3 silent=true ⇒ 通知以 silent: true 构造（系统通知不出声）', () => {
        sendNotification('任务提醒', '买菜', { silent: true })

        expect(NotificationStub.instances[0]?.options.silent).toBe(true)
    })

    it('AC3 未传 / silent=false ⇒ 不静音（保持系统默认声音）', () => {
        sendNotification('任务提醒', '买菜')
        sendNotification('任务提醒', '洗车', { silent: false })

        expect(NotificationStub.instances[0]?.options.silent).not.toBe(true)
        expect(NotificationStub.instances[1]?.options.silent).toBe(false)
    })

    it('AC3 silent 与 onClick 可同时使用（互不覆盖）', () => {
        const onClick = vi.fn()
        vi.spyOn(window, 'focus').mockImplementation(() => {})

        sendNotification('任务提醒', '买菜', { silent: true, onClick })
        NotificationStub.instances[0]?.onclick?.()

        expect(NotificationStub.instances[0]?.options.silent).toBe(true)
        expect(onClick).toHaveBeenCalledTimes(1)
    })
})

describe('T531 · AC10 通知层永不抛（值返回）', () => {
    it('AC10 构造抛错（Android Chrome 页面通知被禁用）⇒ 返回 false、不抛错', () => {
        installNotification('granted', { throwing: true })

        expect(() => sendNotification('任务提醒', '买菜')).not.toThrow()
        expect(sendNotification('任务提醒', '买菜')).toBe(false)
        expect(NotificationStub.instances).toHaveLength(0)
    })

    it('AC10 构造抛错可重复调用（后续扫描不得再抛，也不得产生实例）', () => {
        installNotification('granted', { throwing: true })

        expect(sendNotification('任务提醒', 'a')).toBe(false)
        expect(sendNotification('任务提醒', 'b')).toBe(false)
        expect(sendNotification('任务提醒', 'c')).toBe(false)
        expect(NotificationStub.instances).toHaveLength(0)
    })

    it('AC10 无 Notification 全局（iPhone Safari 标签页）⇒ 返回 false、不抛错', () => {
        removeNotification()

        expect('Notification' in window).toBe(false)
        expect(() => sendNotification('任务提醒', '买菜')).not.toThrow()
        expect(sendNotification('任务提醒', '买菜')).toBe(false)
    })

    it('AC10 权限 denied ⇒ 返回 false、不构造、不抛错', () => {
        installNotification('denied')

        expect(sendNotification('任务提醒', '买菜')).toBe(false)
        expect(NotificationStub.instances).toHaveLength(0)
    })

    it('AC10 权限 default（未授权）⇒ 返回 false（索权由设置区手势负责）', () => {
        installNotification('default')

        expect(sendNotification('任务提醒', '买菜')).toBe(false)
        expect(NotificationStub.instances).toHaveLength(0)
    })

    it('AC10 granted 且构造成功 ⇒ 返回 true（调用方可据此区分「已发出 / 已降级」）', () => {
        expect(sendNotification('任务提醒', '买菜')).toBe(true)
        expect(NotificationStub.instances).toHaveLength(1)
    })
})