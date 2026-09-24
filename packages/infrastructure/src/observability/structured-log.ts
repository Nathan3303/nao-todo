/**
 * infrastructure 关键路径结构化日志（AC18；禁 PII）
 *
 * @description 覆盖启动 / 迁移 / 清库 / sync（拉取·回传）等关键路径的**显式事件**。
 *              字段化（对象信封）而非拼接字符串；固定事件名常量；有界内存缓冲供测试断言；
 *              PII 脱敏是**本模块职责**（token / email / 任务正文等在落库前被替换或剔除）。
 *
 *              与 app 层 `apps/web/src/error-observability.ts` 的关系：
 *              - 后者 = **全局未捕获异常兜底**（`window error` / `unhandledrejection` / Vue
 *                `errorHandler` / `router.onError`），前缀 `[SHELL-05]`；
 *              - 本模块 = infrastructure 关键路径的**预期内事件**，前缀 `[nao-infra]`；
 *              - **各司其职、不重叠**：前者不落业务事件，后者不接全局钩子。PRD NFR
 *                「复用全局未捕获异常兜底」= 保留该兜底，不是替换。
 *
 *              零依赖（仅 `console`）⇒ 不拖累移动端按子路径导入 `persistence-go` 的包体。
 */

/** 统一日志前缀（infrastructure 家族） */
export const STRUCTURED_LOG_PREFIX = '[nao-infra]'

/** 有界缓冲上限（显式有界，防内存无界增长） */
export const STRUCTURED_LOG_CAPACITY = 200

/** 单字符串字段截断上限 */
const MAX_STRING_LENGTH = 300

/** 递归脱敏深度上限 */
const MAX_DEPTH = 3

/** 数组字段元素上限 */
const MAX_ARRAY_ITEMS = 20

/** 敏感键的替换值 */
const REDACTED = '[redacted]'

/** 日志级别 */
export type StructuredLogLevel = 'info' | 'warn' | 'error'

/**
 * 固定事件名常量（点分命名：`<域>.<对象>.<动作>`）
 * @description 禁裸字符串 —— 调用方必须引用本常量，避免事件名漂移导致不可聚合。
 */
export const STRUCTURED_LOG_EVENTS = {
    /** 启动收敛点（web `bootstrapLocalData` / desktop 冷启动） */
    LIFECYCLE_BOOTSTRAP_STARTED: 'lifecycle.bootstrap.started',
    LIFECYCLE_BOOTSTRAP_COMPLETED: 'lifecycle.bootstrap.completed',
    LIFECYCLE_BOOTSTRAP_FAILED: 'lifecycle.bootstrap.failed',
    /** 历史密文 → 明文迁移 */
    MIGRATION_STARTED: 'migration.plaintext.started',
    MIGRATION_COMPLETED: 'migration.plaintext.completed',
    /** web 旧密文一次性自愈（DEF-35 / C-68） */
    LEGACY_CIPHER_SELF_HEALED: 'migration.legacy-cipher.self-healed',
    LEGACY_CIPHER_SELF_HEAL_BLOCKED: 'migration.legacy-cipher.self-heal-blocked',
    /** 登出 / 注销到期 / 切换账号清库 */
    WIPE_STARTED: 'wipe.user-data.started',
    WIPE_COMPLETED: 'wipe.user-data.completed',
    /** sync 拉取 */
    SYNC_PULL_STARTED: 'sync.pull.started',
    SYNC_PULL_COMPLETED: 'sync.pull.completed',
    SYNC_PULL_FAILED: 'sync.pull.failed',
    SYNC_PULL_LOCK_SKIPPED: 'sync.pull.lock.skipped',
    SYNC_PULL_LOCK_UNAVAILABLE: 'sync.pull.lock.unavailable',
    /** sync 回传 */
    SYNC_PUSH_STARTED: 'sync.push.started',
    SYNC_PUSH_COMPLETED: 'sync.push.completed',
    SYNC_PUSH_FAILED: 'sync.push.failed',
    SYNC_PUSH_UNCONFIRMED: 'sync.push.unconfirmed',
    /** 运行级不可达防御（存储/加解密等意外异常） */
    SYNC_RUN_UNEXPECTED_ERROR: 'sync.run.unexpected-error'
} as const

/** 事件名（固定常量并集） */
export type StructuredLogEvent = (typeof STRUCTURED_LOG_EVENTS)[keyof typeof STRUCTURED_LOG_EVENTS]

/** 结构化字段（只应放标识 / 枚举 / 数值 / 布尔；字符串会被脱敏与截断） */
export type StructuredLogFields = Record<string, unknown>

