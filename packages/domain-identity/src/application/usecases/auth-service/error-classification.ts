import type { GoError } from '@nao-todo/shared/types'
import { unwrapError } from '@nao-todo/shared/utils/unwrap-go-error'

/**
 * 网络类失败白名单（C-67 / r11，DEF-33）
 * @description **仅**命中本白名单的 code 视为「网络类」⇒ **保留认证**（DEF-5 / AC7 不回归）；
 *              **其余一切失败（含未知 / 新增业务码、5xx、解析失败）一律按凭证类**
 *              （清认证 + 跳 `auth/signin`）—— 等价 `v1.9.0` 的「任何失败都清」+ DEF-5 网络豁免，
 *              且**不依赖服务端文案**。
 *              - `ERR_NETWORK` / `ECONNABORTED` = `packages/shared/requester/axios.ts` 归一化**顶层 code**；
 *              - `50300` / `40800` / `42900` = 同上归一化**业务 code**（网络错误 / 超时 / 限流）；
 *              - `10051` = 服务端限流**业务 code**（文案未知 ⇒ 只能靠 code，DEF-25 修复点）。
 */
const NETWORK_ERROR_CODES: readonly (string | number)[] = [
    'ERR_NETWORK',
    'ECONNABORTED',
    50300,
    40800,
    42900,
    10051
]

/**
 * 仓内归一化网络文案（**仅兜底**；**不再依赖服务端文案**，DEF-25）
 * @description 与 `packages/shared/requester/axios.ts` 的归一化产物逐字一致。
 *              仅在错误**无结构化 code** 时使用（正常链路 `auth-repo-impl` 必透传 code）。
 */
const NETWORK_ERROR_MESSAGES: readonly string[] = [
    '网络错误，请检查您的网络连接',
    '请求超时，请稍后再试',
    '请求过于频繁，请稍后再试'
]

/**
 * 从错误上收集结构化 code
 * @description `code` = 顶层归一化 code（字符串，如 `ERR_NETWORK`）优先，否则业务 code；
 *              `businessCode` = 服务端业务 code（由 `auth-repo-impl` 透传，C-67）。
 */
const extractErrorCodes = (err: unknown): (string | number)[] => {
    if (!(err instanceof Error)) return []
    const carrier = err as Error & { code?: unknown; businessCode?: unknown }
    const codes: (string | number)[] = []
    if (typeof carrier.code === 'string' || typeof carrier.code === 'number') {
        codes.push(carrier.code)
    }
    if (typeof carrier.businessCode === 'string' || typeof carrier.businessCode === 'number') {
        codes.push(carrier.businessCode)
    }
    return codes
}

/**
 * 是否凭证类失败（会话失效：需清认证并回登录页）
 * @description 判据方向 = **网络白名单**：命中 ⇒ `false`（保留认证）；**其余 ⇒ `true`**。
 *              `null` / `undefined` / 空串**显式 `false`**（防御性，避免误清）。
 *              数据源 = 结构化 `code` 优先（`code` / `businessCode`），无 code 时仅以
 *              **仓内归一化网络文案**兜底。与 `presentation-identity` 的 `check-in.vue`
 *              共用同一分类器（`5b9d6bdb` 已单源化；**禁**第二套标记集）。
 * @param err 错误（Go 风格，字符串或 Error）
 * @returns 是否为凭证类失败
 */
export const isCredentialError = (err: GoError): boolean => {
    if (err === null || err === undefined || err === '') return false
    const codes = extractErrorCodes(err)
    if (codes.length > 0) {
        return !codes.some((code) => NETWORK_ERROR_CODES.includes(code))
    }
    const message = unwrapError(err)
    return !NETWORK_ERROR_MESSAGES.some((marker) => message.includes(marker))
}

/**
 * 凭证 HTTP 状态（读路径回退门专用；r12 / T160）
 * @description 抛出型 axios Error 的 `response.status` 命中即视为「已知凭证信号」。
 */
export const CREDENTIAL_HTTP_STATUSES: readonly number[] = [401, 403]

/**
 * 凭证业务码（读路径回退门专用；r12 / T160）
 * @description 顶层归一化 `code` 或仓储透传的 `businessCode` 命中即视为「已知凭证信号」。
 */
export const CREDENTIAL_FAILURE_CODES: readonly (string | number)[] = [10041, 10021, 10022]

/** 携带结构信号的抛出型错误（axios Error 形态 + 仓储透传字段） */
type CredentialSignalCarrier = Error & {
    code?: unknown
    businessCode?: unknown
    response?: { status?: unknown } | null
}

/**
 * 是否携带「已知凭证*结构*信号」（**读路径回退门专用**，r12 / T160）
 * @description **只认结构证据，不认文案**（故不构成 C-67 所禁的「第二套文案标记集」）：
 *              - HTTP `response.status ∈ {401, 403}`；
 *              - 凭证业务码 `10041` / `10021` / `10022`（`code` 或 `businessCode`）。
 *              **单一来源**：证据集与判定只在本模块定义一次（禁散落第二处）。
 *              ⚠️ 与 `isCredentialError` **方向相反、语境不同**（ADR r12）：后者是**认证失败分类**
 *              （fail-closed：未知 ⇒ 凭证，用于清认证）；本谓词是**读路径回退门**（fail-soft：
 *              未知 ⇒ 回退镜像，用于 `withMirrorFallback` 抛出分支）。**不得**用本谓词改认证投影。
 * @param err 抛出型错误
 */
export const hasCredentialFailureSignal = (err: unknown): boolean => {
    if (!(err instanceof Error)) return false
    const carrier = err as CredentialSignalCarrier
    if (
        (typeof carrier.code === 'string' || typeof carrier.code === 'number') &&
        CREDENTIAL_FAILURE_CODES.includes(carrier.code)
    ) {
        return true
    }
    if (
        (typeof carrier.businessCode === 'string' || typeof carrier.businessCode === 'number') &&
        CREDENTIAL_FAILURE_CODES.includes(carrier.businessCode)
    ) {
        return true
    }
    const status = carrier.response?.status
    return typeof status === 'number' && CREDENTIAL_HTTP_STATUSES.includes(status)
}