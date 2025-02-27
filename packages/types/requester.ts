type RequesterOpRtn = Record<string, any> & { data: unknown }

export type Requester = {
    name: 'AxiosRequester' | 'UniRequester'
    baseURL: string
    get: (url: string) => Promise<RequesterOpRtn>
    post: (url: string, data?: unknown) => Promise<RequesterOpRtn>
    put: (url: string, data?: unknown) => Promise<RequesterOpRtn>
    delete: (url: string) => Promise<RequesterOpRtn>
}
