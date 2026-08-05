import { AuthService, AuthStore, AuthUseCase } from '@nao-todo/domain-identity'
import type { SignInViewObject } from '@nao-todo/domain-identity'
import {
    cryptoService,
    localSession,
    resolveUserIdFromStoredJwt,
    useAuthRepository
} from '@nao-todo/infrastructure'
import { getRequesterImpl } from '@nao-todo/shared'

/**
 * 认证用例（桌面版保持远程后端认证，并联动本地数据解锁）
 * @description signIn 成功后解析 JWT 中的用户 ID 并确保本地密钥包就绪（首次 setup / 之后 unlock）；
 *              signOut 成功后清空会话与内存密钥（本地密文不可读）。
 * @param store 认证状态存储
 * @returns 认证用例
 */
export const useAuthUseCase = (store: AuthStore) => {
    const requester = getRequesterImpl()
    const authRepo = useAuthRepository(requester)
    const authDomain = new AuthService(authRepo)
    const useCase = new AuthUseCase(authDomain, store)

    const originalSignIn = useCase.signIn.bind(useCase)
    const originalSignOut = useCase.signOut.bind(useCase)

    useCase.signIn = async (signInViewObject: SignInViewObject) => {
        const err = await originalSignIn(signInViewObject)
        if (err !== null) return err
        // signIn 成功后 user-store 已将 JWT 写入 localStorage，解析用户 ID 建立本地会话
        const userId = resolveUserIdFromStoredJwt()
        if (!userId) {
            console.error('[desktop] 无法从 JWT 解析用户 ID')
            return '本地数据解锁失败，请重新登录'
        }
        localSession.setCurrentUserId(userId)
        try {
            await cryptoService.ensureUnlocked(userId, signInViewObject.password)
        } catch (unlockErr) {
            console.error('[desktop] 本地数据解锁失败', unlockErr)
            return '本地数据解锁失败，请检查密码'
        }
        return null
    }

    useCase.signOut = async (token: string) => {
        const err = await originalSignOut(token)
        if (err !== null) return err
        localSession.clear()
        cryptoService.lock()
        return null
    }

    return useCase
}