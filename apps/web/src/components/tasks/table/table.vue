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
    return `${columnCounter * 6 + 12}rem`
})

const {
    selectRange,
    tagBarClamped,
    isTodoExpired,
    showTodoDetailsPanel,
    showMultiSelectPanel,
    handleClearSelectedId,
    handleClearSelect,
    getProjectNameByIdFromLocal,
    deleteButtonClickHandler
} = useTodoTable(props, emit)
const { refreshKey, startRefresh, stopRefresh } = useRefreshKey()

onMounted(() => {
    startRefresh()
})

onBeforeUnmount(() => {
    stopRefresh()
})

provide<TodoTableContext>(todoTableContextKey, {
    // header
    columnOptions: computed(() => props.columnOptions),
    sortOptions: computed(() => props.sortOptions),
    clearSortOptions: () => emit('clearSortOptions'),
    updateSortOptions: (newSortOptions) => emit('updateSortOptions', newSortOptions),
    // main
    todos: props.todos,
    selectRange,
    tagBarClamped,
    tags: computed(() => props.tags),
    refreshKey,
    isTodoExpired,
    showTodoDetailsPanel,
    showMultiSelectPanel,
    getProjectNameByIdFromLocal,
    deleteButtonClickHandler
})

defineExpose({
    resetSelect: handleClearSelect,
    reset: handleClearSelectedId
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
