<script setup lang="ts">
import type { BuiltInProjectHandler } from '@nao-todo/presentation/built-in-project'
import {
    KanbanViewAdapter,
    ListViewAdapter,
    TableViewAdapter,
    type ViewAdapterNoTaskError
} from '@nao-todo/presentation/task'
import type { TableLayoutConfig } from '@nao-todo/presentation/task/components/table/types'
import { TASK_CREATOR_DIALOG_KEY, t, unwrapError } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { computed, inject, onMounted, onUnmounted } from 'vue'
import { BUILT_IN_EMPTY_STATE_MAP } from '../constants'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '../context'

defineOptions({
    name: 'TasksMainProjectContent',
    components: {
        'table-view': TableViewAdapter,
        'list-view': ListViewAdapter,
        'kanban-view': KanbanViewAdapter
    }
})
const props = defineProps<{ viewType: string }>()

// @viewContext
const {
    taskUseCase,
    preference,
    subscriber,
    tags,
    getColumnLabel,
    getProjectName,
    showTaskDetails,
    builtInProjectHandlers,
    builtInProject,
    profile,
    dialogManager
} = inject(BUILT_IN_PROJECT_VIEW_CONTEXT_KEY)!

// @computed componentName
const componentName = computed(() => `${props.viewType || 'table'}-view`)

// @computed 表格布局配置（仅传递 tableId 用于分类固定列逻辑）
const layoutConfig = computed<TableLayoutConfig | undefined>(() => {
    if (!builtInProject.value) return undefined
    return {
        tableId: builtInProject.value.id,
        columns: [],
        version: '1.0.0',
        updatedAt: new Date().toISOString()
    }
})

// Handlers 代理
const updateColumns: BuiltInProjectHandler['updateColumns'] = (k, v) => {
    return builtInProjectHandlers.updateColumns(k, v)
}

// Handlers 代理
const updateSortOptions: BuiltInProjectHandler['updateSortOption'] = (f, o) => {
    return builtInProjectHandlers.updateSortOption(f, o)
}

// @method UpdatePreference 事件订阅
const updatePreference = () => {
    if (!builtInProject.value) return
    const err = builtInProjectHandlers.savePreference(
        profile.value?.email || 'default',
        builtInProject.value!.id
    )
    if (err !== null) {
        NueMessage.error(unwrapError(err))
        return
    }
    NueMessage.success('保存成功')
}

// @method 获取空状态信息
const getNoTaskError = (): ViewAdapterNoTaskError | undefined => {
    if (!builtInProject.value) return undefined
    return BUILT_IN_EMPTY_STATE_MAP[builtInProject.value.id]
}

// @method 创建任务
const createTask = () => {
    const createTaskOptions =
        typeof builtInProject.value?.createTaskOptions === 'function'
            ? builtInProject.value.createTaskOptions()
            : builtInProject.value?.createTaskOptions
    if (!createTaskOptions) return
    console.log(createTaskOptions)
    dialogManager.open(TASK_CREATOR_DIALOG_KEY, createTaskOptions)
}

// @onMounted
onMounted(() => {
    subscriber.subscribe('UpdatePreference', updatePreference)
})

// @onUnmounted
onUnmounted(() => {
    subscriber.unsubscribe('UpdatePreference', updatePreference)
})
</script>

<template>
    <nue-main>
        <nue-content fill overflow="hidden">
            <component
                :is="componentName"
                :task-use-case="taskUseCase"
                :get-tasks-options="preference!.getTasksOptions"
                :subscriber="subscriber"
                :dialog-manager="dialogManager"
                :tags="tags"
                :columns="preference!.columns"
                :layout-config="layoutConfig"
                :get-column-label="getColumnLabel"
                :get-project-name="getProjectName"
                :show-task-details="showTaskDetails"
                :update-columns="updateColumns"
                :update-sort-options="updateSortOptions"
                :clear-sort-options="() => builtInProjectHandlers.clearSortOption()"
                :get-no-task-error="getNoTaskError"
            >
                <template #emptyActions>
                    <nue-button
                        v-if="getNoTaskError()?.isShowTaskCreateButton"
                        theme="primary,small"
                        @click="createTask"
                    >
                        {{ t('task.createTask') }}
                    </nue-button>
                </template>
            </component>
        </nue-content>
    </nue-main>
</template>