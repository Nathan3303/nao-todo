/**
 * 持久化本地通用工具
 */

/**
 * 判断软删字段是否表示"未删除"
 * @description 未删 = null 或空串（远程同步拉取的未删记录 deletedAt 可能为 ""）；
 *              已删 = 非空时间字符串（软删墓碑语义）
 */
export const isNotDeleted = (value: string | null): boolean => value === null || value === ''