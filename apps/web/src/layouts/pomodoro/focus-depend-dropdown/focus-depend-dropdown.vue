<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { NueDropdown, NueInput } from 'nue-ui'
import { ListViewAdapter } from '@/layouts/app'
import { usePresetPanel } from './use-preset-panel'
import { useTaskPanel } from './use-task-panel'
import type { PomodoroViewObject } from '@nao-todo/usecases/pomodoro'
import type { TaskViewObject } from '@nao-todo/usecases/task'
import type {
    FocusDependTab,
    PomodoroFocusDependDropdownEmits,
    PomodoroFocusDependDropdownProps
} from './types'

defineOptions({ name: 'PomodoroFocusDependDropdown' })

// @props
const props = defineProps<PomodoroFocusDependDropdownProps>()

// @emits
const emit = defineEmits<PomodoroFocusDependDropdownEmits>()

// 元素引用
const dropdownRef = ref<InstanceType<typeof NueDropdown>>()
const inputRef = ref<InstanceType<typeof NueInput>>()

// 当前激活的 Tab
const activeTab = ref<FocusDependTab>('preset')

// 常用专注面板 Hook
const { loading, presets, refresh } = usePresetPanel(props)

// 任务专注面板 Hook
const {
    tags,
    viewPreference,
    taskUseCase,
    subscriber,
    getProjectName,
    showTaskDetails,
    getNoTaskError,
    refreshData
} = useTaskPanel()

/**
 * 选择常用专注
 * @param preset 选中的常用专注（null 表示不关联）
 */
const handleSelectPreset = (preset: PomodoroViewObject | null) => {
    emit('selectPreset', preset)
    dropdownRef.value?.close()
}

/**
 * 选择任务
 */
const handleSelectTask = (task: TaskViewObject) => {
    emit('selectTask', task)
    dropdownRef.value?.close()
}

/**
 * 面板打开后：刷新常用专注数据；若在任务 Tab 则聚焦搜索框
 */
const handleAfterOpen = () => {
    refresh()
    if (activeTab.value === 'task') {
        nextTick(() => inputRef.value?.innerInputRef?.focus())
    }
}

/**
 * 切换到任务 Tab 时聚焦搜索框
 */
const switchTab = (tab: FocusDependTab) => {
    activeTab.value = tab
    if (tab === 'task') {
        nextTick(() => inputRef.value?.innerInputRef?.focus())
    }
}

/**
 * 格式化预设时长（秒 → 分钟）
 */
const formatDuration = (seconds: number) => `${Math.round(seconds / 60)} 分钟`
</script>

<template>
    <nue-dropdown
        ref="dropdownRef"
        theme="focus,pomodoro-focus-depend-selector"
        placement="right-start"
        @after-open="handleAfterOpen"
    >
        <!-- 触发元素 -->
        <template #trigger="{ trigger }">
            <slot :open="trigger">
                <nue-link @click="trigger">专注</nue-link>
            </slot>
        </template>
        <!-- 下拉菜单 -->
        <nue-container id="pomodoro-focus-depend-selector">
            <!-- 下拉菜单标题 -->
            <nue-header>
                <nue-text theme="title">选择专注</nue-text>
                <nue-text theme="description">
                    选择想要关联的常用专注或任务，用于在专注结束后创建专注记录
                </nue-text>
            </nue-header>
            <!-- Tabs 切换 -->
            <nue-div theme="depend-tabs">
                <nue-text
                    theme="depend-tab"
                    :class="{ 'depend-tab--actived': activeTab === 'preset' }"
                    @click="switchTab('preset')"
                >
                    常用专注
                </nue-text>
                <nue-text
                    theme="depend-tab"
                    :class="{ 'depend-tab--actived': activeTab === 'task' }"
                    @click="switchTab('task')"
                >
                    任务专注
                </nue-text>
            </nue-div>
            <!-- 下拉菜单内容 -->
            <nue-main>
                <!-- 常用专注面板 -->
                <nue-content v-if="activeTab === 'preset'" theme="preset-panel">
                    <!-- 不关联项 -->
                    <nue-div theme="preset-item,none" @click="handleSelectPreset(null)">
                        <nue-text theme="preset-name">不关联</nue-text>
                    </nue-div>
                    <!-- 常用专注列表 -->
                    <nue-div
                        v-for="preset in presets"
                        :key="preset.id"
                        theme="preset-item"
                        @click="handleSelectPreset(preset)"
                    >
                        <nue-text theme="preset-name">{{ preset.name }}</nue-text>
                        <nue-text theme="preset-duration">{{
                            formatDuration(preset.duration)
                        }}</nue-text>
                    </nue-div>
                    <!-- 空态 -->
                    <nue-div v-if="!loading && presets.length === 0" theme="preset-empty">
                        <nue-text>暂无常用专注</nue-text>
                    </nue-div>
                </nue-content>
                <!-- 任务专注面板 -->
                <nue-div v-else theme="task-panel">
                    <!-- 搜索栏 -->
                    <nue-div theme="search-bar">
                        <nue-input
                            ref="inputRef"
                            theme="search"
                            v-model="viewPreference.getTasksOptions.name"
                            placeholder="搜索任务"
                            icon="search"
                            :debounce-time="360"
                        />
                        <nue-button icon="refresh" @click="refreshData">刷新</nue-button>
                    </nue-div>
                    <!-- 任务列表 -->
                    <nue-content>
                        <list-view-adapter
                            small
                            :task-use-case="taskUseCase"
                            :get-tasks-options="viewPreference.getTasksOptions"
                            :subscriber="subscriber"
                            :tags="tags"
                            :columns="viewPreference.columns"
                            :get-project-name="getProjectName"
                            :task-clicked="handleSelectTask"
                            :get-no-task-error="getNoTaskError"
                            style="overflow: hidden"
                        >
                            <template #actions="{ task }">
                                <nue-button
                                    icon="eye"
                                    theme="pure"
                                    @click.stop="showTaskDetails(task.id)"
                                />
                            </template>
                        </list-view-adapter>
                    </nue-content>
                </nue-div>
            </nue-main>
        </nue-container>
    </nue-dropdown>
