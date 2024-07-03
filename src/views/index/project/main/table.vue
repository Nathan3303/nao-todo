<template>
    <nue-div wrap="nowrap" flex style="overflow: hidden">
        <nue-container style="height: 100%">
            <project-table-header
                :filter-info="filterInfo"
                @add-todo="handleAddTodo"
                @filter-todos="handleFilterTodos"
            ></project-table-header>
            <nue-main style="margin: 16px 0 0">
                <nue-div wrap="nowrap" flex style="overflow-y: auto">
                    <project-table-main
                        :todos="todos"
                        :loading="tableLoading"
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
        <template v-if="todo">
            <nue-divider direction="vertical" style="height: 100%"></nue-divider>
            <project-table-details
                :todo="todo"
                @close-todo-details="todo = undefined"
            ></project-table-details>
        </template>
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

defineOptions({ name: 'ProjectTableView' })
const props = defineProps<{ projectId: string }>()

const todoStore = useTodoStore()

const { todo, todos, pageInfo, countInfo, filterInfo } = storeToRefs(todoStore)
const tableLoading = ref(false)
const detailsLoading = ref(false)

async function handleGetTodos() {
    tableLoading.value = true
    await todoStore.getTodosByProjectId(props.projectId)
    tableLoading.value = false
}

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
    await todoStore.getTodoById(id)
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
</script>
