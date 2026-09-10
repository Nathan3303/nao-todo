<script setup lang="ts">
import { useAppAsideV2 } from './use-aside'
import { PomodoroIndicator } from '@nao-todo/presentation/pomodoro'
import { NaoRouterLink } from '@nao-todo/shared'
import { UserInitialAvatar } from '@nao-todo/presentation-identity'
import {
    AppSettingsDialog,
    open as settingsDialogOpen,
    openSettingsDialog
} from '@/components/settings/dialog'
import { bindRailBottomHost, unbindRailBottomHost } from './rail-host'
import { t } from '@nao-todo/shared'
import { nextTick, onBeforeUnmount, watch, type ComponentPublicInstance } from 'vue'

defineOptions({ name: 'AppAsideV2' })

// @composable Use app aside v2
const {
    routerLinks,
    profile,
    avatarSrc,
    displayNickname,
    identityLabel,
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

// —— SHELL-02 轨道底部注入点（desktop 同步状态组件的 Teleport 宿主）——
// 函数 ref 用稳定引用（避免每次重渲染先置空再置位引发消费侧反复卸载）；卸载兜底清空。
const setRailBottomSlot = (el: Element | ComponentPublicInstance | null): void => {
    if (el instanceof HTMLElement) bindRailBottomHost(el)
    else unbindRailBottomHost()
}
onBeforeUnmount(unbindRailBottomHost)

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
        <!-- 主要侧栏（SHELL-03 C-05：去 `v-if="profile"` ⇒ 离线时轨道常驻，导航/齿轮/SHELL-02 注入点照常） -->
        <nue-div theme="mainly-aside">
            <!-- 用户头像（离线降级为缓存昵称首字母 / 通用图标占位，仅装饰不影响渲染条件） -->
            <user-initial-avatar
                :nickname="displayNickname"
                :src="avatarSrc"
                :label="identityLabel"
                size="2.5rem"
            />
            <!-- 页面链接（任务/日历/番茄/搜索，头像之下；高亮/番茄指示器照常） -->
            <nue-div theme="aside__navs">
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
            </nue-div>
            <!-- 底部：轨道底部注入点（SHELL-02 同步状态，恒在齿轮上方）+ 独立齿轮（设置）按钮，直开对话框（SHELL-01） -->
            <nue-div theme="aside__bottom">
                <div
                    id="AppAsideRailBottomSlot"
                    :ref="setRailBottomSlot"
                    class="aside-rail-bottom-slot"
                />
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