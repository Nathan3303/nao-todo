<template>
    <nue-div :id="tableId" :class="['todo-table', { 'todo-table--mobile': isOnMobile }]">
        <TodoTableHeader />
        <nue-divider v-if="!isOnMobile" />
        <TodoTableMain />
    </nue-div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, provide, computed } from 'vue'
import { useTodoTable } from './use-table'
import { useRefreshKey } from './use-refresh-key'
import { useResizeObserver } from './use-resize-observer'
import { generateId } from '@nao-todo/utils'
import { todoTableContextKey } from './constants'
import type { TodoTableEmits, TodoTableProps, TodoTableContext } from './types'
import TodoTableHeader from './table-header.vue'
import TodoTableMain from './table-main.vue'
import './table.css'

defineOptions({ name: 'TodoTable' })
const props = defineProps<TodoTableProps>()
const emit = defineEmits<TodoTableEmits>()

const tableId = generateId()

const {
    selectRange,
    tagBarClamped,
    isTodoExpired,
    handleDeleteBtnClk,
    handleShowDetails,
    handleMultiSelect,
    handleClearSelectedId,
    handleClearSelect,
    handleClearSortInfo,
    getProjectNameByIdFromLocal,
    handleUpdateSortOptions
} = useTodoTable(props, emit)
const { refreshKey, startRefresh, stopRefresh } = useRefreshKey()
const { isOnMobile, observe, unobserve } = useResizeObserver(tableId)

onMounted(() => {
    startRefresh()
    observe()
})

onBeforeUnmount(() => {
    stopRefresh()
    unobserve()
})

provide<TodoTableContext>(todoTableContextKey, {
    columnOptions: computed(() => props.columnOptions),
    isOnMobile,
    sortOptions: computed(() => props.sortOptions),
    todos: computed(() => props.todos),
    selectRange,
    useDeletedLine: computed(() => props.useDeletedLine),
    tagBarClamped,
    tags: computed(() => props.tags),
    refreshKey,
    isTodoExpired,
    handleClearSortInfo,
    handleShowDetails,
    handleMultiSelect,
    getProjectNameByIdFromLocal,
    handleDeleteBtnClk,
    handleUpdateSortOptions
})

defineExpose({
    reset: handleClearSelectedId,
    resetSelect: handleClearSelect
})
</script>
