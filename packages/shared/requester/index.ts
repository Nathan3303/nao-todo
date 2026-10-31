import type { Requester, UseRequesterOptions, RequesterOpRtn } from './types'
import useAxiosRequester from './axios'
import { useLynxRequester } from './lynx'
import { fireAuthExpiry, onAuthExpiry } from './auth-expiry'
import {
    listLogs,
    listFailedIdempotentLogs,
    purgeLegacyCredentialLogs,
    removeLog
} from './operation-log'

const emptyRequester: Requester = {
    _instance: null,
    name: '',
    baseURL: '',
    get: () => Promise.resolve({} as RequesterOpRtn),
    post: () => Promise.resolve({} as RequesterOpRtn),
    put: () => Promise.resolve({} as RequesterOpRtn),
    delete: () => Promise.resolve({} as RequesterOpRtn)
}

let requester: Requester = emptyRequester

/** 已初始化实例的身份（`name` + `baseURL`），供幂等复用与参数漂移诊断 */
let requesterIdentity: { name: Requester['name']; baseURL: string } | null = null

export const getRequesterImpl = () => requester

/** 历史凭据日志清理是否已发起（幂等：两端多次 `initRequester` 只清一次） */
let credentialPurgeStarted = false

/**
 * 凭证失效回调注册到事件单例（D4）
 * @description 单槽 + 单闩在 `auth-expiry` 内 ⇒ 两端重复注册**不会**产生两套动作。
 */
const registerAuthExpiredHandler = (onAuthExpired: () => void): void => {
    onAuthExpiry(() => onAuthExpired())
}

/**
 * 发布一次凭证失效事件（请求器侧唯一出口）
 * @description 具体处置（清矩阵 + 回登录页）由装配层注册的唯一处理者执行（AC1 执行单点）。
 */
const publishAuthExpiry = (): void => {
    fireAuthExpiry('credential-invalid')
}

/**
 * 初始化请求器（**幂等**：同名同 `baseURL` 复用同一实例，ADR D4 / AC7）
 * @description 桌面端 `@` 别名指向 `apps/web/src` ⇒ 挂载 `<App/>` 会二次调本函数；
 *              改为「同参复用 + 回调注册到单例」⇒ 后注册无害。
 *              参数漂移（同 `name` 不同 `baseURL`）**不静默换实例**：保留首个实例 + 结构化告警。
 */
export const initRequester = (options: UseRequesterOptions) => {
    const { name, baseURL, enableRetry = true, onAuthExpired, getAuthToken } = options

    if (requesterIdentity && requesterIdentity.name === name) {
        if (requesterIdentity.baseURL !== baseURL) {
            console.warn('[requester] initRequester 参数漂移：baseURL 变化，保留既有实例', {
                event: 'requester.init.drift',
                name,
                baseURL: requesterIdentity.baseURL,
                requestedBaseURL: baseURL
            })
        }
        if (onAuthExpired) registerAuthExpiredHandler(onAuthExpired)
        return requester
    }

    switch (name) {
        case 'LynxRequester': {
            // Lynx 运行时（ReactLynx）：基于内置 Fetch API，无 axios/dexie/localStorage 依赖
            requester = useLynxRequester(baseURL, publishAuthExpiry)
            break
        }
        case 'AxiosRequester':
        default: {
            requester = useAxiosRequester(baseURL, enableRetry, publishAuthExpiry, getAuthToken)
            // T560 / P0-安全：旧版本把明文口令写进 IndexedDB ⇒ 初始化一次性扫除（不阻塞启动）
            if (!credentialPurgeStarted) {
                credentialPurgeStarted = true
                void purgeLegacyCredentialLogs()
            }
            break
        }
    }

    requesterIdentity = { name: requester.name, baseURL: requester.baseURL }
    if (onAuthExpired) registerAuthExpiredHandler(onAuthExpired)
    return requester
}

/**
 * 获取所有操作日志
 * @returns 操作日志列表
 */
export const getOperationLogs = () => listLogs()

/**
 * 重放失败的幂等操作
 * @description 读取 status='failed' 且方法为幂等（get/put/delete）的日志并重新派发；
 *              成功的删除其日志，仍失败的保留。
 */
export const replayFailedOperations = async () => {
    const logs = await listFailedIdempotentLogs()
    for (const log of logs) {
        try {
            let response: RequesterOpRtn
            switch (log.method) {
                case 'get':
                    response = await requester.get(log.url)
                    break
                case 'put':
                    response = await requester.put(log.url, log.data)
                    break
                case 'delete':
                    response = await requester.delete(log.url)
                    break
                default:
                    continue
            }
            // 归一化网络错误在顶层携带字符串 code，视为仍失败，保留日志
            if (typeof (response as RequesterOpRtn)?.code !== 'string') {
                await removeLog(log.id)
            }
        } catch {
            // 重放失败，保留日志
        }
    }
}

export { purgeLegacyCredentialLogs, shouldSkipOperationLog } from './operation-log'
export type { Requester } from './types'
export type { OperationLog, OperationLogStatus, HttpMethod } from './types'
export { resetAuthExpiredLatch } from './axios'
export { fireAuthExpiry, onAuthExpiry, resetAuthExpiryLatch } from './auth-expiry'
export type { AuthExpiryReason } from './auth-expiry'