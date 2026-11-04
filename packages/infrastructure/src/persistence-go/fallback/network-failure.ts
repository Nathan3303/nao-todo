import type { GoError } from '@nao-todo/shared/types'
import { unwrapError } from '@nao-todo/shared/utils/unwrap-go-error'
import { NORMALIZED_NETWORK_ERROR_MESSAGES } from '@nao-todo/shared/requester/network-error-messages'

/**
 * 是否为归一化网络错误（网络类）—— 归一化文案 → 网络类判定（C-66 / AC8 / DEF-21）
 *
 * @description `requester` 对 **transport 失败**不 `reject`，而是 `resolve` 一个顶层携带字符串
 *              `code` 的归一化响应（`packages/shared/requester/axios.ts`）；Go 仓储再据
 *              「业务码不匹配」返回错误元组 `[null, res.message]`。因此**在仓储边界**网络类与
 *              业务类都表现为 `[null, string]`，只能按**文案**判定。
 *
 *              **单一事实来源** = requester 归一化产物（不猜，逐字对齐；常量在
 *              `packages/shared/requester/network-error-messages.ts`，`DEF-25` 已抽常量）：
 *              - `网络错误，请检查您的网络连接` ← `ERR_NETWORK` → 业务码 `50300`
 *                （`packages/shared/requester/axios.ts`；Lynx 同码同文 `packages/shared/requester/lynx.ts`）
 *              - `请求超时，请稍后再试` ← `ECONNABORTED` → 业务码 `40800`
 *                （`packages/shared/requester/axios.ts`）
 *              - `请求过于频繁，请稍后再试` ← `TOO_MANY_REQUESTS` → 业务码 `42900`
 *                （`packages/shared/requester/axios.ts`）
 *
 *              **刻意采用全等**（非 `includes`）：远端已应答的业务失败可能含有「网络」等字样，
 *              仅当文案与归一化产物**逐字相同**时才回退，避免掩盖真实业务错误（AC8 口径：
 *              「远端已应答的非网络类业务失败不回退」）。
 *
 *              凭证类判定的同源实现见 `@nao-todo/domain-identity` 的 `isCredentialError`
 *              （`packages/domain-identity/src/application/usecases/auth-service/error-classification.ts:18`）。
 *
 * @param err Go 风格错误（归一化网络错误在仓储边界为字符串）
 * @returns 是否属于网络类（requester 归一化文案）
 */
export const isNormalizedNetworkError = (err: GoError): boolean => {
    const message = unwrapError(err)
    return NORMALIZED_NETWORK_ERROR_MESSAGES.some((marker) => message === marker)
}