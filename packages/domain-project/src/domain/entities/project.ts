import dayjs from 'dayjs'
import { Entity } from '@nao-todo/shared'

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
        public sortId: number // 排序ID
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }

    /**
     * 判断任务清单是否停用(软删除)
     */
    isDeactived(): boolean {
        // 任务清单停用(软删除)时间在当前时间之后，任务清单为停用(软删除)
        return this.deactivedAt !== null && dayjs(this.deactivedAt).isAfter(dayjs())
    }

    /**
     * 判断任务清单是否归档
     */
    isArchived(): boolean {
        // 任务清单归档时间在当前时间之后，任务清单为归档
        return this.archivedAt !== null && dayjs(this.archivedAt).isBefore(dayjs())
    }
}