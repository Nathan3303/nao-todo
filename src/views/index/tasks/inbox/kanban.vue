<template>
    <content-kanban :filter-info="filterInfo" base-route="tasks-inbox-kanban-task"></content-kanban>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ContentKanban } from '@/layers/index'
import { useUserStore } from '@/stores'
import type { TodoFilter } from '@/stores'

const userStore = useUserStore()

const filterInfo: TodoFilter = {
    isDeleted: false,
    projectId: userStore.user!.id
}
</script>

<style scoped></style>
