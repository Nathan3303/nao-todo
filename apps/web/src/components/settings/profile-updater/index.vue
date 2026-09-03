<script setup lang="ts">
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/views/index/settings/context'
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
import { t, unwrapError, USER_DEACTIVE_DIALOG_KEY } from '@nao-todo/shared'
import { NueConfirm, NueMessage } from 'nue-ui'
import { storeToRefs } from 'pinia'
import { inject } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'SettingsProfileUpdater' })

const router = useRouter()
const { isDisplayAside, switchDisplayAside, userUseCase, authUseCase, dialogManager } =
    inject(SETTINGS_VIEW_CONTEXT_KEY)!
const { profile } = storeToRefs(useUserStore())

const handleSignOut = async () => {
    const [isByCancel] = await NueConfirm({
        title: '确认退出登录吗？',
        content: '退出登录后，您需要重新登录才能继续使用应用。',
        confirmButtonText: '退出登录',
        cancelButtonText: '取消'
    })
    if (isByCancel) return

    const err = await authUseCase.signOut()
    if (err !== null) {
        NueMessage.error('退出登录失败' + `(${unwrapError(err)})`)
        return
    }
    NueMessage.success('退出登录成功')
    await router.replace('/auth/signin')
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
                <nue-div vertical style="padding: 2rem 1rem">
                    <user-avatar-updater :user-use-case="userUseCase">
                        <nue-div vertical flex="1" align="start">
                            <nue-div v-if="profile" vertical gap="0.25rem">
                                <nue-text size="1.25rem">{{ profile.nickname }}</nue-text>
                                <nue-text size=".875rem" color="gray">{{ profile.email }}</nue-text>
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