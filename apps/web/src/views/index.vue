<template>
    <nue-container class="ntd-container">
        <nue-main>
            <nue-aside
                v-if="viewStore.indexHeaderVisible"
                width="70px"
                min-width="70px"
                max-width="70px"
            >
                <nue-div vertical align="center" gap="2rem">
                    <nue-avatar
                        :src="user?.avatar"
                        style="cursor: pointer"
                        @click="$router.push('/settings/profile')"
                    />
                    <nue-div vertical align="center">
                        <nue-tooltip
                            v-for="(rl, idx) in routeLinks"
                            :key="idx"
                            :content="rl.name"
                            placement="right-center"
                            size="small"
                        >
                            <nao-router-link :icon="rl.icon" :route="rl.route" icon-link />
                        </nue-tooltip>
                    </nue-div>
                </nue-div>
            </nue-aside>
            <nue-content fill style="overflow: hidden">
                <router-view />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useUserStore, useViewStore } from '@/stores'
import { NaoRouterLink } from '@/components/ui'

const userStore = useUserStore()
const viewStore = useViewStore()

await viewStore.indexViewInitTask()

const { user } = storeToRefs(userStore)

const routeLinks = [
    { name: '任务', icon: 'square-check-fill', route: '/tasks' },
    { name: '日历', icon: 'calendar', route: '/calendar' },
    { name: '专注', icon: 'focus2', route: '/fqfocus' },
    { name: '搜索', icon: 'search2', route: '/search' },
    { name: '对话', icon: 'ai-chat-fill', route: '/ai' },
    { name: '设置', icon: 'settings-fill', route: '/settings' }
]
</script>
