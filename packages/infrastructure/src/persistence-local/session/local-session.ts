import { USER_JWT_LOCALSTORAGE_KEY } from '@nao-todo/domain-identity'

/**
 * 从 JWT 解析用户 ID（雪花 ID）
 * @description 后端签发的 payload 字段为 Id（大写），值为超出 Number.MAX_SAFE_INTEGER 的雪花数字，
 *              JSON.parse 会丢失精度，需从解码文本正则提取原始数字字符串。
 *              字段优先级：Id（实际签发格式）→ id → profile.id。
 * @param jwt JWT 字符串
 * @returns 用户 ID 字符串；解析失败返回 null
 */
export const extractUserIdFromJwt = (jwt: string): string | null => {
    if (!jwt) return null
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    let base64 = (parts[1] || '').replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) base64 += '='
    let text: string
    try {
        text = atob(base64)
    } catch {
        return null
    }
    // 精确提取顶层 Id/id 的原始数字字符串（不丢精度）
    const match = text.match(/["'](?:Id|id)["']\s*:\s*"?(\d+)/)
    if (match) return match[1] ?? null
    // 兜底：profile.id 等常规小整数结构（JSON.parse 无精度问题）
    try {
        const payload = JSON.parse(text) as Record<string, unknown>
        const profile = payload.profile as Record<string, unknown> | undefined
        const id = profile?.id ?? payload.Id ?? payload.id
        return id === undefined || id === null ? null : String(id as string | number)
    } catch {
        return null
    }
}

/**
 * 本地用户会话
 * @description 记录当前登录用户的 ID，供本地仓储按用户过滤/填充数据。
 */
export class LocalSession {
    private currentUserId: string | null = null

    /**
     * 当前用户 ID
     */
    getCurrentUserId(): string | null {
        return this.currentUserId
    }

    /**
     * 设置当前用户 ID
     * @param userId 用户 ID（雪花 ID 字符串）
     */
    setCurrentUserId(userId: string | null): void {
        this.currentUserId = userId
    }

    /**
     * 清空会话（登出时调用）
     */
    clear(): void {
        this.currentUserId = null
    }
}

/**
 * 本地用户会话单例
 */
export const localSession = new LocalSession()

/**
 * 从 localStorage 中已保存的 JWT 解析当前用户 ID
 * @description 启动/解锁流程用于初始化会话；无 JWT 或解析失败返回 null。
 */
export const resolveUserIdFromStoredJwt = (): string | null => {
    if (typeof localStorage === 'undefined') return null
    const jwt = localStorage.getItem(USER_JWT_LOCALSTORAGE_KEY)
    return jwt ? extractUserIdFromJwt(jwt) : null
}