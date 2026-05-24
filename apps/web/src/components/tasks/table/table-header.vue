<script setup lang="ts">
import { inject, ref, computed } from 'vue'
import OrderButton from './order-button.vue'
import { type TaskTableContext, type TableColumnConfig } from './types'
import { TASK_TABLE_CONTEXT_KEY } from './use-table'

defineOptions({ name: 'TaskTableHeader' })

const tableContext = inject<TaskTableContext>(TASK_TABLE_CONTEXT_KEY)
const draggingIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const resizingColumn = ref<string | null>(null)
const startX = ref<number>(0)
const startWidth = ref<number>(0)

const visibleColumns = computed(() => {
    return tableContext?.visibleColumns.value || []
})

const handleDragStart = (e: DragEvent, index: number) => {
    e.dataTransfer?.setData('text/plain', index.toString())
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move'
    }
    draggingIndex.value = index
}

const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'move'
    dragOverIndex.value = index
}

const handleDragLeave = () => {
    dragOverIndex.value = null
}

const handleDrop = (e: DragEvent, targetIndex: number) => {
    e.preventDefault()
    const fromIndex = parseInt(e.dataTransfer?.getData('text/plain') || '0')
    if (tableContext) {
        tableContext.columnReorder({ fromIndex, toIndex: targetIndex })
    }
    draggingIndex.value = null
    dragOverIndex.value = null
}

const handleDragEnd = () => {
    draggingIndex.value = null
    dragOverIndex.value = null
}

const handleResizeStart = (e: MouseEvent, columnKey: string, column: TableColumnConfig) => {
    e.preventDefault()
    e.stopPropagation()
    resizingColumn.value = columnKey
    startX.value = e.clientX
    startWidth.value = column.width ?? column.defaultWidth
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
}

const handleResizeMove = (e: MouseEvent) => {
    if (!resizingColumn.value || !tableContext) return
    const deltaX = e.clientX - startX.value
    const newWidth = startWidth.value + deltaX
    const column = visibleColumns.value.find((c) => c.key === resizingColumn.value)
    if (column) {
        const clampedWidth = Math.max(column.minWidth, Math.min(column.maxWidth, newWidth))
        tableContext.columnResize({
            columnKey: resizingColumn.value as never,
            newWidth: clampedWidth
        })
    }
}

const handleResizeEnd = () => {
    resizingColumn.value = null
    document.removeEventListener('mousemove', handleResizeMove)
    document.removeEventListener('mouseup', handleResizeEnd)
}

const getColumnStyle = (column: TableColumnConfig) => {
    const width = column.width ?? column.defaultWidth
    return {
        width: `${width}px`,
        minWidth: `${column.minWidth}px`,
        maxWidth: `${column.maxWidth}px`
    }
}

const getColumnTypeClass = (key: string) => {
    if (['createdAt', 'updatedAt', 'startAt', 'endAt', 'deletedAt'].includes(key)) {
        return 'col-datetime'
    }
    return 'col-attr'
}
</script>

<template>
    <nue-div v-if="tableContext" class="todo-table__header">
        <div
            v-for="(column, index) in visibleColumns"
            :key="column.key"
            class="todo-table__header__col"
            :class="[
                column.key === 'name' ? 'col-first' : getColumnTypeClass(column.key),
                { dragging: draggingIndex === index },
                { 'drag-over': dragOverIndex === index }
            ]"
            :style="getColumnStyle(column)"
            :draggable="column.key !== 'name'"
            @dragstart="column.key !== 'name' ? handleDragStart($event, index) : null"
            @dragover="column.key !== 'name' ? handleDragOver($event, index) : null"
            @dragleave="handleDragLeave"
            @drop="column.key !== 'name' ? handleDrop($event, index) : null"
            @dragend="handleDragEnd"
        >
            <order-button :prop="column.key">
                {{ tableContext.getColumnLabel(column.key) }}
            </order-button>
            <div
                v-if="column.key !== 'deletedAt'"
                class="column-resizer"
                @mousedown="handleResizeStart($event, column.key, column)"
            />
        </div>
        <div class="todo-table__header__col col-actions">
            <nue-icon name="more" style="opacity: 0" />
        </div>
    </nue-div>
</template>

