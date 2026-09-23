import type {
    DeactiveUserViewObject,
    RestoreUserViewObject,
    SignInViewObject,
    UpdatePasswordViewObject
} from '@nao-todo/domain-identity'
import type { UseCaseBinding } from '@nao-todo/webapp/src/hooks/usecases/binding'
import {
    cryptoService,
    deletionService,
    initSnowflakeEpoch,
    localSession,
    newLocalPomodoroRecordRepository,
    newLocalPomodoroRepository,
    newLocalProjectPreferenceRepository,
    newLocalProjectRepository,
    newLocalTagPreferenceRepository,
    newLocalTagRepository,
    newLocalTaskCheckItemRepository,
    newLocalTaskCommentRepository,
    newLocalTaskRepository,
    resolveUserIdFromStoredJwt,
    runPlaintextMigration
} from '@nao-todo/infrastructure'

/**
 * 桌面端用例装配绑定
 * @description 共享用例经 `@/hooks/usecases/binding` 读取本模块（`electron.vite.config.ts`
 *              的 `@/hooks` 别名先于 `@` 命中）：业务数据仓储注入为本地 IndexedDB 实现，
 *              并注入认证/用户用例的桌面端专属装饰（本地解锁、注销调度、密钥重包）。
 */
export const useCaseBinding: UseCaseBinding = {
    createTaskRepository: () => newLocalTaskRepository(),
    createTaskCheckItemRepository: () => newLocalTaskCheckItemRepository(),
    createTaskCommentRepository: () => newLocalTaskCommentRepository(),
    createProjectRepository: () => newLocalProjectRepository(),
    createProjectPreferenceRepository: () => newLocalProjectPreferenceRepository(),
    createTagRepository: () => newLocalTagRepository(),
    createTagPreferenceRepository: () => newLocalTagPreferenceRepository(),
    createPomodoroRepository: () => newLocalPomodoroRepository(),
    createPomodoroRecordRepository: () => newLocalPomodoroRecordRepository(),

    /**
     * 认证用例装饰（桌面版保持远程后端认证，并联动本地数据解锁）
     * @description signIn 成功后解析 JWT 中的用户 ID 并确保本地密钥包就绪（首次 setup / 之后 unlock）；
     *              signOut 成功后清空会话与内存密钥（本地密文不可读）。
     */
    decorateAuthUseCase: (useCase) => {
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
            // 登录后拉取后端雪花 Epoch 配置本地生成器（失败回退缓存/默认，不阻塞登录与解锁）
            void initSnowflakeEpoch()
            try {
                await cryptoService.ensureUnlocked(userId, signInViewObject.password)
            } catch (unlockErr) {
                console.error('[desktop] 本地数据解锁失败', unlockErr)
                return '本地数据解锁失败，请检查密码'
            }
            // C-47/C-56：登录路径已带明文密码 ⇒ 首次登录静默完成全库明文迁移
            // （失败不阻塞登录：双格式读取兜底，下次启动/登录重试）
            try {
                await runPlaintextMigration(userId)
            } catch (migrateErr) {
                console.error('[desktop] 本地明文迁移失败', migrateErr)
            }
            return null
        }

        useCase.signOut = async (token: string) => {
            const err = await originalSignOut(token)
            // 本地会话清理不依赖远程结果（改密后旧 token 可能已失效，登出仍须完成）
            localSession.clear()
            cryptoService.lock()
            return err
        }

        return useCase
    },

    /**
     * 用户用例装饰（桌面版：注销成功后记录本地 7 天删除调度，恢复成功后取消调度；
     * 修改密码成功后本地密钥包用新密码重新包裹）
     */
    decorateUserUseCase: (useCase) => {
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
}