<script setup lang="ts">
import { TaskTable } from '@/components/tasks'
import { Pager } from '@nao-todo/components'
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import { computed, inject, onMounted, onUnmounted, watch } from 'vue'
import useTasksLoader from '@/infrastructure/hooks/tasks-view/use-task-loader'
import { useTasksStore } from '@/stores/tasks'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { BuiltInProjectPreference } from '@nao-todo/types'
import type { BuiltInProjectViewContext } from '../types'

defineOptions({ name: 'TasksTableAdapter' })

// @dataStore
const tasksStore = useTasksStore()

// @viewContext
const viewContext = inject<BuiltInProjectViewContext>(BUILT_IN_PROJECT_VIEW_CONTEXT_KEY)!

// @hook 待办任务加载器
const taskLoader = useTasksLoader(
    viewContext.taskUseCase,
    viewContext.preference.value!.getTasksOptions
)

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

// @method UpdatePreference 事件订阅
const updatePreference = () => {
    if (!viewContext.builtInProject.value) return
    const newPreference = { ...viewContext.preference.value } as BuiltInProjectPreference
    newPreference.getTasksOptions!.limit = taskLoader.states.pagination.limit
    newPreference.projectId = viewContext.builtInProject.value!.id
    const err = viewContext.tasksViewContext.builtInProjectUseCase.savePreference(
        viewContext.profile.value?.email || 'default',
        viewContext.builtInProject.value!.id,
        newPreference
    )
    if (err !== null) {
        NueMessage.error(unwrapError(err))
        return
    }
    NueMessage.success('保存成功')
}

// @watch 监听获取选项变化
watch(
    () => viewContext.preference.value?.getTasksOptions,
    (newOptions) => taskLoader.loadAndReplace(newOptions),
    { deep: true }
)

// @onMounted
onMounted(() => {
    initTable()
    viewContext.subscriber.subscribe('RefreshData', taskLoader.loadAndReplace)
    viewContext.subscriber.subscribe('UpdatePreference', updatePreference)
})

// @onUnmounted
onUnmounted(() => {
    viewContext.subscriber.unsubscribe('RefreshData', taskLoader.loadAndReplace)
    viewContext.subscriber.unsubscribe('UpdatePreference', updatePreference)
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
                    style="height: 100%"
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
                    @update-columns="
                        (k, v) => viewContext.builtInProjectHandlers.updateColumns(k, v)
                    "
                    @update-sort-options="
                        (k, v) => viewContext.builtInProjectHandlers.updateSortOption(k, v)
                    "
                    @clear-sort-options="() => viewContext.builtInProjectHandlers.clearSortOption"
                    @delete-task="(taskId) => viewContext.taskUseCase.removeTask(taskId)"
                    @restore-task="(taskId) => viewContext.taskUseCase.restoreTask(taskId)"
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

