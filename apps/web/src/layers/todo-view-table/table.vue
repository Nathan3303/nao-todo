<template>
    <nue-container id="tasks/basic/table" theme="vertical,inner">
        <nue-header
            :key="$route.path"
            height="auto"
            style="box-sizing: border-box; padding-top: 8px"
        >
            <nue-div align="start" justify="space-between" gap="16px">
                <todo-filter-bar
                    :count-info="getOverview.countInfo"
                    :filter-info="getOptions"
                    @filter="handleFilter"
                />
                <nue-div justify="end" flex="none" width="fit-content" gap="12px">
                    <nue-button
                        v-if="!disabledCreateTodo"
                        theme="small,primary"
                        icon="plus-circle"
                        @click="showCreateTodoDialog"
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
                    :sort-info="getOptions.sort || { field: 'id', order: 'desc' }"
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
                <nue-text size="12px" color="gray" flex>
                    当前列表 {{ getOverview.countInfo?.length || 0 }} 项， 共计
                    {{ getOverview.countInfo?.count || 0 }} 项。
                    <nue-text
                        v-if="tasksViewStore.multiSelectStates.isShowMultiDetails"
                        size="12px"
                        color="orange"
                    >
                        已选择 {{ multiSelectCount }} 项。
                    </nue-text>
                </nue-text>
                <pager
                    :page="getOverview.pageInfo.page"
                    :limit="getOptions.limit"
                    :total-pages="getOverview.pageInfo.totalPages"
                    @perpage-change="handlePerPageChange"
                    @page-change="handlePageChange"
                />
            </nue-div>
        </nue-footer>
    </nue-container>
    <create-todo-dialog ref="createTodoDialogRef" :handler="todoStore.doCreateTodo" />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useTodoStore, useTagStore } from '@/stores'
import { TodoTable, Loading, TodoFilterBar, ListColumnSwitcher, Pager } from '@nao-todo/components'
import { CreateTodoDialog } from '@/layers'
import { useTasksViewStore } from '@/views/index/tasks/stores'
import type { Todo, GetTodosOptions, TodoColumnOptions } from '@nao-todo/types'
import type { ContentTableProps, ContentTableEmits } from './types'
import type { TodoTableMultiSelectEmitPayload } from '@nao-todo/components/todo/table'

defineOptions({ name: 'ContentTableLayer' })
const props = defineProps<ContentTableProps>()
const emit = defineEmits<ContentTableEmits>()

const router = useRouter()
const todoStore = useTodoStore()
const tagStore = useTagStore()
const tasksViewStore = useTasksViewStore()

const { todos, getOptions, getOverview } = storeToRefs(todoStore)
const { viewInfo } = storeToRefs(tasksViewStore)
const tableLoading = ref(false)
const todoTableRef = ref<InstanceType<typeof TodoTable>>()
const createTodoDialogRef = ref<InstanceType<typeof CreateTodoDialog>>()
let refreshTimer: number | null = null
const multiSelectCount = ref(0)

const handleFilter = async (newTodoFliter: GetTodosOptions) => {
    todoStore.updateGetOptions(newTodoFliter)
    await todoStore.doGetTodos()
}

const doFirstLoad = async () => {
    if (!viewInfo.value) return
    const { preference } = viewInfo.value
    console.log(viewInfo.value.preference)
    todoStore.setGetOptionsByPreference(preference)
    await todoStore.doGetTodos()
}
doFirstLoad()

const handleGetTodos = async () => {
    const { filterInfo } = props
    tableLoading.value = true
    await handleFilter(filterInfo)
    tableLoading.value = false
}

const showCreateTodoDialog = () => {
    if (!createTodoDialogRef.value) return
    emit('createTodoByDialog', createTodoDialogRef.value.show)
}

const handleChangeColumns = (payload: TodoColumnOptions) => {
    todoStore.updateColumnOptions(payload)
}

const showTodoDetails = (id: Todo['id']) => {
    const { baseRoute } = props
    router.push({ name: baseRoute, params: { taskId: id } })
    tasksViewStore.hideMultiDetails()
}

const handleMultiSelect = (payload: TodoTableMultiSelectEmitPayload) => {
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

const sortTodo = async (newSortInfo: GetTodosOptions['sort']) => {
    getOptions.value.sort = newSortInfo
    await todoStore.doGetTodos()
}

watch(
    () => tasksViewStore.multiSelectStates.isShowMultiDetails,
    (newValue) => !newValue && todoTableRef.value?.resetSelect()
)
</script>

<style scoped>
.nue-main:deep(.nue-main__content) {
    padding: 0px 16px;
}
</style>
