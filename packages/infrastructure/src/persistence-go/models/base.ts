// 基础模型
export type ResponseBase = {
    id: string
    deletedAt: string | null
    createdAt: string
    updatedAt: string
}

// 列表数据请求基础模型
export type ListRequestBase = {
    page: number
    limit: number
    sort: string
}

// 数据响应模型
import type { Pagination } from '@nao-todo/shared/types/pagination'

export type ResponseData = {
    code: number
    message: string
    data: unknown
    error?: string
    businessCode?: string
    pagination?: Pagination
}