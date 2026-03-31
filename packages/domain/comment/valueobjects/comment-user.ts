/**
 * 评论用户值对象
 * @description 评论用户的值对象，包含评论用户的昵称和头像
 */
export class CommentUserValueObject {
    /**
     * 评论用户值对象构造函数
     * @param commentId 评论的ID
     * @param nickname 评论用户的昵称
     * @param avatar 评论用户的头像
     */
    constructor(
        public commentId: string,
        public nickname: string,
        public avatar: string
    ) {}
}
