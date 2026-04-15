<template>
    <nue-div v-if="profile" wrap="nowrap" align="center" gap="2rem">
        <nue-div align="center" width="fit-content">
            <nue-avatar
                :src="profile.avatar"
                size="6rem"
                style="cursor: pointer"
                @click="handleUpdateAvatar"
                theme="round"
            />
            <input
                ref="avatarFileInputRef"
                type="file"
                accept="image/*"
                hidden
                @change="handleAvatarFileInputChange"
            />
        </nue-div>
        <nue-div vertical flex="1">
            <nue-div vertical gap="0.25rem">
                <nue-text size="1.25rem">{{ profile.nickname }}</nue-text>
                <nue-text size=".875rem" color="gray">{{ profile.email }}</nue-text>
            </nue-div>
            <nue-div>
                <nue-button
                    class="update-avatar-button"
                    icon="edit"
                    :loading="updateAvatarLoading"
                    theme="small"
                    use-throttle
                    :throttle-duration="300"
                    @click="handleUpdateAvatar"
                >
                    修改头像
                </nue-button>
                <nue-button @click="handleSignOut" icon="arrow-left-more" theme="small">
                    退出登录
                </nue-button>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { inject, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores'
import type { SettingsViewContext } from '@/views/index/settings/settings-view'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { NueConfirm, NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { useRouter } from 'vue-router'

defineOptions({ name: 'SettingsProfileAvatar' })

const { authUseCase } = inject<SettingsViewContext>(SETTINGS_VIEW_CONTEXT_KEY)!
const userStore = useUserStore()
const router = useRouter()

const { profile } = storeToRefs(userStore)
const avatarFileInputRef = ref<HTMLInputElement>()
const updateAvatarLoading = ref(false)

const handleUpdateAvatar = () => {
    if (!avatarFileInputRef.value) return
    avatarFileInputRef.value.click()
}

const handleAvatarFileInputChange = async () => {
    if (!avatarFileInputRef.value) return
    console.log(avatarFileInputRef.value.files?.[0])
    avatarFileInputRef.value.value = ''
}

const handleSignOut = async () => {
    const [isByCancel] = await NueConfirm({
        title: '确认退出登录吗？',
        content: '退出登录后，您需要重新登录才能继续使用应用。',
        confirmButtonText: '退出登录',
        cancelButtonText: '取消',
        // overlayAnimation: 'fade-in-with-blur',
        // overlayCloseAnimation: 'fade-out-with-blur'
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
</script>

