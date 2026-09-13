<script setup lang="ts">
import { SETTINGS_VIEW_CONTEXT_KEY } from '../context'
import {
    UserAvatarUpdater,
    UserInfoViewer,
    UserNicknameUpdater,
    useUserStore,
    UserDeactiveDialog,
    UserRestoreDialog,
    UserDeactiveManager,
    UserSessionManager
} from '@nao-todo/presentation-identity'
import { t, USER_DEACTIVE_DIALOG_KEY } from '@nao-todo/shared'
import { cryptoService, localSession, readCachedNickname } from '@nao-todo/infrastructure'
import { revokeOfflineEntry } from '@/views/auth/offline-entry'
import { safeReplace } from '@/safe-navigation'
import { NueConfirm, NueMessage } from 'nue-ui'
import { storeToRefs } from 'pinia'
import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'SettingsProfileUpdater' })

const router = useRouter()
const { isDisplayAside, switchDisplayAside, userUseCase, authUseCase, dialogManager } =
    inject(SETTINGS_VIEW_CONTEXT_KEY)!
const userStore = useUserStore()
const { profile, userToken } = storeToRefs(userStore)

/**
 * G14：离线 profile 缺失时复用 SHELL-03 昵称缓存做展示占位
 * @description 仅展示，**不得**用于鉴权/守卫（SHELL-03 C-19）；邮箱等缺失字段留空
 */
const offlineNickname = computed(() => (profile.value ? '' : readCachedNickname() || ''))
const displayNickname = computed(() => profile.value?.nickname || offlineNickname.value)

const handleSignOut = async () => {
    const [isByCancel] = await NueConfirm({
        title: '确认退出登录吗？',
        content: '退出登录后，您需要重新登录才能继续使用应用。',
        confirmButtonText: '退出登录',
        cancelButtonText: '取消'
    })
    if (isByCancel) return

    const token = userToken.value
    // G12：本地清认证优先（离线必达）；C-25：登出必须清离线授权
    revokeOfflineEntry()
    userStore.clearAuthData()
    localSession.clear()
    cryptoService.lock()
    // 远程登出尽力而为：离线/网络失败不阻断、不弹错误封锁（与 password-updater 语义对齐）
    try {
        await authUseCase.signOut(token)
    } catch {
        /* 远程登出失败：本地登出已完成 */
    }
    NueMessage.success('退出登录成功')
    await safeReplace(router, '/auth/signin', 'settings:sign-out-navigation')
}

const handleDeactivated = async () => {
    dialogManager.close(USER_DEACTIVE_DIALOG_KEY)
    await router.replace('/auth/signin')
}
</script>

<template>
    <nue-container id="SettingsProfileContainer">
        <nue-header>
            <nue-button
                :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                theme="icon,ghost"
                @click="switchDisplayAside"
            />
            <nue-text>{{ t('settings.profile') }}</nue-text>
        </nue-header>
        <nue-main>
            <nue-content fill>
                <nue-div vertical style="padding: 1rem">
                    <user-avatar-updater :user-use-case="userUseCase" style="padding: 1rem">
                        <nue-div vertical flex="1" align="start">
                            <nue-div vertical gap="0.25rem">
                                <nue-text v-if="displayNickname" size="1.25rem">
                                    {{ displayNickname }}
                                </nue-text>
                                <nue-text v-if="profile" size=".875rem" color="gray">
                                    {{ profile.email }}
                                </nue-text>
                                <nue-text v-else size=".875rem" color="gray">
                                    {{ t('identity.offline') }}
                                </nue-text>
                            </nue-div>
                            <nue-button @click="handleSignOut" icon="arrow-left-more" theme="small">
                                {{ t('settings.signOutButtonText') }}
                            </nue-button>
                        </nue-div>
                    </user-avatar-updater>
                    <nue-divider />
                    <nue-div vertical gap=".75rem">
                        <nue-text>{{ t('settings.nickname') }}</nue-text>
                        <user-nickname-updater :user-use-case="userUseCase" />
                    </nue-div>
                    <nue-divider />
                    <nue-div vertical gap=".75rem">
                        <nue-text>{{ t('settings.moreInfo') }}</nue-text>
                        <user-info-viewer />
                    </nue-div>
                    <nue-divider />
                    <user-session-manager :user-use-case="userUseCase" />
                    <nue-divider />
                    <user-deactive-manager :dialog-manager="dialogManager" />
                </nue-div>
            </nue-content>
        </nue-main>
        <user-restore-dialog :user-use-case="userUseCase" :dialog-manager="dialogManager" />
        <user-deactive-dialog
            :user-use-case="userUseCase"
            :dialog-manager="dialogManager"
            @deactivated="handleDeactivated"
        />
    </nue-container>
</template>