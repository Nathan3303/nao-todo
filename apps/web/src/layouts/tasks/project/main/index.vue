<script setup lang="ts">
import { computed } from 'vue'
import { TableViewAdapter, ListViewAdapter } from '@/layouts/tasks/view-adapters'
import { PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import { inject, onMounted, onUnmounted } from 'vue'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import { ProjectHandler } from '@/handlers/tasks/project-handler'
import type { ProjectViewContext } from '../types'

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
    projectHandler,
    project
} = inject<ProjectViewContext>(PROJECT_VIEW_CONTEXT_KEY)!

// @computed 组件名称
const componentName = computed(() => `${props.viewType || 'table'}-view`)

// Handlers 代理
const updateColumns: ProjectHandler['updateColumns'] = (k, v) => {
    return projectHandler.updateColumns(k, v)
}

// Handlers 代理
const updateSortOptions: ProjectHandler['updateSortOption'] = (f, o) => {
    return projectHandler.updateSortOption(f, o)
}

// @method 更新偏好设置
const updatePreferenceHandler = async () => {
    if (!project.value) return NueMessage.error('项目不存在')
    const err = await projectHandler.savePreference(project.value!.id)
    if (err !== null) return NueMessage.error(unwrapError(err))
    NueMessage.success('保存成功')
}

// @onMounted
onMounted(() => {
    subscriber.subscribe('UpdatePreference', updatePreferenceHandler)
})

// @onUnmounted
onUnmounted(() => {
    subscriber.unsubscribe('UpdatePreference', updatePreferenceHandler)
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
                :clear-sort-options="() => projectHandler.clearSortOption()"
            />
        </nue-content>
    </nue-main>
</template>
