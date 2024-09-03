<template>
    <content-kanban :filter-info="filterInfo" base-route="tasks-all-kanban"></content-kanban>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ContentKanban } from '@/layers/index'
import type { TodoFilter } from '@/stores'

const filterInfo: TodoFilter = {
    isDeleted: false
}
</script>

<style scoped></style>
