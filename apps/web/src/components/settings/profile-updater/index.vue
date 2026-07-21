<script setup lang="ts">
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/views/index/settings/context'
import {
    UserAvatarUpdater,
    UserDeactive,
    UserInfoViewer,
    UserNicknameUpdater,
    useUserStore
} from '@nao-todo/presentation/user'
import { DialogInstanceType, t, unwrapError, useDialogWrapper } from '@nao-todo/shared'
import { NueConfirm, NueDialog, NueMessage } from 'nue-ui'
import { storeToRefs } from 'pinia'
import { inject, ref } from 'vue'
import { useRouter } from 'vue-router'

defineOptions({ name: 'SettingsProfileUpdater' })

const router = useRouter()
const { isDisplayAside, switchDisplayAside, userUseCase, authUseCase } =
    inject(SETTINGS_VIEW_CONTEXT_KEY)!
const { profile } = storeToRefs(useUserStore())

const dialogRef = ref<DialogInstanceType>()
const { visible, close: closeDialog } = useDialogWrapper(dialogRef)

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

const handleDeactive = () => {
    NueConfirm({
        title: t('user.deactiveConfirmTitle'),
        content: t('user.deactiveConfirmContent'),
        confirmButtonText: t('user.deactiveConfirmButton'),
        cancelButtonText: t('common.cancel'),
        onConfirm: () => {
            visible.value = true
        }
    })
}

const handleDeactivated = async () => {
    closeDialog()
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
                        <nue-div vertical flex="1">
                            <nue-div v-if="profile" vertical gap="0.25rem">
                                <nue-text size="1.25rem">{{ profile.nickname }}</nue-text>
                                <nue-text size=".875rem" color="gray">{{ profile.email }}</nue-text>
                            </nue-div>
                            <nue-div gap=".75rem">
                                <nue-button
                                    @click="handleSignOut"
                                    icon="arrow-left-more"
                                    theme="small,primary"
                                >
                                    {{ t('settings.signOutButtonText') }}
                                </nue-button>
                                <nue-button
                                    @click="handleDeactive"
                                    icon="delete"
                                    theme="small,danger"
                                >
                                    {{ t('user.deactiveButton') }}
                                </nue-button>
                            </nue-div>
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
                </nue-div>
            </nue-content>
        </nue-main>
        <nue-dialog v-model="visible" ref="dialogRef" :title="t('user.deactiveDialogTitle')">
            <user-deactive :user-use-case="userUseCase" @deactivated="handleDeactivated" />
        </nue-dialog>
    </nue-container>
</template>

<style scoped>
.nue-button--danger {
    --danger-color: 0 72.22% 50.59%;

    color: white;
    background-color: hsl(var(--danger-color));
    border-color: transparent;

    &:hover {
        background-color: hsl(var(--danger-color) / 0.9);
    }

    &:active {
        background-color: hsl(var(--danger-color) / 0.7);
    }
}
</style>
