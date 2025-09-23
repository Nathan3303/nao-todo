<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useTasksDataStore, useTasksViewStore } from '@/stores/tasks'
import { TodoTable } from '@/components/tasks/table'
import { Loading as LoadingComp, Pager } from '@nao-todo/components'
import { unwrapError } from '@nao-todo/utils'
import type { GetTodosOptions } from '@nao-todo/types'

defineOptions({ name: 'TasksMainBasicViewTable' })

const tasksDataStore = useTasksDataStore()
const tasksViewStore = useTasksViewStore()
const router = useRouter()

const { viewProps, responsiveFlag } = storeToRefs(tasksViewStore)
const { todos, pagination, tags } = storeToRefs(tasksDataStore)
const getTodosOptions = ref<GetTodosOptions>({
    page: 1,
    limit: 10,
    sort: { field: 'createdAt', order: 'asc' }
})
const loading = ref<boolean>(false)
const error = ref<string>('')

const showTodoDetails = (id: string) => {
    router.push({ name: 'tasks-basic', params: { todoId: id as string } })
}

watchEffect(async () => {
    // 重置加载状态
    loading.value = true
    error.value = ''
    // 调用 API 请求数据
    const err = await tasksDataStore.getTodos(getTodosOptions.value)
    loading.value = false
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
                    :sort-options="getTodosOptions.sort"
                    :tags="tags"
                    :todos="todos"
                    @show-todo-details="showTodoDetails"
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
                    :simple="responsiveFlag <= 2"
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
