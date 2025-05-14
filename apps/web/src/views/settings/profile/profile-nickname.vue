<template>
    <nue-div vertical>
        <nue-text theme="h4">基本信息修改</nue-text>
        <nue-div vertical>
            <nue-div class="settings-view__form-row">
                <nue-text color="gray" size=".875rem">用户昵称</nue-text>
                <nue-text color="#999" size=".75rem">
                    昵称会在任务创建者、分配者、项目成员等区块中展示，你可以随时修改。
                </nue-text>
                <nue-div align="center">
                    <nue-input ref="nicknameInputRef" v-model="vo.newNickname" flex="1" />
                </nue-div>
            </nue-div>
        </nue-div>
        <nue-div style="margin-top: 0.5rem">
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
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useUserStore } from '@/stores'
import { NueInput, NueMessage } from 'nue-ui'
import type { UserProfileDialogVO } from './types'

defineOptions({ name: 'SettingsProfile' })

const userStore = useUserStore()

const nicknameInputRef = ref<InstanceType<typeof NueInput>>()
const vo = reactive<UserProfileDialogVO>({
    nickname: computed(() => userStore.user?.nickname),
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
</script>

<style scoped>
/* .form-row {
    gap: 0.5rem;
    flex-direction: column;
} */
</style>
