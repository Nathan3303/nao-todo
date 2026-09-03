import type { Go } from '@nao-todo/shared'
import { COMMENT_CONTENT_MAX_CHARS } from '../constants'
import { TaskErrorCode } from '../errors'

/**
 * CreateTaskCommentValueObject 创建评论值对象
 * @description 创建评论值对象，用于创建任务评论
 */
export class CreateTaskCommentValueObject {
    // constructor 评论值对象构造函数
    constructor(
        public taskId: string, // 任务ID
        public content: string, // 评论内容
        public attachments: string[], // 附件列表
        public isTopUp: boolean // 是否是充值评论
    ) {}

    /**
     * 校验创建评论值对象
     * @description 校验创建评论值对象，确保评论内容和附件列表符合要求
     * @returns 校验结果
     */
    validate(): Go<void> {
        if (!this.taskId) return TaskErrorCode.TASK_ID_EMPTY
        if (!this.content) return TaskErrorCode.COMMENT_CONTENT_EMPTY
        const validCharPattern =
            /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af\u0041-\u005a\u0061-\u007a\u1f300-\u1f5ff\u1f600-\u1f64f\u1f680-\u1f6ff\u2600-\u26ff\u2700-\u27bf]/g
        const charCount = (this.content.match(validCharPattern) || []).length
        if (charCount >= COMMENT_CONTENT_MAX_CHARS) return TaskErrorCode.COMMENT_CONTENT_TOO_LONG
        return null
    }
}