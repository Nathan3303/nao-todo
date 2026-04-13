<script setup lang="ts">
import { inject } from 'vue'
import OrderButton from './order-button.vue'
import { type TaskTableContext } from './types'
import { TASK_TABLE_CONTEXT_KEY } from './use-table'

defineOptions({ name: 'TaskTableHeader' })

const tableContext = inject<TaskTableContext>(TASK_TABLE_CONTEXT_KEY)
</script>

<template>
    <nue-div v-if="tableContext" class="todo-table__header">
        <div class="todo-table__header__col col-first">
            <order-button prop="name">
                {{ tableContext.getColumnLabel('name') }}
            </order-button>
        </div>
        <div
            v-if="tableContext.columns.value.createdAt"
            class="todo-table__header__col col-datetime"
        >
            <order-button prop="createdAt">
                {{ tableContext.getColumnLabel('createdAt') }}
            </order-button>
        </div>
        <div
            v-if="tableContext.columns.value.updatedAt"
            class="todo-table__header__col col-datetime"
        >
            <order-button prop="updatedAt">
                {{ tableContext.getColumnLabel('updatedAt') }}
            </order-button>
        </div>
        <div v-if="tableContext.columns.value.startAt" class="todo-table__header__col col-datetime">
            <order-button prop="startAt">
                {{ tableContext.getColumnLabel('startAt') }}
            </order-button>
        </div>
        <div v-if="tableContext.columns.value.endAt" class="todo-table__header__col col-datetime">
            <order-button prop="endAt">
                {{ tableContext.getColumnLabel('endAt') }}
            </order-button>
        </div>
        <div v-if="tableContext.columns.value.priority" class="todo-table__header__col col-attr">
            <order-button prop="priority">
                {{ tableContext.getColumnLabel('priority') }}
            </order-button>
        </div>
        <div v-if="tableContext.columns.value.state" class="todo-table__header__col col-attr">
            <order-button prop="state">
                {{ tableContext.getColumnLabel('state') }}
            </order-button>
        </div>
        <div v-if="tableContext.columns.value.project" class="todo-table__header__col col-attr">
            <order-button prop="project">
                {{ tableContext.getColumnLabel('project') }}
            </order-button>
        </div>
        <div
            v-if="tableContext.columns.value.deletedAt"
            class="todo-table__header__col col-datetime"
        >
            <order-button prop="deletedAt">
                {{ tableContext.getColumnLabel('deletedAt') }}
            </order-button>
        </div>
        <div class="todo-table__header__col col-actions">
            <!-- <nue-icon
                v-if="tableContext.getOptions.value.sort"
                color="gray"
                name="clear"
                @click="tableContext.clearSortOptions()"
            /> -->
            <nue-icon name="more" style="opacity: 0" />
        </div>
    </nue-div>
</template>

