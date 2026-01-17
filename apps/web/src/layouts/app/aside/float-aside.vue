<script lang="ts" setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import useAppStore from '@/views/app-store'
import { NaoRouterLink } from '@/components/ui'

defineOptions({ name: 'IndexAside' })
const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()

const appStore = useAppStore()

const { routerLinks } = storeToRefs(appStore)

const userProfile = computed(() => appStore.userApp.states.profile)
const visible = computed({
    get: () => props.modelValue,
    set: (newVisible) => emit('update:modelValue', newVisible)
})
</script>

<template>
    <nue-drawer v-model="visible" open-from="left" theme="float-aside" allow-close-by-overlay>
        <nue-container id="AppAsideContainer">
            <nue-header>
                <nue-div align="center">
                    <nue-avatar :src="userProfile?.avatar" size="2rem" />
                    <nue-text>{{ userProfile?.nickname }}</nue-text>
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
                            v-for="(rl, idx) in routerLinks"
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
    }

    #AppAsideContainer > .nue-main > .nue-content {
        display: flex;
        flex-direction: column;
        padding: 1rem;
        box-sizing: border-box;
    }
}
</style>

