import dayjs from 'dayjs'
import { Entity } from '@nao-todo/shared/entity'

/**
 * 判断可空时间戳是否「存在」
 * @description 空串（远程未删记录可能为 ""）与 null / undefined 均视为不存在；
 *              仅有效时间串算作存在。显式排除 undefined，避免 `dayjs(undefined)`
 *              被解析为「当前时间」而误判为存在。
 */
const isPresentStamp = (value: string | null | undefined): boolean =>
    value !== null && value !== undefined && value !== '' && dayjs(value).isValid()

/**
 * 判断任务清单是否「已删除」（客户端判据单一真源，PA-1）
 * @description 项目域「已删除」= `deletedAt` ∪ `deactivedAt` 任一非空：
 *   - `deletedAt`：本地真删除写入的墓碑（`projectRepo.delete()`，唯一写入点）；
 *   - `deactivedAt`：服务端删除/停用写入（客户端仅通过 pull 回填）。
 *   二者任一存在都表示「已删除」⇒ 判定必须同时认这两个字段，不得只看其一。
 *   ⚠️ 项目域 ≠ 用户域：用户域 `deactivedAt` 语义为「注销宽限期」（可含未来时间），
 *      项目域此处仅作 presence 判据，不比较时间。
 */
export const isProjectDeleted = (project: {
    deletedAt: string | null | undefined
    deactivedAt: string | null | undefined
}): boolean => isPresentStamp(project.deletedAt) || isPresentStamp(project.deactivedAt)

/**
 * 任务清单实体
 * @description 任务清单实体，包含任务清单的属性和方法
 */
export class ProjectEntity extends Entity {
    // 任务清单实体构造函数
    constructor(
        public id: string, // 任务清单ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null, // 删除时间
        public name: string, // 任务清单名称
        public icon: string, // 任务清单图标
        public description: string | null, // 任务清单描述
        public archivedAt: string | null, // 归档时间
        public deactivedAt: string | null, // 停用(软删除)时间
        public sortId: number, // 排序ID
        // 领域统计属性（服务端反规范化计数，只读透传；尾部可选默认 0，不破坏既有构造）
        public taskCount = 0 // 任务数量（含子任务；不含已删除）
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }

    /**
     * 是否已删除（PA-1：覆盖 Entity 的墓碑判据，收敛为项目域口径）
     * @description 见 `isProjectDeleted`。`Entity.isDeleted`（仅认 `deletedAt`）
     *              在项目域不完整，此处显式覆盖，避免两套判据并存。
     */
    get isDeleted(): boolean {
        return isProjectDeleted(this)
    }

    /**
     * 判断任务清单是否归档
     */
    isArchived(): boolean {
        // 任务清单归档时间在当前时间之后，任务清单为归档
        return this.archivedAt !== null && dayjs(this.archivedAt).isBefore(dayjs())
    }
}