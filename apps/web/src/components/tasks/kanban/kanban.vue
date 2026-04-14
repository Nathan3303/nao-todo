<script lang="ts" setup>
import TaskKanbanColumn from './kanban-column.vue'
import useKanban from './use-kanban'
import type { TaskKanbanProps, TaskKanbanEmits } from './types'
import './kanban.css'
import { onMounted } from 'vue'

defineOptions({ name: 'TaskKanban' })
const props = defineProps<TaskKanbanProps>()
const emit = defineEmits<TaskKanbanEmits>()

const {
    states,
    getKanbanColumns,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragEnd,
    handleDrop
} = useKanban(props, emit)

onMounted(() => getKanbanColumns())
</script>

<template>
    <nue-container id="TodoKanbanContainer">
        <nue-main>
            <nue-empty
                v-if="states.kanbanColumns.length === 0"
                image-src="/images/coffee.webp"
                image-size="4rem"
                description="目前看板无分组"
            />
            <nue-content fill v-else>
                <task-kanban-column
                    v-for="groupName in states.kanbanColumns"
                    :key="groupName"
                    :category="groupName"
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
