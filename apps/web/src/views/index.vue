<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useViewStore } from '@/stores'
import { useUserStoreV2 } from '@/stores/global'
import { NaoRouterLink } from '@/components/ui'
import { NueContainer } from 'nue-ui'

const userStore = useUserStoreV2()
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

<template>
    <nue-container id="AppContainer">
        <nue-main>
            <nue-aside>
                <nue-div vertical align="center" gap="2rem">
                    <nue-avatar
                        :src="user?.avatar"
                        style="cursor: pointer"
                        @click="$router.push('/settings/profile')"
                    />
                    <nue-div vertical align="center" gap="1.5rem">
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
                <suspense>
                    <router-view />
                    <template #fallback> Loading ... </template>
                </suspense>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
.nue-container#AppContainer {
    > .nue-main .nue-aside {
        align-items: center;
        width: 70px;
        min-width: 70px;
        max-width: 70px;
    }
}
</style>
