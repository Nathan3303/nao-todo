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
        const validCharPattern =
            /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af\u0041-\u005a\u0061-\u007a\u1f300-\u1f5ff\u1f600-\u1f64f\u1f680-\u1f6ff\u2600-\u26ff\u2700-\u27bf]/g
        const charCount = (this.content.match(validCharPattern) || []).length
        if (charCount >= 1000) return '评论内容过长'
        return null
    }
}

