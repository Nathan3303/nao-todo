<template>
    <todo-view-kanban :filter-info="filterInfo" base-route="tasks-week-kanban"></todo-view-kanban>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { TodoViewKanban } from '@/layers'
import type { TodoFilter } from '@/stores'

const filterInfo: TodoFilter = {
    isDeleted: false,
    relativeDate: 'week'
}
</script>

<style scoped></style>
