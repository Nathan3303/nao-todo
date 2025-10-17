<template>
    <nue-container>
        <nue-header>基本信息修改</nue-header>
        <nue-main>
            <nue-content>
                <nue-div vertical gap=".5rem">
                    <nue-div class="settings-view__form-row">
                        <nue-text color="gray" size="var(--nue-text-sm)">用户昵称</nue-text>
                        <nue-text color="#999" size=".75rem">
                            昵称会在任务创建者、分配者、项目成员等区块中展示，你可以随时修改。
                        </nue-text>
                        <nue-div align="center">
                            <nue-input v-model="profileVO.newNickname" />
                            <nue-button
                                icon="check"
                                theme="icon,primary"
                                :disabled="!isNicknameChanged"
                                :loading="profileVO.loading.nickname"
                                @click="profileStore.handleUpdateNickname"
                            />
                        </nue-div>
                    </nue-div>
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { NueInput } from 'nue-ui'
import { useProfileStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'SettingsProfileNickname' })

const profileStore = useProfileStore()

const { profileVO, isNicknameChanged } = storeToRefs(profileStore)
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
