<template>
    <nue-container class="tasks-all-table-view">
        <nue-header style="padding: 0; border: none; height: fit-content" :key="$route.path">
            <nue-div align="start" justify="space-between" gap="16px">
                <todo-filter-bar
                    :count-info="countInfo"
                    :filter-info="filterInfo"
                ></todo-filter-bar>
                <nue-div justify="end" flex="none" width="fit-content" gap="12px">
                    <nue-button theme="small,primary" icon="plus-circle" @click="handleAddTodo">
                        新增
                    </nue-button>
                    <list-column-switcher
                        v-model="columns"
                        :change="handleChangeColumns"
                    ></list-column-switcher>
                </nue-div>
            </nue-div>
        </nue-header>
        <nue-main style="margin: 16px 0 0">
            <!-- <todo-table :todos="AllTodos" :columns="columns"></todo-table> -->
            <nue-div wrap="nowrap" flex style="overflow-y: auto">
                <Loading v-if="tableLoading" placeholder="正在加载任务列表..."></Loading>
                <todo-table
                    v-else
                    ref="todoTableRef"
                    :todos="AllTodos"
                    :columns="columns"
                    @delete-todo="handleDeleteTodo"
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
        <suspense>
            <router-view :key="selectedTaskId"></router-view>
        </suspense>
    </nue-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { TodoTable, Loading, TodoFilterBar, ListColumnSwitcher, Pager } from '@/components'
import { useTodoStore, useUserStore } from '@/stores'
import { NueConfirm, NuePrompt } from 'nue-ui'
import { storeToRefs } from 'pinia'
import type { Columns } from '@/components'
import type { Todo, TodoEvent, TodoFilter } from '@/stores'

const router = useRouter()
const todoStore = useTodoStore()
const userStore = useUserStore()

const { AllTodos, pageInfo, countInfo, filterInfo } = storeToRefs(todoStore)
const { user } = storeToRefs(userStore)
const tableLoading = ref(false)
const selectedTaskId = ref<Todo['id']>('')
const columns = ref<Columns>({
    createdAt: false,
    priority: true,
    state: true,
    description: false,
    updatedAt: false
})

const handleGetTodos = async () => {
    tableLoading.value = true
    await todoStore.getAllTodos(user.value!.id)
    tableLoading.value = false
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
            const { id: userId } = user.value!
            const res = await todoStore.createTodo(userId, value as string, userId)
            if (res.code === '20000') {
            }
        },
        () => {}
    )
}

const handleChangeColumns = (payload: Columns) => {
    columns.value.createdAt = payload.createdAt
    columns.value.priority = payload.priority
    columns.value.state = payload.state
    columns.value.description = payload.description
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

const handleShowTodoDetails = (id: Todo['id']) => {
    if (id === selectedTaskId.value) return
    selectedTaskId.value = id
    router.push({ name: 'tasks-all-table-task', params: { taskId: id } })
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

handleGetTodos()
</script>

<style scoped></style>
