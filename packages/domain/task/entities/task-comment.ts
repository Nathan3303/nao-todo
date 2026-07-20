import { Entity } from '@nao-todo/shared'

/**
 * 评论实体
 * @description 评论的实体，包含评论的ID、任务ID、评论内容、创建时间、附件列表、是否是充值评论和评论用户信息
 */
export class TaskCommentEntity extends Entity {
    // 评论实体构造函数
    constructor(
        public id: string, // 评论的ID
        public createdAt: string, // 创建时间
        public updatedAt: string, // 更新时间
        public deletedAt: string | null, // 删除时间
        public taskId: string, // 评论所属的任务ID
        public content: string, // 评论内容
        public attachments: string[], // 评论附件列表
        public isTopUp: boolean, // 是否是充值评论
        public avatar: string, // 评论用户头像
        public nickname: string // 评论用户昵称
    ) {
        super(id, createdAt, updatedAt, deletedAt)
    }

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
