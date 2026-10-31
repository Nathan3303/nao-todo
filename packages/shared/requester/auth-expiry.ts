/**
 * 会话失效事件（**模块级单例**，ADR D1/D4）
 *
 * @description 「判定 → 发布事件 → 单点执行」的三个环节里，本模块只负责**事件**：
 *              - 发布方（axios 请求器 / 同步层 / 续期 / 跨标签）只调 `fireAuthExpiry(reason)`，
 *                **不得**自己清认证 / 清数据（AC1「请求层 / 同步层零清理」）；
 *              - 订阅方**单槽**（`onAuthExpiry`）：后注册替换前注册，同一函数重复注册幂等
 *                ⇒ 桌面端 `main.ts` + web `app.ts` 的「双初始化」不再产生两套动作（D4 / DEF-94）；
 *              - **单闩**（一次失效事件只执行一次）：重复 `fire` N 次 ⇒ 处理者只跑 1 次（R5 幂等）；
 *                重新登录成功必须调 `resetAuthExpiryLatch()`（同 #260 修复③ 口径），
 *                否则下一次真实失效会被永久静音。
 *
 * @see docs/adr/2026-10-31-credential-coherence.md（D1 / D4 / D5）
 */

/** 失效类别（本地推断，W3 登录页横幅按此区分文案；本批只透传） */
export type AuthExpiryReason = 'expired' | 'signed-in-elsewhere' | 'credential-invalid'

type AuthExpiryHandler = (reason: AuthExpiryReason) => void

/** 唯一有效处理者（单槽） */
let handler: AuthExpiryHandler | null = null

/** 单闩：本次会话是否已发布过失效事件 */
let latched = false

/**
 * 注册会话失效处理者（单槽：后注册胜出；同函数重复注册等价于一次）
 * @param next 处理者（建议传引用稳定的函数，便于断言「1 个有效处理者」）
 */
export const onAuthExpiry = (next: AuthExpiryHandler): void => {
    handler = next
}

/** 当前有效处理者数量（D4 判据：恒 ≤ 1） */
export const getAuthExpiryHandlerCount = (): number => (handler === null ? 0 : 1)

/**
 * 发布一次会话失效事件
 * @description 无处理者时安全 no-op（启动早期 / 装配前）；已闩则忽略（同一次事件只执行一次）。
 * @param reason 失效类别（由发布方按本地证据推断）
 */
export const fireAuthExpiry = (reason: AuthExpiryReason): void => {
    if (latched) return
    latched = true
    handler?.(reason)
}

/** 复位单闩（登录/检入成功后调用；复位后新失效可再次触发） */
export const resetAuthExpiryLatch = (): void => {
    latched = false
}

/** 是否已发布过失效事件（W3 横幅与来源排查用） */
export const isAuthExpiryLatched = (): boolean => latched

/** 仅测试：复位单槽与单闩 */
export const resetAuthExpiryForTest = (): void => {
    handler = null
    latched = false
}