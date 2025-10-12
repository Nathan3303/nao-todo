<script lang="ts" setup>
import { onBeforeUnmount, onMounted, provide, computed, ref } from 'vue'
import { useTodoTable } from './use-table'
import { useRefreshKey } from './use-refresh-key'
import { todoTableContextKey } from './constants'
import TodoTableHeader from './table-header.vue'
import TodoTableMain from './table-main.vue'
import type { TodoTableEmits, TodoTableProps, TodoTableContext } from './types'
import type { TodoColumnOptions } from '@nao-todo/types'
import type { NueContent } from 'nue-ui'
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

const todoTableMainContentRef = ref<InstanceType<typeof NueContent>>()
const hasScrollBar = ref(false)
let resizeObserver: ResizeObserver | null = null

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
    if (window.ResizeObserver) {
        const element = todoTableMainContentRef.value!
        // 创建 ResizeObserver 实例
        resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const target = entry.target
                hasScrollBar.value = target.scrollHeight > target.clientHeight
            }
        })
        // 开始监听目标元素
        resizeObserver.observe(element.$el)
    }
})

onBeforeUnmount(() => {
    stopRefresh()
    if (resizeObserver) {
        const element = todoTableMainContentRef.value!
        resizeObserver.unobserve(element.$el)
        resizeObserver.disconnect()
        resizeObserver = null
    }
})

provide<TodoTableContext>(todoTableContextKey, {
    // header
    columnOptions: computed(() => props.columnOptions),
    sortOptions: computed(() => props.sortOptions),
    clearSortOptions: () => emit('clearSortOptions'),
    updateSortOptions: (newSortOptions) => emit('updateSortOptions', newSortOptions),
    isScrolling: hasScrollBar,
    // main
    todos: computed(() => props.todos),
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
        <nue-header :data-scrolling="hasScrollBar">
            <TodoTableHeader />
        </nue-header>
        <nue-divider />
        <nue-main>
            <nue-content fill ref="todoTableMainContentRef">
                <TodoTableMain />
            </nue-content>
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

    > .nue-header[data-scrolling='true'] {
        padding-right: 10px;
    }
}
</style>
