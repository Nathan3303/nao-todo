<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useUserStoreV2, useViewStore } from '@/stores/global'
import { NaoRouterLink } from '@/components/ui'
import { UpdateIndicator } from '@nao-todo/components'
import { GlobalAsideRouteLinks } from './constants'

defineOptions({ name: 'GlobalAside' })

const userStore = useUserStoreV2()
const viewStore = useViewStore()

const { user } = storeToRefs(userStore)
const { appAsideStates, hasUpdateTasksInQueue, updateTasksQueueCount } = storeToRefs(viewStore)
</script>

<template>
    <nue-aside v-if="!appAsideStates.floating">
        <nue-div vertical align="center" gap="2rem" height="100%">
            <nue-tooltip
                placement="right-center"
                size="small"
                :content="`你好👋，${user?.nickname}！`"
            >
                <nue-avatar :src="user?.avatar" size="2.5rem" />
            </nue-tooltip>
            <nue-div vertical align="center" gap="1.5rem" flex="1">
                <nue-tooltip
                    v-for="(rl, idx) in GlobalAsideRouteLinks"
                    :key="idx"
                    :content="rl.name"
                    placement="right-center"
                    size="small"
                >
                    <nao-router-link :icon="rl.icon" :route="rl.route" icon-link />
                </nue-tooltip>
            </nue-div>
            <nue-div vertical align="center" gap="2rem">
                <update-indicator
                    :updating="hasUpdateTasksInQueue"
                    :count="updateTasksQueueCount"
                />
            </nue-div>
        </nue-div>
    </nue-aside>
</template>