/** 一条结构化日志（字段白名单：时间 / 级别 / 事件 / 脱敏后字段） */
export interface StructuredLogEntry {
    /** ISO 时间戳 */
    time: string
    level: StructuredLogLevel
    event: StructuredLogEvent
    /** 脱敏后的字段（token / email / 正文被替换或剔除） */
    fields: Record<string, unknown>
}

/** 有界缓冲（模块级单例；读写仅经导出函数） */
const buffer: StructuredLogEntry[] = []

/** 截断并标注省略 */
const truncate = (value: string, max: number): string =>
    value.length > max ? `${value.slice(0, max)}…` : value

/**
 * 字符串脱敏：email / Bearer / JWT / token= —— 只做特征替换，不解析业务语义
 * @description 与 app 层 `error-observability.ts` 同族规则（本模块不依赖 app 层，故独立实现）。
 */
export const redactSensitive = (value: string): string =>
    value
        .replace(/\b[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[a-zA-Z]{2,}\b/g, '[redacted-email]')
        .replace(/(Bearer\s+)[\w~+/-]+/gi, '$1[redacted]')
        .replace(/\beyJ[\w-]*\.[\w-]+\.[\w-]+/g, '[redacted-jwt]')
        .replace(/((?:access[_-]?)?token\s*[=:]\s*)[^\s,;"']+/gi, '$1[redacted]')

/** 敏感键名集合（小写、去 `_`/`-` 后比较；另含子串匹配） */
const SENSITIVE_KEYS = new Set([
    'name',
    'nickname',
    'avatar',
    'email',
    'description',
    'content',
    'note',
    'body',
    'text',
    'taskname',
    'title',
    'comment',
    'password',
    'secret',
    'jwt',
    'token',
    'authorization'
])

/** 判定字段名是否敏感（token / email / 任务正文类） */
const isSensitiveKey = (key: string): boolean => {
    const normalized = key.toLowerCase().replace(/[_-]/g, '')
    return (
        SENSITIVE_KEYS.has(normalized) ||
        normalized.includes('token') ||
        normalized.includes('password') ||
        normalized.includes('secret') ||
        normalized.includes('jwt') ||
        normalized.includes('authorization') ||
        normalized.includes('email')
    )
}

/** 递归脱敏任意值（未知类型剔除为 `undefined`） */
const sanitizeValue = (value: unknown, depth: number): unknown => {
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
    if (typeof value === 'string') return truncate(redactSensitive(value), MAX_STRING_LENGTH)
    if (depth >= MAX_DEPTH) return '[truncated]'
    if (Array.isArray(value)) {
        return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1))
    }
    if (typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            out[key] = isSensitiveKey(key) ? REDACTED : sanitizeValue(item, depth + 1)
        }
        return out
    }
    return undefined
}

/** 字段对象脱敏（跳过 `undefined`） */
const sanitizeFields = (fields: StructuredLogFields | undefined): Record<string, unknown> => {
    if (!fields) return {}
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(fields)) {
        if (value === undefined) continue
        out[key] = isSensitiveKey(key) ? REDACTED : sanitizeValue(value, 0)
    }
    return out
}

/**
 * 记录一条结构化事件（入有界缓冲 + `console` 信封）
 * @param level 级别
 * @param event 固定事件名（`STRUCTURED_LOG_EVENTS`）
 * @param fields 字段对象（禁 PII；token / email / 正文会被脱敏）
 * @returns 落库条目（便于断言）
 */
export const logStructured = (
    level: StructuredLogLevel,
    event: StructuredLogEvent,
    fields?: StructuredLogFields
): StructuredLogEntry => {
    const entry: StructuredLogEntry = {
        time: new Date().toISOString(),
        level,
        event,
        fields: sanitizeFields(fields)
    }
    buffer.push(entry)
    if (buffer.length > STRUCTURED_LOG_CAPACITY) {
        buffer.splice(0, buffer.length - STRUCTURED_LOG_CAPACITY)
    }
    const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    sink(`${STRUCTURED_LOG_PREFIX} ${event}`, entry)
    return entry
}

/** info 级便捷入口（等价 `logStructured('info', ...)`） */
export const logEvent = (
    event: StructuredLogEvent,
    fields?: StructuredLogFields
): StructuredLogEntry => logStructured('info', event, fields)

/** 只读读取当前缓冲快照（供测试/QA 断言） */
export const readStructuredLog = (): readonly StructuredLogEntry[] => [...buffer]

/** 清空缓冲（测试/手动复位） */
export const clearStructuredLog = (): void => {
    buffer.length = 0
}