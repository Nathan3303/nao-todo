<template>
    <todo-view-kanban
        :key="`${$route.meta.type}`"
        :filter-info="filterInfo"
        :base-route="`tasks-${$route.meta.type}-kanban`"
        :disabled-create-todo="$route.meta.type === 'recycle'"
        @create-todo="viewHandler.handleCreateTodo"
        @create-todo-by-dialog="viewHandler.handleCreateTodoByDialog"
    />
    <suspense>
        <router-view />
    </suspense>
</template>

<script setup lang="ts">
import { TodoViewKanban } from '@/layers'
import { computed, inject } from 'vue'
import { TasksBasicViewContentKey } from './constants'
import type { TodoFilter } from '@/stores'
import type { TasksBasicViewContext } from './types'

const tasksBasicViewContext = inject<TasksBasicViewContext>(TasksBasicViewContentKey)

const filterInfo = computed<TodoFilter>(() => {
    const _default = tasksBasicViewContext?.viewContent.value.default.filterInfo
    return _default ?? { isDeleted: false }
})

const viewHandler = computed(() => {
    return tasksBasicViewContext?.viewHandlers.value!
})
</script>

<style scoped></style>
