// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { USER_JWT_LOCALSTORAGE_KEY, USER_PROFILE_CACHE_KEY } from '@nao-todo/domain-identity'
import { cacheNickname, clearCachedNickname, readCachedNickname } from '../session/profile-cache'

/**
 * 离线身份缓存（昵称）断言
 * @description SHELL-03 C-15…C-21 / BC-7：白名单字段、userId 匹配、损坏/不匹配判无效并清理、
 *              无 TTL、失败静默（零 console）、仅在线成功取得昵称时写入、空昵称删除。
 * @see docs/adr/2026-09-10-shell-03-offline-availability.md
 */

/** 真实签发的 JWT（payload.Id = 422644611870101504，雪花 ID 超 Number.MAX_SAFE_INTEGER） */
const USER_A_JWT =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJJZCI6NDIyNjQ0NjExODcwMTAxNTA0LCJQYXlsb2FkIjoibGVlMTkyOEBvdXRsb29rLmNvbSIsImlzcyI6Ik5hb1RvZG9TZXJ2ZXIiLCJzdWIiOiJUb2tlbiIsImV4cCI6MTc4NjA4MjQyNSwiaWF0IjoxNzg1OTA5NjI1fQ.hs5yiNXTWbWG8YYMsdMFAjTGCI74MSufjvc2mgK67ko'

/** 另一个 userId 的 JWT（用于不匹配场景） */
const USER_B_JWT = `header.${btoa(JSON.stringify({ Id: 999 }))}.signature`

const setSession = (jwt: string): void => localStorage.setItem(USER_JWT_LOCALSTORAGE_KEY, jwt)
const rawCache = (): string | null => localStorage.getItem(USER_PROFILE_CACHE_KEY)

describe('离线身份缓存 profile-cache（BC-7）', () => {
    let consoleError: ReturnType<typeof vi.spyOn>
    let consoleWarn: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        localStorage.clear()
        consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
        localStorage.clear()
    })

    it('命中：与当前 JWT 的 userId 匹配 ⇒ 返回昵称，且记录仅白名单三字段（C-15）', () => {
        setSession(USER_A_JWT)
        cacheNickname('  张三  ')
        expect(readCachedNickname()).toBe('张三')
        const record = JSON.parse(rawCache() ?? '{}') as Record<string, unknown>
        expect(Object.keys(record).sort()).toEqual(['cachedAt', 'nickname', 'userId'])
        expect(record.userId).toBe('422644611870101504')
        expect(record.nickname).toBe('张三')
        expect(consoleError).not.toHaveBeenCalled()
    })

    it('未命中：无缓存 ⇒ null（零 console）', () => {
        setSession(USER_A_JWT)
        expect(readCachedNickname()).toBeNull()
        expect(consoleError).not.toHaveBeenCalled()
    })

    it('C-16：userId 不匹配 ⇒ 视为无效并清除该键', () => {
        setSession(USER_A_JWT)
        cacheNickname('张三')
        expect(rawCache()).not.toBeNull()
        setSession(USER_B_JWT)
        expect(readCachedNickname()).toBeNull()
        expect(rawCache()).toBeNull()
        expect(consoleError).not.toHaveBeenCalled()
    })

    it('C-16/C-17/DEF-02：JSON 损坏与形状非法 ⇒ null、**该键被清理**且零 console', () => {
        setSession(USER_A_JWT)
        localStorage.setItem(USER_PROFILE_CACHE_KEY, '{不是 JSON')
        expect(readCachedNickname()).toBeNull()
        expect(rawCache()).toBeNull() // DEF-02：损坏记录必须被删除（防空键长期留存）

        localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify({ nickname: '张三' }))
        expect(readCachedNickname()).toBeNull()
        expect(rawCache()).toBeNull()

        localStorage.setItem(
            USER_PROFILE_CACHE_KEY,
            JSON.stringify({ userId: 'x', nickname: 1, cachedAt: 'now' })
        )
        expect(readCachedNickname()).toBeNull()
        expect(rawCache()).toBeNull()

        localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify('张三'))
        expect(readCachedNickname()).toBeNull()
        expect(rawCache()).toBeNull()
        expect(consoleError).not.toHaveBeenCalled()
        expect(consoleWarn).not.toHaveBeenCalled()
    })

    it('C-17：localStorage 读/写抛错 ⇒ 静默降级（不抛错、零 console）', () => {
        setSession(USER_A_JWT)
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError')
        })
        expect(() => cacheNickname('张三')).not.toThrow()
        setItem.mockRestore()

        const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError')
        })
        expect(readCachedNickname()).toBeNull()
        getItem.mockRestore()

        expect(consoleError).not.toHaveBeenCalled()
        expect(consoleWarn).not.toHaveBeenCalled()
    })

    it('C-21：空/纯空白昵称 ⇒ 删除缓存而非写空值', () => {
        setSession(USER_A_JWT)
        cacheNickname('张三')
        expect(rawCache()).not.toBeNull()
        cacheNickname('   ')
        expect(rawCache()).toBeNull()
        expect(readCachedNickname()).toBeNull()
        cacheNickname('')
        expect(rawCache()).toBeNull()
    })

    it('C-21：无有效会话（无 JWT）⇒ 不写缓存（userId 是有效性唯一依据）', () => {
        cacheNickname('张三')
        expect(rawCache()).toBeNull()
        expect(readCachedNickname()).toBeNull()
    })

    it('登出/切换用户：clearCachedNickname 清除缓存', () => {
        setSession(USER_A_JWT)
        cacheNickname('张三')
        clearCachedNickname()
        expect(rawCache()).toBeNull()
        expect(readCachedNickname()).toBeNull()
    })

    it('C-16：不设 TTL（cachedAt 很旧仍返回昵称，不得据此隐藏）', () => {
        setSession(USER_A_JWT)
        localStorage.setItem(
            USER_PROFILE_CACHE_KEY,
            JSON.stringify({
                userId: '422644611870101504',
                nickname: '张三',
                cachedAt: '2000-01-01T00:00:00.000Z'
            })
        )
        expect(readCachedNickname()).toBe('张三')
    })
})