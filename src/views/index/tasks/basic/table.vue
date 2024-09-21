<template>
    <todo-view-table
        :key="`${$route.meta.type}`"
        :filter-info="filterInfo"
        :base-route="`tasks-${$route.meta.type}-table`"
        :disabled-create-todo="$route.meta.type === 'recycle'"
        @create-todo="viewHandler.handleCreateTodo"
        @create-todo-by-dialog="viewHandler.handleCreateTodoByDialog"
    />
    <suspense>
        <router-view />
    </suspense>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { TodoViewTable } from '@/layers'
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
