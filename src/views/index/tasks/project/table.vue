<template>
    <content-table
        :key="route.params.projectId.toString()"
        :filter-info="filterInfo"
        base-route="tasks-project-table"
        :columns="columns"
        @create-todo="handleCreateTodo"
    ></content-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ContentTable } from '@/layers/index'
import { useRoute } from 'vue-router'
import { createTodoWithOptions } from '@/utils'
import type { Todo, TodoFilter } from '@/stores'
import type { Columns } from '@/components'

const route = useRoute()

const filterInfo = computed<TodoFilter>(() => {
    const projectId = route.params.projectId as string
    return {
        isDeleted: false,
        projectId
    }
})

const columns: Columns = {
    createdAt: false,
    updatedAt: false,
    endAt: true,
    priority: true,
    state: true,
    description: true
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    const projectId = route.params.projectId as string
    await createTodoWithOptions(projectId, { name: todoName })
}
</script>
