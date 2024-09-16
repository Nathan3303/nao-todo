<template>
    <todo-view-kanban
        :filter-info="filterInfo"
        base-route="tasks-recycle-kanban"
        disabled-create-todo
    ></todo-view-kanban>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { TodoViewKanban } from '@/layers'
import type { TodoFilter } from '@/stores'

const filterInfo: TodoFilter = {
    isDeleted: true
}
</script>

<style scoped></style>
