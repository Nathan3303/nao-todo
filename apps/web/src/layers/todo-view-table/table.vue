<template>
    <nue-container id="tasks/basic/table" theme="vertical,inner">
        <nue-header
            :key="$route.path"
            height="auto"
            style="box-sizing: border-box; padding-top: 8px"
        >
            <nue-div align="start" gap="16px" justify="space-between">
                <todo-filter-bar :filter-options="todoFilterBarOptions" @filter="handleFilter" />
                <nue-div flex="none" gap="12px" justify="end" width="fit-content">
                    <nue-button
                        v-if="!disabledCreateTodo"
                        icon="plus-circle"
                        theme="small,primary"
                        @click="showCreateTodoDialog"
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
        <nue-main style="border: none">
            <nue-div flex style="overflow-y: auto" wrap="nowrap">
                <Loading v-if="tableLoading" placeholder="正在加载任务列表..." />
                <todo-table
                    v-else
                    ref="todoTableRef"
                    :column-options="todoStore.columnOptions"
                    :sort-options="getOptions.sort || { field: '', order: 'asc' }"
                    :tags="tagStore.tags"
                    :todos="todos"
                    @delete-todo="todoStore.deleteTodoWithConfirmation"
                    @restore-todo="todoStore.restoreTodoWithConfirmation"
                    @show-todo-details="showTodoDetails"
                    @sort-todo="sortTodo"
                    @multi-select="handleMultiSelect"
                />
            </nue-div>
        </nue-main>
        <nue-footer>
            <nue-div align="center" justify="space-between">
                <nue-text color="gray" flex size="12px">
                    当前列表 {{ getOverview.countInfo?.length || 0 }} 项， 共计
                    {{ getOverview.countInfo?.count || 0 }} 项。
                    <nue-text
                        v-if="tasksViewStore.multiSelectStates.isShowMultiDetails"
                        color="orange"
                        size="12px"
                    >
                        已选择 {{ multiSelectCount }} 项。
                    </nue-text>
                </nue-text>
                <pager
                    :limit="getOptions.limit"
                    :page="getOverview.pageInfo.page * 1"
                    :total-pages="getOverview.pageInfo.totalPages"
                    @perpage-change="handlePerPageChange"
                    @page-change="handlePageChange"
                />
            </nue-div>
        </nue-footer>
    </nue-container>
    <create-todo-dialog ref="createTodoDialogRef" :handler="todoStore.doCreateTodo" />
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTagStore, useTodoStore } from '@/stores'
import { Loading, Pager, TodoFilterBar } from '@nao-todo/components'
import { TodoTable } from './table'
import { TodoTableColumnSelector } from './column-selector'
import { CreateTodoDialog } from '@/layers'
import { useTasksViewStore } from '@/views/index/tasks/stores'
import type { GetTodosOptions, GetTodosSortOptions, Todo, TodoColumnOptions } from '@nao-todo/types'
import type { CreateTodoDialogCallerArgs } from '@/layers/create-todo-dialog/types'
import type { TodoTableMultiSelectPayload } from './table/types'
import type { TodoFilterOptions } from '@nao-todo/components/todo/filter-bar/types'

defineOptions({ name: 'ContentTableLayer' })
const props = defineProps<{
    baseRoute: string
    disabledCreateTodo?: boolean
}>()
const emit = defineEmits<{
    (event: 'createTodo', todoName: string): void
    (event: 'createTodoByDialog', caller: (args: CreateTodoDialogCallerArgs) => void): void
}>()

const router = useRouter()
const todoStore = useTodoStore()
const tagStore = useTagStore()
const tasksViewStore = useTasksViewStore()

const { todos, getOptions, getOverview } = storeToRefs(todoStore)
const tableLoading = ref(false)
const todoTableRef = ref<InstanceType<typeof TodoTable>>()
const createTodoDialogRef = ref<InstanceType<typeof CreateTodoDialog>>()
let refreshTimer: number | null = null
const multiSelectCount = ref(0)

const todoFilterBarOptions = computed<TodoFilterOptions>(() => {
    return {
        name: getOptions.value.name || '',
        state: getOptions.value.state || '',
        priority: getOptions.value.priority || ''
    }
})

const showCreateTodoDialog = () => {
    if (!createTodoDialogRef.value) return
    emit('createTodoByDialog', createTodoDialogRef.value.show)
}

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

// 处理筛选
const handleFilter = async (newTodoFilter: TodoFilterOptions) => {
    const options: GetTodosOptions = { ...getOptions.value }
    Object.keys(newTodoFilter).forEach((key) => {
        const _k = key as keyof TodoFilterOptions
        if (newTodoFilter[_k]) {
            options[_k] = newTodoFilter[_k]
        } else if (Object.prototype.hasOwnProperty.call(options, _k)) {
            delete options[_k]
        }
    })
    todoStore.updateGetOptions(options)
    await todoStore.doGetTodos()
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
    handleGetTodos()
}

watch(
    () => tasksViewStore.multiSelectStates.isShowMultiDetails,
    (newValue) => !newValue && todoTableRef.value?.resetSelect()
)
</script>

<style scoped>
.nue-main:deep(.nue-main__content) {
    padding: 0 16px;
}
</style>
