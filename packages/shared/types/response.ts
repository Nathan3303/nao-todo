// Backend api response type
export type ResponseDataPagination = {
    total: number
    page: number
    limit: number
    maxPage: number
    current?: number
}

// Backend api response type
export type ResponseData<V = unknown> = {
    code: number
    message: string
    data: V
    pagination?: ResponseDataPagination
}

// Backend api request type
export type GetRequestPageOptions = {
    page?: number
    limit?: number
}