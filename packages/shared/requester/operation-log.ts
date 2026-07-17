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
 * 创建一条操作日志
 * @description 写入 status='pending'、retryCount=0 的日志；仅存 method/url/data，绝不写入 header
 * @param method 请求方法
 * @param url 请求地址
 * @param data 请求数据（仅保留可结构化克隆的内容）
 * @returns 生成的日志 id
 */
export const createLog = async (
    method: HttpMethod,
    url: string,
    data?: unknown
): Promise<string> => {
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
 * @description 返回 status='failed' 且 method ∈ {get, put, delete} 的日志
 * @returns 失败的幂等操作日志列表
 */
export const listFailedIdempotentLogs = async (): Promise<OperationLog[]> => {
    try {
        const failedLogs = await db.operationLogs.where('status').equals('failed').toArray()
        return failedLogs.filter((log) => log.method !== 'post')
    } catch (error) {
        console.warn('[operation-log] 读取失败的幂等操作日志失败：', error)
        return []
    }
}
