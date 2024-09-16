<template>
    <todo-view-kanban :filter-info="filterInfo" base-route="tasks-today-kanban"></todo-view-kanban>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { TodoViewKanban } from '@/layers'
import { useTodoStore, useUserStore } from '@/stores'
import type { Todo, TodoFilter } from '@/stores'

const userStore = useUserStore()
const todoStore = useTodoStore()

const filterInfo: TodoFilter = {
    isDeleted: false,
    relativeDate: 'today'
}
</script>

<style scoped></style>
