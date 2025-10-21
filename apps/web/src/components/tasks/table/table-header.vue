<script setup lang="ts">
import { inject } from 'vue'
import OrderButton from './order-button.vue'
import { TODO_TABLE_CONTEXT_KEY } from './constants'
import type { TodoTableContext } from './types'

defineOptions({ name: 'TodoTableHeader' })

const { columnOptions, sortOptions, clearSortOptions, getColumnText } =
    inject<TodoTableContext>(TODO_TABLE_CONTEXT_KEY)!
</script>

<template>
    <nue-div class="todo-table__header">
        <div class="todo-table__header__col col-first">
            <order-button prop="name">{{ getColumnText('name') }}</order-button>
        </div>
        <div v-if="columnOptions.createdAt" class="todo-table__header__col col-datetime">
            <order-button prop="createdAt">{{ getColumnText('createdAt') }}</order-button>
        </div>
        <div v-if="columnOptions.updatedAt" class="todo-table__header__col col-datetime">
            <order-button prop="updatedAt">{{ getColumnText('updatedAt') }}</order-button>
        </div>
        <div v-if="columnOptions.startAt" class="todo-table__header__col col-datetime">
            <order-button prop="startAt">{{ getColumnText('startAt') }}</order-button>
        </div>
        <div v-if="columnOptions.endAt" class="todo-table__header__col col-datetime">
            <order-button prop="endAt">{{ getColumnText('endAt') }}</order-button>
        </div>
        <div v-if="columnOptions.priority" class="todo-table__header__col col-attr">
            <order-button prop="priority">{{ getColumnText('priority') }}</order-button>
        </div>
        <div v-if="columnOptions.state" class="todo-table__header__col col-attr">
            <order-button prop="state">{{ getColumnText('state') }}</order-button>
        </div>
        <div v-if="columnOptions.project" class="todo-table__header__col col-attr">
            <order-button prop="project">{{ getColumnText('project') }}</order-button>
        </div>
        <div class="todo-table__header__col col-actions">
            <nue-icon v-if="sortOptions" color="gray" name="clear" @click="clearSortOptions" />
            <nue-icon v-else name="more" style="opacity: 0" />
        </div>
    </nue-div>
</template>
