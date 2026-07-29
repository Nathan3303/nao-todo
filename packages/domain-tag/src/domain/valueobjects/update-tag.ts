import type { Go } from '@nao-todo/shared'
import type { TagEntity } from '../entities'

/**
 * 更新标签视图对象
 * @description 更新标签视图对象，用于更新标签实体
 */
export class UpdateTagValueObject {
    public name?: string // 标签名称
    public description?: string // 标签描述
    public color?: string // 标签颜色
    public icon?: string // 标签图标
    public sortId?: number // 排序 ID

    /**
     * 更新标签视图对象构造函数
     * @param id 标签ID
     */
    constructor(public id: string) {}

    /**
     * 更新标签实体
     * @param tagEntity 标签实体
     * @returns 更新结果
     */
    updateWith(tagEntity: TagEntity): Go {
        if (this.name !== void 0) {
            const err = tagEntity.updateName(this.name)
            if (err !== null) {
                return err
            }
        }
        if (this.description !== void 0) {
            const err = tagEntity.updateDescription(this.description)
            if (err !== null) {
                return err
            }
        }
        if (this.color !== void 0) {
            const err = tagEntity.updateColor(this.color)
            if (err !== null) {
                return err
            }
        }
        if (this.icon !== void 0) {
            const err = tagEntity.updateIcon(this.icon)
            if (err !== null) {
                return err
            }
        }
        if (this.sortId !== void 0) {
            const err = tagEntity.updateSortId(this.sortId)
            if (err !== null) {
                return err
            }
        }
        return null
    }
}