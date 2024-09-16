<template>
    <todo-view-kanban :filter-info="filterInfo" base-route="tasks-inbox-kanban"></todo-view-kanban>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { TodoViewKanban } from '@/layers'
import { useUserStore } from '@/stores'
import type { TodoFilter } from '@/stores'

const userStore = useUserStore()

const filterInfo: TodoFilter = {
    isDeleted: false,
    projectId: userStore.user!.id
}
</script>

<style scoped></style>
