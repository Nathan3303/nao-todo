import type {
    DeactiveUserViewObject,
    RestoreUserViewObject,
    SignInViewObject,
    UpdatePasswordViewObject
} from '@nao-todo/domain-identity'
import type { UseCaseBinding } from '@nao-todo/webapp/src/hooks/usecases/binding'
import { cryptoService } from '@nao-todo/infrastructure/src/persistence-local/crypto/crypto-service'
import { deletionService } from '@nao-todo/infrastructure/src/persistence-local/deletion/deletion-service'
import { initSnowflakeEpoch } from '@nao-todo/infrastructure/src/persistence-sync/epoch'
import { recordCheckInAttempt } from '@nao-todo/shared/session-renewal'
import { markTokenRotated, resetTokenRotation } from '@nao-todo/shared/requester/auth-rotation'
import {
    localSession,
    resolveUserIdFromStoredJwt
} from '@nao-todo/infrastructure/src/persistence-local/session/local-session'
import { newLocalPomodoroRecordRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/pomodoro-record-repo-impl'
import { newLocalPomodoroRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/pomodoro-repo-impl'
import { newLocalProjectPreferenceRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/project-preference-repo-impl'
import { newLocalProjectRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/project-repo-impl'
import { newLocalTagPreferenceRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/tag-preference-repo-impl'
import { newLocalTagRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/tag-repo-impl'
import { newLocalTaskCheckItemRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/task-check-item-repo-impl'
import { newLocalTaskCommentRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/task-comment-repo-impl'
import { newLocalTaskRepository } from '@nao-todo/infrastructure/src/persistence-local/repos/task-repo-impl'
import {
    isPlaintextMigrationDone,
    runPlaintextMigration
} from '@nao-todo/infrastructure/src/persistence-local/migration/plaintext-migration'
import {
    PROJECT_ARCHIVE_WRITE_METHODS,
    TASK_ARCHIVE_WRITE_METHODS,
    createProjectArchivedTargetJudge,
    createTaskArchivedTargetJudge,
    withArchivedReadOnlyGuard
} from '@nao-todo/presentation/task/archive-gate'

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
     * 归档态只读守卫（P3 任务域 + P3b 项目域 / ADR `2026-09-24-project-archive.md` §15.3 / §7.2）
     * @description 与 web binding 同逻辑（同一 `archive-gate` 实现）⇒ **两端行为一致**；
     *              desktop 不提供 web 的离线只读闸门（`decorateUseCase` 仅叠加归档守卫）。
     */
    decorateUseCase: (useCase, kind) => {
        if (kind === 'task') {
            return withArchivedReadOnlyGuard(useCase, TASK_ARCHIVE_WRITE_METHODS, {
                isArchivedTarget: createTaskArchivedTargetJudge({
                    isTaskArchived: async (taskId) => {
                        const [entity] = await useCaseBinding.createTaskRepository().get(taskId)
                        return Boolean(entity?.archivedAt)
                    },
                    isProjectArchived: async (projectId) => {
                        const [entity] = await useCaseBinding
                            .createProjectRepository()
                            .get(projectId)
                        return Boolean(entity?.archivedAt)
                    }
                })
            })
        }
        if (kind === 'project') {
            return withArchivedReadOnlyGuard(useCase, PROJECT_ARCHIVE_WRITE_METHODS, {
                isArchivedTarget: createProjectArchivedTargetJudge({
                    isProjectArchived: async (projectId) => {
                        const [entity] = await useCaseBinding
                            .createProjectRepository()
                            .get(projectId)
                        return Boolean(entity?.archivedAt)
                    }
                })
            })
        }
        return useCase
    },

    /**
     * 认证用例装饰（桌面版保持远程后端认证，并联动本地数据解锁）
     * @description signIn 成功后解析 JWT 中的用户 ID 并确保本地密钥包就绪（首次 setup / 之后 unlock）；
     *              signOut 成功后清空会话与内存密钥（本地密文不可读）。
     */
    decorateAuthUseCase: (useCase) => {
        const originalSignIn = useCase.signIn.bind(useCase)
        const originalSignOut = useCase.signOut.bind(useCase)
        const originalCheckIn = useCase.checkIn.bind(useCase)

        /**
         * 检入（页面冷启动与常驻续期**共用同一入口**，AC6 / R2）
         * @description ① 记录发起时刻 ⇒ 续期调度器读 `lastCheckInAt`，启动 60s 内**合计恰好 1 次**
         *              （`T544` Q2 裁定：不双发，也不为 0）；② 成功即标记 token 轮换 ⇒ 10s 内到达的
         *              10041 走宽限（不登出、不置 `authExpiredFired`），防在途旧 token 自伤登出。
         */
        useCase.checkIn = async (token: string) => {
            recordCheckInAttempt()
            const checkInError = await originalCheckIn(token)
            if (checkInError === null) markTokenRotated()
            return checkInError
        }

        useCase.signIn = async (signInViewObject: SignInViewObject) => {
            const err = await originalSignIn(signInViewObject)
            if (err !== null) return err
            // checkin 发起时刻已由 AuthUseCase.signIn 成功分支在 setUserToken 之前记录（#260 修复①，域层单点）
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
                // D3-E（DEF-91）：已明文迁移的库**不需要** DEK（数据全是 `plain:` 直读）
                // ⇒ 解锁失败只降级、不阻断登录；并用本次密码重建包裹（丢失 0：无密文可丢）
                const migrated = await isPlaintextMigrationDone(userId)
                if (!migrated) {
                    console.error('[desktop] 本地数据解锁失败', unlockErr)
                    // DEF-91 / L3：不得把「密钥包裹失效」说成「密码错」——
                    // 用户多半是在其它设备改过账号密码，本地密钥包仍是旧密码包裹。
                    return (
                        '本地数据无法用当前密码解开，可能是账号密码已在其他设备修改；' +
                        '请重启后在本地数据解锁页用旧密码解锁，或重建本地数据'
                    )
                }
                console.warn(
                    '[desktop] 本地密钥包无法用当前密码解开（已迁移明文库）⇒ 降级进入并重建密钥包',
                    { event: 'desktop.unlock.degraded', userId }
                )
                try {
                    await cryptoService.setup(userId, signInViewObject.password)
                } catch (rebuildErr) {
                    // 重建失败不阻断登录（明文直读）；下次登录/解锁门再重试
                    console.error('[desktop] 本地密钥包重建失败（登录已放行）', rebuildErr)
                }
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
            // 登出后旧 token 的轮换宽限无意义（避免吞掉下一次真实失效的 10041）
            resetTokenRotation()
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