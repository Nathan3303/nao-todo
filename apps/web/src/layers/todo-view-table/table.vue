<template>
    <nue-container id="tasks/basic/table" theme="vertical,inner">
        <nue-header
            height="auto"
            :key="$route.path"
            style="box-sizing: border-box; padding-top: 8px"
        >
            <nue-div align="start" justify="space-between" gap="16px">
                <todo-filter-bar
                    :count-info="countInfo"
                    :filter-info="filterInfo"
                    @filter="handleFilter"
                />
                <nue-div justify="end" flex="none" width="fit-content" gap="12px">
                    <nue-button
                        v-if="!disabledCreateTodo"
                        theme="small,primary"
                        icon="plus-circle"
                        @click="handleAddTodo"
                    >
                        新增
                    </nue-button>
                    <list-column-switcher
                        v-model="todoStore.columnOptions"
                        :change="handleChangeColumns"
                    />
                    <nue-tooltip size="small" content="重新请求数据">
                        <nue-button
                            theme="small"
                            icon="refresh"
                            @click="handleRefresh"
                            :loading="tableLoading || !!refreshTimer"
                        />
                    </nue-tooltip>
                </nue-div>
            </nue-div>
        </nue-header>
        <nue-main style="border: none">
            <nue-div wrap="nowrap" flex style="overflow-y: auto">
                <Loading v-if="tableLoading" placeholder="正在加载任务列表..." />
                <todo-table
                    v-else
                    ref="todoTableRef"
                    :todos="todos"
                    :tags="tagStore.tags"
                    :columns="todoStore.columnOptions"
                    :sort-info="sortInfo"
                    @delete-todo="removeTodoWithConfirm"
                    @restore-todo="restoreTodoWithConfirm"
                    @show-todo-details="handleShowTodoDetails"
                    @sort-todo="handleSortTodo"
                    @multi-select="handleMultiSelect"
                />
            </nue-div>
        </nue-main>
        <nue-footer>
            <nue-div align="center" justify="space-between">
                <nue-text size="12px" color="gray" flex>
                    当前列表 {{ countInfo?.length || 0 }} 项， 共计 {{ countInfo?.count || 0 }} 项。
                    <nue-text v-if="isShowMultiDetails" size="12px" color="orange">
                        已选择 {{ multiSelectCount }} 项。
                    </nue-text>
                </nue-text>
                <pager
                    :page="pageInfo.page"
                    :limit="pageInfo.limit"
                    :total-pages="pageInfo.totalPages"
                    @perpage-change="handlePerPageChange"
                    @page-change="handlePageChange"
                />
            </nue-div>
        </nue-footer>
    </nue-container>
    <todo-create-dialog ref="todoCreateDialogRef" :handler="handleCreateTodo" />
</template>

<script setup lang="ts">
import { ref, inject, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTodoStore, useUserStore, useTagStore } from '@/stores'
import { TasksViewContextKey } from '@/views/index/tasks/constants'
import {
    TodoTable,
    Loading,
    TodoFilterBar,
    ListColumnSwitcher,
    Pager,
    TodoCreateDialog
} from '@nao-todo/components'
import {
    createTodoWithOptions,
    removeTodoWithConfirm,
    restoreTodoWithConfirm
} from '@/handlers/todo-handlers'
import type { Columns } from '@nao-todo/components'
import type { Todo, TodoFilter, TodoSortOptions } from '@/stores'
import type { ContentTableProps, ContentTableEmits } from './types'
import type { TodoTableMultiSelectEmitPayload } from '@nao-todo/components/todo/table'
import type { TasksViewContext } from '@/views/index/tasks/types'

defineOptions({ name: 'ContentTableLayer' })
const props = defineProps<ContentTableProps>()
const emit = defineEmits<ContentTableEmits>()

const router = useRouter()
const userStore = useUserStore()
const todoStore = useTodoStore()
const tagStore = useTagStore()

const { user } = storeToRefs(userStore)
const { todos, pageInfo, countInfo, filterInfo, sortInfo } = storeToRefs(todoStore)

const tableLoading = ref(false)
const todoTableRef = ref<InstanceType<typeof TodoTable>>()
const todoCreateDialogRef = ref<InstanceType<typeof TodoCreateDialog>>()
let refreshTimer: number | null = null
const multiSelectCount = ref(0)
const { isShowMultiDetails, handleHideMultiDetails, handleShowMultiDetails } =
    inject<TasksViewContext>(TasksViewContextKey)!

const handleGetTodos = async () => {
    const { filterInfo } = props
    tableLoading.value = true
    await todoStore.get(user.value!.id, filterInfo)
    tableLoading.value = false
}
handleGetTodos()

const handleAddTodo = () => {
    if (!todoCreateDialogRef.value) return
    emit('createTodoByDialog', todoCreateDialogRef.value.show)
}

const handleCreateTodo = async (newTodo: Partial<Todo>) => {
    return await createTodoWithOptions(newTodo.projectId || null, newTodo)
}

const handleChangeColumns = (payload: Columns) => {
    todoStore.mergeColumnOptions(payload)
}

const handleShowTodoDetails = (id: Todo['id']) => {
    const { baseRoute } = props
    router.push({ name: baseRoute, params: { taskId: id } })
    handleHideMultiDetails()
}

const handleMultiSelect = (payload: TodoTableMultiSelectEmitPayload) => {
    const { selectedIds, selectRange } = payload
    if (selectedIds.length === 0 || selectRange.start === -1) {
        handleHideMultiDetails()
        return
    }
    multiSelectCount.value = selectedIds.length
    handleShowMultiDetails(selectedIds)
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
    const userId = user.value!.id
    todoStore.mergeFilterInfo(newTodoFliter)
    await todoStore.get(userId)
}

const handleRefresh = async () => {
    handleHideMultiDetails()
    await handleGetTodos()
}

const handleSortTodo = async (newSortInfo: TodoSortOptions) => {
    const userId = user.value!.id
    sortInfo.value.field = newSortInfo.field
    sortInfo.value.order = newSortInfo.order
    await todoStore.get(userId)
}

watch(
    () => isShowMultiDetails.value,
    (newValue) => !newValue && todoTableRef.value?.resetSelect()
)
</script>

<style scoped>
.nue-main:deep(.nue-main__content) {
    padding: 0px 16px;
}
</style>
