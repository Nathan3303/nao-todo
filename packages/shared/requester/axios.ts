import Axios, { AxiosError } from 'axios'
import type { HttpMethod, Requester, RequesterOpRtn } from './types'
import { createLog, markFailed, removeLog } from './operation-log'
import { MAX_RETRY, delay, getBackoffDelay, isIdempotentMethod, isRetriableError } from './retry'
import { getDeviceId } from '../utils/device-id'
import { consumeRotationGrace, extractBearerToken, isStaleTokenSnapshot } from './auth-rotation'
import { isCheckInInFlight } from './checkin-window'

/**
 * 最近一次创建的请求器闭包的登出闸复位器（Issue #260 修复③）
 * @description `authExpiredFired` 闩（同一次会话只登出一次）在**重新登录后必须复位**，
 *              否则上一次会话触过的 10041 残留闩会让这次登录后的真实失效**永久静默**。
 *              闭包局部变量无法从外部触及 ⇒ 创建请求器时注册复位器，供登录成功路径调用
 *              （`sign-in-page` / `check-in-page` 两端共用，见 `resetAuthExpiredLatch`）。
 */
type AuthExpiredLatchReset = () => void
let latestLatchReset: AuthExpiredLatchReset | null = null

/**
 * 复位凭证失效登出闸（登录成功后调用；两端共用）
 * @description 无请求器（未 init / Lynx 无闩）时静默 no-op；多次调用安全。
 */
export const resetAuthExpiredLatch = (): void => {
    latestLatchReset?.()
}

/**
 * 创建 Axios 请求器
 * @param baseURL 基础 URL
 * @param enableRetry 是否开启幂等请求自动重试（默认开启）
 * @param onAuthExpired 凭证失效回调（响应 code === 10041 时触发，由应用层注入登出处理）
 * @param getAuthToken 当前 token 读取器（T558：失效响应仅在「请求快照 === 当前 token」时才登出；
 *                     未注入 ⇒ 保持旧口径「收到 10041 即登出」）
 * @returns Axios 请求器
 */
