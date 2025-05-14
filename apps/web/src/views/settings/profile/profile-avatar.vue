<template>
    <nue-div wrap="nowrap" align="center">
        <nue-div class="update-avatar-container">
            <nue-avatar
                :src="vo.avatar"
                size="6rem"
                style="cursor: pointer"
                @click="handleUpdateAvatar"
                rounded
            />
            <input
                ref="avatarFileInputRef"
                type="file"
                accept="image/*"
                hidden
                @change="handleAvatarFileInputChange"
            />
            <nue-button
                class="update-avatar-button"
                icon="edit"
                :loading="updateAvatarLoading"
                theme="small"
                use-throttle
                :throttle-duration="300"
                @click="handleUpdateAvatar"
            >
                修改
            </nue-button>
        </nue-div>
        <nue-div vertical gap="4px" width="75%">
            <nue-text size="1rem">{{ vo.nickname }}</nue-text>
            <nue-text size=".875rem" color="#c4c4c4">{{ vo.email }}</nue-text>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useUserStore } from '@/stores'
import type { UserProfileDialogVO } from './types'

defineOptions({ name: 'SettingsProfile' })

const userStore = useUserStore()

const avatarFileInputRef = ref<HTMLInputElement>()
const updateAvatarLoading = ref(false)
const vo = reactive<UserProfileDialogVO>({
    avatar: userStore.user?.avatar,
    email: userStore.user?.email,
    nickname: computed(() => userStore.user?.nickname)
})

const handleUpdateAvatar = () => {
    if (!avatarFileInputRef.value) return
    avatarFileInputRef.value.click()
}

const handleAvatarFileInputChange = async () => {
    if (!avatarFileInputRef.value) return
    try {
        updateAvatarLoading.value = true
        const result = await userStore.updateUserAvatar(avatarFileInputRef.value.files?.[0])
        if (result) vo.avatar = result + '?t=' + Date.now()
    } catch (e) {
        console.warn('[SettingsProfile] handleAvatarFileInputChange error:', e)
    } finally {
        avatarFileInputRef.value.value = ''
        updateAvatarLoading.value = false
    }
}
</script>

<style scoped>
.update-avatar-container {
    flex-direction: column;
    gap: 0.25rem;
    position: relative;
    width: 6rem;
    margin-right: 2rem;
}

.update-avatar-button {
    position: absolute;
    bottom: 0;
    left: 64%;
    background-color: white;
}
</style>
