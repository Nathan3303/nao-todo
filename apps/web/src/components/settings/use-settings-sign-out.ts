import { inject } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { NueConfirm, NueMessage } from 'nue-ui'
import { t } from '@nao-todo/shared/locales'
import { useUserStore } from '@nao-todo/presentation-identity'
import { isNetworkError } from '@nao-todo/domain-identity'
import { cryptoService } from '@nao-todo/infrastructure/src/persistence-local/crypto/crypto-service'
import {
    localSession,
    resolveUserIdFromStoredJwt
} from '@nao-todo/infrastructure/src/persistence-local/session/local-session'
import { revokeOfflineEntry } from '@/views/auth/offline-entry'
import { wipeLocalDataOnSignOut } from '@/views/auth/sign-out-wipe'
import { broadcastSignOut } from '@/views/auth/sign-out-broadcast'
import { safeReplace } from '@/safe-navigation'
import { SETTINGS_VIEW_CONTEXT_KEY } from './context'

/**
 * 设置域「退出登录」流程（T535 抽出）
 * @description 账户类危险区（独立行）与用户信息行（`show-sign-out` 兼容入口）**共用同一实现**，
 *              语义与 `v1.12.16` 逐步一致：确认 → C-54 脏队列护栏 + 清库 → 本地清认证（离线必达）
 *              + 清离线授权 → 广播其它标签 → 远程登出尽力而为 → 跳登录页。
 *              本单只搬位置与调用方，**不改**任何一步的顺序、条件与错误处理。
 * @see docs/prds/2026-10-24-settings-ia.md（AC6 · R3 危险区隔离）
 */
export const useSettingsSignOut = () => {
    const router = useRouter()
    const { authUseCase } = inject(SETTINGS_VIEW_CONTEXT_KEY)!
    const userStore = useUserStore()
    const { userToken } = storeToRefs(userStore)

    const signOut = async (): Promise<void> => {
        const [isByCancel] = await NueConfirm({
            title: t('settings.signOutConfirmTitle'),
            content: t('settings.signOutConfirmContent'),
            confirmButtonText: t('settings.signOutConfirmText'),
            cancelButtonText: t('common.cancel')
        })
        if (isByCancel) return

        // C-54/C-52：脏队列护栏 + 清库（先于清认证；取消则中止，保留会话与本地数据）
        const userId = resolveUserIdFromStoredJwt()
        if (userId && !(await wipeLocalDataOnSignOut(userId))) return

        const token = userToken.value
        // G12：本地清认证优先（离线必达）；C-25：登出必须清离线授权
        revokeOfflineEntry()
        userStore.clearAuthData()
        localSession.clear()
        cryptoService.lock()
        // AC16b：本标签登出已完成（清库已过 C-54 护栏 + 清认证）⇒ 通知其它标签清 store + 跳登录页
        if (userId) broadcastSignOut(userId)
        // 远程登出（撤销服务端会话）：本地登出已完成 ⇒ 传输层失败不阻断、不弹错误封锁；
        // 但**服务端业务失败**（如 10031 参数错误 / 会话未撤销）必须可见反馈（T560）
        let remoteFailure: string | Error | null = null
        try {
            remoteFailure = await authUseCase.signOut(token)
        } catch {
            /* 传输层异常：本地登出已完成，静默 */
        }
        if (
            remoteFailure !== null &&
            remoteFailure !== undefined &&
            !isNetworkError(remoteFailure)
        ) {
            NueMessage.error(t('settings.signOutFailed'))
        } else {
            NueMessage.success(t('settings.signOutSuccess'))
        }
        await safeReplace(router, '/auth/signin', 'settings:sign-out-navigation')
    }

    return { signOut }
}