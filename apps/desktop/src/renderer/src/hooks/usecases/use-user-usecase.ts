import {
    UserStore,
    UserUseCase,
    type DeactiveUserViewObject,
    type RestoreUserViewObject,
    type UpdatePasswordViewObject
} from '@nao-todo/domain-identity'
import {
    cryptoService,
    deletionService,
    localSession,
    newUserConfigRepository,
    newUserRepository
} from '@nao-todo/infrastructure'
import { getRequesterImpl } from '@nao-todo/shared'

/**
 * 用户用例工厂（桌面版：用户资料/账号操作/外观配置走后端 API，与 Web 端一致；
 * 注销成功后记录本地 7 天删除调度，恢复成功后取消调度；
 * 修改密码成功后本地密钥包用新密码重新包裹）
 * @param store 用户存储
 * @returns 用户用例
 */
export const useUserUseCase = (store: UserStore) => {
    const requester = getRequesterImpl()
    const userRepo = newUserRepository(requester)
    const userConfigRepo = newUserConfigRepository(requester)
    const useCase = new UserUseCase(userRepo, userConfigRepo, store)

    const originalDeactive = useCase.deactive.bind(useCase)
    const originalRestore = useCase.restore.bind(useCase)
    const originalUpdatePassword = useCase.updatePassword.bind(useCase)

    useCase.deactive = async (deactiveUserViewObject: DeactiveUserViewObject) => {
        const err = await originalDeactive(deactiveUserViewObject)
        if (err !== null) return err
        // 注销成功：记录本地 7 天删除调度（到期自动清空该用户本地数据）
        const userId = localSession.getCurrentUserId()
        if (userId) await deletionService.recordDeletion(userId)
        return null
    }

    useCase.restore = async (restoreUserViewObject: RestoreUserViewObject) => {
        const err = await originalRestore(restoreUserViewObject)
        if (err !== null) return err
        // 恢复成功：取消删除调度，本地数据保留
        const userId = localSession.getCurrentUserId()
        if (userId) await deletionService.cancelDeletion(userId)
        return null
    }

    useCase.updatePassword = async (updatePasswordViewObject: UpdatePasswordViewObject) => {
        const err = await originalUpdatePassword(updatePasswordViewObject)
        if (err !== null) return err
        // 本地密钥包用新密码重新包裹（否则改密后新密码登录无法解锁本地数据）
        const userId = localSession.getCurrentUserId()
        if (userId) {
            try {
                await cryptoService.changePassword(
                    userId,
                    updatePasswordViewObject.password,
                    updatePasswordViewObject.newPassword
                )
            } catch (changeErr) {
                console.error('[desktop] 本地密钥包重包失败', changeErr)
                return '本地数据密钥更新失败，请重试'
            }
        }
        return null
    }

    return useCase
}