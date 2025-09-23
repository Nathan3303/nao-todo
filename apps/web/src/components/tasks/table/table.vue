<script lang="ts" setup>
import { onBeforeUnmount, onMounted, provide, computed } from 'vue'
import { useTodoTable } from './use-table'
import { useRefreshKey } from './use-refresh-key'
import { todoTableContextKey } from './constants'
import TodoTableHeader from './table-header.vue'
import TodoTableMain from './table-main.vue'
import type { TodoTableEmits, TodoTableProps, TodoTableContext } from './types'
import type { TodoColumnOptions } from '@nao-todo/types'
import './table.css'

defineOptions({ name: 'TodoTable' })
const props = defineProps<TodoTableProps>()
const emit = defineEmits<TodoTableEmits>()

const tableMinWidth = computed(() => {
    let columnCounter = 0
    for (const key in props.columnOptions) {
        if (props.columnOptions[key as keyof TodoColumnOptions]) {
            columnCounter++
        }
    }
    return `${columnCounter * 5 + 20}rem`
})

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

onMounted(() => {
    startRefresh()
})

onBeforeUnmount(() => {
    stopRefresh()
})

provide<TodoTableContext>(todoTableContextKey, {
    columnOptions: computed(() => props.columnOptions),
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

<template>
    <nue-container id="TodoTableContainer" :style="{ '--min-width': tableMinWidth }">
        <nue-header>
            <TodoTableHeader />
        </nue-header>
        <nue-divider />
        <nue-main>
            <TodoTableMain />
        </nue-main>
    </nue-container>
</template>

<style scoped>
.nue-container#TodoTableContainer {
    gap: 0.5rem;

    > .nue-header,
    > .nue-main,
    > .nue-footer {
        padding: 0;
        border: none;
        height: auto;
    }
}
</style>
