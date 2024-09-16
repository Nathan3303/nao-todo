<template>
    <todo-view-table
        :filter-info="filterInfo"
        base-route="tasks-week-table"
        @create-todo="handleCreateTodo"
        @create-todo-by-dialog="handleCreateTodoByDialog"
    ></todo-view-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { TodoViewTable } from '@/layers'
import { createTodoWithOptions } from '@/utils'
import { useUserStore, useTagStore, useProjectStore } from '@/stores'
import moment from 'moment'
import type { Todo, TodoFilter } from '@/stores'
import type { TodoCreateDialogArgs } from '@/components/todo/create-dialog/types'

const userStore = useUserStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()

const filterInfo: TodoFilter = {
    isDeleted: false,
    relativeDate: 'week'
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    const now = moment()
    await createTodoWithOptions(null, {
        name: todoName,
        dueDate: {
            startAt: now.toISOString(),
            endAt: now.add(7, 'd').endOf('d').toISOString(true)
        }
    })
}

const handleCreateTodoByDialog = async (caller: (args: TodoCreateDialogArgs) => void) => {
    const now = moment()
    caller({
        userId: userStore.user!.id,
        projects: projectStore.projects,
        tags: tagStore.tags,
        presetInfo: {
            dueDate: {
                startAt: now.toISOString(),
                endAt: now.add(7, 'd').endOf('d').toISOString(true)
            }
        }
    })
}
</script>

<style scoped></style>
