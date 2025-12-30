<script setup lang="ts">
import { inject } from 'vue'
import { Pager } from '@nao-todo/components'
import type { TaskTableContext } from './types'
import { TASK_TABLE_CONTEXT_KEY } from './use-table'

defineOptions({ name: 'TaskTableFooter' })

const tableCtx = inject<TaskTableContext>(TASK_TABLE_CONTEXT_KEY)
</script>

<template>
    <nue-footer v-if="tableCtx">
        <nue-div
            v-if="!tableCtx.states.value.error && tableCtx.states.value.tasks.length !== 0"
            align="center"
            justify="space-between"
            width="100%"
        >
            <nue-text color="gray" flex size="12px">
                当前列表 {{ tableCtx.states.value.tasks.length || 0 }} 项， 共计
                {{ tableCtx.states.value.pagination.total || 0 }} 项。
            </nue-text>
            <pager
                :limit="tableCtx.states.value.pagination.limit"
                :page="tableCtx.states.value.pagination.page"
                :total-pages="tableCtx.states.value.pagination.maxPage"
                @per-page-change="tableCtx.handleUpdatePerPage"
                @page-change="tableCtx.handleUpdatePage"
            />
        </nue-div>
    </nue-footer>
</template>
