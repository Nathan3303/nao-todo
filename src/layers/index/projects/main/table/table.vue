<template>
    <nue-div wrap="nowrap" flex style="overflow: hidden; position: relative">
        <nue-container>
            <nue-header style="padding: 0; border: none; height: fit-content" :key="$route.path">
                <nue-div align="start" justify="space-between" gap="16px">
                    <todo-filter-bar
                        :count-info="countInfo"
                        :filter-info="filterInfo"
                        @filter="handleFilterTodos"
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
                            icon="switch"
                            @click="handleSwitchView"
                        ></nue-button>
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
                        @delete-todo="handleDeleteTodo"
                        @show-todo-details="handleShowTodoDetails"
                    ></todo-table>
                </nue-div>
            </nue-main>
            <nue-footer style="padding: 4px; border: none; height: fit-content">
                <nue-div align="center" justify="space-between">
                    <nue-text size="12px" color="gray" flex>
                        当前列表 {{ countInfo?.length || 0 }} 项， 共计
                        {{ countInfo?.count || 0 }} 项。
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
        <nue-div class="todo-details-wrapper" :data-empty="!todo">
            <nue-divider direction="vertical" style="height: 100%"></nue-divider>
            <todo-details
                :todo="todo"
                :loading="detailsLoading"
                @close-todo-details="handleCloseTodoDetails"
                @create-todo-event="handleCreateTodoEvent"
                @update-todo-event="handleUpdateTodoEvent"
            ></todo-details>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTodoStore, type Todo, type TodoEvent, type TodoFilter } from '@/stores/use-todo-store'
import { storeToRefs } from 'pinia'
import { NueConfirm, NueMessage, NuePrompt } from 'nue-ui'
import {
    TodoTable,
    Loading,
    TodoFilterBar,
    ListColumnSwitcher,
    Pager,
    type Columns,
    TodoDetails
} from '@/components'
import { useUserStore, useViewStore } from '@/stores'

defineOptions({ name: 'ProjectsMainList' })
const props = defineProps<{ projectId: string }>()

const todoStore = useTodoStore()
const userStore = useUserStore()
const viewStore = useViewStore()

const { todos, pageInfo, countInfo, filterInfo } = storeToRefs(todoStore)
const { user } = storeToRefs(userStore)
const { simpleProjectHeader } = storeToRefs(viewStore)
const todo = ref<Todo | undefined>()
const tableLoading = ref(false)
const detailsLoading = ref(false)
const columns = ref<Columns>({
    createdAt: false,
    updatedAt: false,
    priority: true,
    state: true,
    description: true
})
const todoTableRef = ref<InstanceType<typeof TodoTable>>()

const handleGetTodos = async () => {
    tableLoading.value = true
    await todoStore.getTodosByProjectId(props.projectId)
    setTimeout(() => {
        tableLoading.value = false
    }, 512)
}

const handleFilterTodos = (payload: TodoFilter) => {
    const newFilterInfo = { ...filterInfo.value, ...payload }
    filterInfo.value = newFilterInfo
    handleGetTodos()
}

const handleChangeColumns = (payload: Columns) => {
    columns.value.createdAt = payload.createdAt
    columns.value.priority = payload.priority
    columns.value.state = payload.state
    columns.value.description = payload.description
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

const handleAddTodo = async () => {
    NuePrompt({
        title: '创建任务',
        placeholder: '填写任务名称',
        confirmButtonText: '创建',
        cancelButtonText: '取消',
        validator: (value: any) => value
    }).then(
        async (value) => {
            const { projectId } = props
            const { id: userId } = user.value!
            const res = await todoStore.createTodo(projectId, value as string, userId)
            if (res.code === '20000') {
                handleGetTodos()
            }
        },
        () => {}
    )
}

const handleShowTodoDetails = async (id: Todo['id']) => {
    detailsLoading.value = true
    const response = await todoStore.getTodoById(id)
    if (response.code === '20000') {
        todo.value = response.data
    }
    detailsLoading.value = false
}

const handleDeleteTodo = async (id: Todo['id']) => {
    NueConfirm({
        title: '删除任务',
        content: '确定要删除该任务吗？',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
    }).then(
        async () => {
            await todoStore.remove(id)
        },
        () => {}
    )
}

const handleCloseTodoDetails = () => {
    todo.value = void 0
    todoTableRef.value?.reset()
}

const handleCreateTodoEvent = async (todoId: Todo['id'], newTodoEvent: Partial<TodoEvent>) => {
    const response = await todoStore.createTodoEvent(todoId, newTodoEvent)
}

const handleUpdateTodoEvent = async (id: TodoEvent['id'], newTodoEvent: Partial<TodoEvent>) => {
    const response = await todoStore.updateTodoEvent(id, newTodoEvent)
}

const handleSwitchView = () => {
    viewStore.toggleSimpleProjectHeader()
}

handleGetTodos()
</script>

<style scoped>
@import url('./table.css');
</style>
