import dayjs from 'dayjs'

/**
 * Entity 类
 * @description 用于表示实体对象，包含实体的基本属性和方法
 */
export class Entity {
    // constructor 实体类构造函数
    constructor(
        public readonly id: string, // 实体ID
        public readonly createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null // 删除时间
    ) {}

    /**
     * isIdValid 是否ID有效
     * @description 检测是否为雪花 ID 格式，长度在 1 到 20 之间字符
     */
    get isIdValid(): boolean {
        return this.id.length > 0 && this.id.length <= 20
    }

    /**
     * isDeleted 是否已删除
     * @description 通过 deletedAt 判断
     */
    get isDeleted(): boolean {
        return this.deletedAt !== null && dayjs(this.deletedAt).isValid()
    }
}