<template>
    <nue-div vertical>
        <nue-text size="var(--nue-text-df)" :weight="500">更多信息</nue-text>
        <nue-div vertical>
            <nue-div class="settings-view__form-row">
                <nue-text color="gray" size=".875rem">用户 ID</nue-text>
                <nue-text color="#999" size=".75rem">该用户在 NaoTodo 上的唯一标识</nue-text>
                <nue-text size="14px">{{ profileVO.id }}</nue-text>
            </nue-div>
            <nue-div class="settings-view__form-row">
                <nue-text color="gray" size=".875rem">注册时间</nue-text>
                <nue-text size=".875rem">
                    {{ profileVO.createdAt }}
                </nue-text>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { useProfileStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'SettingsProfileInfo' })

const profileStore = useProfileStore()

const { profileVO } = storeToRefs(profileStore)
</script>

<style scoped></style>
