import { Entity } from '@nao-todo/shared/entity'
import { JsonStringValueObject } from '@nao-todo/shared/valueobjects/json-string'
import type { Go } from '@nao-todo/shared'

/**
 * 任务清单偏好实体
 * @description 任务清单偏好实体，包含任务清单的偏好属性和方法
 */
export class ProjectPreferenceEntity extends Entity {
    // 项目偏好实体构造函数
    constructor(
        public id: string, // 项目偏好ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null,
        public projectId: string, // 项目ID
        public viewType: string, // 视图类型
        public getTasksOptions: JsonStringValueObject, // 获取任务选项
        public columns: JsonStringValueObject // 列配置
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }

    /**
     * 更新视图类型
     * @param viewType 新的视图类型
     * @returns 更新结果
     */
    changeViewType(viewType: string): Go {
        if (!['table', 'list', 'kanban'].includes(viewType)) {
            return 'Invalid view type'
        }
        this.viewType = viewType
        return null
    }

    /**
     * 更新获取任务选项
     * @param newOptions 新的获取任务选项
     * @returns 更新结果
     */
    updateGetTasksOptions(newOptions: string): Go {
        this.getTasksOptions = JsonStringValueObject.CreateByJsonString(newOptions)
        return null
    }

    /**
     * 更新列配置
     * @param newColumns 新的列配置
     * @returns 更新结果
     */
    updateColumns(newColumns: string): Go {
        this.columns = JsonStringValueObject.CreateByJsonString(newColumns)
        return null
    }
}