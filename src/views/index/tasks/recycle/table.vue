<template>
    <content-table
        :filter-info="filterInfo"
        base-route="tasks-recycle-table"
        disabled-create-todo
    ></content-table>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ContentTable } from '@/layers/index'
import type { TodoFilter } from '@/stores'

const filterInfo: TodoFilter = {
    isDeleted: true
}
</script>

<style scoped></style>
