<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useUserStoreV2, useViewStore } from '@/stores/global'
import { NaoRouterLink } from '@/components/ui'
import { GlobalAsideRouteLinks } from './constants'

defineOptions({ name: 'GlobalAside' })

const userStore = useUserStoreV2()
const viewStore = useViewStore()

const { user } = storeToRefs(userStore)
const { appAsideStates } = storeToRefs(viewStore)
</script>

<template>
    <nue-aside v-if="!appAsideStates.floating">
        <nue-div vertical align="center" gap="2rem">
            <nue-tooltip
                placement="right-center"
                size="small"
                :content="`你好👋，${user?.nickname}！`"
            >
                <nue-avatar
                    :src="user?.avatar"
                    style="cursor: pointer"
                    @click="$router.push('/settings/profile')"
                />
            </nue-tooltip>
            <nue-div vertical align="center" gap="1.5rem">
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
        </nue-div>
    </nue-aside>
</template>

<style scoped></style>
