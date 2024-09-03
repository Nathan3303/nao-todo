<template>
    <content-kanban
        :key="route.params.projectId.toString()"
        :filter-info="filterInfo"
        base-route="tasks-project-kanban"
    ></content-kanban>
    <suspense>
        <router-view></router-view>
    </suspense>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ContentKanban } from '@/layers/index'
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
