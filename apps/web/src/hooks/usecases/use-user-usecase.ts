import { UserStore, UserUseCase } from '@nao-todo/domain-identity'
import { newUserConfigRepository, newUserRepository } from '@nao-todo/infrastructure'
import { getRequesterImpl } from '@nao-todo/shared'

/**
 * 用户用例工厂
 * @param store 用户存储
 * @returns 用户用例
 */
export const useUserUseCase = (store: UserStore) => {
    const requester = getRequesterImpl()
    const userRepo = newUserRepository(requester)
    const userConfigRepo = newUserConfigRepository(requester)
    return new UserUseCase(userRepo, userConfigRepo, store)
}