<template>
    <content-table
        :key="route.params.tagId.toString()"
        :filter-info="filterInfo"
        base-route="tasks-tag-table"
        :columns="columns"
        @create-todo="handleCreateTodo"
    ></content-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ContentTable } from '@/layers/index'
import { useTodoStore, useUserStore } from '@/stores'
import { useRoute } from 'vue-router'
import { NueMessage } from 'nue-ui'
import { createTodoWithOptions } from '@/utils'
import type { Todo, TodoFilter } from '@/stores'
import type { Columns } from '@/components'

const route = useRoute()
const userStore = useUserStore()
const todoStore = useTodoStore()

const filterInfo = computed<TodoFilter>(() => {
    const tagId = route.params.tagId as string
    return {
        isDeleted: false,
        tagId
    }
})

const columns: Columns = {
    createdAt: false,
    updatedAt: false,
    endAt: true,
    priority: true,
    state: true,
    description: true,
    project: true
}

const handleCreateTodo = async (todoName: Todo['name']) => {
    const tagId = route.params.tagId as string
    await createTodoWithOptions(null, { name: todoName, tags: [tagId] })
}
</script>

<style scoped></style>
