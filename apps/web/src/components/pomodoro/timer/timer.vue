<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ name: 'PomodoroTimerComp' })

const progress = ref(95)
</script>

<template>
    <nue-div theme="pomodoro-timer">
        <nue-div theme="timer">
            <nue-progress
                :percentage="progress"
                type="circle"
                hide-text
                :scale="3"
                :stroke-width="1"
                color="var(--nue-primary-color-900)"
            />
            <nue-div theme="time-wrapper">
                <nue-text theme="time-duration">09:00:00 - 09:05:30</nue-text>
                <nue-button icon="ntd-minus" theme="icon,ghost" />
                <nue-text theme="time">05:30</nue-text>
                <nue-button icon="ntd-plus" theme="icon,ghost" />
                <nue-text theme="name">专注所关联任务的名称 ></nue-text>
            </nue-div>
        </nue-div>
        <nue-div theme="actions">
            <nue-button icon="ntd-reset">重置</nue-button>
            <nue-button icon="ntd-start" theme="primary">开始专注</nue-button>
            <nue-button icon="ntd-tiaoguo" theme="secondary">跳过</nue-button>
        </nue-div>
    </nue-div>
</template>

<style scoped>
.nue-div--pomodoro-timer {
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100%;
    gap: var(--nue-gap-xs);
    /* background-color: var(--nue-primary-color-100); */
    /* border-radius: var(--nue-primary-radius); */

    > .nue-div--timer {
        position: relative;

        &:hover {
            .nue-div--time-wrapper .nue-button--icon {
                opacity: 1;
            }
        }

        .nue-div--time-wrapper {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            justify-content: center;
            align-items: center;
            gap: var(--nue-gap-xs);

            .nue-text--time-duration {
                font-size: var(--nue-text-sm);
                color: var(--nue-primary-color-600);
                position: absolute;
                bottom: 100%;
            }

            .nue-text--time {
                font-size: 3rem;
                line-height: 1.2;
            }

            .nue-button--icon {
                opacity: 0;
                transition: opacity 0.3s ease-in-out;
            }

            .nue-text--name {
                font-size: var(--nue-text-sm);
                color: var(--nue-primary-color-600);
                position: absolute;
                top: 100%;
            }
        }
    }

    > .nue-div--actions {
        gap: var(--nue-gap-sm);
        justify-content: center;
        align-items: center;
    }
}
</style>

