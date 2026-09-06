/**
 * 分页元数据（领域中立）
 * @description 仅承载列表分页的元信息，不属于任何传输信封（ResponseData）的形态；
 *              Domain/Application 只依赖此中立类型，信封展开发生在 Infrastructure。
 */
export type Pagination = {
    total: number
    page: number
    limit: number
    maxPage: number
}