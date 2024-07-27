<template>
    <nue-dropdown trigger="hover" align="right">
        <nue-avatar :src="userAvatarUrl"></nue-avatar>
        <template #dropdown v-if="user">
            <nue-div vertical align="center" justify="center" width="240px" gap="32px">
                <nue-div vertical align="center">
                    <nue-avatar :src="userAvatarUrl" size="64px"></nue-avatar>
                    <nue-text> {{ user?.nickName }} </nue-text>
                </nue-div>
                <nue-div vertical align="stretch" gap="8px">
                    <nue-link theme="btnlike" disabled>个人信息</nue-link>
                    <nue-link theme="btnlike" disabled>设置</nue-link>
                    <nue-divider></nue-divider>
                    <nue-link theme="btnlike" @click="emit('logout', user?.id)">退出登录</nue-link>
                </nue-div>
            </nue-div>
        </template>
    </nue-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { UserDropdownProps, UserDropdownEmits } from './types'

defineOptions({ name: 'UserDropdown' })
const props = defineProps<UserDropdownProps>()
const emit = defineEmits<UserDropdownEmits>()

const userAvatarUrl = computed(() => {
    return (
        props.user?.avatarUrl ||
        'https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80'
    )
})
</script>

<style scoped></style>
