<template>
    <nue-container>
        <nue-header>修改用户昵称</nue-header>
        <nue-main>
            <nue-content v-if="profile">
                <nue-div vertical gap=".5rem">
                    <nue-div class="settings-view__form-row">
                        <nue-text color="#999" size=".75rem">
                            昵称会在任务创建者、分配者、项目成员等区块中展示，你可以随时修改。
                        </nue-text>
                        <nue-div align="center">
                            <nue-input
                                v-model="inputValue"
                                placeholder="请输入昵称（2-16个字符）"
                                maxlength="16"
                            />
                            <nue-button
                                theme="primary"
                                :disabled="!isNicknameChanged"
                                :loading="loading"
                                @click="handleUpdateNickname"
                            >
                                修改
                            </nue-button>
                        </nue-div>
                    </nue-div>
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { NueInput } from 'nue-ui'
import { useUserStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { computed, inject, ref } from 'vue'
import type { SettingsViewContext } from '@/views/index/settings/settings-view'
import { SETTINGS_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'

defineOptions({ name: 'SettingsProfileNickname' })

const { userUseCase } = inject<SettingsViewContext>(SETTINGS_VIEW_CONTEXT_KEY)!

const userStore = useUserStore()

const { profile } = storeToRefs(userStore)
const inputValue = ref(profile.value?.nickname || '')
const loading = ref<boolean>(false)

const isNicknameChanged = computed(() => inputValue.value !== profile.value?.nickname)

const handleUpdateNickname = async () => {
    loading.value = true
    const err = await userUseCase.updateNickname({ nickname: inputValue.value })
    loading.value = false
    if (err !== null) {
        return
    }
}
</script>

<style scoped>
.nue-container {
    > .nue-header,
    > .nue-main {
        height: auto;
        padding: 0.875rem 0;
    }
}
</style>

