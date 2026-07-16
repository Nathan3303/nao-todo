import type { TagViewObject } from '@nao-todo/usecases/tag'
import type { TaskViewObject } from '@nao-todo/usecases/task'

export type TaskTagBarProps = {
    /**
     * 可选择（可用）的标签列表
     * @description 用于展示任务标签栏的选项列表
     */
    availableTags: TagViewObject[]
    /**
     * 任务标签栏已选择的标签ID列表
     * @description 用于展示已选择的任务标签
     */
    taskTagIds: TaskViewObject['tags']
    /**
     * 任务标签栏的溢出隐藏
     * @description 用于设置任务标签栏的溢出隐藏
     * @default 0
     * @type {number}
     */
    clamped?: number
    /**
     * 任务标签栏是否只读
     * @description 用于设置任务标签栏是否只读
     * @default false
     * @type {boolean}
     */
    readonly?: boolean
    /**
     * 任务标签栏是否为小尺寸
     * @description 用于设置任务标签栏是否为小尺寸
     * @default false
     * @type {boolean}
     */
    small?: boolean
    /**
     * 任务标签栏的变换原点
     * @description 用于设置任务标签栏的变换原点
     * @default 'top left'
     * @type {string}
     */
    transformOrigin?: string
}

export type TaskTagBarEmits = {
    /**
     * 任务标签栏更新标签事件
     * @description 当任务标签栏更新标签时触发，触发参数为已选择的任务标签ID列表
     * @param tags 已选择的任务标签ID列表
     */
    (event: 'updateTags', tags: TaskViewObject['tags']): void

    /**
     * 任务标签栏创建标签事件
     * @description 当任务标签栏创建标签时触发，触发参数为新创建的标签名称
     * @param tagName 新创建的标签名称
     */
    (event: 'createTag', tagName: TagViewObject['name']): void
}


