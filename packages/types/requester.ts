type RequesterOpRtn = Record<string, any> & { data: unknown }

type RequesterConfig = Record<any, any>

export type Requester = {
    name: 'AxiosRequester' | 'UniRequester'
    baseURL: string
    get: (url: string, config?: RequesterConfig) => Promise<RequesterOpRtn>
    post: (url: string, data?: unknown, config?: RequesterConfig) => Promise<RequesterOpRtn>
    put: (url: string, data?: unknown, config?: RequesterConfig) => Promise<RequesterOpRtn>
    delete: (url: string, config?: RequesterConfig) => Promise<RequesterOpRtn>
}
