<template>
    <todo-view-kanban
        :key="`${$route.meta.type}`"
        :filter-info="viewInfo.default.filterInfo"
        :base-route="`tasks-${$route.meta.type}-kanban`"
        :disabled-create-todo="$route.meta.type === 'recycle'"
        @create-todo="viewInfo.handleCreateTodo"
        @create-todo-by-dialog="viewInfo.handleCreateTodoByDialog"
    />
    <suspense>
        <router-view />
    </suspense>
</template>

<script setup lang="ts">
import { TodoViewKanban } from '@nao-todo/layers'
import { inject } from 'vue'
import { basicViewContextKey } from './constants'
import type { BasicViewContext } from './types'

const { viewInfo } = inject<BasicViewContext>(basicViewContextKey)!
</script>

