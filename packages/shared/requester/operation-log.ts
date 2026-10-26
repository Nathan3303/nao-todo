import Dexie, { type Table } from 'dexie'
import { nanoid } from 'nanoid'
import type { HttpMethod, OperationLog } from './types'

/**
 * 操作日志数据库
 * @description 基于 Dexie（IndexedDB）持久化网络请求的操作日志
 */
class OperationLogDatabase extends Dexie {
    /** 操作日志表 */
    operationLogs!: Table<OperationLog, string>

    constructor() {
        super('nao-todo-operation-log')
        this.version(1).stores({ operationLogs: 'id, status' })
    }
}

/**
 * 操作日志数据库实例
 */
const db = new OperationLogDatabase()

/**
 * 对请求数据做安全的结构化克隆处理
 * @description 若数据包含函数、循环引用等无法被结构化克隆的内容，则返回 undefined
 * @param data 原始请求数据
 * @returns 可安全持久化的数据或 undefined
 */
const toClonableData = (data?: unknown): unknown => {
    if (data === undefined) return undefined
    try {
        return structuredClone(data)
    } catch {
        return undefined
    }
}

/**
 * 凭据类字段键（大小写 / 下划线 / 连字符不敏感）
 * @description 命中即视为「凭据原文」，**永不**允许进 IndexedDB（T560 / P0-安全）。
 *              `password` 家族覆盖 signin / signup / 改密 / 注销账号；`token`/`jwt` 覆盖检入 / 登出。
 */
const CREDENTIAL_FIELD_KEYS: readonly string[] = [
    'password',
    'oldpassword',
    'newpassword',
    'confirmpassword',
    'token',
    'jwt',
    'secret',
    'authorization',
    'accesstoken',
    'refreshtoken'
]

/** 认证接口路径（`/auth/signin`、`/auth/signup`、`/auth/checkin`、`/auth/signout` …） */
const AUTH_PATH_PATTERN = /(^|\/)auth(\/|$)/i

/** 键名归一化（去分隔符 + 小写） */
const normalizeKey = (key: string): string => key.replace(/[_-]/g, '').toLowerCase()

/** 递归判定键名是否凭据类（深度上限防御异常结构） */
const isCredentialKey = (key: string): boolean => CREDENTIAL_FIELD_KEYS.includes(normalizeKey(key))

/** 递归判定请求体（任意深度 / 数组）是否含凭据字段 */
const containsCredentialField = (data: unknown, depth = 0): boolean => {
    if (data === null || typeof data !== 'object' || depth > 8) return false
    if (Array.isArray(data)) return data.some((item) => containsCredentialField(item, depth + 1))
    return Object.entries(data as Record<string, unknown>).some(([key, value]) =>
        isCredentialKey(key) ? true : containsCredentialField(value, depth + 1)
    )
}

/** 去掉查询串 / hash，只留路径 */
const pathOf = (url: string): string => url.split(/[?#]/)[0] ?? ''

/**
 * 该请求是否**必须排除**在操作日志之外（T560 / P0-安全）
 * @description 两条任一命中即排除：① 认证接口（`/auth/*`）；② 请求体含凭据字段。
 *              认证类请求还**不得**被 `replayFailedOperations` 重放（避免重放登录/检入/登出）。
 * @param url 请求地址
 * @param data 请求体
 * @returns `true` = 不落库、不重放
 */
export const shouldSkipOperationLog = (url: string, data?: unknown): boolean =>
    AUTH_PATH_PATTERN.test(pathOf(url)) || containsCredentialField(data)

/**
 * 一次性清理历史残留：删除请求体含凭据 / 认证接口的操作日志
 * @description 旧版本把请求体**原样**落库（明文口令已进 IndexedDB）⇒ 初始化必须扫除。
 *              幂等：无残留时零删除。失败只记录（不阻断启动）。
 * @returns 删除条数
 */
export const purgeLegacyCredentialLogs = async (): Promise<number> => {
    try {
        const logs = await db.operationLogs.toArray()
        const ids = logs
            .filter((log) => shouldSkipOperationLog(log.url, log.data))
            .map((log) => log.id)
        if (ids.length > 0) await db.operationLogs.bulkDelete(ids)
        if (ids.length > 0) {
            console.warn(`[operation-log] 已清理含凭据的历史操作日志：${ids.length} 条`)
        }
        return ids.length
    } catch (error) {
        console.warn('[operation-log] 清理历史凭据日志失败：', error)
        return 0
    }
}

/**
 * 创建一条操作日志
 * @description 写入 status='pending'、retryCount=0 的日志；仅存 method/url/data，绝不写入 header。
 *              **凭据红线（T560）**：认证接口 / 请求体含凭据 ⇒ 直接跳过（既不落库、也不可重放）。
 * @param method 请求方法
 * @param url 请求地址
 * @param data 请求数据（仅保留可结构化克隆的内容）
 * @returns 生成的日志 id；`null` = 本次请求按凭据红线**未记日志**
 */
export const createLog = async (
    method: HttpMethod,
    url: string,
    data?: unknown
): Promise<string | null> => {
    if (shouldSkipOperationLog(url, data)) return null
    const id = nanoid()
    try {
        const log: OperationLog = {
            id,
            method,
            url,
            data: toClonableData(data),
            status: 'pending',
            createdAt: Date.now(),
            retryCount: 0
        }
        await db.operationLogs.add(log)
    } catch (error) {
        console.warn('[operation-log] 创建操作日志失败：', error)
    }
    return id
}

/**
 * 删除指定操作日志
 * @param id 日志 id
 */
export const removeLog = async (id: string): Promise<void> => {
    try {
        await db.operationLogs.delete(id)
    } catch (error) {
        console.warn('[operation-log] 删除操作日志失败：', error)
    }
}

/**
 * 将日志标记为失败
 * @description 更新 status 为 'failed'，并写入 errorCode/errorMessage/retryCount
 * @param id 日志 id
 * @param info 失败信息
 */
export const markFailed = async (
    id: string,
    info: { errorCode?: string; errorMessage?: string; retryCount: number }
): Promise<void> => {
    try {
        await db.operationLogs.update(id, {
            status: 'failed',
            errorCode: info.errorCode,
            errorMessage: info.errorMessage,
            retryCount: info.retryCount
        })
    } catch (error) {
        console.warn('[operation-log] 标记操作日志失败失败：', error)
    }
}

/**
 * 获取所有操作日志
 * @returns 操作日志列表
 */
export const listLogs = async (): Promise<OperationLog[]> => {
    try {
        return await db.operationLogs.toArray()
    } catch (error) {
        console.warn('[operation-log] 读取操作日志失败：', error)
        return []
    }
}

/**
 * 获取所有失败的幂等操作日志
 * @description 返回 status='failed' 且 method ∈ {get, put, delete} 的日志；
 *              **再排除**认证接口 / 含凭据的历史残留（T560：它们不得被 replay 重发）。
 * @returns 失败的幂等操作日志列表
 */
export const listFailedIdempotentLogs = async (): Promise<OperationLog[]> => {
    try {
        const failedLogs = await db.operationLogs.where('status').equals('failed').toArray()
        return failedLogs.filter(
            (log) => log.method !== 'post' && !shouldSkipOperationLog(log.url, log.data)
        )
    } catch (error) {
        console.warn('[operation-log] 读取失败的幂等操作日志失败：', error)
        return []
    }
}