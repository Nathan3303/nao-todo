/**
 * 凭证类业务码（**唯一集合**，ADR D1 / AC1）
 * @description 服务端把「解析失败 / JWT 过期 / 会话不存在 / 已轮换 / 被顶号」统一压成
 *              `10041`，`10042` 为「用户凭证校验未通过」的同族码 ⇒ 两者共同构成**凭证类**判据。
 *              定义只此一处：`domain-identity` 的分类器、请求器（axios）、同步层（sync）
 *              一律引用本常量，**禁止各自 `switch` 复制一份**（R1「单一判据」）。
 *              放在 `shared` 而非 `domain-identity`：`shared` 是两侧的共同下界
 *              （`domain-identity → shared` 单向依赖），反向下沉会造成包依赖环。
 */
export const AUTH_CREDENTIAL_CODES: readonly (string | number)[] = [10041, 10042]

/**
 * 是否凭证类业务码
 * @param code 业务码 / 归一化顶层 code（未知类型一律 `false`）
 */
export const isCredentialCode = (code: unknown): boolean =>
    (typeof code === 'string' || typeof code === 'number') && AUTH_CREDENTIAL_CODES.includes(code)