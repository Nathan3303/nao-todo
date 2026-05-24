export type ResponseDataPagination = {
    total: number
    page: number
    limit: number
    maxPage: number
}

export type ResponseData = {
    code: number
    message: string
    data: unknown
    error?: string
    pagination?: ResponseDataPagination
}
