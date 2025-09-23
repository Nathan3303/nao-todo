<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksDataStore, useTasksViewStore } from '@/stores/tasks'
import { TodoTable } from '@/components/tasks/table'
import { Loading as LoadingComp, Pager } from '@nao-todo/components'
import { unwrapError } from '@nao-todo/utils'
import type { GetTodosOptions, Project } from '@nao-todo/types'

defineOptions({ name: 'TasksMainProjectViewTable' })

const tasksDataStore = useTasksDataStore()
const tasksViewStore = useTasksViewStore()

const { viewProps } = storeToRefs(tasksViewStore)
const { todos, pagination, tags } = storeToRefs(tasksDataStore)
const iProjectId = ref<Project['id']>()
const defaultGetTodosOptions: GetTodosOptions = {
    page: 1,
    limit: 10,
    sort: { field: 'createdAt', order: 'asc' }
}
const loading = ref<boolean>(false)
const error = ref<string>('')

watchEffect(async () => {
    // 判断清单 Id 是否相同
    if (iProjectId.value === viewProps.value!.id) return
    // 重置加载状态
    loading.value = true
    error.value = ''
    // 调用 API 请求数据
    const getOptions = {
        ...viewProps.value!.preference.getTodosOptions,
        ...defaultGetTodosOptions,
        projectId: viewProps.value!.id
    }
    const err = await tasksDataStore.getTodos(getOptions)
    loading.value = false
    // 记录已请求的清单 Id，避免重复请求
    iProjectId.value = viewProps.value!.id
    // 保存清单偏好（记录在清单数据中，以便偏好更新时直接传输）
    viewProps.value!.preference.getTodosOptions = { ...getOptions }
    // 处理失败结果
    if (err) {
        error.value = unwrapError(err)
        return
    }
    // 处理成功但结果为空的情况
    if (todos.value && todos.value.length) return
    error.value = '当前暂无待办，放松一下吧!'
})
</script>

<template>
    <loading-comp v-if="loading" />
    <nue-empty
        v-else-if="error"
        image-size="4rem"
        image-src="/images/coffee.webp"
        :description="error"
        style="height: 100%"
    />
    <nue-container v-else id="TasksMainTableContainer">
        <nue-main>
            <nue-content fill>
                <todo-table
                    :column-options="viewProps!.preference.columns"
                    :sort-options="viewProps!.preference.getTodosOptions.sort"
                    :tags="tags"
                    :todos="todos"
                />
            </nue-content>
        </nue-main>
        <nue-footer>
            <nue-div v-if="pagination" align="center" justify="space-between">
                <nue-text color="gray" flex size="12px">
                    当前列表 {{ pagination.limit || 0 }} 项， 共计 {{ pagination.total || 0 }} 项。
                </nue-text>
                <pager
                    :limit="pagination.limit"
                    :page="pagination.page"
                    :total-pages="pagination.maxPage"
                    @per-page-change="(limit) => (getTodosOptions.limit = limit)"
                    @page-change="(page) => (getTodosOptions.page = page)"
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
