<script setup lang="ts">
import { PomodoroIndicator } from '@nao-todo/presentation/pomodoro'
import { NaoRouterLink } from '@nao-todo/shared/components/router-link'
import { UserInitialAvatar } from '@nao-todo/presentation-identity'
import { AppSettingsDialog } from '@/components/settings/dialog'
import { t } from '@nao-todo/shared/locales'
import { computed, onBeforeUnmount, shallowRef, type ComponentPublicInstance } from 'vue'
import { bindRailBottomHost, unbindRailBottomHost } from './rail-host'
import { useSettingsEntry } from './use-settings-entry'
import { useAppAsideV2 } from './use-aside'

defineOptions({ name: 'AppAsideV2Drawer' })

// @composable Use app aside v2
const { routerLinks, profile, avatarSrc, displayNickname, identityLabel, isDisplayAside } =
    useAppAsideV2()

// @computed isDisplayAside proxy
const visible = computed({
    get: () => isDisplayAside.value,
    set: (newVisible) => (isDisplayAside.value = newVisible)
})

// —— T521 工具区：同步状态宿主（SHELL-02 注入点的抽屉变体）+ 设置齿轮（SHELL-01）——
// 与桌面 rail 共用同一份宿主注册表与齿轮状态（能力对等，单实例），差异只在摆放位置。

// @ref 同步状态注入点（抽屉工具区；切回桌面时由 rail 改绑）
const bottomSlot = shallowRef<HTMLElement | null>(null)
const setBottomSlot = (el: Element | ComponentPublicInstance | null): void => {
    if (el instanceof HTMLElement) {
        bottomSlot.value = el
        bindRailBottomHost(el, 'drawer')
        return
    }
    if (bottomSlot.value) {
        unbindRailBottomHost(bottomSlot.value)
        bottomSlot.value = null
    }
}
onBeforeUnmount(() => {
    if (bottomSlot.value) unbindRailBottomHost(bottomSlot.value)
})

// @composable 设置齿轮（打开走 hostReady 闸门；关窗焦点归还当前变体齿轮）
const { setGearButton, openSettings } = useSettingsEntry()
</script>

<template>
    <nue-drawer v-model="visible" open-from="left" theme="app-aside-v2" allow-close-by-overlay>
        <nue-container id="AppAsideContainer">
            <!-- SHELL-03 C-05：header 身份区不阻塞抽屉（去 profile 门，离线降级为占位；无昵称则不显示文字行） -->
            <nue-header>
                <nue-div align="center" gap="0.5rem">
                    <user-initial-avatar
                        :nickname="displayNickname"
                        :src="avatarSrc"
                        :label="identityLabel"
                        size="2rem"
                    />
                    <nue-text v-if="displayNickname">{{ displayNickname }}</nue-text>
                </nue-div>
            </nue-header>
            <nue-main>
                <nue-content style="justify-content: space-between; min-height: 0">
                    <!-- 子视图侧栏 -->
                    <div id="SubPageAsideTeleportSlot" />
                    <!-- T521 工具区：同步状态（上，SHELL-02 语义）+ 齿轮（下，直开设置） -->
                    <nue-div theme="aside__tools">
                        <div
                            id="AppAsideDrawerBottomSlot"
                            :ref="setBottomSlot"
                            class="aside-rail-bottom-slot"
                        />
                        <nue-tooltip
                            :content="t('nav.settings')"
                            placement="top-center"
                            size="small"
                        >
                            <button
                                id="AppAsideDrawerSettingsGearBtn"
                                :ref="setGearButton"
                                type="button"
                                class="aside-gear-btn"
                                :aria-label="t('nav.settings')"
                                :title="t('nav.settings')"
                                @click="openSettings()"
                            >
                                <nue-icon name="ntd-settings" />
                            </button>
                        </nue-tooltip>
                    </nue-div>
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
    <!-- 设置对话框（SHELL-01 抽屉宿主：hostReady 闸门 + 卸载兜底关闭由组件自身负责） -->
    <app-settings-dialog />
</template>