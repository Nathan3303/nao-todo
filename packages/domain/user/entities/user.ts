/**
 * 用户实体
 * @description 用户实体，包含用户的基本信息和状态
 */
export class UserEntity {
    /**
     * 用户实体构造函数
     * @param id 用户ID
     * @param email 用户邮箱
     * @param nickname 用户昵称
     * @param avatar 用户头像
     * @param role 用户角色
     * @param state 用户状态
     * @param createdAt 创建时间
     * @param updatedAt 更新时间
     */
    constructor(
        public id: string,
        public email: string,
        public nickname: string,
        public avatar: string,
        public role: string,
        public state: number,
        public createdAt: string,
        public updatedAt: string
    ) {}
}
