/**
 * 持久化本地通用工具
 */

/**
 * 判断软删字段是否表示"未删除"
 * @description 未删 = null 或空串（远程同步拉取的未删记录 deletedAt 可能为 ""）；
 *              已删 = 非空时间字符串（软删墓碑语义）
 */
export const isNotDeleted = (value: string | null): boolean => value === null || value === ''

/**
 * 判断可空时间戳字段是否表示“不存在”
 * @description 与 isNotDeleted 同族语义：null 或空串均视为不存在。
 *              远程同步拉取的未归档/未星标记录 archivedAt/starMarkAt 可能为 ""
 *              （与 deletedAt 空串惯例一致），本地过滤不得用严格 === null 排除它们。
 */
export const isAbsentStamp = (value: string | null | undefined): boolean =>
    value === null || value === '' || value === void 0