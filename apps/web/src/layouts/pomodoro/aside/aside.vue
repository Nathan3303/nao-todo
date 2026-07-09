<script setup lang="ts">
import { inject } from 'vue'
import { AppAsideAdapter } from '@/layouts/app/'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'

defineOptions({ name: 'PomodoroAside' })

// @context PomodoroView 番茄钟视图上下文
const { isDisplayAside, isUseFloatAside } = inject(POMODORO_VIEW_CONTEXT_KEY)!
</script>

<template>
    <app-aside-adapter
        v-model:displayed="isDisplayAside"
        width="auto"
        min-width="unset"
        max-width="350px"
    >
        <nue-div v-if="isUseFloatAside" theme="pomodoro-aside">
            <nue-div vertical gap="0.25rem" flex="1">
                <nue-link icon="ntd-fanqie" theme="route" route="/pomodoro/timer">
                    番茄专注
                </nue-link>
                <nue-link icon="ntd-zzt" theme="route" route="/pomodoro/focus">正计时</nue-link>
            </nue-div>
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

