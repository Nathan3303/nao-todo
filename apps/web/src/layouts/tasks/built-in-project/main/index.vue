<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted } from 'vue'
import { TableViewAdapter, ListViewAdapter } from '@/layouts/tasks/view-adapters'
import type { BuiltInProjectViewContext } from '../types'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { BuiltInProjectLayoutHandlers } from '@/handlers/tasks/built-in-project-handler'

defineOptions({
    name: 'TasksMainProjectContent',
    components: {
        'table-view': TableViewAdapter,
        'list-view': ListViewAdapter
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
    profile
} = inject<BuiltInProjectViewContext>(BUILT_IN_PROJECT_VIEW_CONTEXT_KEY)!

// @computed componentName
const componentName = computed(() => `${props.viewType || 'table'}-view`)

// Handlers 代理
const updateColumns: BuiltInProjectLayoutHandlers['updateColumns'] = (k, v) => {
    return builtInProjectHandlers.updateColumns(k, v)
}

// Handlers 代理
const updateSortOptions: BuiltInProjectLayoutHandlers['updateSortOption'] = (f, o) => {
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
                :tags="tags"
                :columns="preference!.columns"
                :get-column-label="getColumnLabel"
                :get-project-name="getProjectName"
                :show-task-details="showTaskDetails"
                :update-columns="updateColumns"
                :update-sort-options="updateSortOptions"
                :clear-sort-options="() => builtInProjectHandlers.clearSortOption()"
            />
        </nue-content>
    </nue-main>
</template>
