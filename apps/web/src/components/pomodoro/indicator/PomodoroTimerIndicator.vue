<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePomodoroTimerStore, usePomodoroStore } from '@/stores'
import { NaoRouterLink } from '@nao-todo/components'

defineOptions({ name: 'PomodoroTimerIndicator' })
defineProps<{ route?: string }>()

const router = useRouter()
const timerStore = usePomodoroTimerStore()
const pomodoroStore = usePomodoroStore()

// @computed 进度百分比（已完成的比例，从 total → 0）
const progress = computed(() => {
    if (timerStore.totalSeconds === 0) return 0
    return Math.round(
        ((timerStore.totalSeconds - timerStore.remainingSeconds) / timerStore.totalSeconds) * 100
    )
})

// @computed 进度条颜色：专注用主色，休息用成功色
const indicatorColor = computed(() => {
    if (timerStore.phase === 'focus') return 'var(--nue-primary-color-900)'
    return 'var(--nue-primary-color-600)'
})

// @computed 阶段中文标签
const phaseLabel = computed(() => {
    switch (timerStore.phase) {
        case 'focus':
            return '专注中'
        case 'break':
            return '休息中'
        case 'longBreak':
            return '长休息中'
        default:
            return ''
    }
})

// @computed 剩余时间 MM:SS
const timeDisplay = computed(() => {
    const mins = Math.floor(timerStore.remainingSeconds / 60)
    const secs = timerStore.remainingSeconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
})

// @computed 当前专注任务名称（仅专注阶段显示）
const taskName = computed(() => {
    if (timerStore.phase !== 'focus') return ''
    return pomodoroStore.currentTaskName || ''
})

// @computed 是否显示（非空闲态）
const isActive = computed(() => timerStore.phase !== 'idle')

// @handler 点击跳转到计时器页面
const goToTimer = () => {
    router.push('/pomodoro/timer')
}
</script>

<template>
    <nue-tooltip v-if="isActive" placement="right-center" size="small">
        <nue-div theme="timer-indicator" @click="goToTimer">
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

