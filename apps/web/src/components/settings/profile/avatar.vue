<template>
    <nue-div v-if="profile" wrap="wrap" align="center" gap="2rem">
        <nue-div align="center" width="fit-content">
            <nue-avatar
                :src="fullAvatarUrl"
                size="8rem"
                style="cursor: pointer"
                @click="handleViewAvatar"
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
                    {{ t('settings.updateAvatarButtonText') }}
                </nue-button>
                <nue-button @click="handleSignOut" icon="arrow-left-more" theme="small">
                    {{ t('settings.signOutButtonText') }}
                </nue-button>
            </nue-div>
        </nue-div>
        <settings-profile-avatar-cropper-dialog
            v-model="cropperDialogVisible"
            :file="selectedFile"
            @success="handleCropperSuccess"
        />
        <settings-profile-avatar-viewer-dialog
            v-model="viewerDialogVisible"
            :avatar-url="fullAvatarUrl"
        />
    </nue-div>
</template>

<script setup lang="ts">
import { inject, ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores'
import type { SettingsViewContext } from '@/views/index/settings/settings-view'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { NueConfirm, NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { useRouter } from 'vue-router'
import SettingsProfileAvatarCropperDialog from './avatar-cropper-dialog.vue'
import SettingsProfileAvatarViewerDialog from './avatar-viewer-dialog.vue'
import { t } from '@nao-todo/infrastructure/locales'

defineOptions({ name: 'SettingsProfileAvatar' })

const { authUseCase, userUseCase } = inject<SettingsViewContext>(SETTINGS_VIEW_CONTEXT_KEY)!
const userStore = useUserStore()
const router = useRouter()

const { profile } = storeToRefs(userStore)
const avatarFileInputRef = ref<HTMLInputElement>()
const updateAvatarLoading = ref(false)
const cropperDialogVisible = ref(false)
const viewerDialogVisible = ref(false)
const selectedFile = ref<File | null>(null)

const fullAvatarUrl = computed(() => {
    const url = profile.value?.avatar
    if (!url) return ''
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url
    }
    return `http://localhost:3302${url}`
})

const handleViewAvatar = () => {
    viewerDialogVisible.value = true
}

const handleUpdateAvatar = () => {
    if (!avatarFileInputRef.value) return
    avatarFileInputRef.value.click()
}

const handleAvatarFileInputChange = async () => {
    if (!avatarFileInputRef.value?.files?.[0]) return

    selectedFile.value = avatarFileInputRef.value.files[0]
    avatarFileInputRef.value.value = ''
    cropperDialogVisible.value = true
}

const handleCropperSuccess = async (file: File) => {
    updateAvatarLoading.value = true
    try {
        const [, err] = await userUseCase.updateAvatarFile(file)
        if (err !== null) {
            NueMessage.error('上传失败: ' + unwrapError(err as any))
            return
        }
        NueMessage.success('头像更新成功')
    } catch (err) {
        NueMessage.error('上传失败: ' + unwrapError(err as any))
    } finally {
        updateAvatarLoading.value = false
        selectedFile.value = null
    }
}

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
</script>

