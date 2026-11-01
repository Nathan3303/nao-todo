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
                <task-kanban-column
                    v-for="groupName in kanbanColumns"
                    :key="groupName"
                    :category="groupName"
                    :group-by="groupBy"
                    :columns="columns"
                    :tasks="tasks"
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