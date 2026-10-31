/**
 * 会话鉴权头（**唯一** `Bearer` 拼接实现处，ADR D6 / DEF-93）
 * @description 无 token ⇒ 返回 `{}`（**永不**产出 `Bearer null`）：后台同步在会话结束后
 *              不得再发带空凭证的请求（否则收 `10041` 噪音）。
 *              同步层（`persistence-sync`）一律经本函数取头，禁止自行模板拼接。
 * @param token 当前 JWT（可空）
 */
export const buildAuthHeaders = (token: string | null | undefined): Record<string, string> =>
    token ? { Authorization: `Bearer ${token}` } : {}