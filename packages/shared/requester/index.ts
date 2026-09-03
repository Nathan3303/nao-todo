import type { Requester, UseRequesterOptions, RequesterOpRtn } from './types'
import useAxiosRequester from './axios'
import { useLynxRequester } from './lynx'
import { listLogs, listFailedIdempotentLogs, removeLog } from './operation-log'

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

export const getRequesterImpl = () => requester

export const initRequester = (options: UseRequesterOptions) => {
    const { name, baseURL, enableRetry = true, onAuthExpired } = options

    switch (name) {
        case 'LynxRequester': {
            // Lynx 运行时（ReactLynx）：基于内置 Fetch API，无 axios/dexie/localStorage 依赖
            requester = useLynxRequester(baseURL, onAuthExpired)
            break
        }
        case 'AxiosRequester':
        default: {
            requester = useAxiosRequester(baseURL, enableRetry, onAuthExpired)
            break
        }
    }

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

export type { Requester } from './types'
export type { OperationLog, OperationLogStatus, HttpMethod } from './types'