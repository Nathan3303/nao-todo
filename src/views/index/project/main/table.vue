<template>
    <nue-div wrap="nowrap" flex style="overflow: hidden; position: relative">
        <nue-container style="width: 100%">
            <project-table-header
                :collumns="tableCollumns"
                :count-info="countInfo"
                :filter-info="filterInfo"
                @add-todo="handleAddTodo"
                @filter-todos="handleFilterTodos"
                @toggle-collumns="handleToggleCollumns"
            ></project-table-header>
            <nue-main style="margin: 16px 0 0">
                <nue-div wrap="nowrap" flex style="overflow-y: auto">
                    <project-table-main
                        :todos="todos"
                        :loading="tableLoading"
                        :collumns="tableCollumns"
                        @show-todo-details="handleShowTodoDetails"
                        @delete-todo="handleDeleteTodo"
                    ></project-table-main>
                </nue-div>
            </nue-main>
            <project-table-footer
                :total="todos.length"
                :page-info="pageInfo"
                :count-info="countInfo"
                @perpage-change="handlePerPageChange"
                @page-change="handlePageChange"
            ></project-table-footer>
        </nue-container>
        <nue-div class="todo-details-wrapper">
            <nue-divider direction="vertical" style="height: 100%"></nue-divider>
            <project-table-details
                :todo="todo"
                @close-todo-details="todo = undefined"
            ></project-table-details>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTodoStore, type Todo, type TodoFilter } from '@/stores/use-todo-store'
import {
    ProjectTableHeader,
    ProjectTableMain,
    ProjectTableDetails,
    ProjectTableFooter
} from '@/layers/index'
import { storeToRefs } from 'pinia'

type ToggleCollumnsPayload = {
    createdAt: boolean
    priority: boolean
    state: boolean
    description: boolean
}

defineOptions({ name: 'ProjectTableView' })
const props = defineProps<{ projectId: string }>()

const todoStore = useTodoStore()

const { todos, pageInfo, countInfo, filterInfo } = storeToRefs(todoStore)
const todo = ref<Todo | undefined>()
const tableLoading = ref(false)
const detailsLoading = ref(false)
const tableCollumns = ref<ToggleCollumnsPayload>({
    createdAt: true,
    priority: true,
    state: true,
    description: false
})

async function handleGetTodos() {
    tableLoading.value = true
    await todoStore.getTodosByProjectId(props.projectId)
    setTimeout(() => {
        tableLoading.value = false
    }, 512)
}
handleGetTodos()

async function handleAddTodo(name: Todo['name']) {
    const { projectId } = props
    const res = await todoStore.createTodo(projectId, name)
    if (res.code === '20000') {
        handleGetTodos()
    }
}

function handleFilterTodos(payload: TodoFilter) {
    const newFilterInfo = { ...filterInfo.value, ...payload }
    // console.log(newFilterInfo)
    filterInfo.value = newFilterInfo
    handleGetTodos()
}

async function handleShowTodoDetails(id: Todo['id']) {
    detailsLoading.value = true
    const response = await todoStore.getTodoById(id)
    if (response.code === '20000') {
        todo.value = response.data
    }
    detailsLoading.value = false
}

async function handleDeleteTodo(id: Todo['id']) {
    await todoStore.remove(id)
}

async function handlePerPageChange(perPage: number) {
    pageInfo.value.page = 1
    pageInfo.value.limit = perPage
    handleGetTodos()
}

async function handlePageChange(page: number) {
    pageInfo.value.page = page
    handleGetTodos()
}

function handleToggleCollumns(payload: any) {
    tableCollumns.value = payload
}
</script>

<style scoped>
.todo-details-wrapper {
    width: 480px;
    height: 100%;
    flex-wrap: nowrap;
}
</style>
