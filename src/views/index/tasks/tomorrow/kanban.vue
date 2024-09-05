<template>
    <todo-view-kanbanan
        :filter-info="filterInfo"
        base-route="tasks-tomorrow-kanban"></todo-view-kanbanan>
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
    relativeDate: 'tomorrow'
}
</script>

<style scoped></style>