</template>

<style>
.nue-dropdown--pomodoro-focus-depend-selector {
    display: flex;
    flex-direction: column;
    width: 24rem;
    height: 40rem;
    overflow: hidden;
    padding: 0;
}

#pomodoro-focus-depend-selector {
    height: 100%;

    > .nue-header {
        height: auto;
        flex-direction: column;
        gap: var(--nue-gap-2xs);
        align-items: start;
        padding: var(--nue-padding-sm);
        border: none;

        > .nue-text--title {
            color: var(--nue-primary-color-800);
        }

        > .nue-text--description {
            font-size: var(--nue-text-xs);
            color: var(--nue-primary-color-400);
        }
    }

    > .nue-div--depend-tabs {
        display: flex;
        flex-direction: row;
        gap: var(--nue-gap-df);
        padding: 0 var(--nue-padding-sm);
        border-bottom: 1px solid var(--nue-border-color);
        height: 3rem;
        justify-content: center;

        > .nue-text--depend-tab {
            font-size: var(--nue-text-sm);
            color: var(--nue-primary-color-500);
            padding: 0 0.25rem;
            line-height: 3rem;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition:
                color 0.2s ease,
                border-color 0.2s ease;

            &:hover {
                color: var(--nue-primary-color-800);
            }

            &.depend-tab--actived {
                color: var(--nue-primary-color-900);
                border-bottom-color: var(--nue-primary-color-900);
            }
        }
    }

    > .nue-main {
        flex-direction: column;
        overflow: hidden;

        /* 常用专注面板 */
        > .nue-content--preset-panel {
            display: flex;
            flex-direction: column;
            gap: 0.125rem;
            padding: var(--nue-padding-sm);
            overflow: auto;

            > .nue-div--preset-item {
                display: flex;
                flex-direction: row;
                align-items: center;
                justify-content: space-between;
                padding: 0.5rem 0.75rem;
                border-radius: var(--nue-border-radius-df);
                cursor: pointer;
                transition: background-color 0.2s ease;

                &:hover {
                    background-color: var(--nue-primary-color-100);
                }

                > .nue-text--preset-name {
                    font-size: var(--nue-text-sm);
                    color: var(--nue-primary-color-800);
                }

                > .nue-text--preset-duration {
                    font-size: var(--nue-text-xs);
                    color: var(--nue-primary-color-400);
                }

                &.nue-div--none > .nue-text--preset-name {
                    color: var(--nue-primary-color-400);
                }
            }

            > .nue-div--preset-empty {
                padding: 1rem;
                text-align: center;
                color: var(--nue-primary-color-300);
                font-size: var(--nue-text-sm);
            }
        }

        /* 任务专注面板 */
        > .nue-div--task-panel {
            display: flex;
            flex-direction: column;
            flex: auto;
            overflow: hidden;
            gap: 0.125rem;

            > .nue-div--search-bar {
                margin: var(--nue-padding-sm) var(--nue-padding-sm) 0;
                gap: 0.5rem;

                > .nue-input {
                    flex: auto;
                }
            }

            > .nue-content {
                display: flex;
                flex-direction: column;
                padding: var(--nue-padding-sm);
                overflow: auto;
            }
        }
    }
}
</style>

<style scoped>
.nue-dropdown-wrapper {
    text-align: center;

    &:hover {
        text-decoration: underline;
        color: var(--nue-primary-color-900);
        cursor: pointer;
    }
}
</style>

