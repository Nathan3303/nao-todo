<script setup lang="ts">
import { inject, computed } from 'vue'
import {
    TaskPriorityInfo,
    TaskStateInfo,
    TaskTagBar,
    TaskDateInfo,
    TaskBasicInfo
} from '@nao-todo/components'
import { parse2RelativeDate } from '@nao-todo/infrastructure/utils/relative-date-parser'
import { TASK_TABLE_CONTEXT_KEY } from './use-table'
import type { TaskTableContext, TableColumnConfig } from './types'

defineOptions({ name: 'TaskTableMain' })

const tableCtx = inject<TaskTableContext>(TASK_TABLE_CONTEXT_KEY)!

const visibleColumns = computed(() => {
    return tableCtx.visibleColumns.value || []
})

const tasks = computed(() => {
    return tableCtx.tasks.value || []
})

const getColumnStyle = (column: TableColumnConfig) => {
    const width = column.width ?? column.defaultWidth
    return {
        width: `${width}px`,
        minWidth: `${column.minWidth}px`,
        maxWidth: `${column.maxWidth}px`
    }
}
</script>

<template>
    <nue-div v-if="tableCtx" class="todo-table__main">
        <nue-div
            v-for="(task, idx) in tasks"
            :key="task.id"
            :data-done="task.state === 'done'"
            :data-selected="tableCtx.isInMultiSelectRange(idx)"
            :data-deleted="task.isDeleted"
            :data-giveup="task.isGivenUp"
            class="todo-table__main__row"
            @click.stop.exact="tableCtx.showTaskDetails(task.id, idx)"
            @click.stop.shift.exact="tableCtx.showMultiSelectPanel(idx)"
        >
            <template v-for="column in visibleColumns" :key="column.key">
                <nue-div v-if="column.key === 'name'" class="todo-table__main__col col-first" vertical :style="getColumnStyle(column)">
                    <nue-div class="col-first__name-wrapper">
                        <nue-text theme="todo-name" :clamped="1" :title="task.name">
                            {{ task.name }}
                        </nue-text>
                        <task-tag-bar
                            v-if="tableCtx.columns.tags && task.tags && task.tags.length"
                            :clamped="tableCtx.tagBarClamped"
                            :tags="tableCtx.tags"
                            :task-tags="task.tags"
                            readonly
                            small
                        />
                    </nue-div>
                    <nue-div
                        v-if="tableCtx.columns.description && task.description"
                        vertical
                        width="100%"
                    >
                        <nue-text :clamped="2" class="col-first__description" :title="task.description">
                            {{ task.description }}
                        </nue-text>
                    </nue-div>
                </nue-div>

                <task-date-info
                    v-else-if="column.key === 'createdAt'"
                    class="todo-table__main__col col-datetime"
                    :date="task.createdAt"
                    :style="getColumnStyle(column)"
                />

                <task-date-info
                    v-else-if="column.key === 'updatedAt'"
                    class="todo-table__main__col col-datetime"
                    :date="task.updatedAt"
                    :style="getColumnStyle(column)"
                />

                <nue-div
                    v-else-if="column.key === 'startAt'"
                    class="todo-table__main__col col-datetime"
                    :style="getColumnStyle(column)"
                >
                    <nue-text v-if="task.startAt" :title="task.startAt">
                        {{ parse2RelativeDate(task.startAt) }}
                    </nue-text>
                    <nue-text v-else>未设置起始时间</nue-text>
                </nue-div>

                <task-date-info
                    v-else-if="column.key === 'endAt'"
                    class="todo-table__main__col col-datetime"
                    :date="task.endAt!"
                    :colored="!(task.state === 'done')"
                    :style="getColumnStyle(column)"
                />

                <task-priority-info
                    v-else-if="column.key === 'priority'"
                    class="todo-table__main__col col-attr"
                    :key="task.priority"
                    :priority="task.priority"
                    use-clamped
                    :style="getColumnStyle(column)"
                />

                <task-state-info
                    v-else-if="column.key === 'state'"
                    class="todo-table__main__col col-attr"
                    :key="task.state"
                    :state="task.state"
                    use-clamped
                    :style="getColumnStyle(column)"
                />

                <task-basic-info
                    v-else-if="column.key === 'project'"
                    class="todo-table__main__col col-attr"
                    :text="tableCtx.getProjectName(task.projectId)"
                    no-icon
                    :style="getColumnStyle(column)"
                />

                <task-date-info
                    v-else-if="column.key === 'deletedAt'"
                    class="todo-table__main__col col-datetime"
                    :date="task.deletedAt!"
                    :style="getColumnStyle(column)"
                />
            </template>

            <nue-div class="todo-table__main__col col-actions">
                <nue-icon
                    :name="task.isDeleted ? 'restore' : 'delete'"
                    @click.stop="tableCtx.deleteOrRestore(task.id, task.isDeleted)"
                />
            </nue-div>
        </nue-div>
    </nue-div>
</template>
