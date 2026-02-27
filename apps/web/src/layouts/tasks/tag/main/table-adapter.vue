<script setup lang="ts">
import { TaskTable } from '@/components/tasks'
import { Pager } from '@nao-todo/components'
import { TAG_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import { computed, inject, onMounted, onUnmounted } from 'vue'
import useTasksLoader from '@/infrastructure/hooks/tasks-view/use-task-loader'
import { useTasksStore } from '@/stores/tasks'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'
import type { TagPreference } from '@nao-todo/types'
import type { TagViewContext } from '../types'

defineOptions({ name: 'TasksTableAdapter' })

// @dataStore
const tasksStore = useTasksStore()

// @viewContext
const viewContext = inject<TagViewContext>(TAG_VIEW_CONTEXT_KEY)!

// @hook 待办任务加载器
const taskLoader = useTasksLoader(viewContext.taskUseCase, {
    ...viewContext.preference.value!.getTasksOptions,
    tagId: viewContext.tag.value!.id
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

// @watch 监听获取选项变化
// watch(
//     () => viewContext.preference.value?.getTasksOptions,
//     (newOptions) => taskLoader.loadAndReplace(newOptions),
//     { deep: true }
// )

// @method 刷新数据
const refreshDataHandler = () => {
    const newGetTasksOptions = { ...viewContext.preference.value?.getTasksOptions }
    taskLoader.loadAndReplace(newGetTasksOptions)
}

// @method 更新偏好设置
const updatePreferenceHandler = async () => {
    if (!viewContext.tag.value) {
        NueMessage.error('标签不存在')
        return
    }
    const newPreference = { ...viewContext.preference.value } as TagPreference
    newPreference.getTasksOptions!.limit = taskLoader.states.pagination.limit
    newPreference.tagId = viewContext.tag.value!.id
    const err = await viewContext.tasksViewContext.tagUseCase.savePreference(
        viewContext.tag.value!.id,
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
    // console.log('TasksTableAdapter mounted')
    initTable()
    viewContext.subscriber.subscribe('RefreshData', refreshDataHandler)
    viewContext.subscriber.subscribe('UpdatePreference', updatePreferenceHandler)
})

// @onUnmounted
onUnmounted(() => {
    // console.log('TasksTableAdapter unmounted')
    viewContext.subscriber.unsubscribe('RefreshData', refreshDataHandler)
    viewContext.subscriber.unsubscribe('UpdatePreference', updatePreferenceHandler)
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
                    @update-columns="(k, v) => viewContext.tagHandler.updateColumns(k, v)"
                    @update-sort-options="(k, v) => viewContext.tagHandler.updateSortOption(k, v)"
                    @clear-sort-options="() => viewContext.tagHandler.clearSortOption"
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

