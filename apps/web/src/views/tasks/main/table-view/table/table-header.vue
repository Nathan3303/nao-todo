<template>
    <nue-div v-if="!isOnMobile" class="todo-table__header" wrap="nowrap">
        <div class="todo-table__header__col col-name">
            <order-button prop="name">名称</order-button>
        </div>
        <div v-if="columnOptions.createdAt" class="todo-table__header__col col-created-at">
            <order-button prop="createdAt">创建时间</order-button>
        </div>
        <div v-if="columnOptions.updatedAt" class="todo-table__header__col col-updated-at">
            <order-button prop="updatedAt">更新时间</order-button>
        </div>
        <div v-if="columnOptions.endAt" class="todo-table__header__col col-end-at">
            <order-button prop="endAt">截止日期</order-button>
        </div>
        <div v-if="columnOptions.priority" class="todo-table__header__col col-priority">
            <order-button prop="priority">优先级</order-button>
        </div>
        <div v-if="columnOptions.state" class="todo-table__header__col col-state">
            <order-button prop="state">状态</order-button>
        </div>
        <div v-if="columnOptions.project" class="todo-table__header__col col-project">
            <order-button prop="project">所属清单</order-button>
        </div>
        <div class="todo-table__header__col col-actions">
            <nue-icon
                v-if="sortOptions?.field"
                color="gray"
                name="clear"
                @click="handleClearSortInfo"
            />
            <nue-icon v-else name="more" style="opacity: 0" />
        </div>
    </nue-div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import type { TodoTableContext } from './types'
import { todoTableContextKey } from './constants'
import OrderButton from './order-button.vue'

defineOptions({ name: 'TodoTableHeader' })

const todoTableContext = inject<TodoTableContext>(todoTableContextKey)

const { columnOptions, isOnMobile, sortOptions, handleClearSortInfo } = todoTableContext!
</script>
