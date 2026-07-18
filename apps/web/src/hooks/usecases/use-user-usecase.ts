import { UserDomain, UserStore, UserUseCase } from '@nao-todo/domain/user'
import { newUserConfigRepository, newUserRepository } from '@nao-todo/infrastructure/backend/user'
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
    const userDomain = new UserDomain(userRepo, userConfigRepo)
    return new UserUseCase(userDomain, userRepo, userConfigRepo, store)
}

