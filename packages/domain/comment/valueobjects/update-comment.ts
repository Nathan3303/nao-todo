import type { Go } from '@nao-todo/types'

/**
 * 更新评论值对象
 * @description 更新评论的值对象，包含评论内容和是否是充值评论
 */
export class UpdateCommentValueObject {
    /**
     * 更新评论值对象构造函数
     * @param content 评论内容
     * @param isTopUp 是否是充值评论
     */
    constructor(
        public content?: string,
        public isTopUp?: boolean
    ) {}

    /**
     * 更新评论值对象数据校验
     * @description 更新评论值对象数据校验，校验评论内容是否超过256个字符
     * @returns 错误信息
     */
    validate(): Go<void> {
        if (!this.content) return '评论内容不能为空'
        if (this.content.length > 256) return '评论内容最多256个字符'
        return null
    }
}
