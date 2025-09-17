<template>
    <nue-div wrap="nowrap" align="center" gap="2rem">
        <nue-div align="center" width="fit-content">
            <nue-avatar
                :src="profileVO.avatar"
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
                <nue-text size="1.25rem">{{ profileVO.nickname }}</nue-text>
                <nue-text size=".875rem" color="gray">{{ profileVO.email }}</nue-text>
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
                <nue-button
                    @click="profileStore.handleSignout"
                    icon="arrow-left-more"
                    theme="small"
                >
                    退出登录
                </nue-button>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import useProfileStore from './use-profile-store'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'SettingsProfileAvatar' })

const profileStore = useProfileStore()

const avatarFileInputRef = ref<HTMLInputElement>()
const updateAvatarLoading = ref(false)
const { profileVO } = storeToRefs(profileStore)

const handleUpdateAvatar = () => {
    if (!avatarFileInputRef.value) return
    avatarFileInputRef.value.click()
}

const handleAvatarFileInputChange = async () => {
    if (!avatarFileInputRef.value) return
    await profileStore.handleUpdateAvatar(avatarFileInputRef.value.files?.[0])
    avatarFileInputRef.value.value = ''
}
</script>
