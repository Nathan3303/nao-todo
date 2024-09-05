<template>
    <todo-view-kanban :filter-info="filterInfo" base-route="tasks-all-kanban" />
    <suspense>
        <router-view />
    </suspense>
</template>

<script setup lang="ts">
import { TodoViewKanban } from '@/layers'
import type { TodoFilter } from '@/stores'

const filterInfo: TodoFilter = {
    isDeleted: false
}
</script>

<style scoped></style>
