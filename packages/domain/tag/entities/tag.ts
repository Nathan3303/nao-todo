/**
 * 标签实体
 * @description 标签实体类，用于表示标签的属性和操作
 */
export class TagEntity {
    /**
     * 标签实体构造函数
     * @param id 标签ID
     * @param userId 用户ID
     * @param name 标签名称
     * @param color 标签颜色
     * @param description 标签描述
     * @param createdAt 创建时间
     * @param updatedAt 更新时间
     */
    constructor(
        public id: string,
        public userId: string,
        public name: string,
        public color: string,
        public description: string,
        public createdAt: string,
        public updatedAt: string,
        public sortId: number
    ) {}
}
