<script setup lang="ts">
import { computed, inject } from 'vue'
import { storeToRefs } from 'pinia'
import {
    PomodoroTimer,
    PomodoroFocus,
    PomodoroNoteInputer,
    PomodoroRoundsIndicator
} from '@nao-todo/presentation/pomodoro'
import { usePomodoroPage } from './use-pomodoro-page'
import { PomodoroFocusDependDropdown } from './focus-depend-dropdown'
import { PomodoroHeader } from './header'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'

defineOptions({ name: 'PomodoroPage' })

const { dialogManager } = inject(POMODORO_VIEW_CONTEXT_KEY)!

const {
    activeTab,
    timerStore,
    focusStore,
    taskName,
    handleSelectTask,
    handleClearTask,
    presetName,
    handleSelectPreset,
    noteText,
    setNoteText,
    handleStart,
    handleAdjustTime,
    handleReset,
    handleOpenSettings,
    handleMainAction,
    handleCancel,
    handleEnd
} = usePomodoroPage(dialogManager)

const { phase, remainingSeconds, totalSeconds, isRunning } = storeToRefs(timerStore)
const { status, elapsedSeconds } = storeToRefs(focusStore)

// 专注依赖触发文案：常用专注名与任务名同时存在时用短横线连接
const dependLabel = computed(() => {
    const names = [presetName.value, taskName.value].filter(Boolean)
    return '< ' + (names.length > 0 ? `${names.join(' / ')}` : '专注') + ' >'
})
</script>

<template>
    <!-- 番茄钟页面布局 -->
    <nue-container id="Pomodoro">
        <!-- 页面标题 -->
        <pomodoro-header />
        <!-- 页面主体 -->
        <nue-main>
            <nue-content>
                <nue-div theme="timer-wrapper">
                    <!-- 常用专注 & 专注任务 选择器 -->
                    <pomodoro-focus-depend-dropdown
                        :type="activeTab === 'timer' ? 1 : 2"
                        :preset-name="presetName"
                        :task-name="taskName"
                        @select-preset="handleSelectPreset"
                        @select-task="handleSelectTask"
                        @clear-task="handleClearTask"
                    >
                        <!-- DEF-128：调用点覆写插槽 ⇒ 此处也必须用原生 button（`nue-text` 渲染成 SPAN，
                             Tab 停不到、Enter 无效）；类名 = `parseTheme('task-select-trigger','nue-text')` ⇒
                             `nue-text--task-select-trigger`，样式仍由同一主题类提供 -->
                        <template #default="{ open }">
                            <button
                                type="button"
                                class="nue-text nue-text--task-select-trigger"
                                @click="open"
                                title="专注"
                            >
                                {{ dependLabel }}
                            </button>
                        </template>
                    </pomodoro-focus-depend-dropdown>
                    <!-- 轮次指示（T576 #3）：纯展示，圆点 + 文字标签 -->
                    <pomodoro-rounds-indicator v-if="activeTab === 'timer'" />
                    <!-- 番茄专注计时器 -->
                    <pomodoro-timer
                        v-if="activeTab === 'timer'"
                        :phase="phase"
                        :is-running="isRunning"
                        :remaining-seconds="remainingSeconds"
                        :total-seconds="totalSeconds"
                        :task-name="taskName"
                        @start="handleStart"
                        @pause="timerStore.pause()"
                        @resume="timerStore.resume()"
                        @reset="handleReset"
                        @skip="timerStore.skip()"
                        @adjust-time="handleAdjustTime($event)"
                        @open-settings="handleOpenSettings"
                    >
                    </pomodoro-timer>
                    <!-- 正计时计时器 -->
                    <pomodoro-focus
                        v-if="activeTab === 'focus'"
                        style="grid-area: timer"
                        :status="status"
                        :elapsed-seconds="elapsedSeconds"
                        :task-name="taskName"
                        @cancel="handleCancel"
                        @start="handleMainAction"
                        @pause="handleMainAction"
                        @resume="handleMainAction"
                        @end="handleEnd"
                    >
                    </pomodoro-focus>
                </nue-div>
                <!-- 专注笔记 -->
                <pomodoro-note-inputer
                    style="grid-area: note"
                    :note-text="noteText"
                    @update:note-text="setNoteText($event)"
                />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
/* DEF-128：「专注」入口为原生 button（复用 `.nue-text` 主题类）⇒ 只重置浏览器按钮默认样式，
   不改 `nue-text` 全局/主题规则；焦点环见下方 `:focus-visible`（`.nue-link` 那套不适用本主题） */
.nue-text--task-select-trigger {
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    cursor: pointer;
}

.nue-text--task-select-trigger:focus-visible {
    outline: 2px solid var(--nue-primary-color-600);
    outline-offset: 2px;
}

/* T451：「今日专注」已移入侧边栏 ⇒ 内容区单列（timer / note），删 today 区与 ≤950px 分支 */
#Pomodoro > .nue-main .nue-content {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 4fr 2fr;
    grid-template-areas: 'timer' 'note';
    width: 100%;
    height: 100%;
    flex: none;
    gap: var(--nue-gap-df);
    overflow: visible;
    padding: var(--nue-padding-df);
    box-sizing: border-box;

    > .nue-div--timer-wrapper {
        flex-direction: column;
        align-items: center;
        justify-content: center;
        grid-area: timer;
        gap: 0;
        margin: var(--nue-padding-sm);
    }
}
</style>