/**
 * `requester` 归一化网络错误**文案**（单一事实来源）
 *
 * @description `requester` 对 transport 失败不 `reject`，而是 `resolve` 一个顶层携带字符串
 *              `code` 的归一化响应（`axios.ts` / `lynx.ts`）。Go 仓储再据「业务码不匹配」返回
 *              `[null, res.message]` ⇒ **仓储边界只剩文案**，网络类判据只能按文案全等匹配
 *              （`DEF-25`）。
 *              故把三条文案收敛到此处：**生产者**（`axios.ts` / `lynx.ts` 归一化响应）与
 *              **判据点**（`persistence-go/fallback/network-failure.ts`）引用同一常量，
 *              文案漂移不会再让回退判据静默失效（`DEF-21` 复发路径）。
 *
 *              ⚠️ 语义不变：判据仍是**全等**（非 `includes`），远端已应答的业务失败
 *              （可能含「网络」字样）不得被误判为网络类。
 */

/** 网络错误（`ERR_NETWORK` → 业务码 `50300`） */
export const NETWORK_ERROR_MESSAGE = '网络错误，请检查您的网络连接'

/** 请求超时（`ECONNABORTED` → 业务码 `40800`） */
export const TIMEOUT_ERROR_MESSAGE = '请求超时，请稍后再试'

/** 请求过于频繁（`TOO_MANY_REQUESTS` → 业务码 `42900`） */
export const RATE_LIMIT_ERROR_MESSAGE = '请求过于频繁，请稍后再试'

/** 归一化网络错误文案全集（判据用；顺序无业务含义） */
export const NORMALIZED_NETWORK_ERROR_MESSAGES = [
    NETWORK_ERROR_MESSAGE,
    TIMEOUT_ERROR_MESSAGE,
    RATE_LIMIT_ERROR_MESSAGE
] as const