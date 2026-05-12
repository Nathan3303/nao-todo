/**
 * 用户配置实体
 * @description 用户配置实体，包含用户配置信息
 */
export class UserConfigEntity {
    /**
     * 用户配置实体构造函数
     * @param id 用户ID
     * @param appearance 外观设置值
     * @param createdAt 创建时间
     * @param updatedAt 更新时间
     */
    constructor(
        public id: string,
        public appearance: string,
        public createdAt: string,
        public updatedAt: string
    ) {}
}

