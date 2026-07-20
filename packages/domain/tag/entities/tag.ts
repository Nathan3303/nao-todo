import dayjs from 'dayjs'
import { Entity } from '@nao-todo/shared'

/**
 * 标签实体
 * @description 标签实体类，用于表示标签的属性和操作
 */
export class TagEntity extends Entity {
    // constructor 标签实体构造函数
    constructor(
        public id: string, // 标签ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null, // 删除时间
        // public userId: string, // 用户ID
        public icon: string, // 标签图标
        public name: string, // 标签名称
        public description: string, // 标签描述
        public color: string, // 标签颜色
        public sortId: number // 排序ID
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }

    /**
     * 判断标签是否删除
     */
    isDeleted(): boolean {
        return this.deletedAt !== null && dayjs(this.deletedAt).isBefore(dayjs())
    }
}

