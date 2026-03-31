import { Go } from '@nao-todo/types'

/**
 * 创建评论值对象
 * @description 创建评论值对象，包含任务 ID、评论内容、附件列表和是否为充值评论
 */
export class CreateCommentValueObject {
    /**
     * 创建评论值对象构造函数
     * @param taskId 任务 ID
     * @param content 评论内容
     * @param attachments 附件列表
     * @param isTopUp 是否为充值评论
     */
    constructor(
        public taskId: string,
        public content: string,
        public attachments: string[],
        public isTopUp: boolean
    ) {}

    /**
     * 校验创建评论值对象
     * @description 校验创建评论值对象，确保评论内容和附件列表符合要求
     * @returns 校验结果
     */
    validate(): Go<void> {
        if (!this.taskId) return '任务 ID不能为空'
        if (!this.content) return '评论内容不能为空'
        if (this.content.length > 256) return '评论内容最多 256 个字符'
        return null
    }
}
