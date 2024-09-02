<template>
    <nue-container class="content-table">
        <nue-header style="padding: 0; border: none; height: fit-content" :key="$route.path">
            <nue-div align="start" justify="space-between" gap="16px">
                <todo-filter-bar
                    :count-info="countInfo"
                    :filter-info="filterInfo"
                    @filter="handleFilter"
                ></todo-filter-bar>
                <nue-div justify="end" flex="none" width="fit-content" gap="12px">
                    <nue-button theme="small,primary" icon="plus-circle" @click="handleAddTodo">
                        新增
                    </nue-button>
                    <list-column-switcher
                        v-model="columns"
                        :change="handleChangeColumns"
                    ></list-column-switcher>
                    <nue-button
                        theme="small"
                        icon="refresh"
                        @click="handleRefresh"
                        :loading="tableLoading || !!refreshTimer"
                    />
                </nue-div>
            </nue-div>
        </nue-header>
        <nue-main style="margin: 16px 0 0">
            <nue-div wrap="nowrap" flex style="overflow-y: auto">
                <Loading v-if="tableLoading" placeholder="正在加载任务列表..."></Loading>
                <todo-table
                    v-else
                    ref="todoTableRef"
                    :todos="todos"
                    :columns="columns"
                    @delete-todo="removeTodoWithConfirm"
                    @restore-todo="restoreTodoWithConfirm"
                    @show-todo-details="handleShowTodoDetails"
                ></todo-table>
            </nue-div>
        </nue-main>
        <nue-footer style="padding: 4px; border: none; height: fit-content">
            <nue-div align="center" justify="space-between">
                <nue-text size="12px" color="gray" flex>
                    当前列表 {{ countInfo?.length || 0 }} 项， 共计 {{ countInfo?.count || 0 }} 项。
                </nue-text>
                <pager
                    :page="pageInfo.page"
                    :limit="pageInfo.limit"
                    :total-pages="pageInfo.totalPages"
                    @perpage-change="handlePerPageChange"
                    @page-change="handlePageChange"
                ></pager>
            </nue-div>
        </nue-footer>
    </nue-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { TodoTable, Loading, TodoFilterBar, ListColumnSwitcher, Pager } from '@/components'
import { useTodoStore, useUserStore } from '@/stores'
import { storeToRefs } from 'pinia'
import {
    removeTodoWithConfirm,
    restoreTodoWithConfirm,
    createTodoWithPrompt
} from '@/utils/todo-handlers'
import type { Columns } from '@/components'
import type { Todo, TodoFilter } from '@/stores'
import type { ContentTableProps, ContentTableEmits } from './types'

defineOptions({ name: 'ContentTableLayer' })
const props = defineProps<ContentTableProps>()
const emit = defineEmits<ContentTableEmits>()

const route = useRoute()
const router = useRouter()
const todoStore = useTodoStore()
const userStore = useUserStore()

const { todos, pageInfo, countInfo, filterInfo } = storeToRefs(todoStore)
const { user } = storeToRefs(userStore)
const tableLoading = ref(false)
const selectedTaskId = ref<Todo['id']>('')
const columns = ref<Columns>(
    props.columns || {
        state: true,
        priority: true,
        project: true,
        description: true,
        endAt: true,
        createdAt: false,
        updatedAt: false
    }
)
const refreshTimer = ref<number | null>(null)

const handleGetTodos = async () => {
    const { filterInfo } = props
    tableLoading.value = true
    const res = await todoStore.initialize(user.value!.id, filterInfo)
    tableLoading.value = false
    return res
}

const handleAddTodo = async () => {
    const projectId = route.params.projectId as Todo['projectId'];
    await createTodoWithPrompt(projectId)
}

const handleChangeColumns = (payload: Columns) => {
    columns.value.createdAt = payload.createdAt
    columns.value.priority = payload.priority
    columns.value.state = payload.state
    columns.value.description = payload.description
}

const handleShowTodoDetails = (id: Todo['id']) => {
    if (id === selectedTaskId.value) return
    const { baseRoute } = props
    selectedTaskId.value = id
    router.push({ name: baseRoute, params: { taskId: id } })
}

const handlePerPageChange = (perPage: number) => {
    pageInfo.value.page = 1
    pageInfo.value.limit = perPage
    handleGetTodos()
}

const handlePageChange = (page: number) => {
    pageInfo.value.page = page
    handleGetTodos()
}

const handleFilter = async (newTodoFliter: TodoFilter) => {
    console.log(newTodoFliter)
    const userId = user.value!.id
    todoStore.mergeFilterInfo(newTodoFliter)
    await todoStore.get(userId)
}

const handleRefresh = async () => {
    if (refreshTimer.value) return
    const res = await handleGetTodos()
}

handleGetTodos()
</script>
