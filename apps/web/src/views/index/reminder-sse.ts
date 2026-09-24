/**
 * 提醒 SSE 连接（DEF-33 下游加固 / T157-FIX-C）
 *
 * @description 服务端 `/sse/reminders` 以 `?token=` 鉴权（`EventSource` 不支持自定义请求头）；
 *              **token 缺失/空串 ⇒ 必然被服务端以 `10041` + `application/json` 拒绝**
 *              （浏览器报 `EventSource's response has a MIME type ... Aborting`）⇒ 本模块
 *              **不建连**（`return null`），避免必然失败与噪声报错。
 *
 *              `error` 事件按**会话失效口径**处理：仅关闭连接，**不在本模块清认证** ——
 *              认证清理保持**单源**（`requester` 的 `10041` → `app.ts onAuthExpired`），
 *              避免把「SSE 瞬断」误判为「会话失效」而误登出。
 */
export type ReminderSsePayload = { taskName: string } & Record<string, unknown>

export type StartReminderSseOptions = {
    /** 当前会话 token（`localStorage.USER_JWT`）；缺失/空串 ⇒ **不建连** */
    token: string | null | undefined
    /** API 基地址（`import.meta.env.VITE_API_BASE_URL`） */
    apiBaseUrl: string
    /** 收到 `reminder` 事件的回调（载荷已 JSON 解析） */
    onReminder: (payload: ReminderSsePayload) => void
    /** 测试注入：`EventSource` 构造器（默认全局 `EventSource`） */
    createEventSource?: (url: string) => EventSource
    /** 测试注入：通知权限请求（默认 `Notification.requestPermission`） */
    requestNotificationPermission?: () => void | Promise<unknown>
}

/** 默认通知权限请求：仅当浏览器支持且权限为 `default` 时请求 */
const defaultRequestNotificationPermission = (): void | Promise<unknown> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return undefined
    if (Notification.permission !== 'default') return undefined
    return Notification.requestPermission()
}

/**
 * 启动提醒 SSE 连接
 * @returns 已建立的 `EventSource`；token 缺失/空串 ⇒ `null`（不建连）
 */
export const startReminderSse = async (
    options: StartReminderSseOptions
): Promise<EventSource | null> => {
    const { token } = options
    // 无 token / 空 token ⇒ 不建连（必然失败，DEF-33 下游）
    if (!token) return null
    await (options.requestNotificationPermission ?? defaultRequestNotificationPermission)()
    const createEventSource = options.createEventSource ?? ((url: string) => new EventSource(url))
    const eventSource = createEventSource(`${options.apiBaseUrl}/sse/reminders?token=${token}`)
    eventSource.addEventListener('reminder', (event) => {
        try {
            options.onReminder(JSON.parse((event as MessageEvent).data) as ReminderSsePayload)
        } catch {
            /* 非法载荷：忽略，不中断连接 */
        }
    })
    // 会话失效口径（与 10041 一致）：关闭连接；认证清理仍由 requester 的 10041 单源兜底
    eventSource.addEventListener('error', () => eventSource.close())
    return eventSource
}