// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vite-plus/test'
import { startReminderSse } from './reminder-sse'

/**
 * T157 / FIX-C：提醒 SSE 空 token 不建连（DEF-33 下游加固）
 *
 * @description 服务端 `/sse/reminders` 对无效 token 返 `application/json` + `10041`
 *              ⇒ 浏览器 EventSource 报 MIME 错。无 token 时**不得**发起连接。
 */

class FakeEventSource {
    private readonly listeners = new Map<string, ((event: unknown) => void)[]>()
    closed = false
    constructor(readonly url: string) {}

    addEventListener(type: string, listener: (event: unknown) => void): void {
        const list = this.listeners.get(type) ?? []
        list.push(listener)
        this.listeners.set(type, list)
    }

    emit(type: string, event: unknown): void {
        for (const listener of this.listeners.get(type) ?? []) listener(event)
    }

    close(): void {
        this.closed = true
    }
}

const asEventSource = (fake: FakeEventSource): EventSource => fake as unknown as EventSource

describe('T157 / FIX-C：提醒 SSE 连接', () => {
    it('token 缺失 / 空串 ⇒ 不建连（不调用 EventSource 构造器，返回 null）', async () => {
        const createEventSource = vi.fn()

        for (const token of [null, undefined, '']) {
            const eventSource = await startReminderSse({
                token,
                apiBaseUrl: 'http://localhost:3302/api',
                onReminder: vi.fn(),
                createEventSource
            })
            expect(eventSource).toBeNull()
        }

        expect(createEventSource).not.toHaveBeenCalled()
    })

    it('有 token ⇒ 以 token 拼 URL 建连；reminder 回调透传解析后载荷', async () => {
        const fake = new FakeEventSource('pending')
        const createEventSource = vi.fn(() => asEventSource(fake))
        const onReminder = vi.fn()

        const eventSource = await startReminderSse({
            token: 'jwt-1',
            apiBaseUrl: 'http://localhost:3302/api',
            onReminder,
            createEventSource
        })

        expect(createEventSource).toHaveBeenCalledWith(
            'http://localhost:3302/api/sse/reminders?token=jwt-1'
        )
        expect(eventSource).not.toBeNull()

        fake.emit('reminder', { data: JSON.stringify({ taskName: 't155' }) })
        expect(onReminder).toHaveBeenCalledWith({ taskName: 't155' })
    })

    it('error 事件 ⇒ 关闭连接（会话失效口径）；非法载荷不回调、不抛出', async () => {
        const fake = new FakeEventSource('pending')
        const onReminder = vi.fn()

        await startReminderSse({
            token: 'jwt-1',
            apiBaseUrl: 'http://localhost:3302/api',
            onReminder,
            createEventSource: () => asEventSource(fake)
        })

        expect(() => fake.emit('reminder', { data: 'not-json' })).not.toThrow()
        expect(onReminder).not.toHaveBeenCalled()

        fake.emit('error', {})
        expect(fake.closed).toBe(true)
    })
})