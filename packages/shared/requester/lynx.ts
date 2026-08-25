import type { Requester, RequesterConfig, RequesterOpRtn } from './types'

/**
 * 设备 ID
 * @description Lynx 运行时无 localStorage/crypto，进程内生成一次随机 ID 并缓存，
 *              用于请求头 X-Device-Id（服务端把会话绑定到登录端）。
 *              注意：Lynx 无持久化 API，应用重启后 ID 会变化，与 Web 端行为略有差异。
 */
let deviceId: string | null = null
const getLynxDeviceId = (): string => {
    if (deviceId === null) {
        deviceId = `lynx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    }
    return deviceId
}

/**
 * 请求超时时间（毫秒）
 * @description 与 AxiosRequester 的 timeout: 5000 对齐；超时按网络错误归一化处理
 */
const DEFAULT_TIMEOUT = 5000

/**
 * 创建 Lynx 请求器
 * @description 基于 Lynx 内置 Fetch API（标准 Web API 兼容子集）实现 Requester 接口。
 *              与 AxiosRequester 的差异：
 *              - 不接入操作日志（Lynx 无 IndexedDB，Dexie 不可用）
 *              - 网络错误/超时归一化为顶层字符串 code（语义与 axios 版的 ERR_NETWORK 分支一致）
 *              - HTTP 非 2xx 同样解析 JSON body 并返回 { data }，业务错误以响应体 code 为准
 *              - 检测凭证失效（code 10041，被下线/被顶号）并触发 onAuthExpired 回调（与 axios 版同语义）
 * @param baseURL 基础 URL
 * @param onAuthExpired 凭证失效回调
 * @param getToken 令牌读取函数（Lynx 无 localStorage，由应用层注入；请求时实时读取，登录后自动携带）
 * @returns Lynx 请求器
 */
export const useLynxRequester = (
    baseURL: string,
    onAuthExpired?: () => void,
    getToken?: () => string | null
): Requester => {
    // 凭证失效回调仅触发一次（与 AxiosRequester 的 authExpiredFired 语义一致）
    let authExpiredFired = false
    const notifyAuthExpired = () => {
        if (authExpiredFired) return
        authExpiredFired = true
        onAuthExpired?.()
    }

    const request = async (
        method: 'get' | 'post' | 'put' | 'delete',
        url: string,
        data?: unknown
    ): Promise<RequesterOpRtn> => {
        let response: Response
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
            // 请求头：内容类型 + 设备 ID + 令牌（登录后携带 Authorization）
            const headers: Record<string, string> = {
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Device-Id': getLynxDeviceId()
            }
            const token = getToken?.() ?? ''
            if (token !== '') {
                headers['Authorization'] = `Bearer ${token}`
            }
            // 超时控制：Promise.race 实现（Lynx fetch 无内置 timeout 选项）
            response = await Promise.race([
                fetch(`${baseURL}${url}`, {
                    method: method.toUpperCase(),
                    headers,
                    body: data !== undefined ? JSON.stringify(data) : undefined
                }),
                new Promise<Response>((_resolve, reject) => {
                    timer = setTimeout(() => reject(new Error('timeout')), DEFAULT_TIMEOUT)
                })
            ])
        } catch (error) {
            // 网络错误/超时：归一化为顶层字符串 code，与 AxiosRequester 的 ERR_NETWORK 分支语义一致
            console.error(error)
            return {
                code: 'ERR_NETWORK',
                _retryCount: 0,
                data: {
                    data: null,
                    message: '网络错误，请检查您的网络连接',
                    code: 50300
                }
            }
        } finally {
            // 请求完成/失败后清除超时定时器，避免遗留计时器
            if (timer !== undefined) clearTimeout(timer)
        }

        // 无论 HTTP 状态码，均尝试解析 JSON body；非 JSON 响应（空 body/HTML 错误页等）
        // 归一化为错误响应，避免上层访问 data.code 时崩溃
        const body = await response.json().catch(() => null)
        if (body === null) {
            return {
                code: `HTTP_${response.status}`,
                data: {
                    data: null,
                    message: `请求失败（HTTP ${response.status}）`,
                    code: response.status
                }
            }
        }

        // 凭证失效（code 10041：被下线/被顶号/会话过期）：触发应用层登出回调（仅一次）
        if ((body as { code?: number } | null)?.code === 10041) {
            notifyAuthExpired()
        }

        return {
            status: response.status,
            data: body
        }
    }

    return {
        _instance: null,
        name: 'LynxRequester',
        baseURL,
        get: (url, _config?: RequesterConfig) => request('get', url),
        post: (url, data?: unknown, _config?: RequesterConfig) => request('post', url, data),
        put: (url, data?: unknown, _config?: RequesterConfig) => request('put', url, data),
        // delete 与 axios 版一致：第二个参数为 config，请求体取 config.data
        delete: (url, config?: RequesterConfig) =>
            request('delete', url, (config as { data?: unknown } | undefined)?.data)
    }
}