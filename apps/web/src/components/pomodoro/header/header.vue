<script setup lang="ts">
import { computed, inject } from 'vue'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import { useRoute } from 'vue-router'
// import { POMODORO_CREATOR_DIALOG_KEY } from '@nao-todo/shared'

defineOptions({ name: 'PomodoroHeader' })

const route = useRoute()
const {
    // dialogManager,
    // isUseFloatAside,
    isDisplayAside,
    switchDisplayAside
} = inject(POMODORO_VIEW_CONTEXT_KEY)!

// @computed 悬浮头部（T452）：仅「番茄专注 / 正计时」（route.name = 'pomodoro'）
//              其他子视图（常用专注 / 专注记录）保持原样（含底边）
const isFloating = computed(() => route.name === 'pomodoro')

// 打开新建常用番茄专注对话框
// const handleOpenCreator = () => {
//     dialogManager.open(POMODORO_CREATOR_DIALOG_KEY)
// }

const pageTitle = computed(() => {
    switch (route.name) {
        case 'pomodoro-collection':
            return '常用专注'
        case 'pomodoro-records':
            return '专注记录'
        case 'pomodoro':
            return route.params.type === 'timer' ? '番茄专注' : '正计时'
        default:
            return '番茄专注'
    }
})
</script>

<template>
    <nue-header
        class="pomodoro-header"
        :class="{ 'pomodoro-header--floating': isFloating }"
        :style="isFloating ? { borderBottom: 'none' } : undefined"
    >
        <nue-div theme="title-wrapper">
            <nue-button
                :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                theme="icon,ghost"
                @click="switchDisplayAside"
            />
            <nue-div theme="title">{{ pageTitle }}</nue-div>
        </nue-div>
        <!-- <nue-div v-if="!isUseFloatAside" theme="tabs">
            <nue-link icon="ntd-fanqie" route="/pomodoro/timer">番茄专注</nue-link>
            <nue-link icon="ntd-zzt" route="/pomodoro/focus">正计时</nue-link>
            <nue-link icon="list" route="/pomodoro/pomodoros">常用专注</nue-link>
            <nue-link icon="history" route="/pomodoro/records">专注记录</nue-link>
        </nue-div> -->
        <nue-div theme="actions">
            <!-- <nue-tooltip content="新建常用番茄专注" size="small">
                <nue-button icon="plus" theme="icon,ghost" @click="handleOpenCreator" />
            </nue-tooltip> -->
            <!-- <nue-tooltip content="查看历史专注记录" size="small">
                <nue-button icon="ntd-history" theme="icon,ghost" />
            </nue-tooltip> -->
        </nue-div>
    </nue-header>
</template>

<style scoped>
/* T452：番茄专注 / 正计时头部**真悬浮** ——
   1) 去底边（内联 style 翻越 nue-ui 默认分隔线，避免 !important）+ 透明底；
   2) `position: absolute` 移出文档流 ⇒ **下方内容不再被头部的 4rem 高度顶下**（容器已是 relative）；
   3) 透明区让点击穿透（仅头部自身内容可交互），避免遮住内容。 */
.pomodoro-header--floating {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    background-color: transparent;
    pointer-events: none;
}
.pomodoro-header--floating > * {
    pointer-events: auto;
}

.nue-header {
    padding: 0 var(--nue-padding-df);
    height: 4rem;
    justify-content: space-between;
    align-items: center;

    > .nue-div--title-wrapper {
        display: flex;
        align-items: center;
        gap: var(--nue-gap-2xs);

        > .nue-div--title {
            gap: var(--nue-gap-2xs);
        }
    }

    /* > .nue-div--tabs {
        gap: var(--nue-gap-2xs);
        height: 100%;

        .nue-link {
            --nue-link-background-color: transparent;
            --nue-link-color: var(--nue-primary-color-500);
            --nue-link-actived-color: var(--nue-primary-color-900);
            --nue-link-actived-text-decoration: none;

            font-size: var(--nue-text-sm);
            height: 100%;
            justify-content: center;
            align-items: center;
            padding: 0 var(--nue-padding-sm);
            box-sizing: border-box;

            &.nue-link--actived {
                border-bottom: 2px solid var(--nue-primary-color-900);
            }
        }
    } */

    /* > .nue-div--actions {
        width: fit-content;
    } */
}
</style>