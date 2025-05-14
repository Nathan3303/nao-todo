<template>
    <nue-div vertical>
        <nue-text theme="h4">更多操作</nue-text>
        <nue-div vertical>
            <nue-div class="settings-view__form-row">
                <nue-text color="gray" size=".875rem">用户 ID</nue-text>
                <nue-text color="#999" size=".75rem">该用户在 NaoTodo 上的唯一标识</nue-text>
                <nue-text size="14px">{{ userStore.user?.id }}</nue-text>
            </nue-div>
            <nue-div class="settings-view__form-row">
                <nue-text color="gray" size=".875rem">注册时间</nue-text>
                <nue-text size=".875rem">
                    注册于
                    {{ useMoment(userStore.user?.createdAt).format('YYYY年MM月DD日 HH时mm分') }}
                </nue-text>
            </nue-div>
            <nue-div style="margin-top: 0.5rem">
                <nue-button theme="error">注销该账户</nue-button>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { useMoment } from '@nao-todo/utils'
import { useUserStore } from '@/stores'
const userStore = useUserStore()
</script>

<style scoped>
/* .form-row {
    gap: 0.5rem;
    flex-direction: column;
} */
</style>
