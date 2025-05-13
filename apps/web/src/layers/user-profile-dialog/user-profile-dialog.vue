<template>
    <nue-dialog v-model="vo.dialogVisible" theme="small" title="用户信息">
        <nue-div gap="1rem">
            <nue-div wrap="nowrap" align="center">
                <nue-div vertical gap="4px" flex="1" style="position: relative">
                    <nue-avatar
                        :src="vo.avatar"
                        size="64px"
                        style="cursor: pointer"
                        rounded
                        @click="handleUpdateAvatar"
                    />
                    <input
                        ref="avatarFileInputRef"
                        type="file"
                        accept="image/*"
                        hidden
                        @change="handleAvatarFileInputChange"
                    />
                    <nue-icon
                        class="update-avatar-loading-icon"
                        v-if="updateAvatarLoading"
                        name="loading"
                        :spin="updateAvatarLoading"
                    />
                </nue-div>
                <nue-div vertical gap="4px" width="75%">
                    <nue-text size="1rem">{{ vo.nickname }}</nue-text>
                    <nue-text size=".875rem" color="#c4c4c4">{{ vo.email }}</nue-text>
                </nue-div>
            </nue-div>
            <nue-divider />
            <nue-div wrap="nowrap" align="center" justify="space-between">
                <nue-div align="center" flex="1">
                    <nue-text color="gray" size="12px">用户 ID</nue-text>
                    <nue-tooltip
                        content="该用户在 NaoTodo 上的唯一标识"
                        placement="right-center"
                        size="small"
                    >
                        <nue-icon color="gray" name="help" size="14px" />
                    </nue-tooltip>
                </nue-div>
                <nue-div align="center" width="75%">
                    <nue-text size="14px">{{ vo.userId }}</nue-text>
                </nue-div>
            </nue-div>
            <nue-div wrap="nowrap" align="center" justify="space-between">
                <nue-text color="gray" size="12px">注册时间</nue-text>
                <nue-div align="center" width="75%">
                    <nue-text size="14px">
                        {{ useMoment(vo.signUpAt).format('YYYY年MM月DD日 HH时mm分') }}
                    </nue-text>
                </nue-div>
            </nue-div>
            <nue-divider />
            <nue-div wrap="nowrap" align="center" justify="space-between">
                <nue-text color="gray" size="12px">用户昵称</nue-text>
                <nue-div align="center" width="calc(75% + 12px)">
                    <nue-input ref="nicknameInputRef" v-model="vo.newNickname" flex="1" />
                </nue-div>
            </nue-div>
            <nue-divider />
            <nue-div justify="end">
                <nue-button theme="noshape" @click="vo.dialogVisible = false">取消</nue-button>
                <nue-button
                    theme="primary"
                    :disabled="!isNew"
                    :loading="vo.updateLoading"
                    @click="handleUpdateNickname"
                >
                    保存修改
                </nue-button>
            </nue-div>
        </nue-div>
    </nue-dialog>
</template>

<script lang="ts" setup>
import { reactive, ref, computed } from 'vue'
import { useUserStore } from '@/stores'
import { NueInput, NueMessage } from 'nue-ui'
import { useMoment } from '@nao-todo/utils'
import type { UserProfileDialogVO } from './types'

defineOptions({ name: 'UserProfileDialog' })

const userStore = useUserStore()

const nicknameInputRef = ref<InstanceType<typeof NueInput>>()
const avatarFileInputRef = ref<HTMLInputElement>()
const vo = reactive<UserProfileDialogVO>({
    avatar: userStore.user?.avatar,
    nickname: userStore.user?.nickname,
    email: userStore.user?.email,
    userId: userStore.user?.id,
    signUpAt: userStore.user?.createdAt.toString(),
    newNickname: userStore.user?.nickname,
    updateLoading: false,
    dialogVisible: false
})
const updateAvatarLoading = ref(false)

const isNew = computed(() => {
    return vo.nickname !== vo.newNickname
})

const handleUpdateNickname = async () => {
    if (!vo.newNickname) {
        NueMessage.error('用户昵称不能为空')
        return
    }
    try {
        const newNickname = vo.newNickname.trim()
        vo.updateLoading = true
        const res = await userStore.doUpdateNickname(newNickname)
        if (res) {
            vo.nickname = newNickname
        }
    } catch (e) {
        console.warn('[UserProfileDialog] handleUpdateNickname error:', e)
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
    updateAvatarLoading.value = true
    const result = await userStore.updateUserAvatar(avatarFileInputRef.value.files?.[0])
    console.log('[UserProfileDialog] handleAvatarFileInputChange', result)
    if (result) vo.avatar = result
    avatarFileInputRef.value.value = ''
    updateAvatarLoading.value = false
}

defineExpose({
    show: () => (vo.dialogVisible = true)
})
</script>

<style scoped>
.update-avatar-loading-icon {
    position: absolute;
    top: calc((64px - 2rem) / 2);
    left: calc((64px - 2rem) / 2);
    --icon-size: 2rem;
    color: #cccccc;
}
</style>
