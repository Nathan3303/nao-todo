import { UserStore, UserUseCase } from '@nao-todo/domain-identity'
import { newLocalUserConfigRepository, newLocalUserRepository } from '@nao-todo/infrastructure'

/**
 * 用户用例（桌面版本地资料 + 本地用户配置）
 * @param store 用户存储
 * @returns 用户用例
 */
export const useUserUseCase = (store: UserStore) => {
    const userRepo = newLocalUserRepository()
    const userConfigRepo = newLocalUserConfigRepository()
    return new UserUseCase(userRepo, userConfigRepo, store)
}