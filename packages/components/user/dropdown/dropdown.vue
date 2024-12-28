<template>
    <nue-dropdown hide-on-click theme="user-dropdown">
        <template #default="{ clickTrigger }">
            <nue-div v-if="isOnMobile" align="center" @click="clickTrigger">
                <nue-avatar :src="user?.avatar" style="cursor: pointer" />
                <nue-text :clamped="1" size="var(--text-sm)">{{ user?.nickname }}</nue-text>
                <nue-icon name="select" size="var(--text-sm)" style="margin-left: auto" />
            </nue-div>
            <nue-avatar v-else :src="user?.avatar" style="cursor: pointer" @click="clickTrigger" />
        </template>
        <template v-if="user" #dropdown>
            <nue-div
                :width="isOnMobile ? '200px' : '256px'"
                align="center"
                gap="32px"
                justify="center"
                vertical
            >
                <nue-div v-if="!isOnMobile" align="center" style="margin-top: 32px" vertical>
                    <nue-avatar :src="user?.avatar" size="64px" />
                    <nue-text>{{ user?.nickname || '' }}</nue-text>
                </nue-div>
                <nue-div align="stretch" gap="8px" vertical>
                    <nue-button theme="noshape" @click="emit('showProfile')">用户信息</nue-button>
                    <nue-button theme="noshape" @click="emit('updatePasswd')">修改密码</nue-button>
                    <nue-divider />
                    <nue-button theme="noshape" @click="emit('logout', user?.id)">
                        退出登录
                    </nue-button>
                </nue-div>
            </nue-div>
        </template>
    </nue-dropdown>
</template>

<script lang="ts" setup>
defineOptions({ name: 'UserDropdown' })
defineProps<{
    user?: {
        id: string
        nickname: string
        avatar: string
    }
    isOnMobile?: boolean
}>()
const emit = defineEmits<{
    (event: 'logout', id?: string): void
    (event: 'showProfile'): void
    (event: 'updatePasswd'): void
}>()
</script>

<style scoped>
.nue-button--noshape {
    border: none;
    box-shadow: none;
    --hover-background-color: var(--primary-color-300);
}
</style>
