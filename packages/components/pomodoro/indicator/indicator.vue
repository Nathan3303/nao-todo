<script setup lang="ts">
import { NaoRouterLink } from '../../router-link'
import { PomodoroFocusRing } from '../focus-ring'
import type { PomodoroIndicatorProps, PomodoroIndicatorEmits } from './types'

defineOptions({ name: 'PomodoroTimerIndicator' })
withDefaults(defineProps<PomodoroIndicatorProps>(), {
    progress: 0,
    indicatorColor: 'var(--nue-primary-color-900)',
    phaseLabel: '',
    timeDisplay: '',
    taskName: '',
    isTimerRunning: false,
    isFocusRunning: false
})
const emit = defineEmits<PomodoroIndicatorEmits>()
</script>

<template>
    <nue-tooltip v-if="isTimerRunning" placement="right-center" size="small">
        <nue-div theme="timer-indicator" @click="emit('go')">
            <nue-progress
                type="circle"
                :percentage="progress"
                :stroke-width="42"
                :color="indicatorColor"
                :scale="0.28"
                hide-text
            />
            <nue-icon name="ntd-fanqie" :color="indicatorColor" />
        </nue-div>
        <template #content>
            <nue-div vertical gap="0">
                <nue-text size="sm" color="var(--nue-primary-color-0)">
                    {{ phaseLabel }} - {{ timeDisplay }}
                </nue-text>
                <nue-text v-if="taskName" size="sm" color="var(--nue-primary-color-0)">
                    {{ taskName }}
                </nue-text>
            </nue-div>
        </template>
    </nue-tooltip>
    <nue-tooltip v-else-if="isFocusRunning" placement="right-center" size="small">
        <nue-div theme="timer-indicator" @click="emit('go')">
            <pomodoro-focus-ring :scale="0.28" :stroke-width="42" :is-running="isFocusRunning" />
            <nue-icon name="ntd-fanqie" :color="indicatorColor" />
        </nue-div>
        <template #content>
            <nue-div vertical gap="0">
                <nue-text size="sm" color="var(--nue-primary-color-0)">
                    {{ phaseLabel }} - {{ timeDisplay }}
                </nue-text>
                <nue-text v-if="taskName" size="sm" color="var(--nue-primary-color-0)">
                    {{ taskName }}
                </nue-text>
            </nue-div>
        </template>
    </nue-tooltip>
    <nue-tooltip v-else content="番茄钟" placement="right-center" size="small">
        <nao-router-link icon="ntd-fanqie" :route="route" icon-link />
    </nue-tooltip>
</template>

<style scoped>
.nue-div--timer-indicator {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--nue-primary-radius);
    transition: background-color var(--nue-animation-duration);
    position: relative;
    width: 26px;
    height: 26px;

    > .nue-icon {
        font-size: var(--nue-text-df2);
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        line-height: 1;
    }
}
</style>
