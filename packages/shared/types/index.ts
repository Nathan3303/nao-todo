// Backend api response type
export type * from './response'

// 分页元数据（领域中立）
export type * from './pagination'

// Golang like error handling type support
export type * from './golang'

// SSE 事件类型
export type * from './sse'

// 可空字符串 可空日期字符串
export type NullableString = string | null
export type NullableDateString = NullableString

// 视图对象基础属性
export type ViewObjectBase = {
    id: string // ID
    createdAt: string // 创建时间
    updatedAt: string // 更新时间
    deletedAt: NullableString // 删除时间
}