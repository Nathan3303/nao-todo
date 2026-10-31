<script lang="ts" setup>
import TaskKanbanColumn from './kanban-column.vue'
import useKanban from './use-kanban'
import type { TaskKanbanProps, TaskKanbanEmits } from './types'
import './kanban.css'
import { computed, onMounted } from 'vue'
import { SegmentedSwitch } from '@nao-todo/shared/components/segmented-switch'
import { t } from '@nao-todo/shared/locales'

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

// @computed 分组切换分段（默认 state；不持久化，刷新回默认 —— PRD R7）
const groupByOptions = computed(() => [
    { value: 'state' as const, label: t('task.kanban.groupByState') },
    { value: 'priority' as const, label: t('task.kanban.groupByPriority') }
])

// @method 切换分组（单一来源件 `SegmentedSwitch` 只上抛段值 ⇒ 此处收窄回分组枚举）
const handleGroupByChange = (value: string) => {
    if (value === 'state' || value === 'priority') getKanbanColumns(value)
}

onMounted(() => getKanbanColumns())
</script>

<template>
    <nue-container id="TodoKanbanContainer">
        <nue-header class="kanban-toolbar">
            <!-- 分组切换：复用 DESIGN §4.5 单一来源件（role=group + 每段 aria-pressed）；不持久化（R7） -->
            <segmented-switch
                :fill="false"
                size="md"
                :items="groupByOptions"
                :model-value="states.currentGroupBy"
                :aria-label="t('task.kanban.groupByLabel')"
                @update:model-value="handleGroupByChange"
            />
        </nue-header>
        <nue-main>
            <nue-content fill>
                <task-kanban-column
                    v-for="groupName in states.kanbanColumns"
                    :key="groupName"
                    :category="groupName"
                    :group-by="states.currentGroupBy"
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