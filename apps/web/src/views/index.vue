<template>
    <nue-container class="index-view" theme="horizontal">
        <nue-header v-if="viewStore.indexHeaderVisible" class="index-view__header">
            <template #logo>
                <nue-tooltip size="small" :content="`你好👋，${user?.nickname}`" placement="right-center">
                    <nue-avatar
                        :src="user?.avatar"
                        style="cursor: pointer"
                        @click="$router.push('/settings/profile')"
                    />
                </nue-tooltip>
            </template>
            <template #navigators>
                <nue-div vertical gap="24px">
                    <nue-tooltip
                        v-for="(rl, idx) in routeLinks"
                        :key="idx"
                        :content="rl.name"
                        placement="right-center"
                        size="small"
                    >
                        <nue-link :icon="rl.icon" :route="rl.route" theme="index-header-link" />
                    </nue-tooltip>
                </nue-div>
            </template>
        </nue-header>
        <nue-main class="index-view__main">
            <router-view></router-view>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { provide, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { UpdatePasswordDialog } from '@/layers'
import { useUserStore, useViewStore } from '@/stores'
import { UserProfileDialog } from '@/layers/user-profile-dialog'
import { type IndexViewCtx, IndexViewCtxKey } from '@nao-todo/types/views/index-view'

const userStore = useUserStore()
const viewStore = useViewStore()

await viewStore.indexViewInitTask()

const { user } = storeToRefs(userStore)
const userProfileDialogRef = ref<InstanceType<typeof UserProfileDialog>>()
const updatePasswordDialogRef = ref<InstanceType<typeof UpdatePasswordDialog>>()

const routeLinks = [
    { name: '任务', icon: 'square-check-fill', route: '/tasks' },
    { name: '日历', icon: 'calendar', route: '/calendar' },
    { name: '专注', icon: 'focus2', route: '/fqfocus' },
    { name: '搜索', icon: 'search2', route: '/search' },
    { name: '对话', icon: 'ai-chat-fill', route: '/ai' },
    { name: '设置', icon: 'settings-fill', route: '/settings' }
]

provide<IndexViewCtx>(IndexViewCtxKey, {
    dialogsRef: {
        userProfile: userProfileDialogRef,
        updatePassword: updatePasswordDialogRef
    }
})
</script>

<style scoped>
.index-view__header__logo {
    width: 24px;
    height: 24px;
}

.index-view__main {
    border-left: 1px solid var(--divider-color);
}

.index-view__main .nue-main__content {
    padding: 0;
}
</style>
