<template>
    <nue-dropdown theme="user-dropdown" hide-on-click>
        <template #default="{ clickTrigger }">
            <nue-avatar :src="user?.avatar" style="cursor: pointer" @click.stop="clickTrigger" />
        </template>
        <template v-if="user" #dropdown>
            <nue-div align="center" gap="32px" justify="center" vertical width="240px">
                <nue-div align="center" style="margin-top: 32px" vertical>
                    <nue-avatar :src="user?.avatar" size="64px" />
                    <nue-text>{{ user?.nickname || '' }}</nue-text>
                </nue-div>
                <nue-div align="stretch" gap="8px" vertical>
                    <nue-button style="border: none;" @click="emit('showProfile')">个人信息</nue-button>
                    <nue-divider />
                    <nue-link theme="btnlike" @click="emit('logout', user?.id)">
                        退出登录
                    </nue-link>
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
}>()
const emit = defineEmits<{
    (event: 'logout', id?: string): void
    (event: 'showProfile'): void
}>()
</script>
