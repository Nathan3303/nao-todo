<script lang="ts" setup>
import TaskKanbanColumn from './kanban-column.vue'
import useKanban from './use-kanban'
import type { TaskKanbanProps, TaskKanbanEmits } from './types'
import './kanban.css'

defineOptions({ name: 'TaskKanban' })
const props = defineProps<TaskKanbanProps>()
const emit = defineEmits<TaskKanbanEmits>()

const {
    groupBy,
    kanbanColumns,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragEnd,
    handleDrop
} = useKanban(props, emit)
</script>

<template>
    <nue-container id="TodoKanbanContainer">
        <nue-main>
            <nue-content fill>
                <!--
                    `:key` 必须含 `groupBy`（ADR 决策 3）：分组切换靠**结构性重建**重置各列游标，
                    而不是再加第三个 watch（否则旧列会先拿新分组字段查一次空转查询）
                -->
                <task-kanban-column
                    v-for="groupName in kanbanColumns"
                    :key="`${groupBy}:${groupName}`"
                    :category="groupName"
                    :group-by="groupBy"
                    :columns="columns"
                    :data-category="groupName"
                    data-droppable="true"
                    @dragend="handleDragEnd"
                    @dragenter="handleDragEnter"
                    @dragover="handleDragOver"
                    @dragstart="handleDragStart"
                    @drop="handleDrop"
                />
            </nue-content>
        </nue-main>
    </nue-container>
</template>