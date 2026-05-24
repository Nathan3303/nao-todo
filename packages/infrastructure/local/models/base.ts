/**
 * IndexedDB 基础模型
 * @description 定义了 IndexedDB 基础模型的属性，用于存储和检索基础数据。
 * @property id - 唯一标识符
 * @property createdAt - 创建时间
 * @property updatedAt - 更新时间
 * @property deletedAt - 删除时间
 */
export type ModelBase = {
    id: string
    createdAt: string
    updatedAt: string
    deletedAt: string | null
} & ModelBaseLocalOnly

/**
 * IndexedDB 基础模型本地属性
 * @description 定义了 IndexedDB 基础模型的本地属性，用于存储和检索本地数据。
 * @property _id - 唯一标识符
 * @property _dbVersion - 数据库版本
 * @property _updatedAt - 更新时间
 */
type ModelBaseLocalOnly = {
    _id: string
    _dbVersion: number
    _createdAt: string
    _updatedAt: string
    _deletedAt: string | null
}


