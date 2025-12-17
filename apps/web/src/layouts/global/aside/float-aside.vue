<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useViewStore, useUserStoreV2 } from '@/stores/global'
import { GlobalAsideNavItems } from '@/stores/global/constants'
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
        open-from="left"
        theme="float-aside"
        allow-close-by-overlay
    >
        <nue-container id="AppAsideContainer">
            <nue-header>
                <nue-div align="center">
                    <nue-avatar :src="user?.avatar" size="2rem" />
                    <nue-text>{{ user?.nickname }}</nue-text>
                </nue-div>
            </nue-header>
            <nue-main>
                <nue-content>
                    <slot>
                        <nue-empty />
                    </slot>
                </nue-content>
            </nue-main>
            <nue-footer>
                <slot name="footer">
                    <nue-div justify="space-between" gap="0" width="100%">
                        <nao-router-link
                            v-for="(rl, idx) in GlobalAsideNavItems"
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
.nue-drawer.nue-drawer--float-aside {
    --nue-drawer-span: min(100%, 256px);
    --nue-drawer-min-span: 240px;

    .nue-drawer__header {
        display: none;
        /* height: auto;
        padding-top: var(--nue-padding-sm);
        padding-bottom: var(--nue-padding-sm);  */
    }

    #AppAsideContainer > .nue-main > .nue-content {
        display: flex;
        flex-direction: column;
        padding: 1rem;
    }
}
</style>

