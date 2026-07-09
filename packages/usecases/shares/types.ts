// 可空字符串
export type NullableString = string | null

// 可空日期字符串
export type NullableDateString = NullableString

// 视图对象基础属性
export type ViewObjectBase = {
    id: string // ID
    createdAt: string // 创建时间
    updatedAt: string // 更新时间
    deletedAt: NullableString // 删除时间
}


