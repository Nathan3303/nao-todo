import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import {
    STRUCTURED_LOG_CAPACITY,
    STRUCTURED_LOG_EVENTS,
    STRUCTURED_LOG_PREFIX,
    clearStructuredLog,
    logEvent,
    logStructured,
    readStructuredLog,
    redactSensitive
} from '../structured-log'

/**
 * AC18 —— infrastructure 结构化日志（字段化 + 禁 PII + 有界缓冲）
 *
 * 断言三件事：① 对象信封（非拼接字符串）；② token / email / 任务正文**可断言地**被脱敏；
 * ③ 缓冲有界（防内存无界增长）。
 */

const SECRET_EMAIL = 'alice@example.com'
const SECRET_JWT = 'eyJhbGciOiJIUzI1NiJ9.payload.signature'
const SECRET_BODY = 'SECRET_TASK_BODY_不要泄漏'

describe('structured-log：AC18 结构化 + 禁 PII', () => {
    let consoleLog: ReturnType<typeof vi.spyOn>
    let consoleWarn: ReturnType<typeof vi.spyOn>
    let consoleError: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        clearStructuredLog()
        consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
        consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('产出字段化条目（对象信封，非拼接字符串）且级别路由到对应 console 方法', () => {
        const entry = logStructured('info', STRUCTURED_LOG_EVENTS.SYNC_PULL_STARTED, {
            userId: 'u-1'
        })

        expect(entry.level).toBe('info')
        expect(entry.event).toBe('sync.pull.started')
        expect(entry.fields).toEqual({ userId: 'u-1' })
        expect(typeof entry.time).toBe('string')
        expect(consoleLog).toHaveBeenCalledWith(`${STRUCTURED_LOG_PREFIX} sync.pull.started`, entry)

        logStructured('warn', STRUCTURED_LOG_EVENTS.SYNC_PULL_LOCK_SKIPPED, { userId: 'u-1' })
        logStructured('error', STRUCTURED_LOG_EVENTS.SYNC_PULL_FAILED, { userId: 'u-1' })
        expect(consoleWarn).toHaveBeenCalledTimes(1)
        expect(consoleError).toHaveBeenCalledTimes(1)
        expect(readStructuredLog().length).toBe(3)
    })

    it('敏感键（token/email/name/description/note）一律替换；允许 userId 标识', () => {
        logStructured('info', STRUCTURED_LOG_EVENTS.WIPE_COMPLETED, {
            userId: 'u-1',
            token: 'raw-token-123',
            email: SECRET_EMAIL,
            name: SECRET_BODY,
            description: SECRET_BODY,
            note: SECRET_BODY
        })

        const entry = readStructuredLog()[0]!
        const serialized = JSON.stringify(entry)
        expect(serialized).not.toContain('raw-token-123')
        expect(serialized).not.toContain(SECRET_EMAIL)
        expect(serialized).not.toContain(SECRET_BODY)
        expect(entry.fields.userId).toBe('u-1')
        expect(entry.fields.token).toBe('[redacted]')
        expect(entry.fields.email).toBe('[redacted]')
    })

    it('非敏感键的值仍做特征脱敏（email / JWT / Bearer / token=）', () => {
        const entry = logStructured('info', STRUCTURED_LOG_EVENTS.SYNC_PULL_FAILED, {
            userId: 'u-1',
            reason: `contact ${SECRET_EMAIL} jwt ${SECRET_JWT} token=abc123 Bearer xyz.abc`
        })

        const serialized = JSON.stringify(entry)
        expect(serialized).not.toContain(SECRET_EMAIL)
        expect(serialized).not.toContain(SECRET_JWT)
        expect(serialized).not.toContain('abc123')
        expect(serialized).not.toContain('xyz.abc')
        expect(entry.fields.reason).toContain('[redacted-email]')
        expect(entry.fields.reason).toContain('[redacted-jwt]')
    })

    it('缓冲有界（超出容量丢弃最旧）', () => {
        for (let i = 0; i < STRUCTURED_LOG_CAPACITY + 5; i += 1) {
            logEvent(STRUCTURED_LOG_EVENTS.SYNC_PULL_STARTED, { userId: `u-${i}` })
        }

        const log = readStructuredLog()
        expect(log.length).toBe(STRUCTURED_LOG_CAPACITY)
        expect(log[0]!.fields.userId).toBe('u-5')
        expect(log.at(-1)?.fields.userId).toBe(`u-${STRUCTURED_LOG_CAPACITY + 4}`)
    })

    it('logEvent 等价 info 级；嵌套对象逐层脱敏', () => {
        const entry = logEvent(STRUCTURED_LOG_EVENTS.SYNC_PUSH_COMPLETED, {
            userId: 'u-1',
            detail: { email: SECRET_EMAIL, name: SECRET_BODY, count: 2 }
        })
        expect(entry.level).toBe('info')
        const detail = entry.fields.detail as Record<string, unknown>
        expect(detail.email).toBe('[redacted]')
        expect(detail.name).toBe('[redacted]')
        expect(detail.count).toBe(2)
    })

    it('redactSensitive：email / Bearer / JWT / token= 特征替换', () => {
        expect(redactSensitive('contact a@b.com')).toBe('contact [redacted-email]')
        expect(redactSensitive('Authorization: Bearer abc.def')).toContain('Bearer [redacted]')
        expect(redactSensitive('jwt eyJhbGciOiJIUzI1NiJ9.abc.def')).toContain('[redacted-jwt]')
        expect(redactSensitive('token=supersecret')).toBe('token=[redacted]')
    })

    it('clearStructuredLog 清空缓冲（测试复位）', () => {
        logEvent(STRUCTURED_LOG_EVENTS.WIPE_STARTED, { userId: 'u-1' })
        expect(readStructuredLog().length).toBe(1)
        clearStructuredLog()
        expect(readStructuredLog().length).toBe(0)
    })
})