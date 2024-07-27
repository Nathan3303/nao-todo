<template>
    <nue-container class="content-kanban">
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
                        :loading="kanbanLoading || !!refreshTimer"
                    >
                        刷新
                    </nue-button>
                </nue-div>
            </nue-div>
        </nue-header>
        <nue-main>
            <Loading v-if="kanbanLoading" placeholder="正在加载任务看板..."></Loading>
            <template v-else>
                <template v-for="(value, key) in categoriedTodos" :key="key">
                    <content-kanban-column
                        :category="key"
                        :todos="value"
                        @show-todo-details="handleShowTodoDetails"
                        @delete-todo="handleDeleteTodo"
                        @finish-todo="handleFinishTodo"
                        @unfinish-todo="handleUnfinishTodo"
                    ></content-kanban-column>
                </template>
            </template>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { Loading, TodoFilterBar, ListColumnSwitcher } from '@/components'
import { ContentKanbanColumn } from '../kanban-column'
import { useTodoStore, useUserStore } from '@/stores'
import { NueConfirm, NueMessage, NuePrompt } from 'nue-ui'
import type { ContentKanbanProps, ContentKanbanEmits } from './types'
import type { Columns } from '@/components'
import type { Todo, TodoFilter } from '@/stores'

const props = defineProps<ContentKanbanProps>()
const emit = defineEmits<ContentKanbanEmits>()

const router = useRouter()
const userStore = useUserStore()
const todoStore = useTodoStore()

const { todos, countInfo, filterInfo } = storeToRefs(todoStore)
const { user } = storeToRefs(userStore)
const kanbanLoading = ref(false)
const refreshTimer = ref<number | null>(null)
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

const categoriedTodos = computed(() => {
    const result: { [key in Todo['state']]: Todo[] } = {
        todo: [],
        'in-progress': [],
        done: []
    }
    for (const todo of todos.value) {
        result[todo.state].push(todo)
    }
    return result
})

const handleGetTodos = async () => {
    const { filterInfo } = props
    kanbanLoading.value = true
    const res = await todoStore.init(userStore.user!.id, filterInfo)
    kanbanLoading.value = false
    return res
}

const handleShowTodoDetails = (todoId: Todo['id']) => {
    const { baseRoute } = props
    router.push({
        name: baseRoute,
        params: { taskId: todoId }
    })
}

const handleAddTodo = async () => {
    NuePrompt({
        title: '创建任务',
        placeholder: '填写任务名称',
        confirmButtonText: '创建',
        cancelButtonText: '取消',
        validator: (value: any) => value
    }).then(
        (value) => emit('createTodo', value as string),
        () => {}
    )
}

const handleFilter = async (newTodoFliter: TodoFilter) => {
    const userId = user.value!.id
    todoStore.mergeFilterInfo(newTodoFliter)
    await todoStore.get(userId)
}

const handleChangeColumns = (payload: Columns) => {
    columns.value.createdAt = payload.createdAt
    columns.value.priority = payload.priority
    columns.value.state = payload.state
    columns.value.description = payload.description
}

const handleRefresh = async () => {
    if (refreshTimer.value) return
    const res = await handleGetTodos()
    if (res.code === '20000') {
        refreshTimer.value = setTimeout(() => {
            refreshTimer.value = null
        }, 5000)
    }
}

const handleDeleteTodo = async (todoId: Todo['id']) => {
    const userId = user.value!.id
    const res = await todoStore.update2(userId, todoId, { isDeleted: true })
    if (res.code !== '20000') return
    await todoStore.removeLocal(todoId)
    NueMessage.success('任务删除成功')
}

const handleFinishTodo = async (todoId: Todo['id']) => {
    const userId = user.value!.id
    const res = await todoStore.update2(userId, todoId, { state: 'done', isDone: true })
    if (res.code !== '20000') return
    await todoStore.updateLocal(todoId, { state: 'done', isDone: true })
    NueMessage.success('任务更新成功')
}

const handleUnfinishTodo = async (todoId: Todo['id']) => {
    const userId = user.value!.id
    const res = await todoStore.update2(userId, todoId, { isDone: false, state: 'todo' })
    if (res.code !== '20000') return
    await todoStore.updateLocal(todoId, { isDone: false, state: 'todo' })
    NueMessage.success('任务更新成功')
}

handleGetTodos()
</script>

<style scoped>
@import url('./kanban.css');
</style>
