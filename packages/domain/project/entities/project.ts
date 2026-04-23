/**
 * 任务清单实体
 * @description 任务清单实体，包含任务清单的属性和方法
 */
export class ProjectEntity {
    /**
     * 任务清单实体构造函数
     * @param id 任务清单ID
     * @param name 任务清单名称
     * @param icon 任务清单图标
     * @param description 任务清单描述
     * @param archivedAt 归档时间
     * @param createdAt 创建时间
     * @param updatedAt 更新时间
     * @param deactivedAt 停用(删除)时间
     */
    constructor(
        public id: string,
        public name: string,
        public icon: string,
        public description: string,
        public archivedAt: string,
        public createdAt: string,
        public updatedAt: string,
        public deactivedAt: string | null
    ) {}
}

