<script setup lang="ts">
import { inject } from 'vue'
import { PomodoroTimerComp, PomodoroRecordsComp, PomodoroNotesComp } from '@/components/pomodoro'
import type { PomodoroViewContext } from '@/views/index/pomodoro/pomodoro-view'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/context-keys'
defineOptions({ name: 'PomodoroTimer' })

// @context 番茄钟视图上下文
const { isDisplayAside, switchDisplayAside } =
    inject<PomodoroViewContext>(POMODORO_VIEW_CONTEXT_KEY)!
</script>

<template>
    <nue-container id="PomodoroFocus">
        <nue-header>
            <nue-div theme="title-wrapper">
                <nue-div theme="title">
                    <nue-button
                        :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                        theme="icon,ghost"
                        @click="switchDisplayAside"
                    />
                    <nue-text>番茄专注</nue-text>
                </nue-div>
                <nue-text theme="description">
                    番茄时钟是一种时间管理工具，它将工作时间和休息时间交替进行。
                </nue-text>
            </nue-div>
            <nue-div theme="actions"></nue-div>
        </nue-header>
        <nue-main>
            <!-- 番茄钟内容 -->
            <nue-content>
                <pomodoro-timer-comp style="grid-area: timer" />
                <pomodoro-records-comp style="grid-area: today" />
                <pomodoro-notes-comp style="grid-area: note" />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
#PomodoroFocus {
    padding: var(--nue-padding-df);
    gap: var(--nue-gap-df);

    > .nue-header {
        padding: 0;
        height: auto;
        justify-content: space-between;
        border: none;

        > .nue-div--title-wrapper {
            flex-direction: column;
            gap: var(--nue-gap-2xs);

            > .nue-div--title {
                align-items: center;
                flex: auto;
                font-size: var(--nue-text-xl);
                gap: var(--nue-gap-2xs);
            }

            > .nue-text--description {
                font-size: var(--nue-text-sm);
                color: var(--nue-primary-color-600);
            }
        }

        > .nue-div--actions {
            gap: var(--nue-gap-sm);
        }
    }

    > .nue-main .nue-content {
        display: grid;
        grid-template-columns: minmax(24rem 2fr) 3fr;
        grid-template-rows: minmax(24rem, 2fr) 3fr;
        grid-template-areas: 'timer today' 'note note';
        height: 100%;
        overflow: hidden;
        gap: 2rem;

        @media (max-width: 480px) {
            grid-template-columns: 1fr;
            grid-template-rows: 24rem auto 24rem;
            grid-template-areas: 'timer' 'note' 'today';
            gap: var(--nue-gap-df);
        }
    }
}
</style>

