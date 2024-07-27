<template>
    <nue-container class="project-recycle-bin-view">
        <nue-header>
            <nue-div vertical gap="4px">
                <nue-div justify="space-between" wrap="nowrap">
                    <nue-div align="center" width="fit-content" gap="8px">
                        <tooltip :content="`${pav ? '收起' : '展开'}菜单侧栏`" align="left">
                            <nue-button
                                theme="icon-only"
                                :icon="pav ? 'menu-close' : 'menu-open'"
                                @click="handleHideProjectAside"
                            ></nue-button>
                        </tooltip>
                        <nue-text size="24px">垃圾桶</nue-text>
                    </nue-div>
                    <nue-div align="center" justify="end" width="fit-content"></nue-div>
                </nue-div>
                <nue-text size="14px" color="gray">
                    "垃圾桶" 板块存放着您已删除的任务，您可以在这里选择性地恢复已删除的任务。
                </nue-text>
            </nue-div>
        </nue-header>
        <nue-main>
            <nue-container>
                <nue-header
                    style="padding: 0; border: none; height: fit-content"
                    :key="$route.path"
                >
                    <nue-div align="start" justify="space-between" gap="16px">
                        <todo-filter-bar
                            :count-info="countInfo"
                            :filter-info="filterInfo"
                            @filter="handleFilterTodos"
                        ></todo-filter-bar>
                        <nue-div justify="end" flex="none" width="fit-content" gap="12px">
                            <list-column-switcher
                                v-model="columns"
                                :change="handleChangeColumns"
                            ></list-column-switcher>
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
                            empty-message="暂无被删除的任务。"
                            @delete-todo="handleRestoreTodo"
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
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
    Tooltip,
    TodoFilterBar,
    ListColumnSwitcher,
    TodoTable,
    Loading,
    Pager,
    TodoDetails
} from '@/components'
import { useViewStore, useTodoStore, useUserStore } from '@/stores'
import { storeToRefs } from 'pinia'
import type { Columns } from '@/components'
import type { Todo, TodoFilter, TodoEvent } from '@/stores'
import { NueMessage } from 'nue-ui'

const viewStore = useViewStore()
const todoStore = useTodoStore()
const userStore = useUserStore()

const { todos, countInfo, filterInfo, pageInfo } = storeToRefs(todoStore)
const { user } = storeToRefs(userStore)
const tableLoading = ref(false)
const detailsLoading = ref(false)
const todo = ref<Todo | undefined>()
const todoTableRef = ref<InstanceType<typeof TodoTable>>()
const columns = ref<Columns>({
    createdAt: false,
    updatedAt: false,
    priority: true,
    state: true,
    description: true
})

const { projectAsideVisible: pav } = storeToRefs(viewStore)

const handleHideProjectAside = () => {
    viewStore.toggleProjectAsideVisible()
}

const getDeletedTodos = async (isReload = false) => {
    const userId = user.value!.id
    tableLoading.value = true
    filterInfo.value.isDeleted = true
    if (isReload) {
        await todoStore.get(userId)
    } else {
        await todoStore.init(userId, { isDeleted: true })
    }
    tableLoading.value = false
    filterInfo.value.isDeleted = false
}

const handleFilterTodos = (payload: TodoFilter) => {
    const newFilterInfo = { ...filterInfo.value, ...payload }
    filterInfo.value = newFilterInfo
    getDeletedTodos(true)
}

const handleChangeColumns = (payload: Columns) => {
    columns.value.createdAt = payload.createdAt
    columns.value.priority = payload.priority
    columns.value.state = payload.state
    columns.value.description = payload.description
}

const handleRestoreTodo = async (todoId: string) => {
    const userId = user.value!.id
    const response = await todoStore.update2(userId, todoId, {
        isDeleted: false
    })
    if (response.code === '20000') {
        NueMessage.success('任务恢复成功')
        getDeletedTodos(true)
    }
}

const handleShowTodoDetails = async (id: Todo['id']) => {
    detailsLoading.value = true
    const response = await todoStore.getTodoById(id)
    if (response.code === '20000') {
        todo.value = response.data
    }
    detailsLoading.value = false
}

const handlePerPageChange = (perPage: number) => {
    pageInfo.value.page = 1
    pageInfo.value.limit = perPage
    getDeletedTodos(true)
}

const handlePageChange = (page: number) => {
    pageInfo.value.page = page
    getDeletedTodos(true)
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

await getDeletedTodos()
</script>

<style scoped>
.project-recycle-bin-view {
    width: 100%;
    height: 100%;
    gap: 16px;

    .nue-header {
        padding: 0px;
        height: auto;
        border-bottom: none;
    }

    .nue-main {
        gap: 16px;
    }
}

.todo-details-wrapper {
    width: 520px;
    height: 100%;
    flex-wrap: nowrap;
    transition: all 0.32s ease-in-out;
    background-color: white;
    overflow: hidden;
}

@media screen and (max-width: 1600px) {
    .todo-details-wrapper {
        width: 440px;
        height: 100%;
        flex-wrap: nowrap;
    }
}

@media screen and (max-width: 1400px) {
    .todo-details-wrapper {
        width: 360px;
        height: 100%;
        flex-wrap: nowrap;
    }
}

@media screen and (max-width: 1200px) {
    .todo-details-wrapper {
        width: 440px;
        transform: translateX(0);
        position: absolute;
        right: 0;
        box-shadow: -2px 0px 10px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    }

    .todo-details-wrapper[data-empty='true'] {
        transform: translateX(100%);
        overflow: hidden;
        box-shadow: none;
    }
}
</style>
