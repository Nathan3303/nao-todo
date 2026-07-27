<script setup lang="ts">
import { PomodoroIndicator } from '@nao-todo/presentation/pomodoro'
import { NaoRouterLink } from '@nao-todo/shared'
import { computed } from 'vue'
import { useAppAsideV2 } from './use-aside'

defineOptions({ name: 'AppAsideV2Drawer' })

// @composable Use app aside v2
const { routerLinks, profile, isDisplayAside } = useAppAsideV2()

// @computed isDisplayAside proxy
const visible = computed({
    get: () => isDisplayAside.value,
    set: (newVisible) => (isDisplayAside.value = newVisible)
})
</script>

<template>
    <nue-drawer v-model="visible" open-from="left" theme="app-aside-v2" allow-close-by-overlay>
        <nue-container id="AppAsideContainer">
            <nue-header v-if="profile">
                <nue-div align="center">
                    <nue-avatar :src="profile.avatar" size="2rem" />
                    <nue-text>{{ profile.nickname }}</nue-text>
                </nue-div>
            </nue-header>
            <nue-main>
                <nue-content style="justify-content: space-between; min-height: 0">
                    <!-- 子视图侧栏 -->
                    <div id="SubPageAsideTeleportSlot" />
                </nue-content>
            </nue-main>
            <nue-footer>
                <nue-div justify="space-between" gap="0" width="100%">
                    <template v-for="(rl, idx) in routerLinks" :key="idx">
                        <template v-if="rl.route === '/pomodoro'">
                            <pomodoro-indicator :route="rl.route" tooltip-placement="top-center" />
                        </template>
                        <template v-else>
                            <nue-tooltip
                                :key="idx"
                                :content="rl.name"
                                placement="top-center"
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