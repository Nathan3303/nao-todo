export type ResponseDataPagination = {
    total: number
    page: number
    limit: number
    maxPage: number
    current: number
}

export type ResponseData = {
    code: number
    message: string
    data: unknown
    pagination?: ResponseDataPagination
}

export type GetRequestPageOptions = {
    page?: number
    limit?: number
}