export default (
    baseURL: string,
    enableRetry = true,
    onAuthExpired?: () => void,
    getAuthToken?: () => string | null
): Requester => {
    /**
     * 创建 Axios 实例
     */
    const axiosInstance = Axios.create({
        baseURL,
        timeout: 5000,
        withCredentials: true,
        headers: {
            'Content-Type': 'application/json; charset=UTF-8'
        }
    })

    /**
     * 添加请求拦截器
     * @description 全局注入设备 ID 请求头（登录/所有 /api 请求统一携带，供服务端把会话绑定到具体登录端）
     */
    axiosInstance.interceptors.request.use((config) => {
        config.headers['X-Device-Id'] = getDeviceId()
        return config
    })

    /**
     * 添加响应拦截器
     * @description 对幂等请求的网络错误自动重试；重试耗尽或关闭时归一化错误响应；
     *              检测凭证失效（code 10041，被下线/被顶号）并触发应用层回调（成功/错误分支同检，仅触发一次）。
     *              **轮换宽限（R2 / Issue #260）**：续期刚换发 token 时旧 token 的在途请求会拿到 10041 ⇒
     *              `consumeRotationGrace()` 命中则**不触发登出**（不置 `authExpiredFired`），响应如实返回。
     *              Web 端从不 `mark` ⇒ 该分支恒不命中，行为零变化。
     *              **token 一致性（T558）**：优先级更高 —— 请求发出时的 token 快照 ≠ 当前 token
     *              （含 `Bearer null`）⇒ 陈旧响应，只记录、不登出。未注入 `getAuthToken` ⇒ 旧口径。
     *              **检入在途（T558 R1）**：检入会换发 token，且在途 pull/profile 与检入并发 ⇒
     *              检入期间的 `10041` 可能是「换发前的在途请求」，由检入结果裁决 ⇒ 只记录、不登出。
     */
    let authExpiredFired = false
    const notifyAuthExpired = () => {
        if (authExpiredFired) return
        authExpiredFired = true
        onAuthExpired?.()
    }
    // 登录成功路径可复位本闩（#260 修复③；见顶部说明）
    latestLatchReset = () => {
        authExpiredFired = false
    }

    /**
     * 取本次请求自带出去的 token 快照（T558）
     * @description 只认请求 `config.headers.Authorization`（可能是 `Bearer null`）
     * @returns `undefined` = 请求未带 Bearer 头（无法比对 ⇒ 沿用旧口径）
     */
    const requestTokenOf = (headers: unknown): string | undefined => {
        const carrier = headers as
            | { Authorization?: unknown; authorization?: unknown; get?: (name: string) => unknown }
            | undefined
        if (!carrier || typeof carrier !== 'object') return undefined
        let raw = carrier.Authorization ?? carrier.authorization
        if (raw === undefined && typeof carrier.get === 'function') {
            try {
                raw = carrier.get('Authorization')
            } catch {
                raw = undefined
            }
        }
        return extractBearerToken(raw)
    }

    /** 当前 token（未注入提供器 / 读取异常 ⇒ `null`） */
    const currentTokenOf = (): string | null => {
        if (!getAuthToken) return null
        try {
            return getAuthToken()
        } catch {
            return null
        }
    }

    /**
     * 失效响应是否属于「陈旧请求」（T558：请求 token ≠ 当前 token / `Bearer null`）
     * @description 陈旧 ⇒ **不登出、不清凭证、只记录**；未注入 token 读取器时保持旧口径。
     */
    const isStaleCredentialResponse = (headers: unknown): boolean => {
        if (!getAuthToken) return false
        const requestToken = requestTokenOf(headers)
        // 未带 Bearer 头 ⇒ 按空快照处理（无凭据的请求不可能代表当前会话失效）
        return isStaleTokenSnapshot(requestToken ?? '', currentTokenOf())
    }

    /**
     * 10041 处置（T558 起带 token 一致性判据）
     * @description 优先级：① 陈旧响应（只记录）→ ② 轮换宽限内放行 → ③ 真实失效登出。
     * @param headers 该请求自己的 headers（取发出时的 token 快照）
     */
    const handleCredentialExpired = (headers: unknown) => {
        if (isStaleCredentialResponse(headers)) {
            console.warn('[requester] 忽略陈旧凭证响应（10041 来自旧 token / Bearer null）', {
                event: 'auth.credential.stale',
                snapshot: requestTokenOf(headers)?.slice(0, 8) ?? null
            })
            return
        }
        // T558 R1：检入在途 ⇒ 延后处置（检入会换发 token，在途请求的 10041 由检入结果裁决）
        if (isCheckInInFlight()) {
            console.warn('[requester] 检入在途，延后处置 10041（由检入结果裁决）', {
                event: 'auth.credential.deferred-checkin',
                snapshot: requestTokenOf(headers)?.slice(0, 8) ?? null
            })
            return
        }
        if (consumeRotationGrace()) return
        notifyAuthExpired()
    }
    axiosInstance.interceptors.response.use(
        (response) => {
            const code = (response.data as { code?: number })?.code
            if (code === 10041) handleCredentialExpired(response.config?.headers)
            return response
        },
        async (error) => {
            const config = error.config || {}

            // 错误响应（HTTP 非 200）同样可能携带业务码 10041
            const errorCode = (error.response?.data as { code?: number })?.code
            if (errorCode === 10041) handleCredentialExpired(config.headers)

            // 幂等请求的网络/超时错误自动重试（受 enableRetry 开关控制）
            if (enableRetry && isRetriableError(error) && isIdempotentMethod(config.method)) {
                config._retryCount = config._retryCount || 0
                if (config._retryCount < MAX_RETRY) {
                    config._retryCount += 1
                    await delay(getBackoffDelay(config._retryCount - 1))
                    return axiosInstance(config)
                }
            }

            const retryCount = config._retryCount || 0

            switch (error.code) {
                // 处理请求过于频繁的错误
                case 'TOO_MANY_REQUESTS':
                    return Promise.resolve({
                        code: error.code,
                        _retryCount: retryCount,
                        data: {
                            data: null,
                            message: '请求过于频繁，请稍后再试',
                            code: 42900
                        }
                    })
                // 处理请求超时的错误
                case 'ECONNABORTED':
                    return Promise.resolve({
                        code: error.code,
                        _retryCount: retryCount,
                        data: {
                            data: null,
                            message: '请求超时，请稍后再试',
                            code: 40800
                        }
                    })
                // 处理网络错误
                case 'ERR_NETWORK':
                    return Promise.resolve({
                        code: error.code,
                        _retryCount: retryCount,
                        data: {
                            data: null,
                            message: '网络错误，请检查您的网络连接',
                            code: 50300
                        }
                    })
                // 处理其他错误
                default:
                    console.error(error)
                    return Promise.reject(error)
            }
        }
    )

    /**
     * 归一化的网络错误响应
     * @description 由响应拦截器产出，顶层携带字符串 code 与已重试次数
     */
    type NormalizedErrorRtn = RequesterOpRtn & {
        code: string
        _retryCount?: number
        data: { message?: string }
    }

    /**
     * 判断响应是否为归一化的网络错误
     * @description 归一化错误在顶层携带字符串 code（如 'ERR_NETWORK'）
     * @param response 响应对象
     * @returns 是否为归一化网络错误
     */
    const isNormalizedError = (response: RequesterOpRtn): response is NormalizedErrorRtn =>
        typeof response?.code === 'string'

    /**
     * 为请求方法包装操作日志能力
     * @description 请求前记录 pending 日志；成功后删除；最终失败标记为 failed。
     *              日志写/删均为异步且不阻塞主请求流程。
     * @param method 请求方法
     * @param fn 底层 Axios 请求方法
     * @param hasData 是否携带请求体（用于定位 data 参数）
     */
    const withLog = <A extends unknown[]>(
        method: HttpMethod,
        fn: (...args: A) => Promise<RequesterOpRtn>,
        hasData: boolean
    ): ((...args: A) => Promise<RequesterOpRtn>) => {
        return async (...args: A) => {
            const [url, secondArg] = args as unknown[]
            const data = hasData ? secondArg : undefined
            // 不阻塞请求：日志写入与主请求并行
            const logIdPromise = createLog(method, url as string, data)
            try {
                const response = await fn(...args)
                await logIdPromise.then((logId) => {
                    // `null` = 凭据红线跳过（认证接口 / 含凭据请求体）⇒ 无日志可结算
                    if (logId === null) return undefined
                    if (isNormalizedError(response)) {
                        return markFailed(logId, {
                            errorCode: response.code,
                            errorMessage: response.data?.message,
                            retryCount: response._retryCount ?? 0
                        })
                    } else {
                        return removeLog(logId)
                    }
                })
                return response
            } catch (error: unknown) {
                const axiosError = error as AxiosError & {
                    config?: { _retryCount?: number }
                }
                await logIdPromise.then((logId) => {
                    if (logId === null) return undefined
                    return markFailed(logId, {
                        errorCode: axiosError?.code,
                        errorMessage: axiosError?.message,
                        retryCount: axiosError?.config?._retryCount ?? 0
                    })
                })
                throw error
            }
        }
    }

    /**
     * 以箭头函数包裹 Axios 实例方法
     * @description 避免把未绑定的实例方法（unbound-method）直接传递出去导致 this 丢失
     */
    const rawGet: Requester['get'] = (url, config) => axiosInstance.get(url, config)
    const rawPost: Requester['post'] = (url, data, config) => axiosInstance.post(url, data, config)
    const rawPut: Requester['put'] = (url, data, config) => axiosInstance.put(url, data, config)
    const rawDelete: Requester['delete'] = (url, config) => axiosInstance.delete(url, config)

    /**
     * 返回 Axios 请求器
     */
    return {
        _instance: axiosInstance,
        name: 'AxiosRequester',
        baseURL,
        get: withLog('get', rawGet, false),
        post: withLog('post', rawPost, true),
        put: withLog('put', rawPut, true),
        delete: withLog('delete', rawDelete, false)
    }
}