<template>
    <nue-drawer
        v-model:visible="viewStore.indexAsideVisible"
        class="nue-drawer--no-header"
        min-span="240px"
        open-from="left"
        span="260px"
    >
        <nue-container class="index-aside" theme="vertical,inner">
            <nue-header height="70px">
                <user-dropdown
                    :user="user"
                    is-on-mobile
                    placement="bottom-start"
                    style="width: 100%"
                    @logout="userStore.signOutWithConfirmation"
                    @show-profile="indexViewCtx?.dialogsRef.userProfile.value?.show"
                    @update-passwd="indexViewCtx?.dialogsRef.updatePassword.value?.show"
                />
            </nue-header>
            <nue-main>
                <slot>
                    <nue-empty />
                </slot>
            </nue-main>
            <nue-footer>
                <slot name="footer">
                    <nue-div wrap="nowrap" justify="space-around">
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
                </slot>
            </nue-footer>
        </nue-container>
    </nue-drawer>
</template>

<script lang="ts" setup>
import { inject } from 'vue'
import { UserDropdown } from '@nao-todo/components'
import { useUserStore, useViewStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { onBeforeRouteUpdate } from 'vue-router'
import { type IndexViewCtx, IndexViewCtxKey } from '@nao-todo/types/views/index-view'

const userStore = useUserStore()
const viewStore = useViewStore()

const indexViewCtx = inject<IndexViewCtx>(IndexViewCtxKey)

const { user } = storeToRefs(userStore)

const routeLinks = [
    { name: '任务', icon: 'square-check-fill', route: '/tasks' },
    { name: '日历视图', icon: 'calendar', route: '/calendar' },
    { name: '番茄专注', icon: 'focus2', route: '/fqfocus' },
    { name: '搜索', icon: 'search2', route: '/search' },
    { name: '对话大模型', icon: 'ai-chat-fill', route: '/ai' }
]

onBeforeRouteUpdate((to, from, next) => {
    next()
    setTimeout(() => (viewStore.indexAsideVisible = false), 128)
})
</script>

<style scoped>
.index-aside:deep(.nue-main__content) {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    overflow-y: auto;
    padding: 16px;
    gap: 8px;
}
</style>
