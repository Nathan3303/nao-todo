import { JsonStringValueObject } from '@nao-todo/shared/valueobjects/json-string'

/**
 * 内置清单偏好
 * @description 内置清单偏好实体
 */
export class BuiltInProjectPreferenceEntity {
    /**
     * 内置清单偏好实体构造函数
     * @param id 内置清单偏好 ID
     * @param userId 用户 ID
     * @param projectId 内置清单 ID
     * @param viewType 视图类型
     * @param getTasksOptions 获取任务选项
     * @param columns 列选项
     */
    constructor(
        public id: string,
        public userId: string,
        public projectId: string,
        public viewType: string,
        public getTasksOptions: JsonStringValueObject,
        public columns: JsonStringValueObject
    ) {}
}