<template>
    <content-kanban
        :filter-info="filterInfo"
        base-route="tasks-recycle-kanban"
        disabled-create-todo
    ></content-kanban>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ContentKanban } from '@/layers/index'
import type { TodoFilter } from '@/stores'

const filterInfo: TodoFilter = {
    isDeleted: true
}
</script>

<style scoped></style>
