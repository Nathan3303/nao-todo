<script setup lang="ts">
import { t, unwrapError } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useUserStore } from '../../stores'
import { UserAvatarCropperDialog, UserAvatarViewerDialog } from '../dialogs'
import { UserAvatarUpdaterProps } from './types.js'

defineOptions({ name: 'UserAvatarUpdater' })
const props = defineProps<UserAvatarUpdaterProps>()

const userStore = useUserStore()

const { profile } = storeToRefs(userStore)
const avatarFileInputRef = ref<HTMLInputElement>()
const updateAvatarLoading = ref(false)
const cropperDialogVisible = ref(false)
const viewerDialogVisible = ref(false)
const selectedFile = ref<File | null>(null)

const fullAvatarUrl = computed(() => {
    const url = profile.value?.avatar
    if (!url) return ''
    return url
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

const handleCropperSuccess = (file: File) => {
    updateAvatarLoading.value = true
    props.userUseCase
        .updateAvatarFile(file)
        .then(([, err]) => {
            if (err !== null) {
                NueMessage.error('上传失败: ' + unwrapError(err as any))
                return
            }
            NueMessage.success('头像更新成功')
        })
        .finally(() => {
            updateAvatarLoading.value = false
            selectedFile.value = null
        })
}
</script>

<template>
    <nue-div theme="avatar-updater">
        <nue-div align="center" width="fit-content">
            <nue-avatar
                :src="fullAvatarUrl"
                icon="user"
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
            <nue-button
                icon="edit"
                :loading="updateAvatarLoading"
                theme="icon,updater,round"
                use-throttle
                :throttle-duration="300"
                @click="handleUpdateAvatar"
            >
                {{ t('settings.updateAvatarButtonText') }}
            </nue-button>
        </nue-div>
        <slot></slot>
        <user-avatar-cropper-dialog
            v-model="cropperDialogVisible"
            :file="selectedFile"
            @success="handleCropperSuccess"
        />
        <user-avatar-viewer-dialog v-model="viewerDialogVisible" :avatar-url="fullAvatarUrl" />
    </nue-div>
</template>

<style scoped>
.nue-div--avatar-updater {
    display: flex;
    align-items: center;
    gap: 2rem;

    .nue-div {
        position: relative;

        .nue-button--updater {
            position: absolute;
            bottom: 0px;
            left: 70%;
        }
    }
}
</style>
