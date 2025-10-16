<script lang="ts" setup>
import { computed } from 'vue'
import { useViewStore, useUserStoreV2 } from '@/stores/global'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'
import { GlobalAsideRouteLinks } from './constants'
import { NaoRouterLink } from '@/components/ui'
import type { NueDrawer } from 'nue-ui'

defineOptions({ name: 'IndexAside' })

const viewStore = useViewStore()
const userStore = useUserStoreV2()

const { appAsideStates } = storeToRefs(viewStore)
const { user } = storeToRefs(userStore)
const drawerRef = ref<InstanceType<typeof NueDrawer>>()

const visible = computed({
    get: () => appAsideStates.value.visible,
    set: (newVisible) => {
        appAsideStates.value.visible = newVisible
    }
})
</script>

<template>
    <nue-drawer
        v-model="visible"
        ref="drawerRef"
        min-span="240px"
        span="min(100%, 256px)"
        open-from="left"
        theme="outline"
        allow-close-by-overlay
    >
        <nue-container id="AppAsideContainer">
            <nue-header>
                <nue-div align="center">
                    <nue-avatar :src="user?.avatar" />
                    <nue-text>{{ user?.nickname }}</nue-text>
                </nue-div>
            </nue-header>
            <nue-main>
                <slot>
                    <nue-empty />
                </slot>
            </nue-main>
            <nue-footer>
                <slot name="footer">
                    <nue-div wrap="nowrap" justify="space-between" gap="0">
                        <nao-router-link
                            v-for="(rl, idx) in GlobalAsideRouteLinks"
                            :key="idx"
                            :icon="rl.icon"
                            :route="rl.route"
                            icon-link
                            style="width: auto"
                        />
                    </nue-div>
                </slot>
            </nue-footer>
        </nue-container>
    </nue-drawer>
</template>

<style>
.nue-drawer--outline {
    .nue-drawer__header {
        display: none;
    }
}
</style>
