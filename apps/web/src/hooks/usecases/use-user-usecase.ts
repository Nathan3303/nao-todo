import { UserStore, UserUseCase } from '@nao-todo/domain-identity'
import { cacheNickname, newUserConfigRepository, newUserRepository } from '@nao-todo/infrastructure'
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
    const useCase = new UserUseCase(userRepo, userConfigRepo, store)

    // SHELL-03 C-21：在线成功取得昵称时写离线身份缓存（装配层单点，只写昵称；不包 avatar/config）
    const originalLoadUserProfile = useCase.loadUserProfile.bind(useCase)
    const originalUpdateNickname = useCase.updateNickname.bind(useCase)

    useCase.loadUserProfile = async () => {
        const result = await originalLoadUserProfile()
        const [profile, err] = result
        if (err === null && profile) cacheNickname(profile.nickname ?? '')
        return result
    }

    useCase.updateNickname = async (updateUserNicknameViewObject) => {
        const err = await originalUpdateNickname(updateUserNicknameViewObject)
        if (err === null) cacheNickname(updateUserNicknameViewObject.nickname ?? '')
        return err
    }

    return useCase
}