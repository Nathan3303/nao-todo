import { UserRepository } from '../repositories/user'
import { UserConfigRepository } from '../repositories/user-config'

export class UserDomain {
    /**
     * 用户域服务
     * @param userRepo 用户存储库
     * @param userConfigRepo 用户配置存储库
     */
    constructor(
        private userRepo: UserRepository,
        private userConfigRepo: UserConfigRepository
    ) {}
}

