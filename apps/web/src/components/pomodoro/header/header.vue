<script setup lang="ts">
import { inject } from 'vue'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'
import { POMODORO_CREATOR_DIALOG_KEY } from '@nao-todo/shared'

defineOptions({ name: 'PomodoroHeader' })

const { dialogManager, isUseFloatAside, isDisplayAside, switchDisplayAside } =
    inject(POMODORO_VIEW_CONTEXT_KEY)!

// 打开新建常用番茄专注对话框
const handleOpenCreator = () => {
    dialogManager.open(POMODORO_CREATOR_DIALOG_KEY)
}
</script>

<template>
    <nue-header>
        <nue-div theme="title-wrapper">
            <nue-button
                v-if="isUseFloatAside"
                :icon="isDisplayAside ? 'menu-close' : 'menu-open'"
                theme="icon,ghost"
                @click="switchDisplayAside"
            />
            <nue-div theme="title">番茄专注</nue-div>
        </nue-div>
        <nue-div theme="tabs">
            <nue-link icon="ntd-fanqie" route="/pomodoro/timer">番茄专注</nue-link>
            <nue-link icon="ntd-zzt" route="/pomodoro/focus">正计时</nue-link>
            <nue-link icon="list" route="/pomodoro/pomodoros">常用专注</nue-link>
        </nue-div>
        <nue-div theme="actions">
            <nue-tooltip content="新建常用番茄专注" size="small">
                <nue-button icon="plus" theme="icon,ghost" @click="handleOpenCreator" />
            </nue-tooltip>
            <nue-tooltip content="查看历史专注记录" size="small">
                <nue-button icon="ntd-history" theme="icon,ghost" />
            </nue-tooltip>
        </nue-div>
    </nue-header>
</template>

<style scoped>
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

    > .nue-div--tabs {
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
    }

    > .nue-div--actions {
        width: fit-content;
    }
}
</style>
