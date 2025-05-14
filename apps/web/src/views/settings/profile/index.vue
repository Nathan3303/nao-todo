<template>
    <nue-container theme="vertical,inner">
        <nue-header>
            <nue-text>设置 - 用户信息</nue-text>
        </nue-header>
        <nue-main>
            <nue-div vertical gap="1rem">
                <nue-div wrap="nowrap" align="center">
                    <nue-div vertical gap="4px" flex="1" style="position: relative">
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
                <nue-divider />
                <nue-div wrap="nowrap" align="center" justify="space-between">
                    <nue-text color="gray" size=".875rem">用户昵称</nue-text>
                    <nue-div align="center" width="calc(75% + 12px)">
                        <nue-input ref="nicknameInputRef" v-model="vo.newNickname" flex="1" />
                    </nue-div>
                </nue-div>
                <nue-divider />
                <nue-div>
                    <nue-button
                        theme="primary"
                        :disabled="!isNew"
                        :loading="vo.updateLoading"
                        @click="handleUpdateNickname"
                    >
                        更新用户信息
                    </nue-button>
                </nue-div>
            </nue-div>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useUserStore } from '@/stores'
import { NueInput, NueMessage } from 'nue-ui'
import type { UserProfileDialogVO } from './types'

defineOptions({ name: 'SettingsProfile' })

const userStore = useUserStore()

const nicknameInputRef = ref<InstanceType<typeof NueInput>>()
const avatarFileInputRef = ref<HTMLInputElement>()
const updateAvatarLoading = ref(false)
const vo = reactive<UserProfileDialogVO>({
    avatar: userStore.user?.avatar,
    nickname: userStore.user?.nickname,
    email: userStore.user?.email,
    userId: userStore.user?.id,
    signUpAt: userStore.user?.createdAt.toString(),
    newNickname: userStore.user?.nickname,
    updateLoading: false
})

const isNew = computed(() => vo.nickname !== vo.newNickname)

const handleUpdateNickname = async () => {
    if (!vo.newNickname) {
        NueMessage.error('用户昵称不能为空')
        return
    }
    try {
        const newNickname = vo.newNickname.trim()
        vo.updateLoading = true
        const res = await userStore.doUpdateNickname(newNickname)
        if (res) vo.nickname = newNickname
    } catch (e) {
        console.warn('[SettingsProfile] handleUpdateNickname error:', e)
    } finally {
        vo.updateLoading = false
    }
}

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
.update-avatar-button {
    position: absolute;
    bottom: 0;
    right: 1rem;
    background-color: white;
}
</style>
