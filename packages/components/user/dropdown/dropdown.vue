<template>
    <nue-dropdown theme="user-dropdown">
        <template #default="{ clickTrigger }">
            <nue-avatar :src="userAvatarUrl" @click.stop="clickTrigger" style="cursor: pointer" />
        </template>
        <template #dropdown v-if="user">
            <nue-div vertical align="center" justify="center" width="240px" gap="32px">
                <nue-div vertical align="center" style="margin-top: 32px">
                    <nue-avatar :src="userAvatarUrl" size="64px" />
                    <nue-text>{{ user?.nickname }}</nue-text>
                </nue-div>
                <nue-div vertical align="stretch" gap="8px">
                    <nue-link theme="btnlike" disabled>个人信息</nue-link>
                    <nue-link theme="btnlike" disabled>设置</nue-link>
                    <nue-divider />
                    <nue-link theme="btnlike" @click="emit('logout', user?.id)">
                        退出登录
                    </nue-link>
                </nue-div>
            </nue-div>
        </template>
    </nue-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '@nao-todo/types'

defineOptions({ name: 'UserDropdown' })
const props = defineProps<{
    user?: {
        id: string
        nickname: string
        avatarUrl?: string
    }
}>()
const emit = defineEmits<{
    (event: 'logout', id?: User['id']): void
}>()

const userAvatarUrl = computed(() => {
    return (
        props.user?.avatarUrl ||
        'https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80'
    )
})
</script>

<style scoped></style>
