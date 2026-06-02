// import { Go } from '@nao-todo/types'

/**
 * 评论实体
 * @description 评论的实体，包含评论的ID、任务ID、评论内容、创建时间、附件列表、是否是充值评论和评论用户信息
 */
export class CommentEntity {
    /**
     * 评论实体构造函数
     * @param id 评论的ID
     * @param taskId 评论所属的任务ID
     * @param content 评论内容
     * @param createdAt 评论创建时间
     * @param attachments 评论附件列表
     * @param isTopUp 是否是充值评论
     */
    constructor(
        public id: string,
        public taskId: string,
        public content: string,
        public createdAt: string,
        public attachments: string[],
        public isTopUp: boolean,
        public avatar: string,
        public nickname: string
    ) {}

    /**
     * 评论实体数据校验
     * @description 评论实体数据校验，校验评论内容是否超过256个字符
     * @returns 错误信息
     */
    // validate(): Go<void> {
    //     if (!this.content) return '评论内容不能为空'
    //     if (this.content.length > 256) return '评论内容不能超过256个字符'
    //     return null
    // }
}

