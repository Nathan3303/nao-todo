import type { BuiltInProjectCreateTaskOptions } from '../types'

/**
 * 内置清单
 * @description 内置清单实体
 */
export class BuiltInProjectEntity {
    /**
     * 内置清单实体构造函数
     * @param id 内置清单 ID
     * @param name 内置清单名称
     * @param icon 内置清单图标
     * @param description 内置清单描述
     * @param createTaskOptions 创建任务选项
     */
    constructor(
        public id: string,
        public name: string,
        public icon: string,
        public description: string,
        public createTaskOptions:
            (() => BuiltInProjectCreateTaskOptions) | BuiltInProjectCreateTaskOptions
    ) {}
}
