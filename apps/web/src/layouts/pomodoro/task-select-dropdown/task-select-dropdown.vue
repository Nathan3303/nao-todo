<script setup lang="ts">
import { useTaskSelectDropdown } from './use-task-select-dropdown'
import { ListViewAdapter } from '@/layouts/app'
import { NueDropdown, NueInput } from 'nue-ui'
import { nextTick, ref } from 'vue'
import type { TaskViewObject } from '@nao-todo/usecases/task'
import type { PomodoroTaskSelectDropdownEmits } from './types'

defineOptions({ name: 'PomodoroTaskSelectDropdown' })

// @emits
const emit = defineEmits<PomodoroTaskSelectDropdownEmits>()

// 元素引用
const inputRef = ref<InstanceType<typeof NueInput>>()
const dropdownRef = ref<InstanceType<typeof NueDropdown>>()

// useTaskSelectDropdown Hook
const {
    tags,
    viewPreference,
    taskUseCase,
    subscriber,
    getProjectName,
    getNoTaskError,
    refreshData,
    showTaskDetails
} = useTaskSelectDropdown()

/**
 * 选择任务
 * @description 通过 selectTask 事件将所选任务传递给父组件
 */
const handleSelectTask = (task: TaskViewObject) => {
    emit('selectTask', task)
    dropdownRef.value?.close()
}
</script>

<template>
    <nue-dropdown
        ref="dropdownRef"
        theme="focus,pomodoro-task-selector"
        placement="right-start"
        @after-open="nextTick(() => inputRef?.innerInputRef?.focus())"
        close-when-executed
    >
        <!-- 触发元素 -->
        <template #trigger="{ trigger }">
            <slot :open="trigger">
                <nue-link @click="trigger">未选择专注任务</nue-link>
            </slot>
        </template>
        <!-- 下拉菜单 -->
        <nue-container id="pomodoro-task-selector">
            <!-- 下拉菜单标题 -->
            <nue-header>
                <nue-text theme="title">选择专注任务</nue-text>
                <nue-text theme="description">
                    选择想要关联的任务，用于在专注结束后创建专注记录
                </nue-text>
            </nue-header>
            <!-- 下拉菜单内容 -->
            <nue-main>
                <!-- 下拉菜单搜索栏 -->
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
                <!-- 下拉菜单任务列表 -->
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
            </nue-main>
        </nue-container>
    </nue-dropdown>
</template>

<style>
.nue-dropdown--pomodoro-task-selector {
    display: flex;
    flex-direction: column;
    width: 24rem;
    height: 40rem;
    overflow: auto;
    padding: 0;
}

#pomodoro-task-selector {
    height: 100%;

    > .nue-header {
        height: auto;
        flex-direction: column;
        gap: 0;
        align-items: start;
        padding: var(--nue-padding-sm);
        border: none;

        > .nue-text--title {
            font-size: var(--nue-text-md);
            color: var(--nue-primary-color-800);
        }

        > .nue-text--description {
            font-size: var(--nue-text-xs);
            color: var(--nue-primary-color-400);
        }
    }

    > .nue-main {
        flex-direction: column;
        overflow: hidden;

        > .nue-div--search-bar {
            margin: 0 var(--nue-padding-sm);
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

