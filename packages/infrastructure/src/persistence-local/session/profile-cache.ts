import { USER_PROFILE_CACHE_KEY } from '@nao-todo/domain-identity'
import { resolveUserIdFromStoredJwt } from './local-session'

/**
 * 离线身份缓存（昵称）—— 仅用于离线呈现降级
 * @description SHELL-03 C-15…C-21：
 *              - 白名单字段 { userId, nickname, cachedAt }：禁 email / 头像 URL 或图片字节 / token / 整对象；
 *              - 介质为**解锁前可读**的明文 localStorage（禁落 Dexie/密钥包路径，否则解锁门读不到）；
 *              - 与当前 JWT 解析出的 userId 不匹配即视为无效；**不设 TTL**（cachedAt 仅诊断用）；
 *              - 读/写/解析失败一律静默降级为"无缓存"（零 console、不抛错、不污染门/壳终态）；
 *              - **不得**用于鉴权 / 登录判定 / 路由守卫（仅呈现降级）。
 * @see docs/adr/2026-09-10-shell-03-offline-availability.md
 */

/** 缓存记录（白名单，不含任何其它字段） */
interface ProfileCacheRecord {
    userId: string
    nickname: string
    cachedAt: string
}

/** 解析并校验缓存记录（无效返回 null；由调用方清理脏键） */
const parseRecord = (raw: string | null): ProfileCacheRecord | null => {
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw) as Partial<ProfileCacheRecord> | null
        if (!parsed || typeof parsed !== 'object') return null
        const { userId, nickname, cachedAt } = parsed
        if (typeof userId !== 'string' || !userId) return null
        if (typeof nickname !== 'string') return null
        return { userId, nickname, cachedAt: typeof cachedAt === 'string' ? cachedAt : '' }
    } catch {
        // JSON 损坏：按无效处理（静默）
        return null
    }
}

/**
 * 读取离线昵称（当前用户且缓存有效时返回昵称，否则 null）
 * @description userId 不匹配 / 记录损坏 ⇒ 清理该键并返回 null（C-16）
 */
export const readCachedNickname = (): string | null => {
    if (typeof localStorage === 'undefined') return null
    try {
        const raw = localStorage.getItem(USER_PROFILE_CACHE_KEY)
        if (!raw) return null
        const record = parseRecord(raw)
        if (!record) {
            // C-16：记录损坏（JSON 非法/形状非法）⇒ 清理该键后返回 null（C-17：静默）
            localStorage.removeItem(USER_PROFILE_CACHE_KEY)
            return null
        }
        const currentUserId = resolveUserIdFromStoredJwt()
        if (!currentUserId || record.userId !== currentUserId) {
            localStorage.removeItem(USER_PROFILE_CACHE_KEY)
            return null
        }
        const nickname = record.nickname.trim()
        return nickname ? nickname : null
    } catch {
        // 不可用（隐私模式/配额/宿主异常）：静默降级
        return null
    }
}

/**
 * 写入离线昵称缓存（仅在**在线成功取得昵称**时调用，C-21）
 * @description 空/纯空白昵称 ⇒ 删除缓存而非写空值；先序列化成功再 setItem（不残留半截数据）
 */
export const cacheNickname = (nickname: string): void => {
    if (typeof localStorage === 'undefined') return
    const trimmed = typeof nickname === 'string' ? nickname.trim() : ''
    if (!trimmed) {
        clearCachedNickname()
        return
    }
    try {
        const userId = resolveUserIdFromStoredJwt()
        // 无有效会话（无 JWT/解析失败）：不写缓存（userId 是有效性的唯一依据）
        if (!userId) return
        const payload = JSON.stringify({
            userId,
            nickname: trimmed,
            cachedAt: new Date().toISOString()
        })
        localStorage.setItem(USER_PROFILE_CACHE_KEY, payload)
    } catch {
        // 写失败（配额/隐私模式）：静默降级，不残留半截数据也不污染终态
    }
}

/** 清除离线昵称缓存（登出 / 切换用户 / 注销清理 / 解析失败） */
export const clearCachedNickname = (): void => {
    if (typeof localStorage === 'undefined') return
    try {
        localStorage.removeItem(USER_PROFILE_CACHE_KEY)
    } catch {
        // 静默
    }
}