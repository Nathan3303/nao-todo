/**
 * 会话结束类别：本地推断 + 落地存储（W3 登录页横幅的唯一判据，ADR D5 / `DEF-92`）
 *
 * @description 服务端把「过期 / 被顶号 / 会话被撤销」统一压成 `10041`/`10042`（不细分原因，
 *              也不改契约）⇒ 客户端只能按**本地证据**推断类别：
 *              - JWT `exp` 已过 ⇒ `expired`（登录过期）；
 *              - 未过 ⇒ `signed-in-elsewhere`（他处登录 / 会话被撤销）；
 *              - 原因缺失、脏值、token 不可解析 ⇒ `session-ended`（通用兜底，**不猜**原因，R3）。
 *
 *              **存储**：`sessionStorage`（刷新仍在、关标签即清），值**只存类别枚举** ——
 *              不存 JWT / 不存密码 / 不存用户信息（R5）；用户主动登出 ⇒ `clearSessionEndReason()`。
 *              键按 `local-storage-policy.ts` 的 `USER_SCOPED_SESSION_STORAGE_KEYS` 登记（D2 同口径）。
 *
 * @see docs/adr/2026-10-31-credential-coherence.md（D5 提示形态 · D1 单点判据）
 * @see docs/prds/2026-10-31-session-ux-tail.md（AC1–AC4 / R1 / R3 / R5）
 */

/** 会话结束类别（登录页横幅按此选文案；**只存这三个枚举值**） */
export type SessionEndCategory = 'expired' | 'signed-in-elsewhere' | 'session-ended'

/** `sessionStorage` 键：会话结束类别 */
export const SESSION_END_REASON_KEY = 'SESSION_END_REASON'

/** `sessionStorage` 键：横幅已被用户关闭（R4「关了就关」，但类别仍可读） */
export const SESSION_END_REASON_DISMISSED_KEY = 'SESSION_END_REASON_DISMISSED'

/** 全部合法类别（读取时逐值校验：脏值一律当「无类别」） */
export const SESSION_END_CATEGORIES: readonly SessionEndCategory[] = [
    'expired',
    'signed-in-elsewhere',
    'session-ended'
]

/**
 * 已知的失效原因（发布方给的占位值）
 * @description `credential-invalid` = 请求器当前唯一发布值；`expired` / `signed-in-elsewhere`
 *              为将来按需细分时预留。**未知值一律通用兜底**（脏值不得被当成「过期 / 他处登录」）。
 */
const KNOWN_REASONS: ReadonlySet<string> = new Set([
    'expired',
    'signed-in-elsewhere',
    'credential-invalid'
])

/** `sessionStorage` 最小接口（隐私模式 / 不可用环境下降级） */
const sessionStore = (): Storage | null => {
    try {
        if (typeof sessionStorage === 'undefined') return null
        return sessionStorage
    } catch {
        return null
    }
}

/**
 * 读取 JWT 的 `exp`（秒）
 * @description 只解 base64url 的 payload 段，**不校验签名**（签名属服务端职责，本地推断只需 `exp`）；
 *              雪花 ID 精度问题与本节无关（只取 `exp` 数字字段）。
 * @param token JWT（可空；空 / 结构非法 / 解不出 `exp` ⇒ `null`）
 * @returns `exp` 秒数（`null` = 不可判定）
 */
export const readJwtExpSeconds = (token: string | null | undefined): number | null => {
    if (!token) return null
    const parts = token.split('.')
    if (parts.length !== 3) return null
    let base64 = (parts[1] ?? '').replace(/-/g, '+').replace(/_/g, '/')
    while (base64.length % 4) base64 += '='
    let text: string
    try {
        text = atob(base64)
    } catch {
        return null
    }
    try {
        const payload = JSON.parse(text) as Record<string, unknown>
        const exp = payload.exp
        return typeof exp === 'number' && Number.isFinite(exp) ? exp : null
    } catch {
        // payload 含超长整数（雪花 ID）时 `JSON.parse` 仍可用，但保守起见退回正则取 `exp`
        const match = text.match(/"exp"\s*:\s*(\d+)/)
        return match ? Number(match[1]) : null
    }
}

