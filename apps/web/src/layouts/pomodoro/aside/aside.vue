<script setup lang="ts">
import { inject } from 'vue'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
import { AppAsideAdapter } from '@/layouts/app/'
import { type PomodoroViewContext } from '@/views/index/pomodoro/pomodoro-view'

defineOptions({ name: 'PomodoroAside' })

// @context PomodoroView 番茄钟视图上下文
const { asideWidth, handleResizeAside, isDisplayAside } =
    inject<PomodoroViewContext>(POMODORO_VIEW_CONTEXT_KEY)!
</script>

<template>
    <app-aside-adapter
        @resize="handleResizeAside"
        v-model:displayed="isDisplayAside"
        :width="asideWidth"
        :min-width="isDisplayAside ? '250px' : 'unset'"
        max-width="350px"
    >
        <nue-div v-if="isDisplayAside" theme="pomodoro-aside">
            <!-- <nue-div vertical gap="0" style="padding: 0 var(--nue-padding-sm)">
                <nue-text size="var(--nue-text-lg)">NaoTodo</nue-text>
                <nue-text size="var(--nue-text-sm)" color="var(--nue-primary-color-600)">
                    保持专注
                </nue-text>
            </nue-div> -->
            <nue-div vertical gap="0.25rem" flex="1">
                <nue-link icon="ntd-fanqie" theme="route" route="/pomodoro/timer">
                    番茄专注
                </nue-link>
                <nue-link icon="ntd-zzt" theme="route" route="/pomodoro/focus">正计时</nue-link>
                <nue-link icon="ntd-history" theme="route" route="/pomodoro/history">
                    专注记录
                </nue-link>
            </nue-div>
            <!-- <nue-text size="var(--nue-text-xs)">NaoTodo 2026</nue-text> -->
        </nue-div>
    </app-aside-adapter>
</template>

<style scoped>
.nue-div--pomodoro-aside {
    flex-direction: column;
    flex: auto;
    height: 100%;
    padding: 1rem;
    gap: var(--nue-gap-lg);
}
</style>

