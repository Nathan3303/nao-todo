<script setup lang="ts">
import { TaskTable } from '@/components/tasks'
import { Pager } from '@nao-todo/components'
import { PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import { computed, inject, onMounted, onUnmounted } from 'vue'
import useTasksLoader from '@/infrastructure/hooks/tasks-view/use-task-loader'
import { useTasksStore } from '@/stores/tasks'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { BuiltInProjectPreference } from '@nao-todo/types'
import type { ProjectViewContext } from '../types'

defineOptions({ name: 'TasksTableAdapter' })

// @dataStore
const tasksStore = useTasksStore()

// @viewContext
const viewContext = inject<ProjectViewContext>(PROJECT_VIEW_CONTEXT_KEY)!

// @hook 待办任务加载器
const taskLoader = useTasksLoader(viewContext.taskUseCase, {
    ...viewContext.preference.value!.getTasksOptions,
    projectId: viewContext.project.value!.id
})

// @method 初始化表格
const initTable = () => taskLoader.loadFirstPage(true)

// @state 任务数据
const tasks = computed(() => {
    return taskLoader.states.taskIds.map((taskId) => tasksStore.getTask(taskId)!).filter(Boolean)
})

// @method 更新页码
const handleUpdatePage = (page: number) => {
    taskLoader.states.pagination.page = page
    taskLoader.loadAndReplace()
}

// @method 更新每页显示数量
const handleUpdatePerPage = (limit: number) => {
    taskLoader.states.pagination.limit = limit
    handleUpdatePage(1)
}

// @method 刷新数据
const refreshDataHandler = () => {
    const newGetTasksOptions = { ...viewContext.preference.value?.getTasksOptions }
    taskLoader.loadAndReplace(newGetTasksOptions)
}

// @method 新增任务 ID 事件订阅
const addNewTaskId = (taskId: string) => {
    const idx = taskLoader.states.taskIds.findIndex((id) => id === taskId)
    if (idx !== -1) return
    taskLoader.states.taskIds.push(taskId)
}

// @method 更新偏好设置
const updatePreferenceHandler = async () => {
    if (!viewContext.project.value) {
        NueMessage.error('项目不存在')
        return
    }
    const newPreference = { ...viewContext.preference.value } as BuiltInProjectPreference
    newPreference.getTasksOptions!.limit = taskLoader.states.pagination.limit
    newPreference.projectId = viewContext.project.value!.id
    const err = await viewContext.tasksViewContext.projectUseCase.savePreference(
        viewContext.project.value!.id,
        newPreference
    )
    if (err !== null) {
        NueMessage.error(unwrapError(err))
        return
    }
    NueMessage.success('保存成功')
}

// @onMounted
onMounted(() => {
    initTable()
    viewContext.subscriber.subscribe('RefreshData', refreshDataHandler)
    viewContext.subscriber.subscribe('UpdatePreference', updatePreferenceHandler)
    viewContext.subscriber.subscribe('AddNewTaskId', addNewTaskId)
})

// @onUnmounted
onUnmounted(() => {
    viewContext.subscriber.unsubscribe('RefreshData', refreshDataHandler)
    viewContext.subscriber.unsubscribe('UpdatePreference', updatePreferenceHandler)
    viewContext.subscriber.unsubscribe('AddNewTaskId', addNewTaskId)
})
</script>

<template>
    <nue-container id="TasksMainTableContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <nue-empty
                    v-if="!viewContext.preference.value"
                    image-size="4rem"
                    image-src="/images/coffee.webp"
                    description="数据加载失败"
                    style="flex: auto"
                />
                <task-table
                    v-else
                    :tags="viewContext.tags.value"
                    :tasks="tasks"
                    :loading="taskLoader.states.loading"
                    :columns="viewContext.preference.value.columns"
                    :get-options="viewContext.preference.value.getTasksOptions"
                    :column-label-getter="viewContext.getColumnLabel"
                    :project-name-getter="viewContext.getProjectName"
                    @show-task-details="viewContext.showTaskDetails"
                    @update-columns="(k, v) => viewContext.projectHandler.updateColumns(k, v)"
                    @update-sort-options="
                        (k, v) => viewContext.projectHandler.updateSortOption(k, v)
                    "
                    @clear-sort-options="() => viewContext.projectHandler.clearSortOption"
                    @delete-task="viewContext.taskUseCase.removeTask"
                    @restore-task="viewContext.taskUseCase.restoreTask"
                />
            </nue-content>
        </nue-main>
        <nue-footer v-if="viewContext">
            <nue-div align="center" justify="space-between" width="100%" wrap="wrap">
                <nue-text flex>
                    当前列表 {{ tasks.length || 0 }} 项， 共计
                    {{ taskLoader.states.pagination.total || 0 }} 项。
                </nue-text>
                <pager
                    :disabled="taskLoader.states.disabled"
                    :limit="taskLoader.states.pagination.limit"
                    :page="taskLoader.states.pagination.page"
                    :total-pages="taskLoader.states.pagination.maxPage"
                    @per-page-change="handleUpdatePerPage"
                    @page-change="handleUpdatePage"
                />
            </nue-div>
        </nue-footer>
    </nue-container>
</template>

<style scoped>
.nue-container#TasksMainTableContainer {
    gap: 0.5rem;

    > .nue-header,
    > .nue-main,
    > .nue-footer {
        padding: 0;
        border: none;
        height: auto;
    }
}
</style>