/**
 * token 是否已过期
 * @returns `true` 已过期 / `false` 未过期 / `null` 不可判定（无 token、脏值、无 `exp`）
 */
export const isJwtExpired = (token: string | null | undefined): boolean | null => {
    const exp = readJwtExpSeconds(token)
    if (exp === null) return null
    return exp * 1000 <= Date.now()
}

/**
 * 推断会话结束类别（**唯一判据**，ADR D5 / R2）
 * @description 页面**不得**另写判定：一律用它（`session-end.ts` 写入、检入页读 `isJwtExpired`）。
 * @param rawReason 发布方给出的原因（未知 / 缺失 ⇒ 通用兜底）
 * @param token 失效前的 JWT（可空）
 */
export const inferSessionEndCategory = (
    rawReason: unknown,
    token: string | null | undefined
): SessionEndCategory => {
    if (typeof rawReason !== 'string' || !KNOWN_REASONS.has(rawReason)) return 'session-ended'
    const expired = isJwtExpired(token)
    if (expired === null) return 'session-ended'
    return expired ? 'expired' : 'signed-in-elsewhere'
}

/**
 * 落地一次会话结束类别（清掉「已关闭」标记 ⇒ 新一次失效仍会提示）
 * @param category 类别枚举
 */
export const writeSessionEndCategory = (category: SessionEndCategory): void => {
    const store = sessionStore()
    if (!store) return
    try {
        store.setItem(SESSION_END_REASON_KEY, category)
        store.removeItem(SESSION_END_REASON_DISMISSED_KEY)
    } catch {
        /* 存储不可用（配额 / 隐私模式）：横幅退化为「本次不提示」，不得影响会话结束本身 */
    }
}

/**
 * 读取当前会话结束类别（**不看**「已关闭」标记）
 * @returns 类别枚举；无记录 / 脏值 ⇒ `null`
 */
export const readSessionEndCategory = (): SessionEndCategory | null => {
    const store = sessionStore()
    if (!store) return null
    try {
        const value = store.getItem(SESSION_END_REASON_KEY)
        return SESSION_END_CATEGORIES.find((category) => category === value) ?? null
    } catch {
        return null
    }
}

/**
 * 读取**应展示**的类别（有类别且用户未关闭 → 类别；否则 `null`）
 * @description 登录页入口一次判定：“关闭了就关”（刷新不复发，R4），但类别本身保留可读。
 */
export const readVisibleSessionEndCategory = (): SessionEndCategory | null => {
    const category = readSessionEndCategory()
    if (category === null) return null
    const store = sessionStore()
    if (!store) return null
    try {
        return store.getItem(SESSION_END_REASON_DISMISSED_KEY) === '1' ? null : category
    } catch {
        return null
    }
}

/**
 * 用户关闭横幅（R4：关了就关，刷新不复发）
 * @description 只置「已关闭」标记，**保留类别**（刷新后仍可读、便于后续诊断与同类实现复用）。
 */
export const dismissSessionEndBanner = (): void => {
    const store = sessionStore()
    if (!store) return
    try {
        store.setItem(SESSION_END_REASON_DISMISSED_KEY, '1')
    } catch {
        /* 存储不可用 ⇒ 忽略 */
    }
}

/**
 * 清空会话结束类别（**主动登出**时调用，R3 不误导）
 * @description 用户自己点的登出不是「失效」⇒ 下次进登录页不得显示上一次的失效横幅。
 */
export const clearSessionEndReason = (): void => {
    const store = sessionStore()
    if (!store) return
    try {
        store.removeItem(SESSION_END_REASON_KEY)
        store.removeItem(SESSION_END_REASON_DISMISSED_KEY)
    } catch {
        /* 存储不可用 ⇒ 忽略 */
    }
}