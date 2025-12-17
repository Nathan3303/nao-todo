<script lang="ts" setup>
import { onBeforeUnmount, onMounted, provide, computed } from 'vue'
import { useTodoTable } from './use-table'
import TodoTableHeader from './table-header.vue'
import TodoTableMain from './table-main.vue'
import TodoTableFooter from './table-footer.vue'
import { Loading as LoadingComp } from '@nao-todo/components'
import { TODO_TABLE_CONTEXT_KEY } from './constants'
import type { TodoTableEmits, TodoTableProps, TodoTableContext } from './types'
import './table.css'

defineOptions({ name: 'TodoTable' })
const props = defineProps<TodoTableProps>()
const emit = defineEmits<TodoTableEmits>()

// @hook useTodoTable
const {
    tags,
    page,
    error,
    todos,
    loading,
    refreshKey,
    pagination,
    selectRange,
    tagBarClamped,
    // tableMinWidth,
    stopRefresh,
    startRefresh,
    getColumnText,
    isTodoExpired,
    getProjectName,
    resetAndGetTodos,
    handleUpdatePage,
    handleClearSelect,
    handleUpdatePerPage,
    showTodoDetailsPanel,
    showMultiSelectPanel,
    handleClearSelectedId,
    deleteButtonClickHandler
} = useTodoTable(props, emit)

// @mounted
onMounted(() => {
    startRefresh()
})

// @beforeUnmounted
onBeforeUnmount(() => {
    stopRefresh()
})

// @provide 表格组件上下文
provide<TodoTableContext>(TODO_TABLE_CONTEXT_KEY, {
    // header
    sortOptions: computed(() => props.sortOptions),
    columnOptions: computed(() => props.columnOptions),
    getColumnText,
    clearSortOptions: () => emit('clearSortOptions'),
    updateSortOptions: (newSortOptions) => emit('updateSortOptions', newSortOptions),
    // main
    selectRange,
    tagBarClamped,
    tags: computed(() => tags.value),
    todos: computed(() => todos.value),
    refreshKey: computed(() => refreshKey.value),
    isTodoExpired,
    getProjectName,
    showTodoDetailsPanel,
    showMultiSelectPanel,
    deleteButtonClickHandler,
    // footer
    page: computed(() => page.value),
    error: computed(() => error.value),
    pagination: computed(() => pagination.value),
    handleUpdatePage,
    handleUpdatePerPage
})

// @expose 表格组件暴露的方法
defineExpose({
    reset: handleClearSelectedId,
    reload: resetAndGetTodos,
    resetSelect: handleClearSelect
})
</script>

<template>
    <loading-comp v-if="loading" style="height: 100%" />
    <nue-empty
        v-else-if="error"
        image-size="4rem"
        image-src="/images/coffee.webp"
        :description="error || '当前暂无待办，放松一下吧!'"
        style="height: 100%"
    />
    <nue-container v-else id="TodoTableContainer">
        <nue-main>
            <nue-content fill>
                <todo-table-header />
                <todo-table-main />
            </nue-content>
        </nue-main>
        <todo-table-footer />
    </nue-container>
</template>

