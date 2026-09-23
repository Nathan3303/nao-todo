import type { GoError } from '@nao-todo/shared/types'
import { unwrapError } from '@nao-todo/shared/utils/unwrap-go-error'

/**
 * 凭证类失败特征（SHELL-03 附录 B-3 / C-24）
 * @description 401/403、业务码 10041 及服务端凭证失效文案（如「用户凭证验证失败」「登录已过期」）。
 *              与 presentation-identity 的 `check-in.vue` 共用同一分类，避免分层判定不一致。
 */
const CREDENTIAL_ERROR_MARKERS = ['10041', '401', '403', '登录已过期', '凭证'] as const

/**
 * 是否凭证类失败（会话失效：需清认证并回登录页）
 * @description 网络类（`ERR_NETWORK` / `ECONNABORTED` / 超时 / 5xx / 10051 限流）
 *              的归一化文案不含上述特征，判定为 `false`（DEF-5：不得因此清认证）。
 * @param err 错误（Go 风格，字符串或 Error）
 * @returns 是否为凭证类失败
 */
export const isCredentialError = (err: GoError): boolean => {
    const message = unwrapError(err)
    return CREDENTIAL_ERROR_MARKERS.some((marker) => message.includes(marker))
}