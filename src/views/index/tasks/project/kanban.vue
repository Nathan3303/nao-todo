<template>
    <todo-view-kanban
        :key="route.params.projectId.toString()"
        :filter-info="filterInfo"
        base-route="tasks-project-kanban"
    ></todo-view-kanban>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { TodoViewKanban } from '@/layers'
import { useTodoStore, useUserStore } from '@/stores'
import { useRoute } from 'vue-router'
import type { Todo, TodoFilter } from '@/stores'

const route = useRoute()
const userStore = useUserStore()
const todoStore = useTodoStore()

const filterInfo = computed<TodoFilter>(() => {
    const projectId = route.params.projectId as string
    return {
        isDeleted: false,
        projectId
    }
})
</script>

<style scoped></style>
