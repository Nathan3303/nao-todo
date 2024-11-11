export type ResponseData = {
    code: number
    message: string
    data: unknown
}

export type GetRequestPageOptions = {
    page: number
    limit: number
}
