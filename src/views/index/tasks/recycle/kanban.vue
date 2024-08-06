<template>
    <content-kanban
        :filter-info="filterInfo"
        base-route="tasks-recycle-kanban"
    ></content-kanban>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ContentKanban } from '@/layers/index'
import { useTodoStore, useUserStore } from '@/stores'
import type { Todo, TodoFilter } from '@/stores'

const userStore = useUserStore()
const todoStore = useTodoStore()

const filterInfo: TodoFilter = {
    isDeleted: true
}
</script>

<style scoped></style>
