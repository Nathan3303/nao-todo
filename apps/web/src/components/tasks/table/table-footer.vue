<script setup lang="ts">
import { inject } from 'vue'
import { TODO_TABLE_CONTEXT_KEY } from './constants'
import { Pager } from '@/components/ui'
import type { TodoTableContext } from './types'

defineOptions({ name: 'TodoTableFooter' })

const { pagination, page, error, todos, handleUpdatePerPage, handleUpdatePage } =
    inject<TodoTableContext>(TODO_TABLE_CONTEXT_KEY)!
</script>

<template>
    <nue-footer v-if="!error && todos.length !== 0">
        <nue-div v-if="pagination" align="center" justify="space-between">
            <nue-text color="gray" flex size="12px">
                当前列表 {{ pagination.current || 0 }} 项， 共计 {{ pagination.total || 0 }} 项。
            </nue-text>
            <pager
                :limit="pagination.limit"
                :page="page"
                :total-pages="pagination.maxPage"
                @per-page-change="handleUpdatePerPage"
                @page-change="handleUpdatePage"
            />
        </nue-div>
    </nue-footer>
</template>
