<template>
    <nue-container class="tasks-main-table-view" theme="vertical,inner">
        <nue-header :key="$route.path" class="tasks-main-table-view__header">
            <nue-div align="start" gap="16px" justify="space-between">
                <nue-div
                    flex="none"
                    gap="12px"
                    justify="end"
                    width="fit-content"
                >
                    <nue-button
                        v-if="!disabledCreateTodo"
                        icon="plus-circle"
                        theme="small,primary"
                        @click="() => tasksDialogStore.showCreateTodoDialog()"
                    >
                        新增
                    </nue-button>
                    <todo-table-column-selector
                        v-model="todoStore.columnOptions"
                        :change="handleChangeColumns"
                    />
                    <nue-tooltip content="重新请求数据" size="small">
                        <nue-button
                            :loading="tableLoading || !!refreshTimer"
                            icon="refresh"
                            theme="small"
                            @click="handleRefresh"
                        />
                    </nue-tooltip>
                </nue-div>
            </nue-div>
        </nue-header>
        <nue-main class="tasks-main-table-view__main">
            <nue-div flex style="overflow-y: auto" wrap="nowrap">
                <Loading
                    v-if="tableLoading"
                    placeholder="正在加载任务列表..."
                />
                <todo-table
                    v-else
                    ref="todoTableRef"
                    :column-options="todoStore.columnOptions"
                    :sort-options="
                        getOptions.sort || { field: '', order: 'asc' }
                    "
                    :tags="tagStore.tags"
                    :todos="todos"
                    :use-deleted-line="
                        tasksViewStore.viewInfo?.id !== 'recycle'
                    "
                    @delete-todo="handleDeleteTodo"
                    @restore-todo="todoStore.restoreTodoWithConfirmation"
                    @show-todo-details="showTodoDetails"
                    @sort-todo="sortTodo"
                    @multi-select="handleMultiSelect"
                >
                    <template #empty>
                        <nue-empty
                            v-if="tasksViewStore.viewInfo?.id === 'recycle'"
                            description="垃圾桶很干净，没有被删除的待办事项！"
                            image-size="48px"
                            image-src="/images/trash.webp"
                        />
                        <nue-empty
                            v-else
                            description="当前暂无待办事项，放松一下自己吧！"
                            image-size="48px"
                            image-src="/images/coffee.webp"
                        />
                    </template>
                </todo-table>
            </nue-div>
        </nue-main>
        <nue-footer>
            <nue-div align="center" justify="space-between">
                <nue-text
                    v-if="viewStore.responsiveFlag > 0"
                    color="gray"
                    flex
                    size="12px"
                >
                    当前列表 {{ getOverview.countInfo?.length || 0 }} 项， 共计
                    {{ getOverview.countInfo?.count || 0 }} 项。
                    <nue-text
                        v-if="
                            tasksViewStore.multiSelectStates.isShowMultiDetails
                        "
                        color="orange"
                        size="12px"
                    >
                        已选择 {{ multiSelectCount }} 项。
                    </nue-text>
                </nue-text>
                <nue-text v-else color="gray" flex size="12px">
                    {{ getOverview.countInfo?.length || 0 }}
                    /
                    {{ getOverview.countInfo?.count || 0 }}
                    项
                    <nue-text
                        v-if="
                            tasksViewStore.multiSelectStates.isShowMultiDetails
                        "
                        color="orange"
                        size="12px"
                    >
                        （{{ multiSelectCount }}）
                    </nue-text>
                </nue-text>
                <pager
                    :limit="getOptions.limit"
                    :page="getOverview.pageInfo.page * 1"
                    :total-pages="getOverview.pageInfo.totalPages"
                    :simple="viewStore.responsiveFlag < 1"
                    @per-page-change="handlePerPageChange"
                    @page-change="handlePageChange"
                />
            </nue-div>
        </nue-footer>
    </nue-container>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTagStore, useTodoStore, useViewStore } from '@/stores'
import { Loading, Pager } from '@nao-todo/components'
import { TodoTable } from './table'
import { TodoTableColumnSelector } from './column-selector'
import { useTasksDialogStore, useTasksViewStore } from '@/views/index/tasks'
import type {
    GetTodosSortOptions,
    Todo,
    TodoColumnOptions
} from '@nao-todo/types'
import type { TodoTableMultiSelectPayload } from './table/types'
import './table.css'

defineOptions({ name: 'ContentTableLayer' })
const props = defineProps<{
    baseRoute: string
    disabledCreateTodo?: boolean
}>()

const router = useRouter()
const todoStore = useTodoStore()
const viewStore = useViewStore()
const tagStore = useTagStore()
const tasksViewStore = useTasksViewStore()
const tasksDialogStore = useTasksDialogStore()

const { todos, getOptions, getOverview } = storeToRefs(todoStore)
const tableLoading = ref(true)
const todoTableRef = ref<InstanceType<typeof TodoTable>>()
let refreshTimer: number | null = null
const multiSelectCount = ref(0)

const showTodoDetails = (id: Todo['id']) => {
    const { baseRoute } = props
    router.push({ name: baseRoute, params: { taskId: id } })
    tasksViewStore.hideMultiDetails()
}

const handleGetTodos = async () => {
    tableLoading.value = true
    await todoStore.doGetTodos()
    tableLoading.value = false
}
handleGetTodos()

const handleDeleteTodo = async (todoId: Todo['id']) => {
    await todoStore.deleteTodoWithConfirmation(todoId)
}

const handleChangeColumns = (options: TodoColumnOptions) => {
    todoStore.updateColumnOptions(options)
}

const handleMultiSelect = (payload: TodoTableMultiSelectPayload) => {
    const { selectedIds, selectRange } = payload
    if (selectedIds.length === 0 || selectRange.start === -1) {
        tasksViewStore.hideMultiDetails()
        return
    }
    multiSelectCount.value = selectedIds.length
    tasksViewStore.showMultiDetails(selectedIds)
}

const handlePerPageChange = (perPage: number) => {
    getOptions.value.page = 1
    getOptions.value.limit = perPage
    handleGetTodos()
}

const handlePageChange = (page: number) => {
    getOptions.value.page = page
    handleGetTodos()
}

const handleRefresh = async () => {
    tasksViewStore.hideMultiDetails()
    await handleGetTodos()
}

const sortTodo = (newSortInfo: GetTodosSortOptions) => {
    getOptions.value.sort = newSortInfo
    todoStore.doGetTodos()
}

watch(
    () => tasksViewStore.multiSelectStates.isShowMultiDetails,
    (newValue) => !newValue && todoTableRef.value?.resetSelect()
)
</script>
