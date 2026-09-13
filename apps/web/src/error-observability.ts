/**
 * 全局未捕获异常可观测（SHELL-05 C-27 / T3）
 * @description web 与 desktop 复用同一份「同源单点」实现：
 *              - 结构化日志：`console.error`，固定前缀 `[SHELL-05]`；
 *              - 有界内存环形缓冲（上限 `SHELL_ERROR_LOG_CAPACITY`），供 QA 经
 *                `window.__NAO_ERROR_LOG__` 只读导出；
 *              - 字段白名单：仅 时间戳 / 来源 / 消息摘要 / 栈摘要；消息与栈均截断，
 *                并对常见 PII/token 特征做脱敏（email / Bearer / JWT / token=），
 *                不落任务正文与凭证原文。
 *              T1 的 router 注入自检、T2 的门/壳导航 catch 均复用本通道。
 */

/** 统一日志前缀（SHELL-05 家族） */
export const SHELL_ERROR_LOG_PREFIX = '[SHELL-05]'

/** 环形缓冲上限（显式有界） */
export const SHELL_ERROR_LOG_CAPACITY = 100

/** 消息摘要长度上限 */
export const SHELL_ERROR_MESSAGE_MAX = 300

/** 栈摘要长度上限 */
export const SHELL_ERROR_STACK_MAX = 800

/** 缓冲条目（字段白名单；禁 PII/token/正文） */
export type ShellErrorEntry = {
    /** ISO 时间戳 */
    time: string
    /** 来源（如 window:error / vue:errorHandler:render / router:onError / app-root:offline-navigation） */
    source: string
    /** 消息摘要（截断 + 脱敏） */
    message: string
    /** 栈摘要（截断 + 脱敏） */
    stack: string
}

/** 有界缓冲（模块级单例；读写仅经导出函数） */
const buffer: ShellErrorEntry[] = []

/** 截断并标注省略 */
const truncate = (value: string, max: number): string =>
    value.length > max ? `${value.slice(0, max)}…` : value

/** 脱敏：email / Bearer / JWT / token= —— 只做特征替换，不解析业务语义 */
export const redactSensitive = (value: string): string =>
    value
        .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[redacted-email]')
        .replace(/(Bearer\s+)[\w~+/-]+/gi, '$1[redacted]')
        .replace(/\beyJ[\w-]*\.[\w-]+\.[\w-]+/g, '[redacted-jwt]')
        .replace(/((?:access[_-]?)?token\s*[=:]\s*)[^\s,;"']+/gi, '$1[redacted]')

/** 任意错误值 → 消息摘要 */
const summarize = (error: unknown): string => {
    const raw =
        error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : (() => {
                    try {
                        return JSON.stringify(error) ?? String(error)
                    } catch {
                        return String(error)
                    }
                })()
    return truncate(redactSensitive(raw), SHELL_ERROR_MESSAGE_MAX)
}

/** 任意错误值 → 栈摘要（非 Error 返回空串） */
const summarizeStack = (error: unknown): string =>
    error instanceof Error && error.stack
        ? truncate(redactSensitive(error.stack), SHELL_ERROR_STACK_MAX)
        : ''

/**
 * 记录一条结构化错误（入缓冲 + console.error）
 * @param source 来源标识（稳定枚举式字符串）
 * @param error 任意异常/消息
 * @returns 落库的条目（便于断言）
 */
export const recordShellError = (source: string, error: unknown): ShellErrorEntry => {
    const entry: ShellErrorEntry = {
        time: new Date().toISOString(),
        source,
        message: summarize(error),
        stack: summarizeStack(error)
    }
    buffer.push(entry)
    if (buffer.length > SHELL_ERROR_LOG_CAPACITY) {
        buffer.splice(0, buffer.length - SHELL_ERROR_LOG_CAPACITY)
    }
    console.error(`${SHELL_ERROR_LOG_PREFIX} ${source}`, entry)
    return entry
}

/** 只读读取当前缓冲（快照语义，供 QA 导出） */
export const readShellErrorLog = (): readonly ShellErrorEntry[] => buffer

/** 清空缓冲（测试/手动复位） */
export const clearShellErrorLog = (): void => {
    buffer.length = 0
}