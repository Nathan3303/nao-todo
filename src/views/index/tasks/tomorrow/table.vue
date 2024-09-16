<template>
    <todo-view-table
        :filter-info="filterInfo"
        base-route="tasks-tomorrow-table"
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
    relativeDate: 'tomorrow'
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    const tomorrow = moment().add(1, 'day')
    await createTodoWithOptions(null, {
        name: todoName,
        dueDate: {
            startAt: tomorrow.toISOString(),
            endAt: tomorrow.endOf('day').toISOString()
        }
    })
}

const handleCreateTodoByDialog = async (caller: (args: TodoCreateDialogArgs) => void) => {
    const tomorrow = moment().add(1, 'day')
    caller({
        userId: userStore.user!.id,
        projects: projectStore.projects,
        tags: tagStore.tags,
        presetInfo: {
            dueDate: {
                startAt: tomorrow.toISOString(),
                endAt: tomorrow.endOf('day').toISOString(true)
            }
        }
    })
}
</script>

<style scoped></style>
