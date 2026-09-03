<script setup lang="ts">
import type { PomodoroViewObject } from '@nao-todo/domain-pomodoro'
import type { TaskViewObject } from '@nao-todo/domain-task'
import { ListViewAdapter } from '@nao-todo/presentation/task'
import { NueDropdown, NueInput } from 'nue-ui'
import { computed, inject, nextTick, ref } from 'vue'
import type {
    FocusDependTab,
    PomodoroFocusDependDropdownEmits,
    PomodoroFocusDependDropdownProps
} from './types'
import { usePresetPanel } from './use-preset-panel'
import { useTaskPanel } from './use-task-panel'
import { POMODORO_VIEW_CONTEXT_KEY } from '@/views/index/pomodoro/context'

defineOptions({ name: 'PomodoroFocusDependDropdown' })

// @context PomodoroView 番茄钟视图上下文
const { dialogManager } = inject(POMODORO_VIEW_CONTEXT_KEY)!

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
    getNoTaskError
} = useTaskPanel()

/**
 * 选择常用专注
 * @param preset 选中的常用专注（null 表示不关联）
 */
const handleSelectPreset = (preset: PomodoroViewObject | null) => {
    emit('selectPreset', preset)
    if (preset) {
        dropdownRef.value?.close()
    }
}

/**
 * 选择任务
 */
const handleSelectTask = (task: TaskViewObject) => {
    emit('selectTask', task)
    dropdownRef.value?.close()
}

/**
 * 不关联任务
 */
const handleClearTask = () => {
    emit('clearTask')
    // dropdownRef.value?.close()
}

/**
 * 当前 Tab 对应的关联名称
 */
const currentDependName = computed(() =>
    activeTab.value === 'preset' ? props.presetName : props.taskName
)

/**
 * 取消当前 Tab 的关联
 */
const handleClearDepend = () => {
    if (activeTab.value === 'preset') {
        handleSelectPreset(null)
    } else {
        handleClearTask()
    }
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
            <!-- 当前关联状态栏 -->
            <nue-div theme="depend-status">
                <nue-text theme="depend-status-label">
                    当前{{ activeTab === 'preset' ? '常用专注' : '任务专注' }}关联：
                </nue-text>
                <nue-text theme="depend-status-name">{{ currentDependName || '未关联' }}</nue-text>
                <template v-if="currentDependName">
                    <nue-link theme="depend-status-clear" @click="handleClearDepend">
                        取消关联
                    </nue-link>
                </template>
            </nue-div>
            <!-- 下拉菜单内容 -->
            <nue-main>
                <!-- 常用专注面板 -->
                <nue-content v-if="activeTab === 'preset'" theme="preset-panel">
                    <!-- 常用专注列表 -->
                    <nue-div
                        v-for="preset in presets"
                        :key="preset.id"
                        theme="preset-item"
                        @click="handleSelectPreset(preset)"
                    >
                        <nue-text theme="preset-name">{{ preset.name }}</nue-text>
                        <nue-text theme="preset-duration">
                            {{ formatDuration(preset.duration) }}
                        </nue-text>
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
                            theme="search,small"
                            v-model="viewPreference.getTasksOptions.name"
                            placeholder="搜索任务"
                            icon="search"
                            :debounce-time="360"
                        />
                    </nue-div>
                    <!-- 任务列表 -->
                    <nue-content>
                        <list-view-adapter
                            small
                            :dialog-manager="dialogManager"
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

<style src="./index.css" />
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