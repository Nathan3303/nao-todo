import type { GoError } from '@nao-todo/shared/types'
import { unwrapError } from '@nao-todo/shared/utils/unwrap-go-error'
import { AUTH_CREDENTIAL_CODES } from '@nao-todo/shared/requester/credential-codes'

/**
 * 凭证类业务码（唯一集合；定义在 `shared`，此处**再导出**供域/应用层引用）
 * @description `10041`（用户凭证验证失败）与 `10042`（凭证校验未通过）同属凭证类；
 *              网络码白名单之外的其余失败**不**因此升级为凭证类（需走显式判定，见下方分类器）。
 */
export { AUTH_CREDENTIAL_CODES }

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
 * 是否**网络类**失败（与 `isCredentialError` 同一白名单，方向相反）
 * @description 供「失败是否需要用户可见反馈」这类**非鉴权**分支复用同一判据
 *              （例：远程登出失败时，只有服务端业务失败才提示；断网/超时不吓用户）。
 *              ⛔ 不要用它替代 `isCredentialError` 做认证处置（方向与语义不同）。
 * @param err 错误（Go 风格，字符串或 Error）
 * @returns 是否为网络类失败
 */
export const isNetworkError = (err: GoError): boolean => {
    if (err === null || err === undefined || err === '') return false
    const codes = extractErrorCodes(err)
    if (codes.length > 0) return codes.some((code) => NETWORK_ERROR_CODES.includes(code))
    const message = unwrapError(err)
    return NETWORK_ERROR_MESSAGES.some((marker) => message.includes(marker))
}

/**
 * 检入冲突业务码（T558 / Issue #260 残余）
 * @description 服务端 CAS 语义：同一 token 的并发检入**只许一次换发**，败者返回本码
 *              ⇒ 「我的旧 token 已被别的请求换掉，请重试」，**不是**会话失效。
 */
export const CHECK_IN_CONFLICT_CODE = 10022

/**
 * 是否「检入冲突-可重试」（`10022`；仅 web / 桌面侧显式使用）
 * @description **单源新增谓词**（不扩 `NETWORK_ERROR_CODES`、不改 `isCredentialError` 方向）：
 *              后者被 web 检入页、域用例与**移动端**
 *              `presentation-react/src/logic/compose-auth-usecase.ts` 共用 ⇒ 往里塞 `10022`
 *              等于改移动端语义（红线）。⇒ 本谓词只供 web/桌面的检入处置点先判，
 *              命中者**不** `clearAuthData`、**不**导航、**不**触发凭证失效回调。
 *              判据只用**结构化 code**（`code` / `businessCode`），不做文案匹配（不造第二套标记集）。
 * @param err 错误（Go 风格，字符串或 Error）
 * @returns 是否为检入冲突（可重试）
 */
export const isRetryableCheckInConflict = (err: GoError): boolean => {
    if (err === null || err === undefined || err === '') return false
    return extractErrorCodes(err).includes(CHECK_IN_CONFLICT_CODE)
}

/** 认证失败分类（ADR D1 单一判据的三类投影） */
export type AuthFailureClass = 'credential' | 'network' | 'business'

/** 认证失败输入（结构化 code 或错误对象，二者可并存） */
export type AuthFailureInput = {
    code?: string | number | null
    err?: GoError
}

/** 收集输入上的全部结构化 code（显式 code 优先，其次错误自带 code / businessCode） */
const collectAuthCodes = (input: AuthFailureInput): (string | number)[] => {
    const codes: (string | number)[] = []
    if (typeof input.code === 'string' || typeof input.code === 'number') {
        codes.push(input.code)
    }
    codes.push(...extractErrorCodes(input.err))
    return codes
}

/**
 * 认证失败分类（**唯一判据**，ADR D1 / AC1）
 * @description 表驱动，各层引用本函数，**禁止各自 `switch`**：
 *              - `10041` / `10042` ⇒ `credential`；
 *              - `NETWORK_ERROR_CODES`（6 个）⇒ `network`；
 *              - 其余（`10022` / 5xx / 未知 / 无信号）⇒ `business`（被动投影**不登出**）。
 *              无结构化 code 时沿用既有**仓内归一化网络文案**兜底识别 `network`
 *              （不构成第二套文案标记集，标记集仍是本模块同一常量）。
 * @param input 结构化 code 与/或错误对象
 */
export const classifyAuthFailure = (input: AuthFailureInput): AuthFailureClass => {
    const codes = collectAuthCodes(input)
    if (codes.some((code) => AUTH_CREDENTIAL_CODES.includes(code))) return 'credential'
    if (codes.some((code) => NETWORK_ERROR_CODES.includes(code))) return 'network'
    if (codes.length === 0 && input.err !== null && input.err !== undefined) {
        const message = unwrapError(input.err)
        if (NETWORK_ERROR_MESSAGES.some((marker) => message.includes(marker))) return 'network'
    }
    return 'business'
}

/**
 * 是否结束会话（**唯一「是否登出」判据**，ADR D1 / AC2）
 * @description 两个投影共用同一分类器，方向不同：
 *              - `passive`（被动响应：axios / sync 收到失败）**仅** `credential` 结束
 *                ⇒ 网络类 / 业务类**不登出、不清数据**（C-67 口径不回归）；
 *              - `active`（主动校验：checkIn 等）沿用 C-67 **fail-closed**
 *                ⇒ `credential` 与未知（`business` 兜底）结束，`network` 保持。
 * @param input source + 结构化 code 与/或错误对象
 * @returns `true` = 结束会话（登出 / 清凭证）
 */
export const decideSessionEnd = (
    input: AuthFailureInput & { source: 'active' | 'passive' }
): boolean => {
    const failureClass = classifyAuthFailure(input)
    if (input.source === 'passive') return failureClass === 'credential'
    return failureClass !== 'network'
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