<script lang="ts" setup>
import { APP_CONTEXT_KEY } from '@/context'
import { PomodoroIndicator } from '@nao-todo/presentation/pomodoro'
import { useUserStore } from '@nao-todo/presentation-identity'
import { NaoRouterLink } from '@nao-todo/shared'
import { storeToRefs } from 'pinia'
import { computed, inject } from 'vue'

defineOptions({ name: 'AppFloatAside' })
const props = defineProps<{
    modelValue: boolean
    width?: string
    minWidth?: string
    maxWidth?: string
}>()
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>()
const { routerLinks } = inject(APP_CONTEXT_KEY)!

const { profile } = storeToRefs(useUserStore())

const visible = computed({
    get: () => props.modelValue,
    set: (newVisible) => emit('update:modelValue', newVisible)
})
</script>

<template>
    <nue-drawer v-model="visible" open-from="left" theme="float-aside" allow-close-by-overlay>
        <nue-container id="AppAsideContainer">
            <nue-header v-if="profile">
                <nue-div align="center">
                    <nue-avatar :src="profile.avatar" size="2rem" />
                    <nue-text>{{ profile.nickname }}</nue-text>
                </nue-div>
            </nue-header>
            <nue-main>
                <nue-content style="justify-content: space-between; min-height: 0">
                    <div>
                        <slot>
                            <nue-empty />
                        </slot>
                    </div>
                </nue-content>
            </nue-main>
            <nue-footer>
                <nue-div justify="space-around" gap="0" width="100%">
                    <template v-for="(rl, idx) in routerLinks" :key="idx">
                        <template v-if="rl.route === '/pomodoro'">
                            <pomodoro-indicator :route="rl.route" />
                        </template>
                        <template v-else>
                            <nue-tooltip
                                :key="idx"
                                :content="rl.name"
                                placement="right-center"
                                size="small"
                            >
                                <nao-router-link :icon="rl.icon" :route="rl.route" icon-link />
                            </nue-tooltip>
                        </template>
                    </template>
                </nue-div>
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
        box-sizing: border-box;
    }
}
</style>