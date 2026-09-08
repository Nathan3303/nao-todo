<script setup lang="ts">
import { useAppAsideV2 } from './use-aside'
import { PomodoroIndicator } from '@nao-todo/presentation/pomodoro'
import { NaoRouterLink } from '@nao-todo/shared'
import {
    AppSettingsDialog,
    open as settingsDialogOpen,
    openSettingsDialog
} from '@/components/settings/dialog'
import { t } from '@nao-todo/shared'
import { nextTick, watch } from 'vue'

defineOptions({ name: 'AppAsideV2' })

// @composable Use app aside v2
const {
    routerLinks,
    profile,
    avatarSrc,
    isDisplayAside,
    switchDisplayAside,
    asideWidth,
    handleResizeAside,
    minWidth,
    maxWidth
} = useAppAsideV2()

// —— SHELL-01 设置对话框（桌面端）——
// @watch 关闭后把焦点归还齿轮按钮（Esc/关闭钮均经 NueDialog v-model 写回 state.open）
watch(settingsDialogOpen, (visible) => {
    if (visible) return
    void nextTick(() => {
        document.getElementById('AppAsideSettingsGearBtn')?.focus()
    })
})

// @export
defineExpose({ switchDisplayAside })
</script>

<template>
    <nue-aside
        theme="app-aside-v2"
        v-model:displayed="isDisplayAside"
        :width="asideWidth"
        :min-width="minWidth"
        :max-width="maxWidth"
    >
        <!-- 主要侧栏 -->
        <nue-div v-if="profile" theme="mainly-aside">
            <!-- 用户头像 -->
            <nue-avatar :src="avatarSrc" icon="user" size="2.5rem" />
            <!-- 底部导航区（SHELL-01：任务/日历/番茄/搜索 + 独立设置齿轮，均不再经路由跳转） -->
            <nue-div theme="aside__bottom">
                <template v-for="(rl, idx) in routerLinks" :key="idx">
                    <!-- 适配番茄时钟指示器 -->
                    <template v-if="rl.route === '/pomodoro'">
                        <pomodoro-indicator :route="rl.route" />
                    </template>
                    <!-- 正常路由链接 -->
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
                <!-- 独立齿轮（设置）按钮：直开对话框 -->
                <nue-tooltip :content="t('nav.settings')" placement="right-center" size="small">
                    <button
                        id="AppAsideSettingsGearBtn"
                        type="button"
                        class="aside-gear-btn"
                        :aria-label="t('nav.settings')"
                        :title="t('nav.settings')"
                        @click="openSettingsDialog()"
                    >
                        <nue-icon name="ntd-settings" />
                    </button>
                </nue-tooltip>
                <slot name="bottom" />
            </nue-div>
        </nue-div>
        <!-- 子视图侧栏 -->
        <div id="SubPageAsideTeleportSlot" />
    </nue-aside>
    <!-- 侧边栏宽度调整分割线 -->
    <nue-separator op-target="previous" @resize="handleResizeAside" :disabled="!isDisplayAside" />
    <!-- 设置对话框（SHELL-01 桌面端） -->
    <app-settings-dialog />
</template>