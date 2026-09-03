<script setup lang="ts">
import { useAppAsideV2 } from './use-aside'
import { PomodoroIndicator } from '@nao-todo/presentation/pomodoro'
import { NaoRouterLink } from '@nao-todo/shared'

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
            <!-- 页面链接 -->
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
            <!-- 底部区域 -->
            <nue-div theme="aside__bottom">
                <slot name="bottom" />
            </nue-div>
        </nue-div>
        <!-- 子视图侧栏 -->
        <div id="SubPageAsideTeleportSlot" />
    </nue-aside>
    <!-- 侧边栏宽度调整分割线 -->
    <nue-separator op-target="previous" @resize="handleResizeAside" :disabled="!isDisplayAside" />
</template>