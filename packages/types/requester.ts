import type { AxiosInstance } from 'axios'

type RequesterOpRtn = Record<string, any> & { data: unknown }

type RequesterConfig = { data?: Record<string, any> } | Record<string, any>

export type Requester = {
    _instance: AxiosInstance
    name: 'AxiosRequester' | 'UniRequester'
    baseURL: string
    get: (url: string, config?: RequesterConfig) => Promise<RequesterOpRtn>
    post: (url: string, data?: unknown, config?: RequesterConfig) => Promise<RequesterOpRtn>
    put: (url: string, data?: unknown, config?: RequesterConfig) => Promise<RequesterOpRtn>
    delete: (url: string, config?: RequesterConfig) => Promise<RequesterOpRtn>
}
