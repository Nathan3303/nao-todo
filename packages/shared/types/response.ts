// Backend api response type
import type { Pagination } from './pagination'

// Backend api response type
export type ResponseData<V = unknown> = {
    code: number
    message: string
    data: V
    pagination?: Pagination
}

// Backend api request type
export type GetRequestPageOptions = {
    page?: number
    limit?: number
}