<template>
    <todo-view-table
        :filter-info="filterInfo"
        base-route="tasks-recycle-table"
        disabled-create-todo
    ></todo-view-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { TodoViewTable } from '@/layers'
import type { TodoFilter } from '@/stores'

const filterInfo: TodoFilter = {
    isDeleted: true
}
</script>

<style scoped></style>
