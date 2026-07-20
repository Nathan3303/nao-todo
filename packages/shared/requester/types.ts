import type { AxiosInstance } from 'axios'

export type RequesterOpRtn = Record<string, any> & { data: unknown }

export type RequesterConfig = { data?: Record<string, any> } | Record<string, any>

export type Requester = {
    _instance: AxiosInstance | null
    name: 'AxiosRequester' | 'UniRequester' | ''
    baseURL: string
    get: (url: string, config?: RequesterConfig) => Promise<RequesterOpRtn>
    post: (url: string, data?: unknown, config?: RequesterConfig) => Promise<RequesterOpRtn>
    put: (url: string, data?: unknown, config?: RequesterConfig) => Promise<RequesterOpRtn>
    delete: (url: string, config?: RequesterConfig) => Promise<RequesterOpRtn>
}

export type UseRequesterOptions = {
    name: Requester['name']
    baseURL: Requester['baseURL']
    /**
     * 是否开启幂等请求自动重试
     * @description 默认开启（true）
     */
    enableRetry?: boolean
}

/**
 * HTTP 请求方法
 */
export type HttpMethod = 'get' | 'post' | 'put' | 'delete'

/**
 * 操作日志状态
 * @description pending 表示请求进行中；failed 表示请求失败
 */
export type OperationLogStatus = 'pending' | 'failed'

/**
 * 操作日志
 * @description 用于持久化网络请求的操作记录，支持幂等请求的失败重试
 */
export type OperationLog = {
    /** 日志唯一标识 */
    id: string
    /** 请求方法 */
    method: HttpMethod
    /** 请求地址 */
    url: string
    /** 请求数据（仅保留可结构化克隆的内容） */
    data?: unknown
    /** 日志状态 */
    status: OperationLogStatus
    /** 创建时间戳（毫秒） */
    createdAt: number
    /** 已重试次数 */
    retryCount: number
    /** 错误码 */
    errorCode?: string
    /** 错误信息 */
    errorMessage?: string
}
