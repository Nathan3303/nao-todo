<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useUserStoreV2, useViewStore } from '@/stores/global'
import { NaoRouterLink } from '@/components/ui'
import { UpdateIndicator } from '@nao-todo/components'
import { GlobalAsideNavItems } from '@/stores/global/constants'

defineOptions({ name: 'GlobalAside' })

const userStore = useUserStoreV2()
const viewStore = useViewStore()

const { user } = storeToRefs(userStore)
const { appAsideStates, hasUpdateTasksInQueue, updateTasksQueueCount } = storeToRefs(viewStore)
</script>

<template>
    <nue-aside v-if="!appAsideStates.floating">
        <nue-div theme="aside-wrapper">
            <nue-tooltip
                placement="right-center"
                size="small"
                :content="`你好👋，${user?.nickname}！`"
            >
                <nue-avatar :src="user?.avatar" size="2.5rem" />
            </nue-tooltip>
            <nue-div theme="aside__navs">
                <nue-tooltip
                    v-for="(rl, idx) in GlobalAsideNavItems"
                    :key="idx"
                    :content="rl.name"
                    placement="right-center"
                    size="small"
                >
                    <nao-router-link :icon="rl.icon" :route="rl.route" icon-link />
                </nue-tooltip>
            </nue-div>
            <nue-div theme="aside__actions">
                <update-indicator
                    :updating="hasUpdateTasksInQueue"
                    :count="updateTasksQueueCount"
                />
            </nue-div>
        </nue-div>
    </nue-aside>
</template>

<style scoped>
.nue-div.nue-div--aside-wrapper {
    flex-direction: column;
    align-items: center;
    gap: 2rem;
    height: 100%;

    .nue-div.nue-div--aside__navs {
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
        flex: auto;
    }

    .nue-div.nue-div--aside__actions {
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
    }
}
</style>

